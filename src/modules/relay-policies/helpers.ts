import {
  RelayConstraints,
  RelayPolicyConfiguration,
  RelaySelection,
} from "@/interfaces/RelayPolicy";

export const emptySelection = (): RelaySelection => ({
  relay_ids: [],
  group_ids: [],
});
export const emptyConstraints = (): RelayConstraints => ({
  exclude: emptySelection(),
  preferences: [],
  force_relay: false,
});
export const emptyPeerSelector = () => ({
  peer_ids: [] as string[],
  group_ids: [] as string[],
});

export function moveTier<T>(values: T[], index: number, delta: number): T[] {
  const next = index + delta;
  if (next < 0 || next >= values.length) return values;
  const copy = [...values];
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}

export function configurationErrors(
  config: RelayPolicyConfiguration,
): string[] {
  const errors: string[] = [];
  for (const resources of [
    config.groups,
    config.home_profiles,
    config.pair_policies,
  ]) {
    const identities = new Set<string>();
    for (const resource of resources) {
      if (!resource.id.trim() || identities.has(resource.id))
        errors.push(
          "Each resource needs an ID unique within its resource type.",
        );
      identities.add(resource.id);
      if (!resource.name.trim() || resource.name.length > 255)
        errors.push("Names must contain 1 to 255 characters.");
    }
  }
  for (const rule of [...config.home_profiles, ...config.pair_policies]) {
    if (
      !Number.isInteger(rule.priority) ||
      rule.priority < 0 ||
      rule.priority > 4294967295
    )
      errors.push(`${rule.name}: priority must be a non-negative integer.`);
    if (rule.constraints.allow && !selectionHasValues(rule.constraints.allow))
      errors.push(
        `${rule.name}: an explicit allow selection cannot be empty. Select relays or use all approved relays.`,
      );
    if (
      rule.constraints.preferences.length > 64 ||
      rule.constraints.preferences.some((tier) => !selectionHasValues(tier))
    )
      errors.push(
        `${rule.name}: each preference tier needs a relay or relay group (maximum 64 tiers).`,
      );
    const selectors =
      "selector" in rule ? [rule.selector] : [rule.source, rule.destination];
    if (selectors.some((s) => s.peer_ids.length + s.group_ids.length === 0))
      errors.push(`${rule.name}: select peers or peer groups for each target.`);
  }
  return [...new Set(errors)];
}

export function selectionHasValues(selection: RelaySelection) {
  return selection.relay_ids.length + selection.group_ids.length > 0;
}

// A stale draft is rebased only by an explicit user action and must be previewed again.
export function rebaseDraft(
  draft: RelayPolicyConfiguration,
  latest: RelayPolicyConfiguration,
): RelayPolicyConfiguration {
  return {
    ...draft,
    revision: latest.revision,
    catalog_generation: latest.catalog_generation,
  };
}

export function configurationForQuery(
  configuration: RelayPolicyConfiguration,
  query: Pick<URLSearchParams, "get">,
): RelayPolicyConfiguration {
  const peer = query.get("peer");
  if (!peer || query.get("policy") || query.get("profile"))
    return configuration;
  const existing = explicitRulesForQuery(configuration, query);
  if (existing.home.length || existing.pair.length) return configuration;
  if (query.get("scope") === "home") {
    return {
      ...configuration,
      home_profiles: [
        ...configuration.home_profiles,
        {
          id: crypto.randomUUID(),
          name: "New home profile",
          revision: 0,
          priority: 100,
          enabled: false,
          selector: { ...emptyPeerSelector(), peer_ids: [peer] },
          constraints: emptyConstraints(),
        },
      ],
    };
  }
  const remote = query.get("remote");
  return {
    ...configuration,
    pair_policies: [
      ...configuration.pair_policies,
      {
        id: crypto.randomUUID(),
        name: "New pair rule",
        revision: 0,
        priority: 100,
        enabled: false,
        source: { ...emptyPeerSelector(), peer_ids: [peer] },
        destination: {
          ...emptyPeerSelector(),
          peer_ids: remote ? [remote] : [],
        },
        constraints: emptyConstraints(),
      },
    ],
  };
}

export function explicitRulesForQuery(
  configuration: RelayPolicyConfiguration,
  query: Pick<URLSearchParams, "get">,
) {
  const peer = query.get("peer");
  const remote = query.get("remote");
  const exact = (
    selector: { peer_ids: string[]; group_ids: string[] },
    id: string | null,
  ) =>
    !!id &&
    selector.group_ids.length === 0 &&
    selector.peer_ids.length === 1 &&
    selector.peer_ids[0] === id;
  return {
    home:
      query.get("scope") === "home"
        ? configuration.home_profiles
            .filter((profile) => exact(profile.selector, peer))
            .map((profile) => profile.id)
        : [],
    pair:
      query.get("scope") !== "home"
        ? configuration.pair_policies
            .filter(
              (policy) =>
                (exact(policy.source, peer) &&
                  exact(policy.destination, remote)) ||
                (exact(policy.source, remote) &&
                  exact(policy.destination, peer)),
            )
            .map((policy) => policy.id)
        : [],
  };
}
