/**
 * 文本锚定工具 — Source-Anchored Text Selectors（基于 W3C Web Annotation TextQuoteSelector）
 *
 * 核心设计：把「注解的锚」与「用户看到的视图」解耦。
 *   - 锚定权威源 = mount 时抓取的 snapshot（见 use-snapshot.ts）
 *   - 用户视图 = 当前 DOM（可能被浏览器翻译、字体/CSS 切换、动态加载改造）
 *
 * computeAnchor: 在用户选区上计算锚定数据。若提供 snapshot 则基于 snapshot 计算
 *                exact/prefix/suffix（跨翻译稳定）；否则按当前 DOM 计算（兼容旧路径）。
 *
 * resolveAnchor: 三段式解析。snapshot 精确 → currentDOM 文本搜索 → 块级粗粒度回退。
 *                即使精确文本无法匹配（如翻译态），仍能保证「注解不消失」。
 */

import type { AnnotationSnapshot } from "./use-snapshot";
import { BLOCK_TAGS, simpleHash } from "./annotation-shared";

/** 锚定算法版本：用于未来演进时的兼容性切换。 */
export const CURRENT_ANCHOR_VERSION = 2;

export interface TextAnchor {
  xpath: string;
  exact: string;
  prefix: string;
  suffix: string;
  text_offset: number;
  text_length: number;
  /**
   * 创建时的 snapshot.textHash。用于 resolveAnchor 段 1 决定是否可以
   * "信任 anchor.text_offset 直接在 snapshot.textNodes 上定位"。
   */
  source_text_hash?: string;
  /** 创建时检测到的内容主语言（"en" / "zh" / 等）。仅用于诊断，不参与算法。 */
  source_lang?: string;
  /** 锚定算法版本。缺省视为 v1（旧版，无 snapshot 字段）。 */
  anchor_version?: number;
}

/**
 * 从 Selection 计算锚定数据。
 *
 * @param selection - 当前选区
 * @param container - 注解容器（如 .wiki-markdown-body）
 * @param snapshot  - 可选的稳定快照。提供时锚定到 snapshot 坐标系；否则按旧路径。
 */
export function computeAnchor(
  selection: Selection,
  container: HTMLElement,
  snapshot?: AnnotationSnapshot | null,
): TextAnchor | null {
  const range = selection.getRangeAt(0);
  if (!range) return null;

  const displayExact = selection.toString().trim();
  if (!displayExact) return null;

  const xpath = computeXPath(range.startContainer, container);

  // 优先尝试基于 snapshot 计算（source-anchored）
  if (snapshot) {
    const fromSnapshot = computeFromSnapshot(range, container, snapshot, xpath);
    if (fromSnapshot) return fromSnapshot;
  }

  // 回退：按当前 DOM 计算（兼容路径，与旧版 v1 行为一致）
  const fullText = container.textContent || "";
  const selectedText = range.toString();
  const selStart = computeTextOffset(range.startContainer, range.startOffset, container);
  const contextRadius = 32;
  const prefix = selStart >= 0
    ? fullText.slice(Math.max(0, selStart - contextRadius), selStart)
    : "";
  const suffix = selStart >= 0
    ? fullText.slice(
        selStart + selectedText.length,
        selStart + selectedText.length + contextRadius,
      )
    : "";

  return {
    xpath,
    exact: displayExact,
    prefix,
    suffix,
    text_offset: selStart >= 0 ? selStart : 0,
    text_length: selectedText.length,
    source_text_hash: snapshot?.textHash,
    source_lang: detectLang(displayExact),
    anchor_version: snapshot ? CURRENT_ANCHOR_VERSION : 1,
  };
}

/**
 * 尝试用 snapshot 计算锚定。
 *
 * 算法：
 *   1. 计算 selection 在当前 DOM 中的字符偏移（curStart, curEnd）
 *   2. 当前 textContent == snapshot.textContent（hash 一致）→ 直接用偏移
 *   3. 否则（翻译态等）→ 找到 selection 落在的块级元素 → 按字符比例映射回 snapshot
 *      该块级元素对应位置 → 在 snapshot 中切片得到 anchor.exact/prefix/suffix
 */
