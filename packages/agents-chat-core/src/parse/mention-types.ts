/**
 * Home Composer @ Mention 类型定义。
 *
 * 两类 mention 共用同一数据结构，仅以 ``kind`` 字段区分：
 *
 * - ``agent`` —— 用户偏好委派的 SubAgent，refId = ``sub_agents.name``；
 * - ``corpus`` —— 用户选定的 Corpus，refId = Corpus.id (UUID)。
 *   语义上表达「想用哪个 Corpus」而非「以什么方式使用」；后端在 turn 内
 *   依据 prompt 与上下文自主判断（默认仅作为 KB+KG hybrid 的 retrieve 范围，
 *   Ingest 走独立入口或后续 IntentClassifier）。
 *
 * `inputValue` 仍是 textarea 的唯一事实源（模型会读到 `@xxx` 自然文本），
 * `MentionToken[]` 仅承担：① UI 高亮（mirror overlay）② forwardedProps 派生。
 */
export type MentionKind = "agent" | "corpus";

export interface MentionToken {
  /** 前端 UUID，仅用于 React key。 */
  id: string;
  /** 两类 mention 之一。 */
  kind: MentionKind;
  /** Agent 时为 ``sub_agents.name``；Corpus 时为 UUID。 */
  refId: string;
  /** 显示标签（用于弹层与高亮 chip），来自 display_name || name 或 corpus.name。 */
  label: string;
  /** 实际插入 textarea 的文本片段，形如 ``"@PerceptionFaculty "`` 或 ``"@kb:Corpus-A "``。 */
  rawText: string;
  /** rawText 在 inputValue 中的起始 offset（含 ``@``）。 */
  start: number;
  /** rawText 在 inputValue 中的结束 offset（不含尾空格之后）。 */
  end: number;
}

/** 候选项（弹层条目）—— Agent 与 Corpus 通用结构。 */
export interface MentionCandidate {
  /** Agent 时为 ``sub_agents.name``；Corpus 时为 UUID。 */
  refId: string;
  /** 显示标签。 */
  label: string;
  /** 副标 / 描述（可选）。 */
  description?: string;
  /** 两类之一（区分弹层 Tab）。 */
  kind: MentionKind;
}
