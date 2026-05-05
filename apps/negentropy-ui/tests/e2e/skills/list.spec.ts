import { expect, test } from "@playwright/test";
import { makeSkill, mockAuthenticatedUser, mockSkillsApi, newSkillsState } from "./_helpers";

test.describe("Skills 列表页", () => {
  test("空态展示 No skills + 主动作按钮", async ({ page }) => {
    await mockAuthenticatedUser(page);
    const state = newSkillsState();
    await mockSkillsApi(page, state);
    await page.goto("/interface/skills");

    await expect(page.getByRole("heading", { name: "Skills", exact: true })).toBeVisible();
    await expect(page.getByText("No skills defined yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create your first skill →" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Skill" })).toBeVisible();
  });

  test("Categories 仅在 skills.length > 0 时展示", async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockSkillsApi(page, newSkillsState());
    await page.goto("/interface/skills");

    await expect(page.locator("select")).toHaveCount(0);
  });

  test("有数据时渲染卡片网格", async ({ page }) => {
    await mockAuthenticatedUser(page);
    const state = newSkillsState([
      makeSkill({ id: "a", name: "alpha", category: "research" }),
      makeSkill({ id: "b", name: "beta", category: "data", is_enabled: false }),
    ]);
    await mockSkillsApi(page, state);
    await page.goto("/interface/skills");

    await expect(page.getByTestId("skill-grid-item")).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "alpha" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "beta" })).toBeVisible();
  });

  test("加载错误展示 alert role banner", async ({ page }) => {
    await mockAuthenticatedUser(page);
    await page.route("**/api/interface/skills**", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: '{"detail":"boom"}' });
    });
    await page.goto("/interface/skills");

    await expect(page.getByText("Failed to fetch skills")).toBeVisible();
  });
});
