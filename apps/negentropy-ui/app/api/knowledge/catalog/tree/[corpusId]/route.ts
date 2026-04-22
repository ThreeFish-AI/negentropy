import { proxyGet } from "../../../_proxy";

export async function GET(request: Request, { params }: { params: Promise<{ corpusId: string }> }) {
  const { corpusId } = await params;
  return proxyGet(request, `/knowledge/catalog/tree/${corpusId}`);
}
