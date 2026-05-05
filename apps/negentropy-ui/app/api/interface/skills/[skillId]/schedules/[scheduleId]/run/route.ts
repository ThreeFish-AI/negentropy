import { proxyPost } from "@/app/api/interface/_proxy";

/**
 * 手动触发一条 Skill schedule（不等 cron tick）。
 *
 * POST /api/interface/skills/{skillId}/schedules/{scheduleId}/run
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ skillId: string; scheduleId: string }> },
) {
  const { skillId, scheduleId } = await params;
  return proxyPost(
    request,
    `/interface/skills/${skillId}/schedules/${scheduleId}/run`,
  );
}
