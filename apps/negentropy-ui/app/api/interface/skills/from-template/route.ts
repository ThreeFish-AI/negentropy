import { proxyPost } from "@/app/api/interface/_proxy";

/**
 * 一键安装 Skill 模板的 API 代理端点
 *
 * POST /api/interface/skills/from-template — 把内置 YAML 模板物化为 owner 的 Skill 行；
 * 后端会在 name 冲突时自动追加 owner short id 后缀，调用方无需重试。
 */
export async function POST(request: Request) {
  return proxyPost(request, "/interface/skills/from-template");
}
