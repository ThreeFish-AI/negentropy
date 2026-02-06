/**
 * HITL 确认工具 Hook
 *
 * 从 app/page.tsx 提取，遵循 AGENTS.md 原则：模块化、复用驱动
 */

import { useHumanInTheLoop } from "@copilotkitnext/react";
import { z } from "zod";
import { ConfirmationToolCard } from "@/components/ui/ConfirmationToolCard";
import type { ConfirmationToolArgs } from "@/components/ui/ConfirmationToolCard";

// 重新导出类型，方便其他文件使用
export type { ConfirmationToolArgs };

/**
 * HITL 确认工具 Hook
 *
 * 用于前端确认/修正/补充的人工确认流程
 *
 * @param onFollowup - 确认后的回调函数
 */
export function useConfirmationTool(
  onFollowup?: (payload: { action: string; note: string }) => void,
) {
  useHumanInTheLoop<ConfirmationToolArgs>(
    {
      name: "ui.confirmation",
      description: "用于前端确认/修正/补充的人工确认流程",
      parameters: z.object({
        title: z.string().optional(),
        detail: z.string().optional(),
        payload: z.record(z.any()).optional(),
      }),
      render: ({ status, args, respond, result }) => (
        <ConfirmationToolCard
          status={status}
          args={args as ConfirmationToolArgs}
          respond={respond}
          result={result}
          onFollowup={onFollowup}
        />
      ),
    },
    [onFollowup],
  );
}
