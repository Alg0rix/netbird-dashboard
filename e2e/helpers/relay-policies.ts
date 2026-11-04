import type { APIResponse, Page } from "@playwright/test";
import type {
  RelayCatalogResponse as RelayCatalog,
  RelayConstraints,
  RelayEffectivePolicy,
  RelayGroup,
  RelayHomeProfile,
  RelayPairPolicy,
  RelayPolicyConfiguration as RelayConfiguration,
} from "../../src/interfaces/RelayPolicy";
import { getApiContext } from "./api";

/** Real authenticated mutations; no peer registration or host network changes. */
export async function relayTestApi(page: Page) {
  const { token, origin } = await getApiContext(page);
  const request = (method: string, path: string, data?: unknown) =>
    page.request.fetch(`${origin}/api${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      data,
    });
  async function json<T>(response: APIResponse): Promise<T> {
    if (!response.ok()) {
      throw new Error(
        `${response.url()} returned ${response.status()}: ${await response.text()}`,
      );
    }
    return response.json() as Promise<T>;
  }
  const configuration = async () =>
    json<RelayConfiguration>(
      await request("GET", "/relay-policies/configuration"),
    );
  return {
    request,
    async supported() {
      const response = await request("GET", "/relay-policies/configuration");
      if (response.status() === 404) return false;
      return (await json<RelayConfiguration>(response)).supported;
    },
    configuration,
    async catalog() {
      return json<RelayCatalog>(await request("GET", "/relay-catalog"));
    },
    async peers() {
      return json<
        { id: string; name: string; ip: string; connected: boolean }[]
      >(await request("GET", "/peers"));
    },
    async effective(peerA: string, peerB: string) {
      return json<{ policy?: RelayEffectivePolicy }>(
        await request(
          "GET",
          `/relay-policies/effective?${new URLSearchParams({
            peer_a: peerA,
            peer_b: peerB,
          })}`,
        ),
      );
    },
    async save(config: RelayConfiguration) {
      return json<RelayConfiguration>(
        await request("PUT", "/relay-policies/configuration", config),
      );
    },
    async create(
      kind: "relay-groups" | "relay-home-profiles" | "relay-pair-policies",
      resource: RelayGroup | RelayHomeProfile | RelayPairPolicy,
    ) {
      const config = await configuration();
      return json<RelayConfiguration>(
        await request("POST", `/${kind}`, {
          expected_revision: config.revision,
          catalog_generation: config.catalog_generation,
          resource,
        }),
      );
    },
    async cleanup(prefix: string) {
      // Refresh the CAS fence on contention, retaining every other test's rows.
      for (let attempt = 0; attempt < 5; attempt++) {
        const config = await configuration();
        const next = {
          ...config,
          groups: config.groups.filter((r) => !r.name.startsWith(prefix)),
          home_profiles: config.home_profiles.filter(
            (r) => !r.name.startsWith(prefix),
          ),
          pair_policies: config.pair_policies.filter(
            (r) => !r.name.startsWith(prefix),
          ),
        };
        if (
          next.groups.length === config.groups.length &&
          next.home_profiles.length === config.home_profiles.length &&
          next.pair_policies.length === config.pair_policies.length
        )
          return;
        const response = await request(
          "PUT",
          "/relay-policies/configuration",
          next,
        );
        if (response.status() === 409) continue;
        await json<RelayConfiguration>(response);
        return;
      }
      throw new Error(
        `Could not clean relay sandbox ${prefix}: CAS contention`,
      );
    },
  };
}

export function relayConstraints(
  relayIds: string[],
  excluded: string[] = [],
): RelayConstraints {
  return {
    allow: { relay_ids: relayIds, group_ids: [] },
    exclude: { relay_ids: excluded, group_ids: [] },
    preferences: relayIds
      .filter((id) => !excluded.includes(id))
      .map((id) => ({ relay_ids: [id], group_ids: [] })),
    force_relay: false,
  };
}

export function pairResource(
  name: string,
  peerA: string,
  peerB: string,
  relayIds: string[],
): RelayPairPolicy {
  return {
    id: "",
    name,
    revision: 0,
    priority: 100,
    enabled: true,
    source: { peer_ids: [peerA], group_ids: [] },
    destination: { peer_ids: [peerB], group_ids: [] },
    constraints: relayConstraints(relayIds),
  };
}
