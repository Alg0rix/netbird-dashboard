import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Peer } from "@/interfaces/Peer";
import type {
  RelayPairPolicy,
  RelayPolicyStatus,
} from "@/interfaces/RelayPolicy";
import { relayStatusFixture } from "./PeerRelaySection.fixtures";
import {
  relayPairPoliciesForPeer,
  relayStatusMatchesScope,
} from "./PeerRelaySection.helpers";

const access = vi.hoisted(() => ({
  read: true,
  update: true,
  supported: true,
  code: 0,
  status: undefined as RelayPolicyStatus | undefined,
  statusError: undefined as { code: number } | undefined,
  post: vi.fn(async (_body: unknown) => ({ generation: 2 })),
}));
vi.mock("@/contexts/PermissionsProvider", () => ({
  usePermissions: () => ({
    permission: { relays: { read: access.read, update: access.update } },
  }),
}));
vi.mock("@/modules/relay-policies/useRelayPolicyConfiguration", () => ({
  useRelayPolicyConfiguration: () => ({
    supported: access.supported,
    data: { supported: access.supported, pair_policies: [] },
    error: access.code ? { code: access.code } : undefined,
  }),
}));
vi.mock("@utils/api", () => ({
  default: (url: string) => ({
    data: url.includes("/status?") ? access.status : [],
    error: url.includes("/status?") ? access.statusError : undefined,
    mutate: vi.fn(),
  }),
  useApiCall: () => ({ post: access.post }),
}));
import { PeerRelaySection, RelayScopeView } from "./PeerRelaySection";

afterEach(() => {
  cleanup();
  access.read = true;
  access.update = true;
  access.supported = true;
  access.code = 0;
  access.status = undefined;
  access.statusError = undefined;
  vi.useRealTimers();
  access.post.mockClear();
});

