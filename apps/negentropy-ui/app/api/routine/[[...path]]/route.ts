import { proxyDelete, proxyGet, proxyPost, proxyPut } from "@/app/api/interface/_proxy";

/**
 * /api/routine/* → 后端 /routines/* 反向代理
 *
 * 复用 ``_proxy.ts`` 的鉴权 / Session 透传逻辑。SSE 流式端点 ``/api/routine/stream``
 * 由相邻路由独立处理，不走通用代理（避免 .text() 把流读完）。
 *
 * 路由结构：
 *   GET    /api/routine/kpis                         → /routines/kpis
 *   GET    /api/routine                              → /routines
 *   POST   /api/routine                              → /routines（新建）
 *   GET    /api/routine/{id}                         → /routines/{id}
 *   PUT    /api/routine/{id}                         → /routines/{id}（编辑）
 *   DELETE /api/routine/{id}                         → /routines/{id}（删除）
 *   GET    /api/routine/{id}/iterations              → /routines/{id}/iterations
 *   POST   /api/routine/{id}/{start|pause|resume|cancel}
 *   POST   /api/routine/{id}/iterations/{iid}/{approve|reject}
 */

type Ctx = { params: Promise<{ path?: string[] }> };

function buildBackendPath(segments: string[] | undefined): string {
  if (!segments || segments.length === 0) return "/routines";
  return "/routines/" + segments.map((s) => encodeURIComponent(s)).join("/");
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
