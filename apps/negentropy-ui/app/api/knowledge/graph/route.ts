import { proxyGet, proxyPost } from "../_proxy";

export async function GET(request: Request) {
  return proxyGet(request, "/knowledge/graph");
}

export async function POST(request: Request) {
  return proxyPost(request, "/knowledge/graph");
}
