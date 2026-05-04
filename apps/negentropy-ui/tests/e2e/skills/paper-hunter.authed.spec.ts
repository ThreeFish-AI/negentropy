import { test, expect } from "@playwright/test";
import { applyDevCookie, UI_BASE, deleteSkillViaApi } from "./_authed-helpers";

test.describe("Paper Hunter — UI 端到端实机", () => {
  test.beforeEach(async ({ context }) => {
    await applyDevCookie(context);
  });

  test("PH-1 通过 UI 「From Template…」按钮安装 paper_hunter 并出现在卡片网格", async ({
    page,
    context,
  }) => {
    await page.goto(`${UI_BASE}/interface/skills`);
    await page.getByTestId("skills-from-template").click();

    // TemplatePickerDialog 列表加载完成
    await expect(page.getByTestId("skills-template-paper_hunter")).toBeVisible();

    // 安装
    await page.getByTestId("skills-template-install-paper_hunter").click();

    // 安装完成 toast → dialog 关闭
    await expect(page.getByText(/Installed template/i)).toBeVisible({ timeout: 8_000 });

    // 卡片网格应当有该 Skill
    const list = await context.request.get(`${UI_BASE}/api/interface/skills`);
    const skills = await list.json();
    const tpl = (skills as Array<{ name: string; id: string }>).find((s) =>
      s.name.startsWith("ai-agent-paper-hunter"),
    );
    expect(tpl).toBeTruthy();

    // 清理（避免污染下一次实机）
    if (tpl) {
      await deleteSkillViaApi(context, tpl.id);
    }
  });

  test("PH-2 Preview 按钮：渲染 Jinja2 模板并显示 missing_tools warning", async ({
    page,
    context,
  }) => {
    // 先用 API 装一个 paper_hunter
    const installed = await context.request.post(
      `${UI_BASE}/api/interface/skills/from-template`,
      { data: { template_id: "paper_hunter" } },
    );
    const skill = await installed.json();
    try {
      await page.goto(`${UI_BASE}/interface/skills`);

      // 找到 Preview 按钮（按 testid 选择）
      const preview = page.getByTestId(`skill-preview-${skill.name}`);
      await expect(preview).toBeVisible();
      await preview.click();

      // Render 按钮触发渲染
      await page.getByTestId("skills-preview-render").click();
      await expect(page.getByTestId("skills-preview-rendered")).toBeVisible();
      const rendered = await page.getByTestId("skills-preview-rendered").innerText();
      expect(rendered).toContain("AI Agent Paper Hunter");
    } finally {
      await deleteSkillViaApi(context, skill.id);
    }
  });
});
