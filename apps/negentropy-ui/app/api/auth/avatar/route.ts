import { NextResponse } from "next/server";

const ALLOWED_AVATAR_HOSTS = ["googleusercontent.com"];
const AVATAR_CACHE_CONTROL = "private, max-age=3600, stale-while-revalidate=86400";

function isAllowedAvatarUrl(value: string): boolean {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") {
    return false;
  }

  return ALLOWED_AVATAR_HOSTS.some(
    (hostname) => url.hostname === hostname || url.hostname.endsWith(`.${hostname}`),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get("src");

  if (!src) {
    return NextResponse.json({ error: "src is required" }, { status: 400 });
  }

  if (!isAllowedAvatarUrl(src)) {
    return NextResponse.json({ error: "avatar source is not allowed" }, { status: 400 });
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(src, {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      cache: "force-cache",
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Avatar upstream connection failed: ${String(error)}` },
      { status: 502 },
    );
  }

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      { error: `Avatar upstream returned ${upstreamResponse.status}` },
      { status: upstreamResponse.status },
    );
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    upstreamResponse.headers.get("content-type") || "image/jpeg",
  );
  headers.set("cache-control", AVATAR_CACHE_CONTROL);

  const contentLength = upstreamResponse.headers.get("content-length");
  if (contentLength) {
    headers.set("content-length", contentLength);
  }

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers,
  });
}
