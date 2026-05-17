"use client";

import { useState, useEffect } from "react";
import { fetchCatalogs, createCatalog } from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

export function useSingletonCatalog() {
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetchCatalogs({ appName: APP_NAME });
        if (cancelled) return;

        if (res.items.length > 0) {
          setCatalogId(res.items[0].id);
          return;
        }

        const catalog = await createCatalog({
          app_name: APP_NAME,
          name: "默认目录",
          slug: "default",
          visibility: "INTERNAL",
        });
        if (!cancelled) setCatalogId(catalog.id);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "加载目录失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { catalogId, loading, error };
}
