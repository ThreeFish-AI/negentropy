"use client";

import { useEffect, useRef } from "react";
import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Only the topmost mounted layer should respond to Escape: prevents nested
// dialogs from closing the outer form (and losing unsaved input) on a single
// press, and prevents stale external `keydown` listeners on `window` from
// double-firing onClose.
const escapeStack: symbol[] = [];

interface OverlayDismissLayerProps {
  open: boolean;
  onClose: () => void;
  dismissible?: boolean;
  busy?: boolean;
  closeOnEscape?: boolean;
  wrapperClassName?: string;
  backdropClassName?: string;
  containerClassName?: string;
  contentClassName?: string;
  contentProps?: ComponentPropsWithoutRef<"div">;
  backdropTestId?: string;
  contentTestId?: string;
  children: ReactNode;
}

export function OverlayDismissLayer({
  open,
  onClose,
  dismissible = true,
  busy = false,
  closeOnEscape = true,
  wrapperClassName,
  backdropClassName,
  containerClassName,
  contentClassName,
  contentProps,
  backdropTestId,
  contentTestId,
  children,
}: OverlayDismissLayerProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const layerIdRef = useRef<symbol | null>(null);
  if (layerIdRef.current === null) {
    layerIdRef.current = Symbol("overlay-dismiss-layer");
  }
  const { className: contentPropsClassName, onClick, ...restContentProps } =
    contentProps ?? {};

  useEffect(() => {
    if (!open || !closeOnEscape || !dismissible || busy) return undefined;
    const id = layerIdRef.current!;
    escapeStack.push(id);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (escapeStack[escapeStack.length - 1] !== id) return;
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const idx = escapeStack.lastIndexOf(id);
      if (idx >= 0) escapeStack.splice(idx, 1);
    };
  }, [open, closeOnEscape, dismissible, busy, onClose]);

  if (!open) return null;

  const handleWrapperClick: NonNullable<HTMLAttributes<HTMLDivElement>["onClick"]> = (
    event,
  ) => {
    if (!dismissible || busy) return;
    if (contentRef.current?.contains(event.target as Node)) return;
    onClose();
  };

  const handleContentClick: NonNullable<HTMLAttributes<HTMLDivElement>["onClick"]> = (
    event,
  ) => {
    onClick?.(event);
  };

  return (
    <div className={cn("fixed inset-0 z-50", wrapperClassName)} onClick={handleWrapperClick}>
      <div
        data-testid={backdropTestId ?? "overlay-backdrop"}
        className={cn("absolute inset-0 bg-black/50 backdrop-blur-sm", backdropClassName)}
      />
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          containerClassName,
        )}
      >
        <div
          ref={contentRef}
          data-testid={contentTestId}
          {...restContentProps}
          className={cn(contentClassName, contentPropsClassName)}
          onClick={handleContentClick}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
