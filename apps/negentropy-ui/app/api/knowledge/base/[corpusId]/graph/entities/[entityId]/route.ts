import { proxyGet } from "../../../../../_proxy";

export async function GET(
  request: Request,
  context: { params: Promise<{ corpusId: string; entityId: string }> },
) {
  const { corpusId, entityId } = await context.params;
  return proxyGet(
    request,
    `/knowledge/base/${corpusId}/graph/entities/${entityId}`,
  );
}
