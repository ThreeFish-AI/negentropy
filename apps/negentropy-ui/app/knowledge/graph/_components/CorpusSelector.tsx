"use client";

import { useEffect, useRef, useState } from "react";
import { InlineField } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { CorpusRecord, fetchCorpora } from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

interface CorpusSelectorProps {
  value: string | null;
  onChange: (corpusId: string) => void;
  onCorporaLoaded?: (corpora: CorpusRecord[]) => void;
  /**
   * 首次加载时优先按名称选中的语料库；命中则默认选它，未命中（或未提供）回退到列表第一个。
   * 用于让特定页面（如图谱页）默认聚焦某个语料库，而不将业务名硬编码进本通用组件。
   */
  defaultCorpusName?: string;
}

export function CorpusSelector({
  value,
  onChange,
  onCorporaLoaded,
  defaultCorpusName,
}: CorpusSelectorProps) {
  const [corpora, setCorpora] = useState<CorpusRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const autoSelected = useRef(!!value);

  useEffect(() => {
    let mounted = true;
    fetchCorpora(APP_NAME)
      .then((data) => {
        if (mounted) {
          setCorpora(data);
          onCorporaLoaded?.(data);
          if (!autoSelected.current && data.length > 0) {
            autoSelected.current = true;
            const preferred = defaultCorpusName
              ? data.find((c) => c.name === defaultCorpusName)
              : undefined;
            onChange((preferred ?? data[0]).id);
          }
        }
      })
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [onChange, onCorporaLoaded, defaultCorpusName]);

  return (
    <InlineField label="语料库">
      <Select
        key={loading ? "loading" : "loaded"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        disabled={loading}
      >
        <option value="" disabled>{loading ? "加载中..." : "选择语料库..."}</option>
        {corpora.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </InlineField>
  );
}
