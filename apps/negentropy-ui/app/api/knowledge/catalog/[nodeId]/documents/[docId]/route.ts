import { proxyDelete } from "../../../../_proxy";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ nodeId: string; docId: string }> },
) {
  const { nodeId, docId } = await params;
  return proxyDelete(request, `/knowledge/catalog/nodes/${nodeId}/documents/${docId}`);
}
