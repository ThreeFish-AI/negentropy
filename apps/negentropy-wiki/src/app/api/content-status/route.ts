/**
 * SSG 内容版本查询端点
 *
 * 管理后台（negentropy-ui）发布 Wiki 后，轮询此端点验证 SSG 是否已拉取到新版本。
 * 使用 `cache: 'no-store'` 绕过 ISR 缓存，直接从后端获取最新状态。
 */

import { NextResponse } from "next/server";

const API_BASE = process.env.WIKI_API_BASE || "http://localhost:3292";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug || !/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${API_BASE}/knowledge/wiki/publications?status=published`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `backend_error: ${res.status}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as {
      items: Array<{
        slug: string;
        version: number;
        status: string;
        updated_at: string | null;
      }>;
    };
    const pub = data.items.find((p) => p.slug === slug);
    if (!pub) {
      return NextResponse.json(
        { error: "not_found", slug },
        { status: 404 },
      );
    }
    return NextResponse.json({
      slug: pub.slug,
      version: pub.version,
      status: pub.status,
      updated_at: pub.updated_at,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `fetch_error: ${String(err)}` },
      { status: 502 },
    );
  }
}
