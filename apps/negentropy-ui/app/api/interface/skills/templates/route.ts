import { proxyGet } from "@/app/api/interface/_proxy";

/**
 * Skill 模板列表 API 代理端点
 *
 * GET /api/interface/skills/templates — 列出内置 Skill 模板（首发：Paper Hunter）
 * 路由声明顺序：必须在 /skills/{skillId} 之前以避免被动态路径吞噬。
 */
export async function GET(request: Request) {
  return proxyGet(request, "/interface/skills/templates");
}
