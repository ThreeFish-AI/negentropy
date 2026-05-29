import { proxyGet, proxyPatch, proxyDelete } from "@/app/api/interface/_proxy";

/**
 * 单个 Agent API 代理端点
 *
 * GET    /api/interface/agents/{agentId} - 获取 Agent 详情
 * PATCH  /api/interface/agents/{agentId} - 更新 Agent
 * DELETE /api/interface/agents/{agentId} - 删除 Agent
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  return proxyGet(request, `/interface/agents/${agentId}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  return proxyPatch(request, `/interface/agents/${agentId}`);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  return proxyDelete(request, `/interface/agents/${agentId}`);
}
