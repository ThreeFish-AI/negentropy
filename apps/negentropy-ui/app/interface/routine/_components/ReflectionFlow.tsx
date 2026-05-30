"use client";

import { useMemo } from "react";
import { CornerDownRight } from "lucide-react";

import type { RoutineIterationDTO } from "@/features/routine";

import { verdictClass } from "./status-style";

function head(text: string | null, n = 140): string {
  if (!text) return "";
  const t = text.trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

/**
 * Reflexion 记忆流 —— 把「迭代 N 的 reflection 注入迭代 N+1 的 prompt」这条反馈边显式化，
 * 是闭环之所以「自迭代」的关键。仅展示最近若干条以保持精炼。
 */
export function ReflectionFlow({ iterations }: { iterations: RoutineIterationDTO[] }) {
  const asc = useMemo(() => [...iterations].sort((a, b) => a.seq - b.seq), [iterations]);
  const items = useMemo(() => {
    const out: { it: RoutineIterationDTO; next: RoutineIterationDTO | undefined }[] = [];
    for (let i = 0; i < asc.length; i++) {
      if (asc[i].reflection) out.push({ it: asc[i], next: asc[i + 1] });
    }
    return out.slice(-6);
  }, [asc]);

  if (items.length === 0) {
    return (
      <section className="rounded-card border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          反思记忆流 · Reflexion
        </h3>
        <p className="py-4 text-center text-[11px] text-text-muted">暂无反思记录</p>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        反思记忆流 · Reflexion（reflection → 下轮 prompt）
      </h3>
      <ol className="space-y-3">
        {items.map(({ it, next }) => (
          <li key={it.id} className="rounded-lg border border-border p-2.5">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-semibold text-foreground">#{it.seq}</span>
              {it.verdict && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${verdictClass(it.verdict)}`}>
                  {it.verdict}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] italic text-text-secondary">💡 {it.reflection}</p>
            {next?.prompt && (
              <div className="mt-2 flex items-start gap-1.5 rounded bg-muted/40 p-2 text-[10px] text-text-muted">
                <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">
                  注入 <span className="font-medium text-text-secondary">#{next.seq}</span> 提示：{head(next.prompt)}
                </span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
