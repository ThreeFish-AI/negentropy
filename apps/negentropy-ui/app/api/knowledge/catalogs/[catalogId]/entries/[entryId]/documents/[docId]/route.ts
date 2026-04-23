import { proxyDelete } from "../../../../../../_proxy";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ catalogId: string; entryId: string; docId: string }> },
) {
  const { catalogId, entryId, docId } = await params;
  return proxyDelete(
    request,
    `/knowledge/catalogs/${catalogId}/entries/${entryId}/documents/${docId}`,
  );
}
