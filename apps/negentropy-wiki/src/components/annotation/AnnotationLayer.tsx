"use client";

import { useState, useCallback, useRef } from "react";
import { useAnnotations } from "@/lib/annotation/use-annotations";
import { useWikiAuth } from "@/lib/auth/wiki-auth";
import { type TextAnchor } from "@/lib/annotation/use-text-anchor";
import { useSnapshot } from "@/lib/annotation/use-snapshot";
import { TextSelectionHandler } from "./TextSelectionHandler";
import { AnnotationComposer } from "./AnnotationComposer";
import { AnnotationHighlightLayer } from "./AnnotationHighlightLayer";

interface Props {
  entryId: string;
  children: React.ReactNode;
}

export function AnnotationLayer({ entryId, children }: Props) {
  const { annotations, createAnnotation, deleteAnnotation, loading } = useAnnotations(entryId);
  const { user } = useWikiAuth();
  const contentRef = useRef<HTMLDivElement>(null);
  // 稳定快照：mount 后立即抓取，作为注解锚定的唯一权威坐标系。
  // entryId 变化时重抓（切换不同文章）。详见 use-snapshot.ts。
  const snapshotRef = useSnapshot(contentRef, [entryId]);

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
          snapshotRef={snapshotRef}
          onDeleteAnnotation={deleteAnnotation}
          currentUserId={user?.userId}
        />
      )}
      <TextSelectionHandler
        containerSelector=".wiki-markdown-body"
        onAnnotate={handleAnnotate}
        snapshotRef={snapshotRef}
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
