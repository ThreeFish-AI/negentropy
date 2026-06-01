"use client";

import React from "react";
import { useState, useCallback, useRef } from "react";

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
  /** 纯文本内容，供「复制」按钮使用；若未提供则从 DOM 提取 */
  codeText?: string;
}

export function CodeBlock({ children, className, codeText }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const preRef = useRef<HTMLPreElement>(null);

  const language = className?.replace("language-", "") ?? "";

  const handleCopy = useCallback(() => {
    const text = codeText ?? preRef.current?.textContent ?? "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [codeText]);

  return (
    <div className="wiki-code-block" style={{ position: "relative" }}>
      {language && <span className="wiki-code-lang">{language}</span>}
      <button
        className="wiki-code-copy"
        onClick={handleCopy}
        aria-label="复制代码"
        type="button"
      >
        {copied ? "已复制" : "复制"}
      </button>
      <pre ref={preRef}>
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}
