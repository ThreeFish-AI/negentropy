import { proxyGet, proxyPost } from "@/app/api/interface/_proxy";

/**
 * MCP Servers 集合 API 代理端点
 *
 * GET  /api/interface/mcp/servers - 列出 MCP 服务器
 * POST /api/interface/mcp/servers - 创建 MCP 服务器
 */

export async function GET(request: Request) {
  return proxyGet(request, "/interface/mcp/servers");
}

export async function POST(request: Request) {
  return proxyPost(request, "/interface/mcp/servers");
}
