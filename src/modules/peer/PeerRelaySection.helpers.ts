import type { Peer } from "@/interfaces/Peer";
import type {
  RelayPairPolicy,
  RelayPeerSelector,
  RelayPolicyStatus,
} from "@/interfaces/RelayPolicy";

export function relaySelectorMatches(
  selector: RelayPeerSelector,
  peer: Peer,
): boolean {
  return (
    !!peer.id &&
    (selector.peer_ids.includes(peer.id) ||
      !!peer.groups?.some(
        (group) => !!group.id && selector.group_ids.includes(group.id),
      ))
  );
}

export function relayPairPoliciesForPeer(
  policies: RelayPairPolicy[],
  peer: Peer,
): RelayPairPolicy[] {
  return policies.filter(
    (policy) =>
      relaySelectorMatches(policy.source, peer) ||
      relaySelectorMatches(policy.destination, peer),
  );
}

export function relayStatusMatchesScope(
  status: RelayPolicyStatus,
  local: string,
  remote: string,
): boolean {
  if (!remote) return status.peer_a === local && !status.peer_b;
  return (
    [status.peer_a, status.peer_b].sort().join("\0") ===
    [local, remote].sort().join("\0")
  );
}

export function relayStatusExplanation(status: RelayPolicyStatus): string {
  if (status.policy?.state === "blocked")
    return status.policy.force_relay
      ? "No permitted relay: native relay transport is blocked. Review contributing rules and catalog availability; an explicit pair override cannot restore an inherited exclusion."
      : "No permitted relay: direct transport remains allowed. Review contributing rules and catalog availability; an explicit pair override cannot restore an inherited exclusion.";
  switch (status.application) {
    case "pending":
      return "Pending: waiting for current endpoint observations. Missing reports never confirm application.";
    case "unsupported":
      return "Unsupported: an endpoint needs a compatible NetBird version.";
    case "stale":
      return "Stale: reports have expired, belong to an older session, or describe an older policy.";
    case "disagreement":
      return "Disagreement: endpoints do not report the same transport, relay and native attempt.";
    case "unconfigured":
      return "Unconfigured: this scope uses the existing relay behavior.";
    case "applied":
      return status.healthy
        ? "Applied: current endpoints agree on an active transport. This does not confirm ACL or resource reachability."
        : "Applied, transport unconfirmed: configuration is current, but active transport is not confirmed.";
    default:
      return "Unknown: a working path has not been confirmed.";
  }
}
