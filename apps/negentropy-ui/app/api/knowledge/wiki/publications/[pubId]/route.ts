import { proxyDelete, proxyGet, proxyPatch } from "../../../_proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pubId: string }> },
) {
  const { pubId } = await params;
  return proxyGet(request, `/wiki/publications/${pubId}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pubId: string }> },
) {
  const { pubId } = await params;
  return proxyPatch(request, `/wiki/publications/${pubId}`);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ pubId: string }> },
) {
  const { pubId } = await params;
  return proxyDelete(request, `/wiki/publications/${pubId}`);
}
