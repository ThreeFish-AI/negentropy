"use client";

import type { HTMLAttributes, ReactNode } from "react";
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
  contentProps?: HTMLAttributes<HTMLDivElement>;
  backdropTestId?: string;
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
  children,
}: OverlayDismissLayerProps) {
  if (!open) return null;

  const { className: contentPropsClassName, onClick, ...restContentProps } =
    contentProps ?? {};

  const handleBackdropClick = () => {
    if (!dismissible || busy) return;
    onClose();
  };

  const handleContentClick: NonNullable<HTMLAttributes<HTMLDivElement>["onClick"]> = (
    event,
  ) => {
    event.stopPropagation();
    onClick?.(event);
  };

  return (
    <div className={cn("fixed inset-0 z-50", wrapperClassName)}>
      <div
        data-testid={backdropTestId ?? "overlay-backdrop"}
        className={cn("absolute inset-0 bg-black/50 backdrop-blur-sm", backdropClassName)}
        onClick={handleBackdropClick}
      />
      <div className={cn("relative", containerClassName)}>
        <div
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
