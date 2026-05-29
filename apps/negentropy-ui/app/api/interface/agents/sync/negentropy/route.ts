import { proxyPost } from "@/app/api/interface/_proxy";

/**
 * Negentropy 内置 Agents 同步代理
 *
 * POST /api/interface/agents/sync/negentropy
 */
export async function POST(request: Request) {
  return proxyPost(request, "/interface/agents/sync/negentropy");
}
