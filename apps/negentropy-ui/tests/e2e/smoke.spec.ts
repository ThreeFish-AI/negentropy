import { expect, test } from "@playwright/test";

async function mockAuthenticatedUser(page: Parameters<typeof test>[0]["page"]) {
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

test("聊天流式回复在 hydration 后不重复显示最终 bubble", async ({ page }) => {
  const sessionId = "pw-chat-1";
  const runId = "pw-run-1";
  const partialReply = "我可以帮助你规划任务";
  const finalReply = "我可以帮助你规划任务、分析代码并直接修改实现。";
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

  await expect(page.getByText(partialReply, { exact: true })).toHaveCount(1);

  await page.waitForTimeout(1600);

  await expect(page.getByText(finalReply, { exact: true })).toHaveCount(1);
  await expect(page.getByText("你能帮我做什么？", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Streaming")).toHaveCount(0);
});
