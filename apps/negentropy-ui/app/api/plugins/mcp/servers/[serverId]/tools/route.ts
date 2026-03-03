import { proxyGet, proxyPost } from "@/app/api/plugins/_proxy";

/**
 * MCP Server Tools API 代理端点
 *
 * GET   /api/plugins/mcp/servers/[serverId]/tools - 列出已加载的 Tools
 * POST  /api/plugins/mcp/servers/[serverId]/tools - Load Tools 操作 (映射到 tools:load)
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  return proxyGet(request, `/plugins/mcp/servers/${serverId}/tools`);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  // 后端使用 tools:load 作为端点名称
  return proxyPost(request, `/plugins/mcp/servers/${serverId}/tools:load`);
}
