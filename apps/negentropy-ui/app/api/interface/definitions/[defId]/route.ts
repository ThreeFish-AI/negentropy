import { proxyGet, proxyPut, proxyDelete } from "@/app/api/interface/_proxy";

/**
 * 单条 Definition API 代理端点（定义源 SSOT）
 *
 * GET    /api/interface/definitions/{defId} - 获取定义源详情
 * PUT    /api/interface/definitions/{defId} - 更新定义源（admin）
 * DELETE /api/interface/definitions/{defId} - 删除定义源（admin；系统内置受保护）
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ defId: string }> },
) {
  const { defId } = await params;
  return proxyGet(request, `/interface/definitions/${defId}`);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ defId: string }> },
) {
  const { defId } = await params;
  return proxyPut(request, `/interface/definitions/${defId}`);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ defId: string }> },
) {
  const { defId } = await params;
  return proxyDelete(request, `/interface/definitions/${defId}`);
}
