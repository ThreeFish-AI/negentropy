"use client";

import { useRef } from "react";
import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OverlayDismissLayerProps {
  open: boolean;
  onClose: () => void;
  dismissible?: boolean;
  busy?: boolean;
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
  wrapperClassName,
  backdropClassName,
  containerClassName,
  contentClassName,
  contentProps,
  backdropTestId,
  contentTestId,
  children,
}: OverlayDismissLayerProps) {
  if (!open) return null;

  const contentRef = useRef<HTMLDivElement | null>(null);
  const { className: contentPropsClassName, onClick, ...restContentProps } =
    contentProps ?? {};

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
      <div className={cn("relative", containerClassName)}>
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
