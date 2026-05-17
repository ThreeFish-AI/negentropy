"use client";

import { useState, useCallback, useRef } from "react";

interface CodeBlockProps {
  children: string;
  className?: string;
}

export function CodeBlock({ children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const language = className?.replace("language-", "") ?? "";

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [children]);

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
      <pre>
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}
