import { proxyPost } from "../../../_proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conflictId: string }> },
) {
  const { conflictId } = await params;
  return proxyPost(request, `/memory/conflicts/${conflictId}/resolve`);
}