function computeFromSnapshot(
  range: Range,
  container: HTMLElement,
  snapshot: AnnotationSnapshot,
  xpath: string,
): TextAnchor | null {
  const curStart = computeTextOffset(range.startContainer, range.startOffset, container);
  const curEnd = computeTextOffset(range.endContainer, range.endOffset, container);
  if (curStart < 0 || curEnd < 0 || curEnd <= curStart) return null;

  const curText = container.textContent || "";
  const curHash = snapshot.textHash; // 容器当前 hash 与 snapshot 比较

  // 路径 A：当前 DOM == snapshot（未被翻译/修改），直接用偏移
  if (simpleHash(curText) === curHash) {
    const exact = snapshot.textContent.slice(curStart, curEnd);
    const prefix = snapshot.textContent.slice(Math.max(0, curStart - 32), curStart);
    const suffix = snapshot.textContent.slice(curEnd, Math.min(snapshot.textContent.length, curEnd + 32));
    return {
      xpath,
      exact,
      prefix,
      suffix,
      text_offset: curStart,
      text_length: exact.length,
      source_text_hash: snapshot.textHash,
      source_lang: detectLang(exact),
      anchor_version: CURRENT_ANCHOR_VERSION,
    };
  }

  // 路径 B：当前 DOM ≠ snapshot（如翻译态），按块级元素字符比例映射回 snapshot
  const projected = projectRangeToSnapshot(curStart, curEnd, container, snapshot);
  if (!projected) return null;
  const { snapStart, snapEnd } = projected;
  const exact = snapshot.textContent.slice(snapStart, snapEnd);
  const prefix = snapshot.textContent.slice(Math.max(0, snapStart - 32), snapStart);
  const suffix = snapshot.textContent.slice(snapEnd, Math.min(snapshot.textContent.length, snapEnd + 32));
  return {
    xpath,
    exact,
    prefix,
    suffix,
    text_offset: snapStart,
    text_length: exact.length,
    source_text_hash: snapshot.textHash,
    source_lang: detectLang(exact),
    anchor_version: CURRENT_ANCHOR_VERSION,
  };
}

/**
 * 跨翻译态投影：把"当前 DOM 的字符偏移 [curStart, curEnd)"
 * 按块级元素字符比例映射回 snapshot 中的字符偏移。
 *
 * 这是近似映射（中英文字符数不等比），但能将注解锚到正确的块级范围内。
 */
function projectRangeToSnapshot(
  curStart: number,
  curEnd: number,
  container: HTMLElement,
  snapshot: AnnotationSnapshot,
): { snapStart: number; snapEnd: number } | null {
  // 找到当前 DOM 中 curStart 所在的块级元素
  const blockAtStart = findCurrentBlockByOffset(container, curStart);
  const blockAtEnd = findCurrentBlockByOffset(container, curEnd);
  if (!blockAtStart || !blockAtEnd) return null;

  const snapStartBlock = snapshot.blockElements.find(
    (b) => b.element === blockAtStart.element,
  );
  const snapEndBlock = snapshot.blockElements.find(
    (b) => b.element === blockAtEnd.element,
  );
  if (!snapStartBlock || !snapEndBlock) return null;

  const ratioStart =
    blockAtStart.length > 0
      ? (curStart - blockAtStart.offset) / blockAtStart.length
      : 0;
  const ratioEnd =
    blockAtEnd.length > 0
      ? (curEnd - blockAtEnd.offset) / blockAtEnd.length
      : 1;

  const snapStart = Math.round(
    snapStartBlock.offset + ratioStart * snapStartBlock.text.length,
  );
  const snapEnd = Math.round(
    snapEndBlock.offset + ratioEnd * snapEndBlock.text.length,
  );
  if (snapEnd <= snapStart) return null;
  return { snapStart, snapEnd };
}

interface CurrentBlock {
  element: HTMLElement;
  offset: number; // 在容器 textContent 中的起始偏移
  length: number; // 当前 textContent 长度
}

/** 找到当前 DOM 中、容器全局字符 offset 所在的最内层块级元素。 */
function findCurrentBlockByOffset(
  container: HTMLElement,
  offset: number,
): CurrentBlock | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let cursor = 0;
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const len = textNode.nodeValue?.length ?? 0;
    if (cursor + len >= offset) {
      // 这个 text node 包含目标 offset
      const block = findNearestBlock(textNode, container);
      if (!block) return null;
      return {
        element: block,
        offset: computeBlockOffset(block, container),
        length: block.textContent?.length ?? 0,
      };
    }
    cursor += len;
    node = walker.nextNode();
  }
  return null;
}

function findNearestBlock(node: Node, container: HTMLElement): HTMLElement | null {
  let cur: Node | null = node.parentElement;
  while (cur && cur !== container) {
    if (cur.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((cur as HTMLElement).tagName)) {
      return cur as HTMLElement;
    }
    cur = cur.parentElement;
  }
  return null;
}

