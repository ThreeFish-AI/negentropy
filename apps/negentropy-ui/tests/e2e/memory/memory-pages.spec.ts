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

// ============================================================================
// Dashboard
// ============================================================================

test("Memory Dashboard 展示 8 个指标卡片", async ({ page }) => {
  await mockAuthenticatedUser(page);

  await page.route("**/api/memory/dashboard**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user_count: 7,
        memory_count: 42,
        fact_count: 15,
        avg_retention_score: 0.876,
        avg_importance_score: 0.543,
        low_retention_count: 2,
        high_importance_count: 8,
        recent_audit_count: 5,
      }),
    });
  });

  await page.goto("/memory");
  await page.waitForLoadState("networkidle");

  // 验证 8 个标签（DOM 文本为小写，CSS `uppercase` 视觉转换；用精确匹配避免 strict mode violation）
  await expect(page.getByText("Users", { exact: true })).toBeVisible();
  await expect(page.getByText("Memories", { exact: true })).toBeVisible();
  await expect(page.getByText("Facts", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Avg Retention", { exact: true })).toBeVisible();
  await expect(page.getByText("87.6%")).toBeVisible();
  await expect(page.getByText("Avg Importance", { exact: true })).toBeVisible();
  await expect(page.getByText("54.3%")).toBeVisible();
  await expect(page.getByText("Low Retention", { exact: true })).toBeVisible();
  await expect(page.getByText("High Importance", { exact: true })).toBeVisible();
  await expect(page.getByText("Recent Audits", { exact: true })).toBeVisible();

  // 验证卡片数值（用 locator 限定到卡片容器内的值文本）
  const cards = page.locator(".grid > div");
  await expect(cards).toHaveCount(8);
  // Spot check specific values using card-scoped locators
  await expect(cards.nth(0).locator("p").last()).toHaveText("7");
  await expect(cards.nth(1).locator("p").last()).toHaveText("42");
  await expect(cards.nth(2).locator("p").last()).toHaveText("15");
});

test("Memory Dashboard Retrieval Metrics 折叠面板", async ({ page }) => {
  await mockAuthenticatedUser(page);

  await page.route("**/api/memory/dashboard**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user_count: 1,
        memory_count: 10,
        fact_count: 5,
        avg_retention_score: 0.9,
        avg_importance_score: 0.5,
        low_retention_count: 0,
        high_importance_count: 3,
        recent_audit_count: 1,
      }),
    });
  });

  await page.goto("/memory");

  // 点击展开 Retrieval Metrics
  await page.getByText("Retrieval Metrics").click();
  // 未筛选用户时，显示提示
  await expect(page.getByText("Filter by a User ID")).toBeVisible();
});

// ============================================================================
// Timeline
// ============================================================================

test("Memory Timeline 加载用户和记忆列表", async ({ page }) => {
  await mockAuthenticatedUser(page);

  await page.route("**/api/memory**", async (route) => {
    if (route.request().url().includes("/api/memory/search")) return;
    if (route.request().url().includes("/api/memory/facts")) return;
    if (route.request().url().includes("/api/memory/dashboard")) return;
    if (route.request().url().includes("/api/memory/audit")) return;
    if (route.request().url().includes("/api/memory/conflicts")) return;
    if (route.request().url().includes("/api/memory/retrieval")) return;
    if (route.request().url().includes("/api/memory/automation")) return;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        users: [{ id: "user-1", label: "user-1 (3)" }],
        timeline: [
          {
            id: "mem-1",
            user_id: "user-1",
            app_name: "negentropy",
            memory_type: "episodic",
            content: "Test memory content",
            retention_score: 0.85,
            importance_score: 0.6,
            access_count: 2,
            created_at: "2026-05-01T10:00:00Z",
            metadata: {},
          },
        ],
        policies: { decay_lambda: 0.1 },
      }),
    });
  });

  await page.goto("/memory/timeline");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Memory Timeline")).toBeVisible();
  await expect(page.getByText("user-1 (3)")).toBeVisible();
  await expect(page.getByText("Test memory content")).toBeVisible();
  await expect(page.getByText("85%")).toBeVisible();
});

