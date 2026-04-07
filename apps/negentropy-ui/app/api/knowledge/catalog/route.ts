import { proxyGet, proxyPost } from "../_proxy";

export async function GET(request: Request) {
  return proxyGet(request, "/catalog/nodes");
}

export async function POST(request: Request) {
  return proxyPost(request, "/catalog/nodes");
}
