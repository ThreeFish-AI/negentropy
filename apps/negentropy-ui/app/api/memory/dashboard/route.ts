import { proxyGet } from "../_proxy";

export async function GET(request: Request) {
  return proxyGet(request, "/memory/dashboard");
}
