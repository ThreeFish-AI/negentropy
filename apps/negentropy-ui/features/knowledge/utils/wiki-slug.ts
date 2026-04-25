/**
 * URL-friendly slug 工具（前后端 SSOT 镜像）
 *
 * 与后端 `apps/negentropy/src/negentropy/knowledge/slug.py` 保持完全一致的语义；
 * `WIKI_SLUG_PATTERN` 字符串值需逐字符对齐（前端测试断言会在两端读取后比对）。
 */

/** Wiki / Catalog slug 校验正则字符串（与后端 SLUG_PATTERN 同源）。 */
export const WIKI_SLUG_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

/** 编译后的正则；提供给 UI 入参实时校验复用。 */
export const WIKI_SLUG_REGEX = new RegExp(WIKI_SLUG_PATTERN);

/** 空 / 全非法字符输入时的回退 slug。 */
export const DEFAULT_SLUG = "untitled";

/**
 * 规范化任意文本为 URL-friendly slug。
 *
 * 规则：lowercase → 非 [a-z0-9] 字符折叠为 `-` → 去首尾 `-` → 折叠连续 `-`。
 * 空或全非法输入回退为 {@link DEFAULT_SLUG}。
 *
 * 注意：前端无 NFKC 归一化（浏览器原生），全角输入交由后端 `slugify` 兜底。
 * 这是有意的——前端 UX 仅做"提示性"slug 预览，最终值以后端校验为准。
 */
export function slugify(text: string): string {
  const lowered = (text ?? "").toLowerCase();
  const replaced = lowered.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const collapsed = replaced.replace(/-{2,}/g, "-");
  return collapsed || DEFAULT_SLUG;
}

/** 校验 slug 是否符合 `[a-z0-9](-[a-z0-9])*` 模式。 */
export function isValidSlug(slug: string): boolean {
  return WIKI_SLUG_REGEX.test(slug ?? "");
}
