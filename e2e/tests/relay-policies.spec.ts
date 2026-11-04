import type { Locator, Page, Request, Response } from "@playwright/test";
import type { RelayPolicyPreview } from "../../src/interfaces/RelayPolicy";
import { navigateTo } from "../helpers/auth";
import { expect, test } from "../helpers/fixtures";
import {
  pairResource,
  relayConstraints,
  relayTestApi,
} from "../helpers/relay-policies";
import { generateRandomName } from "../helpers/utils";

const configurationPath = "/api/relay-policies/configuration";
const selectorId = (label: string) =>
  `relay-select-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
const apiResponse = (path: string, method: string) => (response: Response) =>
  new URL(response.url()).pathname === path &&
  response.request().method() === method;

async function sandbox(page: Page, count = 2) {
  const api = await relayTestApi(page);
  test.skip(
    !(await api.supported()),
    "This Management version does not implement relay policy administration.",
  );
  const catalog = await api.catalog();
  const relays = catalog.entries.filter((r) => r.active && !r.legacy);
  expect(
    relays.length,
    "Publish at least two approved active concrete relay instances in the disposable E2E backend.",
  ).toBeGreaterThanOrEqual(2);
  const candidates = await api.peers();
  const peers: typeof candidates = [];
  // Select an authorized star so every policy and broader preview uses real ACL pairs.
  for (const candidate of candidates) {
    const response = await api.request(
      "GET",
      `/peers/${encodeURIComponent(candidate.id)}/accessible-peers`,
    );
    expect(response.ok(), "Authorized peer lookup must succeed").toBeTruthy();
    const accessible = ((await response.json()) as typeof candidates).filter(
      (peer) => peer.id !== candidate.id,
    );
    if (accessible.length >= count - 1) {
      peers.push(candidate, ...accessible.slice(0, count - 1));
      break;
    }
  }
  expect(
    peers.length,
    `Register ${count} relay-policy-capable disposable peers and authorize the first peer to each other peer. Do not start a host client from this suite.`,
  ).toBeGreaterThanOrEqual(count);
  return { api, peers, relays, prefix: generateRandomName("e2e-relay-") };
}

async function openEditor(page: Page, query = "") {
  await navigateTo(page, `/relays${query}`);
  await expect(page.getByTestId("relay-policy-editor")).toBeVisible();
}

async function choose(
  scope: Locator,
  label: string,
  option: string | RegExp,
  keyboard = false,
) {
  const selector = scope.getByTestId(selectorId(label));
  await expect(selector).toBeVisible();
  const choice = selector.getByRole("button", { name: option, exact: true });
  if (keyboard) {
    await choice.focus();
    await choice.press("Space");
  } else {
    await choice.click();
  }
  await expect(choice.getByRole("checkbox")).toHaveAttribute(
    "data-state",
    "checked",
  );
}

async function preview(page: Page) {
  const response = page.waitForResponse(
    apiResponse("/api/relay-policies/preview", "POST"),
  );
  await page.getByTestId("relay-preview").click();
  const result = await response;
  expect(
    result.status(),
    "The real backend must validate the proposed scope",
  ).toBe(200);
  await expect(page.getByTestId("relay-impact-preview")).toBeVisible();
  return (await result.json()) as RelayPolicyPreview;
}

async function savePreview(page: Page) {
  const response = page.waitForResponse(apiResponse(configurationPath, "PUT"));
  await page.getByTestId("relay-confirm-save").click();
  const result = await response;
  expect(
    result.status(),
    "A compatible, previewed configuration must persist",
  ).toBe(200);
  await expect(page.getByTestId("relay-impact-preview")).not.toBeVisible();
}

async function inspectPair(
  page: Page,
  local: string,
  remote: { name: string; ip: string },
) {
  await navigateTo(page, `/peer?id=${encodeURIComponent(local)}`);
  await page.getByTestId("peer-relays-tab").click();
  await expect(page.getByTestId("peer-relays-section")).toBeVisible();
  await page.getByTestId("relay-remote-peer").click();
  await page
    .getByRole("option", { name: `${remote.name} (${remote.ip})`, exact: true })
    .click();
  await expect(page.getByTestId("relay-pair-application")).toBeVisible();
  return page.getByTestId("relay-pair-status");
}

test.describe.serial("Relay administration and observed paths @relays", () => {
  test("creates a relay group, home profile and symmetric pair through preview", async ({
    dashboardAsOwner: page,
  }) => {
    const env = await sandbox(page);
    const [a, b] = env.peers;
    const [relayA, relayB] = env.relays;
    const groupName = `${env.prefix}-group`;
    const homeName = `${env.prefix}-home`;
    const pairName = `${env.prefix}-pair`;
    try {
      await openEditor(page);
      await page.getByTestId("relay-add-group").click();
      const group = page.getByTestId("relay-group-row").last();
      await group.getByTestId("relay-resource-name").fill(groupName);
      await choose(group, "Group relays", relayA.id);
      await choose(group, "Group relays", relayB.id, true);

      await page.getByTestId("relay-add-profile").click();
      const home = page.getByTestId("relay-profile-row").last();
      await home.getByTestId("relay-resource-name").fill(homeName);
      await home
        .getByRole("checkbox", { name: "Enabled", exact: true })
        .check();
      await choose(home, "Home targets peers", `${a.name} (${a.ip})`);
      await home
        .getByRole("checkbox", { name: "Allow all approved active relays" })
        .uncheck();
      await choose(home, "Allow relay groups", groupName);

      await page.getByTestId("relay-add-policy").click();
      const pair = page.getByTestId("relay-policy-row").last();
      await pair.getByTestId("relay-resource-name").fill(pairName);
      await pair
        .getByRole("checkbox", { name: "Enabled", exact: true })
        .check();
      await choose(pair, "Source peers", `${a.name} (${a.ip})`);
      await choose(pair, "Destination peers", `${b.name} (${b.ip})`);
      await pair
        .getByRole("checkbox", { name: "Allow all approved active relays" })
        .uncheck();
      await choose(pair, "Allow relay groups", groupName);
      const impact = await preview(page);
      expect(
        impact.home.some((target) => target.peer_id === a.id),
      ).toBeTruthy();
      expect(
        impact.pairs.some(
          (target) =>
            [target.peer_a, target.peer_b].includes(a.id) &&
            [target.peer_a, target.peer_b].includes(b.id),
        ),
      ).toBeTruthy();
      expect(
        impact.home.find((target) => target.peer_id === a.id)?.unsupported,
        "Use relay-policy-capable registered peers in the E2E backend",
      ).toBe(false);
      expect(
        impact.pairs.find(
          (target) =>
            [target.peer_a, target.peer_b].includes(a.id) &&
            [target.peer_a, target.peer_b].includes(b.id),
        )?.unsupported,
        "Both endpoints must implement relay policy enforcement",
      ).toBe(false);
      await savePreview(page);

      const persisted = await env.api.configuration();
      const createdGroup = persisted.groups.find((r) => r.name === groupName);
      expect(createdGroup?.relay_ids).toEqual([relayA.id, relayB.id]);
      expect(
        persisted.home_profiles.find((r) => r.name === homeName)?.selector
          .peer_ids,
      ).toEqual([a.id]);
      expect(
        persisted.pair_policies.find((r) => r.name === pairName)?.constraints
          .allow?.group_ids,
      ).toEqual([createdGroup?.id]);
      const forward = await env.api.effective(a.id, b.id);
      const reverse = await env.api.effective(b.id, a.id);
      expect(
        reverse.policy?.digest,
        "Pair orientation must not change effective instructions",
      ).toBe(forward.policy?.digest);
      expect(forward.policy?.digest).toBeTruthy();
      const forwardView = await inspectPair(page, a.id, b);
      await expect(
        forwardView.getByTestId("relay-policy-detail"),
      ).toContainText(`Desired revision ${persisted.revision}`);
      const reverseView = await inspectPair(page, b.id, a);
      await expect(
        reverseView.getByTestId("relay-policy-detail"),
      ).toContainText(`Desired revision ${persisted.revision}`);
      await expect(
        reverseView.getByTestId("relay-policy-detail"),
      ).toContainText(relayA.id);
      await expect(
        reverseView.getByTestId("relay-policy-detail"),
      ).toContainText(relayB.id);
    } finally {
      await env.api.cleanup(env.prefix);
    }
  });

  test("promotes B only after preview and saves the persistent order once", async ({
    dashboardAsOwner: page,
  }) => {
    const env = await sandbox(page);
    const [a, b] = env.peers;
    const ids = env.relays.slice(0, 2).map((relay) => relay.id);
    try {
      const seeded = await env.api.create(
        "relay-pair-policies",
        pairResource(`${env.prefix}-pair`, a.id, b.id, ids),
      );
      const policy = seeded.pair_policies.find(
        (r) => r.name === `${env.prefix}-pair`,
      )!;
      await openEditor(page, `?policy=${encodeURIComponent(policy.id)}`);
      const row = page
        .getByTestId("relay-policy-row")
        .filter({ hasText: policy.id });
      await row.getByTestId("relay-tier-up-2").click();
      const observedRequests: string[] = [];
      const onRequest = (request: Request) => {
        if (
          new URL(request.url()).pathname === configurationPath &&
          request.method() === "PUT"
        )
          observedRequests.push(request.postData() || "");
      };
      page.on("request", onRequest);
      try {
        const impact = await preview(page);
        expect(
          observedRequests,
          "Preview must not persist a transport preference",
        ).toHaveLength(0);
        expect(
          impact.pairs
            .find(
              (target) =>
                [target.peer_a, target.peer_b].includes(a.id) &&
                [target.peer_a, target.peer_b].includes(b.id),
            )
            ?.policy?.tiers[0].map((r) => r.id),
        ).toEqual([ids[1]]);
        await savePreview(page);
        expect(
          observedRequests,
          "One confirmation must issue exactly one configuration mutation",
        ).toHaveLength(1);
      } finally {
        page.off("request", onRequest);
      }
      const saved = await env.api.configuration();
      expect(
        saved.pair_policies.find((r) => r.id === policy.id)?.constraints
          .preferences,
      ).toEqual([
        { relay_ids: [ids[1]], group_ids: [] },
        { relay_ids: [ids[0]], group_ids: [] },
      ]);
    } finally {
      await env.api.cleanup(env.prefix);
    }
  });

  test("retains a stale draft when another administrator advances the revision", async ({
    dashboardAsOwner: page,
  }) => {
    const env = await sandbox(page);
    try {
      const seeded = await env.api.create("relay-groups", {
        id: "",
        name: `${env.prefix}-original`,
        revision: 0,
        relay_ids: [env.relays[0].id],
      });
      const group = seeded.groups.find(
        (r) => r.name === `${env.prefix}-original`,
      )!;
      await openEditor(page);
      const input = page
        .getByTestId("relay-group-row")
        .filter({ hasText: group.id })
        .getByTestId("relay-resource-name");
      await input.fill(`${env.prefix}-retained-draft`);
      await preview(page);
      await env.api.create("relay-groups", {
        id: "",
        name: `${env.prefix}-concurrent`,
        revision: 0,
        relay_ids: [env.relays[1].id],
      });
      const response = page.waitForResponse(
        apiResponse(configurationPath, "PUT"),
      );
      await page.getByTestId("relay-confirm-save").click();
      expect(
        (await response).status(),
        "A real stale CAS write must be rejected",
      ).toBe(409);
      await expect(page.getByTestId("relay-stale-draft")).toBeVisible();
      await expect(input).toHaveValue(`${env.prefix}-retained-draft`);
      const current = await env.api.configuration();
      expect(current.groups.find((r) => r.id === group.id)?.name).toBe(
        `${env.prefix}-original`,
      );
      await page.getByTestId("relay-reload").click();
      await expect(input).toHaveValue(`${env.prefix}-original`);
      await expect(page.getByTestId("relay-stale-draft")).not.toBeVisible();
    } finally {
      await env.api.cleanup(env.prefix);
    }
  });

  test("links inherited denial to its owning rule and previews its broader pair scope", async ({
    dashboardAsOwner: page,
  }) => {
    const env = await sandbox(page, 3);
    const [a, b, c] = env.peers;
    const ids = env.relays.slice(0, 2).map((relay) => relay.id);
    try {
      const broad = pairResource(`${env.prefix}-inherited`, a.id, b.id, ids);
      broad.destination.peer_ids.push(c.id);
      broad.priority = 10;
      broad.constraints = {
        ...relayConstraints(ids, [ids[0]]),
        preferences: [],
      };
      const seeded = await env.api.create("relay-pair-policies", broad);
      const inherited = seeded.pair_policies.find(
        (r) => r.name === broad.name,
      )!;
      await env.api.create(
        "relay-pair-policies",
        pairResource(`${env.prefix}-explicit`, a.id, b.id, ids),
      );
      const status = await inspectPair(page, a.id, b);
      await expect(status.getByTestId("relay-policy-detail")).toContainText(
        `Eliminated relays: ${ids[0]}`,
      );
      const owner = status
        .getByTestId("relay-policy-detail")
        .getByRole("link", {
          name: `Edit owning pair rule: ${inherited.id}`,
          exact: true,
        });
      await owner.click();
      await expect(page).toHaveURL(new RegExp(`policy=${inherited.id}`));
      const row = page
        .getByTestId("relay-policy-row")
        .filter({ hasText: inherited.id });
      await expect(row).toHaveAttribute("open", "");
      const impact = await preview(page);
      for (const remote of [b, c]) {
        expect(
          impact.pairs.some(
            (target) =>
              [target.peer_a, target.peer_b].includes(a.id) &&
              [target.peer_a, target.peer_b].includes(remote.id),
          ),
          "Owning-rule preview must include every authorized affected pair",
        ).toBeTruthy();
      }
      await expect(page.getByTestId("relay-impact-preview")).toContainText(
        c.id,
      );
      const effective = await env.api.effective(a.id, b.id);
      expect(
        effective.policy?.tiers.flat().map((r) => r.id),
        "An explicit preference cannot restore the inherited excluded relay",
      ).not.toContain(ids[0]);
    } finally {
      await env.api.cleanup(env.prefix);
    }
  });

  test("retries preferred relay without rewriting priority or exclusions", async ({
    dashboardAsOwner: page,
  }) => {
    const env = await sandbox(page);
    const [a, b] = env.peers;
    try {
      await env.api.create(
        "relay-pair-policies",
        pairResource(
          `${env.prefix}-retry`,
          a.id,
          b.id,
          env.relays.slice(0, 2).map((r) => r.id),
        ),
      );
      const before = await env.api.configuration();
      const effective = await env.api.effective(a.id, b.id);
      const status = await inspectPair(page, a.id, b);
      await status.getByTestId("relay-pair-retry").click();
      const result = page.waitForResponse(
        apiResponse("/api/relay-policies/retry-preferred", "POST"),
      );
      await page.getByTestId("relay-confirm-retry").click();
      const response = await result;
      expect(response.status()).toBe(200);
      const payload = response.request().postDataJSON();
      expect(payload).toEqual({
        peer_a: a.id,
        peer_b: b.id,
        expected_digest: effective.policy?.digest,
      });
      await expect(page.getByTestId("relay-pair-retry-feedback")).toContainText(
        "Waiting for fresh endpoint observations",
      );
      const after = await env.api.configuration();
      expect(
        after.pair_policies,
        "Retry must retain persistent constraints and preference order",
      ).toEqual(before.pair_policies);
      const next = await env.api.effective(a.id, b.id);
      expect(next.policy?.reselection_generation).toBeGreaterThan(
        effective.policy!.reselection_generation,
      );
    } finally {
      await env.api.cleanup(env.prefix);
    }
  });

  test("denies a regular user's mutation and direct administration route @test-env", async ({
    dashboardAsOwner: owner,
    dashboardAsUser: user,
  }) => {
    const ownerApi = await relayTestApi(owner);
    test.skip(
      !(await ownerApi.supported()),
      "Relay policy API is unavailable on this backend.",
    );
    const config = await ownerApi.configuration();
    const userApi = await relayTestApi(user);
    const forbidden = await userApi.request(
      "PUT",
      "/relay-policies/configuration",
      config,
    );
    expect(
      forbidden.status(),
      "Manager RBAC must reject an actual ordinary-user mutation",
    ).toBe(403);
    await navigateTo(user, "/relays");
    await expect(
      user.getByRole("heading", { name: /You don.t have access to/ }),
    ).toBeVisible();
    await expect(user.getByTestId("relay-policy-editor")).not.toBeVisible();
    await expect(user.getByTestId("relay-confirm-save")).not.toBeVisible();
    expect(
      (await ownerApi.configuration()).revision,
      "Denied mutation must not advance account revision",
    ).toBe(config.revision);
  });

  test("hides feature controls when Management returns the older-server feature response", async ({
    dashboardAsOwner: page,
  }) => {
    const api = await relayTestApi(page);
    const peers = await api.peers();
    const matcher = "**/api/relay-policies/configuration";
    await page.route(matcher, async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "Not found" }),
      });
    });
    try {
      await navigateTo(page, "/relays");
      await page.reload();
      await expect(page.getByTestId("relay-policy-editor")).not.toBeVisible();
      await expect(page.getByTestId("relay-add-policy")).not.toBeVisible();
      await expect(
        page.getByText(
          "Relay policy administration is unavailable on this Management version.",
        ),
      ).toBeVisible();
      await expect(
        page
          .getByTestId("left-navigation-item")
          .filter({ hasText: /^Relays$/ }),
      ).not.toBeVisible();
      if (peers[0]) {
        await navigateTo(page, `/peer?id=${encodeURIComponent(peers[0].id)}`);
        await expect(
          page.getByRole("tab", { name: "Overview", exact: true }),
        ).toBeVisible();
        await expect(page.getByTestId("peer-relays-tab")).not.toBeVisible();
      }
    } finally {
      await page.unroute(matcher);
    }
  });
});
