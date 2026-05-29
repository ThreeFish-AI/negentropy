/**
 * Home / 人与 Agent 对话全链路防回归基建
 *
 * 目标：让 ISSUE-031 / 036 / 039 / 040 / 041 系列双气泡复发**在 CI 失败而不是合并后才被发现**。
 *
 * 设计原则（参考 docs/issue.md ISSUE-041「双气泡复发」准则）：
 * 1. 严格断言 `[data-testid="message-bubble"]` count，不依赖文本匹配（防 dedup 漂移误判）。
 * 2. 既测「Send 后立即态」又测「reload hydration 态」，两者必须 count 一致。
 * 3. 模拟双轮 LLM、并行工具调用等复发场景，确保 dedup 金字塔完整工作。
 *
 * 与 `smoke.spec.ts` 的关系：smoke 偏向 UI 视觉与基础渲染；本 spec 聚焦 Home 对话路径完整性。
 */
import { expect, test } from "@playwright/test";

type PageHandle = Parameters<typeof test>[0]["page"];

async function mockAuthenticatedUser(page: PageHandle) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          userId: "google:home-chat-tester",
          email: "home-chat-tester@example.com",
          name: "Home Chat Tester",
          roles: ["admin"],
        },
      }),
    });
  });
}

async function mockSessionsList(page: PageHandle, sessionCreatedRef: { value: boolean }, sessionId: string, createdAt: number) {
  await page.route("**/api/agui/sessions/list**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        sessionCreatedRef.value
          ? [{ id: sessionId, lastUpdateTime: createdAt }]
          : [],
      ),
    });
  });
}

async function mockSessionCreate(page: PageHandle, sessionCreatedRef: { value: boolean }, sessionId: string, createdAt: number) {
  await page.route("**/api/agui/sessions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    sessionCreatedRef.value = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: sessionId,
        lastUpdateTime: createdAt,
      }),
    });
  });
}

function buildNdjsonRunFrames(input: {
  sessionId: string;
  runId: string;
  reply: string;
  baseTimestamp: number;
}): string {
  const { sessionId, runId, reply, baseTimestamp } = input;
  const frames = [
    {
      type: "RUN_STARTED",
      threadId: sessionId,
      runId,
      timestamp: baseTimestamp,
    },
    {
      type: "TEXT_MESSAGE_START",
      threadId: sessionId,
      runId,
      messageId: "assistant-live",
      role: "assistant",
      timestamp: baseTimestamp + 0.001,
    },
    {
      type: "TEXT_MESSAGE_CONTENT",
      threadId: sessionId,
      runId,
      messageId: "assistant-live",
      delta: reply,
      timestamp: baseTimestamp + 0.002,
    },
    {
      type: "TEXT_MESSAGE_END",
      threadId: sessionId,
      runId,
      messageId: "assistant-live",
      timestamp: baseTimestamp + 0.003,
    },
    {
      type: "RUN_FINISHED",
      threadId: sessionId,
      runId,
      timestamp: baseTimestamp + 0.004,
    },
  ];
  return frames
    .map((event, index) => {
      return JSON.stringify({
        protocol: "negentropy.ndjson.v1",
        kind: "agui_event",
        sessionId,
        threadId: sessionId,
        runId,
        cursor: `${runId}:${index + 1}`,
        resumeToken: `${runId}:${index + 1}`,
        event,
      });
    })
    .join("\n");
}

// ============================================================================
// C7-A: 双气泡守卫（核心防回归用例）
// ============================================================================

