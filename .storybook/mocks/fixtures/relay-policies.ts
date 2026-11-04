import type {
  RelayCatalogResponse,
  RelayEffectivePolicy,
  RelayPolicyConfiguration,
  RelayPolicyPreview,
  RelayPolicyStatus,
} from "@/interfaces/RelayPolicy";
import { GROUP, PEER } from "./ids";
import type { Handler, HandlerContext } from "./index";

export const relayCatalog: RelayCatalogResponse = {
  generation: 2,
  entries: ["relay-a", "relay-b", "relay-c"].map((id) => ({
    id,
    endpoint: `rels://${id}.example.com:443`,
    instance_endpoint: `rels://${id}.example.com:443`,
    aliases: [],
    active: true,
    legacy: false,
  })),
};
const selection = (relay_ids: string[]) => ({ relay_ids, group_ids: [] });
export const relayConfiguration: RelayPolicyConfiguration = {
  supported: true,
  revision: 4,
  catalog_generation: 2,
  groups: [
    {
      id: "regional",
      name: "Regional relays",
      revision: 4,
      relay_ids: ["relay-a", "relay-b"],
    },
  ],
  home_profiles: [
    {
      id: "home-office",
      name: "Office home",
      revision: 4,
      priority: 100,
      enabled: true,
      selector: { peer_ids: [], group_ids: [GROUP.developers] },
      constraints: {
        allow: selection(["relay-a", "relay-b"]),
        exclude: selection([]),
        preferences: [selection(["relay-a"]), selection(["relay-b"])],
        force_relay: false,
      },
    },
  ],
  pair_policies: [
    {
      id: "office-servers",
      name: "Office to servers",
      revision: 4,
      priority: 100,
      enabled: true,
      source: { peer_ids: [PEER.macbook], group_ids: [] },
      destination: { peer_ids: [PEER.webServer], group_ids: [] },
      constraints: {
        allow: selection(["relay-a", "relay-b"]),
        exclude: selection(["relay-c"]),
        preferences: [selection(["relay-a"]), selection(["relay-b"])],
        force_relay: true,
      },
    },
  ],
};
export const relayEffectivePolicy: RelayEffectivePolicy = {
  state: "ready",
  revision: 4,
  catalog_generation: 2,
  reselection_generation: 1,
  digest: "a".repeat(64),
  force_relay: true,
  tiers: [[relayCatalog.entries[0]], [relayCatalog.entries[1]]],
  contributors: [
    { id: "office-servers", revision: 4, eliminated: ["relay-c"] },
  ],
  preference_rule: "office-servers",
  eliminated: ["relay-c"],
};
export const relayPreview: RelayPolicyPreview = {
  revision: 4,
  catalog_generation: 2,
  truncated: false,
  home: [
    {
      peer_id: PEER.macbook,
      unsupported: false,
      policy: {
        ...relayEffectivePolicy,
        force_relay: false,
        contributors: [{ id: "home-office", revision: 4, eliminated: [] }],
        preference_rule: "home-office",
      },
    },
  ],
  pairs: [
    {
      peer_a: PEER.macbook,
      peer_b: PEER.webServer,
      policy: relayEffectivePolicy,
      unsupported: false,
    },
  ],
};
export const relayStatus: RelayPolicyStatus = {
  peer_a: PEER.macbook,
  peer_b: PEER.webServer,
  policy: relayEffectivePolicy,
  application: "pending",
  healthy: false,
  transport: "unknown",
  relay_id: "",
  endpoints: [],
};
export const relayPolicyFixtures: Record<string, Handler> = {
  "GET /relay-catalog": relayCatalog,
  "GET /relay-policies/configuration": relayConfiguration,
  "POST /relay-policies/preview": relayPreview,
  "PUT /relay-policies/configuration": ({ body }: HandlerContext) => ({
    ...(body as RelayPolicyConfiguration),
    revision: 5,
  }),
  "GET /relay-policies/effective": { policy: relayEffectivePolicy },
  "GET /relay-policies/status": ({ query }: HandlerContext) => ({
    ...relayStatus,
    peer_a: query.get("peer_a") ?? PEER.macbook,
    peer_b: query.get("peer_b") ?? "",
    policy: query.get("peer_b")
      ? relayEffectivePolicy
      : relayPreview.home[0].policy,
  }),
  "POST /relay-policies/retry": {
    generation: 2,
    policy: { ...relayEffectivePolicy, reselection_generation: 2 },
  },
};
