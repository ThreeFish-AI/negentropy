import { proxyPost, proxyDelete } from "../../../../_proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ nodeId: string; docId: string }> },
) {
  const { nodeId, docId } = await params;
  return proxyPost(request, `/catalog/nodes/${nodeId}/documents/${docId}`);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ nodeId: string; docId: string }> },
) {
  const { nodeId, docId } = await params;
  return proxyDelete(request, `/catalog/nodes/${nodeId}/documents/${docId}`);
}
