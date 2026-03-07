"use client";

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
