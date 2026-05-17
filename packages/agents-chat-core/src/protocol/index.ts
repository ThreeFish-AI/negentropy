/**
 * AGUI 协议层桶导出。
 *
 * - agui-types：AG-UI 扩展事件类型、消息扩展字段、访问器、类型守卫
 * - schema：基于 zod 的 AGUI 事件运行时校验
 * - stream：NDJSON / SSE 帧定义、cursor 与帧构造工具、流解析器
 *
 * 双端共享，避免协议 split-brain。详见 README。
 */
export * from "./agui-types";
export * from "./schema";
export * from "./stream";
