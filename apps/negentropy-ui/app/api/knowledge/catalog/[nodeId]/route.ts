import { proxyGet, proxyPatch, proxyDelete } from "../../_proxy";

export async function GET(request: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  return proxyGet(request, `/catalog/nodes/${nodeId}`);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  return proxyPatch(request, `/catalog/nodes/${nodeId}`);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  return proxyDelete(request, `/catalog/nodes/${nodeId}`);
}
