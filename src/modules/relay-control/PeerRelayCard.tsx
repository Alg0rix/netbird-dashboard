"use client";

import Badge from "@components/Badge";
import Button from "@components/Button";
import { Callout } from "@components/Callout";
import Card from "@components/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/Select";
import SquareIcon from "@components/SquareIcon";
import ActiveInactiveRow from "@/modules/common-table-rows/ActiveInactiveRow";
import { AlertTriangle, RadioTower } from "lucide-react";
import type { Peer } from "@/interfaces/Peer";
import { relayLabel } from "./rules";
import { AUTO, useRelayAssignments } from "./useRelayAssignments";

const tone = (ms: number | null, loss: number) =>
  ms === null || ms > 200 || loss >= 20 ? "red" : ms > 80 ? "yellow" : "green";

// Simple, on-theme relay view for one device: where it is, how fast, change it in one click.
export function PeerRelayCard({ peer }: { peer: Peer }) {
  const { permission, config, relays, list, assignments, monitor, rel, ready, busy, move } =
    useRelayAssignments();
  if (!ready || !config || !peer.id) return null;
  const health = monitor.devices[peer.id];
  const chosen = assignments[peer.id];
  const current = health?.home_relay ?? chosen ?? relays[0]?.id;
  const currentRelay = relays.find((r) => r.id === current);
  const sample = current ? health?.relays[current] : undefined;
  const alert = monitor.alerts.find((a) => a.peer_id === peer.id);
  const canEdit = !!permission.relays.update;
  const via = (other: string) => {
    const pair = config.pair_policies.find(
      (p) =>
        [p.source.peer_ids[0], p.destination.peer_ids[0]].includes(peer.id!) &&
        [p.source.peer_ids[0], p.destination.peer_ids[0]].includes(other),
    );
    return pair?.constraints.preferences[0]?.relay_ids[0] ?? current;
  };
  const others = list.filter((p) => p.id !== peer.id);

  return (
    <div className="flex flex-col gap-6 max-w-4xl" data-testid="peer-relay-card">
      {alert && (
        <Callout
          variant="warning"
          icon={<AlertTriangle size={14} className="shrink-0 relative top-[3px]" />}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 w-full">
            <span>
              This device is slow on {rel(alert.relay)} (
              {alert.rtt_ms === null ? "no reply" : `${Math.round(alert.rtt_ms)} ms`}
              ). {rel(alert.suggest_relay)} is {Math.round(alert.suggest_rtt_ms)} ms.
            </span>
            <Button
              variant="primary"
              size="xs"
              disabled={!canEdit}
              onClick={() => move(peer.id!, alert.suggest_relay)}
            >
              Move to {rel(alert.suggest_relay)}
            </Button>
          </div>
        </Callout>
      )}

      <Card className="w-full p-6 flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-3 text-sm text-nb-gray-300">
            <SquareIcon icon={<RadioTower size={16} />} color="netbird" size="small" />
            Using
          </span>
          <span className="text-2xl font-semibold text-white">
            {current ? rel(current) : "No relay"}
          </span>
          {currentRelay && (
            <span className="text-sm text-nb-gray-400 break-all">
              {relayLabel(currentRelay)}
            </span>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {sample && (
              <Badge variant={tone(sample.rtt_ms, sample.loss_pct)} size="xs">
                {sample.rtt_ms === null
                  ? "no reply"
                  : `${Math.round(sample.rtt_ms)} ms`}
                {sample.loss_pct ? ` · ${sample.loss_pct}% loss` : ""}
              </Badge>
            )}
            {!health && (
              <Badge variant="gray" size="xs">
                Latency not available
              </Badge>
            )}
            {chosen && (
              <Badge variant="blue-darker" size="xs">
                Chosen by you
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 w-64">
          <span className="text-sm text-nb-gray-300">Use relay</span>
          <Select
            value={chosen ?? AUTO}
            onValueChange={(value) => move(peer.id!, value)}
            disabled={!canEdit || busy === peer.name}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO}>Automatic</SelectItem>
              {relays.map((relay, i) => (
                <SelectItem key={relay.id} value={relay.id}>
                  Relay {i + 1} · {relayLabel(relay)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {health && (
        <div className="grid gap-3 sm:grid-cols-2">
          {relays.map((relay) => {
            const s = health.relays[relay.id];
            return (
              <Card
                key={relay.id}
                className="w-full px-5 py-3 flex items-center justify-between"
              >
                <span className="text-white">{rel(relay.id)}</span>
                <Badge variant={tone(s?.rtt_ms ?? null, s?.loss_pct ?? 100)} size="xs">
                  {!s || s.rtt_ms === null
                    ? "no reply"
                    : `${Math.round(s.rtt_ms)} ms${s.loss_pct ? ` · ${s.loss_pct}% loss` : ""}`}
                </Badge>
              </Card>
            );
          })}
        </div>
      )}

      {others.length > 0 && (
        <Card className="w-full overflow-hidden">
          <div className="px-5 py-3 text-xs uppercase tracking-wide text-nb-gray-400">
            Connections to other devices
          </div>
          {others.map((other) => (
            <div
              key={other.id}
              className="flex items-center justify-between px-5 py-3 border-t border-nb-gray-900"
            >
              <ActiveInactiveRow active={other.connected} text={other.name}>
                <span className="text-xs text-nb-gray-400 mt-1">{other.ip}</span>
              </ActiveInactiveRow>
              <Badge variant="gray" size="xs">
                via {via(other.id!) ? rel(via(other.id!)!) : "automatic"}
              </Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
