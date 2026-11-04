"use client";

import Button from "@components/Button";
import { Checkbox } from "@components/Checkbox";
import {
  RelayCatalogItem,
  RelayConstraints,
  RelayGroup,
  RelaySelection,
} from "@/interfaces/RelayPolicy";
import { emptySelection, moveTier } from "./helpers";
import { RelayMultiSelect } from "./RelayMultiSelect";

export function RelaySelectionEditor({
  label,
  value,
  catalog,
  groups,
  onChange,
}: {
  label: string;
  value: RelaySelection;
  catalog: RelayCatalogItem[];
  groups: RelayGroup[];
  onChange: (value: RelaySelection) => void;
}) {
  return (
    <fieldset className="grid md:grid-cols-2 gap-4 border rounded-md p-4">
      <legend>{label}</legend>
      <RelayMultiSelect
        label={`${label} relays`}
        values={value.relay_ids}
        options={catalog
          .filter((item) => item.active && !item.legacy)
          .map((item) => ({ value: item.id, label: item.id }))}
        onChange={(relay_ids) => onChange({ ...value, relay_ids })}
      />
      <RelayMultiSelect
        label={`${label} relay groups`}
        values={value.group_ids}
        options={groups.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(group_ids) => onChange({ ...value, group_ids })}
      />
    </fieldset>
  );
}

export function RelayConstraintsEditor({
  scope = "pair",
  value,
  catalog,
  groups,
  onChange,
}: {
  scope?: "home" | "pair";
  value: RelayConstraints;
  catalog: RelayCatalogItem[];
  groups: RelayGroup[];
  onChange: (value: RelayConstraints) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="flex gap-2 items-center">
        <Checkbox
          checked={value.allow === undefined}
          onCheckedChange={(checked) =>
            onChange({
              ...value,
              allow: checked ? undefined : emptySelection(),
            })
          }
        />
        Allow all approved active relays
      </label>
      {value.allow !== undefined && (
        <RelaySelectionEditor
          label="Allow"
          value={value.allow}
          catalog={catalog}
          groups={groups}
          onChange={(allow) => onChange({ ...value, allow })}
        />
      )}
      {value.allow !== undefined &&
        value.allow.relay_ids.length + value.allow.group_ids.length === 0 && (
          <p role="alert">
            Explicitly empty allow is invalid. Select relays or allow all
            approved relays.
          </p>
        )}
      <RelaySelectionEditor
        label="Exclude"
        value={value.exclude}
        catalog={catalog}
        groups={groups}
        onChange={(exclude) => onChange({ ...value, exclude })}
      />
      {scope === "pair" ? (
        <label className="flex gap-2 items-center">
          <Checkbox
            checked={value.force_relay}
            onCheckedChange={(checked) =>
              onChange({ ...value, force_relay: checked === true })
            }
          />
          Force native relay (disable direct ICE and TURN paths)
        </label>
      ) : (
        <p>
          Home profiles only choose home registration. They do not disable
          direct paths or restrict foreign pair connections. Only pair rules
          force native relay.
        </p>
      )}
      <p className="text-sm">
        Every matching rule constrains the permitted set. Exclusions in an
        inherited rule cannot be undone by another rule.
      </p>
      <h4>Ordered relay preference tiers</h4>
      <p className="text-sm">
        Relays in one tier have equal priority. Tiers are tried in order.
        Allowing only A pins the path; allowing A and B with A first permits
        fallback to B. Switching can briefly interrupt traffic. Retrying
        preferred A is a separate action and does not change priorities.
      </p>
      {value.preferences.map((tier, index) => (
        <div
          key={index}
          className="space-y-2"
          data-testid="relay-preference-tier"
        >
          <RelaySelectionEditor
            label={`Tier ${index + 1}`}
            value={tier}
            catalog={catalog}
            groups={groups}
            onChange={(next) =>
              onChange({
                ...value,
                preferences: value.preferences.map((item, i) =>
                  i === index ? next : item,
                ),
              })
            }
          />
          <div className="flex gap-2">
            <Button
              data-testid={`relay-tier-up-${index + 1}`}
              aria-label={`Move tier ${index + 1} up`}
              disabled={index === 0}
              onClick={() =>
                onChange({
                  ...value,
                  preferences: moveTier(value.preferences, index, -1),
                })
              }
            >
              Move up
            </Button>
            <Button
              aria-label={`Move tier ${index + 1} down`}
              disabled={index === value.preferences.length - 1}
              onClick={() =>
                onChange({
                  ...value,
                  preferences: moveTier(value.preferences, index, 1),
                })
              }
            >
              Move down
            </Button>
            <Button
              variant="danger-outline"
              aria-label={`Remove tier ${index + 1}`}
              onClick={() =>
                onChange({
                  ...value,
                  preferences: value.preferences.filter((_, i) => i !== index),
                })
              }
            >
              Remove tier
            </Button>
          </div>
        </div>
      ))}
      <Button
        disabled={value.preferences.length >= 64}
        onClick={() =>
          onChange({
            ...value,
            preferences: [...value.preferences, emptySelection()],
          })
        }
      >
        Add preference tier
      </Button>
    </div>
  );
}
