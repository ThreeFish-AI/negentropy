import { proxyDelete, proxyGet, proxyPatch } from "@/app/api/interface/_proxy";

/**
 * 单个 Repository API 代理端点
 *
 * GET    /api/interface/repositories/{repositoryId} - 获取详情
 * PATCH  /api/interface/repositories/{repositoryId} - 更新
 * DELETE /api/interface/repositories/{repositoryId} - 删除
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ repositoryId: string }> },
) {
  const { repositoryId } = await params;
  return proxyGet(request, `/interface/repositories/${repositoryId}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ repositoryId: string }> },
) {
  const { repositoryId } = await params;
  return proxyPatch(request, `/interface/repositories/${repositoryId}`);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ repositoryId: string }> },
) {
  const { repositoryId } = await params;
  return proxyDelete(request, `/interface/repositories/${repositoryId}`);
}
