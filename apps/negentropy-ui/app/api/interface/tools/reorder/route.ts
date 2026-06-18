import { proxyPatch } from "@/app/api/interface/_proxy";

/**
 * BuiltinTool 批量排序端点
 *
 * PATCH /api/interface/tools/reorder - 批量更新 Tool 排序序号
 */

export async function PATCH(request: Request) {
  return proxyPatch(request, "/interface/tools/reorder");
}
