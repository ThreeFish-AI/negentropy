import { proxyGet, proxyPost } from "../../_proxy";

export async function GET(request: Request) {
  return proxyGet(request, "/knowledge/wiki/publications");
}

export async function POST(request: Request) {
  return proxyPost(request, "/knowledge/wiki/publications");
}
