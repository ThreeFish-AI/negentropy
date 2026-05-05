import { proxyPost } from "@/app/api/interface/_proxy";

/**
 * Skill 调用（Layer 2 按需展开）API 代理端点
 *
 * POST /api/interface/skills/{skillId}:invoke — 用 Jinja2 沙箱渲染 prompt_template
 * 并附带资源摘要 + 工具差异。后端不调用 LLM，仅返回渲染结果，由 caller 决定如何使用。
 *
 * 注意：URL 中的 ``:invoke`` 是后端 FastAPI 路由的子路径，需要 BFF 透传时保留这个冒号
 * 段而非作为新的 path segment。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { skillId } = await params;
  return proxyPost(request, `/interface/skills/${skillId}/invoke`);
}
