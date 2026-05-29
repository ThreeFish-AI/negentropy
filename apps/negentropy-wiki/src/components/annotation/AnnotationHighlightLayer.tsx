"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { resolveAnchor, type TextAnchor } from "@/lib/annotation/use-text-anchor";
import type { AnnotationItem } from "@/lib/annotation/use-annotations";
import type { AnnotationSnapshot } from "@/lib/annotation/use-snapshot";
import {
  debounce,
  isContainerTranslated,
  isTranslationMutation,
} from "@/lib/annotation/use-translation-detect";
import {
  pickRenderer,
  type HighlightGroupInput,
  type HighlightRenderer,
  type HitTestFn,
} from "@/lib/annotation/use-highlight-renderer";
import { AnnotationTooltip } from "./AnnotationTooltip";

interface Props {
  containerRef: React.RefObject<HTMLElement | null>;
  annotations: AnnotationItem[];
  /** 稳定快照 ref。提供时启用 source-anchored 路径；否则走兼容路径（与 v1 anchor 行为一致）。 */
  snapshotRef?: React.MutableRefObject<AnnotationSnapshot | null>;
  /** 删除注解回调 */
  onDeleteAnnotation?: (annotationId: string) => Promise<boolean>;
  /** 当前用户 ID，用于判断注解所有权 */
  currentUserId?: string;
}

interface TooltipState {
  x: number;
  y: number;
  annotations: AnnotationItem[];
}

export function AnnotationHighlightLayer({
  containerRef,
  annotations,
  snapshotRef,
  onDeleteAnnotation,
  currentUserId,
}: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const rendererRef = useRef<HighlightRenderer | null>(null);
  const hitTestRef = useRef<HitTestFn | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHoverStart = useCallback(
    (group: HighlightGroupInput, rect: DOMRect) => {
      // 取消待执行的隐藏延时
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setTooltip({
        x: rect.left,
        y: rect.bottom + 6,
        annotations: group.annotations,
      });
    },
    [],
  );

  const handleHoverEnd = useCallback(() => {
    // 延时隐藏：给用户留出将鼠标移到 Tooltip 上（点击删除按钮等）的时间
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      setTooltip(null);
    }, 200);
  }, []);

  const handleTooltipEnter = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handleTooltipLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleDeleteAnnotation = useCallback(
    async (annotationId: string) => {
      if (!onDeleteAnnotation) return;
      if (!window.confirm("确定删除此注解？")) return;
      const ok = await onDeleteAnnotation(annotationId);
      if (ok) setTooltip(null);
    },
    [onDeleteAnnotation],
  );

  const applyHighlights = useCallback(() => {
    const container = containerRef.current;
    if (!container || annotations.length === 0) return;

    // 临时 disconnect observer，避免本函数修改 DOM 触发回调形成递归。
    const observer = observerRef.current;
    observer?.disconnect();

    try {
      // 自适应渲染器选择：翻译态 + 支持 CSS Highlight API → CSSHighlightRenderer
      // 否则 → MarkWrapRenderer（事件交互简单的兼容路径）
      const translated = isContainerTranslated(container);
      const factory = pickRenderer({ isTranslated: translated });

      // 清除前一渲染器（如果存在且类型变了）
      rendererRef.current?.clear();
      const renderer = factory(handleHoverStart, handleHoverEnd);
      rendererRef.current = renderer;

      // 按锚定数据解析为 Range 并按重叠分组
      const groups: HighlightGroupInput[] = [];
      for (const annotation of annotations) {
        const anchor = annotation.anchor as unknown as TextAnchor;
        const range = resolveAnchor(anchor, container, snapshotRef?.current, annotation.quoted_text);
        if (!range) continue;

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

      hitTestRef.current = renderer.apply(groups);
    } finally {
      // 恢复 observer
      if (observer && container) {
        observer.observe(container, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["lang", "translate"],
        });
      }
    }
  }, [containerRef, annotations, snapshotRef, handleHoverStart, handleHoverEnd]);

  // 主应用 + 卸载清理
  useEffect(() => {
    applyHighlights();
    return () => {
      rendererRef.current?.clear();
      rendererRef.current = null;
      hitTestRef.current = null;
    };
  }, [applyHighlights]);

  // MutationObserver：监听容器 DOM 变化（含浏览器翻译、内容重渲染），
  // debounce 后重新应用高亮。R3 的根治方案。
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const debouncedReapply = debounce(applyHighlights, 200);
    const observer = new MutationObserver((mutations) => {
      if (mutations.some(isTranslationMutation)) debouncedReapply();
    });
    observerRef.current = observer;
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["lang", "translate"],
    });

    return () => {
      debouncedReapply.cancel();
      observer.disconnect();
      observerRef.current = null;
    };
  }, [applyHighlights, containerRef]);

  // CSS Highlight 模式下事件不挂在元素上，需要 document mousemove 命中检测。
  // 始终注册监听器：MarkWrapRenderer 的 hitTestFn 返回 () => null，无额外开销；
  // 渲染器可能因 MutationObserver 触发的 applyHighlights 在运行时切换（如用户
  // 在页面加载后手动触发翻译），若在 effect 注册时判断 rendererRef 类型则
  // 不会因翻译事件重新注册，导致 CSS Highlight 注解失去 hover tooltip。
  useEffect(() => {
    let hovered: HighlightGroupInput | null = null;
    const onMove = (e: MouseEvent) => {
      if (rendererRef.current?.supportsElementEvents !== false) {
        if (hovered) { hovered = null; handleHoverEnd(); }
        return;
      }
      const hit = hitTestRef.current?.(e.clientX, e.clientY) ?? null;
      if (hit === hovered) return;
      hovered = hit;
      if (hit) {
        handleHoverStart(hit, new DOMRect(e.clientX, e.clientY - 8, 0, 16));
      } else {
        handleHoverEnd();
      }
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, [handleHoverStart, handleHoverEnd]);

  if (!tooltip) return null;
  return (
    <AnnotationTooltip
      position={tooltip}
      currentUserId={currentUserId}
      onDelete={onDeleteAnnotation ? handleDeleteAnnotation : undefined}
      onMouseEnter={handleTooltipEnter}
      onMouseLeave={handleTooltipLeave}
    />
  );
}

function rangesOverlap(a: Range, b: Range): boolean {
  return (
    a.compareBoundaryPoints(Range.START_TO_END, b) > 0 &&
    a.compareBoundaryPoints(Range.END_TO_START, b) < 0
  );
}
