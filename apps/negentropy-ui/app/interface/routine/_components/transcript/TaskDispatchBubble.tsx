"use client";

import { ArrowRight } from "lucide-react";

import { MarkdownText } from "../MarkdownText";
import { RoleHeader } from "./message-shared";

/**
 * 开场「人（一核 Engine）→ 机（Claude Code）」任务下发回合。
 *
 * 任务由 Negentropy Engine（一核，人）发起，故「人」先发言——此气泡即对话的第一句：
 * 把 ``iteration.prompt``（目标 / 验收 / 反思 / 记忆注入）作为人下发给 CC 的任务，
 * 仿 Conductor ``UserMessage``（背景高亮、整段任务文本），并标一核角色 + 「→ Claude Code」方向。
 * 由 ``TranscriptView`` 据 ``openingPrompt`` 合成前置，非事件流原始项。
 */
export function TaskDispatchBubble({ prompt }: { prompt: string }) {
  return (
    <div className="min-w-0 max-w-[92%] rounded-2xl rounded-tr-sm border border-primary/20 bg-primary/[0.06] px-4 py-3">
      <RoleHeader role="engine" sublabel="下发任务 · Dispatch">
        <span className="inline-flex items-center gap-1 text-caption font-medium text-primary">
          <ArrowRight className="h-3 w-3" aria-hidden />
          Claude Code
        </span>
      </RoleHeader>
      <MarkdownText content={prompt} />
    </div>
  );
}