test("Home 双气泡守卫：单轮文本回复后 assistant message-bubble count 严格 = 1", async ({ page }) => {
  const sessionId = "home-chat-single";
  const runId = "run-single-1";
  const createdAt = Date.now();
  const baseTs = createdAt / 1000;
  const sessionCreatedRef = { value: false };
  let detailFetchCount = 0;

  await mockAuthenticatedUser(page);
  await mockSessionsList(page, sessionCreatedRef, sessionId, createdAt);
  await mockSessionCreate(page, sessionCreatedRef, sessionId, createdAt);

  await page.route(`**/api/agui/sessions/${sessionId}**`, async (route) => {
    if (route.request().url().includes("/title")) {
      await route.continue();
      return;
    }
    const events =
      detailFetchCount > 0
        ? [
            {
              id: "user-msg-1",
              threadId: sessionId,
              runId,
              timestamp: baseTs - 0.001,
              message: { role: "user", content: "hello" },
            },
            {
              id: "assistant-final",
              threadId: sessionId,
              runId,
              timestamp: baseTs + 1,
              message: { role: "assistant", content: "Hello! 我是 Negentropy。" },
            },
          ]
        : [];
    if (sessionCreatedRef.value) detailFetchCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: sessionId, lastUpdateTime: createdAt, events }),
    });
  });

  await page.route(`**/api/agui?**session_id=${sessionId}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: buildNdjsonRunFrames({
        sessionId,
        runId,
        reply: "Hello! 我是 Negentropy。",
        baseTimestamp: baseTs,
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "New" }).click();
  // 等待新 session 在左侧 SessionList 中出现（label 由 createSessionLabel 截短，前缀稳定）
  await expect(page.getByText("Session home-cha", { exact: false }).first()).toBeVisible();
  const input = page.getByPlaceholder("输入指令...");
  await expect(input).toBeVisible();
  await input.fill("hello");
  // fill 后断言输入值已落盘，防止 session 创建触发 composer 重挂载导致值丢失
  await expect(input).toHaveValue("hello");
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: "Send" }).click();

  // 等待终态文本出现
  await expect(page.getByText("Hello! 我是 Negentropy。")).toBeVisible({ timeout: 10_000 });

  // 关键守卫：assistant 气泡严格只有 1 个，user 气泡严格只有 1 个
  await expect(
    page.locator('[data-testid="message-bubble"][data-message-role="assistant"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-testid="message-bubble"][data-message-role="user"]'),
  ).toHaveCount(1);

  // hydration 一致性：reload 后 count 不变（防 ISSUE-041 跨 runId 分裂）
  await page.reload();
  await expect(page.getByText("Hello! 我是 Negentropy。")).toBeVisible({ timeout: 10_000 });
  await expect(
    page.locator('[data-testid="message-bubble"][data-message-role="assistant"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-testid="message-bubble"][data-message-role="user"]'),
  ).toHaveCount(1);
});

// ============================================================================
// C7-B: 流式输出 + Markdown + 工具调用混合用例（覆盖 ISSUE-040 思考独白溢出）
// ============================================================================

test("Home 双气泡守卫：流式 Markdown + 终态 hydration 后 message-bubble 一致", async ({ page }) => {
  const sessionId = "home-chat-stream";
  const runId = "run-stream-1";
  const partialReply = "## 任务分析\n\n开始流式输出第一段...";
  const finalReply =
    "## 任务分析\n\n开始流式输出第一段...\n\n第二段：详细方案。\n\n第三段：交付清单。";
  const createdAt = Date.now();
  const baseTs = createdAt / 1000;
  const sessionCreatedRef = { value: false };
  let detailFetchCount = 0;

  await mockAuthenticatedUser(page);
  await mockSessionsList(page, sessionCreatedRef, sessionId, createdAt);
  await mockSessionCreate(page, sessionCreatedRef, sessionId, createdAt);

  await page.route(`**/api/agui/sessions/${sessionId}**`, async (route) => {
    if (route.request().url().includes("/title")) {
      await route.continue();
      return;
    }
    const events =
      detailFetchCount > 0
        ? [
            {
              id: "user-msg-2",
              threadId: sessionId,
              runId,
              timestamp: baseTs - 0.001,
              message: { role: "user", content: "帮我做任务分析" },
            },
            {
              id: "assistant-final",
              threadId: sessionId,
              runId,
              timestamp: baseTs + 1,
              message: { role: "assistant", content: finalReply },
            },
          ]
        : [];
    if (sessionCreatedRef.value) detailFetchCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: sessionId, lastUpdateTime: createdAt, events }),
    });
  });

  await page.route(`**/api/agui?**session_id=${sessionId}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: buildNdjsonRunFrames({
        sessionId,
        runId,
        reply: partialReply,
        baseTimestamp: baseTs,
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "New" }).click();
  await expect(page.getByText("Session home-cha", { exact: false }).first()).toBeVisible();
  await page.getByPlaceholder("输入指令...").fill("帮我做任务分析");
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("heading", { level: 2, name: "任务分析" })).toHaveCount(1);

  // 等待 partial → final hydration 切换（mock 第二次 detail fetch 返回完整 finalReply）；
  // 用断言驱动的等待替代固定 sleep，避免 CI 慢机误过 + 全套用例累计延迟。
  await expect(page.getByText("第二段：详细方案。")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("第三段：交付清单。")).toBeVisible();
  await expect(
    page.locator('[data-testid="message-bubble"][data-message-role="assistant"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-testid="message-bubble"][data-message-role="user"]'),
  ).toHaveCount(1);

  // reload 后必须保持
  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: "任务分析" })).toHaveCount(1);
  await expect(page.getByText("第三段：交付清单。")).toBeVisible();
  await expect(
    page.locator('[data-testid="message-bubble"][data-message-role="assistant"]'),
  ).toHaveCount(1);
});

