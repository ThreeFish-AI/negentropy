/**
 * AGUI 路由的 forwardedProps → state_delta 派生工具。
 *
 * 拆分动因：Next.js App Router 仅允许 `route.ts` 导出受限的 HTTP/配置符号，
 * 任何额外 `export` 会被生成的路由类型校验拒绝（OmitWithTag 失败）。
 * 因此将共享常量与纯函数下沉到本 `_state-delta.ts`（项目约定的 `_` 前缀私有模块，
 * 与 `app/api/agui/sessions/_request.ts`、`_response.ts` 形成同构），由 `route.ts`
 * 与对应 `tests/unit/api/agui-route-state.test.ts` 直接复用单一事实源。
 */

// 共享 UUID 校验 —— 既给路由 sessionId 用，也给 forwardedProps.{scoped,output}_corpus_ids 用。
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 路由偏好 Agent 名长度上限（与后端 _PREFERENCE_NAME_RE 同步：标识符 1-128 字符）。
export const PREFERRED_SUBAGENT_MAX_LEN = 128;
// Mention 列表上限（每类 @ token 数），避免畸形 forwardedProps 撑大 state。
export const CORPUS_IDS_MAX_LEN = 32;

/**
 * 校验 UUID 数组字段：
 *
 * - 非数组（含 ``undefined`` / ``null`` / 其它原始类型）→ 返回 ``null`` 表示
 *   「字段不存在 / 类型不合法」，调用方据此决定不写 state_delta；
 * - 数组 → 过滤非 UUID 条目、截断到 ``max``、去重保持首现顺序，返回数组
 *   （可能为空）。空数组语义为「显式清空」，调用方需写入 state_delta 以
 *   覆盖 ADK session.state 中可能存在的旧值。
 *
 * 该区分是修复「mention 跨 turn 残留」的关键 —— 前端始终显式写入派生值，
 * BFF 据此触达「清空」状态变更，避免 session.state 被孤儿值长期污染。
 */
function sanitizeUuidList(raw: unknown, max: number): string[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = raw
    .filter((x): x is string => typeof x === "string" && UUID_RE.test(x))
    .slice(0, max);
  // 去重保持首现顺序；Array.from(new Set()) 即满足该语义。
  // 注意：``ids.length === 0`` 时仍返回 ``[]`` 而非 ``null`` —— 调用方据此写入清空。
  return Array.from(new Set(ids));
}

export function buildStateDeltaFromForwardedProps(
  forwardedProps: Record<string, unknown> | null,
): Record<string, unknown> {
  const stateDelta: Record<string, unknown> = {};
  if (!forwardedProps) {
    return stateDelta;
  }
  if ("selected_llm_model" in forwardedProps) {
    const raw = forwardedProps.selected_llm_model;
    if (typeof raw === "string" && raw.length > 0) {
      stateDelta.selected_llm_model = raw;
    } else if (raw === null) {
      stateDelta.selected_llm_model = null;
    }
  }
  if ("thinking_enabled" in forwardedProps) {
    const raw = forwardedProps.thinking_enabled;
    if (typeof raw === "boolean") {
      stateDelta.thinking_enabled = raw;
    }
  }
  // Home Composer 的 @ Agent —— 用户偏好委派到指定 SubAgent（root_agent 软提示）。
  // 合法字符串 → 写入；显式 ``null`` → 写入 ``null`` 以清空 session.state；
  // 其它（空串 / 超长 / 非字符串）→ 不写入。
  // 配合前端始终显式发送 ``preferred_subagent`` 字段实现跨 turn 清空语义。
  if ("preferred_subagent" in forwardedProps) {
    const raw = forwardedProps.preferred_subagent;
    if (
      typeof raw === "string" &&
      raw.length > 0 &&
      raw.length <= PREFERRED_SUBAGENT_MAX_LEN
    ) {
      stateDelta.preferred_subagent = raw;
    } else if (raw === null) {
      stateDelta.preferred_subagent = null;
    }
  }
  // Home Composer 的 @ Corpus（检索）—— 限定本轮 RAG 检索范围；
  // 由 ``perception.search_knowledge_base`` 消费 ``tool_context.state``。
  // 数组（含 ``[]``）→ 写入 state_delta；非数组 → 不写入。空数组表示「显式清空」，
  // 覆盖上一轮可能残留的 ``scoped_corpus_ids``。
  if ("scoped_corpus_ids" in forwardedProps) {
    const scoped = sanitizeUuidList(forwardedProps.scoped_corpus_ids, CORPUS_IDS_MAX_LEN);
    if (scoped !== null) {
      stateDelta.scoped_corpus_ids = scoped;
    }
  }
  // Home Composer 的 @ Corpus（输出）—— 输出沉淀目标 Corpus 列表；
  // 仅 round-trip 留痕，前端在 RUN_FINISHED 后据此调用 ingestText。
  // 空数组同样写入以触发清空语义，避免 session.state 中残留孤儿值。
  if ("output_corpus_ids" in forwardedProps) {
    const output = sanitizeUuidList(forwardedProps.output_corpus_ids, CORPUS_IDS_MAX_LEN);
    if (output !== null) {
      stateDelta.output_corpus_ids = output;
    }
  }
  // Home Composer 的 @graph —— 强制启用图谱/跨 Corpus 桥接/GraphRAG 全局摘要模式。
  // 由 ``perception.search_knowledge_base`` 消费 ``tool_context.state``：
  // 命中非空数组时强制走 HybridPlanner 的 graph expansion 路径，
  // 同时关键词命中「主题/概览/总体/核心」会进一步切换到 search_knowledge_graph_global。
  // 空数组同样写入以触发清空语义。
  if ("graph_mode_corpus_ids" in forwardedProps) {
    const graphIds = sanitizeUuidList(forwardedProps.graph_mode_corpus_ids, CORPUS_IDS_MAX_LEN);
    if (graphIds !== null) {
      stateDelta.graph_mode_corpus_ids = graphIds;
    }
  }
  return stateDelta;
}
