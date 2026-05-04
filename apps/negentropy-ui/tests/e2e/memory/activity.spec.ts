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

const STORAGE_KEY = "negentropy:activity-log";

const NOW = 1_777_879_000_000; // 固定基准毫秒时间戳，避免本地化差异

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
  {
    id: "a3",
    level: "info",
    message: "Page loaded",
    timestamp: NOW - 10_000,
  },
  {
    id: "a4",
    level: "warning",
    message: "Cache stale",
    timestamp: NOW - 5_000,
  },
];

async function seedActivityEntries(
  page: import("@playwright/test").Page,
  entries: unknown[],
) {
  // 使用 init script 让 localStorage 在页面开始执行任何脚本前就有数据，
  // 避免与 useActivityLog 的初次读取竞态。
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

test("Activity 空状态展示 No activity recorded yet", async ({ page }) => {
  await mockAuthenticatedUser(page);
  // 显式清空 localStorage（避免与之前测试串扰）
  await seedActivityEntries(page, []);

  await page.goto("/memory/activity");
  await expect(
    page.getByText(
      "No activity recorded yet. Toast notifications will appear here as they occur across the platform.",
    ),
  ).toBeVisible();
});

test("Activity Level 筛选只展示对应级别", async ({ page }) => {
  await mockAuthenticatedUser(page);
  await seedActivityEntries(page, SAMPLE_ENTRIES);

  await page.goto("/memory/activity");
  // 4 entries 全显示
  await expect(page.getByText("Memory saved")).toBeVisible();
  await expect(page.getByText("Connection failed")).toBeVisible();

  // 点击 Error filter，只剩 1 条
  await page.getByRole("button", { name: "Error" }).click();
  await expect(page.getByText("Connection failed")).toBeVisible();
  await expect(page.getByText("Memory saved")).not.toBeVisible();
  await expect(page.getByText("1 / 4 entries")).toBeVisible();
});

test("Activity Clear All 清空 entries", async ({ page }) => {
  await mockAuthenticatedUser(page);
  await seedActivityEntries(page, SAMPLE_ENTRIES);

  await page.goto("/memory/activity");
  await expect(page.getByText("Memory saved")).toBeVisible();

  page.once("dialog", (dlg) => dlg.accept());
  await page.getByRole("button", { name: "Clear All" }).click();
  await expect(
    page.getByText("No activity recorded yet."),
  ).toBeVisible();
});

test("Activity 损坏 localStorage 时不白屏", async ({ page }) => {
  await mockAuthenticatedUser(page);
  await page.addInitScript(([key]) => {
    try {
      localStorage.setItem(key as string, "{not valid json[[[");
    } catch {
      // ignore
    }
  }, [STORAGE_KEY]);

  await page.goto("/memory/activity");
  // 应当 fallback 到 empty state，而非崩溃
  await expect(
    page.getByText("No activity recorded yet.", { exact: false }),
  ).toBeVisible();
});
