export interface RelayCatalogItem {
  id: string;
  endpoint: string;
  instance_endpoint: string;
  aliases: string[];
  active: boolean;
  legacy: boolean;
}
export interface RelayCatalogResponse {
  generation: number;
  entries: RelayCatalogItem[];
}
export interface RelayPeerSelector {
  peer_ids: string[];
  group_ids: string[];
}
export interface RelaySelection {
  relay_ids: string[];
  group_ids: string[];
}
export interface RelayConstraints {
  allow?: RelaySelection;
  exclude: RelaySelection;
  preferences: RelaySelection[];
  force_relay: boolean;
}
export interface RelayGroup {
  id: string;
  name: string;
  revision: number;
  relay_ids: string[];
}
export interface RelayHomeProfile {
  id: string;
  name: string;
  revision: number;
  priority: number;
  enabled: boolean;
  selector: RelayPeerSelector;
  constraints: RelayConstraints;
}
export interface RelayPairPolicy {
  id: string;
  name: string;
  revision: number;
  priority: number;
  enabled: boolean;
  source: RelayPeerSelector;
  destination: RelayPeerSelector;
  constraints: RelayConstraints;
}
export interface RelayPolicyConfiguration {
  supported: boolean;
  revision: number;
  catalog_generation: number;
  groups: RelayGroup[];
  home_profiles: RelayHomeProfile[];
  pair_policies: RelayPairPolicy[];
}
export interface RelayPolicyContribution {
  id: string;
  revision: number;
  eliminated: string[];
}
export interface RelayEffectivePolicy {
  state: "ready" | "blocked";
  revision: number;
  catalog_generation: number;
  reselection_generation: number;
  digest: string;
  force_relay: boolean;
  tiers: RelayCatalogItem[][];
  contributors: RelayPolicyContribution[];
  preference_rule: string;
  eliminated: string[];
}
export interface RelayEffectiveResponse {
  policy?: RelayEffectivePolicy;
}
export interface RelayPolicyPreview {
  revision: number;
  catalog_generation: number;
  truncated: boolean;
  home: {
    peer_id: string;
    policy?: RelayEffectivePolicy;
    unsupported: boolean;
  }[];
  pairs: {
    peer_a: string;
    peer_b: string;
    policy?: RelayEffectivePolicy;
    unsupported: boolean;
  }[];
}
export interface RelayPathObservation {
  local_peer_id: string;
  remote_peer_id: string;
  revision: number;
  digest: string;
  catalog_generation: number;
  reselection_generation: number;
  sequence: number;
  attempt: number;
  transport: "unknown" | "direct" | "native_relay";
  relay_id: string;
  state: "pending" | "applied" | "blocked" | "unsupported";
  reason: string;
  observed_at: string;
  expires_at: string;
  current: boolean;
}
export interface RelayPolicyStatus {
  peer_a: string;
  peer_b: string;
  policy?: RelayEffectivePolicy;
  application:
    | "unknown"
    | "pending"
    | "applied"
    | "unsupported"
    | "stale"
    | "disagreement"
    | "unconfigured";
  healthy: boolean;
  transport: "unknown" | "direct" | "native_relay";
  relay_id: string;
  endpoints: RelayPathObservation[];
}
export interface RelayRetryResponse {
  generation: number;
  policy?: RelayEffectivePolicy;
}
