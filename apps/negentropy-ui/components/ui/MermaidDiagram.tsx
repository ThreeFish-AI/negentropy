"use client";

import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
  fontFamily: "inherit",
  flowchart: {
    htmlLabels: true,
  },
});

interface MermaidDiagramProps {
  code: string;
}

function normalizeMermaidCode(raw: string): string {
  if (!raw) {
    return "";
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "undefined") {
    return "";
  }
  return trimmed;
}

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [id] = useState(
    () => `mermaid-${Math.random().toString(36).substring(2, 9)}`,
  );
  const elementId = useRef(id);
  const lastErrorSignature = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const normalizedCode = normalizeMermaidCode(code);

    if (!normalizedCode) {
      setSvg("");
      setError(null);
      return () => {
        isMounted = false;
      };
    }

    const renderDiagram = async () => {
      try {
        if (typeof document !== "undefined" && document.fonts?.ready) {
          await document.fonts.ready;
        }
        const parseResult = await mermaid.parse(normalizedCode, {
          suppressErrors: true,
        });
        if (!parseResult) {
          if (isMounted) {
            setSvg("");
            setError("Failed to render diagram");
          }
          return;
        }
        const { svg } = await mermaid.render(elementId.current, normalizedCode);
        if (isMounted) {
          setSvg(svg);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to render diagram");
          // Mermaid might verify fail, just show code block fallback if needed, or error message
        }
        if (process.env.NODE_ENV !== "production") {
          const signature = `${normalizedCode}::${String(err)}`;
          if (lastErrorSignature.current !== signature) {
            lastErrorSignature.current = signature;
            console.error("Mermaid rendering failed:", err);
          }
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
      <div className="p-4 border border-error/20 bg-error/10 rounded text-error text-xs font-mono relative group">
        <p className="font-bold mb-1">Mermaid Error</p>
        <pre className="whitespace-pre-wrap">{code}</pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-error/20 text-error/60 hover:text-error transition-colors opacity-0 group-hover:opacity-100"
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
        className="mermaid-diagram overflow-x-auto bg-card p-4 rounded-lg border border-border shadow-sm"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-card/80 hover:bg-card border border-border shadow-sm text-muted hover:text-foreground backdrop-blur-sm transition-all"
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
