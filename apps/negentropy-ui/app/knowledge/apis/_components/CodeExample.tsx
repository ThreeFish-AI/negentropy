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
        <div className="flex items-center gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-800">
          {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                language === lang
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {LANGUAGE_LABELS[lang]}
            </button>
          ))}
        </div>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
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
      <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-900 dark:border-zinc-700 dark:bg-zinc-950">
        <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
          <code className="text-zinc-100">{code}</code>
        </pre>
      </div>
    </div>
  );
}
