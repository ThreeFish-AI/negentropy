import { proxyGet, proxyPost } from "@/app/api/plugins/_proxy";

/**
 * SubAgents 集合 API 代理端点
 *
 * GET  /api/plugins/subagents - 列出 SubAgents
 * POST /api/plugins/subagents - 创建 SubAgent
 */

export async function GET(request: Request) {
  return proxyGet(request, "/plugins/subagents");
}

export async function POST(request: Request) {
  return proxyPost(request, "/plugins/subagents");
}
