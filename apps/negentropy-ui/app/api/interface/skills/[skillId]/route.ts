import { proxyGet, proxyPatch, proxyDelete } from "@/app/api/interface/_proxy";

/**
 * 单个 Skill API 代理端点
 *
 * GET    /api/interface/skills/{skillId} - 获取 Skill 详情
 * PATCH  /api/interface/skills/{skillId} - 更新 Skill
 * DELETE /api/interface/skills/{skillId} - 删除 Skill
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { skillId } = await params;
  return proxyGet(request, `/interface/skills/${skillId}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { skillId } = await params;
  return proxyPatch(request, `/interface/skills/${skillId}`);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { skillId } = await params;
  return proxyDelete(request, `/interface/skills/${skillId}`);
}
