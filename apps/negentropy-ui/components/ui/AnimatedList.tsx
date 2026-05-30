"use client";

import { type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * 交错入场列表容器（参考 ReactBits AnimatedList）。
 *
 * 列表项交错淡入：每项延迟 staggerMs ms，duration 200ms。
 * 使用 AnimatePresence 处理项目新增/移除。
 * 尊重 prefers-reduced-motion：降级为直接渲染。
 */
export function AnimatedList({
  children,
  staggerMs = 50,
  className,
}: {
  children: ReactNode[];
  /** 交错延迟（ms），默认 50。 */
  staggerMs?: number;
  className?: string;
}) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence initial={false}>
      <motion.div
        className={className}
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: {
              staggerChildren: staggerMs / 1000,
            },
          },
        }}
      >
        {children.map((child, i) => (
          <motion.div
            key={i}
            variants={{
              hidden: { opacity: 0, y: 6 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
              },
            }}
          >
            {child}
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
