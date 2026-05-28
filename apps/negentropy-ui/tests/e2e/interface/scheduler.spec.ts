import { expect, test } from "@playwright/test";

type PageHandle = Parameters<typeof test>[0]["page"];

/* ------------------------------------------------------------------ */
/* Mock helpers                                                        */
/* ------------------------------------------------------------------ */

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

const MOCK_TASKS = [
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
    description: "收敛 cancelling/running 长尾状态的 KB/KG runs",
    last_fire_at: "2026-05-28T09:00:00Z",
    next_fire_at: "2026-05-28T09:01:00Z",
    last_status: "ok",
    last_error: null,
    consecutive_failures: 0,
    total_runs: 42,
    max_concurrency: 1,
    token_budget: null,
    backoff_until: null,
    created_at: "2026-05-16T00:00:00Z",
    updated_at: "2026-05-28T09:00:00Z",
    payload: {},
    recent: ["ok", "ok", "ok"],
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    key: "memory_cleanup",
    handler_kind: "memory_automation",
    trigger_type: "cron",
    interval_seconds: null,
    cron_expr: "0 2 * * *",
    enabled: true,
    owner_id: null,
    participant_id: null,
    agent_id: null,
    role: "sentinel",
    scenario: "memory_retention",
    category: "maintenance",
    display_name: "Ebbinghaus Cleanup",
    description: "基于艾宾浩斯遗忘曲线清理低价值记忆",
    last_fire_at: "2026-05-28T02:00:00Z",
    next_fire_at: "2026-05-29T02:00:00Z",
    last_status: "ok",
    last_error: null,
    consecutive_failures: 0,
    total_runs: 30,
    max_concurrency: 1,
    token_budget: null,
    backoff_until: null,
    created_at: "2026-05-16T00:00:00Z",
    updated_at: "2026-05-28T02:00:00Z",
    payload: { job_type: "cleanup_memories" },
    recent: ["ok", "failed", "ok"],
  },
];

const MOCK_EXECUTIONS = [
  {
    id: "exec-001",
    task_id: "11111111-1111-1111-1111-111111111111",
    task_key: "pipeline_watchdog",
    handler_kind: "pipeline_watchdog",
    role: "sentinel",
    scenario: "kg_kb_maintenance",
    category: "maintenance",
    started_at: "2026-05-28T09:00:05Z",
    finished_at: "2026-05-28T09:00:05Z",
    status: "ok",
    duration_ms: 12,
    tokens_used: null,
    output_summary: "no stale runs",
    error: null,
    fire_reason: "tick",
    skill_id: null,
    skill_schedule_id: null,
    memory_id: null,
    pipeline_run_id: null,
    thread_id: null,
  },
  {
    id: "exec-002",
    task_id: "22222222-2222-2222-2222-222222222222",
    task_key: "memory_cleanup",
    handler_kind: "memory_automation",
    role: "sentinel",
    scenario: "memory_retention",
    category: "maintenance",
    started_at: "2026-05-28T02:00:01Z",
    finished_at: "2026-05-28T02:00:03Z",
    status: "failed",
    duration_ms: 2000,
    tokens_used: null,
    output_summary: null,
    error: "timeout waiting for lock",
    fire_reason: "tick",
    skill_id: null,
    skill_schedule_id: null,
    memory_id: null,
    pipeline_run_id: null,
    thread_id: null,
  },
];

const MOCK_KPIS = {
  window: "24h",
  total_tasks: 9,
  enabled_tasks: 9,
  runs: 120,
  success: 118,
  failed: 2,
  running: 0,
  success_rate: 118 / 120,
  avg_latency_ms: 45.3,
};

const MOCK_STATS = (group_by: string) => ({
  group_by,
  window: "24h",
  buckets: [
    { key: "sentinel", label: "sentinel", runs: 80, success: 79, failed: 1, success_rate: 79 / 80, avg_ms: 20 },
    { key: "supervisor", label: "supervisor", runs: 40, success: 39, failed: 1, success_rate: 39 / 40, avg_ms: 120 },
  ],
});

