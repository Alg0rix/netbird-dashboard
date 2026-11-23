import { describe, expect, it } from "vitest";
import {
  RelayCatalogItem,
  RelayPolicyConfiguration,
} from "@/interfaces/RelayPolicy";
import { buildConfiguration, readAssignments } from "./rules";

const relay = (id: string): RelayCatalogItem => ({
  id,
  endpoint: `rel://${id}:33080`,
  instance_endpoint: `rel://${id}:33080`,
  aliases: [],
  active: true,
  legacy: false,
});
const relays = [relay("r1"), relay("r2")];
const empty: RelayPolicyConfiguration = {
  supported: true,
  revision: 1,
  catalog_generation: 1,
  groups: [],
  home_profiles: [],
  pair_policies: [],
};
const peers = ["a", "b", "c"];
const first = (cfg: RelayPolicyConfiguration, id: string) =>
  cfg.pair_policies.find((p) => p.id === id)?.constraints.preferences[0]
    .relay_ids[0];

describe("relay assignments to rules", () => {
  it("moves only the chosen device's pairs and keeps other pairs untouched", () => {
    const cfg = buildConfiguration(
      empty,
      { c: "r2" },
      peers,
      relays,
      false,
      ["c"],
    );
    expect(first(cfg, "easy-pair-a-c")).toBe("r2");
    expect(first(cfg, "easy-pair-b-c")).toBe("r2");
    expect(cfg.pair_policies.find((p) => p.id === "easy-pair-a-b")).toBeUndefined();
    expect(readAssignments(cfg)).toEqual({ c: "r2" });
  });

  it("the device moved last wins a conflict, and unrelated moves do not flip it", () => {
    const all = { a: "r1", b: "r1", c: "r1" };
    const moved = buildConfiguration(empty, { ...all, c: "r2" }, peers, relays, false, ["c"]);
    expect(first(moved, "easy-pair-a-c")).toBe("r2");
    const unrelated = buildConfiguration(
      moved,
      { ...all, c: "r2", b: "r1" },
      peers,
      relays,
      false,
      ["b"],
    );
    expect(first(unrelated, "easy-pair-a-c")).toBe("r2");
  });

  it("leaves rules it does not own alone and never builds a legacy-relay preference", () => {
    const own = { ...empty, home_profiles: [{ ...buildConfiguration(empty, { a: "r1" }, peers, relays, false).home_profiles[0], id: "custom" }] };
    const cfg = buildConfiguration(own, { a: "r2" }, peers, [...relays, { ...relay("old"), legacy: true }], false, ["a"]);
    expect(cfg.home_profiles.map((p) => p.id)).toEqual(["custom", "easy-home-a"]);
    expect(cfg.home_profiles[1].constraints.allow?.relay_ids).toEqual(["r1", "r2"]);
  });
});
