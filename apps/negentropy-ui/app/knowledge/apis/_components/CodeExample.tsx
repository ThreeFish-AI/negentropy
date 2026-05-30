"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type Language = "curl" | "python" | "javascript";

interface CodeExampleProps {
  examples: {
    curl: string;
    python: string;
    javascript: string;
  };
}

const LANGUAGE_LABELS: Record<Language, string> = {
  curl: "cURL",
  python: "Python",
  javascript: "JavaScript",
};

export function CodeExample({ examples }: CodeExampleProps) {
  const [language, setLanguage] = useState<Language>("curl");
  const [copied, setCopied] = useState(false);

  const code = examples[language];

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-full bg-muted p-1">
          {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                language === lang
                  ? "bg-card text-foreground shadow-sm"
                  : "text-text-secondary hover:text-foreground"
              }`}
            >
              {LANGUAGE_LABELS[lang]}
            </button>
          ))}
        </div>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-muted hover:text-foreground transition-colors"
          title="复制代码"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-500">已复制</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-border bg-zinc-900 dark:bg-zinc-950">
        <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
          <code className="text-zinc-100">{code}</code>
        </pre>
      </div>
    </div>
  );
}
