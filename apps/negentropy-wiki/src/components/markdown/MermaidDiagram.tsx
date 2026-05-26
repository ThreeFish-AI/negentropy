"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
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
        <pre className="wiki-mermaid-error-code">{code}</pre>
      </div>
    );
  }

  return (
    <div className="wiki-mermaid-diagram">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
