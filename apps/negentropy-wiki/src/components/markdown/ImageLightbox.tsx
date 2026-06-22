"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

/**
 * 图片全页最大化遮罩（Lightbox）。
 *
 * 交互范式参照 WikiSearchModal：createPortal 挂到 document.body，Esc / 点遮罩空白 /
 * 点图片本身 / 点关闭按钮均可关闭；打开时锁 body 滚动并把焦点收入遮罩，关闭后还原
 * 触发元素焦点。
 *
 * SSG 安全：next.config `output:"export"` 下，本组件仅在父组件 open=true 时挂载，
 * 构建期与 hydrate 期 open 均为 false 故不执行 createPortal —— 与 WikiSearchModal 同构。
 */
export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // 打开时聚焦遮罩（Esc 即时生效），关闭时把焦点归还触发元素
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => rootRef.current?.focus());
    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  // Body 滚动锁
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Escape 关闭
  useEffect(() => {
    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return createPortal(
    <div
      ref={rootRef}
      className="wiki-lightbox-root"
      role="dialog"
      aria-modal="true"
      aria-label={alt || "图片预览"}
      tabIndex={-1}
      onClick={(e) => {
        // 仅点遮罩空白处关闭；点图片 / 关闭按钮由各自 handler 处理，不会命中此条件。
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <img
        src={src}
        alt={alt ?? ""}
        className="wiki-lightbox-image"
        decoding="async"
        onClick={onClose}
      />
      <button
        type="button"
        className="wiki-lightbox-close"
        onClick={onClose}
        aria-label="关闭图片预览"
      >
        ✕
      </button>
    </div>,
    document.body,
  );
}
