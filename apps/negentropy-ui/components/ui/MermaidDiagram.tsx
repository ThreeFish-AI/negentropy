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

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
    } catch (err) {
      console.error("Failed to copy code", err);
    }
  };

  if (error) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded text-red-600 text-xs font-mono relative group">
        <p className="font-bold mb-1">Mermaid Error</p>
        <pre className="whitespace-pre-wrap">{code}</pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-red-100 text-red-400 hover:text-red-700 transition-colors opacity-0 group-hover:opacity-100"
          title="Copy Code"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="relative group my-4">
      <div
        className="mermaid-diagram overflow-x-auto bg-white p-4 rounded-lg border border-zinc-100 shadow-sm"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-white/80 hover:bg-white border border-zinc-200 shadow-sm text-zinc-400 hover:text-zinc-600 backdrop-blur-sm transition-all"
          title="Copy Mermaid Code"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
