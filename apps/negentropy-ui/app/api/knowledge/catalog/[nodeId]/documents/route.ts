import { proxyGet, proxyPost } from "../../../_proxy";

export async function GET(request: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  return proxyGet(request, `/knowledge/catalog/nodes/${nodeId}/documents`);
}

export async function POST(request: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  return proxyPost(request, `/knowledge/catalog/nodes/${nodeId}/documents`);
}
