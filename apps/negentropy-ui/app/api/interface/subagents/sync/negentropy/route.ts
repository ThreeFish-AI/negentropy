import { proxyPost } from "@/app/api/interface/_proxy";

/**
 * Negentropy 内置 SubAgents 同步代理
 *
 * POST /api/interface/subagents/sync/negentropy
 */
export async function POST(request: Request) {
  return proxyPost(request, "/interface/subagents/sync/negentropy");
}
