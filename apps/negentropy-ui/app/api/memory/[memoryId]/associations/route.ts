import { proxyGet } from "../../_proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ memoryId: string }> },
) {
  const { memoryId } = await params;
  return proxyGet(request, `/memory/${memoryId}/associations`);
}
