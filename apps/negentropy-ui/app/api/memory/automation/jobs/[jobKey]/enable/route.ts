import { proxyPost } from "../../../../_proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobKey: string }> },
) {
  const { jobKey } = await params;
  return proxyPost(request, `/memory/automation/jobs/${jobKey}/enable`);
}
