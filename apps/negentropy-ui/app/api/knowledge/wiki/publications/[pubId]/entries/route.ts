import { proxyGet } from "../../../../_proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pubId: string }> },
) {
  const { pubId } = await params;
  return proxyGet(request, `/wiki/publications/${pubId}/entries`);
}
