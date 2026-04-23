import { proxyGet } from "../../../_proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const { catalogId } = await params;
  return proxyGet(request, `/knowledge/catalogs/${catalogId}/documents`);
}
