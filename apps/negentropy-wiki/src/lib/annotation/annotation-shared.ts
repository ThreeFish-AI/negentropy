/**
 * 注解模块共享常量与工具函数。
 *
 * 被 use-snapshot.ts 和 use-text-anchor.ts 共同引用，消除重复定义，
 * 防止单侧漂移导致的静默失效（如哈希算法不一致导致 v2 anchor 快速路径断裂）。
 */

/** 块级元素标签集合：用于 snapshot 块级索引和 text-anchor 的粗粒度回退/投影。 */
export const BLOCK_TAGS = new Set([
  "P", "LI", "BLOCKQUOTE", "PRE", "TABLE", "TR", "TD", "TH",
  "H1", "H2", "H3", "H4", "H5", "H6",
  "DIV", "ARTICLE", "SECTION", "FIGURE", "FIGCAPTION",
]);

/** 轻量级 32-bit FNV-1a 哈希，避免引入 crypto 依赖。 */
export function simpleHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
