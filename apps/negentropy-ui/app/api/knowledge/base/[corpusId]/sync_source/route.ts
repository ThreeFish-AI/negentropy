import { proxyPost } from "../../../_proxy";

export async function POST(
  request: Request,
  context: { params: Promise<{ corpusId: string }> },
) {
  const { corpusId } = await context.params;
  return proxyPost(request, `/knowledge/base/${corpusId}/sync_source`);
}
