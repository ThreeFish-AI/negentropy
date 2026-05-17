/**
 * Mention 解析层桶导出。
 *
 * - mention-types：MentionKind / MentionToken / MentionCandidate 类型契约
 * - mention-parser：detectMentionTrigger / applyMention / reconcileMentions /
 *   deriveForwardedPropsFromMentions 纯函数（零外部依赖）
 *
 * 双端共享 @ 触发规则与 forwardedProps 派生逻辑，保证 ui 与 wiki 行为一致。
 */
export * from "./mention-types";
export * from "./mention-parser";
