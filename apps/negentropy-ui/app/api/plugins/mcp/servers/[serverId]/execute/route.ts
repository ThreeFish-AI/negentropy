import { proxyPost } from "@/app/api/plugins/_proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  return proxyPost(request, `/plugins/mcp/servers/${serverId}/tools:execute`);
}
