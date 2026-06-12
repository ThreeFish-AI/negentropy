import { proxyPatch } from "@/app/api/interface/_proxy";

/**
 * MCP Server 批量排序端点
 *
 * PATCH /api/interface/mcp/servers/reorder - 批量更新 MCP Server 排序序号
 */

export async function PATCH(request: Request) {
  return proxyPatch(request, "/interface/mcp/servers/reorder");
}
