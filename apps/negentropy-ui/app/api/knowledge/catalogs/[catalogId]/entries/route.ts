import { proxyGet, proxyPost } from "../../../_proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const { catalogId } = await params;
  return proxyGet(request, `/knowledge/catalogs/${catalogId}/entries`);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const { catalogId } = await params;
  return proxyPost(request, `/knowledge/catalogs/${catalogId}/entries`);
}
