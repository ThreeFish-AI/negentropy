"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** 模块级预创建 motion 元素，避免渲染期间调用 motion.create() 创建新组件。 */
const motionElements = {
  div: motion.div,
  section: motion.section,
  span: motion.span,
} as const;

type ElementType = "div" | "section" | "span";

/**
 * 视口入场淡入包装器（参考 ReactBits FadeContent / AnimatedContent）。
 *
 * 子元素进入视口时执行 opacity + translateY 淡入动画，仅触发一次。
 * 尊重 prefers-reduced-motion：降级为直接渲染子元素。
 *
 * ⚠ 严禁用于高频渲染区域（如 ChatStream 消息流）。
 */
export function FadeIn({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  /** 交错延迟（ms），默认 0。 */
  delay?: number;
  className?: string;
  /** 容器元素，默认 div。 */
  as?: ElementType;
}) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  const Tag = motionElements[as];

  return (
    <Tag
      className={cn(className)}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.3,
        delay: delay / 1000,
        ease: [0.16, 1, 0.3, 1], // expo-out
      }}
    >
      {children}
    </Tag>
  );
}
