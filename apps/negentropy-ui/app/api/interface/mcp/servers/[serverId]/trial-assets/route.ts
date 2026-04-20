import { proxyPostFormData } from "@/app/api/interface/_proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  return proxyPostFormData(request, `/interface/mcp/servers/${serverId}/trial-assets`);
}
