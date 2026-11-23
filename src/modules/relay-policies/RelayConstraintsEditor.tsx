"use client";

import Button from "@components/Button";
import { Checkbox } from "@components/Checkbox";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  RelayCatalogItem,
  RelayConstraints,
  RelayGroup,
  RelaySelection,
} from "@/interfaces/RelayPolicy";
import { emptySelection, moveTier } from "./helpers";
import { RelayMultiSelect } from "./RelayMultiSelect";
import { fieldsetClass, Note } from "./ui";

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
    <fieldset className={fieldsetClass}>
      <legend className="px-2 text-sm font-medium text-nb-gray-200">{label}</legend>
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
    <div className="flex flex-col gap-5">
      <label className="flex gap-2 items-center text-sm text-nb-gray-200">
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
          <Note variant="error" role="alert">
            Explicitly empty allow is invalid. Select relays or allow all
            approved relays.
          </Note>
        )}
      <RelaySelectionEditor
        label="Exclude"
        value={value.exclude}
        catalog={catalog}
        groups={groups}
        onChange={(exclude) => onChange({ ...value, exclude })}
      />
      {scope === "pair" ? (
        <label className="flex gap-2 items-center text-sm text-nb-gray-200">
          <Checkbox
            checked={value.force_relay}
            onCheckedChange={(checked) =>
              onChange({ ...value, force_relay: checked === true })
            }
          />
          Force native relay (disable direct ICE and TURN paths)
        </label>
      ) : (
        <Note variant="info">
          Home profiles only choose home registration. They do not disable
          direct paths or restrict foreign pair connections. Only pair rules
          force native relay.
        </Note>
      )}
      <p className="text-xs text-nb-gray-400">
        Every matching rule constrains the permitted set. Exclusions in an
        inherited rule cannot be undone by another rule.
      </p>
      <div className="flex flex-col gap-1">
        <h4 className="text-base font-medium text-white">Ordered relay preference tiers</h4>
        <p className="text-sm text-nb-gray-300 max-w-3xl">
          Relays in one tier have equal priority. Tiers are tried in order.
          Allowing only A pins the path; allowing A and B with A first permits
          fallback to B. Switching can briefly interrupt traffic. Retrying
          preferred A is a separate action and does not change priorities.
        </p>
      </div>
      {value.preferences.map((tier, index) => (
        <div
          key={index}
          className="flex flex-col gap-3"
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
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="xs"
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
              <ArrowUp size={12} />
              Move up
            </Button>
            <Button
              variant="secondary"
              size="xs"
              aria-label={`Move tier ${index + 1} down`}
              disabled={index === value.preferences.length - 1}
              onClick={() =>
                onChange({
                  ...value,
                  preferences: moveTier(value.preferences, index, 1),
                })
              }
            >
              <ArrowDown size={12} />
              Move down
            </Button>
            <Button
              variant="danger-outline"
              size="xs"
              aria-label={`Remove tier ${index + 1}`}
              onClick={() =>
                onChange({
                  ...value,
                  preferences: value.preferences.filter((_, i) => i !== index),
                })
              }
            >
              <Trash2 size={12} />
              Remove tier
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="secondary"
        className="self-start"
        disabled={value.preferences.length >= 64}
        onClick={() =>
          onChange({
            ...value,
            preferences: [...value.preferences, emptySelection()],
          })
        }
      >
        <Plus size={14} />
        Add preference tier
      </Button>
    </div>
  );
}
