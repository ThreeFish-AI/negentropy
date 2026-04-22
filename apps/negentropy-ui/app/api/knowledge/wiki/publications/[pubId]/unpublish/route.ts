import { proxyPost } from "../../../../_proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pubId: string }> },
) {
  const { pubId } = await params;
  return proxyPost(request, `/wiki/publications/${pubId}/unpublish`);
}
