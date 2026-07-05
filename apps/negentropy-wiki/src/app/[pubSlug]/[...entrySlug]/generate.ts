import { wikiApi } from "@/lib/content-source";

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
        // 单个 publication 的 entries 不可达时跳过，不阻断其余；
        // 保留 warn 以便构建期定位"某 pub 路由有 bug" vs "该 pub 确实无 entries"。
        console.warn(
          `[Wiki SSG] Failed to fetch entries for publication ${pub.slug} (id=${pub.id}), skipping:`,
          err,
        );
      }
    }

    return params;
  } catch (err) {
    console.warn(
      "[Wiki SSG] Failed to fetch static params for entries, returning empty:",
      err,
    );
    return [];
  }
}
