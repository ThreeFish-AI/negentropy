import { expect, test } from "@playwright/test";
import { makeSkill, mockAuthenticatedUser, mockSkillsApi, newSkillsState } from "./_helpers";

test.describe("Skills 编辑流程", () => {
  test("Edit modal 正确 prefill 含 JSON pretty + tools join", async ({ page }) => {
    await mockAuthenticatedUser(page);
    const skill = makeSkill({
      id: "edit-1",
      name: "edit-target",
      display_name: "Edit Target",
      description: "to edit",
      prompt_template: "do {{x}}",
      required_tools: ["a", "b"],
      config_schema: { type: "object" },
      default_config: { foo: "bar" },
      is_enabled: true,
    });
    await mockSkillsApi(page, newSkillsState([skill]));
    await page.goto("/interface/skills");
    await page.getByRole("button", { name: "Edit Edit Target" }).click();

    await expect(page.getByRole("heading", { name: "Edit Skill" })).toBeVisible();
    await expect(page.locator('input[placeholder="my-skill"]')).toHaveValue("edit-target");
    await expect(page.locator('textarea[placeholder*="get_file"]')).toHaveValue("a\nb");
    await expect(page.getByTestId("skills-form-config-schema")).toContainText('"type": "object"');
    await expect(page.getByTestId("skills-form-default-config")).toContainText('"foo": "bar"');
  });

  test("Inline toggle 关闭 Skill 后徽章变 Disabled，发送 PATCH is_enabled=false", async ({ page }) => {
    await mockAuthenticatedUser(page);
    const state = newSkillsState([
      makeSkill({ id: "tog-1", name: "tog-skill", display_name: "Tog", is_enabled: true }),
    ]);
    await mockSkillsApi(page, state);
    await page.goto("/interface/skills");

    const toggle = page.locator('button[aria-label="Disable Tog"]');
    await expect(toggle).toBeVisible();
    const patchResponse = page.waitForResponse(
      (resp) => resp.request().method() === "PATCH" && resp.url().includes("/api/interface/skills/"),
    );
    await toggle.click();
    await patchResponse;

    await expect(page.locator('button[aria-label="Enable Tog"]')).toBeVisible();
    const patch = state.calls.find((c) => c.method === "PATCH");
    expect(patch?.body).toEqual({ is_enabled: false });
  });

  test("Update 提交后列表刷新（PATCH 发送）", async ({ page }) => {
    await mockAuthenticatedUser(page);
    const skill = makeSkill({ id: "u1", name: "old-name", display_name: "Old" });
    const state = newSkillsState([skill]);
    await mockSkillsApi(page, state);
    await page.goto("/interface/skills");

    await page.getByRole("button", { name: "Edit Old" }).click();
    await page.locator('input[placeholder="My Skill"]').fill("New Display");
    const patchResponse = page.waitForResponse(
      (resp) => resp.request().method() === "PATCH" && resp.url().includes("/api/interface/skills/"),
    );
    await page.getByRole("button", { name: "Update", exact: true }).click();
    await patchResponse;

    await expect(page.getByRole("heading", { name: "New Display" })).toBeVisible();
    const patch = state.calls.find((c) => c.method === "PATCH");
    expect((patch?.body as Record<string, unknown>)?.display_name).toBe("New Display");
  });
});
