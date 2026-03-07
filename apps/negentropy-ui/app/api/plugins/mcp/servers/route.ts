import { proxyGet, proxyPost } from "@/app/api/plugins/_proxy";

/**
 * MCP Servers 集合 API 代理端点
 *
 * GET  /api/plugins/mcp/servers - 列出 MCP 服务器
 * POST /api/plugins/mcp/servers - 创建 MCP 服务器
 */

export async function GET(request: Request) {
  return proxyGet(request, "/plugins/mcp/servers");
}

export async function POST(request: Request) {
  return proxyPost(request, "/plugins/mcp/servers");
}
