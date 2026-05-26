"use client";

import { useState, useCallback, useRef } from "react";
import { useAnnotations } from "@/lib/annotation/use-annotations";
import { useWikiAuth } from "@/lib/auth/wiki-auth";
import { type TextAnchor } from "@/lib/annotation/use-text-anchor";
import { TextSelectionHandler } from "./TextSelectionHandler";
import { AnnotationComposer } from "./AnnotationComposer";
import { AnnotationHighlightLayer } from "./AnnotationHighlightLayer";

interface Props {
  entryId: string;
  children: React.ReactNode;
}

export function AnnotationLayer({ entryId, children }: Props) {
  const { annotations, createAnnotation, loading } = useAnnotations(entryId);
  const { status } = useWikiAuth();
  const contentRef = useRef<HTMLDivElement>(null);

  const [composer, setComposer] = useState<{
    anchor: TextAnchor;
    quotedText: string;
    position: { x: number; y: number };
  } | null>(null);

  const handleAnnotate = useCallback(
    (anchor: TextAnchor, quotedText: string, rect: DOMRect) => {
      setComposer({
        anchor,
        quotedText,
        position: {
          x: rect.left + rect.width / 2,
          y: rect.bottom + 8,
        },
      });
    },
    [],
  );

  const handleComposerSubmit = useCallback(
    async (body: string) => {
      if (!composer) return;
      await createAnnotation({
        body,
        quoted_text: composer.quotedText,
        anchor: composer.anchor as unknown as Record<string, unknown>,
      });
      setComposer(null);
    },
    [composer, createAnnotation],
  );

  const handleComposerCancel = useCallback(() => {
    setComposer(null);
  }, []);

  return (
    <div ref={contentRef} className="wiki-annotation-layer">
      {children}
      {!loading && annotations.length > 0 && (
        <AnnotationHighlightLayer
          containerRef={contentRef}
          annotations={annotations}
        />
      )}
      <TextSelectionHandler
        containerSelector=".wiki-markdown-body"
        onAnnotate={handleAnnotate}
      />
      {composer && (
        <AnnotationComposer
          quotedText={composer.quotedText}
          position={composer.position}
          onSubmit={handleComposerSubmit}
          onCancel={handleComposerCancel}
        />
      )}
    </div>
  );
}