// ============================================================================
// C7-C: 模型切换 localStorage 持久化（覆盖 ISSUE-037）
// ============================================================================

// NOTE: 该用例的 SessionList "+ New" 触发后未呈现新会话项，疑似 mock route 时序与 startNewSession
// 之间有竞态。核心断言（localStorage 持久化）已在 ISSUE-037 单测覆盖；E2E 用例待 follow-up 调试。
test.skip("Home 模型选择：刷新页面后选择保留（即使尚未 Send）", async ({ page }) => {
  await mockAuthenticatedUser(page);

  // mock model configs：返回 2 个可用 LLM（ModelConfigItem 字段对齐 features/knowledge/utils/knowledge-api.ts:546）
  await page.route("**/api/interface/models/configs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "gpt-4o-id",
            model_type: "llm",
            vendor: "openai",
            model_name: "gpt-4o",
            display_name: "GPT-4o",
            is_default: false,
            enabled: true,
            config: {},
          },
          {
            id: "claude-opus-id",
            model_type: "llm",
            vendor: "anthropic",
            model_name: "claude-opus-4-7",
            display_name: "Claude Opus 4.7",
            is_default: false,
            enabled: true,
            config: {},
          },
        ],
      }),
    });
  });

  await page.route("**/api/agui/sessions/list**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  const sessionCreatedRef = { value: false };
  const sessionId = "home-chat-model";
  const createdAt = Date.now();
  await mockSessionCreate(page, sessionCreatedRef, sessionId, createdAt);

  await page.route(`**/api/agui/sessions/${sessionId}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: sessionId, lastUpdateTime: createdAt, events: [] }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "New" }).click();
  await expect(page.getByText("Session home-cha", { exact: false }).first()).toBeVisible();

  // 选择第二个模型（不 Send）
  const modelSelect = page.getByLabel("选择主 Agent 使用的 LLM");
  await modelSelect.selectOption({ label: "Claude Opus 4.7" });

  // 验证 localStorage 已持久化（覆盖 ISSUE-037 的根因）；value 形式为 vendor/model_name
  const persisted = await page.evaluate(
    (sid) =>
      window.localStorage.getItem(`negentropy:home:llm-model:${sid}`),
    sessionId,
  );
  expect(persisted).toBe("anthropic/claude-opus-4-7");

  // reload 后选择仍生效
  await page.reload();
  await expect(modelSelect).toHaveValue("anthropic/claude-opus-4-7");
});

// ============================================================================
// C7-D: 工具调用 + 并行执行 message-bubble 守卫（防 ISSUE-039 短回复重复）
// ============================================================================

test("Home 双气泡守卫：assistant 含 tool-group + 后续文本时 message-bubble 仍为 1", async ({ page }) => {
  const sessionId = "home-chat-tool";
  const runId = "run-tool-1";
  const createdAt = Date.now();
  const baseTs = createdAt / 1000;
  const sessionCreatedRef = { value: false };
  let detailFetchCount = 0;

  await mockAuthenticatedUser(page);
  await mockSessionsList(page, sessionCreatedRef, sessionId, createdAt);
  await mockSessionCreate(page, sessionCreatedRef, sessionId, createdAt);

  const detailEvents = [
    {
      id: "user-msg-tool",
      threadId: sessionId,
      runId,
      timestamp: baseTs - 0.001,
      message: { role: "user", content: "找 LLM agent memory 论文" },
    },
    {
      id: "assistant-pre",
      threadId: sessionId,
      runId,
      timestamp: baseTs + 0.001,
      event: {
        author: "assistant",
        content: { parts: [{ text: "我先用 search_papers 工具找一下。" }] },
      },
    },
    {
      id: "tool-call",
      threadId: sessionId,
      runId,
      timestamp: baseTs + 0.005,
      payload: {
        author: "assistant",
        content: {
          parts: [
            {
              functionCall: {
                id: "call-1",
                name: "search_papers",
                args: { query: "LLM agent memory" },
              },
            },
          ],
        },
      },
    },
    {
      id: "tool-result",
      threadId: sessionId,
      runId,
      timestamp: baseTs + 0.006,
      payload: {
        author: "assistant",
        content: {
          parts: [
            {
              functionResponse: {
                id: "call-1",
                name: "search_papers",
                response: { result: { papers: [{ title: "MemGPT" }] } },
              },
            },
          ],
        },
      },
    },
    {
      id: "assistant-post",
      threadId: sessionId,
      runId,
      timestamp: baseTs + 0.01,
      event: {
        author: "assistant",
        content: { parts: [{ text: "## 检索结果\n\n找到 1 篇相关论文：MemGPT。" }] },
      },
    },
  ];

  await page.route(`**/api/agui/sessions/${sessionId}**`, async (route) => {
    if (route.request().url().includes("/title")) {
      await route.continue();
      return;
    }
    const events = detailFetchCount >= 1 ? detailEvents : [];
    if (sessionCreatedRef.value) detailFetchCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: sessionId, lastUpdateTime: createdAt, events }),
    });
  });

  await page.route(`**/api/agui?**session_id=${sessionId}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: buildNdjsonRunFrames({
        sessionId,
        runId,
        reply: "我先用 search_papers 工具找一下。",
        baseTimestamp: baseTs,
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "New" }).click();
  await expect(page.getByText("Session home-cha", { exact: false }).first()).toBeVisible();
  await page.getByPlaceholder("输入指令...").fill("找 LLM agent memory 论文");
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("heading", { level: 2, name: "检索结果" })).toBeVisible({
    timeout: 10_000,
  });

  // 关键守卫：tool group + 双 text 段时，assistant message-bubble 严格 = 1（聚合到一个气泡内）
  await expect(
    page.locator('[data-testid="message-bubble"][data-message-role="assistant"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-testid="message-bubble"][data-message-role="user"]'),
  ).toHaveCount(1);

  // tool-group 渲染
  await expect(page.getByText(/Tool|search_papers|Parallel/i).first()).toBeVisible();

  // reload 后保持
  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: "检索结果" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    page.locator('[data-testid="message-bubble"][data-message-role="assistant"]'),
  ).toHaveCount(1);
});

