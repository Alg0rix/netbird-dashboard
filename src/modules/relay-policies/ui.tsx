import Badge from "@components/Badge";
import { Callout } from "@components/Callout";
import { cn } from "@utils/helpers";
import { ChevronRight } from "lucide-react";
import * as React from "react";

// Shared look for the advanced relay screens: same cards, badges and callouts as the Relays page.

export function Section({
  title,
  description,
  label,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4" aria-label={label ?? title}>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-white">{title}</h2>
        {description && (
          <p className="text-sm text-nb-gray-300 max-w-3xl">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function Note({
  variant = "default",
  role,
  children,
  ...rest
}: {
  variant?: "default" | "info" | "warning" | "error" | "success";
  role?: string;
  children: React.ReactNode;
  "data-testid"?: string;
}) {
  return (
    <div role={role} data-testid={rest["data-testid"]} className="max-w-3xl">
      <Callout variant={variant}>
        <div className="flex flex-col gap-2 w-full">{children}</div>
      </Callout>
    </div>
  );
}

export function RuleCard({
  title,
  enabled,
  id,
  open,
  testId,
  children,
}: {
  title: string;
  enabled?: boolean;
  id?: string;
  open?: boolean;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <details
      data-testid={testId}
      open={open}
      className="group rounded-md border border-nb-gray-900 bg-nb-gray-940"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={16}
          className="text-nb-gray-400 transition-transform group-open:rotate-90"
        />
        <span className="text-white font-medium">{title}</span>
        {enabled !== undefined && (
          <Badge variant={enabled ? "green" : "gray"} size="xs">
            {enabled ? "Enabled" : "Disabled"}
          </Badge>
        )}
        {id && <span className="ml-auto font-mono text-xs text-nb-gray-500 truncate max-w-[40%]">{id}</span>}
      </summary>
      <div className="flex flex-col gap-5 border-t border-nb-gray-900 px-5 py-5">
        {children}
      </div>
    </details>
  );
}

export const fieldsetClass = cn(
  "grid md:grid-cols-2 gap-4 rounded-md border border-nb-gray-900 bg-nb-gray-930/50 p-4",
);
