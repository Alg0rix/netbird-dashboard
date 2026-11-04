"use client";

import Button from "@components/Button";
import { Checkbox } from "@components/Checkbox";
import { Input } from "@components/Input";
import Paragraph from "@components/Paragraph";
import { RestrictedAccess } from "@components/ui/RestrictedAccess";
import useFetchApi from "@utils/api";
import { useSearchParams } from "next/navigation";
import { usePermissions } from "@/contexts/PermissionsProvider";
import { Group } from "@/interfaces/Group";
import { Peer } from "@/interfaces/Peer";
import {
  RelayCatalogResponse,
  RelayHomeProfile,
  RelayPairPolicy,
  RelayPeerSelector,
  RelayPolicyConfiguration,
} from "@/interfaces/RelayPolicy";
import {
  configurationForQuery,
  emptyConstraints,
  emptyPeerSelector,
  explicitRulesForQuery,
} from "./helpers";
import { RelayConstraintsEditor } from "./RelayConstraintsEditor";
import { RelayMultiSelect } from "./RelayMultiSelect";
import { RelayPolicyDetail } from "./RelayPolicyDetail";
import { useRelayPolicyConfiguration } from "./useRelayPolicyConfiguration";
import { useRelayPolicyDraft } from "./useRelayPolicyDraft";

export default function RelayPolicyEditor() {
  const { permission } = usePermissions();
  const configuration = useRelayPolicyConfiguration(permission.relays.read);
  if (!permission.relays.read)
    return <RestrictedAccess hasAccess={false} page="Relays" />;
  if (configuration.isLoading)
    return <p role="status">Loading relay policies…</p>;
  if (
    configuration.error?.code === 404 ||
    configuration.data?.supported === false
  )
    return (
      <p>
        Relay policy administration is unavailable on this Management version.
      </p>
    );
  if (configuration.error && !configuration.data)
    return (
      <div role="alert">
        <p>Unable to load relay policies.</p>
        <Button onClick={() => configuration.mutate()}>Retry loading</Button>
      </div>
    );
  if (!configuration.data || !configuration.supported) return null;
  return (
    <div>
      {configuration.error && (
        <p role="alert">
          Unable to refresh the server configuration. Your open draft is
          retained.
        </p>
      )}
      <RelayConfigurationEditor
        configuration={configuration.data}
        onSaved={(data) => {
          void configuration.mutate(data, false);
        }}
      />
    </div>
  );
}

