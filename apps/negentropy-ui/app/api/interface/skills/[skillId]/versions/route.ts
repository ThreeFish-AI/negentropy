import { proxyGet, proxyPost } from "@/app/api/interface/_proxy";

/**
 * Skill 历史版本（Phase 3）BFF 透传：
 *
 * GET  /api/interface/skills/{skillId}/versions — 列出全部历史版本（最新在前）
 * POST /api/interface/skills/{skillId}/versions — 手动 freeze 当前 Skill 字段为新快照
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { skillId } = await params;
  return proxyGet(request, `/interface/skills/${skillId}/versions`);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { skillId } = await params;
  return proxyPost(request, `/interface/skills/${skillId}/versions`);
}
