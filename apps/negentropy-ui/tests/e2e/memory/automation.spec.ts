import { expect, test } from "@playwright/test";

async function mockAuthAs(
  page: import("@playwright/test").Page,
  roles: string[],
) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          userId: "google:test-user",
          email: "user@example.com",
          name: "Test User",
          roles,
        },
      }),
    });
  });
}

const SNAPSHOT_DEGRADED = {
  capabilities: {
    pg_cron_installed: false,
    pg_cron_available: false,
    management_mode: "backend-managed",
    degraded_reasons: ["pg_cron_not_installed", "function_drifted"],
  },
  config: {
    retention: {
      decay_lambda: 0.1,
      low_retention_threshold: 0.1,
      min_age_days: 7,
      auto_cleanup_enabled: false,
      cleanup_schedule: "0 2 * * *",
    },
    consolidation: {
      enabled: false,
      schedule: "0 * * * *",
      lookback_interval: "1 hour",
    },
    context_assembler: {
      max_tokens: 4000,
      memory_ratio: 0.3,
      history_ratio: 0.5,
    },
    reweight_relevance: {
      enabled: true,
      schedule: "0 */6 * * *",
    },
  },
  processes: [
    {
      key: "retention_cleanup",
      label: "Retention Cleanup",
      description: "基于艾宾浩斯遗忘曲线清理低价值记忆。",
      config: {},
      job: {
        job_key: "cleanup_memories",
        process_label: "Ebbinghaus Cleanup",
        function_name: "cleanup_low_value_memories",
        enabled: false,
        status: "disabled",
        job_id: null,
        schedule: "0 2 * * *",
        command: "SELECT negentropy.cleanup_low_value_memories(0.1, 7, 0.1)",
        active: false,
      },
      functions: [],
    },
  ],
  functions: [],
  jobs: [
    {
      job_key: "cleanup_memories",
      process_label: "Ebbinghaus Cleanup",
      function_name: "cleanup_low_value_memories",
      enabled: false,
      status: "disabled",
      job_id: null,
      schedule: "0 2 * * *",
      command: "SELECT negentropy.cleanup_low_value_memories(0.1, 7, 0.1)",
      active: false,
    },
  ],
  health: { status: "degraded" },
};

async function mockAutomationSnapshot(
  page: import("@playwright/test").Page,
  snapshot = SNAPSHOT_DEGRADED,
) {
  // 路由匹配：Playwright 后注册的 route 优先匹配，分支需主动 `route.fallback()`
  // 才会把请求转交下一个 handler；否则请求挂起导致 UI 永远 Loading。
  await page.route("**/api/memory/automation/logs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });
  await page.route("**/api/memory/automation**", async (route) => {
    const url = route.request().url();
    if (url.includes("/logs")) return route.fallback();
    if (url.includes("/jobs/")) return route.continue();
    if (url.includes("/config")) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(snapshot),
    });
  });
}

test("Automation 非 admin 角色显示仅管理员提示", async ({ page }) => {
  await mockAuthAs(page, []);
  await page.goto("/memory/automation");
  await expect(page.getByRole("heading", { name: "仅管理员可访问" })).toBeVisible();
});

test("Automation admin 视图展示 capabilities + degraded + jobs readonly", async ({ page }) => {
  await mockAuthAs(page, ["admin"]);
  await mockAutomationSnapshot(page);

  await page.goto("/memory/automation");
  await expect(page.getByRole("heading", { name: "系统能力" })).toBeVisible();
  // 等到 snapshot 加载完成（management_mode 由 "-" → "backend-managed"）
  await expect(page.getByText("backend-managed")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("missing", { exact: true })).toBeVisible();
  await expect(page.getByText("degraded", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("pg_cron_not_installed / function_drifted"),
  ).toBeVisible();
  await expect(
    page.getByText("当前 `pg_cron` 不可用，调度相关操作已降级为只读；配置和函数状态仍可查看与保存。"),
  ).toBeVisible();

  // pg_cron 不可用时，cleanup job 的写按钮应禁用（启用/重建/手动触发）
  await expect(page.getByRole("button", { name: "启用" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "重建" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "手动触发" })).toBeDisabled();
});

test("Automation 保存配置触发 POST /api/memory/automation/config", async ({ page }) => {
  await mockAuthAs(page, ["admin"]);
  await mockAutomationSnapshot(page);

  let postCalled = false;
  await page.route("**/api/memory/automation/config", async (route) => {
    if (route.request().method() === "POST") {
      postCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SNAPSHOT_DEGRADED),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/memory/automation");
  await expect(page.getByRole("button", { name: "保存并同步" })).toBeVisible();
  await page.getByRole("button", { name: "保存并同步" }).click();
  await expect.poll(() => postCalled, { timeout: 5_000 }).toBeTruthy();
});
