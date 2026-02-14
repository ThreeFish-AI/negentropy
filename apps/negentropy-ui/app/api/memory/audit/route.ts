import { proxyPost } from "../_proxy";

export async function POST(request: Request) {
  return proxyPost(request, "/memory/audit");
}
