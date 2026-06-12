import { proxyPatch } from "@/app/api/interface/_proxy";

/**
 * Skill 批量排序端点
 *
 * PATCH /api/interface/skills/reorder - 批量更新 Skill 排序序号
 */

export async function PATCH(request: Request) {
  return proxyPatch(request, "/interface/skills/reorder");
}
