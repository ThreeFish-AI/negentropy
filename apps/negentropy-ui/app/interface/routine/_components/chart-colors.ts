import type { Verdict } from "@/features/routine";

/** verdict → 图表 SVG 填充 hex（与 [[status-style]] 的 verdictClass 同语义）。 */
export const VERDICT_HEX: Record<Verdict, string> = {
  pass: "#10b981", // emerald
  progressing: "#0ea5e9", // sky
  stalled: "#f59e0b", // amber
  regressed: "#f97316", // orange
  unrecoverable: "#ef4444", // red
};

/** 未评估 / 未知 verdict 的中性色。 */
export const NULL_HEX = "#94a3b8"; // slate
