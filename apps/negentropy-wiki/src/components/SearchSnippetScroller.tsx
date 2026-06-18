"use client";

import { useScrollToSearchSnippet } from "@/hooks/useScrollToSearchSnippet";

/**
 * 搜索片段滚动锚点
 *
 * 客户端组件包装器，在文档内容页挂载 useScrollToSearchSnippet hook，
 * 用于从搜索结果跳转后自动滚动到匹配的文档片段所在章节。
 *
 * 作为空壳组件渲染，仅负责 hook 生命周期，不产生 DOM 节点。
 */
export function SearchSnippetScroller() {
  useScrollToSearchSnippet();
  return null;
}