describe("peer relay status", () => {
  it("expires cached health without a new response and preserves observation history", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
    access.status = {
      ...relayStatusFixture,
      peer_b: "",
      endpoints: [{ ...relayStatusFixture.endpoints[0], remote_peer_id: "" }],
    };
    render(
      <PeerRelaySection peer={{ id: "peer-a", name: "Peer A" } as Peer} />,
    );
    expect(screen.getByTestId("relay-home-application").textContent).toContain(
      "Applied:",
    );
    fireEvent.click(screen.getByTestId("relay-home-retry"));
    act(() => vi.advanceTimersByTime(45001));
    expect(screen.getByTestId("relay-home-application").textContent).toContain(
      "Stale:",
    );
    expect(screen.getByText(/Transport health:/).textContent).toContain(
      "not confirmed",
    );
    expect(screen.getByText(/applied \/ none/).textContent).toContain("stale");
    expect(screen.getByText("2026-11-04T12:00:00Z")).toBeTruthy();
    expect(screen.getByText("2026-11-04T12:00:45Z")).toBeTruthy();
    expect(
      (screen.getByTestId("relay-home-retry") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByTestId("relay-confirm-retry") as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByTestId("relay-confirm-retry"));
    expect(access.post).not.toHaveBeenCalled();
  });

  it("marks cached observations stale immediately on failed refresh and recovers with fresh reports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
    access.status = {
      ...relayStatusFixture,
      peer_b: "",
      endpoints: [{ ...relayStatusFixture.endpoints[0], remote_peer_id: "" }],
    };
    const peer = { id: "peer-a", name: "Peer A" } as Peer;
    const view = render(<PeerRelaySection peer={peer} />);
    access.statusError = { code: 503 };
    view.rerender(<PeerRelaySection peer={peer} />);
    expect(screen.getByTestId("relay-home-application").textContent).toContain(
      "Stale:",
    );
    expect(screen.getByText(/Transport health:/).textContent).toContain(
      "not confirmed",
    );
    expect(screen.getByText(/applied \/ none/).textContent).toContain("stale");
    expect(
      (screen.getByTestId("relay-home-retry") as HTMLButtonElement).disabled,
    ).toBe(true);
    access.statusError = undefined;
    access.status = structuredClone(access.status);
    view.rerender(<PeerRelaySection peer={peer} />);
    expect(screen.getByTestId("relay-home-application").textContent).toContain(
      "Applied:",
    );
    expect(
      (screen.getByTestId("relay-home-retry") as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("pins retry digest while background status refreshes and submits once", async () => {
    access.status = { ...relayStatusFixture, peer_b: "", endpoints: [] };
    const peer = { id: "peer-a", name: "Peer A" } as Peer;
    const view = render(<PeerRelaySection peer={peer} />);
    fireEvent.click(screen.getByTestId("relay-home-retry"));
    expect(screen.getByRole("dialog").textContent).toContain(
      "briefly interrupt connectivity",
    );
    access.status = {
      ...access.status,
      policy: {
        ...relayStatusFixture.policy!,
        digest: "refreshed-policy",
        reselection_generation: 99,
      },
    };
    view.rerender(<PeerRelaySection peer={peer} />);
    fireEvent.click(screen.getByTestId("relay-confirm-retry"));
    await waitFor(() => expect(access.post).toHaveBeenCalledTimes(1));
    expect(access.post).toHaveBeenCalledWith({
      peer_a: "peer-a",
      expected_digest: "current-policy",
    });
    await waitFor(() =>
      expect(
        screen.getByTestId("relay-home-retry-feedback").textContent,
      ).toContain("generation 2"),
    );
  });

  it.each([
    "pending",
    "unsupported",
    "stale",
    "disagreement",
    "unconfigured",
    "unknown",
  ] as const)("explains %s without claiming health", (application) => {
    render(
      <RelayScopeView
        local="peer-a"
        remote="peer-b"
        scope="pair"
        status={{
          ...relayStatusFixture,
          application,
          healthy: false,
          transport: "unknown",
          endpoints: [],
        }}
      />,
    );
    expect(
      screen.getByTestId("relay-pair-application").textContent?.toLowerCase(),
    ).toContain(application);
    expect(
      screen.getAllByText("Pending: no endpoint observation received."),
    ).toHaveLength(2);
  });
  it("separates applied configuration from blocked transport and inherited constraints", () => {
    render(
      <RelayScopeView
        local="peer-a"
        remote="peer-b"
        scope="pair"
        status={{
          ...relayStatusFixture,
          healthy: false,
          policy: { ...relayStatusFixture.policy!, state: "blocked" },
        }}
        canRetry
      />,
    );
    expect(screen.getByText(/No permitted relay/)).toBeTruthy();
    expect(
      (screen.getByTestId("relay-pair-retry") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      screen.getByRole("link", { name: /Edit owning/ }).getAttribute("href"),
    ).toContain("region-rule");
  });
  it("shows actual native path, observed timestamps and missing reports separately", () => {
    render(
      <RelayScopeView
        local="peer-a"
        remote="peer-b"
        scope="pair"
        status={relayStatusFixture}
      />,
    );
    expect(screen.getByText(/approved native relay relay-a/)).toBeTruthy();
    expect(screen.getAllByText("2026-11-04T12:00:00Z")).toHaveLength(2);
    expect(
      screen.queryByText("Pending: no endpoint observation received."),
    ).toBeNull();
  });
  it("auditors see status and cannot retry", () => {
    render(
      <RelayScopeView
        local="peer-a"
        remote="peer-b"
        scope="pair"
        status={relayStatusFixture}
        canRetry={false}
      />,
    );
    expect(screen.getByTestId("relay-pair-application")).toBeTruthy();
    expect(screen.queryByTestId("relay-pair-retry")).toBeNull();
  });
  it("keeps home observations separate and exposes a separate retry", () => {
    const onRetry = vi.fn();
    const home: RelayPolicyStatus = {
      ...relayStatusFixture,
      peer_b: "",
      endpoints: [{ ...relayStatusFixture.endpoints[0], remote_peer_id: "" }],
    };
    render(
      <RelayScopeView
        local="peer-a"
        scope="home"
        status={home}
        canRetry
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByTestId("relay-home-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("relay-pair-status")).toBeNull();
  });
  it("shows loading and error states", () => {
    render(
      <RelayScopeView
        local="peer-a"
        scope="home"
        loading
        error="Unable to load relay status."
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(screen.getByRole("alert").textContent).toContain("Unable");
  });
  it("hides feature controls on older Management", () => {
    access.supported = false;
    access.code = 404;
    const { container } = render(
      <PeerRelaySection peer={{ id: "peer-a" } as Peer} />,
    );
    expect(container.textContent).toBe("");
  });
  it("denies direct access without relay read grants", () => {
    access.read = false;
    render(<PeerRelaySection peer={{ id: "peer-a" } as Peer} />);
    expect(screen.queryByTestId("peer-relays-section")).toBeNull();
    expect(screen.getByText(/Relay Policies/)).toBeTruthy();
  });
});

it("finds pair rules from both endpoint orientations and inherited groups", () => {
  const policy = {
    id: "pair",
    source: { peer_ids: ["a"], group_ids: [] },
    destination: { peer_ids: [], group_ids: ["group-b"] },
  } as unknown as RelayPairPolicy;
  expect(relayPairPoliciesForPeer([policy], { id: "a" } as Peer)).toEqual([
    policy,
  ]);
  expect(
    relayPairPoliciesForPeer([policy], {
      id: "b",
      groups: [{ id: "group-b" }],
    } as Peer),
  ).toEqual([policy]);
  expect(
    relayPairPoliciesForPeer([policy], { id: "unrelated" } as Peer),
  ).toEqual([]);
});

it("rejects previous pair data while retaining symmetric identity", () => {
  expect(relayStatusMatchesScope(relayStatusFixture, "peer-b", "peer-a")).toBe(
    true,
  );
  expect(relayStatusMatchesScope(relayStatusFixture, "peer-a", "peer-c")).toBe(
    false,
  );
  expect(relayStatusMatchesScope(relayStatusFixture, "peer-a", "")).toBe(false);
});
