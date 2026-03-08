import { expect, test } from "@playwright/test";

type PageHandle = Parameters<typeof test>[0]["page"];
type ThemeVariant = "light" | "dark";

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

async function getStatusBadgeSnapshot(
  page: PageHandle,
  label: string,
) {
  const badge = page.getByLabel(label);
  const dot = badge.locator("span").nth(0);
  const text = badge.locator("span").nth(1);

  await expect(badge).toBeVisible();
  await expect(dot).toBeVisible();
  await expect(text).toBeVisible();

  return {
    badgeClassName: await badge.evaluate((node) => node.className),
    dotClassName: await dot.evaluate((node) => node.className),
    textClassName: await text.evaluate((node) => node.className),
    textContent: await text.textContent(),
  };
}

function getDashboardRunsPanel(page: PageHandle) {
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: "Pipeline Runs" }),
  }).first();
}

function getPipelinesRunsPanel(page: PageHandle) {
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: "Runs" }),
  }).first();
}

async function applyTheme(page: PageHandle, theme: ThemeVariant) {
  await page.emulateMedia({ colorScheme: theme });
}

async function assertThemeSettled(page: PageHandle, theme: ThemeVariant) {
  const html = page.locator("html");
  if (theme === "dark") {
    await expect(html).toHaveClass(/dark/);
    return;
  }

  await expect.poll(async () => (await html.getAttribute("class")) || "").not.toMatch(/\bdark\b/);
}

test("首页在认证成功时展示聊天输入框", async ({ page }) => {
  await mockAuthenticatedUser(page);

  await page.route("**/api/agui/sessions/list**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });

  await page.goto("/");

  await expect(page.getByText("Negentropy").first()).toBeVisible();
  await expect(page.getByPlaceholder("输入指令...")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
});

test("Knowledge Base 页面可完成基础检索烟测", async ({ page }) => {
  await mockAuthenticatedUser(page);

  await page.route("**/api/knowledge/base?app_name=negentropy", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "corpus-1",
          app_name: "negentropy",
          name: "Playwright Corpus",
          description: "Smoke corpus",
          config: {},
          version: 1,
          knowledge_count: 3,
          created_at: "2026-03-07T10:00:00Z",
          updated_at: "2026-03-07T10:00:00Z",
        },
      ]),
    });
  });

  await page.route("**/api/knowledge/base/corpus-1/search", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        count: 1,
        items: [
          {
            id: "chunk-1",
            content: "Entropy-reducing retrieval result",
            combined_score: 0.91,
            metadata: {
              source_uri: "docs://playwright",
              display_name: "Playwright Document",
              chunk_index: 0,
            },
          },
        ],
      }),
    });
  });

  await page.goto("/knowledge/base");

  await expect(page.getByRole("button", { name: "Add Corpus" })).toBeVisible();
  await expect(page.getByPlaceholder("输入检索内容")).toBeVisible();

  await page.getByRole("checkbox", { name: "Playwright Corpus" }).check();
  await page.getByPlaceholder("输入检索内容").fill("entropy");
  await page.getByRole("button", { name: "Retrieve" }).click();

  await expect(page.getByText("Retrieved Chunks")).toBeVisible();
  await expect(page.getByText("Entropy-reducing retrieval result")).toBeVisible();
});

test("Knowledge Runs 状态标签在 Dashboard 与 Pipelines 页面视觉一致", async ({ page }) => {
  await mockAuthenticatedUser(page);

  const sharedRuns = [
    {
      id: "run-running-id",
      run_id: "run-running",
      status: "running",
      version: 3,
      operation: "sync_source",
      trigger: "ui",
      updated_at: "2026-03-08T10:01:00Z",
      started_at: "2026-03-08T10:00:00Z",
      duration_ms: 2400,
    },
    {
      id: "run-completed-id",
      run_id: "run-completed",
      status: "completed",
      version: 2,
      operation: "rebuild_source",
      trigger: "api",
      updated_at: "2026-03-08T09:45:00Z",
      started_at: "2026-03-08T09:40:00Z",
      completed_at: "2026-03-08T09:41:00Z",
      duration_ms: 60000,
    },
    {
      id: "run-failed-id",
      run_id: "run-failed",
      status: "failed",
      version: 1,
      operation: "ingest_url",
      trigger: "ui",
      updated_at: "2026-03-08T09:30:00Z",
      started_at: "2026-03-08T09:29:00Z",
      completed_at: "2026-03-08T09:29:30Z",
      duration_ms: 30000,
      error: { message: "mock failure" },
    },
  ];

  await page.route("**/api/knowledge/dashboard?app_name=negentropy", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        corpus_count: 2,
        knowledge_count: 8,
        last_build_at: "2026-03-08T10:05:00Z",
        pipeline_runs: sharedRuns.map((run) => ({
          run_id: run.run_id,
          status: run.status,
          version: run.version,
          operation: run.operation,
          trigger: run.trigger,
          updated_at: run.updated_at,
        })),
        alerts: [],
      }),
    });
  });

  await page.route("**/api/knowledge/pipelines?app_name=negentropy", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        last_updated_at: "2026-03-08T10:05:00Z",
        runs: sharedRuns,
      }),
    });
  });

  for (const theme of ["light", "dark"] as const) {
    await applyTheme(page, theme);

    await page.goto("/knowledge");
    await assertThemeSettled(page, theme);
    await expect(page.getByRole("heading", { name: "Pipeline Runs" })).toBeVisible();

    const dashboardRunsPanel = getDashboardRunsPanel(page);
    await expect(dashboardRunsPanel).toBeVisible();

    const dashboardRunning = await getStatusBadgeSnapshot(page, "状态: running");
    const dashboardCompleted = await getStatusBadgeSnapshot(page, "状态: completed");
    const dashboardFailed = await getStatusBadgeSnapshot(page, "状态: failed");

    await expect(dashboardRunsPanel).toHaveScreenshot(`knowledge-dashboard-runs-${theme}.png`, {
      animations: "disabled",
      caret: "hide",
    });

    await page.goto("/knowledge/pipelines");
    await assertThemeSettled(page, theme);
    await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /run-running/i }),
    ).toHaveClass(/bg-zinc-900/);

    const pipelinesRunsPanel = getPipelinesRunsPanel(page);
    await expect(pipelinesRunsPanel).toBeVisible();

    const pipelinesRunning = await getStatusBadgeSnapshot(page, "状态: running");
    const pipelinesCompleted = await getStatusBadgeSnapshot(page, "状态: completed");
    const pipelinesFailed = await getStatusBadgeSnapshot(page, "状态: failed");

    await expect(pipelinesRunsPanel).toHaveScreenshot(`knowledge-pipelines-runs-${theme}.png`, {
      animations: "disabled",
      caret: "hide",
    });

    expect(pipelinesRunning).toEqual(dashboardRunning);
    expect(pipelinesCompleted).toEqual(dashboardCompleted);
    expect(pipelinesFailed).toEqual(dashboardFailed);

    expect(dashboardRunning.badgeClassName).toContain("inline-flex");
    expect(dashboardRunning.badgeClassName).toContain("gap-2");
    expect(dashboardRunning.dotClassName).toContain("animate-pulse");
    expect(dashboardRunning.textClassName).toContain("text-amber-600");
    expect(dashboardCompleted.textClassName).toContain("text-emerald-600");
    expect(dashboardFailed.textClassName).toContain("text-rose-600");
  }
});

