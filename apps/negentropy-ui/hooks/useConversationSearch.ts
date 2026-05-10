"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import type { ConversationNode } from "@/types/a2ui";

/**
 * 从 ConversationNode 提取可搜索的文本，统一转小写用于匹配。
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
  } else if (node.payload.args != null) {
    try {
      parts.push(JSON.stringify(node.payload.args));
    } catch { /* skip */ }
  }

  return parts.join(" ").toLowerCase();
}

export function useConversationSearch(nodes: ConversationNode[]) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [explicitlyOpen, setExplicitlyOpen] = useState(false);

  // 150ms debounce — 保持输入响应性同时避免每次按键都全量扫描
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  const normalizedQuery = debouncedQuery.trim().toLowerCase();

  const { matchingNodeIds, orderedMatches } = useMemo(() => {
    if (!normalizedQuery || normalizedQuery.length < 2) {
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

  // Clamp currentIndex to valid range (handles streaming additions gracefully)
  const safeIndex = matchCount > 0
    ? ((currentIndex % matchCount) + matchCount) % matchCount
    : -1;

  const currentMatchNodeId = safeIndex >= 0 ? orderedMatches[safeIndex] : null;

  const navigateNext = useCallback(() => {
    if (matchCount === 0) return;
    setCurrentIndex((prev) => (prev + 1) % matchCount);
  }, [matchCount]);

  const navigatePrev = useCallback(() => {
    if (matchCount === 0) return;
    setCurrentIndex((prev) => (prev - 1 + matchCount) % matchCount);
  }, [matchCount]);

  const isOpen = explicitlyOpen || query !== "";

  const open = useCallback(() => {
    setExplicitlyOpen(true);
  }, []);

  const close = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    setCurrentIndex(0);
    setExplicitlyOpen(false);
  }, []);

  const handleSetQuery = useCallback((q: string) => {
    setQuery(q);
    setCurrentIndex(0);
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
    currentIndex: safeIndex >= 0 ? safeIndex + 1 : 0,
    currentMatchNodeId,
    navigateNext,
    navigatePrev,
    isOpen,
    open,
    close,
  };
}
