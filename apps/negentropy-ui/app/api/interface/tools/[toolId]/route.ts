import { proxyGet, proxyPatch, proxyDelete } from "@/app/api/interface/_proxy";

/**
 * 单个 Tool API 代理端点
 *
 * GET    /api/interface/tools/{toolId} - 获取工具详情
 * PATCH  /api/interface/tools/{toolId} - 更新工具
 * DELETE /api/interface/tools/{toolId} - 删除工具
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ toolId: string }> },
) {
  const { toolId } = await params;
  return proxyGet(request, `/interface/tools/${toolId}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ toolId: string }> },
) {
  const { toolId } = await params;
  return proxyPatch(request, `/interface/tools/${toolId}`);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ toolId: string }> },
) {
  const { toolId } = await params;
  return proxyDelete(request, `/interface/tools/${toolId}`);
}
