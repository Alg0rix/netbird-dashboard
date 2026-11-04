import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { RelayConstraints } from "@/interfaces/RelayPolicy";
import {
  relayCatalog,
  relayConfiguration,
  relayEffectivePolicy,
} from "../../../.storybook/mocks/fixtures/relay-policies";
import { RelayConstraintsEditor } from "./RelayConstraintsEditor";
import { RelayMultiSelect } from "./RelayMultiSelect";
import { RelayPolicyDetail } from "./RelayPolicyDetail";

const meta: Meta = {
  title: "Modules/Relays/Components",
  decorators: [
    (Story) => (
      <div className="p-8 max-w-4xl">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj;
function Constraints({
  home = false,
  empty = false,
}: {
  home?: boolean;
  empty?: boolean;
}) {
  const [value, setValue] = useState<RelayConstraints>({
    ...relayConfiguration.pair_policies[0].constraints,
    ...(empty ? { allow: { relay_ids: [], group_ids: [] } } : {}),
  });
  return (
    <RelayConstraintsEditor
      scope={home ? "home" : "pair"}
      value={value}
      onChange={setValue}
      catalog={relayCatalog.entries}
      groups={relayConfiguration.groups}
    />
  );
}
export const OrderedEqualPriorityTiers: Story = {
  render: () => <Constraints />,
};
export const HomeScope: Story = { render: () => <Constraints home /> };
export const ExplicitEmptyAllow: Story = {
  render: () => <Constraints empty />,
};
export const EffectiveBlocked: Story = {
  render: () => (
    <RelayPolicyDetail
      policy={{ ...relayEffectivePolicy, state: "blocked", tiers: [] }}
    />
  ),
};
export const EffectiveLegacy: Story = { render: () => <RelayPolicyDetail /> };
export const EffectiveHome: Story = {
  render: () => (
    <RelayPolicyDetail
      scope="home"
      policy={{ ...relayEffectivePolicy, force_relay: false }}
    />
  ),
};
function Selector() {
  const [values, setValues] = useState(["relay-a"]);
  return (
    <RelayMultiSelect
      label="Approved relays"
      values={values}
      options={relayCatalog.entries.map((item) => ({
        value: item.id,
        label: item.id,
      }))}
      onChange={setValues}
    />
  );
}
export const RelaySelector: Story = { render: () => <Selector /> };
