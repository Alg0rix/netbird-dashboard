"use client";

import { notify } from "@components/Notification";
import useFetchApi, { useApiCall } from "@utils/api";
import * as React from "react";
import { useSWRConfig } from "swr";
import { usePermissions } from "@/contexts/PermissionsProvider";
import { Peer } from "@/interfaces/Peer";
import {
  RelayCatalogResponse,
  RelayPolicyConfiguration,
} from "@/interfaces/RelayPolicy";
import { useRelayPolicyConfiguration } from "@/modules/relay-policies/useRelayPolicyConfiguration";
import { Assignments, buildConfiguration, readAssignments } from "./rules";
import { useRelayMonitor } from "./useRelayMonitor";

export const AUTO = "auto";

// Shared state and actions for the simple relay screens (Relays page, peer Relays tab).
export function useRelayAssignments() {
  const { permission } = usePermissions();
  const { mutate } = useSWRConfig();
  const configuration = useRelayPolicyConfiguration(permission.relays.read);
  const catalog = useFetchApi<RelayCatalogResponse>(
    "/relay-catalog",
    true,
    true,
    permission.relays.read,
  );
  const peers = useFetchApi<Peer[]>("/peers", true);
  const save = useApiCall<RelayPolicyConfiguration>(
    "/relay-policies/configuration",
    true,
  );
  const monitor = useRelayMonitor(permission.relays.read);
  const [forceRelay, setForceRelay] = React.useState(false);
  const [busy, setBusy] = React.useState<string>();

  const relays = (catalog.data?.entries ?? []).filter(
    (r) => r.active && !r.legacy,
  );
  const config = configuration.data;
  const list = (peers.data ?? []).filter((p) => p.id);
  const assignments = config ? readAssignments(config) : {};
  const rel = (id: string) => {
    const i = relays.findIndex((r) => r.id === id);
    return i < 0 ? id : `Relay ${i + 1}`;
  };
  const ready = !!config && !!catalog.data && !!peers.data;

  const apply = (changes: Assignments, title: string, description: string) => {
    if (!config) return;
    setBusy(title);
    notify({
      title,
      description,
      promise: save
        .put(
          buildConfiguration(
            config,
            { ...assignments, ...changes },
            list.map((p) => p.id!),
            relays,
            forceRelay,
            Object.keys(changes),
          ),
        )
        .then(() => mutate("/relay-policies/configuration"))
        .finally(() => setBusy(undefined)),
      loadingMessage: "Applying…",
    });
  };
  const move = (peerId: string, relayId: string) =>
    apply(
      { [peerId]: relayId === AUTO ? undefined : relayId },
      list.find((p) => p.id === peerId)?.name ?? "Device",
      relayId === AUTO ? "Back to automatic relay." : `Moved to ${rel(relayId)}.`,
    );
  const moveMany = (peerIds: string[], relayId: string) =>
    apply(
      Object.fromEntries(peerIds.map((id) => [id, relayId])),
      `${peerIds.length} ${peerIds.length === 1 ? "device" : "devices"}`,
      `Moved to ${rel(relayId)}.`,
    );

  return {
    permission,
    configuration,
    config,
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
    loadError: configuration.error || !configuration.supported,
  };
}
