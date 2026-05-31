import { expect, test } from "@playwright/test";

async function mockAuthenticatedUser(
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

const HEALTH = {
  status: "healthy",
  checks: {
    db: { status: "ok" },
    features: {
      hipporag: true,
      reflection: false,
      consolidation_legacy: false,
      consolidation_policy: "fail_tolerant",
      consolidation_steps: ["fact_extract"],
      pii_engine: "presidio",
      pii_engine_actual: "presidio",
      relevance_enabled: true,
      gatekeeper_enabled: false,
    },
    tables: { memories: 42, facts: 15 },
  },
};

const RETRIEVAL = {
  total_retrievals: 128,
  precision_at_k: 0.72,
  utilization_rate: 0.55,
  noise_rate: 0.18,
};

const SYSTEM_METRICS = {
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
};

test("Insights（admin）展示检索质量、系统指标与健康卡", async ({ page }) => {
  await mockAuthenticatedUser(page, ["admin"]);

  await page.route("**/api/memory/health**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(HEALTH),
    });
  });
  await page.route("**/api/memory/retrieval/metrics**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(RETRIEVAL),
    });
  });
  await page.route("**/api/memory/metrics**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(SYSTEM_METRICS),
    });
  });

  await page.goto("/memory/insights");
  await page.waitForLoadState("networkidle");

  // 检索质量（全员）
  await expect(page.getByText("Retrieval Quality")).toBeVisible();
  await expect(page.getByText("128")).toBeVisible();

  // 系统指标（admin）
  await expect(page.getByText("System Metrics")).toBeVisible();
  await expect(page.getByText("Retention Distribution")).toBeVisible();

  // 健康卡 + feature 芯片
  await expect(page.getByText("System Health")).toBeVisible();
  await expect(page.getByText("HippoRAG (F1)")).toBeVisible();
});

test("Insights（非 admin）隐藏系统指标，仅显示检索质量与权限提示", async ({ page }) => {
  await mockAuthenticatedUser(page, ["user"]);

  await page.route("**/api/memory/health**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(HEALTH),
    });
  });
  await page.route("**/api/memory/retrieval/metrics**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(RETRIEVAL),
    });
  });

  await page.goto("/memory/insights");
  await page.waitForLoadState("networkidle");

  // 检索质量可见
  await expect(page.getByText("Retrieval Quality")).toBeVisible();
  // 系统指标不渲染，显示权限提示
  await expect(page.getByText("系统聚合指标需要管理员权限")).toBeVisible();
  await expect(page.getByText("System Metrics")).toHaveCount(0);
});
