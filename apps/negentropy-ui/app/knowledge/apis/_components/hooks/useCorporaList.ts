"use client";

import { useState, useEffect } from "react";
import { CorpusRecord, fetchCorpora } from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

interface UseCorporaListResult {
  corpora: CorpusRecord[];
  loading: boolean;
  error: string | null;
}

export function useCorporaList(): UseCorporaListResult {
  const [corpora, setCorpora] = useState<CorpusRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadCorpora = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchCorpora(APP_NAME);
        if (mounted) {
          setCorpora(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "加载语料库列表失败");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadCorpora();

    return () => {
      mounted = false;
    };
  }, []);

  return { corpora, loading, error };
}
