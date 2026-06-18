"use client";

import { type ReactNode, useCallback, useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";

/** 默认弹簧配置（适配文本卡片：低幅度需更快响应）。 */
const DEFAULT_SPRING = { damping: 30, stiffness: 200, mass: 1.5 };

interface TiltedCardProps {
  children: ReactNode;
  className?: string;
  /** 倾斜幅度（度），默认 8（原 reactbits TiltedCard 为 14，文本卡片降低）。 */
  tiltAmplitude?: number;
  /** 悬停缩放倍率，默认 1.03（原 reactbits 为 1.1，网格布局降低）。 */
  scaleOnHover?: number;
  /** 弹簧物理参数。 */
  springConfig?: { damping: number; stiffness: number; mass: number };
  /** 禁用倾斜效果（拖拽场景下使用）。 */
  disabled?: boolean;
}

/**
 * 3D 倾斜卡片包装器（参考 ReactBits TiltedCard，适配文本内容卡片）。
 *
 * 子元素跟随鼠标产生 3D 透视倾斜 + 缩放 + 动态阴影，全部基于弹簧物理。
 * 尊重 prefers-reduced-motion：降级为直接渲染子元素。
 *
 * @see https://reactbits.dev/components/tilted-card
 */
export function TiltedCard({
  children,
  className,
  tiltAmplitude = 8,
  scaleOnHover = 1.03,
  springConfig = DEFAULT_SPRING,
  disabled = false,
}: TiltedCardProps) {
  const prefersReduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  /* ---- Motion Values（一次性创建，.set() 更新零重渲染） ---- */

  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const rawScale = useMotionValue(1);
  const rawShadowProgress = useMotionValue(0);

  const rotateX = useSpring(rawRotateX, springConfig);
  const rotateY = useSpring(rawRotateY, springConfig);
  const smoothScale = useSpring(rawScale, springConfig);
  const smoothShadow = useSpring(rawShadowProgress, springConfig);

  /* ---- 动态阴影：0→1 映射为低→高阴影 ---- */

  const boxShadow = useTransform(smoothShadow, [0, 1], [
    "0 1px 2px rgba(0,0,0,0.04)",
    "0 10px 28px -4px rgba(0,0,0,0.12), 0 4px 10px -2px rgba(0,0,0,0.06)",
  ]);

  /* ---- 鼠标事件（useCallback 防重建） ---- */

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left - rect.width / 2;
      const offsetY = e.clientY - rect.top - rect.height / 2;
      const halfW = rect.width / 2;
      const halfH = rect.height / 2;

      // 归一化 [-1, 1] × 幅度 → rotateX/Y
      rawRotateY.set((offsetX / halfW) * tiltAmplitude);
      rawRotateX.set((-offsetY / halfH) * tiltAmplitude);

      // 阴影进度 = 光标到中心的归一化距离
      const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
      const maxDist = Math.sqrt(halfW * halfW + halfH * halfH);
      rawShadowProgress.set(Math.min(distance / maxDist, 1));
    },
    [rawRotateX, rawRotateY, rawShadowProgress, tiltAmplitude],
  );

  const handleMouseEnter = useCallback(() => {
    rawScale.set(scaleOnHover);
  }, [rawScale, scaleOnHover]);

  const handleMouseLeave = useCallback(() => {
    rawRotateX.set(0);
    rawRotateY.set(0);
    rawScale.set(1);
    rawShadowProgress.set(0);
  }, [rawRotateX, rawRotateY, rawScale, rawShadowProgress]);

  /* ---- prefers-reduced-motion / disabled 降级 ---- */

  if (prefersReduced || disabled) {
    return <div className={className}>{children}</div>;
  }

  /* ---- 渲染：外层 perspective 容器 + 内层 motion.div 承载 transform ---- */

  return (
    <div
      ref={containerRef}
      className={cn("h-full", className)}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: 800 }}
    >
      <motion.div
        className="h-full"
        style={{
          rotateX,
          rotateY,
          scale: smoothScale,
          boxShadow,
          willChange: "transform, box-shadow",
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