function computeBlockOffset(block: HTMLElement, container: HTMLElement): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node = walker.nextNode();
  while (node) {
    const t = node as Text;
    if (block.contains(t)) return offset;
    offset += t.nodeValue?.length ?? 0;
    node = walker.nextNode();
  }
  return 0;
}

/**
 * 给定锚定数据，在 container 中定位目标文本，返回 DOM Range。
 *
 * 四段式解析（每段独立失败 → 进入下一段，保证「注解不消失」）：
 *   段 1：snapshot 精确匹配（仅在 anchor_version >= 2 且 hash 一致时）
 *   段 2：当前 DOM 的 prefix+exact+suffix 全文搜索（兼容 v1 anchor 与同语言场景）
 *   段 2.5：用 quoted_text（创建时用户看到的显示文本）搜索当前 DOM（跨语言匹配）
 *   段 3：块级元素粗粒度回退（用 xpath 找块级元素，整体选中）
 */
export function resolveAnchor(
  anchor: TextAnchor,
  container: HTMLElement,
  snapshot?: AnnotationSnapshot | null,
  quotedText?: string,
): Range | null {
  // 段 1：snapshot 精确（仅 v2+ anchor 且 hash 一致）
  if (
    snapshot &&
    (anchor.anchor_version ?? 1) >= 2 &&
    anchor.source_text_hash &&
    anchor.source_text_hash === snapshot.textHash
  ) {
    // 此分支表示 snapshot 仍可信，可以用 anchor.text_offset 直接在 snapshot.textNodes 上定位
    const fromSnapshot = resolveBySnapshotOffset(anchor, snapshot);
    if (fromSnapshot) return fromSnapshot;
  }

  // 段 2：XPath 提示的 + 当前 DOM 文本搜索（兼容 v1 / 旧数据 / 同语言场景）
  const xpathRange = tryXPath(anchor, container);
  if (xpathRange) return xpathRange;
  const textRange = tryTextSearch(anchor, container);
  if (textRange) return textRange;

  // 段 2.5：quoted_text 跨语言匹配。用注解创建时的显示文本在当前 DOM 中搜索，
  // 解决 anchor.exact（原文）与翻译后 DOM 不匹配的问题。
  if (quotedText && quotedText !== anchor.exact) {
    const quotedRange = findTextAcrossNodes(quotedText, container);
    if (quotedRange) return quotedRange;
  }

  // 段 3：块级粗粒度回退 —— 保证用户至少看到"这段被注解过"
  return resolveBlockFallback(anchor, container);
}

/**
 * 段 1 的具体实现：用 anchor.text_offset/text_length 在 snapshot.textNodes 上定位。
 *
 * 翻译态下 snapshot.textNodes 仍是同一物理引用（Chrome 翻译就地修改 nodeValue），
 * 但每个 node 的 nodeValue 长度变了 —— 不能直接 setStart(node, offsetWithinNode)，
 * 因为 offset 是 snapshot 时的字符位置，可能超出当前 nodeValue 长度。
 *
 * 策略：用 snapshot.originalNodeValues 反推每个 text node 的原始长度，定位到
 *      snapshot 坐标系中的 text node + offsetWithinNode；然后按当前 nodeValue
 *      长度比例映射到当前 offset（同语言下比例 = 1 即精确）。
 */
function resolveBySnapshotOffset(
  anchor: TextAnchor,
  snapshot: AnnotationSnapshot,
): Range | null {
  const target = anchor.text_offset;
  const targetEnd = target + (anchor.text_length || anchor.exact.length);

  const startLoc = locateNodeByOriginalOffset(target, snapshot);
  const endLoc = locateNodeByOriginalOffset(targetEnd, snapshot);
  if (!startLoc || !endLoc) return null;

  // 确认 text node 仍在 DOM 中（如果被翻译扩展替换，引用会脱离 DOM）
  if (!startLoc.node.isConnected || !endLoc.node.isConnected) return null;

  // 按当前 nodeValue 长度比例映射 offset
  const startOffset = mapOffsetWithinNode(startLoc.node, startLoc.offsetWithin, snapshot);
  const endOffset = mapOffsetWithinNode(endLoc.node, endLoc.offsetWithin, snapshot);
  if (startOffset === null || endOffset === null) return null;

  try {
    const range = document.createRange();
    range.setStart(startLoc.node, startOffset);
    range.setEnd(endLoc.node, endOffset);
    return range;
  } catch {
    return null;
  }
}

