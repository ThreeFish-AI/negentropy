import { proxyGet } from "@/app/api/interface/_proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  return proxyGet(request, `/interface/mcp/servers/${serverId}/runs`);
}
