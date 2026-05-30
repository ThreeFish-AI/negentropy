import { afterEach, describe, expect, it, vi } from "vitest";

import {
  approveIteration,
  controlRoutine,
  createRoutine,
  deleteRoutine,
  fetchIterations,
  fetchKpis,
  fetchRoutineDetail,
  fetchRoutines,
  rejectIteration,
  updateRoutine,
} from "@/features/routine";
import type { RoutineCreatePayload, RoutineUpdatePayload } from "@/features/routine";

/**
 * Routine API 客户端单测。
 *
 * 验证三件事：① 请求 URL（含查询串编码 / 路径段转义）；② HTTP 方法与
 * Content-Type / body 序列化；③ 解析返回值与错误分支（非 2xx 抛错且携带后端 detail）。
 */

const ok = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("routine api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchKpis 命中 /kpis 并解析返回体", async () => {
    const kpis = { total: 3, running: 1 };
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(ok(kpis));

    await expect(fetchKpis()).resolves.toMatchObject(kpis);
    expect(spy).toHaveBeenCalledWith(
      "/api/routine/kpis",
      expect.objectContaining({ cache: "no-store", headers: expect.objectContaining({ "Content-Type": "application/json" }) }),
    );
  });

  it("fetchRoutines 无 filter 时不附加查询串", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(ok({ items: [], next_cursor: null, has_more: false }));

    await fetchRoutines();
    expect(spy).toHaveBeenCalledWith("/api/routine", expect.any(Object));
  });

  it("fetchRoutines 序列化 status 与 q 查询参数", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(ok({ items: [], next_cursor: null, has_more: false }));

    await fetchRoutines({ status: "running", q: "deep work" });
    const url = spy.mock.calls[0]?.[0] as string;
    expect(url.startsWith("/api/routine?")).toBe(true);
    expect(url).toContain("status=running");
    // 空格按 application/x-www-form-urlencoded 编码为 +
    expect(url).toContain("q=deep+work");
  });

  it("fetchRoutineDetail 转义路径段并带 recent 参数", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(ok({ id: "a/b" }));

    await fetchRoutineDetail("a/b", 5);
    expect(spy).toHaveBeenCalledWith("/api/routine/a%2Fb?recent=5", expect.any(Object));
  });

  it("fetchRoutineDetail recent 默认 20", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(ok({ id: "r1" }));

    await fetchRoutineDetail("r1");
    expect(spy).toHaveBeenCalledWith("/api/routine/r1?recent=20", expect.any(Object));
  });

  it("fetchIterations 无选项时不附加查询串", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(ok({ items: [], has_more: false, next_before_seq: null }));

    await fetchIterations("r1");
    expect(spy).toHaveBeenCalledWith("/api/routine/r1/iterations", expect.any(Object));
  });

  it("fetchIterations 透传 limit 与 before_seq（含 0）", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(ok({ items: [], has_more: false, next_before_seq: null }));

    await fetchIterations("r1", { limit: 10, before_seq: 0 });
    const url = spy.mock.calls[0]?.[0] as string;
    expect(url).toContain("limit=10");
    // before_seq=0 不应被当作 falsy 而丢弃
    expect(url).toContain("before_seq=0");
  });

  it("createRoutine 以 POST 发送 JSON body", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(ok({ id: "new" }));
    const body: RoutineCreatePayload = {
      key: "k1",
      title: "T",
      goal: "G",
      acceptance_criteria: "AC",
    };

    await expect(createRoutine(body)).resolves.toMatchObject({ id: "new" });
    expect(spy).toHaveBeenCalledWith(
      "/api/routine",
      expect.objectContaining({ method: "POST", body: JSON.stringify(body) }),
    );
  });

  it("updateRoutine 以 PUT 发送 JSON body 并转义 id", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(ok({ id: "r 1" }));
    const body: RoutineUpdatePayload = { title: "T2" };

    await updateRoutine("r 1", body);
    expect(spy).toHaveBeenCalledWith(
      "/api/routine/r%201",
      expect.objectContaining({ method: "PUT", body: JSON.stringify(body) }),
    );
  });

  it("deleteRoutine 以 DELETE 命中资源路径", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(ok({ ok: true, deleted_routine_id: "r1" }));

    await expect(deleteRoutine("r1")).resolves.toEqual({ ok: true, deleted_routine_id: "r1" });
    expect(spy).toHaveBeenCalledWith("/api/routine/r1", expect.objectContaining({ method: "DELETE" }));
  });

  it.each(["start", "pause", "resume", "cancel"] as const)(
    "controlRoutine 拼接 %s 动作并 POST",
    async (action) => {
      const spy = vi.spyOn(global, "fetch").mockResolvedValue(ok({ id: "r1" }));

      await controlRoutine("r1", action);
      expect(spy).toHaveBeenCalledWith(`/api/routine/r1/${action}`, expect.objectContaining({ method: "POST" }));
    },
  );

  it("approveIteration 命中 approve 子路径并转义两段 id", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(ok({ id: "it1" }));

    await approveIteration("r/1", "it 1");
    expect(spy).toHaveBeenCalledWith(
      "/api/routine/r%2F1/iterations/it%201/approve",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejectIteration 命中 reject 子路径", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(ok({ id: "it1" }));

    await rejectIteration("r1", "it1");
    expect(spy).toHaveBeenCalledWith(
      "/api/routine/r1/iterations/it1/reject",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("非 2xx 响应抛错并携带后端结构化 detail", async () => {
    // 用 mockImplementation 每次返回新 Response：Response body 仅可读一次，
    // 否则二次断言会拿到已被消费的空 body。
    vi.spyOn(global, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ detail: "boom" }), {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchKpis()).rejects.toThrow(/500/);
    await expect(fetchKpis()).rejects.toThrow(/boom/);
  });

  it("非 2xx 且 body 非 JSON 时回退到文本 / statusText", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("plain text error", { status: 404, statusText: "Not Found" }),
    );

    await expect(fetchRoutines()).rejects.toThrow(/404/);
  });
});
