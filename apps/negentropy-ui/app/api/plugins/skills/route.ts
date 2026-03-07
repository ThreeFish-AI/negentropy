import { proxyGet, proxyPost } from "@/app/api/plugins/_proxy";

/**
 * Skills 集合 API 代理端点
 *
 * GET  /api/plugins/skills - 列出 Skills (支持 category 查询参数)
 * POST /api/plugins/skills - 创建 Skill
 */

export async function GET(request: Request) {
  return proxyGet(request, "/plugins/skills");
}

export async function POST(request: Request) {
  return proxyPost(request, "/plugins/skills");
}
