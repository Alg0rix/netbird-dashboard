import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import DashboardLayout from "@/layouts/DashboardLayout";
import { clickSelector, findText, settleMotion } from "@/storybook/network";
import {
  relayConfiguration,
  relayPreview,
} from "../../../../.storybook/mocks/fixtures/relay-policies";
import { currentUser } from "../../../../.storybook/mocks/fixtures/users";
import RelaysPage from "./page";

const meta: Meta = {
  title: "Pages/Network/Relays",
  afterEach: settleMotion,
  parameters: { nextjs: { navigation: { pathname: "/relays" } } },
  render: () => (
    <DashboardLayout>
      <RelaysPage />
    </DashboardLayout>
  ),
};
export default meta;
type Story = StoryObj;
export const CatalogAndRules: Story = {
  play: async () => {
    await findText("Regional relays");
  },
};
export const Empty: Story = {
  parameters: {
    api: {
      "GET /relay-policies/configuration": {
        ...relayConfiguration,
        groups: [],
        home_profiles: [],
        pair_policies: [],
      },
    },
  },
  play: async () => {
    await findText(/No pair rules/);
  },
};
export const EditOwningRule: Story = {
  parameters: {
    nextjs: {
      navigation: { pathname: "/relays", query: { policy: "office-servers" } },
    },
  },
  play: async () => {
    await findText("Symmetric pair rules");
    await findText("Ordered relay preference tiers");
  },
};
export const PreviewConfirmation: Story = {
  play: async () => {
    await findText("Regional relays");
    await clickSelector("[data-testid='relay-preview']");
    await findText("Review impact before saving");
  },
};
export const UnsupportedEndpoints: Story = {
  parameters: {
    api: {
      "POST /relay-policies/preview": {
        ...relayPreview,
        pairs: relayPreview.pairs.map((pair) => ({
          ...pair,
          unsupported: true,
        })),
      },
    },
  },
  play: PreviewConfirmation.play,
};
export const TruncatedPreview: Story = {
  parameters: {
    api: {
      "POST /relay-policies/preview": { ...relayPreview, truncated: true },
    },
  },
  play: PreviewConfirmation.play,
};
export const StaleDraft: Story = {
  parameters: {
    api: {
      "POST /relay-policies/preview": () => {
        throw { code: 409, message: "Configuration changed" };
      },
    },
  },
  play: async () => {
    await findText("Regional relays");
    await clickSelector("[data-testid='relay-preview']");
    await findText(/Your full draft may replace/);
  },
};
export const ManagementError: Story = {
  parameters: {
    api: {
      "GET /relay-policies/configuration": () => {
        throw { code: 503, message: "Management unavailable" };
      },
    },
  },
  play: async () => {
    await findText("Unable to load relay policies.");
  },
};
export const OlderManagement: Story = {
  parameters: {
    api: {
      "GET /relay-policies/configuration": {
        ...relayConfiguration,
        supported: false,
      },
    },
  },
  play: async () => {
    await findText(/unavailable on this Management version/);
  },
};

export const ReadOnlyAccess: Story = {
  parameters: {
    api: {
      "GET /users/current": {
        ...currentUser,
        permissions: {
          ...currentUser.permissions,
          modules: {
            ...currentUser.permissions.modules,
            relays: { read: true, create: false, update: false, delete: false },
          },
        },
      },
    },
  },
  play: async () => {
    await findText(/Read-only access/);
  },
};
export const DeniedAccess: Story = {
  parameters: {
    api: {
      "GET /users/current": {
        ...currentUser,
        permissions: {
          ...currentUser.permissions,
          modules: {
            ...currentUser.permissions.modules,
            relays: {
              read: false,
              create: false,
              update: false,
              delete: false,
            },
          },
        },
      },
    },
  },
  play: async () => {
    await findText(/Only users with proper permissions/);
  },
};
export const Loading: Story = {
  beforeEach: () => {
    const original = window.fetch;
    window.fetch = (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.href
          : input.url;
      return url.includes("/relay-policies/configuration")
        ? new Promise<Response>(() => undefined)
        : original(input, init);
    };
    return () => {
      window.fetch = original;
    };
  },
  play: async () => {
    await findText("Loading relay policies…");
  },
};
