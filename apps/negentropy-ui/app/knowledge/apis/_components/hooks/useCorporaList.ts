"use client";

import { useState, useEffect } from "react";
import { CorpusRecord, fetchCorpora } from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

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
          // 防御：网络回退或 BFF 异常时（如未配置后端）data 可能不是数组。
          setCorpora(Array.isArray(data) ? data : []);
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
