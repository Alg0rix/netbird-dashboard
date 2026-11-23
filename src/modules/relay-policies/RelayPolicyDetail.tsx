import InlineLink from "@components/InlineLink";
import {
  RelayEffectivePolicy,
  RelayPolicyConfiguration,
} from "@/interfaces/RelayPolicy";

export function RelayPolicyDetail({
  policy,
  scope = "pair",
}: {
  policy?: RelayEffectivePolicy;
  scope?: "home" | "pair";
  configuration?: RelayPolicyConfiguration;
}) {
  if (!policy)
    return (
      <p className="text-sm text-nb-gray-400">
        Legacy behavior: no managed {scope} policy.
      </p>
    );
  return (
    <div className="flex flex-col gap-2 text-sm text-nb-gray-300" data-testid="relay-policy-detail">
      <p>
        Desired revision {policy.revision} · {policy.state} ·{" "}
        {scope === "home"
          ? "Home registration only; pair paths are separate"
          : policy.force_relay
          ? "Forced native relay"
          : "Direct paths allowed"}
      </p>
      <p>
        Catalog generation {policy.catalog_generation} · Reselection generation{" "}
        {policy.reselection_generation}
      </p>
      <p>
        Permitted tiers:{" "}
        {policy.tiers
          .map((tier) => tier.map((relay) => relay.id).join(" + "))
          .join(" → ") || "None (blocked)"}
      </p>
      <p>Eliminated relays: {policy.eliminated.join(", ") || "None"}</p>
      <p>Preference owner: {policy.preference_rule || "Default"}</p>
      <ul className="flex flex-col gap-1">
        {policy.contributors.map((rule) => {
          const home = scope === "home";
          return (
            <li key={rule.id}>
              <InlineLink
                href={`/relays?${
                  home ? "profile" : "policy"
                }=${encodeURIComponent(rule.id)}`}
              >
                Edit owning {home ? "home profile" : "pair rule"}: {rule.id}
              </InlineLink>{" "}
              (revision {rule.revision}); excludes{" "}
              {rule.eliminated.join(", ") || "none"}. Editing this rule previews
              all its affected peers and pairs.
            </li>
          );
        })}
      </ul>
    </div>
  );
}
