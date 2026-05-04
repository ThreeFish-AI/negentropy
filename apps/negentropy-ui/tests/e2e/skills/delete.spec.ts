import { expect, test } from "@playwright/test";
import { makeSkill, mockAuthenticatedUser, mockSkillsApi, newSkillsState } from "./_helpers";

test.describe("Skills 删除流程", () => {
  test("ConfirmDialog 弹出，标题与目标 skill 文案匹配", async ({ page }) => {
    await mockAuthenticatedUser(page);
    const state = newSkillsState([makeSkill({ id: "d1", name: "kill-me", display_name: "Kill Me" })]);
    await mockSkillsApi(page, state);
    await page.goto("/interface/skills");

    await page.getByRole("button", { name: "Delete Kill Me" }).click();

    await expect(page.getByRole("heading", { name: "Delete skill?" })).toBeVisible();
    await expect(page.getByText('"Kill Me" will be permanently removed.')).toBeVisible();
    expect(state.calls.filter((c) => c.method === "DELETE")).toHaveLength(0);
  });

  test("Cancel 按钮关闭 dialog 而不调用 DELETE", async ({ page }) => {
    await mockAuthenticatedUser(page);
    const state = newSkillsState([makeSkill({ id: "d2", name: "keep", display_name: "Keep" })]);
    await mockSkillsApi(page, state);
    await page.goto("/interface/skills");

    await page.getByRole("button", { name: "Delete Keep" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByRole("heading", { name: "Delete skill?" })).toBeHidden();
    expect(state.calls.filter((c) => c.method === "DELETE")).toHaveLength(0);
  });

  test("ESC 关闭 dialog 而不调用 DELETE", async ({ page }) => {
    await mockAuthenticatedUser(page);
    const state = newSkillsState([makeSkill({ id: "d3", name: "esc-test", display_name: "Esc" })]);
    await mockSkillsApi(page, state);
    await page.goto("/interface/skills");

    await page.getByRole("button", { name: "Delete Esc" }).click();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("heading", { name: "Delete skill?" })).toBeHidden();
    expect(state.calls.filter((c) => c.method === "DELETE")).toHaveLength(0);
  });

  test("Confirm 触发 DELETE 并从列表移除", async ({ page }) => {
    await mockAuthenticatedUser(page);
    const state = newSkillsState([makeSkill({ id: "d4", name: "bye", display_name: "Bye" })]);
    await mockSkillsApi(page, state);
    await page.goto("/interface/skills");

    await page.getByRole("button", { name: "Delete Bye" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Bye" })).toBeHidden();
    await expect(page.getByText("No skills defined yet.")).toBeVisible();
    expect(state.calls.filter((c) => c.method === "DELETE")).toHaveLength(1);
  });
});
