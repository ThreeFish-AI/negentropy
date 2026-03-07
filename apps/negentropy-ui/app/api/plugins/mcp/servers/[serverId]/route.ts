import { proxyGet, proxyPatch, proxyDelete } from "@/app/api/plugins/_proxy";

/**
 * 单个 MCP Server API 代理端点
 *
 * GET    /api/plugins/mcp/servers/{serverId} - 获取 MCP 服务器详情
 * PATCH  /api/plugins/mcp/servers/{serverId} - 更新 MCP 服务器
 * DELETE /api/plugins/mcp/servers/{serverId} - 删除 MCP 服务器
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  return proxyGet(request, `/plugins/mcp/servers/${serverId}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  return proxyPatch(request, `/plugins/mcp/servers/${serverId}`);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  return proxyDelete(request, `/plugins/mcp/servers/${serverId}`);
}
