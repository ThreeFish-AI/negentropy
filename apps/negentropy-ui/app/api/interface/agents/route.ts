import { proxyGet, proxyPost } from "@/app/api/interface/_proxy";

/**
 * Agents 集合 API 代理端点
 *
 * GET  /api/interface/agents - 列出 Agents
 * POST /api/interface/agents - 创建 Agent
 */

export async function GET(request: Request) {
  return proxyGet(request, "/interface/agents");
}

export async function POST(request: Request) {
  return proxyPost(request, "/interface/agents");
}
