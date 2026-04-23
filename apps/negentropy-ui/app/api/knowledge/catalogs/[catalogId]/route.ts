import { proxyGet, proxyPatch, proxyDelete } from "../../_proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const { catalogId } = await params;
  return proxyGet(request, `/knowledge/catalogs/${catalogId}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const { catalogId } = await params;
  return proxyPatch(request, `/knowledge/catalogs/${catalogId}`);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const { catalogId } = await params;
  return proxyDelete(request, `/knowledge/catalogs/${catalogId}`);
}
