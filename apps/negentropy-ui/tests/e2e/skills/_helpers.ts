import type { Page, Route } from "@playwright/test";

export interface FakeSkill {
  id: string;
  owner_id: string;
  visibility: string;
  name: string;
  display_name: string | null;
  description: string | null;
  category: string;
  version: string;
  prompt_template: string | null;
  config_schema: Record<string, unknown>;
  default_config: Record<string, unknown>;
  required_tools: string[];
  is_enabled: boolean;
  priority: number;
}

export function makeSkill(partial: Partial<FakeSkill> = {}): FakeSkill {
  return {
    id: partial.id ?? "skill-1",
    owner_id: partial.owner_id ?? "google:test-user",
    visibility: partial.visibility ?? "private",
    name: partial.name ?? "demo-skill",
    display_name: partial.display_name ?? null,
    description: partial.description ?? "demo description",
    category: partial.category ?? "general",
    version: partial.version ?? "1.0.0",
    prompt_template: partial.prompt_template ?? null,
    config_schema: partial.config_schema ?? {},
    default_config: partial.default_config ?? {},
    required_tools: partial.required_tools ?? [],
    is_enabled: partial.is_enabled ?? true,
    priority: partial.priority ?? 0,
  };
}

export async function mockAuthenticatedUser(page: Page, opts: { isAdmin?: boolean } = {}) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          userId: "google:test-user",
          email: "test@example.com",
          name: "Test User",
          roles: opts.isAdmin ? ["admin"] : ["user"],
        },
        permissions: { is_admin: !!opts.isAdmin },
      }),
    });
  });
}

/**
 * 注册 /api/interface/skills 全套 CRUDL 拦截。
 *
 * - 数据存放在 ``state.list``；mutator 直接修改它，便于跨请求保持一致。
 * - 调用方可注入 ``onCall`` 监听具体请求做断言。
 */
export interface SkillsApiMockState {
  list: FakeSkill[];
  calls: Array<{ method: string; url: string; body?: unknown }>;
  failNextDelete?: { status: number; detail?: string };
  failNextPost?: { status: number; detail?: string };
  failNextPatch?: { status: number; detail?: string };
}

export async function mockSkillsApi(page: Page, state: SkillsApiMockState) {
  await page.route("**/api/interface/skills**", async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const url = request.url();
    let body: unknown;
    if (method === "POST" || method === "PATCH") {
      try {
        body = JSON.parse(request.postData() || "{}");
      } catch {
        body = request.postData();
      }
    }
    state.calls.push({ method, url, body });

    if (method === "GET") {
      const m = url.match(/category=([^&]*)/u);
      const category = m ? decodeURIComponent(m[1]) : null;
      const out = category ? state.list.filter((s) => s.category === category) : state.list;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(out),
      });
      return;
    }

    if (method === "POST") {
      if (state.failNextPost) {
        const err = state.failNextPost;
        state.failNextPost = undefined;
        await route.fulfill({
          status: err.status,
          contentType: "application/json",
          body: JSON.stringify({ detail: err.detail || "post failed" }),
        });
        return;
      }
      const payload = (body || {}) as Partial<FakeSkill>;
      const created: FakeSkill = makeSkill({
        id: `skill-${Date.now()}`,
        ...payload,
      });
      state.list.push(created);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
      return;
    }

    if (method === "PATCH") {
      if (state.failNextPatch) {
        const err = state.failNextPatch;
        state.failNextPatch = undefined;
        await route.fulfill({
          status: err.status,
          contentType: "application/json",
          body: JSON.stringify({ detail: err.detail || "patch failed" }),
        });
        return;
      }
      const m = url.match(/skills\/([^/?]+)/u);
      const id = m ? m[1] : null;
      const idx = state.list.findIndex((s) => s.id === id);
      if (idx < 0) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not found" }) });
        return;
      }
      state.list[idx] = { ...state.list[idx], ...((body || {}) as Partial<FakeSkill>) };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(state.list[idx]),
      });
      return;
    }

    if (method === "DELETE") {
      if (state.failNextDelete) {
        const err = state.failNextDelete;
        state.failNextDelete = undefined;
        await route.fulfill({
          status: err.status,
          contentType: "application/json",
          body: JSON.stringify({ detail: err.detail || "delete failed" }),
        });
        return;
      }
      const m = url.match(/skills\/([^/?]+)/u);
      const id = m ? m[1] : null;
      state.list = state.list.filter((s) => s.id !== id);
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.continue();
  });
}

export function newSkillsState(seed: FakeSkill[] = []): SkillsApiMockState {
  return { list: [...seed], calls: [] };
}
