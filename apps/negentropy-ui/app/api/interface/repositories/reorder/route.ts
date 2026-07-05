import { proxyPatch } from "@/app/api/interface/_proxy";

/**
 * Repository 批量排序端点
 *
 * PATCH /api/interface/repositories/reorder - 批量更新 Repository 排序序号
 */

export async function PATCH(request: Request) {
  return proxyPatch(request, "/interface/repositories/reorder");
}
