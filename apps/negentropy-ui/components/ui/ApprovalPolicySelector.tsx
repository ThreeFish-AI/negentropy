"use client";

/**
 * ApprovalPolicySelector · P3-2 RFC 0002 §4.4 中断/审批门
 *
 * 让用户在 Home 顶部 dropdown 切换会话级审批策略：
 *   - always   : 任何工具调用都弹审批
 *   - per_tool : 仅高风险工具（默认）
 *   - never    : 关闭审批门（CI / 信任环境）
 *
 * 持久化到 localStorage（key: `home.approval_policy`），跨刷新保留。前端通过
 * forwardedProps 把 policy 透传给 agent.runAgent，后端 ``approval.should_request_approval``
 * 决定是否拦截工具调用。
 *
 * 设计动机：参见 docs/architecture/conversation-foundation.md §6 HITL & Guardrails；与 ChatGPT
 * Codex 的 ApprovalPolicy 行为对齐。
 */

import { useCallback, useSyncExternalStore } from "react";

export type ApprovalPolicyMode = "always" | "per_tool" | "never";

const STORAGE_KEY = "home.approval_policy";
const VALID_MODES: ApprovalPolicyMode[] = ["always", "per_tool", "never"];
export const DEFAULT_APPROVAL_POLICY: ApprovalPolicyMode = "per_tool";

const LABEL: Record<ApprovalPolicyMode, string> = {
  always: "全部审批",
  per_tool: "仅高风险",
  never: "关闭审批",
};

const HINT: Record<ApprovalPolicyMode, string> = {
  always: "任何工具调用前都先弹审批 modal。最严格，适合调试或敏感会话。",
  per_tool: "仅 update_knowledge_graph / write_file / send_email 等高风险工具弹审批。",
  never: "关闭审批门。仅在 CI / 受信任沙箱启用。",
};

function readPersisted(): ApprovalPolicyMode {
  if (typeof window === "undefined") return DEFAULT_APPROVAL_POLICY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (VALID_MODES as string[]).includes(raw)) {
      return raw as ApprovalPolicyMode;
    }
  } catch {
    /* fail-soft */
  }
  return DEFAULT_APPROVAL_POLICY;
}

function writePersisted(mode: ApprovalPolicyMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {
    /* fail-soft */
  }
}

function subscribeStorage(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/** Hook：订阅 localStorage 中的 approval policy（与 ApprovalPolicySelector 共享存储）。 */
export function useApprovalPolicy(): {
  mode: ApprovalPolicyMode;
  setMode: (next: ApprovalPolicyMode) => void;
} {
  const mode = useSyncExternalStore(
    subscribeStorage,
    readPersisted,
    () => DEFAULT_APPROVAL_POLICY,
  );
  const setMode = useCallback((next: ApprovalPolicyMode) => writePersisted(next), []);
  return { mode, setMode };
}

export function ApprovalPolicySelector({ className }: { className?: string }) {
  const { mode, setMode } = useApprovalPolicy();
  return (
    <label
      className={className ?? "inline-flex items-center gap-1.5 text-xs text-muted-foreground"}
      data-testid="approval-policy-selector"
      data-policy={mode}
      title={HINT[mode]}
    >
      <span className="font-medium">审批策略：</span>
      <select
        className="h-7 cursor-pointer rounded-md border border-border bg-background px-2 text-xs text-text-secondary transition-colors hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={mode}
        onChange={(e) => setMode(e.target.value as ApprovalPolicyMode)}
        aria-label="审批策略"
      >
        {VALID_MODES.map((m) => (
          <option key={m} value={m}>
            {LABEL[m]}
          </option>
        ))}
      </select>
    </label>
  );
}
