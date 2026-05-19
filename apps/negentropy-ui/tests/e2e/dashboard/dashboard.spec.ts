import { expect, test } from "@playwright/test";

type PageHandle = Parameters<typeof test>[0]["page"];

async function mockAuthenticatedUser(page: PageHandle) {
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

async function mockSchedulerAPIs(page: PageHandle, opts?: { failedRuns?: number }) {
  const failedRuns = opts?.failedRuns ?? 1;

  await page.route("**/api/scheduler/kpis*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        window: "24h",
        total_tasks: 6,
        enabled_tasks: 6,
        runs: 24,
        success: 24 - failedRuns,
        failed: failedRuns,
        running: 0,
        success_rate: (24 - failedRuns) / 24,
        avg_latency_ms: 142.5,
      }),
    });
  });

  const tasks = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      key: "pipeline_watchdog",
      handler_kind: "pipeline_watchdog",
      trigger_type: "interval",
      interval_seconds: 60,
      cron_expr: null,
      enabled: true,
      owner_id: null,
      participant_id: null,
      agent_id: null,
      role: "sentinel",
      scenario: "kg_kb_maintenance",
      category: "maintenance",
      display_name: "KB/KG Pipeline Watchdog",
      description: "long-tail pipeline runs sweeper",
      last_fire_at: "2026-05-17T09:00:00Z",
      next_fire_at: "2026-05-17T09:01:00Z",
      last_status: "ok",
      last_error: null,
      consecutive_failures: 0,
      total_runs: 12,
      max_concurrency: 1,
      token_budget: null,
      backoff_until: null,
      created_at: "2026-05-16T00:00:00Z",
      updated_at: "2026-05-17T09:00:00Z",
      payload: {},
      recent: ["ok", "ok", "ok"],
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      key: "agent_inspection_demo",
      handler_kind: "agent_inspection",
      trigger_type: "interval",
      interval_seconds: 300,
      cron_expr: null,
      enabled: true,
      owner_id: null,
      participant_id: null,
      agent_id: null,
      role: "supervisor",
      scenario: "agent_health",
      category: "cognitive",
      display_name: "Faculty Health Inspector",
      description: "每 5min 检查 Faculties 模块",
      last_fire_at: "2026-05-17T08:55:00Z",
      next_fire_at: "2026-05-17T09:00:00Z",
      last_status: "ok",
      last_error: null,
      consecutive_failures: 0,
      total_runs: 8,
      max_concurrency: 1,
      token_budget: null,
      backoff_until: null,
      created_at: "2026-05-16T00:00:00Z",
      updated_at: "2026-05-17T08:55:00Z",
      payload: { inspection_type: "faculty_health" },
      recent: ["ok", "ok", "ok"],
    },
  ];

  await page.route("**/api/scheduler/tasks*", async (route) => {
    const url = route.request().url();
    // /api/scheduler/tasks/{id} 或 /api/scheduler/tasks/{id}/run 走详情路径，下面单独 mock
    if (/\/api\/scheduler\/tasks\/[a-f0-9-]+/.test(url) && !url.endsWith("/tasks")) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: tasks, next_cursor: null }),
    });
  });

  await page.route("**/api/scheduler/tasks/*", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/run")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, execution_id: "99999999-9999-9999-9999-999999999999" }),
      });
      return;
    }
    if (url.endsWith("/toggle")) {
      const body = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, enabled: body.enabled }),
      });
      return;
    }
    // GET /tasks/{id}
    const taskId = url.split("/").pop()!.split("?")[0];
    const found = tasks.find((t) => t.id === taskId) ?? tasks[0];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...found,
        recent_executions: [
          {
            id: "exec-1",
            task_id: found.id,
            task_key: found.key,
            handler_kind: found.handler_kind,
            role: found.role,
            scenario: found.scenario,
            category: found.category,
            started_at: "2026-05-17T09:00:00Z",
            finished_at: "2026-05-17T09:00:00Z",
            status: "ok",
            duration_ms: 25,
            tokens_used: null,
            output_summary: "demo execution",
            error: null,
            fire_reason: "tick",
            skill_id: null,
            skill_schedule_id: null,
            memory_id: null,
            pipeline_run_id: null,
            thread_id: null,
          },
        ],
      }),
    });
  });

  await page.route("**/api/scheduler/executions*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "exec-1",
            task_id: "11111111-1111-1111-1111-111111111111",
            task_key: "pipeline_watchdog",
            handler_kind: "pipeline_watchdog",
            role: "sentinel",
            scenario: "kg_kb_maintenance",
            category: "maintenance",
            started_at: "2026-05-17T09:00:05Z",
            finished_at: "2026-05-17T09:00:05Z",
            status: "ok",
            duration_ms: 12,
            tokens_used: null,
            output_summary: "kb={} kg={}",
            error: null,
            fire_reason: "tick",
            skill_id: null,
            skill_schedule_id: null,
            memory_id: null,
            pipeline_run_id: null,
            thread_id: null,
          },
        ],
        next_cursor: null,
      }),
    });
  });

  await page.route("**/api/scheduler/stats*", async (route) => {
    const url = new URL(route.request().url());
    const groupBy = url.searchParams.get("group_by") ?? "role";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        group_by: groupBy,
        window: "24h",
        buckets: [
          { key: "sentinel", label: "sentinel", runs: 12, success: 12, failed: 0, success_rate: 1, avg_ms: 14 },
          { key: "supervisor", label: "supervisor", runs: 8, success: 7, failed: 1, success_rate: 0.875, avg_ms: 80 },
        ],
      }),
    });
  });

  // SSE：直接 abort，让前端走兜底轮询（避免长连影响测试）
  await page.route("**/api/scheduler/stream*", async (route) => {
    await route.abort("connectionfailed");
  });

  // FilterBar 的 Agent 下拉走 /api/interface/subagents 取一主五翼
  await page.route("**/api/interface/subagents", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          owner_id: "google:test-user",
          visibility: "public",
          name: "NegentropyEngine",
          display_name: "Negentropy Engine",
          description: "Root agent",
          agent_type: "llm_agent",
          system_prompt: null,
          model: null,
          config: {},
          adk_config: { kind: "root" },
          skills: [],
          tools: [],
          source: "negentropy_builtin",
          is_builtin: true,
          is_enabled: true,
          kind: "root",
        },
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          owner_id: "google:test-user",
          visibility: "public",
          name: "PerceptionFaculty",
          display_name: "Perception Faculty",
          description: "wing 1",
          agent_type: "llm_agent",
          system_prompt: null,
          model: null,
          config: {},
          adk_config: { kind: "subagent" },
          skills: [],
          tools: [],
          source: "negentropy_builtin",
          is_builtin: true,
          is_enabled: true,
          kind: "subagent",
        },
      ]),
    });
  });
}