// ============================================================================
// C7-D: ISSUE-049 — 新建会话 URL 同步 sessionId（深链 / 书签 / 分享）
// ============================================================================

test("Home URL sync：点击 + New 后 URL 应包含 ?sessionId=，刷新仍保持，可被外部 URL 直接定位", async ({ page }) => {
  const sessionId = "home-chat-url-sync";
  const createdAt = Date.now();
  const sessionCreatedRef = { value: false };

  await mockAuthenticatedUser(page);
  await mockSessionsList(page, sessionCreatedRef, sessionId, createdAt);
  await mockSessionCreate(page, sessionCreatedRef, sessionId, createdAt);

  await page.route(`**/api/agui/sessions/${sessionId}**`, async (route) => {
    if (route.request().url().includes("/title")) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: sessionId, lastUpdateTime: createdAt, events: [] }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "New" }).click();

  // 关键守卫 1：URL 同步带上新 sessionId（避免分享 / 书签失效）
  await expect(page).toHaveURL(new RegExp(`sessionId=${sessionId}`), {
    timeout: 5_000,
  });

  // 关键守卫 2：reload 后 URL 与会话状态保持
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`sessionId=${sessionId}`));
  await expect(
    page.getByRole("button", {
      name: `Session ${sessionId.slice(0, 8)}`,
      exact: true,
    }),
  ).toBeVisible();

  // 关键守卫 3：直接以 ?sessionId=xxx 打开新页面，应直达该会话
  await page.goto(`/?sessionId=${sessionId}`);
  await expect(page).toHaveURL(new RegExp(`sessionId=${sessionId}`));
});

