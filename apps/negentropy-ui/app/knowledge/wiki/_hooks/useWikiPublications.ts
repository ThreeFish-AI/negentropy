/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWikiPublications, WikiPublication } from "@/features/knowledge";
import { toast } from "@/lib/activity-toast";

interface UseWikiPublicationsOptions {
  catalogId: string | null;
}

export function useWikiPublications({ catalogId }: UseWikiPublicationsOptions) {
  const [publications, setPublications] = useState<WikiPublication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPublications = useCallback(async () => {
    if (!catalogId) {
      setPublications([]);
      setSelectedId(null);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetchWikiPublications({ catalogId });
      setPublications(resp.items);
      setSelectedId((prev) =>
        prev && resp.items.some((p) => p.id === prev) ? prev : null,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载发布列表失败");
    } finally {
      setLoading(false);
    }
  }, [catalogId]);

  useEffect(() => {
    loadPublications();
  }, [loadPublications]);

  const selectedPub = publications.find((p) => p.id === selectedId) ?? null;

  const handleCreated = useCallback(
    (pub: WikiPublication) => {
      setSelectedId(pub.id);
      loadPublications();
    },
    [loadPublications],
  );

  const handleDeleted = useCallback(() => {
    setSelectedId(null);
    loadPublications();
  }, [loadPublications]);

  return {
    publications,
    selectedPub,
    selectedId,
    setSelectedId,
    loading,
    loadPublications,
    handleCreated,
    handleDeleted,
  };
}
