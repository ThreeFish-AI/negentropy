import { proxyGet, proxyPatch, proxyDelete } from "../../_proxy";

export async function GET(request: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  return proxyGet(request, `/knowledge/catalog/nodes/${nodeId}`);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  return proxyPatch(request, `/knowledge/catalog/nodes/${nodeId}`);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  return proxyDelete(request, `/knowledge/catalog/nodes/${nodeId}`);
}
