import { expect, test } from "@playwright/test";

async function mockAuthenticatedUser(
  page: import("@playwright/test").Page,
  roles: string[] = ["admin"],
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

const DASHBOARD = {
  user_count: 7,
  memory_count: 42,
  fact_count: 15,
  avg_retention_score: 0.62,
  avg_importance_score: 0.5,
  low_retention_count: 3,
  high_importance_count: 8,
  recent_audit_count: 5,
};

const HEALTH = {
  status: "healthy",
  checks: {
    db: { status: "ok" },
    features: {
      hipporag: true,
      reflection: true,
      consolidation_legacy: false,
      consolidation_policy: "fail_tolerant",
      consolidation_steps: ["fact_extract", "summarize"],
      pii_engine: "presidio",
      pii_engine_actual: "presidio",
      relevance_enabled: true,
      gatekeeper_enabled: false,
    },
    tables: { memories: 42, facts: 15 },
  },
};

test("Overview 渲染 KPI 条、Pipeline 三阶段与健康胶囊", async ({ page }) => {
  await mockAuthenticatedUser(page);

  await page.route("**/api/memory/dashboard**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DASHBOARD),
    });
  });
  await page.route("**/api/memory/health**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(HEALTH),
    });
  });
  await page.route("**/api/memory/metrics**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        search_total_24h: 10,
        search_reference_rate: 0.7,
        search_helpful_rate: 0.8,
        consolidation_total_24h: 4,
        consolidation_retain_rate: 0.75,
        retention_score_avg: 0.62,
        retention_score_p10: 0.1,
        retention_score_p90: 0.95,
        low_retention_count: 3,
        memory_total: 42,
        pii_detection_rate: 0.1,
        pii_detected_count: 4,
        fact_count: 15,
        association_count: 20,
        kg_entity_count: 12,
      }),
    });
  });

  await page.goto("/memory/overview");
  await page.waitForLoadState("networkidle");

  // 标题与三阶段
  await expect(page.getByText("Memory Lifecycle Pipeline")).toBeVisible();
  await expect(page.getByText("Formation", { exact: true })).toBeVisible();
  await expect(page.getByText("Evolution", { exact: true })).toBeVisible();
  await expect(page.getByText("Retrieval", { exact: true })).toBeVisible();

  // KPI 条 + 健康胶囊
  await expect(page.getByText("Users", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Healthy/ })).toBeVisible();
});

test("Overview 在 health/metrics 不可用时仍结构性渲染 Pipeline", async ({ page }) => {
  await mockAuthenticatedUser(page, ["user"]);

  await page.route("**/api/memory/dashboard**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DASHBOARD),
    });
  });
  // health 端点禁用 → 404
  await page.route("**/api/memory/health**", async (route) => {
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  // 非 admin 不会请求 metrics；保险起见 mock 403
  await page.route("**/api/memory/metrics**", async (route) => {
    await route.fulfill({ status: 403, contentType: "application/json", body: "{}" });
  });

  await page.goto("/memory/overview");
  await page.waitForLoadState("networkidle");

  // Pipeline 结构始终在；健康胶囊降级为 Unknown
  await expect(page.getByText("Memory Lifecycle Pipeline")).toBeVisible();
  await expect(page.getByText("Formation", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Unknown/ })).toBeVisible();
});
