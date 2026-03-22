import { proxyGet } from "@/app/api/plugins/_proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  return proxyGet(request, `/plugins/mcp/runs/${runId}`);
}
