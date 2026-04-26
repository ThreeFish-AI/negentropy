import { proxyGet, proxyPatch, proxyDelete } from "@/app/api/interface/_proxy";

/**
 * 单个 SubAgent API 代理端点
 *
 * GET    /api/interface/subagents/{agentId} - 获取 SubAgent 详情
 * PATCH  /api/interface/subagents/{agentId} - 更新 SubAgent
 * DELETE /api/interface/subagents/{agentId} - 删除 SubAgent
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  return proxyGet(request, `/interface/subagents/${agentId}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  return proxyPatch(request, `/interface/subagents/${agentId}`);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  return proxyDelete(request, `/interface/subagents/${agentId}`);
}
