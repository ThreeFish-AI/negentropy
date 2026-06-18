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

const USER_LIST = {
  users: [{ id: "user-1", label: "User 1", count: 5 }],
  timeline: [],
  policies: {},
};

const CORE_BLOCKS = {
  count: 2,
  items: [
    {
      id: "cb-1",
      user_id: "user-1",
      app_name: "negentropy",
      scope: "user",
      thread_id: null,
      label: "persona",
      content: "用户是一名 Rust 工程师，偏好简洁的回答。",
      token_count: 24,
      version: 3,
      updated_by: "user-1",
      metadata: {},
      created_at: "2026-05-01T10:00:00Z",
      updated_at: "2026-05-10T10:00:00Z",
    },
    {
      id: "cb-2",
      user_id: "user-1",
      app_name: "negentropy",
      scope: "app",
      thread_id: null,
      label: "human",
      content: "称呼用户为 Cap。",
      token_count: 8,
      version: 1,
      updated_by: "system",
      metadata: {},
      created_at: "2026-05-02T10:00:00Z",
      updated_at: "2026-05-02T10:00:00Z",
    },
  ],
};

function jsonBody(payload: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(payload),
  } as const;
}

test("Core Memory 列出 blocks 并展示 scope/version/token", async ({ page }) => {
  await mockAuthenticatedUser(page);

  // 单一 catch-all 始终 fulfill：既覆盖用户聚合列表 `/api/memory?app_name=...`
  // （New Block / 列表加载依赖 activeUserId，源自该列表），也覆盖 `/api/memory/core-blocks`。
  // 必须用 `**/api/memory**`（带尾通配）匹配带 query 的 URL，且不回退到网络——
  // CI 无后端，回退会 502 导致 users=[] → 页面空转（参见 ISSUE：CI 失败根因）。
  await page.route("**/api/memory**", async (route) => {
    const url = route.request().url();
    if (url.includes("/api/memory/core-blocks")) {
      await route.fulfill(jsonBody(CORE_BLOCKS));
      return;
    }
    await route.fulfill(jsonBody(USER_LIST));
  });

  await page.goto("/memory/core-blocks");
  await page.waitForLoadState("networkidle");

  // block 内容 + 元信息（label "persona"/"human" 与侧栏说明文案重名，故用更具体的定位）
  await expect(
    page.getByText("用户是一名 Rust 工程师，偏好简洁的回答。"),
  ).toBeVisible();
  await expect(page.getByText("称呼用户为 Cap。")).toBeVisible();
  await expect(page.getByText("v3")).toBeVisible();
  await expect(page.getByText("24 tokens")).toBeVisible();
  // label 用 exact 命中卡片标题，排除侧栏 "persona / human" 说明
  await expect(page.getByText("persona", { exact: true })).toBeVisible();
  await expect(page.getByText("human", { exact: true })).toBeVisible();
});

test("Core Memory 新建 block 走 POST 并刷新", async ({ page }) => {
  await mockAuthenticatedUser(page);

  let created = false;
  await page.route("**/api/memory**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes("/api/memory/core-blocks")) {
      if (method === "POST") {
        created = true;
        await route.fulfill(
          jsonBody({
            id: "cb-new",
            version: 1,
            scope: "user",
            label: "notes",
            token_count: 3,
            truncated: false,
          }),
        );
        return;
      }
      // GET：创建后返回含新块的列表
      await route.fulfill(
        jsonBody(
          created
            ? {
                count: 1,
                items: [
                  {
                    id: "cb-new",
                    user_id: "user-1",
                    app_name: "negentropy",
                    scope: "user",
                    thread_id: null,
                    label: "notes",
                    content: "hello world",
                    token_count: 3,
                    version: 1,
                    updated_by: "user-1",
                    metadata: {},
                  },
                ],
              }
            : { count: 0, items: [] },
        ),
      );
      return;
    }
    // 用户聚合列表（驱动 activeUserId / New Block 可用态）
    await route.fulfill(jsonBody(USER_LIST));
  });

  await page.goto("/memory/core-blocks");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: /New Block/ }).click();
  // 抽屉内填写 label + content
  await page.getByPlaceholder("persona / human / …").fill("notes");
  await page.getByPlaceholder(/常驻摘要内容/).fill("hello world");
  await page.getByRole("button", { name: "创建" }).click();

  // 断言新建的块卡片（<article>）出现，而非裸 getByText——后者在抽屉关闭动画
  // 期间会同时命中仍挂载的 <textarea> 与卡片 <p>，触发 strict-mode 双命中。
  await expect(
    page.getByRole("article").getByText("hello world"),
  ).toBeVisible();
  expect(created).toBe(true);
});
