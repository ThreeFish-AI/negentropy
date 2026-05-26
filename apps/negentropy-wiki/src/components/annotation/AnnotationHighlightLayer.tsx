"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { resolveAnchor, type TextAnchor } from "@/lib/annotation/use-text-anchor";
import type { AnnotationItem } from "@/lib/annotation/use-annotations";
import { AnnotationTooltip } from "./AnnotationTooltip";

interface Props {
  containerRef: React.RefObject<HTMLElement | null>;
  annotations: AnnotationItem[];
}

interface HighlightGroup {
  annotationIds: string[];
  range: Range;
  annotations: AnnotationItem[];
}

export function AnnotationHighlightLayer({ containerRef, annotations }: Props) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    annotations: AnnotationItem[];
  } | null>(null);
  const highlightRefs = useRef<Map<string, HTMLElement>>(new Map());

  // 注解到高亮的映射
  const applyHighlights = useCallback(() => {
    const container = containerRef.current;
    if (!container || annotations.length === 0) return;

    // 清除旧高亮
    highlightRefs.current.forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
    });
    highlightRefs.current.clear();

    // 按锚定数据分组
    const groups: HighlightGroup[] = [];
    for (const annotation of annotations) {
      const anchor = annotation.anchor as unknown as TextAnchor;
      const range = resolveAnchor(anchor, container);
      if (!range) continue;

      // 检查是否与已有 group 重叠
      const existing = groups.find((g) => rangesOverlap(g.range, range));
      if (existing) {
        existing.annotationIds.push(annotation.id);
        existing.annotations.push(annotation);
      } else {
        groups.push({
          annotationIds: [annotation.id],
          range,
          annotations: [annotation],
        });
      }
    }

    // 应用高亮
    for (const group of groups) {
      try {
        const mark = document.createElement("mark");
        mark.className = "wiki-annotation-highlight";
        mark.dataset.annotationIds = group.annotationIds.join(",");

        mark.addEventListener("mouseenter", () => {
          const rect = mark.getBoundingClientRect();
          setTooltip({
            x: rect.left,
            y: rect.bottom + 6,
            annotations: group.annotations,
          });
        });
        mark.addEventListener("mouseleave", () => {
          setTooltip(null);
        });

        group.range.surroundContents(mark);
        highlightRefs.current.set(group.annotationIds.join(","), mark);
      } catch {
        // Range 跨节点时 surroundContents 会失败，尝试 splitText 方式
        try {
          const fragment = group.range.extractContents();
          const mark = document.createElement("mark");
          mark.className = "wiki-annotation-highlight";
          mark.dataset.annotationIds = group.annotationIds.join(",");

          mark.addEventListener("mouseenter", () => {
            const rect = mark.getBoundingClientRect();
            setTooltip({
              x: rect.left,
              y: rect.bottom + 6,
              annotations: group.annotations,
            });
          });
          mark.addEventListener("mouseleave", () => {
            setTooltip(null);
          });

          mark.appendChild(fragment);
          group.range.insertNode(mark);
          highlightRefs.current.set(group.annotationIds.join(","), mark);
        } catch {
          // 最终降级：无法高亮此范围
        }
      }
    }
  }, [containerRef, annotations]);

  useEffect(() => {
    applyHighlights();
    return () => {
      highlightRefs.current.forEach((el) => {
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
      });
      highlightRefs.current.clear();
    };
  }, [applyHighlights]);

  if (!tooltip) return null;

  return <AnnotationTooltip position={tooltip} />;
}

function rangesOverlap(a: Range, b: Range): boolean {
  return (
    a.compareBoundaryPoints(Range.START_TO_END, b) > 0 &&
    a.compareBoundaryPoints(Range.END_TO_START, b) < 0
  );
}
