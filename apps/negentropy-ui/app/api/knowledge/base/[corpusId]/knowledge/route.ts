import { proxyGet } from "../../../_proxy";

export async function GET(
  request: Request,
  context: { params: Promise<{ corpusId: string }> },
) {
  const { corpusId } = await context.params;
  return proxyGet(request, `/knowledge/base/${corpusId}/knowledge`);
}
