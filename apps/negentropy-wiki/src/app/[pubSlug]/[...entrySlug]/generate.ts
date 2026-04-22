import { wikiApi } from "@/lib/wiki-api";

/**
 * SSG 静态参数生成 — Entry 条目列表
 *
 * 构建时为每个已发布 Publication 下的所有 Entry 生成静态页面路径。
 * 因 entry_slug 可能包含 "/"（Materialized Path），需按 "/" 分段交给 catch-all 路由。
 */
export async function generateStaticParams() {
  try {
    const pubsResult = await wikiApi.listPublications();
    const publishedPubs = pubsResult.items.filter((p) => p.status === "published");

    const params: { pubSlug: string; entrySlug: string[] }[] = [];

    for (const pub of publishedPubs) {
      try {
        const entriesResult = await wikiApi.getEntries(pub.id);
        for (const entry of entriesResult.items) {
          params.push({
            pubSlug: pub.slug,
            entrySlug: entry.entry_slug.split("/"),
          });
        }
      } catch (err) {
        console.warn(`Wiki: Failed to fetch entries for pub ${pub.id}`, err);
      }
    }

    return params;
  } catch {
    console.warn("Wiki: Failed to fetch static params for entries, returning empty");
    return [];
  }
}
