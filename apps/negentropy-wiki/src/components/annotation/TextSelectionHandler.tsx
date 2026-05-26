"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useWikiAuth } from "@/lib/auth/wiki-auth";
import { computeAnchor, type TextAnchor } from "@/lib/annotation/use-text-anchor";

interface Props {
  containerSelector: string;
  onAnnotate: (anchor: TextAnchor, quotedText: string, rect: DOMRect) => void;
}

export function TextSelectionHandler({ containerSelector, onAnnotate }: Props) {
  const { status } = useWikiAuth();
  const [fabPosition, setFabPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentAnchor, setCurrentAnchor] = useState<TextAnchor | null>(null);
  const [currentQuote, setCurrentQuote] = useState("");
  const currentRectRef = useRef<DOMRect | null>(null);

  const isAuthenticated = status === "authenticated";

  const handleSelectionChange = useCallback(() => {
    if (!isAuthenticated) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      setFabPosition(null);
      setCurrentAnchor(null);
      setCurrentQuote("");
      return;
    }

    const range = selection.getRangeAt(0);
    const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as HTMLElement)
      : range.startContainer.parentElement;
    const container = startElement?.closest?.(containerSelector) as HTMLElement | null;
    if (!container || !container.contains(range.endContainer)) {
      setFabPosition(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 2) {
      setFabPosition(null);
      return;
    }

    const anchor = computeAnchor(selection, container);
    if (!anchor) return;

    const rect = range.getBoundingClientRect();
    currentRectRef.current = rect;
    setCurrentAnchor(anchor);
    setCurrentQuote(text);

    // 定位 FAB 在选区上方居中
    const x = rect.left + rect.width / 2;
    const y = rect.top - 8;
    setFabPosition({ x, y });
  }, [containerSelector, isAuthenticated]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [handleSelectionChange]);

  const handleClick = useCallback(() => {
    if (currentAnchor && currentRectRef.current) {
      onAnnotate(currentAnchor, currentQuote, currentRectRef.current);
      window.getSelection()?.removeAllRanges();
      setFabPosition(null);
    }
  }, [currentAnchor, currentQuote, onAnnotate]);

  if (!fabPosition || !isAuthenticated) return null;

  return (
    <button
      type="button"
      className="wiki-annotation-fab"
      style={{
        left: `${fabPosition.x}px`,
        top: `${fabPosition.y}px`,
      }}
      onClick={handleClick}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 2h12v8H5l-3 3V2z" />
      </svg>
    </button>
  );
}
