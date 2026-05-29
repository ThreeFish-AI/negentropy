"use client";

/**
 * 注解高亮渲染器抽象 —— Strategy Pattern
 *
 * 提供两种渲染策略，运行时根据浏览器能力与上下文（是否翻译态）切换：
 *
 *  ┌─────────────────────────┬──────────────────────────────────────────────┐
 *  │ MarkWrapRenderer        │ <mark> 包裹 Range。事件交互简单。            │
 *  │  (兼容性最好，默认)     │ 但在浏览器翻译时 mark 节点可能被 <font>      │
 *  │                         │ 包裹破坏，高亮显示异常。                     │
 *  ├─────────────────────────┼──────────────────────────────────────────────┤
 *  │ CSSHighlightRenderer    │ CSS Custom Highlight API（不修改 DOM）。     │
 *  │  (现代浏览器，优先)     │ 完全免疫浏览器翻译的 DOM 改造；但需要        │
 *  │                         │ document mousemove + caretRangeFromPoint     │
 *  │                         │ 模拟 hover 事件。                            │
 *  └─────────────────────────┴──────────────────────────────────────────────┘
 *
 * 兼容性参考（2026）：
 *   Chrome 105+ (2022-08) ✓
 *   Safari 17.2+ (2023-12) ✓
 *   Firefox 140+ (2025) ✓
 *
 * 不支持时自动降级至 MarkWrapRenderer，保证零回归。
 *
 * 参考：[3] W3C CSS Custom Highlight API Editor's Draft
 *   https://drafts.csswg.org/css-highlight-api/
 */

import type { AnnotationItem } from "./use-annotations";

const CSS_HIGHLIGHT_NAME = "wiki-annotation";

/** 运行时注入 ::highlight() 样式（绕过 LightningCSS 不识别该伪元素的构建限制） */
const HIGHLIGHT_STYLE_ID = "wiki-annotation-highlight-style";
function injectHighlightStyle(): void {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `::highlight(${CSS_HIGHLIGHT_NAME}) {
  background-color: rgba(255, 212, 59, 0.32);
  text-decoration: underline wavy rgba(255, 180, 0, 0.7);
  text-decoration-skip-ink: none;
}`;
  document.head.appendChild(style);
}

export interface HighlightGroupInput {
  /** 注解 ID 列表（重叠的多条注解会合并为一个 group） */
  annotationIds: string[];
  /** 已解析的 DOM Range */
  range: Range;
  /** 关联的注解数据（用于 tooltip 展示） */
  annotations: AnnotationItem[];
}

/** 命中检测回调：给定坐标返回该坐标下命中的 group（用于 tooltip 触发） */
export type HitTestFn = (x: number, y: number) => HighlightGroupInput | null;

export interface HighlightRenderer {
  /** 应用一组高亮，返回命中检测函数（供 hover tooltip 使用） */
  apply(groups: HighlightGroupInput[]): HitTestFn;
  /** 清除所有高亮 */
  clear(): void;
  /** 是否支持事件直挂在元素上（true: mark 模式可监听 mouseenter；false: 需要 mousemove 命中检测） */
  supportsElementEvents: boolean;
}

/** 检测当前环境是否支持 CSS Custom Highlight API。 */
export function supportsCSSHighlightAPI(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      "highlights" in CSS &&
      typeof (CSS as unknown as { highlights?: unknown }).highlights !== "undefined" &&
      typeof Highlight !== "undefined"
    );
  } catch {
    return false;
  }
}

// ============================================================================
// MarkWrapRenderer：<mark> 包裹（兼容路径，默认）
// ============================================================================

export function createMarkWrapRenderer(
  onHoverStart: (group: HighlightGroupInput, rect: DOMRect) => void,
  onHoverEnd: () => void,
): HighlightRenderer {
  let mountedMarks: { el: HTMLElement; group: HighlightGroupInput }[] = [];

  return {
    supportsElementEvents: true,
    apply(groups) {
      // 清除上一次
      mountedMarks.forEach(({ el }) => unwrapMark(el));
      mountedMarks = [];

      for (const group of groups) {
        const mark = buildMarkElement(group, onHoverStart, onHoverEnd);
        try {
          group.range.surroundContents(mark);
          mountedMarks.push({ el: mark, group });
        } catch {
          try {
            const fragment = group.range.extractContents();
            mark.appendChild(fragment);
            group.range.insertNode(mark);
            mountedMarks.push({ el: mark, group });
          } catch {
            // 极端情况：跨节点且 extractContents 也失败，跳过
          }
        }
      }

      // mark 模式下事件直挂在元素上，hitTestFn 仅作为 fallback
      return () => null;
    },
    clear() {
      mountedMarks.forEach(({ el }) => unwrapMark(el));
      mountedMarks = [];
    },
  };
}

