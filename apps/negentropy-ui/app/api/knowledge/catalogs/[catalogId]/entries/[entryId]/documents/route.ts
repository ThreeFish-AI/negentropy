import { proxyGet, proxyPost } from "../../../../../_proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ catalogId: string; entryId: string }> },
) {
  const { catalogId, entryId } = await params;
  return proxyGet(request, `/knowledge/catalogs/${catalogId}/entries/${entryId}/documents`);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ catalogId: string; entryId: string }> },
) {
  const { catalogId, entryId } = await params;
  return proxyPost(request, `/knowledge/catalogs/${catalogId}/entries/${entryId}/documents`);
}
