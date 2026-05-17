"use client";

import { useEffect, useState } from "react";
import { fetchCatalogs, DocCatalog } from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

interface CatalogSelectorProps {
  value: string | null;
  onChange: (catalogId: string) => void;
}

export function CatalogSelector({ value, onChange }: CatalogSelectorProps) {
  const [catalogs, setCatalogs] = useState<DocCatalog[]>([]);

  useEffect(() => {
    fetchCatalogs({ appName: APP_NAME })
      .then((res) => setCatalogs(res.items))
      .catch(console.error);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-muted whitespace-nowrap">
        目录:
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <option value="">选择目录...</option>
        {catalogs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
