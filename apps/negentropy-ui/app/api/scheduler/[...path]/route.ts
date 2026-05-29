import { proxyDelete, proxyGet, proxyPost, proxyPut } from "@/app/api/interface/_proxy";

/**
 * /api/scheduler/* → 后端 /scheduler/* 反向代理
 *
 * 复用 ``_proxy.ts`` 的鉴权 / Session 透传逻辑（buildAuthHeaders + X-Session-ID /
 * X-User-ID 转发）。SSE 流式端点 ``/api/scheduler/stream`` 由相邻路由独立处理，
 * 不走通用代理（避免 .text() 把流读完）。
 *
 * 路由结构：
 *   GET    /api/scheduler/kpis              → /scheduler/kpis
 *   GET    /api/scheduler/tasks             → /scheduler/tasks
 *   POST   /api/scheduler/tasks             → /scheduler/tasks（新建）
 *   GET    /api/scheduler/tasks/{id}        → /scheduler/tasks/{id}
 *   PUT    /api/scheduler/tasks/{id}        → /scheduler/tasks/{id}（编辑）
 *   DELETE /api/scheduler/tasks/{id}        → /scheduler/tasks/{id}（删除）
 *   GET    /api/scheduler/executions        → /scheduler/executions
 *   GET    /api/scheduler/stats             → /scheduler/stats
 *   GET    /api/scheduler/handlers          → /scheduler/handlers（manifest）
 *   POST   /api/scheduler/tasks/{id}/run    → /scheduler/tasks/{id}/run
 *   POST   /api/scheduler/tasks/{id}/toggle → /scheduler/tasks/{id}/toggle
 */

type Ctx = { params: Promise<{ path: string[] }> };

function buildBackendPath(segments: string[]): string {
  return "/scheduler/" + segments.map((s) => encodeURIComponent(s)).join("/");
}

export async function GET(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyGet(request, buildBackendPath(path));
}

export async function POST(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyPost(request, buildBackendPath(path));
}

export async function PUT(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyPut(request, buildBackendPath(path));
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyDelete(request, buildBackendPath(path));
}
