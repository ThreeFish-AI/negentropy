import { proxyPost } from "@/app/api/plugins/_proxy";

/**
 * Negentropy 内置 SubAgents 同步代理
 *
 * POST /api/plugins/subagents/sync/negentropy
 */
export async function POST(request: Request) {
  return proxyPost(request, "/plugins/subagents/sync/negentropy");
}
