/**
 * ConfirmationToolCard 组件
 *
 * HITL (Human-in-the-Loop) 确认卡片组件
 * 用于前端确认/修正/补充的人工确认流程
 *
 * 从 app/page.tsx 提取，遵循 AGENTS.md 原则：模块化、复用驱动
 */

"use client";

import { useState } from "react";

/**
 * 确认工具参数类型
 */
export type ConfirmationToolArgs = {
  title?: string;
  detail?: string;
  payload?: Record<string, unknown>;
};

/**
 * 确认卡片状态
 */
export type ConfirmationStatus = "inProgress" | "executing" | "complete";

/**
 * ConfirmationToolCard 组件属性
 */
export interface ConfirmationToolCardProps {
  /** 确认状态 */
  status: ConfirmationStatus;
  /** 确认参数 */
  args: ConfirmationToolArgs;
  /** 响应回调 */
  respond?: (result: unknown) => Promise<void>;
  /** 响应结果 */
  result?: string;
  /** 后续操作回调 */
  onFollowup?: (payload: { action: string; note: string }) => void;
}

/**
 * ConfirmationToolCard 组件
 *
 * 用于展示 HITL 确认流程的卡片
 * 提供确认、修正、补充三种操作方式
 */
export function ConfirmationToolCard({
  status,
  args,
  respond,
  result,
  onFollowup,
}: ConfirmationToolCardProps) {
  const [note, setNote] = useState("");
  const payloadText = JSON.stringify(args?.payload ?? {}, null, 2);

  // 已完成状态
  if (status === "complete") {
    return (
      <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-xs text-success-foreground">
        <p className="font-semibold">已反馈</p>
        <p className="mt-1 break-words">{result}</p>
      </div>
    );
  }

  // 确认中状态
  return (
    <div className="rounded-xl border border-warning/20 bg-warning/10 p-4 text-xs text-warning-foreground">
      <p className="text-sm font-semibold">需要确认</p>
      {args?.title ? <p className="mt-1 text-xs">{args.title}</p> : null}
      {args?.detail ? <p className="mt-1 text-xs">{args.detail}</p> : null}
      {payloadText !== "{}" ? (
        <pre className="mt-2 max-h-24 overflow-auto rounded bg-card/80 p-2 text-[10px]">
          {payloadText}
        </pre>
      ) : null}
      <textarea
        className="mt-2 w-full rounded border border-input-border bg-input p-2 text-[11px] text-foreground placeholder:text-muted-foreground"
        rows={2}
        placeholder="补充说明（可选）"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          className="rounded-full bg-success px-3 py-1 text-[11px] text-success-foreground hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={async () => {
            if (!respond) return;
            await respond({ action: "confirm", note });
            onFollowup?.({ action: "confirm", note });
          }}
        >
          确认
        </button>
        <button
          className="rounded-full bg-secondary px-3 py-1 text-[11px] text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={async () => {
            if (!respond) return;
            await respond({ action: "correct", note });
            onFollowup?.({ action: "correct", note });
          }}
        >
          修正
        </button>
        <button
          className="rounded-full bg-primary px-3 py-1 text-[11px] text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={async () => {
            if (!respond) return;
            await respond({ action: "supplement", note });
            onFollowup?.({ action: "supplement", note });
          }}
        >
          补充
        </button>
      </div>
    </div>
  );
}

/**
 * 默认导出
 */
export default ConfirmationToolCard;
