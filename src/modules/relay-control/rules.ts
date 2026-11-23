import {
  RelayCatalogItem,
  RelayConstraints,
  RelayHomeProfile,
  RelayPairPolicy,
  RelayPolicyConfiguration,
} from "@/interfaces/RelayPolicy";

// Rules created by the simple Relays screen. Everything else is left untouched.
export const EASY_PREFIX = "easy-";
const homeId = (peer: string) => `${EASY_PREFIX}home-${peer}`;
const pairId = (a: string, b: string) => `${EASY_PREFIX}pair-${a}-${b}`;

export type Assignments = Record<string, string | undefined>;

const preferFirst = (
  first: string,
  all: string[],
  forceRelay: boolean,
): RelayConstraints => ({
  allow: { relay_ids: all, group_ids: [] },
  exclude: { relay_ids: [], group_ids: [] },
  force_relay: forceRelay,
  preferences: [first, ...all.filter((id) => id !== first)].map((id) => ({
    relay_ids: [id],
    group_ids: [],
  })),
});

export const readAssignments = (
  configuration: RelayPolicyConfiguration,
): Assignments =>
  Object.fromEntries(
    configuration.home_profiles
      .filter((profile) => profile.id.startsWith(`${EASY_PREFIX}home-`))
      .map((profile) => [
        profile.selector.peer_ids[0],
        profile.constraints.preferences[0]?.relay_ids[0],
      ]),
  );

// A pair follows the peer that was moved. When both ends are assigned different
// relays: the peer moved in this change wins, else the pair keeps its current
// relay, else the lower peer id wins.
export function buildConfiguration(
  configuration: RelayPolicyConfiguration,
  assignments: Assignments,
  peerIds: string[],
  relays: RelayCatalogItem[],
  forceRelay: boolean,
  justMoved: string[] = [],
): RelayPolicyConfiguration {
  const current = (a: string, b: string) =>
    configuration.pair_policies.find((p) => p.id === pairId(a, b))?.constraints
      .preferences[0]?.relay_ids[0];
  const all = relays.filter((r) => r.active && !r.legacy).map((r) => r.id);
  const assigned = peerIds.filter((id) => assignments[id]);
  const home: RelayHomeProfile[] = assigned.map((peer) => ({
    id: homeId(peer),
    name: `Device ${peer}`,
    revision: 0,
    priority: 0,
    enabled: true,
    selector: { peer_ids: [peer], group_ids: [] },
    constraints: preferFirst(assignments[peer]!, all, false),
  }));
  const pairs: RelayPairPolicy[] = peerIds.flatMap((a, i) =>
    peerIds.slice(i + 1).flatMap((b) => {
      const set = [a, b].filter((p) => assignments[p]);
      const relay =
        set.length === 2 && assignments[a] !== assignments[b]
          ? set.some((p) => justMoved.includes(p))
            ? assignments[set.find((p) => justMoved.includes(p))!]
            : [assignments[a], assignments[b]].includes(current(a, b))
              ? current(a, b)
              : assignments[set.sort()[0]]
          : set.length
            ? assignments[set[0]]
            : undefined;
      return relay
        ? [
            {
              id: pairId(a, b),
              name: `${a} ↔ ${b}`,
              revision: 0,
              priority: 0,
              enabled: true,
              source: { peer_ids: [a], group_ids: [] },
              destination: { peer_ids: [b], group_ids: [] },
              constraints: preferFirst(relay, all, forceRelay),
            },
          ]
        : [];
    }),
  );
  return {
    ...configuration,
    home_profiles: [
      ...configuration.home_profiles.filter((p) => !p.id.startsWith(EASY_PREFIX)),
      ...home,
    ],
    pair_policies: [
      ...configuration.pair_policies.filter((p) => !p.id.startsWith(EASY_PREFIX)),
      ...pairs,
    ],
  };
}

export const relayLabel = (relay: RelayCatalogItem) =>
  relay.endpoint.replace(/^rels?:\/\//, "");
