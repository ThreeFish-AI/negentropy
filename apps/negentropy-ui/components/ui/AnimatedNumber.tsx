"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * 数值递增动画（参考 ReactBits CountUp）。
 *
 * 数值从 0 动画到目标值，duration 400-600ms，仅数字类型触发。
 * 尊重 prefers-reduced-motion：降级为直接显示目标值。
 * 使用 requestAnimationFrame 实现，避免 layout thrash。
 */
export function AnimatedNumber({
  value,
  duration = 500,
  className,
}: {
  value: number;
  /** 动画时长（ms），默认 500。 */
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const prefersReduced = useReducedMotion();
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    const from = 0;
    const to = value;

    if (from === to) {
      setDisplay(to);
      return;
    }

    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    startRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, prefersReduced]);

  return (
    <span className={className}>
      {display.toLocaleString()}
    </span>
  );
}
