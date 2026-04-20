import { proxyGet, proxyPost } from "@/app/api/interface/_proxy";

/**
 * Skills 集合 API 代理端点
 *
 * GET  /api/interface/skills - 列出 Skills (支持 category 查询参数)
 * POST /api/interface/skills - 创建 Skill
 */

export async function GET(request: Request) {
  return proxyGet(request, "/interface/skills");
}

export async function POST(request: Request) {
  return proxyPost(request, "/interface/skills");
}
