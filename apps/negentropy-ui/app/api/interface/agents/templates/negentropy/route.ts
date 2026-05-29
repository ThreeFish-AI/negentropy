import { proxyGet } from "@/app/api/interface/_proxy";

/**
 * Negentropy 内置 Agent 模板代理
 *
 * GET /api/interface/agents/templates/negentropy
 */
export async function GET(request: Request) {
  return proxyGet(request, "/interface/agents/templates/negentropy");
}