function buildMarkElement(
  group: HighlightGroupInput,
  onHoverStart: (group: HighlightGroupInput, rect: DOMRect) => void,
  onHoverEnd: () => void,
): HTMLElement {
  const mark = document.createElement("mark");
  mark.className = "wiki-annotation-highlight";
  mark.dataset.annotationIds = group.annotationIds.join(",");
  mark.addEventListener("mouseenter", () => {
    onHoverStart(group, mark.getBoundingClientRect());
  });
  mark.addEventListener("mouseleave", () => {
    onHoverEnd();
  });
  return mark;
}

function unwrapMark(el: HTMLElement) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

// ============================================================================
// CSSHighlightRenderer：CSS Custom Highlight API（现代浏览器，免疫翻译）
// ============================================================================

interface HighlightWithRanges {
  add(range: Range): void;
  clear(): void;
}

interface CSSHighlightsRegistry {
  set(name: string, highlight: HighlightWithRanges): void;
  delete(name: string): void;
}

export function createCSSHighlightRenderer(): HighlightRenderer {
  let currentGroups: HighlightGroupInput[] = [];

  return {
    supportsElementEvents: false,
    apply(groups) {
      currentGroups = groups;
      try {
        injectHighlightStyle();
        const HighlightCtor = (window as unknown as {
          Highlight: new (...ranges: Range[]) => HighlightWithRanges;
        }).Highlight;
        const registry = (CSS as unknown as { highlights: CSSHighlightsRegistry }).highlights;
        const allRanges = groups.map((g) => g.range);
        const highlight = new HighlightCtor(...allRanges);
        registry.set(CSS_HIGHLIGHT_NAME, highlight);
      } catch {
        // 不应到达；createCSSHighlightRenderer 仅在 supportsCSSHighlightAPI 时创建
      }
      return hitTestFactory(currentGroups);
    },
    clear() {
      try {
        const registry = (CSS as unknown as { highlights: CSSHighlightsRegistry }).highlights;
        registry.delete(CSS_HIGHLIGHT_NAME);
      } catch {
        // ignore
      }
      currentGroups = [];
    },
  };
}

/**
 * 通过 caretRangeFromPoint 实现命中检测。
 *
 * 因为 CSS Highlight API 不参与事件冒泡，必须用 document mousemove +
 * 坐标 → Range 反查 + Range 包含关系来判断当前光标是否在某个高亮范围内。
 */
function hitTestFactory(groups: HighlightGroupInput[]): HitTestFn {
  return (x, y) => {
    let candidateRange: Range | null = null;
    try {
      // caretRangeFromPoint 在多数主流浏览器中可用（Chrome/Safari/Firefox 109+）
      const doc = document as unknown as {
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
        caretPositionFromPoint?: (
          x: number,
          y: number,
        ) => { offsetNode: Node; offset: number } | null;
      };
      if (typeof doc.caretRangeFromPoint === "function") {
        candidateRange = doc.caretRangeFromPoint(x, y);
      } else if (typeof doc.caretPositionFromPoint === "function") {
        const pos = doc.caretPositionFromPoint(x, y);
        if (pos) {
          candidateRange = document.createRange();
          candidateRange.setStart(pos.offsetNode, pos.offset);
          candidateRange.setEnd(pos.offsetNode, pos.offset);
        }
      }
    } catch {
      return null;
    }
    if (!candidateRange) return null;
    // 找包含此 caret 点的高亮 group
    for (const group of groups) {
      try {
        if (
          group.range.comparePoint(
            candidateRange.startContainer,
            candidateRange.startOffset,
          ) === 0
        ) {
          return group;
        }
      } catch {
        // comparePoint 在跨 document 边界时抛错，忽略
      }
    }
    return null;
  };
}

// ============================================================================
// 自适应选择：根据能力与上下文构造合适的渲染器
// ============================================================================

export interface RendererFactory {
  (
    onHoverStart: (group: HighlightGroupInput, rect: DOMRect) => void,
    onHoverEnd: () => void,
  ): HighlightRenderer;
}

/**
 * 自适应工厂：
 *   - 翻译态优先用 CSSHighlightRenderer（免疫 <font> 包裹破坏）
 *   - 否则优先用 MarkWrapRenderer（事件交互简单）
 *   - CSS Highlight API 不支持时回退到 MarkWrapRenderer
 */
export function pickRenderer(opts: {
  isTranslated: boolean;
}): RendererFactory {
  if (opts.isTranslated && supportsCSSHighlightAPI()) {
    return () => createCSSHighlightRenderer();
  }
  return (onHoverStart, onHoverEnd) =>
    createMarkWrapRenderer(onHoverStart, onHoverEnd);
}
