import { proxyDelete, proxyGet, proxyPost } from "../_proxy";

export async function GET(request: Request) {
  return proxyGet(request, "/memory/core-blocks");
}

export async function POST(request: Request) {
  return proxyPost(request, "/memory/core-blocks");
}

export async function DELETE(request: Request) {
  return proxyDelete(request, "/memory/core-blocks");
}