async function mockSchedulerAPIs(page: PageHandle) {
  await page.route("**/api/scheduler/kpis*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_KPIS),
    });
  });

  // tasks* 匹配所有 /tasks 开头的 URL（含 /tasks/{id}/run, /tasks/{id}/toggle, /tasks 列表）
  await page.route("**/api/scheduler/tasks*", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // POST /tasks/{id}/run
    if (url.endsWith("/run") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, execution_id: "exec-new-001" }),
      });
      return;
    }
    // POST /tasks/{id}/toggle
    if (url.endsWith("/toggle") && method === "POST") {
      const body = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, enabled: body.enabled }),
      });
      return;
    }
    // GET /tasks/{id} (detail)
    if (/\/api\/scheduler\/tasks\/[a-f0-9-]+/.test(url) && !url.endsWith("/tasks")) {
      const taskId = url.split("/tasks/")[1]?.split(/[/?]/)[0];
      const found = MOCK_TASKS.find((t) => t.id === taskId) ?? MOCK_TASKS[0];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...found, recent_executions: MOCK_EXECUTIONS.slice(0, 1) }),
      });
      return;
    }
    // GET /tasks (list)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: MOCK_TASKS, next_cursor: null }),
    });
  });

  await page.route("**/api/scheduler/executions*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: MOCK_EXECUTIONS, next_cursor: null }),
    });
  });

  await page.route("**/api/scheduler/stats*", async (route) => {
    const url = new URL(route.request().url());
    const groupBy = url.searchParams.get("group_by") ?? "role";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_STATS(groupBy)),
    });
  });

  // SSE stream: abort to prevent hanging
  await page.route("**/api/scheduler/stream*", async (route) => {
    await route.abort("connectionfailed");
  });

  // Agent dropdown
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
      ]),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

