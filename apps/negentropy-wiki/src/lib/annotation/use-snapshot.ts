"use client";

/**
 * 注解稳定快照（Annotation Stable Snapshot）
 *
 * 设计动机（解决 R1/R2/R4）：
 *   现行实现把「用户当前可见的 DOM」当作锚定权威源 —— 但浏览器翻译会
 *   原地修改 text node 的 nodeValue 或包裹 <font>，导致同一物理位置的
 *   textContent 在不同时刻有不同值（英文 ↔ 中文不可逆映射）。
 *
 *   正确做法是把「mount 时的初次渲染态」固化为唯一权威坐标系（snapshot），
 *   后续所有 computeAnchor / resolveAnchor 都基于 snapshot 进行字符级定位；
 *   即使浏览器把 text node 的 nodeValue 改成了译文，snapshot 中保留的
 *   originalNodeValues 备份仍然提供反向映射能力。
 *
 * 业界对照：W3C Web Annotation Data Model [1] 与 Hypothes.is dom-anchor [2]
 * 的统一前提即「锚定到稳定、规范化的内容源」。本快照实现了这一前提的
 * 客户端版本。
 *
 * [1] https://www.w3.org/TR/annotation-model/
 * [2] https://github.com/tilgovi/dom-anchor-text-quote
 */

import { useEffect, useRef } from "react";

/** 单个块级元素在 snapshot 中的记录。XPath 是用于跨翻译保持稳定的"位置坐标"。 */
export interface SnapshotBlock {
  element: HTMLElement; // mount 时持有的块级元素 DOM 引用
  xpath: string;        // 相对于容器的 XPath（如 "/p[2]/strong[1]"）
  text: string;         // mount 时该元素的 textContent（权威原文）
  offset: number;       // 该元素在容器 textContent 中的起始字符偏移
}

export interface AnnotationSnapshot {
  /** mount 时的容器全文 textContent —— 权威原文 */
  textContent: string;
  /** mount 时的所有 text node 引用（按 TreeWalker 顺序） */
  textNodes: Text[];
  /** 每个 text node 的原始 nodeValue 备份（翻译会修改 nodeValue，引用仍可用） */
  originalNodeValues: WeakMap<Text, string>;
  /** 块级元素索引：用于翻译态下"块级粗粒度回退"和投影 */
  blockElements: SnapshotBlock[];
  /** textContent 的轻量哈希，用于跨次访问的版本校验 */
  textHash: string;
}

const BLOCK_TAGS = new Set([
  "P", "LI", "BLOCKQUOTE", "PRE", "TABLE", "TR", "TD", "TH",
  "H1", "H2", "H3", "H4", "H5", "H6",
  "DIV", "ARTICLE", "SECTION", "FIGURE", "FIGCAPTION",
]);

/**
 * 抓取容器在当前时刻的 snapshot。可重入：每次调用产出独立 snapshot 对象。
 */
export function captureSnapshot(container: HTMLElement): AnnotationSnapshot {
  const textNodes: Text[] = [];
  const originalNodeValues = new WeakMap<Text, string>();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let textContent = "";
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    textNodes.push(textNode);
    originalNodeValues.set(textNode, textNode.nodeValue ?? "");
    textContent += textNode.nodeValue ?? "";
    node = walker.nextNode();
  }

  const blockElements = collectBlockElements(container);
  const textHash = simpleHash(textContent);

  return {
    textContent,
    textNodes,
    originalNodeValues,
    blockElements,
    textHash,
  };
}

/**
 * 抓取所有块级元素 + 该元素在容器 textContent 中的起始字符偏移。
 * 块级元素 DOM 引用即使被浏览器翻译也通常保留（Chrome 翻译保留 tag 结构，
 * 仅修改 text node 内容或在外层加 <font>）。
 */
function collectBlockElements(container: HTMLElement): SnapshotBlock[] {
  const blocks: SnapshotBlock[] = [];
  const all = container.querySelectorAll<HTMLElement>(
    Array.from(BLOCK_TAGS).map((t) => t.toLowerCase()).join(","),
  );
  // 维护"已遍历到的全局字符偏移"，用 TreeWalker 单次扫描完成
  const offsetByElement = new WeakMap<HTMLElement, number>();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let cursor = 0;
  let n = walker.nextNode();
  while (n) {
    const textNode = n as Text;
    let parent: HTMLElement | null = textNode.parentElement;
    // 记录该 text node 的"最近一个块级祖先"的起始 offset（取最小值）
    while (parent && parent !== container) {
      if (BLOCK_TAGS.has(parent.tagName) && !offsetByElement.has(parent)) {
        offsetByElement.set(parent, cursor);
      }
      parent = parent.parentElement;
    }
    cursor += textNode.nodeValue?.length ?? 0;
    n = walker.nextNode();
  }
  for (const el of Array.from(all)) {
    blocks.push({
      element: el,
      xpath: computeRelativeXPath(el, container),
      text: el.textContent ?? "",
      offset: offsetByElement.get(el) ?? 0,
    });
  }
  return blocks;
}

/** 相对于容器的 XPath，与 use-text-anchor 中的 computeXPath 风格一致。 */
function computeRelativeXPath(node: Element, container: HTMLElement): string {
  const parts: string[] = [];
  let current: Element | null = node;
  while (current && current !== container) {
    const cur: Element = current;
    const parent: HTMLElement | null = cur.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children).filter(
      (c): c is Element => c.tagName === cur.tagName,
    );
    const idx = siblings.indexOf(cur);
    parts.unshift(
      idx > 0 ? `${cur.tagName.toLowerCase()}[${idx + 1}]` : cur.tagName.toLowerCase(),
    );
    current = parent;
  }
  return "/" + parts.join("/");
}

/** 轻量级 32-bit FNV-1a 哈希，避免引入 crypto 依赖。 */
function simpleHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Hook：mount 完成后立即抓 snapshot。
 *
 * 注意时序：MarkdownRenderer 同步渲染（content 是 prop 传入），useEffect 在 paint 后执行，
 * 此时 DOM 已稳定；浏览器翻译至少要等一次 paint 后才启动。所以抓 snapshot
 * 仍能赶在翻译之前完成。
 */
export function useSnapshot(
  containerRef: React.RefObject<HTMLElement | null>,
  /** 触发 snapshot 重抓的依赖（如 entryId 变化、内容版本更新）。默认空数组只抓一次。 */
  deps: React.DependencyList = [],
): React.MutableRefObject<AnnotationSnapshot | null> {
  const snapshotRef = useRef<AnnotationSnapshot | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // 防御：textContent 为空（理论上不该发生）时不抓，等下一帧
    if ((container.textContent ?? "").length === 0) {
      const id = requestAnimationFrame(() => {
        if (containerRef.current) {
          snapshotRef.current = captureSnapshot(containerRef.current);
        }
      });
      return () => cancelAnimationFrame(id);
    }
    snapshotRef.current = captureSnapshot(container);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, ...deps]);

  return snapshotRef;
}
