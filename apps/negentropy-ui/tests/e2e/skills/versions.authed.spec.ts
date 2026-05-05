import { test, expect } from "@playwright/test";
import {
  applyDevCookie,
  UI_BASE,
  uniqueName,
  createSkillViaApi,
  deleteSkillViaApi,
} from "./_authed-helpers";

test.describe("Skills 版本历史 — Phase 3 实机", () => {
  test.beforeEach(async ({ context }) => {
    await applyDevCookie(context);
  });

  test("V-1 创建 Skill 后初始版本立即可读", async ({ context }) => {
    const created = await createSkillViaApi(context, {
      name: uniqueName("authed-v1"),
      description: "version-init",
      category: "test",
      version: "1.0.0",
      config_schema: {},
      default_config: {},
      required_tools: [],
      is_enabled: true,
      priority: 0,
      visibility: "private",
    });
    try {
      const resp = await context.request.get(
        `${UI_BASE}/api/interface/skills/${created.id}/versions`,
      );
      expect(resp.ok()).toBeTruthy();
      const body = await resp.json();
      expect(Array.isArray(body)).toBeTruthy();
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body[0].version).toBe("1.0.0");
      expect(body[0].snapshot.name).toBe(created.name);
    } finally {
      await deleteSkillViaApi(context, created.id);
    }
  });

  test("V-2 PATCH 改 version 触发自动 snapshot", async ({ context }) => {
    const created = await createSkillViaApi(context, {
      name: uniqueName("authed-v2"),
      description: "version-bump",
      category: "test",
      version: "1.0.0",
      config_schema: {},
      default_config: {},
      required_tools: [],
      is_enabled: true,
      priority: 0,
      visibility: "private",
    });
    try {
      const patch = await context.request.patch(
        `${UI_BASE}/api/interface/skills/${created.id}`,
        { data: { version: "1.1.0", description: "bumped" } },
      );
      expect(patch.ok()).toBeTruthy();

      const resp = await context.request.get(
        `${UI_BASE}/api/interface/skills/${created.id}/versions`,
      );
      const body = await resp.json();
      const versions: string[] = body.map((v: { version: string }) => v.version);
      expect(versions).toEqual(expect.arrayContaining(["1.0.0", "1.1.0"]));
    } finally {
      await deleteSkillViaApi(context, created.id);
    }
  });

  test("V-3 手动 POST /versions 同 version 重复报 409", async ({ context }) => {
    const created = await createSkillViaApi(context, {
      name: uniqueName("authed-v3"),
      description: "manual-snapshot",
      category: "test",
      version: "1.0.0",
      config_schema: {},
      default_config: {},
      required_tools: [],
      is_enabled: true,
      priority: 0,
      visibility: "private",
    });
    try {
      // 手动同 version 1.0.0 → 409（初始已存在）
      const resp = await context.request.post(
        `${UI_BASE}/api/interface/skills/${created.id}/versions`,
        { data: { version: "1.0.0" } },
      );
      expect(resp.status()).toBe(409);

      // 手动新版本 2.0.0 → 201
      const resp2 = await context.request.post(
        `${UI_BASE}/api/interface/skills/${created.id}/versions`,
        { data: { version: "2.0.0" } },
      );
      expect(resp2.status()).toBe(201);
    } finally {
      await deleteSkillViaApi(context, created.id);
    }
  });
});
