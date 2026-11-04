"use client";

import Button from "@components/Button";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalTitle,
} from "@components/modal/Modal";
import Paragraph from "@components/Paragraph";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/Select";
import { RestrictedAccess } from "@components/ui/RestrictedAccess";
import useFetchApi, { useApiCall } from "@utils/api";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { usePermissions } from "@/contexts/PermissionsProvider";
import type { Peer } from "@/interfaces/Peer";
import type {
  RelayEffectivePolicy,
  RelayPolicyStatus,
  RelayRetryResponse,
} from "@/interfaces/RelayPolicy";
import { RelayPolicyDetail } from "@/modules/relay-policies/RelayPolicyDetail";
import { useRelayPolicyConfiguration } from "@/modules/relay-policies/useRelayPolicyConfiguration";
import {
  relayPairPoliciesForPeer,
  relayStatusAtTime,
  relayStatusExplanation,
  relayStatusMatchesScope,
} from "./PeerRelaySection.helpers";

export function PeerRelaySection({ peer }: { peer: Peer }) {
  const { permission } = usePermissions();
  const allowed = !!permission.relays?.read;
  const configuration = useRelayPolicyConfiguration(allowed);
  const { data: peers, error: peersError } = useFetchApi<Peer[]>(
    `/peers/${encodeURIComponent(peer.id || "")}/accessible-peers`,
    true,
    true,
    allowed && configuration.supported,
  );
  const [remote, setRemote] = useState("");
  if (!allowed) return <RestrictedAccess page="Relay Policies" />;
  if (
    configuration.error?.code === 404 ||
    configuration.data?.supported === false
  )
    return null;
  if (configuration.error)
    return (
      <p role="alert">
        Unable to load relay configuration. Reload to try again.
      </p>
    );
  if (configuration.isLoading || !configuration.data)
    return <p role="status">Loading relay policies...</p>;
  const rules = relayPairPoliciesForPeer(
    configuration.data.pair_policies,
    peer,
  );
  return (
    <div className="px-8 space-y-8" data-testid="peer-relays-section">
      <Paragraph>
        Home registration keeps this peer available on relays. Pair transport
        describes the actual path to another authorized peer. Relay policies
        never grant network access.
      </Paragraph>
      <RelayScopeStatus
        key={`home-${peer.id}`}
        local={peer.id || ""}
        localName={peer.name}
        remote=""
        canRetry={!!permission.relays?.update}
        canEdit={!!(permission.relays?.create || permission.relays?.update)}
      />
      <section className="space-y-4" aria-label="Pair relay transport">
        <h2>Pair transport</h2>
        <label htmlFor="relay-remote-peer">Remote peer</label>
        <Select value={remote} onValueChange={setRemote}>
          <SelectTrigger id="relay-remote-peer" data-testid="relay-remote-peer">
            <SelectValue placeholder="Choose an authorized peer" />
          </SelectTrigger>
          <SelectContent>
            {peers
              ?.filter((item) => item.id && item.id !== peer.id)
              .map((item) => (
                <SelectItem key={item.id} value={item.id!}>
                  {item.name} ({item.ip})
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {peersError && <p role="alert">Unable to load authorized peers.</p>}
        {peers && peers.length === 0 && (
          <p>No authorized remote peers are available.</p>
        )}
        <p>
          Pair rules apply in either direction. Pair rules targeting peer groups
          can contribute inherited restrictions.
        </p>
        {rules.length > 0 && (
          <ul aria-label="Pair rules involving this peer">
            {rules.map((rule) => (
              <li key={rule.id}>
                <Link href={`/relays?policy=${encodeURIComponent(rule.id)}`}>
                  {rule.name}
                </Link>{" "}
                ({rule.enabled ? "enabled" : "disabled"})
              </li>
            ))}
          </ul>
        )}
        {remote ? (
          <RelayScopeStatus
            key={`${peer.id}-${remote}`}
            local={peer.id || ""}
            localName={peer.name}
            remote={remote}
            canRetry={!!permission.relays?.update}
            canEdit={!!(permission.relays?.create || permission.relays?.update)}
          />
        ) : (
          <p>Choose a remote peer to inspect symmetric pair status.</p>
        )}
      </section>
    </div>
  );
}

function RelayScopeStatus({
  local,
  localName,
  remote,
  canRetry,
  canEdit,
}: {
  local: string;
  localName: string;
  remote: string;
  canRetry: boolean;
  canEdit: boolean;
}) {
  const query = new URLSearchParams({ peer_a: local });
  if (remote) query.set("peer_b", remote);
  const { data, error, isLoading, mutate } = useFetchApi<RelayPolicyStatus>(
    `/relay-policies/status?${query}`,
    true,
    true,
    !!local,
    { refreshInterval: 15000, shouldRetryOnError: false },
  );
  const retry = useApiCall<RelayRetryResponse>(
    "/relay-policies/retry-preferred",
    true,
  );
  const [confirm, setConfirm] = useState(false);
  const [retryPolicy, setRetryPolicy] = useState<RelayEffectivePolicy>();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const inFlight = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  const scopedStatus =
    data && relayStatusMatchesScope(data, local, remote) ? data : undefined;
  useEffect(() => {
    const expiries =
      scopedStatus?.endpoints
        .map((entry) => Date.parse(entry.expires_at))
        .filter((expiry) => Number.isFinite(expiry) && expiry > now) ?? [];
    if (!expiries.length) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(2147483647, Math.max(0, Math.min(...expiries) - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [scopedStatus, now]);
  const status = scopedStatus
    ? relayStatusAtTime(scopedStatus, !!error, now)
    : undefined;
  const retryAvailable = !!status && !error && status.application !== "stale";
  const performRetry = async () => {
    if (!canRetry || !retryAvailable || !retryPolicy || inFlight.current)
      return;
    inFlight.current = true;
    setBusy(true);
    setFeedback("");
    try {
      const result = await retry.post({
        peer_a: local,
        ...(remote ? { peer_b: remote } : {}),
        expected_digest: retryPolicy.digest,
      });
      setFeedback(
        `Retry requested, generation ${result.generation}. Waiting for fresh endpoint observations; permitted fallback remains available.`,
      );
      setConfirm(false);
      await mutate();
    } catch (cause) {
      const error = cause as { code?: number; message?: string };
      setFeedback(
        error.code === 409
          ? "Policy changed. Refresh status and preview the retry again."
          : error.message || "Retry could not be requested. Try again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <RelayScopeView
      status={status}
      scope={remote ? "pair" : "home"}
      local={local}
      remote={remote}
      error={
        error ? "Unable to load relay status. Refresh to try again." : undefined
      }
      loading={isLoading}
      canRetry={canRetry}
      retryDisabled={!retryAvailable}
      canEdit={canEdit}
      onRetry={() => {
        if (!retryAvailable) return;
        setFeedback("");
        setRetryPolicy(status?.policy);
        setConfirm(true);
      }}
    >
      {feedback && (
        <p
          role="status"
          data-testid={`relay-${remote ? "pair" : "home"}-retry-feedback`}
        >
          {feedback}
        </p>
      )}
      <Modal
        open={confirm}
        onOpenChange={(open) => {
          if (!busy) setConfirm(open);
        }}
      >
        <ModalContent>
          <div className="px-6 space-y-4">
            <ModalTitle>
              Retry preferred {remote ? "pair relay" : "home registration"}?
            </ModalTitle>
            <ModalDescription>
              Target:{" "}
              {remote
                ? `${localName} (${local}) ↔ ${remote}`
                : `${localName} (${local}) home registration`}
              . This may briefly interrupt connectivity. The preferred permitted
              relay is retried; other permitted relays remain available as
              fallback. Priority and exclusions stay unchanged.
            </ModalDescription>
            <p>
              Current desired generation: {retryPolicy?.reselection_generation}.
              Preferred relay choices:{" "}
              {retryPolicy?.tiers[0]?.map((entry) => entry.id).join(", ") ||
                "none"}
              .
            </p>
            {!retryAvailable && (
              <p role="alert">
                Current relay status is unavailable. Refresh status before
                requesting a retry.
              </p>
            )}
            <ModalFooter>
              <Button disabled={busy} onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                data-testid="relay-confirm-retry"
                disabled={busy || !retryAvailable}
                onClick={performRetry}
              >
                {busy ? "Requesting..." : "Confirm retry"}
              </Button>
            </ModalFooter>
          </div>
        </ModalContent>
      </Modal>
    </RelayScopeView>
  );
}

export function RelayScopeView({
  status,
  scope,
  local,
  remote = "",
  loading = false,
  error,
  canRetry = false,
  retryDisabled = false,
  canEdit = canRetry,
  onRetry,
  children,
}: {
  status?: RelayPolicyStatus;
  scope: "home" | "pair";
  local: string;
  remote?: string;
  loading?: boolean;
  error?: string;
  canRetry?: boolean;
  retryDisabled?: boolean;
  canEdit?: boolean;
  onRetry?: () => void;
  children?: React.ReactNode;
}) {
  const expected = scope === "home" ? [local] : [local, remote];
  return (
    <section
      className="space-y-4"
      data-testid={`relay-${scope}-status`}
      aria-label={
        scope === "home" ? "Home registration" : "Selected pair status"
      }
    >
      <h3>{scope === "home" ? "Home registration" : "Selected pair status"}</h3>
      {loading && !status && <p role="status">Loading observations...</p>}
      {error && <p role="alert">{error}</p>}
      {status && (
        <>
          <p data-testid={`relay-${scope}-application`}>
            {relayStatusExplanation(status)}
          </p>
          <p>
            Observed path:{" "}
            {status.transport === "unknown"
              ? "not confirmed"
              : status.transport === "direct"
              ? "direct"
              : `approved native relay ${status.relay_id}`}{" "}
            · Transport health: {status.healthy ? "healthy" : "not confirmed"}
          </p>
          <RelayPolicyDetail policy={status.policy} scope={scope} />
          <div className="overflow-auto">
            <table className="w-full text-sm text-left">
              <caption>Endpoint observations, independently reported</caption>
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Application / reason</th>
                  <th>Observed revision / catalog / retry</th>
                  <th>Transport / relay / attempt</th>
                  <th>Last observation / expiry</th>
                </tr>
              </thead>
              <tbody>
                {expected.map((id) => {
                  const observation = status.endpoints.find(
                    (entry) => entry.local_peer_id === id,
                  );
                  return (
                    <tr key={id}>
                      <td>{id}</td>
                      {observation ? (
                        <>
                          <td>
                            {observation.state} / {observation.reason || "none"}{" "}
                            ({observation.current ? "current" : "stale"})
                          </td>
                          <td>
                            {observation.revision} /{" "}
                            {observation.catalog_generation} /{" "}
                            {observation.reselection_generation}
                          </td>
                          <td>
                            {observation.transport} /{" "}
                            {observation.relay_id || "none"} /{" "}
                            {observation.attempt}
                          </td>
                          <td>
                            <time dateTime={observation.observed_at}>
                              {observation.observed_at}
                            </time>{" "}
                            /{" "}
                            <time dateTime={observation.expires_at}>
                              {observation.expires_at}
                            </time>
                          </td>
                        </>
                      ) : (
                        <td colSpan={4}>
                          Pending: no endpoint observation received.
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(canEdit || (canRetry && status.policy)) && (
            <div className="flex gap-4 items-center">
              {canEdit && (
                <Link
                  href={`/relays?peer=${encodeURIComponent(local)}${
                    remote
                      ? `&remote=${encodeURIComponent(remote)}`
                      : "&scope=home"
                  }`}
                  data-testid={`relay-${scope}-edit`}
                >
                  {scope === "home"
                    ? "Edit home profile"
                    : "Edit explicit pair rule"}
                </Link>
              )}
              {canRetry && status.policy && (
                <Button
                  data-testid={`relay-${scope}-retry`}
                  disabled={retryDisabled || status.policy.state === "blocked"}
                  onClick={onRetry}
                >
                  Retry preferred
                </Button>
              )}
            </div>
          )}
          {scope === "pair" && (
            <p>
              The explicit pair rule is separate from inherited contributors.
              Change persistent priority in its owning rule editor and preview
              every affected pair.
            </p>
          )}
        </>
      )}
      {children}
    </section>
  );
}
