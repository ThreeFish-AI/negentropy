import { useEffect, useRef } from "react";

/**
 * 检测点击发生在目标元素外部的 hook。
 * 返回一个 ref，需绑定到需要检测"点击外部"的目标元素上。
 */
export function useClickOutside<T extends HTMLElement>(
  callback: () => void,
  isActive: boolean = true,
) {
  const ref = useRef<T>(null);
  const cbRef = useRef(callback);

  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isActive) return;
    function handleEvent(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        cbRef.current();
      }
    }
    document.addEventListener("mousedown", handleEvent);
    return () => document.removeEventListener("mousedown", handleEvent);
  }, [isActive]);

  return ref;
}
