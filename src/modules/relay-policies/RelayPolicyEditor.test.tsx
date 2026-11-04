import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelayPolicyConfiguration } from "@/interfaces/RelayPolicy";
import { emptyConstraints } from "./helpers";
import { RelayConstraintsEditor } from "./RelayConstraintsEditor";
import { RelayConfigurationEditor } from "./RelayPolicyEditor";

const access = vi.hoisted(() => ({
  read: true,
  update: true,
  create: true,
  delete: true,
}));
vi.mock("@/contexts/PermissionsProvider", () => ({
  usePermissions: () => ({ permission: { relays: access } }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("policy=api-rule"),
}));
vi.mock("@utils/api", () => ({
  default: (url: string) => ({
    data: url === "/relay-catalog" ? { generation: 2, entries: [] } : [],
    error: undefined,
  }),
  useApiCall: () => ({ post: vi.fn(), put: vi.fn(), get: vi.fn() }),
}));
const config: RelayPolicyConfiguration = {
  supported: true,
  revision: 4,
  catalog_generation: 2,
  groups: [],
  home_profiles: [],
  pair_policies: [
    {
      id: "api-rule",
      name: "API-created broad rule",
      revision: 4,
      priority: 23,
      enabled: true,
      source: { peer_ids: ["a", "b"], group_ids: ["team"] },
      destination: { peer_ids: ["c"], group_ids: ["servers"] },
      constraints: {
        ...emptyConstraints(),
        allow: { relay_ids: ["r1", "r2"], group_ids: ["regional"] },
        preferences: [
          { relay_ids: ["r1", "r2"], group_ids: [] },
          { relay_ids: ["r3"], group_ids: [] },
        ],
      },
    },
  ],
};
afterEach(() => {
  cleanup();
  access.update = true;
});
describe("relay administration editor", () => {
  it("keeps API-created broad selectors and equal-priority tiers editable", () => {
    render(
      <RelayConfigurationEditor configuration={config} onSaved={vi.fn()} />,
    );
    expect(screen.getByDisplayValue("API-created broad rule")).toBeDefined();
    expect(screen.getByDisplayValue("23")).toBeDefined();
    expect(screen.getByText("a (unavailable)")).toBeDefined();
    expect(screen.getByText("team (unavailable)")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Move tier 2 up" }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Move tier 2 up" }));
    const tiers = screen.getAllByTestId("relay-preference-tier");
    expect(tiers[0].textContent).toContain("r3");
    expect(tiers[1].textContent).toContain("r1");
    expect(tiers[1].textContent).toContain("r2");
  });
  it("has no mutation controls for read-only access", () => {
    access.update = false;
    render(
      <RelayConfigurationEditor configuration={config} onSaved={vi.fn()} />,
    );
    expect(screen.queryByTestId("relay-preview")).toBeNull();
    expect(screen.queryByTestId("relay-confirm-save")).toBeNull();
    expect(screen.getByText(/Read-only access/)).toBeDefined();
  });
  it("does not offer pair force controls in a home registration editor", () => {
    render(
      <RelayConstraintsEditor
        value={emptyConstraints()}
        catalog={[]}
        groups={[]}
        scope="home"
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByText(
        "Force native relay (disable direct ICE and TURN paths)",
      ),
    ).toBeNull();
    expect(
      screen.getByText(/Only pair rules force native relay/),
    ).toBeDefined();
  });
});
