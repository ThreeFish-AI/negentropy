import { proxyGet, proxyPatch, proxyDelete } from "../../_proxy";

export async function GET(
  request: Request,
  context: { params: Promise<{ corpusId: string }> },
) {
  const { corpusId } = await context.params;
  return proxyGet(request, `/knowledge/base/${corpusId}`);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ corpusId: string }> },
) {
  const { corpusId } = await context.params;
  return proxyPatch(request, `/knowledge/base/${corpusId}`);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ corpusId: string }> },
) {
  const { corpusId } = await context.params;
  return proxyDelete(request, `/knowledge/base/${corpusId}`);
}
