import { expect, test } from "@playwright/test";

async function mockAuthenticatedUser(page: import("@playwright/test").Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          userId: "google:test-admin",
          email: "admin@example.com",
          name: "Test Admin",
          roles: ["admin"],
        },
      }),
    });
  });
}

const TIMELINE_PAYLOAD = {
  users: [{ id: "user-1", label: "user-1 (1)" }],
  timeline: [
    {
      id: "mem-1",
      user_id: "user-1",
      app_name: "negentropy",
      memory_type: "episodic",
      content: "Standup at 10am Mon/Wed",
      retention_score: 0.84,
      importance_score: 0.5,
      access_count: 0,
      created_at: "2026-05-01T10:00:00Z",
      metadata: {},
    },
  ],
  policies: { decay_lambda: 0.1 },
};

const AUDIT_HISTORY = {
  count: 1,
  items: [
    {
      memory_id: "old-mem-1",
      decision: "retain",
      version: 1,
      note: "earlier audit",
      created_at: "2026-04-30T10:00:00Z",
    },
  ],
};

async function setupAuditRoutes(page: import("@playwright/test").Page) {
  await page.route("**/api/memory*", async (route) => {
    const url = route.request().url();
    if (url.includes("/api/memory/audit")) return route.continue();
    if (url.includes("/api/memory/dashboard")) return route.continue();
    if (url.includes("/api/memory/conflicts")) return route.continue();
    if (url.includes("/api/memory/facts")) return route.continue();
    if (url.includes("/api/memory/automation")) return route.continue();
    if (url.includes("/api/memory/retrieval")) return route.continue();
    if (url.includes("/api/memory/search")) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(TIMELINE_PAYLOAD),
    });
  });
  await page.route("**/api/memory/audit/history**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(AUDIT_HISTORY),
    });
  });
}

test("Audit 选择用户后展示 timeline + history", async ({ page }) => {
  await mockAuthenticatedUser(page);
  await setupAuditRoutes(page);

  await page.goto("/memory/audit");
  await expect(page.getByRole("button", { name: "user-1 (1)" })).toBeVisible();
  await page.getByRole("button", { name: "user-1 (1)" }).click();

  await expect(page.getByText("Standup at 10am Mon/Wed")).toBeVisible();
  await expect(page.getByText("earlier audit")).toBeVisible();
});

test("Audit 选择 retain 后 Submit 计数变 1", async ({ page }) => {
  await mockAuthenticatedUser(page);
  await setupAuditRoutes(page);

  await page.goto("/memory/audit");
  await page.getByRole("button", { name: "user-1 (1)" }).click();
  await expect(page.getByText("Standup at 10am Mon/Wed")).toBeVisible();

  await expect(page.getByRole("button", { name: /Submit \(0\)/ })).toBeDisabled();
  await page.getByRole("button", { name: "retain" }).click();
  await expect(page.getByRole("button", { name: /Submit \(1\)/ })).toBeEnabled();
});

test("Audit 提交 POST /api/memory/audit 含 decisions + idempotency_key", async ({ page }) => {
  await mockAuthenticatedUser(page);
  await setupAuditRoutes(page);

  let postedBody: Record<string, unknown> | null = null;
  await page.route("**/api/memory/audit", async (route) => {
    if (route.request().method() === "POST") {
      postedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          audits: [
            {
              memory_id: "mem-1",
              decision: "retain",
              version: 2,
              note: null,
              created_at: "2026-05-01T11:00:00Z",
            },
          ],
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/memory/audit");
  await page.getByRole("button", { name: "user-1 (1)" }).click();
  await page.getByRole("button", { name: "retain" }).click();
  await page.getByRole("button", { name: /Submit \(1\)/ }).click();

  await expect.poll(() => postedBody !== null, { timeout: 5_000 }).toBeTruthy();
  expect(postedBody).toMatchObject({
    user_id: "user-1",
    decisions: { "mem-1": "retain" },
  });
  expect(typeof (postedBody as { idempotency_key?: string })?.idempotency_key).toBe(
    "string",
  );
});

test("Audit 无 decision 时 Submit 禁用", async ({ page }) => {
  await mockAuthenticatedUser(page);
  await setupAuditRoutes(page);

  await page.goto("/memory/audit");
  await page.getByRole("button", { name: "user-1 (1)" }).click();
  await expect(page.getByText("Standup at 10am Mon/Wed")).toBeVisible();

  await expect(page.getByRole("button", { name: /Submit \(0\)/ })).toBeDisabled();
});