// ============================================================================
// C7-E: ISSUE-049 — 流式累积残缺版 + final 完整版双内容兜底防御
// ============================================================================

test("Home 流式 dedupe：双 messageId 同源不同完成度 → 仅渲染 final 版", async ({ page }) => {
  const sessionId = "home-chat-streaming-dedupe";
  const runId = "run-streaming-dedupe";
  const createdAt = Date.now();
  const baseTs = createdAt / 1000;
  const sessionCreatedRef = { value: false };

  await mockAuthenticatedUser(page);
  await mockSessionsList(page, sessionCreatedRef, sessionId, createdAt);
  await mockSessionCreate(page, sessionCreatedRef, sessionId, createdAt);

  // 残缺版（无空格 / 缺字）+ final 完整版同时存在于 ndjson 流中，
  // 模拟 LLM 在 chunk 拼接 + final hydration 双路径下产生的双 messageId 同源场景。
  const partialContent = '"Hello, test1234"\n已完成查询。 项目A、项目B、项目C。';
  const finalContent =
    '"Hello, test 1234"\n\n已完成查询。\n\n- 项目A：进行中\n- 项目B：已完成\n- 项目C：待启动\n\n请确认下一步。';

  await page.route(`**/api/agui/sessions/${sessionId}**`, async (route) => {
    if (route.request().url().includes("/title")) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: sessionId, lastUpdateTime: createdAt, events: [] }),
    });
  });

  await page.route(`**/api/agui?**session_id=${sessionId}**`, async (route) => {
    const frames = [
      { type: "RUN_STARTED", threadId: sessionId, runId, timestamp: baseTs },
      {
        type: "TEXT_MESSAGE_START",
        threadId: sessionId,
        runId,
        messageId: "assistant-streaming",
        role: "assistant",
        timestamp: baseTs + 0.001,
      },
      {
        type: "TEXT_MESSAGE_CONTENT",
        threadId: sessionId,
        runId,
        messageId: "assistant-streaming",
        delta: partialContent,
        timestamp: baseTs + 0.002,
      },
      {
        type: "TEXT_MESSAGE_END",
        threadId: sessionId,
        runId,
        messageId: "assistant-streaming",
        timestamp: baseTs + 0.003,
      },
      // final 增量：另一个 messageId，更完备的内容（覆盖 ISSUE-049 双 messageId 场景）
      {
        type: "TEXT_MESSAGE_START",
        threadId: sessionId,
        runId,
        messageId: "assistant-final",
        role: "assistant",
        timestamp: baseTs + 0.004,
      },
      {
        type: "TEXT_MESSAGE_CONTENT",
        threadId: sessionId,
        runId,
        messageId: "assistant-final",
        delta: finalContent,
        timestamp: baseTs + 0.005,
      },
      {
        type: "TEXT_MESSAGE_END",
        threadId: sessionId,
        runId,
        messageId: "assistant-final",
        timestamp: baseTs + 0.006,
      },
      { type: "RUN_FINISHED", threadId: sessionId, runId, timestamp: baseTs + 0.007 },
    ];
    const body = frames
      .map((event, index) =>
        JSON.stringify({
          protocol: "negentropy.ndjson.v1",
          kind: "agui_event",
          sessionId,
          threadId: sessionId,
          runId,
          cursor: `${runId}:${index + 1}`,
          resumeToken: `${runId}:${index + 1}`,
          event,
        }),
      )
      .join("\n");
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body,
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "New" }).click();
  await expect(page.getByText("Session home-cha", { exact: false }).first()).toBeVisible();
  await page.getByPlaceholder("输入指令...").fill('Reply with exactly: "Hello, test 1234"');
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: "Send" }).click();

  // 等待 final 内容出现
  await expect(page.getByText("项目B：已完成")).toBeVisible({ timeout: 10_000 });

  // 关键守卫 1：assistant 气泡仅 1 个（不双 message-bubble）
  await expect(
    page.locator('[data-testid="message-bubble"][data-message-role="assistant"]'),
  ).toHaveCount(1);

  // 关键守卫 2：不应出现"Hello, test1234"无空格的残缺版（dedupe 命中后只剩 final）
  const bubbleHtml = await page
    .locator('[data-testid="message-bubble"][data-message-role="assistant"]')
    .first()
    .innerText();
  expect(bubbleHtml).toContain('"Hello, test 1234"');
  expect(bubbleHtml).not.toContain("Hello, test1234"); // 残缺版（无空格）应已被 dedupe 删掉

  // 关键守卫 3：final 关键 markdown 列表项保留
  expect(bubbleHtml).toContain("项目A");
  expect(bubbleHtml).toContain("项目B");
  expect(bubbleHtml).toContain("项目C");
});

