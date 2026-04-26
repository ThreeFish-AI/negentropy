/**
 * Markdown Heading 抽取工具
 *
 * 用于从原始 Markdown 文本中抽出标题列表，供右栏 TOC 渲染使用。
 *
 * 关键要求：
 *   - 与 `rehype-slug` 注入的 `id` 严格一致 —— 二者均基于 `github-slugger`，
 *     且必须按出现顺序对所有 heading 调用一次 `slug(text)`，重复文本才能
 *     被同样地追加 `-1 / -2`。因此**先 slug 后过滤**，不能跳过 H1。
 *   - 仅保留 H2/H3/H4：H1 由正文 `<header>` 单独承载，H5/H6 视觉权重过低；
 *     该取舍由 `TocHeading.depth` 类型与下方深度过滤共同锁定，不暴露开关。
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import { toString as mdastToString } from "mdast-util-to-string";
import GithubSlugger from "github-slugger";

export interface TocHeading {
  depth: 2 | 3 | 4;
  slug: string;
  text: string;
}

export function extractHeadings(md: string): TocHeading[] {
  if (!md || !md.trim()) return [];

  const tree = unified().use(remarkParse).use(remarkGfm).parse(md);
  const slugger = new GithubSlugger();
  const out: TocHeading[] = [];

  visit(tree, "heading", (node) => {
    const text = mdastToString(node).trim();
    if (!text) return;
    // 必须按文档顺序对每个 heading 都 slug 一次，才能与 rehype-slug 的去重计数一致。
    const slug = slugger.slug(text);
    if (node.depth < 2 || node.depth > 4) return;
    out.push({ depth: node.depth as 2 | 3 | 4, slug, text });
  });

  return out;
}
