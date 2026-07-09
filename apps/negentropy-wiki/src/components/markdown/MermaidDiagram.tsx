"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "strict",
  fontFamily: "inherit",
  flowchart: { htmlLabels: true },
});

interface MermaidDiagramProps {
  code: string;
}

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const normalizedCode = code?.trim() || "";
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [id] = useState(
    () => `mermaid-${Math.random().toString(36).substring(2, 9)}`,
  );
  const elementId = useRef(id);

  useEffect(() => {
    let mounted = true;
    if (!normalizedCode) return () => { mounted = false; };

    (async () => {
      try {
        if (typeof document !== "undefined" && document.fonts?.ready) {
          await document.fonts.ready;
        }
        const ok = await mermaid.parse(normalizedCode, { suppressErrors: true });
        if (!ok) { if (mounted) { setSvg(""); setError("Failed to render diagram"); } return; }
        const { svg } = await mermaid.render(elementId.current, normalizedCode);
        if (mounted) { setSvg(svg); setError(null); }
      } catch {
        if (mounted) setError("Failed to render diagram");
      }
    })();

    return () => { mounted = false; };
  }, [normalizedCode]);

  if (!normalizedCode) return null;

  if (error) {
    return (
      <div className="wiki-mermaid-error">
        <p className="wiki-mermaid-error-title">Mermaid Error</p>
        {/* notranslate：报错回退展示的是原始 mermaid 源码，不应被浏览器翻译。 */}
        <pre className="wiki-mermaid-error-code notranslate">{code}</pre>
      </div>
    );
  }

  return (
    // notranslate：运行期注入的 SVG 子树继承容器豁免，翻译引擎整体跳过，
    // 防止节点文字被翻译后长度变化打乱图表布局。
    <div className="wiki-mermaid-diagram notranslate">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
