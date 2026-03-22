import { proxyPostFormData } from "@/app/api/plugins/_proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  return proxyPostFormData(request, `/plugins/mcp/servers/${serverId}/trial-assets`);
}