// ============================================================================
// Conflicts (new page)
// ============================================================================

test("Conflicts 页面加载和过滤", async ({ page }) => {
  await mockAuthenticatedUser(page);

  await page.route("**/api/memory/conflicts**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        count: 2,
        items: [
          {
            id: "conflict-1",
            user_id: "user-1",
            app_name: "negentropy",
            old_fact_id: "fact-old-1",
            new_fact_id: "fact-new-1",
            conflict_type: "value_contradiction",
            resolution: "pending",
            detected_by: "consolidation",
            created_at: "2026-05-01T10:00:00Z",
          },
          {
            id: "conflict-2",
            user_id: "user-1",
            app_name: "negentropy",
            conflict_type: "temporal_overlap",
            resolution: "supersede",
            detected_by: "key_match",
            created_at: "2026-05-02T10:00:00Z",
          },
        ],
      }),
    });
  });

  await page.goto("/memory/conflicts");
  await page.waitForLoadState("networkidle");

  // 验证冲突类型文本（列表中的值）
  await expect(page.getByText("value_contradiction")).toBeVisible();
  await expect(page.getByText("temporal_overlap")).toBeVisible();

  // 验证 resolution 徽章（用 badge locator 避免 dropdown 选项冲突）
  await expect(page.locator("button:has-text('pending')")).toBeVisible();
  await expect(page.locator("span:has-text('supersede')").first()).toBeVisible();

  // 测试 resolution 过滤
  const select = page.getByRole("combobox");
  await select.selectOption("Pending");
  await expect(page.getByText("value_contradiction")).toBeVisible();
});

test("Conflicts 页面点击冲突项显示详情", async ({ page }) => {
  await mockAuthenticatedUser(page);

  await page.route("**/api/memory/conflicts**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        count: 1,
        items: [
          {
            id: "conflict-1",
            user_id: "user-1",
            app_name: "negentropy",
            old_fact_id: "00000000-0000-0000-0000-000000000001",
            new_fact_id: "00000000-0000-0000-0000-000000000002",
            conflict_type: "value_contradiction",
            resolution: "pending",
            detected_by: "consolidation",
            created_at: "2026-05-01T10:00:00Z",
          },
        ],
      }),
    });
  });

  await page.goto("/memory/conflicts");
  await page.waitForLoadState("networkidle");

  // 点击冲突项（用 button 精确定位冲突卡片）
  await page.locator("button:has-text('value_contradiction')").click();

  // 验证详情面板
  await expect(page.getByText("Conflict Detail")).toBeVisible();
  // 用 aside 区域限定 "consolidation" 避免与列表项冲突
  await expect(page.locator("aside").getByText("consolidation")).toBeVisible();
  await expect(page.getByText("Resolve")).toBeVisible();
  // 详情面板内 4 个解决按钮（避免与 select dropdown 选项冲突）
  await expect(page.getByRole("button", { name: "supersede" })).toBeVisible();
  await expect(page.getByRole("button", { name: "keep_old" })).toBeVisible();
  await expect(page.getByRole("button", { name: "keep_new" })).toBeVisible();
  await expect(page.getByRole("button", { name: "merge" })).toBeVisible();
});

// ============================================================================
// Navigation
// ============================================================================

test("Memory 导航栏包含所有 7 个页面标签", async ({ page }) => {
  await mockAuthenticatedUser(page);

  await page.route("**/api/memory/dashboard**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user_count: 0,
        memory_count: 0,
        fact_count: 0,
        avg_retention_score: 0,
        avg_importance_score: 0,
        low_retention_count: 0,
        high_importance_count: 0,
        recent_audit_count: 0,
      }),
    });
  });

  await page.goto("/memory");

  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Timeline" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Facts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Audit" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Conflicts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Automation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Activity" })).toBeVisible();
});