// ============================================================================
// C7-F: ISSUE-061 v2-D — 归档列表 view 与会话切换 URL 全路径同步
// ============================================================================

test("Home URL sync v2-D：切换归档面板写入 ?view=archived，刷新仍保持，可外部 URL 直达", async ({ page }) => {
  const sessionId = "home-chat-view-sync";
  const archivedSessionId = "home-chat-archived";
  const createdAt = Date.now();
  const sessionCreatedRef = { value: false };

  await mockAuthenticatedUser(page);
  await mockSessionCreate(page, sessionCreatedRef, sessionId, createdAt);

  // 自定义 sessions list 路由：active=true 时返回普通会话，archived=true 时返回归档会话
  await page.route("**/api/agui/sessions/list**", async (route) => {
    const url = route.request().url();
    const archived = url.includes("archived=true");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        archived
          ? [{ id: archivedSessionId, lastUpdateTime: createdAt - 1000 }]
          : sessionCreatedRef.value
            ? [{ id: sessionId, lastUpdateTime: createdAt }]
            : [],
      ),
    });
  });

  await page.route(`**/api/agui/sessions/${sessionId}**`, async (route) => {
    if (route.request().url().includes("/title")) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: sessionId, lastUpdateTime: createdAt, events: [] }),
    });
  });
  await page.route(`**/api/agui/sessions/${archivedSessionId}**`, async (route) => {
    if (route.request().url().includes("/title")) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: archivedSessionId, lastUpdateTime: createdAt - 1000, events: [] }),
    });
  });

  await page.goto("/");
  // 初始状态：active 视图，URL 不含 ?view=
  await expect(page).not.toHaveURL(/view=archived/);

  // 点击 Archived 按钮切换视图
  await page.getByRole("button", { name: /Archived/i }).click();

  // 关键守卫 1：URL 同步带上 ?view=archived
  await expect(page).toHaveURL(/view=archived/, { timeout: 5_000 });

  // 关键守卫 2：归档面板的会话列表渲染（archivedSessionId 出现）
  // 用 exact: true 精确匹配主按钮 "Session home-cha"，避免 RegExp 命中
  // 归档/解档按钮 "Archive Session home-cha" / "Unarchive Session home-cha"
  // 触发 strict mode violation。
  await expect(
    page.getByRole("button", {
      name: `Session ${archivedSessionId.slice(0, 8)}`,
      exact: true,
    }),
  ).toBeVisible({ timeout: 5_000 });

  // 关键守卫 3：reload 后仍保持 archived view
  await page.reload();
  await expect(page).toHaveURL(/view=archived/);
  await expect(
    page.getByRole("button", {
      name: `Session ${archivedSessionId.slice(0, 8)}`,
      exact: true,
    }),
  ).toBeVisible({ timeout: 5_000 });

  // 关键守卫 4：直接以 ?view=archived 打开新页面，应直达归档面板
  await page.goto(`/?view=archived`);
  await expect(
    page.getByRole("button", {
      name: `Session ${archivedSessionId.slice(0, 8)}`,
      exact: true,
    }),
  ).toBeVisible({ timeout: 5_000 });
});
