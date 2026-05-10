"use client";

import { useMemo, useState, useCallback } from "react";
import type { ConversationNode } from "@/types/a2ui";

/**
 * 从 ConversationNode 提取可搜索的文本，统一转小写用于匹配。
 *
 * 搜索范围：
 * - node.title（消息标题、工具名称、步骤名称等）
 * - node.summary（reasoning 阶段摘要等）
 * - node.payload.content（文本消息正文、reasoning 推理内容）
 * - node.payload.toolCallName（工具调用名称）
 * - node.payload.args（工具调用参数）
 */
function extractSearchableText(node: ConversationNode): string {
  const parts: string[] = [];

  if (node.title) parts.push(node.title);
  if (node.summary) parts.push(node.summary);

  if (typeof node.payload.content === "string") {
    parts.push(node.payload.content);
  }
  if (typeof node.payload.toolCallName === "string") {
    parts.push(node.payload.toolCallName);
  }
  if (typeof node.payload.args === "string") {
    parts.push(node.payload.args);
  }

  return parts.join(" ").toLowerCase();
}

export function useConversationSearch(nodes: ConversationNode[]) {
  const [query, setQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [explicitlyOpen, setExplicitlyOpen] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();

  const { matchingNodeIds, orderedMatches } = useMemo(() => {
    if (!normalizedQuery) {
      return {
        matchingNodeIds: new Set<string>(),
        orderedMatches: [] as string[],
      };
    }

    const matched = new Set<string>();
    const ordered: string[] = [];

    for (const node of nodes) {
      if (node.visibility === "debug-only") continue;
      const text = extractSearchableText(node);
      if (text.includes(normalizedQuery)) {
        matched.add(node.id);
        ordered.push(node.id);
      }
    }

    return { matchingNodeIds: matched, orderedMatches: ordered };
  }, [nodes, normalizedQuery]);

  const matchCount = orderedMatches.length;

  const navigateNext = useCallback(() => {
    if (matchCount === 0) return;
    setCurrentIndex((prev) => (prev + 1) % matchCount);
  }, [matchCount]);

  const navigatePrev = useCallback(() => {
    if (matchCount === 0) return;
    setCurrentIndex((prev) => (prev - 1 + matchCount) % matchCount);
  }, [matchCount]);

  const currentMatchNodeId =
    currentIndex >= 0 && currentIndex < matchCount
      ? orderedMatches[currentIndex]
      : null;

  const isOpen = explicitlyOpen || query !== "" || matchCount > 0;

  const open = useCallback(() => {
    setExplicitlyOpen(true);
  }, []);

  const close = useCallback(() => {
    setQuery("");
    setCurrentIndex(-1);
    setExplicitlyOpen(false);
  }, []);

  const handleSetQuery = useCallback((q: string) => {
    setQuery(q);
    setCurrentIndex(-1);
    if (q.length > 0) {
      setExplicitlyOpen(true);
    }
  }, []);

  return {
    query,
    setQuery: handleSetQuery,
    matchingNodeIds,
    matchCount,
    /** 1-based 显示用索引（0 表示无匹配） */
    currentIndex: matchCount > 0 ? currentIndex + 1 : 0,
    currentMatchNodeId,
    navigateNext,
    navigatePrev,
    isOpen,
    open,
    close,
  };
}