export function RelayConfigurationEditor({
  configuration,
  onSaved,
}: {
  configuration: RelayPolicyConfiguration;
  onSaved: (value: RelayPolicyConfiguration) => void;
}) {
  const { permission } = usePermissions();
  const search = useSearchParams();
  const form = useRelayPolicyDraft(
    () =>
      permission.relays.update
        ? configurationForQuery(configuration, search)
        : configuration,
    onSaved,
    permission.relays.update,
  );
  const catalog = useFetchApi<RelayCatalogResponse>(
    "/relay-catalog",
    true,
    true,
    permission.relays.read,
  );
  const peers = useFetchApi<Peer[]>("/peers", true);
  const groups = useFetchApi<Group[]>("/groups", true);
  const draft = form.draft;
  const canEdit = permission.relays.update;
  const selectOptions = {
    peers: (peers.data ?? []).flatMap((peer) =>
      peer.id ? [{ value: peer.id, label: `${peer.name} (${peer.ip})` }] : [],
    ),
    groups: (groups.data ?? []).flatMap((group) =>
      group.id ? [{ value: group.id, label: group.name }] : [],
    ),
  };
  const selectedPeer = search.get("peer");
  const existingRules = explicitRulesForQuery(configuration, search);
  const catalogItems = catalog.data?.entries ?? [];
  const updateHome = (index: number, resource: RelayHomeProfile) =>
    form.update({
      ...draft,
      home_profiles: draft.home_profiles.map((value, i) =>
        i === index ? resource : value,
      ),
    });
  const updatePair = (index: number, resource: RelayPairPolicy) =>
    form.update({
      ...draft,
      pair_policies: draft.pair_policies.map((value, i) =>
        i === index ? resource : value,
      ),
    });
  const addPair = () =>
    form.update({
      ...draft,
      pair_policies: [
        ...draft.pair_policies,
        {
          id: crypto.randomUUID(),
          name: "New pair rule",
          revision: 0,
          priority: 100,
          enabled: false,
          source: {
            ...emptyPeerSelector(),
            peer_ids: selectedPeer ? [selectedPeer] : [],
          },
          destination: {
            ...emptyPeerSelector(),
            peer_ids: search.get("remote") ? [search.get("remote")!] : [],
          },
          constraints: emptyConstraints(),
        },
      ],
    });
  return (
    <div className="space-y-6 p-default pb-8" data-testid="relay-policy-editor">
      <Paragraph>
        Home profiles choose where a peer registers. They do not constrain
        foreign pair connections. Symmetric pair rules restrict paths between
        either side without granting ACL access.
      </Paragraph>
      <p>
        Configuration revision {draft.revision} · Catalog generation{" "}
        {draft.catalog_generation}. New rules start disabled; enabling
        restrictions requires compatible endpoints and a valid preview.
      </p>
      {!canEdit && (
        <p role="status">
          Read-only access. Your role cannot change relay configuration.
        </p>
      )}
      {existingRules.home.length + existingRules.pair.length > 1 && (
        <p role="status">
          Multiple explicit rules match this target. Review the expanded owning
          rules below; no additional rule was created.
        </p>
      )}
      {selectedPeer && (
        <p data-testid="relay-selected-peer">
          Draft target peer {selectedPeer}. Review the target scope before
          previewing.
        </p>
      )}
      <section className="space-y-3" aria-label="Approved relay catalog">
        <h2>Approved relay catalog</h2>
        <p>
          Published by the operator. Only approved active non-legacy relays can
          be selected.
        </p>
        {catalog.isLoading && <p role="status">Loading catalog…</p>}
        {catalog.error && (
          <p role="alert">
            Catalog unavailable. Reload it before editing relay choices.
          </p>
        )}
        <ul>
          {catalogItems.map((item) => (
            <li key={item.id}>
              <strong>{item.id}</strong> · {item.endpoint} ·{" "}
              {item.active ? "Active" : "Inactive"}
              {item.legacy ? " · Legacy (cannot select)" : ""}
              <p className="text-sm">
                Instance endpoint: {item.instance_endpoint || "Not published"};
                aliases: {item.aliases.join(", ") || "None"}
              </p>
            </li>
          ))}
        </ul>
        {!catalog.isLoading && !catalog.error && !catalogItems.length && (
          <p>No approved relays have been published.</p>
        )}
      </section>
      {(peers.error || groups.error) && (
        <p role="alert">
          Some peer selectors could not load. Existing IDs are preserved. Reload
          before choosing new targets.
        </p>
      )}
      <fieldset
        inert={form.busy}
        disabled={form.busy || !canEdit}
        className="space-y-6"
      >
        <section className="space-y-4" aria-label="Relay groups">
          <h2>Relay groups</h2>
          {!draft.groups.length && (
            <p>No relay groups. Create one to reuse a relay set.</p>
          )}
          {draft.groups.map((group, index) => (
            <details
              data-testid="relay-group-row"
              key={group.id}
              open
              className="border rounded-md p-4 space-y-4"
            >
              <summary>
                {group.name} · {group.id}
              </summary>
              <label className="block">
                Group name
                <Input
                  data-testid="relay-resource-name"
                  aria-label="Group name"
                  value={group.name}
                  onChange={(event) =>
                    form.update({
                      ...draft,
                      groups: draft.groups.map((value, i) =>
                        i === index
                          ? { ...value, name: event.target.value }
                          : value,
                      ),
                    })
                  }
                />
              </label>
              <RelayMultiSelect
                label="Group relays"
                values={group.relay_ids}
                options={catalogItems
                  .filter((item) => item.active && !item.legacy)
                  .map((item) => ({ value: item.id, label: item.id }))}
                onChange={(relay_ids) =>
                  form.update({
                    ...draft,
                    groups: draft.groups.map((value, i) =>
                      i === index ? { ...value, relay_ids } : value,
                    ),
                  })
                }
              />
              <Button
                variant="danger-outline"
                disabled={!permission.relays.delete}
                onClick={() =>
                  form.update({
                    ...draft,
                    groups: draft.groups.filter((_, i) => i !== index),
                  })
                }
              >
                Delete group from draft
              </Button>
            </details>
          ))}
          <Button
            data-testid="relay-add-group"
            disabled={!permission.relays.create}
            onClick={() =>
              form.update({
                ...draft,
                groups: [
                  ...draft.groups,
                  {
                    id: crypto.randomUUID(),
                    name: "New relay group",
                    revision: 0,
                    relay_ids: [],
                  },
                ],
              })
            }
          >
            Add relay group
          </Button>
        </section>
        <section className="space-y-4" aria-label="Home profiles">
          <h2>Home profiles</h2>
          <p>
            Home readiness is separate from pair transport. Lower numeric rule
            priority wins preferences; all matching constraints still apply.
          </p>
          {!draft.home_profiles.length && (
            <p>No home profiles. Peers use legacy home selection.</p>
          )}
          {draft.home_profiles.map((profile, index) => (
            <details
              data-testid="relay-profile-row"
              key={profile.id}
              open={
                search.get("profile") === profile.id ||
                existingRules.home.includes(profile.id) ||
                profile.revision === 0
              }
              className="border rounded-md p-4 space-y-4"
            >
              <summary>
                {profile.name} · {profile.enabled ? "Enabled" : "Disabled"} ·{" "}
                {profile.id}
              </summary>
              <RuleFields
                value={profile}
                onChange={(next) => updateHome(index, { ...profile, ...next })}
              />
              <PeerTargets
                label="Home targets"
                value={profile.selector}
                options={selectOptions}
                onChange={(selector) =>
                  updateHome(index, { ...profile, selector })
                }
              />
              <RelayConstraintsEditor
                scope="home"
                value={profile.constraints}
                catalog={catalogItems}
                groups={draft.groups}
                onChange={(constraints) =>
                  updateHome(index, { ...profile, constraints })
                }
              />
              <Button
                variant="danger-outline"
                disabled={!permission.relays.delete}
                onClick={() =>
                  form.update({
                    ...draft,
                    home_profiles: draft.home_profiles.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              >
                Delete profile from draft
              </Button>
            </details>
          ))}
          <Button
            data-testid="relay-add-profile"
            disabled={!permission.relays.create}
            onClick={() =>
              form.update({
                ...draft,
                home_profiles: [
                  ...draft.home_profiles,
                  {
                    id: crypto.randomUUID(),
                    name: "New home profile",
                    revision: 0,
                    priority: 100,
                    enabled: false,
                    selector: emptyPeerSelector(),
                    constraints: emptyConstraints(),
                  },
                ],
              })
            }
          >
            Add home profile
          </Button>
        </section>
        <section className="space-y-4" aria-label="Symmetric pair rules">
          <h2>Symmetric pair rules</h2>
          <p>
            Source and destination are interchangeable. The lowest priority
            number (then rule ID) owns preferences; every matching rule
            constrains permitted relays.
          </p>
          {!draft.pair_policies.length && (
            <p>No pair rules. Authorized pairs use legacy paths.</p>
          )}
          {draft.pair_policies.map((policy, index) => (
            <details
              data-testid="relay-policy-row"
              key={policy.id}
              open={
                search.get("policy") === policy.id ||
                existingRules.pair.includes(policy.id) ||
                policy.revision === 0
              }
              className="border rounded-md p-4 space-y-4"
            >
              <summary>
                {policy.name} · {policy.enabled ? "Enabled" : "Disabled"} ·{" "}
                {policy.id}
              </summary>
              <RuleFields
                value={policy}
                onChange={(next) => updatePair(index, { ...policy, ...next })}
              />
              <PeerTargets
                label="Source"
                value={policy.source}
                options={selectOptions}
                onChange={(source) => updatePair(index, { ...policy, source })}
              />
              <PeerTargets
                label="Destination"
                value={policy.destination}
                options={selectOptions}
                onChange={(destination) =>
                  updatePair(index, { ...policy, destination })
                }
              />
              <RelayConstraintsEditor
                value={policy.constraints}
                catalog={catalogItems}
                groups={draft.groups}
                onChange={(constraints) =>
                  updatePair(index, { ...policy, constraints })
                }
              />
              <Button
                variant="danger-outline"
                disabled={!permission.relays.delete}
                onClick={() =>
                  form.update({
                    ...draft,
                    pair_policies: draft.pair_policies.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              >
                Delete pair rule from draft
              </Button>
            </details>
          ))}
          <Button
            data-testid="relay-add-policy"
            disabled={!permission.relays.create}
            onClick={addPair}
          >
            Add symmetric pair rule
          </Button>
        </section>
      </fieldset>
      {form.errors.length > 0 && (
        <ul role="alert">
          {form.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {form.message && (
        <p role="status" aria-live="polite">
          {form.message}
        </p>
      )}
      {form.conflict && (
        <div data-testid="relay-stale-draft" role="alert" className="space-y-3">
          <p>
            Your full draft may replace changes made by another administrator.
            Review the broader impact after refreshing the revision.
          </p>
          <Button
            data-testid="relay-reload"
            disabled={form.busy}
            onClick={form.reload}
          >
            Reload latest and discard draft
          </Button>
          <Button
            data-testid="relay-repreview"
            disabled={form.busy}
            onClick={form.repreview}
          >
            Keep full draft and repreview latest revision
          </Button>
        </div>
      )}
      {canEdit && (
        <Button
          data-testid="relay-preview"
          variant="primary"
          disabled={
            form.busy ||
            form.errors.length > 0 ||
            !catalog.data ||
            !!catalog.error ||
            form.conflict
          }
          onClick={form.requestPreview}
        >
          {form.busy ? "Working…" : "Preview all draft changes"}
        </Button>
      )}
      {form.preview && (
        <section
          aria-label="Confirm relay changes"
          className="border rounded-md p-4 space-y-4"
          data-testid="relay-impact-preview"
        >
          <h2>Review impact before saving</h2>
          <p>
            This replaces the complete configuration, including deletions.
            Revision {form.preview.revision}; {form.preview.home.length} home
            targets and {form.preview.pairs.length} authorized pairs.
          </p>
          {form.preview.truncated && (
            <p role="alert">
              Preview truncated. Narrow the scope to see every affected target
              before saving.
            </p>
          )}
          {form.preview.home.map((home) => (
            <details key={home.peer_id}>
              <summary>
                Home: {home.peer_id} · {home.policy?.state ?? "legacy"} ·{" "}
                {home.unsupported ? "Unsupported client" : "Compatible"}
              </summary>
              <RelayPolicyDetail
                policy={home.policy}
                scope="home"
                configuration={draft}
              />
            </details>
          ))}
          {form.preview.pairs.map((pair) => (
            <details key={`${pair.peer_a}/${pair.peer_b}`}>
              <summary>
                Pair: {pair.peer_a} ↔ {pair.peer_b} ·{" "}
                {pair.policy?.state ?? "legacy"} ·{" "}
                {pair.unsupported ? "Unsupported endpoint" : "Compatible"}
              </summary>
              <RelayPolicyDetail policy={pair.policy} configuration={draft} />
            </details>
          ))}
          <Button
            data-testid="relay-confirm-save"
            variant="primary"
            disabled={form.busy || !canEdit || form.preview.truncated}
            onClick={form.save}
          >
            Confirm and save configuration
          </Button>
        </section>
      )}
    </div>
  );
}

function RuleFields({
  value,
  onChange,
}: {
  value: { name: string; priority: number; enabled: boolean };
  onChange: (value: {
    name: string;
    priority: number;
    enabled: boolean;
  }) => void;
}) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <label>
        Rule name
        <Input
          data-testid="relay-resource-name"
          aria-label="Rule name"
          value={value.name}
          maxLength={255}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
      </label>
      <label>
        Rule priority
        <Input
          aria-label="Rule priority"
          type="number"
          min={0}
          max={4294967295}
          value={value.priority}
          onChange={(event) =>
            onChange({ ...value, priority: event.target.valueAsNumber })
          }
        />
      </label>
      <label className="flex items-center gap-2">
        <Checkbox
          checked={value.enabled}
          onCheckedChange={(checked) =>
            onChange({ ...value, enabled: checked === true })
          }
        />
        Enabled
      </label>
    </div>
  );
}

function PeerTargets({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: RelayPeerSelector;
  options: {
    peers: { value: string; label: string }[];
    groups: { value: string; label: string }[];
  };
  onChange: (value: RelayPeerSelector) => void;
}) {
  return (
    <fieldset className="grid md:grid-cols-2 gap-4 border rounded-md p-4">
      <legend>{label} (peers or peer groups)</legend>
      <RelayMultiSelect
        label={`${label} peers`}
        values={value.peer_ids}
        options={options.peers}
        onChange={(peer_ids) => onChange({ ...value, peer_ids })}
      />
      <RelayMultiSelect
        label={`${label} peer groups`}
        values={value.group_ids}
        options={options.groups}
        onChange={(group_ids) => onChange({ ...value, group_ids })}
      />
    </fieldset>
  );
}
