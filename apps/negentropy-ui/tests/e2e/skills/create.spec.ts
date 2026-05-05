import { expect, test } from "@playwright/test";
import { mockAuthenticatedUser, mockSkillsApi, newSkillsState } from "./_helpers";

test.describe("Skills 创建流程", () => {
  test("Name 必填 — 浏览器原生 required 校验", async ({ page }) => {
    await mockAuthenticatedUser(page);
    const state = newSkillsState();
    await mockSkillsApi(page, state);
    await page.goto("/interface/skills");
    await page.getByRole("button", { name: "Add Skill" }).click();
    await page.getByRole("button", { name: "Create", exact: true }).click();

    const isInvalid = await page.locator('input[placeholder="my-skill"]').evaluate(
      (el) => (el as HTMLInputElement).validity.valueMissing,
    );
    expect(isInvalid).toBe(true);
    expect(state.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  test("非法 JSON 触发字段级错误锚定，不触发 POST", async ({ page }) => {
    await mockAuthenticatedUser(page);
    const state = newSkillsState();
    await mockSkillsApi(page, state);
    await page.goto("/interface/skills");
    await page.getByRole("button", { name: "Add Skill" }).click();

    await page.locator('input[placeholder="my-skill"]').fill("bad-json");
    await page.getByTestId("skills-form-config-schema").fill("{ broken");
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await expect(page.getByTestId("skills-form-error")).toContainText("Fix the highlighted JSON fields");
    await expect(page.getByTestId("skills-form-config-schema-error")).toContainText("Invalid JSON");
    await expect(page.getByTestId("skills-form-config-schema")).toHaveAttribute("aria-invalid", "true");
    expect(state.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  test("成功创建 Skill 后列表刷新且发送正确 payload", async ({ page }) => {
    await mockAuthenticatedUser(page);
    const state = newSkillsState();
    await mockSkillsApi(page, state);
    await page.goto("/interface/skills");
    await page.getByRole("button", { name: "Add Skill" }).click();

    await page.locator('input[placeholder="my-skill"]').fill("arxiv-fetch");
    await page.locator('input[placeholder="My Skill"]').fill("ArXiv Fetch");
    await page.locator('textarea[placeholder="Description of this skill"]').fill("Search and fetch arXiv papers");
    await page.locator('input[placeholder="general"]').fill("research");
    await page.locator('textarea[placeholder*="get_file"]').fill("search_arxiv\nfetch_pdf");

    await page.getByRole("button", { name: "Create", exact: true }).click();

    await expect(page.getByRole("heading", { name: "ArXiv Fetch" })).toBeVisible();
    const post = state.calls.find((c) => c.method === "POST");
    expect(post?.body).toMatchObject({
      name: "arxiv-fetch",
      display_name: "ArXiv Fetch",
      category: "research",
      required_tools: ["search_arxiv", "fetch_pdf"],
      visibility: "private",
      is_enabled: true,
    });
  });
});