test("聊天流式 Markdown 回复在 hydration 后无需刷新即可稳定收敛", async ({ page }) => {
  const sessionId = "pw-chat-1";
  const runId = "pw-run-1";
  const partialReply = "## 分析\n\n- 正在收集上下文";
  const finalReply = "## 分析\n\n- 正在收集上下文\n\n已完成归纳。";
  const createdAt = Date.now();
  let sessionCreated = false;
  let detailFetchAfterRun = 0;

  await mockAuthenticatedUser(page);

  await page.route("**/api/agui/sessions/list**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        sessionCreated
          ? [{ id: sessionId, lastUpdateTime: createdAt }]
          : [],
      ),
    });
  });

  await page.route("**/api/agui/sessions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    sessionCreated = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: sessionId,
        lastUpdateTime: createdAt,
      }),
    });
  });

  await page.route(`**/api/agui/sessions/${sessionId}**`, async (route) => {
    if (route.request().url().includes("/title")) {
      await route.continue();
      return;
    }

    const events =
      detailFetchAfterRun > 0
        ? [
            {
              id: "assistant-final",
              threadId: sessionId,
              runId,
              timestamp: createdAt / 1000 + 1,
              message: {
                role: "assistant",
                content: finalReply,
              },
            },
          ]
        : [];

    if (sessionCreated) {
      detailFetchAfterRun += 1;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: sessionId,
        lastUpdateTime: createdAt,
        events,
      }),
    });
  });

  await page.route(`**/api/agui?**session_id=${sessionId}**`, async (route) => {
    const sseBody = [
      {
        type: "RUN_STARTED",
        threadId: sessionId,
        runId,
        timestamp: createdAt / 1000,
      },
      {
        type: "TEXT_MESSAGE_START",
        threadId: sessionId,
        runId,
        messageId: "assistant-live",
        role: "assistant",
        timestamp: createdAt / 1000 + 0.001,
      },
      {
        type: "TEXT_MESSAGE_CONTENT",
        threadId: sessionId,
        runId,
        messageId: "assistant-live",
        delta: partialReply,
        timestamp: createdAt / 1000 + 0.002,
      },
      {
        type: "TEXT_MESSAGE_END",
        threadId: sessionId,
        runId,
        messageId: "assistant-live",
        timestamp: createdAt / 1000 + 0.003,
      },
      {
        type: "RUN_FINISHED",
        threadId: sessionId,
        runId,
        timestamp: createdAt / 1000 + 0.004,
      },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join("");

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: sseBody,
    });
  });

  await page.goto("/");

  await page.getByRole("button", { name: "+ New" }).click();
  await expect(page.getByText("Session pw-chat").first()).toBeVisible();

  await page.getByPlaceholder("输入指令...").fill("你能帮我做什么？");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("heading", { level: 2, name: "分析" })).toHaveCount(1);
  await expect(page.getByRole("list")).toHaveCount(1);
  await expect(page.getByText("正在收集上下文", { exact: true })).toHaveCount(1);

  await page.waitForTimeout(1600);

  await expect(page.getByRole("heading", { level: 2, name: "分析" })).toHaveCount(1);
  await expect(page.getByText("正在收集上下文", { exact: true })).toHaveCount(1);
  await expect(page.getByText("已完成归纳。", { exact: true })).toHaveCount(1);
  await expect(page.getByText("你能帮我做什么？", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Streaming")).toHaveCount(0);

  await page.reload();

  await expect(page.getByRole("heading", { level: 2, name: "分析" })).toHaveCount(1);
  await expect(page.getByText("正在收集上下文", { exact: true })).toHaveCount(1);
  await expect(page.getByText("已完成归纳。", { exact: true })).toHaveCount(1);
});
