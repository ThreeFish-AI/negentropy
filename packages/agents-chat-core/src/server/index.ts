/**
 * BFF 服务端工具桶导出。
 *
 * 由 ui 与 wiki 两端的 /api/agui Route Handler 共用：
 *   - UUID_RE / PREFERRED_AGENT_MAX_LEN / CORPUS_IDS_MAX_LEN 常量
 *   - buildStateDeltaFromForwardedProps 派生函数（含显式清空语义）
 */
export * from "./state-delta";