interface NodeLocation {
  node: Text;
  offsetWithin: number; // 在 snapshot 中该 text node 内的字符偏移
}

function locateNodeByOriginalOffset(
  offset: number,
  snapshot: AnnotationSnapshot,
): NodeLocation | null {
  let cursor = 0;
  for (const node of snapshot.textNodes) {
    const orig = snapshot.originalNodeValues.get(node) ?? "";
    if (cursor + orig.length >= offset) {
      return { node, offsetWithin: offset - cursor };
    }
    cursor += orig.length;
  }
  // 若 offset 超出（罕见），返回最后一个 node 的末尾
  const last = snapshot.textNodes[snapshot.textNodes.length - 1];
  if (!last) return null;
  const orig = snapshot.originalNodeValues.get(last) ?? "";
  return { node: last, offsetWithin: orig.length };
}

function mapOffsetWithinNode(
  node: Text,
  snapshotOffset: number,
  snapshot: AnnotationSnapshot,
): number | null {
  const orig = snapshot.originalNodeValues.get(node) ?? "";
  const cur = node.nodeValue ?? "";
  if (orig.length === 0) return Math.min(snapshotOffset, cur.length);
  // 同语言（未翻译）情况下 cur 与 orig 相同，比例 = 1
  if (cur === orig) return Math.min(snapshotOffset, cur.length);
  // 跨语言情况：按字符比例映射（粗粒度但稳定）
  const ratio = snapshotOffset / orig.length;
  return Math.max(0, Math.min(cur.length, Math.round(ratio * cur.length)));
}

function computeXPath(node: Node, container: HTMLElement): string {
  const parts: string[] = [];
  let current = node;

  while (current && current !== container) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as HTMLElement;
      // 跳过浏览器翻译产物（如 <font>），确保 XPath 跨翻译态一致
      if (TRANSLATION_SKIP_TAGS.has(el.tagName)) {
        current = current.parentNode as Node;
        continue;
      }
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
        const idx = textSiblings.indexOf(current as ChildNode);
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
 */
function computeTextOffset(targetNode: Node, targetOffset: number, container: HTMLElement): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let offset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node === targetNode) {
      return offset + targetOffset;
    }
    if (node.parentNode === targetNode && targetNode.nodeType === Node.ELEMENT_NODE) {
      // selection 落在元素节点上（罕见，浏览器多落在 text node）
      return offset;
    }
    offset += (node.textContent?.length ?? 0);
  }
  return offset;
}

