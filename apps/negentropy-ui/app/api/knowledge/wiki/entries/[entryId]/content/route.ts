import { proxyGet } from "../../../../_proxy";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const { entryId } = await params;
  return proxyGet(request, `/wiki/entries/${entryId}/content`);
}
