"use client";

import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
  fontFamily: "inherit",
});

interface MermaidDiagramProps {
  code: string;
}

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [id] = useState(
    () => `mermaid-${Math.random().toString(36).substring(2, 9)}`,
  );
  const elementId = useRef(id);

  useEffect(() => {
    let isMounted = true;

    const renderDiagram = async () => {
      try {
        const { svg } = await mermaid.render(elementId.current, code);
        if (isMounted) {
          setSvg(svg);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Mermaid rendering failed:", err);
          setError("Failed to render diagram");
          // Mermaid might verify fail, just show code block fallback if needed, or error message
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [code]);

  if (error) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded text-red-600 text-xs font-mono">
        <p className="font-bold mb-1">Mermaid Error</p>
        <pre className="whitespace-pre-wrap">{code}</pre>
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram my-4 overflow-x-auto bg-white p-4 rounded-lg border border-zinc-100 shadow-sm"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
