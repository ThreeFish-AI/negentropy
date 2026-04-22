import { proxyGet, proxyPost } from "../_proxy";

export async function GET(request: Request) {
  return proxyGet(request, "/knowledge/catalog/nodes");
}

export async function POST(request: Request) {
  return proxyPost(request, "/knowledge/catalog/nodes");
}
