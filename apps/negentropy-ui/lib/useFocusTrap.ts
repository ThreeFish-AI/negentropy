import { type RefObject, useEffect } from "react";

/**
 * 模态焦点陷阱 + 焦点回归（无障碍 / Reuse-Driven）。
 *
 * 收敛 BaseModal、BaseDrawer 等浮层的焦点管理：开启时聚焦容器内首个可聚焦元素，
 * Tab / Shift+Tab 在容器内环回，关闭时把焦点还给触发元素。符合 WCAG 键盘可达性
 * 与 Apple HIG 焦点管理准则，规避「焦点逃逸到背景」的同型缺陷。
 *
 * @param ref    浮层容器引用（其自身应设 tabIndex={-1} 以便兜底聚焦）。
 * @param active 是否启用（通常等于浮层 open 状态）。
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // 若焦点尚未落入容器（例如业务已用 autoFocus 指定初始焦点），才主动聚焦首个可聚焦元素。
    if (!node || !node.contains(document.activeElement)) {
      const first = focusables()[0];
      (first ?? node)?.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !node) return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const head = items[0];
      const tail = items[items.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey) {
        if (activeEl === head || !node.contains(activeEl)) {
          e.preventDefault();
          tail.focus();
        }
      } else if (activeEl === tail || !node.contains(activeEl)) {
        e.preventDefault();
        head.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [active, ref]);
}
