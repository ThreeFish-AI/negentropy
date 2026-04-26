import { proxyGet } from "@/app/api/interface/_proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  return proxyGet(request, `/interface/mcp/runs/${runId}`);
}
