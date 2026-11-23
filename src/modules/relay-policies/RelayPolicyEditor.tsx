"use client";

import Badge from "@components/Badge";
import Button from "@components/Button";
import Card from "@components/Card";
import { Checkbox } from "@components/Checkbox";
import { Input } from "@components/Input";
import { Label } from "@components/Label";
import SquareIcon from "@components/SquareIcon";
import { RestrictedAccess } from "@components/ui/RestrictedAccess";
import useFetchApi from "@utils/api";
import { Plus, RadioTower } from "lucide-react";
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
import { fieldsetClass, Note, RuleCard, Section } from "./ui";

export default function RelayPolicyEditor() {
  const { permission } = usePermissions();
  const configuration = useRelayPolicyConfiguration(permission.relays.read);
  if (!permission.relays.read)
    return <RestrictedAccess hasAccess={false} page="Relays" />;
  if (configuration.isLoading)
    return (
      <p role="status" className="p-default text-nb-gray-400">
        Loading relay policies…
      </p>
    );
  if (
    configuration.error?.code === 404 ||
    configuration.data?.supported === false
  )
    return (
      <div className="p-default">
        <Note variant="warning">
          Relay policy administration is unavailable on this Management version.
        </Note>
      </div>
    );
  if (configuration.error && !configuration.data)
    return (
      <div role="alert" className="p-default flex flex-col gap-3 items-start">
        <Note variant="error">Unable to load relay policies.</Note>
        <Button variant="secondary" onClick={() => configuration.mutate()}>
          Retry loading
        </Button>
      </div>
    );
  if (!configuration.data || !configuration.supported) return null;
  return (
    <div>
      {configuration.error && (
        <div className="p-default pb-4">
          <Note variant="warning" role="alert">
            Unable to refresh the server configuration. Your open draft is
            retained.
          </Note>
        </div>
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
    <div className="flex flex-col gap-8 p-default pb-10 max-w-5xl" data-testid="relay-policy-editor">
      <Note>
        <span>
          Home profiles choose where a peer registers. They do not constrain
          foreign pair connections. Symmetric pair rules restrict paths between
          either side without granting ACL access.
        </span>
        <span>
          Configuration revision {draft.revision} · Catalog generation{" "}
          {draft.catalog_generation}. New rules start disabled; enabling
          restrictions requires compatible endpoints and a valid preview.
        </span>
      </Note>
      {!canEdit && (
        <Note variant="info" role="status">
          Read-only access. Your role cannot change relay configuration.
        </Note>
      )}
      {existingRules.home.length + existingRules.pair.length > 1 && (
        <Note variant="info" role="status">
          Multiple explicit rules match this target. Review the expanded owning
          rules below; no additional rule was created.
        </Note>
      )}
      {selectedPeer && (
        <div data-testid="relay-selected-peer">
          <Note variant="info">
            Draft target peer {selectedPeer}. Review the target scope before
            previewing.
          </Note>
        </div>
      )}
      <Section
        title="Approved relay catalog"
        label="Approved relay catalog"
        description="Published by the operator. Only approved active non-legacy relays can be selected."
      >
        {catalog.isLoading && <p role="status" className="text-nb-gray-400">Loading catalog…</p>}
        {catalog.error && (
          <Note variant="error" role="alert">
            Catalog unavailable. Reload it before editing relay choices.
          </Note>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {catalogItems.map((item) => (
            <Card key={item.id} className="w-full p-4 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <SquareIcon icon={<RadioTower size={16} />} color="netbird" size="small" />
                <div className="flex flex-col min-w-0">
                  <strong className="text-white">{item.id}</strong>
                  <span className="text-xs text-nb-gray-400 truncate">{item.endpoint}</span>
                </div>
                <Badge variant={item.active ? "green" : "gray"} size="xs" className="ml-auto">
                  {item.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              {item.legacy && (
                <Badge variant="yellow" size="xs">Legacy (cannot select)</Badge>
              )}
              <p className="text-xs text-nb-gray-400">
                Instance endpoint: {item.instance_endpoint || "Not published"};
                aliases: {item.aliases.join(", ") || "None"}
              </p>
            </Card>
          ))}
        </div>
        {!catalog.isLoading && !catalog.error && !catalogItems.length && (
          <p className="text-nb-gray-400">No approved relays have been published.</p>
        )}
      </Section>
      {(peers.error || groups.error) && (
        <Note variant="warning" role="alert">
          Some peer selectors could not load. Existing IDs are preserved. Reload
          before choosing new targets.
        </Note>
      )}
      <fieldset
        inert={form.busy}
        disabled={form.busy || !canEdit}
        className="flex flex-col gap-8 border-0 p-0 m-0 min-w-0"
      >
        <Section title="Relay groups">
          {!draft.groups.length && (
            <p className="text-nb-gray-400">No relay groups. Create one to reuse a relay set.</p>
          )}
          {draft.groups.map((group, index) => (
            <RuleCard
              testId="relay-group-row"
              key={group.id}
              open
              title={group.name}
              id={group.id}
            >
              <div>
                <Label as="div">Group name</Label>
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
              </div>
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
            </RuleCard>
          ))}
          <Button
            variant="secondary"
            className="self-start"
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
            <Plus size={14} />
            Add relay group
          </Button>
        </Section>
        <Section
          title="Home profiles"
          description="Home readiness is separate from pair transport. Lower numeric rule priority wins preferences; all matching constraints still apply."
        >
          {!draft.home_profiles.length && (
            <p className="text-nb-gray-400">No home profiles. Peers use legacy home selection.</p>
          )}
          {draft.home_profiles.map((profile, index) => (
            <RuleCard
              testId="relay-profile-row"
              key={profile.id}
              open={
                search.get("profile") === profile.id ||
                existingRules.home.includes(profile.id) ||
                profile.revision === 0
              }
              title={profile.name}
              enabled={profile.enabled}
              id={profile.id}
            >
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
            </RuleCard>
          ))}
          <Button
            variant="secondary"
            className="self-start"
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
            <Plus size={14} />
            Add home profile
          </Button>
        </Section>
        <Section
          title="Symmetric pair rules"
          description="Source and destination are interchangeable. The lowest priority number (then rule ID) owns preferences; every matching rule constrains permitted relays."
        >
          {!draft.pair_policies.length && (
            <p className="text-nb-gray-400">No pair rules. Authorized pairs use legacy paths.</p>
          )}
          {draft.pair_policies.map((policy, index) => (
            <RuleCard
              testId="relay-policy-row"
              key={policy.id}
              open={
                search.get("policy") === policy.id ||
                existingRules.pair.includes(policy.id) ||
                policy.revision === 0
              }
              title={policy.name}
              enabled={policy.enabled}
              id={policy.id}
            >
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
            </RuleCard>
          ))}
          <Button
            variant="secondary"
            className="self-start"
            data-testid="relay-add-policy"
            disabled={!permission.relays.create}
            onClick={addPair}
          >
            <Plus size={14} />
            Add symmetric pair rule
          </Button>
        </Section>
      </fieldset>
      {form.errors.length > 0 && (
        <Note variant="error" role="alert">
          <ul className="list-disc pl-4">
            {form.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Note>
      )}
      {form.message && (
        <Note variant="success" role="status">
          {form.message}
        </Note>
      )}
      {form.conflict && (
        <div data-testid="relay-stale-draft" role="alert" className="flex flex-col gap-3 items-start">
          <Note variant="warning">
            Your full draft may replace changes made by another administrator.
            Review the broader impact after refreshing the revision.
          </Note>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              data-testid="relay-reload"
              disabled={form.busy}
              onClick={form.reload}
            >
              Reload latest and discard draft
            </Button>
            <Button
              variant="secondary"
              data-testid="relay-repreview"
              disabled={form.busy}
              onClick={form.repreview}
            >
              Keep full draft and repreview latest revision
            </Button>
          </div>
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
          className="self-start"
        >
          {form.busy ? "Working…" : "Preview all draft changes"}
        </Button>
      )}
      {form.preview && (
        <section
          aria-label="Confirm relay changes"
          className="rounded-md border border-netbird-400/30 bg-nb-gray-940 p-5 flex flex-col gap-4"
          data-testid="relay-impact-preview"
        >
          <h2 className="text-lg font-medium text-white">Review impact before saving</h2>
          <p className="text-sm text-nb-gray-300">
            This replaces the complete configuration, including deletions.
            Revision {form.preview.revision}; {form.preview.home.length} home
            targets and {form.preview.pairs.length} authorized pairs.
          </p>
          {form.preview.truncated && (
            <Note variant="warning" role="alert">
              Preview truncated. Narrow the scope to see every affected target
              before saving.
            </Note>
          )}
          {form.preview.home.map((home) => (
            <RuleCard
              key={home.peer_id}
              title={`Home: ${home.peer_id} · ${home.policy?.state ?? "legacy"} · ${
                home.unsupported ? "Unsupported client" : "Compatible"
              }`}
            >
              <RelayPolicyDetail
                policy={home.policy}
                scope="home"
                configuration={draft}
              />
            </RuleCard>
          ))}
          {form.preview.pairs.map((pair) => (
            <RuleCard
              key={`${pair.peer_a}/${pair.peer_b}`}
              title={`Pair: ${pair.peer_a} ↔ ${pair.peer_b} · ${pair.policy?.state ?? "legacy"} · ${
                pair.unsupported ? "Unsupported endpoint" : "Compatible"
              }`}
            >
              <RelayPolicyDetail policy={pair.policy} configuration={draft} />
            </RuleCard>
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
    <div className="grid md:grid-cols-3 gap-4 items-end">
      <div>
        <Label as="div">Rule name</Label>
        <Input
          data-testid="relay-resource-name"
          aria-label="Rule name"
          value={value.name}
          maxLength={255}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
      </div>
      <div>
        <Label as="div">Rule priority</Label>
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
      </div>
      <label className="flex items-center gap-2 text-sm text-nb-gray-200 pb-2.5">
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
    <fieldset className={fieldsetClass}>
      <legend className="px-2 text-sm font-medium text-nb-gray-200">
        {label} (peers or peer groups)
      </legend>
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
