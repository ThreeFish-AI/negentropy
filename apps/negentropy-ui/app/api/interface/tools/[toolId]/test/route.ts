import { proxyPost } from "@/app/api/interface/_proxy";

/**
 * Tool 测试连接 API 代理端点
 *
 * POST /api/interface/tools/{toolId}/test - 测试工具配置连通性
 */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ toolId: string }> },
) {
  const { toolId } = await params;
  return proxyPost(request, `/interface/tools/${toolId}:test`);
}
