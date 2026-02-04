import { proxyGet } from "../../_proxy";

export async function GET(request: Request, context: { params: { corpusId: string } }) {
  return proxyGet(request, `/knowledge/base/${context.params.corpusId}`);
}
