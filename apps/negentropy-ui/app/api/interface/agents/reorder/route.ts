import { proxyPatch } from "@/app/api/interface/_proxy";

/**
 * Agent 批量排序端点
 *
 * PATCH /api/interface/agents/reorder - 批量更新 Agent 排序序号
 */

export async function PATCH(request: Request) {
  return proxyPatch(request, "/interface/agents/reorder");
}
