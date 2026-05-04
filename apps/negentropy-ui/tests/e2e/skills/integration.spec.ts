import { expect, test } from "@playwright/test";
import { makeSkill, mockAuthenticatedUser, mockSkillsApi, newSkillsState } from "./_helpers";

test.describe("Skills 跨模块联动", () => {
  test("Filter 切换 → URL ?category= 正确编码", async ({ page }) => {
    await mockAuthenticatedUser(page);
    const state = newSkillsState([
      makeSkill({ id: "1", name: "a", category: "research" }),
      makeSkill({ id: "2", name: "b", category: "data" }),
    ]);
    await mockSkillsApi(page, state);
    await page.goto("/interface/skills");

    await page.locator("select").selectOption("research");
    await expect(page.getByTestId("skill-grid-item")).toHaveCount(1);

    const filteredCalls = state.calls.filter((c) => c.method === "GET" && c.url.includes("category="));
    expect(filteredCalls.length).toBeGreaterThan(0);
    expect(filteredCalls.some((c) => c.url.includes("category=research"))).toBe(true);
  });

  test("Filter 含特殊字符通过 encodeURIComponent 编码", async ({ page }) => {
    await mockAuthenticatedUser(page);
    const state = newSkillsState([makeSkill({ id: "1", category: "a&b/c" })]);
    await mockSkillsApi(page, state);
    await page.goto("/interface/skills");

    const filteredRequest = page.waitForRequest((req) => /category=a%26b%2Fc/.test(req.url()));
    await page.locator("select").selectOption("a&b/c");
    await filteredRequest;
    const calls = state.calls.filter((c) => c.method === "GET");
    expect(calls.some((c) => c.url.includes("category=a%26b%2Fc"))).toBe(true);
  });

  test("DELETE 失败时 toast 出现 + 卡片仍在", async ({ page }) => {
    await mockAuthenticatedUser(page);
    const state = newSkillsState([makeSkill({ id: "fail", name: "stay", display_name: "Stay" })]);
    state.failNextDelete = { status: 500, detail: "backend exploded" };
    await mockSkillsApi(page, state);
    await page.goto("/interface/skills");

    await page.getByRole("button", { name: "Delete Stay" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByText("backend exploded")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Stay" })).toBeVisible();
  });
});
