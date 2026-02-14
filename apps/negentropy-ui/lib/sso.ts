export function buildAuthHeaders(request: Request): Headers {
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }
  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("authorization", authorization);
  }
  return headers;
}
