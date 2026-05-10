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

async function mockMemoryUsers(page: import("@playwright/test").Page) {
  await page.route(
    (url) => new URL(url).pathname === "/api/memory",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: [
            { id: "user-1", label: "Test User 1" },
            { id: "user-x", label: "Empty User" },
          ],
          timeline: [],
          policies: {},
        }),
      });
    },
  );
}

const SAMPLE_FACTS = {
  count: 2,
  items: [
    {
      id: "fact-1",
      user_id: "user-1",
      app_name: "negentropy",
      fact_type: "preference",
      key: "preferred_language",
      value: { name: "TypeScript" },
      confidence: 0.95,
      importance_score: 0.5,
      valid_from: "2026-05-01T00:00:00Z",
      valid_until: null,
      created_at: "2026-05-01T00:00:00Z",
    },
    {
      id: "fact-2",
      user_id: "user-1",
      app_name: "negentropy",
      fact_type: "knowledge",
      key: "api_design",
      value: { style: "REST" },
      confidence: 0.9,
      importance_score: 0.4,
      valid_from: "2026-05-02T00:00:00Z",
      valid_until: null,
      created_at: "2026-05-02T00:00:00Z",
    },
  ],
};

test("Facts 初始展示用户选择提示", async ({ page }) => {
  await mockAuthenticatedUser(page);
  await mockMemoryUsers(page);
  await page.goto("/memory/facts");
  await expect(page.locator("select")).toBeVisible();
  await expect(
    page.getByText("选择一个用户以查看其语义记忆 (Facts)。"),
  ).toBeVisible();
});

test("Facts 加载列表展示 Key/Type/Confidence", async ({ page }) => {
  await mockAuthenticatedUser(page);
  await mockMemoryUsers(page);
  await page.route("**/api/memory/facts**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SAMPLE_FACTS),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/memory/facts");
  await page.locator("select").selectOption("user-1");

  await expect(page.getByText("preferred_language")).toBeVisible();
  await expect(page.getByText("api_design")).toBeVisible();
  await expect(page.getByText("preference").first()).toBeVisible();
  await expect(page.getByText("knowledge").first()).toBeVisible();
  await expect(page.getByRole("progressbar").first()).toBeVisible();
});

test("Facts 搜索框过滤结果", async ({ page }) => {
  await mockAuthenticatedUser(page);
  await mockMemoryUsers(page);
  let searchCalled = false;
  await page.route("**/api/memory/facts/search", async (route) => {
    searchCalled = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: 1, items: [SAMPLE_FACTS.items[0]] }),
    });
  });
  await page.route("**/api/memory/facts*", async (route) => {
    if (route.request().url().includes("/search")) return;
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SAMPLE_FACTS),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/memory/facts");
  await page.locator("select").selectOption("user-1");
  await expect(page.getByText("api_design")).toBeVisible();

  await page.getByPlaceholder("Search facts...").fill("language");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("preferred_language")).toBeVisible();
  expect(searchCalled).toBe(true);
});

test("Facts History 模态展示 dialog ARIA + Esc 关闭", async ({ page }) => {
  await mockAuthenticatedUser(page);
  await mockMemoryUsers(page);
  await page.route("**/api/memory/facts**", async (route) => {
    const url = route.request().url();
    if (url.includes("/history")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          count: 1,
          items: [
            {
              id: "fact-1",
              user_id: "user-1",
              app_name: "negentropy",
              key: "preferred_language",
              value: { name: "TypeScript" },
              fact_type: "preference",
              confidence: 0.95,
              status: "active",
              superseded_by: null,
              valid_from: "2026-05-01T00:00:00Z",
              valid_until: null,
              created_at: "2026-05-01T00:00:00Z",
            },
          ],
        }),
      });
      return;
    }
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SAMPLE_FACTS),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/memory/facts");
  await page.locator("select").selectOption("user-1");
  await expect(page.getByText("preferred_language")).toBeVisible();

  await page.getByRole("button", { name: "History" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Fact Version History" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByText("active")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("Facts 空结果展示 No facts found", async ({ page }) => {
  await mockAuthenticatedUser(page);
  await mockMemoryUsers(page);
  await page.route("**/api/memory/facts**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: 0, items: [] }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/memory/facts");
  await page.locator("select").selectOption("user-x");

  await expect(page.getByText("No facts found for this user.")).toBeVisible();
});
