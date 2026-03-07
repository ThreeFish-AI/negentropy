import { expect, test } from "@playwright/test";

test("首页在认证成功时展示聊天输入框", async ({ page }) => {
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