function tryXPath(anchor: TextAnchor, container: HTMLElement): Range | null {
  try {
    const blockParts = anchor.xpath.split("/").filter((p) => p && !p.startsWith("text()"));
    if (blockParts.length === 0) return null;

    const candidates = container.querySelectorAll(
      blockParts[blockParts.length - 1].replace(/\[\d+\]/, ""),
    );

    for (const candidate of candidates) {
      const text = candidate.textContent || "";
      if (text.includes(anchor.exact)) {
        return findTextInSingleNode(anchor.exact, candidate as HTMLElement);
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function tryTextSearch(anchor: TextAnchor, container: HTMLElement): Range | null {
  const fullText = container.textContent || "";
  const searchText = (anchor.prefix || "") + anchor.exact + (anchor.suffix || "");

  let startIdx = fullText.indexOf(searchText);
  if (startIdx === -1) {
    startIdx = fullText.indexOf(anchor.exact);
    if (startIdx === -1) return null;
    return findTextInSingleNode(anchor.exact, container);
  }

  const exactStart = startIdx + (anchor.prefix?.length || 0);
  return findTextInSingleNode(anchor.exact, container, exactStart);
}

/**
 * 段 3：块级粗粒度回退。
 *
 * 即使精确文本无法匹配（如跨语言翻译），仍能通过 anchor.xpath 找到块级元素的
 * DOM 引用，整体选中该元素作为粗粒度高亮。用户至少看到「这段被注解过」，
 * hover 仍能弹出注解内容。
 *
 * 这是「注解不消失」承诺的最后防线。
 */
function resolveBlockFallback(anchor: TextAnchor, container: HTMLElement): Range | null {
  try {
    // 过滤 text() 和翻译产物元素（如 font），确保 XPath 跨翻译态一致
    const parts = anchor.xpath
      .split("/")
      .filter((p) => p && !p.startsWith("text()"))
      .filter((p) => {
        const match = /^([a-zA-Z0-9]+)/.exec(p);
        return match && !TRANSLATION_SKIP_TAGS.has(match[1].toUpperCase());
      });
    if (parts.length === 0) return null;

    // 解析 XPath 风格的路径（如 "/p[2]/strong[1]"）逐级定位
    let cur: Element = container;
    for (const part of parts) {
      const match = /^([a-zA-Z0-9]+)(?:\[(\d+)\])?$/.exec(part);
      if (!match) return null;
      const [, tag, idxStr] = match;
      const siblings = Array.from(cur.children).filter(
        (c) => c.tagName.toLowerCase() === tag.toLowerCase(),
      );
      const idx = idxStr ? parseInt(idxStr, 10) - 1 : 0;
      const next = siblings[idx];
      if (!next) return null;
      cur = next;
    }

    // 整体选中该块级元素的内容
    if (!cur.firstChild) return null;
    const range = document.createRange();
    range.selectNodeContents(cur);
    return range;
  } catch {
    return null;
  }
}

/**
 * 单节点文本搜索：在 root 下逐个 Text 节点内查找 text，
 * 返回始终在单个 Text 节点内的 DOM Range。
 *
 * 用于 Stage 2（tryXPath / tryTextSearch），保证返回的 Range 不跨越元素边界，
 * 从而与 MarkWrapRenderer 的 surroundContents() 兼容。
 */
function findTextInSingleNode(
  text: string,
  root: HTMLElement,
  hintOffset?: number,
): Range | null {
  if (!text) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const nodeText = node.textContent || "";
    const localIdx = nodeText.indexOf(
      text,
      hintOffset !== undefined ? Math.max(0, hintOffset - currentOffset) : 0,
    );
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

interface TextSegment {
  node: Text;
  /** 该节点文本在拼接字符串中的起始位置。 */
  start: number;
  /** 该节点文本在拼接字符串中的结束位置（不含）。 */
  end: number;
}

/**
 * 跨节点文本搜索：在 root 下所有 Text 节点的拼接内容中查找 text，
 * 返回可能跨越多个文本节点的 DOM Range。
 *
 * Chrome 翻译会将文本拆分到多个 <font> 元素内（各自含独立 Text 节点），
 * 导致旧版 findTextInRange（单节点 indexOf）无法命中跨节点文本。
 * 此函数通过拼接全部文本节点内容后统一搜索解决该问题。
 */
function findTextAcrossNodes(
  text: string,
  root: HTMLElement,
  hintOffset?: number,
): Range | null {
  if (!text) return null;

  // Phase 1：遍历所有 Text 节点，构建拼接内容 + 段映射
  const segments: TextSegment[] = [];
  let concatenated = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const textNode = n as Text;
    const value = textNode.nodeValue ?? "";
    if (value.length === 0) continue;
    const start = concatenated.length;
    concatenated += value;
    segments.push({ node: textNode, start, end: concatenated.length });
  }

  if (segments.length === 0 || concatenated.length < text.length) return null;

  // Phase 2：在拼接字符串中搜索目标文本
  const searchStart = hintOffset !== undefined ? Math.max(0, hintOffset) : 0;
  const matchIndex = concatenated.indexOf(text, searchStart);
  if (matchIndex === -1) return null;

  // Phase 3：将匹配边界映射回 Text 节点 + 偏移
  const matchEnd = matchIndex + text.length;
  const startLoc = locateSegment(segments, matchIndex);
  const endLoc = locateSegment(segments, matchEnd - 1);

  if (!startLoc || !endLoc) return null;

  try {
    const range = document.createRange();
    range.setStart(startLoc.node, matchIndex - startLoc.start);
    range.setEnd(endLoc.node, matchEnd - endLoc.start);
    return range;
  } catch {
    return null;
  }
}

/** 二分查找包含指定字符位置的段。position 必须在 [seg.start, seg.end) 范围内。 */
function locateSegment(
  segments: TextSegment[],
  position: number,
): TextSegment | null {
  let lo = 0;
  let hi = segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const seg = segments[mid];
    if (position < seg.start) {
      hi = mid - 1;
    } else if (position >= seg.end) {
      lo = mid + 1;
    } else {
      return seg;
    }
  }
  return null;
}

/** 极简语言检测：含 CJK 字符 → "zh"，否则 "en"。仅用于诊断，不参与匹配。 */
function detectLang(text: string): string {
  return /[一-鿿]/.test(text) ? "zh" : "en";
}

/** 浏览器翻译产物元素 —— computeXPath / resolveBlockFallback 跳过此类标签，确保 XPath 跨翻译态一致。 */
const TRANSLATION_SKIP_TAGS = new Set(["FONT"]);
