"use client";

import {
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { ImageLightbox } from "./ImageLightbox";

interface ZoomableImageProps {
  src?: string;
  alt?: string;
  title?: string;
  width?: string | number;
  height?: string | number;
  style?: CSSProperties;
}

/**
 * 正文图片包装：单击在整页 Lightbox 中最大化查看。
 *
 * 由 MarkdownRenderer 的 components.img 指向 —— 服务端组件引用 client 组件，
 * 与 CodeBlock / MermaidDiagram 同构（Server→Client 边界合规）。不接收 react-markdown
 * 传入的 hast `node`，避免无用节点对象跨 RSC 边界增大 payload。
 *
 * ISSUE-094 R8：透传后端 _image_to_markdown 输出的 width / height / style，
 * 大图（width ≥ 400px，PDF figure region 渲染产物）使用 width:100% 填满容器，与
 * PDF 原版 figure 占满正文栏全宽的视觉等价；小图（inline icon 等）保持 max-width:100%
 * 不主动撑开。该逻辑自 MarkdownRenderer 迁入，保持单一事实源。
 */
export function ZoomableImage({ src, alt, title, width, height, style }: ZoomableImageProps) {
  const [open, setOpen] = useState(false);

  const pxWidth = width ? parseInt(String(width), 10) : 0;
  const isLargeFigure = pxWidth >= 400;
  const mergedStyle: CSSProperties = {
    ...(style && typeof style === "object" ? style : {}),
    ...(isLargeFigure ? { width: "100%", maxWidth: "100%", height: "auto" } : {}),
    borderRadius: "var(--wiki-radius)",
    cursor: "zoom-in",
  };

  // 空 src 降级：渲染裸 img，不绑点击、不进 Lightbox
  if (!src) {
    return <img alt={alt ?? ""} style={mergedStyle} />;
  }

  // 图片可能被 <a> 包裹（markdown `[![](x)](y)`），preventDefault 阻止默认导航转而打开预览
  const handleClick = (e: ReactMouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    setOpen(true);
  };

  // 键盘可达：Enter / Space 触发预览
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLImageElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <>
      <img
        src={src}
        alt={alt ?? ""}
        title={title}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        style={mergedStyle}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      />
      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
