/**
 * Mention 解析层入口（占位）。
 *
 * PR-2 将迁入：
 *   - mention-types.ts   ← apps/negentropy-ui/types/mention.ts
 *   - mention-parser.ts  ← apps/negentropy-ui/utils/mention-parser.ts (234 LoC)
 *
 * 纯函数 + 零外部依赖，wiki 端复用价值最高（沿用 ui 的 @ 触发判定规则，
 * 保持双端 mention 行为完全一致）。
 */
export {};
