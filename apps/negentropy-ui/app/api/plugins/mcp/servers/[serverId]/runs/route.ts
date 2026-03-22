import { proxyGet } from "@/app/api/plugins/_proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  return proxyGet(request, `/plugins/mcp/servers/${serverId}/runs`);
}
