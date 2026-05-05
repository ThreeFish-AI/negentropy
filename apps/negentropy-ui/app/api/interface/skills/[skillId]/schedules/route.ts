import { proxyGet, proxyPost } from "@/app/api/interface/_proxy";

/**
 * Skill 定时调度（Phase 3）集合 BFF 透传：
 *
 * GET  /api/interface/skills/{skillId}/schedules — 列出 Skill 关联的全部 schedules
 * POST /api/interface/skills/{skillId}/schedules — 新增一条 cron 调度
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { skillId } = await params;
  return proxyGet(request, `/interface/skills/${skillId}/schedules`);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { skillId } = await params;
  return proxyPost(request, `/interface/skills/${skillId}/schedules`);
}
