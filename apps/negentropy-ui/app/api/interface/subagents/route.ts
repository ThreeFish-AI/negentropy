import { proxyGet, proxyPost } from "@/app/api/interface/_proxy";

/**
 * SubAgents 集合 API 代理端点
 *
 * GET  /api/interface/subagents - 列出 SubAgents
 * POST /api/interface/subagents - 创建 SubAgent
 */

export async function GET(request: Request) {
  return proxyGet(request, "/interface/subagents");
}

export async function POST(request: Request) {
  return proxyPost(request, "/interface/subagents");
}
