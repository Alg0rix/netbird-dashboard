import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import React from "react";
import { withAppProviders } from "@/storybook/components";
import { RelayScopeView } from "./PeerRelaySection";
import { relayStatusFixture } from "./PeerRelaySection.fixtures";

const meta: Meta<typeof RelayScopeView> = {
  title: "Peers/Relay Status",
  component: RelayScopeView,
  decorators: [withAppProviders],
  args: {
    local: "peer-a",
    remote: "peer-b",
    scope: "pair",
    status: relayStatusFixture,
    canRetry: true,
  },
};
export default meta;
type Story = StoryObj<typeof RelayScopeView>;
export const AppliedNativeRelay: Story = {};
export const Auditor: Story = { args: { canRetry: false } };
export const Pending: Story = {
  args: {
    status: {
      ...relayStatusFixture,
      application: "pending",
      healthy: false,
      endpoints: [],
    },
  },
};
export const Unsupported: Story = {
  args: {
    status: {
      ...relayStatusFixture,
      application: "unsupported",
      healthy: false,
    },
  },
};
export const Stale: Story = {
  args: {
    status: {
      ...relayStatusFixture,
      application: "stale",
      healthy: false,
      endpoints: relayStatusFixture.endpoints.map((entry) => ({
        ...entry,
        current: false,
      })),
    },
  },
};
export const Disagreement: Story = {
  args: {
    status: {
      ...relayStatusFixture,
      application: "disagreement",
      healthy: false,
      endpoints: relayStatusFixture.endpoints.map((entry, i) => ({
        ...entry,
        relay_id: i ? "relay-b" : "relay-a",
      })),
    },
  },
};
export const Blocked: Story = {
  args: {
    status: {
      ...relayStatusFixture,
      healthy: false,
      policy: { ...relayStatusFixture.policy!, state: "blocked", tiers: [] },
    },
  },
};
export const AppliedWithoutTransport: Story = {
  args: {
    status: {
      ...relayStatusFixture,
      application: "applied",
      transport: "unknown",
      healthy: false,
      endpoints: relayStatusFixture.endpoints.map((entry) => ({
        ...entry,
        state: "blocked",
        transport: "unknown",
        relay_id: "",
        reason: "exhausted",
      })),
    },
  },
};
export const Direct: Story = {
  args: {
    status: {
      ...relayStatusFixture,
      transport: "direct",
      relay_id: "",
      policy: { ...relayStatusFixture.policy!, force_relay: false },
      endpoints: relayStatusFixture.endpoints.map((entry) => ({
        ...entry,
        transport: "direct",
        relay_id: "",
      })),
    },
  },
};
export const HomeRegistration: Story = {
  args: {
    scope: "home",
    remote: "",
    status: {
      ...relayStatusFixture,
      peer_b: "",
      endpoints: [{ ...relayStatusFixture.endpoints[0], remote_peer_id: "" }],
    },
  },
};
export const ReversePair: Story = {
  args: { local: "peer-b", remote: "peer-a" },
};
export const Empty: Story = {
  args: {
    status: {
      ...relayStatusFixture,
      application: "unconfigured",
      healthy: false,
      policy: undefined,
      endpoints: [],
    },
  },
};
export const Loading: Story = { args: { status: undefined, loading: true } };
export const Error: Story = {
  args: {
    status: undefined,
    error: "Unable to load relay status. Refresh to try again.",
  },
};
