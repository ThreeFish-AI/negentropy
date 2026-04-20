import { proxyGet } from "@/app/api/interface/_proxy";

/**
 * Negentropy 内置 SubAgent 模板代理
 *
 * GET /api/interface/subagents/templates/negentropy
 */
export async function GET(request: Request) {
  return proxyGet(request, "/interface/subagents/templates/negentropy");
}
