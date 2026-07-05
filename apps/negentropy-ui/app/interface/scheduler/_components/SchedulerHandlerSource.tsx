"use client";

import { useCallback, useState } from "react";

import { fetchHandlerSource, type HandlerSourceResponse } from "@/features/scheduler";

/**
 * 任务详情抽屉「实现逻辑」区。
 *
 * 默认折叠，首次展开才向 ``GET /api/scheduler/handlers/{handler_kind}/source``
 * 拉取该 handler 的整模块源码 + docstring + descriptor 描述——避免每次开抽屉都发请求。
 * 展示「解释」（描述 + docstring）与「源码」（带复制按钮的代码块）。
 */

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy handler source", err);
      }
    },
    [code],
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="复制源码"
      className="absolute top-2 right-2 rounded-md bg-card/80 px-2 py-1 text-micro font-medium text-muted-foreground opacity-70 transition-colors hover:bg-muted/60 hover:text-foreground group-hover:opacity-100"
    >
      {copied ? "已复制" : "复制"}
    </button>
  );
}

export function SchedulerHandlerSource({ handlerKind }: { handlerKind: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HandlerSourceResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchHandlerSource(handlerKind));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [handlerKind]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next && !data && !loading) void load();
      return next;
    });
  }, [data, loading, load]);

  // 解释：优先入口函数 docstring，回退模块 docstring
  const explanation = data ? data.function_docstring ?? data.module_docstring : null;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* 折叠开关 */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-xs text-foreground transition-colors hover:bg-muted/40"
      >
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium">查看 Handler 源码与解释</span>
        <code className="text-micro text-muted-foreground">{handlerKind}</code>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          {loading && <p className="text-xs text-muted-foreground">加载中…</p>}

          {error && !loading && (
            <div className="space-y-2">
              <p className="text-xs text-red-600 dark:text-red-400 break-all">源码加载失败：{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                重试
              </button>
            </div>
          )}

          {data && !loading && !error && (
            <>
              {/* 元信息 */}
              <div className="space-y-0.5 text-micro text-muted-foreground">
                <div className="font-medium text-foreground">{data.label}</div>
                {data.file_path && (
                  <div className="break-all font-mono">
                    {data.file_path}
                    {data.function_lineno ? `:${data.function_lineno}` : ""}
                  </div>
                )}
              </div>

              {/* 解释：描述 + docstring */}
              {(data.description || explanation) && (
                <div className="space-y-2 rounded-md bg-muted/40 p-3">
                  {data.description && (
                    <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words">
                      {data.description}
                    </p>
                  )}
                  {explanation && (
                    <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                      {explanation}
                    </p>
                  )}
                </div>
              )}

              {/* 源码 */}
              {data.module_source ? (
                <div className="group relative">
                  <CopyButton code={data.module_source} />
                  <pre className="max-h-[480px] overflow-auto rounded-md bg-muted/40 p-3 text-xs leading-relaxed">
                    <code className="font-mono text-foreground whitespace-pre">{data.module_source}</code>
                  </pre>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">源码不可读取。</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
