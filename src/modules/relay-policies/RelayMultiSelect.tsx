"use client";

import { Input } from "@components/Input";
import {
  CheckboxListPicker,
  CheckboxOption,
} from "@components/table/filters/CheckboxListPicker";
import { useState } from "react";

export function RelayMultiSelect({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: CheckboxOption<string>[];
  onChange: (values: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const known = new Set(options.map((option) => option.value));
  const complete = [
    ...options,
    ...values
      .filter((id) => !known.has(id))
      .map((id) => ({ value: id, label: `${id} (unavailable)` })),
  ];
  const filtered = complete.filter((option) =>
    `${option.label} ${option.value}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <fieldset
      className="space-y-2 min-w-0"
      data-testid={`relay-select-${label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`}
    >
      <legend className="text-sm font-medium">
        {label} ({values.length} selected)
      </legend>
      <Input
        aria-label={`Search ${label}`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by name or ID"
      />
      <div className="max-h-44 overflow-auto">
        <CheckboxListPicker
          options={filtered}
          value={values}
          onChange={(next) => onChange(next ?? [])}
          close={() => undefined}
        />
        {filtered.length === 0 && (
          <p className="text-sm">No matching options.</p>
        )}
      </div>
    </fieldset>
  );
}