test.describe("Dashboard 子页面", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockSchedulerAPIs(page);
  });

  test("根路径自动重定向到 /studio", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/studio/);
  });

  test("Dashboard 页面显示 KPI、任务表、执行时间线与图表", async ({ page }) => {
    await page.goto("/dashboard");

    // KPI 卡片
    await expect(page.getByText("Tasks", { exact: true })).toBeVisible();
    await expect(page.getByText("Success rate")).toBeVisible();
    await expect(page.getByText("Avg latency")).toBeVisible();

    // 任务表两条
    await expect(page.getByText("KB/KG Pipeline Watchdog")).toBeVisible();
    await expect(page.getByText("Faculty Health Inspector")).toBeVisible();

    // 时间线
    await expect(page.getByText("Execution Timeline")).toBeVisible();
    await expect(page.getByText("kb={} kg={}")).toBeVisible();

    // 多维图表 card 标题
    await expect(page.getByText("Role × Success / Failed")).toBeVisible();
    await expect(page.getByText("Scenario × Runs")).toBeVisible();
    await expect(page.getByText("Owner × Runs")).toBeVisible();
  });

  test("HomeNav Tab 可在 Studio 与 Dashboard 间切换", async ({ page }) => {
    await page.goto("/dashboard");

    // Dashboard 状态高亮
    const dashTab = page.getByRole("link", { name: "Dashboard" });
    await expect(dashTab).toBeVisible();
    await expect(dashTab).toHaveClass(/bg-foreground/);

    // 切到 Studio
    await page.getByRole("link", { name: "Studio" }).click();
    await expect(page).toHaveURL(/\/studio/);
  });

  test("点击任务行打开 Detail Drawer 并可手动 Run Now", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByText("Faculty Health Inspector").click();

    // Drawer 内容（精确匹配避免命中"Close drawer" backdrop button）
    await expect(page.getByRole("button", { name: "Close", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Now" })).toBeVisible();
    await expect(page.getByText("Payload").first()).toBeVisible();

    await page.getByRole("button", { name: "Run Now" }).click();

    // run 完成后 Drawer 仍然可见（不强求关闭，但应没崩）
    await expect(page.getByRole("button", { name: "Close", exact: true })).toBeVisible();
  });
});
