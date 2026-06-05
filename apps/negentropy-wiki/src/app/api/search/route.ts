/**
 * Wiki 搜索 API 代理路由
 *
 * 接收前端搜索请求，调用后端 per-corpus KB 混合检索 API，
 * 将结果通过 source_uri 文件名映射到 wiki 页面 entries。
 *
 * POST /api/search
 * Body: { pubSlug: string, query: string }
 * Response: { items: WikiSearchResultItem[], total: number, queryTimeMs: number }
 */

import { NextResponse } from "next/server";
import { wikiApi } from "@/lib/wiki-api";
import type {
  WikiSearchResultItem,
  WikiSearchResponse,
} from "@/lib/search-types";

const API_BASE = process.env.WIKI_API_BASE || "http://localhost:3292";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 统一归一化函数——同一套规则作用于 source_uri 文件名与 entry_slug 末段，
 * 保证 Map key 与 lookup 对称（避免大小写/下划线导致静默匹配失败）。
 *
 * 保留 Unicode 字母与数字（`\p{L}\p{N}`），仅将分隔符（含 `.` `_` 空格等）
 * 折叠为单个连字符——中文/日文等非 ASCII 文件名因此不会被整体抹除。
 *
 * 示例：
 *   "Agentic_Design_Patterns.pdf" → "agentic-design-patterns-pdf"
 *   "harness-engineering/paper/agentic-design-patterns-pdf" → "agentic-design-patterns-pdf"
 *   "智能体设计.pdf" → "智能体设计-pdf"
 */
function normalizeKey(input: string): string {
  const lastSegment = input.split("/").pop() || input;
  return lastSegment
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.query !== "string" || typeof body.pubSlug !== "string") {
    return NextResponse.json(
      { error: "invalid_request", detail: "pubSlug and query are required" },
      { status: 400 },
    );
  }

  const { pubSlug, query } = body;
  const trimmedQuery = query.trim();
  if (!trimmedQuery || trimmedQuery.length > 1000) {
    return NextResponse.json(
      { error: "invalid_query", detail: "query must be 1-1000 characters" },
      { status: 400 },
    );
  }

  try {
    // 1. 解析 publication
    const publication = await wikiApi.findPublicationBySlug(pubSlug);
    if (!publication) {
      return NextResponse.json(
        { error: "not_found", detail: `publication "${pubSlug}" not found` },
        { status: 404 },
      );
    }

    // 2. 获取 entries，构建归一化 filename → entry 映射
    const entriesResult = await wikiApi.getEntries(publication.id);
    const normalizedMap = new Map<
      string,
      { entry_slug: string; entry_title: string }
    >();
    for (const entry of entriesResult.items) {
      if (entry.document_id) {
        const key = normalizeKey(entry.entry_slug);
        // 末段冲突时保留首个并告警（不同路径的 entry 末段相同的罕见情形）
        if (normalizedMap.has(key)) {
          console.warn(
            `[Wiki Search] entry_slug 末段归一化冲突: "${key}" (已存在 "${normalizedMap.get(key)?.entry_slug}", 跳过 "${entry.entry_slug}")`,
          );
          continue;
        }
        normalizedMap.set(key, {
          entry_slug: entry.entry_slug,
          entry_title: entry.entry_title || entry.entry_slug,
        });
      }
    }

    if (normalizedMap.size === 0) {
      return NextResponse.json({
        items: [],
        total: 0,
        queryTimeMs: 0,
      } satisfies WikiSearchResponse);
    }

    // 3. 获取 corpus 列表
    const corporaRes = await fetch(`${API_BASE}/knowledge/base?limit=20`, {
      headers: { Accept: "application/json" },
    });
    if (!corporaRes.ok) {
      console.error(`[Wiki Search] corpora list error: ${corporaRes.status}`);
      return NextResponse.json(
        { error: "backend_error", detail: `corpus list failed: ${corporaRes.status}` },
        { status: 502 },
      );
    }
    const corpora = await corporaRes.json();
    // /knowledge/base 直接返回 corpus 数组（非 {items} 包裹）
    const corpusList: Array<{ id: string; name: string }> = Array.isArray(corpora)
      ? corpora
      : corpora.items || [];
    if (corpusList.length === 0) {
      return NextResponse.json({
        items: [],
        total: 0,
        queryTimeMs: 0,
      } satisfies WikiSearchResponse);
    }

    // 4. 并发检索所有 corpus 并合并结果——后端无 publication→corpus 直接映射，
    //    故跨 corpus 检索后由 source_uri→entry 映射（步骤 5）精确过滤到本 publication。
    //    多 corpus 环境下不会漏检（不同于盲取首项的脆弱假设）。
    const startTime = Date.now();
    const searchResponses = await Promise.all(
      corpusList.map(async (c) => {
        try {
          const res = await fetch(`${API_BASE}/knowledge/base/${c.id}/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ query: trimmedQuery, mode: "hybrid", limit: 30 }),
          });
          if (!res.ok) {
            console.error(`[Wiki Search] corpus ${c.id} search error [${res.status}]`);
            return [];
          }
          const data = await res.json();
          return (data.items || []) as Array<Record<string, unknown>>;
        } catch (e) {
          console.error(`[Wiki Search] corpus ${c.id} fetch failed:`, e);
          return [];
        }
      }),
    );
    const rawItems: Array<Record<string, unknown>> = searchResponses.flat();
    const queryTimeMs = Date.now() - startTime;

    // 跨 corpus 合并后按 combined_score 降序，确保 source_uri 映射时优先取高分项
    rawItems.sort(
      (a, b) =>
        (typeof b.combined_score === "number" ? b.combined_score : 0) -
        (typeof a.combined_score === "number" ? a.combined_score : 0),
    );

    // 5. 映射：source_uri filename → entry
    const items: WikiSearchResultItem[] = [];
    const seenEntries = new Set<string>();

    for (const item of rawItems) {
      const sourceUri = typeof item.source_uri === "string" ? item.source_uri : null;
      if (!sourceUri) continue;

      const normalized = normalizeKey(sourceUri);
      const entry = normalizedMap.get(normalized);
      if (!entry || seenEntries.has(entry.entry_slug)) continue;

      seenEntries.add(entry.entry_slug);

      const scores: Record<string, number> = {
        combined: typeof item.combined_score === "number" ? item.combined_score : 0,
        semantic: typeof item.semantic_score === "number" ? item.semantic_score : 0,
        keyword: typeof item.keyword_score === "number" ? item.keyword_score : 0,
      };

      // 取前 300 字符作为摘要
      const content = typeof item.content === "string" ? item.content : "";
      const snippet = content.slice(0, 300);

      items.push({
        id: String(item.id || ""),
        snippet,
        entrySlug: entry.entry_slug,
        entryTitle: entry.entry_title,
        wikiUrl: `/${pubSlug}/${entry.entry_slug}`,
        scores,
        sourceUri,
      });

      if (items.length >= 10) break;
    }

    // 按 combined_score 降序排列
    items.sort((a, b) => (b.scores.combined || 0) - (a.scores.combined || 0));

    return NextResponse.json({
      items,
      total: items.length,
      queryTimeMs,
    } satisfies WikiSearchResponse);
  } catch (err) {
    // 异常详情仅落服务端日志，响应体只返回通用 message（避免内部信息外泄）
    console.error("[Wiki Search] error:", err);
    return NextResponse.json(
      { error: "internal_error", detail: "search failed unexpectedly" },
      { status: 500 },
    );
  }
}
