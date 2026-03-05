import { proxyGet } from "@/app/api/plugins/_proxy";

/**
 * Negentropy 内置 SubAgent 模板代理
 *
 * GET /api/plugins/subagents/templates/negentropy
 */
export async function GET(request: Request) {
  return proxyGet(request, "/plugins/subagents/templates/negentropy");
}
