import { wikiApi } from "@/lib/wiki-api";

/**
 * SSG 静态参数生成 — Publication 列表
 *
 * 构建时调用后端 API 获取所有已发布的 Publication，
 * 为每个 Publication 生成静态页面路径。
 */
export async function generateStaticParams() {
  try {
    const result = await wikiApi.listPublications();
    return result.items
      .filter((p) => p.status === "published")
      .map((p) => ({ pubSlug: p.slug }));
  } catch {
    console.warn("Wiki: Failed to fetch publications for static params, returning empty");
    return [];
  }
}
