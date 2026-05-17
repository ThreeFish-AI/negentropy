/**
 * NDJSON 流式客户端桶导出。
 *
 * NdjsonHttpAgent 继承自 `@ag-ui/client` 的 AbstractAgent，封装：
 *   - 通过 AbortController 暴露中止能力
 *   - cursor + resumeToken 三段重连（RESUME_DELAYS_MS = [500, 1500, 3500] ms）
 *   - transport_error 帧 → 终止 RUN_ERROR 事件转译
 *   - safeParseBaseEvent 校验后转发到 RxJS Observable
 */
export * from "./ndjson-agent";
