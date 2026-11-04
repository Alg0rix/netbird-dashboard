import { describe, expect, it } from "vitest";
import { RelayPolicyConfiguration } from "@/interfaces/RelayPolicy";
import {
  configurationErrors,
  configurationForQuery,
  emptyConstraints,
  emptyPeerSelector,
  explicitRulesForQuery,
  moveTier,
  rebaseDraft,
} from "./helpers";

export const emptyConfiguration = (): RelayPolicyConfiguration => ({
  supported: true,
  revision: 4,
  catalog_generation: 2,
  groups: [],
  home_profiles: [],
  pair_policies: [],
});
const pair = () => ({
  id: "rule",
  name: "A to B",
  revision: 4,
  priority: 10,
  enabled: true,
  source: { ...emptyPeerSelector(), peer_ids: ["a"] },
  destination: { ...emptyPeerSelector(), peer_ids: ["b"] },
  constraints: emptyConstraints(),
});

describe("relay drafts", () => {
  it("distinguishes an omitted unrestricted allow from an invalid explicit empty allow", () => {
    const config = { ...emptyConfiguration(), pair_policies: [pair()] };
    expect(configurationErrors(config)).toEqual([]);
    config.pair_policies[0].constraints.allow = {
      relay_ids: [],
      group_ids: [],
    };
    expect(configurationErrors(config).join(" ")).toContain(
      "explicit allow selection cannot be empty",
    );
  });
  it("moves entire equal-priority tiers without flattening their membership", () => {
    const tiers = [["a", "c"], ["b"], ["d"]];
    expect(moveTier(tiers, 1, -1)).toEqual([["b"], ["a", "c"], ["d"]]);
    expect(tiers).toEqual([["a", "c"], ["b"], ["d"]]);
    expect(moveTier(tiers, 0, -1)).toEqual(tiers);
  });
  it("preserves full stale draft while explicitly advancing only server fences", () => {
    const draft = { ...emptyConfiguration(), pair_policies: [pair()] };
    const latest = {
      ...emptyConfiguration(),
      revision: 9,
      catalog_generation: 7,
    };
    expect(rebaseDraft(draft, latest)).toEqual({
      ...draft,
      revision: 9,
      catalog_generation: 7,
    });
    expect(draft.revision).toBe(4);
  });
  it("opens reverse explicit pair rules and avoids silently creating duplicate rules", () => {
    const config = {
      ...emptyConfiguration(),
      pair_policies: [pair(), { ...pair(), id: "second" }],
    };
    const query = new URLSearchParams("peer=b&remote=a");
    expect(explicitRulesForQuery(config, query).pair).toEqual([
      "rule",
      "second",
    ]);
    expect(configurationForQuery(config, query)).toBe(config);
  });
  it("creates a home-only draft for home intent and a symmetric target for pair intent", () => {
    const home = configurationForQuery(
      emptyConfiguration(),
      new URLSearchParams("peer=a&scope=home"),
    );
    expect(home.pair_policies).toEqual([]);
    expect(home.home_profiles[0].selector.peer_ids).toEqual(["a"]);
    expect(home.home_profiles[0].enabled).toBe(false);
    const both = configurationForQuery(
      emptyConfiguration(),
      new URLSearchParams("peer=a&remote=b"),
    );
    expect(both.pair_policies[0].destination.peer_ids).toEqual(["b"]);
    expect(both.home_profiles).toEqual([]);
  });
  it("permits API resources using the same ID in independent namespaces", () => {
    const config = {
      ...emptyConfiguration(),
      groups: [{ id: "rule", name: "Group", revision: 0, relay_ids: ["a"] }],
      pair_policies: [pair()],
      home_profiles: [
        {
          id: "rule",
          name: "Home",
          revision: 0,
          priority: 0,
          enabled: false,
          selector: pair().source,
          constraints: emptyConstraints(),
        },
      ],
    };
    expect(configurationErrors(config)).toEqual([]);
  });
});
