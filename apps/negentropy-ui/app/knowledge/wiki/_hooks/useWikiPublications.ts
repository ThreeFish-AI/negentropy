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
