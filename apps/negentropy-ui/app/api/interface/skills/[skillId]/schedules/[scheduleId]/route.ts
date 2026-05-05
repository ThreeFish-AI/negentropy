import { proxyDelete } from "@/app/api/interface/_proxy";

/**
 * Skill 单条 schedule BFF 透传：DELETE 删除一条调度。
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ skillId: string; scheduleId: string }> },
) {
  const { skillId, scheduleId } = await params;
  return proxyDelete(request, `/interface/skills/${skillId}/schedules/${scheduleId}`);
}