test.describe("Interface / Scheduler 页面", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockSchedulerAPIs(page);
  });

  /* ---- Page load & navigation ---- */

  test("S-1 页面加载：标题、副标题、InterfaceNav、KPI 指标", async ({ page }) => {
    await page.goto("/interface/scheduler");

    await expect(page.getByRole("heading", { name: "Scheduler", exact: true })).toBeVisible();
    await expect(page.getByText("Unified task scheduling and execution management")).toBeVisible();

    // InterfaceNav 可见（子导航包含 Scheduler 链接）
    await expect(page.getByRole("link", { name: "Scheduler" })).toBeVisible();

    // KPI strip: 6 个指标卡片
    await expect(page.getByText("Tasks", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Runs").first()).toBeVisible();
    await expect(page.getByText("Success Rate").first()).toBeVisible();
    await expect(page.getByText("Running").first()).toBeVisible();
    await expect(page.getByText("Failed").first()).toBeVisible();
    await expect(page.getByText("Avg Latency").first()).toBeVisible();
  });

  /* ---- KPI values ---- */

  test("S-2 KPI 指标值正确渲染", async ({ page }) => {
    await page.goto("/interface/scheduler");

    await expect(page.getByText("9", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("120").first()).toBeVisible();
    await expect(page.getByText("98.3%").first()).toBeVisible();
    await expect(page.getByText("45ms").first()).toBeVisible();
  });

  /* ---- Tab switching ---- */

  test("S-3 Tab 切换：Tasks → Executions → Stats", async ({ page }) => {
    await page.goto("/interface/scheduler");

    // Default: Tasks tab active
    await expect(page.getByText("KB/KG Pipeline Watchdog")).toBeVisible();

    // Switch to Executions — 断言执行面板独有的列头
    await page.getByRole("button", { name: "Executions" }).click();
    await expect(page.getByText("Started").first()).toBeVisible();
    await expect(page.getByText("no stale runs")).toBeVisible();

    // Switch to Stats
    await page.getByRole("button", { name: "Stats" }).click();
    await expect(page.getByText("By Role").first()).toBeVisible();
    await expect(page.getByText("By Scenario").first()).toBeVisible();
    await expect(page.getByText("By Owner").first()).toBeVisible();
  });

  /* ---- Task table content ---- */

  test("S-4 任务表格：列头、数据行、状态点、Trigger 类型、Enabled 标签", async ({ page }) => {
    await page.goto("/interface/scheduler");

    // Table header
    await expect(page.getByText("Task").first()).toBeVisible();
    await expect(page.getByText("Handler").first()).toBeVisible();
    await expect(page.getByText("Trigger").first()).toBeVisible();
    await expect(page.getByText("Actions").first()).toBeVisible();

    // Task rows
    await expect(page.getByText("KB/KG Pipeline Watchdog")).toBeVisible();
    await expect(page.getByText("Ebbinghaus Cleanup")).toBeVisible();

    // Trigger type display: interval → "60s", cron → "0 2 * * *"
    await expect(page.getByText("60s").first()).toBeVisible();
    await expect(page.getByText("0 2 * * *").first()).toBeVisible();

    // Handler column
    await expect(page.getByText("pipeline_watchdog").first()).toBeVisible();

    // Enabled badge
    await expect(page.getByText("Enabled").first()).toBeVisible();

    // Actions: Disable + Run Now
    await expect(page.getByRole("button", { name: "Disable" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Now" }).first()).toBeVisible();
  });

  /* ---- Task detail drawer ---- */

  test("S-5 点击任务行打开 Detail Drawer", async ({ page }) => {
    await page.goto("/interface/scheduler");

    await page.getByText("KB/KG Pipeline Watchdog").click();

    // Drawer opened — 验证 Drawer 独有的 key 显示（Drawer header 显示 key）
    await expect(page.getByText("pipeline_watchdog", { exact: true }).first()).toBeVisible();

    // Drawer 底部有 Run Now 和 Disable 按钮
    await expect(page.getByRole("button", { name: "Run Now" }).first()).toBeVisible();

    // Drawer sections
    await expect(page.getByText("Schedule").first()).toBeVisible();
    await expect(page.getByText("Metadata").first()).toBeVisible();
  });

  /* ---- Run Now action ---- */

  test("S-6 Run Now 发起 POST /tasks/{id}/run 请求", async ({ page }) => {
    await page.goto("/interface/scheduler");

    const runRequest = page.waitForRequest(
      (req) => req.url().includes("/api/scheduler/tasks/") && req.url().endsWith("/run") && req.method() === "POST",
    );
    await page.getByRole("button", { name: "Run Now" }).first().click();
    const req = await runRequest;
    expect(req).toBeTruthy();

    // 页面不崩溃
    await expect(page.getByText("KB/KG Pipeline Watchdog")).toBeVisible();
  });

  /* ---- Disable/Enable toggle ---- */

  test("S-7 Disable 发起 POST /tasks/{id}/toggle 请求", async ({ page }) => {
    await page.goto("/interface/scheduler");

    const toggleRequest = page.waitForRequest(
      (req) => req.url().includes("/api/scheduler/tasks/") && req.url().endsWith("/toggle") && req.method() === "POST",
    );
    await page.getByRole("button", { name: "Disable" }).first().click();
    const req = await toggleRequest;
    const body = JSON.parse(req.postData() || "{}");
    expect(body.enabled).toBe(false);

    // 页面不崩溃
    await expect(page.getByText("KB/KG Pipeline Watchdog")).toBeVisible();
  });

  /* ---- Executions panel ---- */

  test("S-8 Executions Tab：执行记录、状态过滤、状态标签", async ({ page }) => {
    await page.goto("/interface/scheduler");
    await page.getByRole("button", { name: "Executions" }).click();

    // Execution rows
    await expect(page.getByText("pipeline_watchdog")).toBeVisible();
    await expect(page.getByText("memory_cleanup")).toBeVisible();

    // Status labels
    await expect(page.getByText("ok", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("failed", { exact: true }).first()).toBeVisible();

    // Status filter pills
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "OK" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Failed" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Running" })).toBeVisible();

    // Error text visible for failed execution
    await expect(page.getByText("timeout waiting for lock")).toBeVisible();
  });

  /* ---- Stats panel ---- */

  test("S-9 Stats Tab：三列统计面板，bucket 行含 runs 与 success rate", async ({ page }) => {
    await page.goto("/interface/scheduler");
    await page.getByRole("button", { name: "Stats" }).click();

    // Three column headers
    await expect(page.getByText("By Role").first()).toBeVisible();
    await expect(page.getByText("By Scenario").first()).toBeVisible();
    await expect(page.getByText("By Owner").first()).toBeVisible();

    // Stats data: bucket rows with runs + success rate
    await expect(page.getByText("80 runs").first()).toBeVisible();
    await expect(page.getByText("98.8%").first()).toBeVisible();
  });

  /* ---- Live indicator ---- */

  test("S-10 SSE 断连时显示 Reconnecting...", async ({ page }) => {
    await page.goto("/interface/scheduler");

    // SSE was aborted, so indicator should show Reconnecting
    await expect(page.getByText("Reconnecting...")).toBeVisible();
  });

  /* ---- Refresh button ---- */

  test("S-11 Refresh 按钮可点击且不崩溃", async ({ page }) => {
    await page.goto("/interface/scheduler");

    const refreshBtn = page.getByRole("button", { name: /Refresh/i });
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();

    // Page still functional after refresh
    await expect(page.getByText("KB/KG Pipeline Watchdog")).toBeVisible();
  });

  /* ---- Hydration consistency ---- */

  test("S-12 刷新后页面状态一致（hydration 回归）", async ({ page }) => {
    await page.goto("/interface/scheduler");

    await expect(page.getByText("KB/KG Pipeline Watchdog")).toBeVisible();

    await page.reload();

    // Post-reload: same content rendered correctly
    await expect(page.getByText("KB/KG Pipeline Watchdog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Scheduler", exact: true })).toBeVisible();
  });
});
