/**
 * 浏览器翻译态检测与信号鉴别
 *
 * 解决根因 R3：浏览器原生翻译是 native 异步行为，不触发 React 重渲染，
 * 也不通过常规事件通知 JS。需要靠 MutationObserver 主动监测 DOM 变化，
 * 在翻译完成（或回退）后重新执行高亮应用。
 *
 * 翻译信号鉴别（启发式，覆盖主流浏览器）：
 *   - Chrome / Edge：在文本节点外包裹 <font style="vertical-align: inherit;">
 *     或修改 text node 的 nodeValue
 *   - Safari：使用 _msttexthash / _msthash 属性或 <span lang="x"> 包裹
 *   - 通用：document.documentElement.lang 改变；container 内 lang 属性插入
 */

const TRANSLATION_TAG_NAMES = new Set(["FONT"]);
const TRANSLATION_DATA_ATTRS = [
  "_msttexthash",
  "_msthash",
  "data-original-content",
];

/**
 * 鉴别 DOM 变更是否来自浏览器翻译。
 *
 * 设计原则：宁可多触发一次重试（cost ~ms），也不要漏判（cost: 注解消失）。
 */
export function isTranslationMutation(mutation: MutationRecord): boolean {
  // 信号 1：新增的子节点中含 <font>（Chrome / Edge 翻译特征）
  if (mutation.type === "childList") {
    for (const node of Array.from(mutation.addedNodes)) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        TRANSLATION_TAG_NAMES.has((node as Element).tagName)
      ) {
        return true;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        for (const attr of TRANSLATION_DATA_ATTRS) {
          if (el.hasAttribute(attr)) return true;
        }
        // 子树里有 <font> 也算（翻译扩展通常一次替换一大块）
        if (el.querySelector?.("font")) return true;
      }
    }
  }

  // 信号 2：text node 的 nodeValue 被修改（characterData）
  if (mutation.type === "characterData") {
    return true;
  }

  // 信号 3：lang / translate 属性变化
  if (mutation.type === "attributes") {
    if (mutation.attributeName === "lang" || mutation.attributeName === "translate") {
      return true;
    }
  }

  return false;
}

/**
 * 判断容器当前是否处于浏览器翻译态。
 * 用于在创建注解时识别状态，给出 UI 提示或调整锚定策略。
 */
export function isContainerTranslated(container: HTMLElement | null): boolean {
  if (!container) return false;
  // 直接子树含 <font> 包裹 → 已被翻译
  if (container.querySelector("font")) return true;
  // 含翻译扩展特征属性
  for (const attr of TRANSLATION_DATA_ATTRS) {
    if (container.querySelector(`[${attr}]`)) return true;
  }
  return false;
}

/**
 * 轻量级 debounce，前沿不立即执行，等待 wait ms 静默后触发。
 * 用于 MutationObserver 的洪水抑制：浏览器翻译可能在几十毫秒内
 * 产生数百次 mutation，逐个触发 applyHighlights 会卡顿。
 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  wait: number,
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  }) as T & { cancel: () => void };
  wrapped.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return wrapped;
}
