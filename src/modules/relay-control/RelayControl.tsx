"use client";

import Badge from "@components/Badge";
import Button from "@components/Button";
import { Callout } from "@components/Callout";
import Card from "@components/Card";
import { Checkbox } from "@components/Checkbox";
import FancyToggleSwitch from "@components/FancyToggleSwitch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/Select";
import SquareIcon from "@components/SquareIcon";
import { DataTable } from "@components/table/DataTable";
import DataTableHeader from "@components/table/DataTableHeader";
import { DataTableMultiSelectPopup } from "@components/table/DataTableMultiSelectPopup";
import ActiveInactiveRow from "@/modules/common-table-rows/ActiveInactiveRow";
import { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { AlertTriangle, RadioTower } from "lucide-react";
import * as React from "react";
import { Peer } from "@/interfaces/Peer";
import { relayLabel } from "./rules";
import { AUTO, useRelayAssignments } from "./useRelayAssignments";

const tone = (ms: number | null | undefined, loss = 0) =>
  ms == null || ms > 200 || loss >= 20 ? "red" : ms > 80 ? "yellow" : "green";

export default function RelayControl() {
  const {
    permission,
    relays,
    list,
    assignments,
    monitor,
    rel,
    ready,
    busy,
    forceRelay,
    setForceRelay,
    move,
    moveMany,
    loadError,
  } = useRelayAssignments();
  const [selected, setSelected] = React.useState<RowSelectionState>({});
  const [bulkTarget, setBulkTarget] = React.useState<string>();
  const canEdit = !!permission.relays.update;

  const columns = React.useMemo<ColumnDef<Peer>[]>(
    () => [
      {
        id: "select",
        meta: { fit: true },
        header: ({ table }) => (
          <div className="min-w-[20px] max-w-[20px]">
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="min-w-[20px] max-w-[20px]">
            <Checkbox
              checked={row.getIsSelected()}
              variant="tableCell"
              onCheckedChange={(v) => row.toggleSelected(!!v)}
              aria-label="Select row"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: "name",
        accessorFn: (p) => p.name,
        header: ({ column }) => (
          <DataTableHeader column={column}>Device</DataTableHeader>
        ),
        sortingFn: "text",
        cell: ({ row }) => (
          <ActiveInactiveRow active={row.original.connected} text={row.original.name}>
            <span className="text-xs text-nb-gray-400 mt-1">
              {row.original.ip}
              {monitor.devices[row.original.id!]?.home_relay
                ? ` · using ${rel(monitor.devices[row.original.id!].home_relay!)}`
                : ""}
            </span>
          </ActiveInactiveRow>
        ),
      },
      {
        id: "latency",
        header: ({ column }) => (
          <DataTableHeader column={column}>Latency</DataTableHeader>
        ),
        enableSorting: false,
        cell: ({ row }) => {
          const health = monitor.devices[row.original.id!];
          return health ? (
            <div className="flex gap-2">
              {relays.map((relay) => {
                const s = health.relays[relay.id];
                return (
                  <Badge key={relay.id} variant={tone(s?.rtt_ms, s?.loss_pct)} size="xs">
                    {rel(relay.id)} ·{" "}
                    {s?.rtt_ms == null ? "no reply" : `${Math.round(s.rtt_ms)} ms`}
                    {s?.loss_pct ? ` · ${s.loss_pct}%` : ""}
                  </Badge>
                );
              })}
            </div>
          ) : (
            <span className="text-xs text-nb-gray-500">—</span>
          );
        },
      },
      {
        id: "relay",
        header: ({ column }) => (
          <DataTableHeader column={column}>Relay</DataTableHeader>
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <Select
            value={assignments[row.original.id!] ?? AUTO}
            onValueChange={(v) => move(row.original.id!, v)}
            disabled={!canEdit || busy === row.original.name}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO}>Automatic</SelectItem>
              {relays.map((relay, i) => (
                <SelectItem key={relay.id} value={relay.id}>
                  Relay {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
    ],
    [relays, assignments, monitor.devices, busy, canEdit, rel, move],
  );

  if (!permission.relays.read)
    return <p role="alert" className="p-default">You do not have permission to view relays.</p>;
  if (loadError)
    return (
      <div className="p-default max-w-xl">
        <Callout variant="warning">
          This management server does not support relay policies.
        </Callout>
      </div>
    );
  if (!ready) return <p role="status" className="p-default text-nb-gray-400">Loading…</p>;

  const onRelay = (id: string) =>
    list
      .filter(
        (p) =>
          (monitor.devices[p.id!]?.home_relay ?? assignments[p.id!] ?? relays[0]?.id) === id,
      )
      .map((p) => p.id!);
  const selectedIds = Object.keys(selected);

  return (
    <div className="flex flex-col gap-8">
      {monitor.alerts.length > 0 && (
        <div className="p-default flex flex-col gap-3 max-w-3xl">
          {monitor.alerts.map((alert) => (
            <Callout
              key={alert.peer_id}
              variant="warning"
              icon={<AlertTriangle size={14} className="shrink-0 relative top-[3px]" />}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                <span>
                  <b>{alert.peer}</b> is slow on {rel(alert.relay)} (
                  {alert.rtt_ms == null ? "no reply" : `${Math.round(alert.rtt_ms)} ms`}
                  {alert.loss_pct ? `, ${alert.loss_pct}% loss` : ""}).{" "}
                  {rel(alert.suggest_relay)} is {Math.round(alert.suggest_rtt_ms)} ms.
                </span>
                <Button
                  variant="primary"
                  size="xs"
                  disabled={!canEdit}
                  onClick={() => moveMany([alert.peer_id], alert.suggest_relay)}
                >
                  Move to {rel(alert.suggest_relay)}
                </Button>
              </div>
            </Callout>
          ))}
        </div>
      )}

      <div className="p-default grid gap-4 sm:grid-cols-2 xl:grid-cols-3 max-w-5xl">
        {relays.map((relay, i) => {
          const here = onRelay(relay.id);
          return (
            <Card key={relay.id} className="w-full p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <SquareIcon
                  icon={<RadioTower size={16} />}
                  color="netbird"
                  size="small"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-white font-medium">Relay {i + 1}</span>
                  <span className="text-xs text-nb-gray-400 truncate">
                    {relayLabel(relay)}
                  </span>
                </div>
                <Badge variant="green" size="xs" className="ml-auto">
                  Active
                </Badge>
              </div>
              <span className="text-3xl font-semibold text-white">
                {here.length}
                <span className="text-sm font-normal text-nb-gray-400 ml-2">
                  {here.length === 1 ? "device" : "devices"}
                </span>
              </span>
              {here.length > 0 && relays.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {relays
                    .filter((r) => r.id !== relay.id)
                    .map((target) => (
                      <Button
                        key={target.id}
                        variant="secondary"
                        size="xs"
                        disabled={!canEdit}
                        onClick={() => moveMany(here, target.id)}
                      >
                        Move all to {rel(target.id)}
                      </Button>
                    ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <DataTableMultiSelectPopup
        selectedItems={selectedIds}
        label="device(s) selected"
        onCanceled={() => setSelected({})}
        rightSide={
          <div className="flex items-center gap-2 pr-2">
            <Select value={bulkTarget} onValueChange={setBulkTarget}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Move to…" />
              </SelectTrigger>
              <SelectContent>
                {relays.map((relay, i) => (
                  <SelectItem key={relay.id} value={relay.id}>
                    Relay {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="primary"
              size="xs"
              disabled={!bulkTarget || !canEdit}
              onClick={() => {
                if (!bulkTarget) return;
                moveMany(selectedIds, bulkTarget);
                setSelected({});
              }}
            >
              Move
            </Button>
          </div>
        }
      />
      <DataTable
        text="Devices"
        columns={columns}
        data={list}
        useRowId
        rowSelection={selected}
        setRowSelection={setSelected}
        searchPlaceholder="Search devices…"
        initialPageSize={25}
        showResetFilterButton={false}
        inset={false}
        keepStateInLocalStorage={false}
      />

      <div className="p-default max-w-xl">
        <FancyToggleSwitch
          value={forceRelay}
          onChange={setForceRelay}
          label="Always use the relay"
          helpText="Turn off direct connections between moved devices. Applies the next time you move a device."
          disabled={!canEdit}
        />
      </div>
    </div>
  );
}
