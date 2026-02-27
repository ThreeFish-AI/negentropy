import { proxyPostFormData } from "../../../_proxy";

export async function POST(
  request: Request,
  context: { params: Promise<{ corpusId: string }> },
) {
  const { corpusId } = await context.params;
  return proxyPostFormData(request, `/knowledge/base/${corpusId}/ingest_file`);
}
