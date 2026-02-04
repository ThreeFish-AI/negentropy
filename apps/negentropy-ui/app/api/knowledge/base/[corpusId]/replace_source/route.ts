import { proxyPost } from "../../../_proxy";

export async function POST(request: Request, context: { params: { corpusId: string } }) {
  return proxyPost(request, `/knowledge/base/${context.params.corpusId}/replace_source`);
}
