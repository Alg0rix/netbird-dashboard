"use client";

import { useNetBirdFetch } from "@utils/api";
import useSWR from "swr";

export type RelaySample = { rtt_ms: number | null; loss_pct: number };
export type DeviceHealth = {
  name: string;
  home_relay: string | null;
  relays: Record<string, RelaySample>;
};
export type RelayAlert = {
  peer_id: string;
  peer: string;
  relay: string;
  rtt_ms: number | null;
  loss_pct: number;
  suggest_relay: string;
  suggest_rtt_ms: number;
};

// Same-origin relay monitor. Optional: the screen works without it.
export function useRelayMonitor(enabled: boolean) {
  const { fetch } = useNetBirdFetch(true);
  const json = (url: string) =>
    fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  const latency = useSWR<{ peers: Record<string, DeviceHealth> }>(
    enabled ? "/relay-monitor/latency" : null,
    json,
    { refreshInterval: 5000, shouldRetryOnError: false },
  );
  const alerts = useSWR<{ alerts: RelayAlert[] }>(
    enabled ? "/relay-monitor/alerts" : null,
    json,
    { refreshInterval: 5000, shouldRetryOnError: false },
  );
  return {
    devices: latency.data?.peers ?? {},
    alerts: alerts.data?.alerts ?? [],
    available: !latency.error && !!latency.data,
  };
}
