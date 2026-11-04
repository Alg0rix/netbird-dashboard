import type { Meta } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import { relayStatusFixture } from "@/modules/peer/PeerRelaySection.fixtures";
import { inLayout, nav, resetStorage, type Story } from "@/storybook/core";
import { PEER } from "@/storybook/fixtures";
import type { HandlerContext } from "../../../../.storybook/mocks/fixtures";
import PeerPage from "./page";

const meta: Meta = {
  title: "Pages/Peer/Relays",
  render: inLayout(PeerPage),
  beforeEach: resetStorage,
  parameters: {
    ...nav("/peer", { id: PEER.macbook }),
    api: {
      "GET /relay-policies/configuration": {
        supported: true,
        revision: 4,
        catalog_generation: 2,
        groups: [],
        home_profiles: [],
        pair_policies: [],
      },
      "GET /relay-policies/status": ({ query }: HandlerContext) => ({
        ...relayStatusFixture,
        peer_a: query.get("peer_a"),
        peer_b: query.get("peer_b") || "",
        endpoints: [],
        application: "pending",
        healthy: false,
        transport: "unknown",
      }),
    },
  },
};
export default meta;

export const RelayTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId("peer-relays-tab"));
    await canvas.findByTestId("relay-home-application");
  },
};

export const HomeRetryConfirmation: Story = {
  play: async (context) => {
    await RelayTab.play?.(context);
    await userEvent.click(
      await within(context.canvasElement).findByTestId("relay-home-retry"),
    );
    await within(document.body).findByRole("dialog");
  },
};
