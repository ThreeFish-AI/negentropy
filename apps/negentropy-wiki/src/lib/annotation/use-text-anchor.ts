/**
 * 文本锚定工具 — 基于 W3C Web Annotation TextQuoteSelector 模式
 *
 * computeAnchor: 从 Selection API 计算锚定数据
 * resolveAnchor: 给定锚定数据，在 DOM 中定位目标文本
 */

export interface TextAnchor {
  xpath: string;
  exact: string;
  prefix: string;
  suffix: string;
  text_offset: number;
  text_length: number;
}

/**
 * 从 Selection 计算锚定数据
 */
export function computeAnchor(
  selection: Selection,
  container: HTMLElement,
): TextAnchor | null {
  const range = selection.getRangeAt(0);
  if (!range) return null;

  const exact = selection.toString().trim();
  if (!exact) return null;

  // 计算 XPath 到最近块级元素
  const xpath = computeXPath(range.startContainer, container);

  // 计算 prefix/suffix 上下文
  const fullText = container.textContent || "";
  const selectedText = range.toString();
  // 通过 TreeWalker 精确定位选区起止在 fullText 中的偏移量
  const selStart = computeTextOffset(range.startContainer, range.startOffset, container);
  const contextRadius = 32;
  const prefix = selStart >= 0 ? fullText.slice(Math.max(0, selStart - contextRadius), selStart) : "";
  const suffix = selStart >= 0 ? fullText.slice(selStart + selectedText.length, selStart + selectedText.length + contextRadius) : "";

  // 计算 text_offset（相对于完整文本）
  const textOffset = selStart >= 0 ? selStart : 0;

  return {
    xpath,
    exact,
    prefix,
    suffix,
    text_offset: textOffset,
    text_length: selectedText.length,
  };
}

/**
 * 给定锚定数据，在 container 中定位目标文本，返回 DOM Range
 */
export function resolveAnchor(
  anchor: TextAnchor,
  container: HTMLElement,
): Range | null {
  // 策略 1：XPath + exact 文本验证
  const xpathRange = tryXPath(anchor, container);
  if (xpathRange) return xpathRange;

  // 策略 2：TextQuoteSelector 全文搜索（prefix + exact + suffix）
  const textRange = tryTextSearch(anchor, container);
  if (textRange) return textRange;

  return null;
}

function computeXPath(node: Node, container: HTMLElement): string {
  const parts: string[] = [];
  let current = node;

  while (current && current !== container) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as HTMLElement;
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (c) => c.tagName === el.tagName,
        );
        const idx = siblings.indexOf(el);
        const tag = el.tagName.toLowerCase();
        parts.unshift(idx > 0 ? `${tag}[${idx + 1}]` : tag);
      }
    } else if (current.nodeType === Node.TEXT_NODE) {
      const parent = current.parentElement;
      if (parent) {
        const textSiblings = Array.from(parent.childNodes).filter(
          (c) => c.nodeType === Node.TEXT_NODE,
        );
        const idx = textSiblings.indexOf(current);
        if (idx > 0) {
          parts.unshift(`text()[${idx + 1}]`);
        }
      }
    }
    current = current.parentNode as Node;
  }

  return "/" + parts.join("/");
}

/**
 * 计算 targetNode:targetOffset 在 container.textContent 中的字符偏移量。
 * 通过 TreeWalker 遍历文本节点，累加长度直到命中目标节点。
 */
function computeTextOffset(targetNode: Node, targetOffset: number, container: HTMLElement): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let offset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node === targetNode) {
      return offset + targetOffset;
    }
    offset += (node.textContent?.length ?? 0);
  }
  return offset;
}

function tryXPath(anchor: TextAnchor, container: HTMLElement): Range | null {
  try {
    // 只使用 XPath 中块级元素部分定位到粗粒度节点
    const blockParts = anchor.xpath.split("/").filter((p) => p && !p.startsWith("text()"));
    if (blockParts.length === 0) return null;

    // 在 container 内查找匹配元素
    const candidates = container.querySelectorAll(
      blockParts[blockParts.length - 1].replace(/\[\d+\]/, ""),
    );

    for (const candidate of candidates) {
      const text = candidate.textContent || "";
      if (text.includes(anchor.exact)) {
        // 在候选元素内查找精确位置
        return findTextInRange(anchor.exact, candidate as HTMLElement);
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function tryTextSearch(anchor: TextAnchor, container: HTMLElement): Range | null {
  const fullText = container.textContent || "";
  const searchText = anchor.prefix + anchor.exact + anchor.suffix;

  let startIdx = fullText.indexOf(searchText);
  if (startIdx === -1) {
    // 降级：仅搜索 exact
    startIdx = fullText.indexOf(anchor.exact);
    if (startIdx === -1) return null;
    return findTextInRange(anchor.exact, container);
  }

  const exactStart = startIdx + anchor.prefix.length;
  return findTextInRange(anchor.exact, container, exactStart);
}

function findTextInRange(
  text: string,
  root: HTMLElement,
  hintOffset?: number,
): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const nodeText = node.textContent || "";
    const localIdx = nodeText.indexOf(text, hintOffset !== undefined ? Math.max(0, hintOffset - currentOffset) : 0);

    if (localIdx !== -1) {
      const range = document.createRange();
      range.setStart(node, localIdx);
      range.setEnd(node, localIdx + text.length);
      return range;
    }
    currentOffset += nodeText.length;
  }
  return null;
}
