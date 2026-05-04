import { proxyGet } from "../../../_proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ factId: string }> },
) {
  const { factId } = await params;
  return proxyGet(request, `/memory/facts/${factId}/history`);
}
