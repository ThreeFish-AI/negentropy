import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "negentropy:activity-log";
const NOW = 1_777_879_000_000;

const SAMPLE_ENTRIES = [
  {
    id: "a1",
    level: "success",
    message: "Memory saved",
    description: "Saved successfully",
    timestamp: NOW - 60_000,
  },
  {
    id: "a2",
    level: "error",
    message: "Connection failed",
    description: "fetch error",
    timestamp: NOW - 30_000,
  },
  { id: "a3", level: "info", message: "Page loaded", timestamp: NOW - 10_000 },
  { id: "a4", level: "warning", message: "Cache stale", timestamp: NOW - 5_000 },
];

async function mockAuthenticatedUser(page: Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          userId: "google:test-user",
          email: "test@example.com",
          name: "Test User",
          roles: ["user"],
        },
      }),
    });
  });
}

/**
 * 屏蔽 Dashboard 加载期间的所有 scheduler / interface / admin 请求，
 * 让页面快速进入稳定态，避免 ActivityLogPanel 断言被加载态噪音遮蔽。
 */
async function mockDashboardDependencies(page: Page) {
  await page.route("**/api/scheduler/kpis*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        window: "24h",
        total_tasks: 0,
        enabled_tasks: 0,
        runs: 0,
        success: 0,
        failed: 0,
        running: 0,
        success_rate: 0,
        avg_latency_ms: 0,
      }),
    });
  });

  await page.route("**/api/scheduler/tasks*", async (route) => {
    const url = route.request().url();
    if (/\/api\/scheduler\/tasks\/[a-f0-9-]+/.test(url) && !url.endsWith("/tasks")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], next_cursor: null }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], next_cursor: null }),
    });
  });

  await page.route("**/api/scheduler/executions*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], next_cursor: null }),
    });
  });

  await page.route("**/api/scheduler/stats*", async (route) => {
    const groupBy = new URL(route.request().url()).searchParams.get("group_by") ?? "role";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ group_by: groupBy, window: "24h", buckets: [] }),
    });
  });

  await page.route("**/api/scheduler/stream*", async (route) => {
    await route.abort("connectionfailed");
  });

  await page.route("**/api/interface/subagents", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
}

async function seedActivityEntries(page: Page, entries: unknown[]) {
  // 用 init script 在页面执行任何脚本前注入 localStorage，避免与 useActivityLog 初次读取竞态。
  await page.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key as string, value as string);
      } catch {
        // ignore
      }
    },
    [STORAGE_KEY, JSON.stringify(entries)],
  );
}

test.describe("Dashboard Activity 面板", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockDashboardDependencies(page);
  });

  test("空状态展示 No activity recorded yet", async ({ page }) => {
    await seedActivityEntries(page, []);
    await page.goto("/dashboard");

    const panel = page.getByTestId("activity-log-panel");
    await expect(panel).toBeVisible();
    await expect(
      panel.getByText(
        "No activity recorded yet. Toast notifications will appear here as they occur across the platform.",
      ),
    ).toBeVisible();
  });

  test("Level 筛选只展示对应级别", async ({ page }) => {
    await seedActivityEntries(page, SAMPLE_ENTRIES);
    await page.goto("/dashboard");

    const panel = page.getByTestId("activity-log-panel");
    await expect(panel.getByText("Memory saved")).toBeVisible();
    await expect(panel.getByText("Connection failed")).toBeVisible();

    await panel.getByRole("button", { name: "Error" }).click();
    await expect(panel.getByText("Connection failed")).toBeVisible();
    await expect(panel.getByText("Memory saved")).not.toBeVisible();
    await expect(panel.getByText("1 / 4 entries")).toBeVisible();
  });

  test("Clear All 清空 entries", async ({ page }) => {
    await seedActivityEntries(page, SAMPLE_ENTRIES);
    await page.goto("/dashboard");

    const panel = page.getByTestId("activity-log-panel");
    await expect(panel.getByText("Memory saved")).toBeVisible();

    page.once("dialog", (dlg) => dlg.accept());
    await panel.getByRole("button", { name: "Clear All" }).click();
    await expect(panel.getByText("No activity recorded yet.")).toBeVisible();
  });

  test("损坏 localStorage 时降级为空态", async ({ page }) => {
    await page.addInitScript(([key]) => {
      try {
        localStorage.setItem(key as string, "{not valid json[[[");
      } catch {
        // ignore
      }
    }, [STORAGE_KEY]);

    await page.goto("/dashboard");

    const panel = page.getByTestId("activity-log-panel");
    await expect(
      panel.getByText("No activity recorded yet.", { exact: false }),
    ).toBeVisible();
  });
});
