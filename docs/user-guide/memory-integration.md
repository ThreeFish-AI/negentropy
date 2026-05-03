# Memory Integration Guide：API + Agent 工具

> 工程师集成手册。前置阅读 [`memory-basics.md`](./memory-basics.md)。

---

## 1. Python SDK 用法

### 1.1 获取 MemoryService 实例

```python
from negentropy.engine.factories.memory import (
    get_memory_service,
    get_core_block_service,
    get_fact_service,
)

# Postgres 后端（生产推荐）
mem = get_memory_service()  # 默认从 settings.memory_service_backend 读取

# 显式指定后端
mem = get_memory_service(backend="postgres")  # or "inmemory" / "vertexai"
```

### 1.2 写入对话记忆（巩固管线）

```python
from google.adk.sessions import Session as ADKSession

session = ADKSession(...)  # ADK 框架提供
await mem.add_session_to_memory(session)
# 经过 4 阶段管线：Segment → Dedup → Store → Extract
# 自动建立 thread_shared / temporal / semantic 关联
```

### 1.3 类型化主动写入（Phase 4 新增）

```python
result = await mem.add_memory_typed(
    user_id="alice",
    app_name="negentropy",
    thread_id="6e7f...uuid",
    content="用户偏好深色主题，VSCode 使用 Dracula 配色",
    memory_type="preference",   # episodic / semantic / preference / procedural / fact / core
    metadata={"source": "explicit_user_input"},
)
print(result)  # {"id": "...", "memory_type": "preference", "retention_score": 0.95, ...}
```

### 1.4 检索

```python
response = await mem.search_memory(
    user_id="alice",
    app_name="negentropy",
    query="用户的技术栈偏好",
    limit=5,
    memory_type="preference",  # 可选过滤
)
for entry in response.memories:
    print(entry.id, entry.relevance_score, entry.custom_metadata.get("search_level"))
# search_level: hybrid / vector / keyword / ilike
# 含 Phase 4 query intent 加权（automatic）
```

---

## 2. <a id="self-edit-tools"></a>Self-editing Tools（REST 端点）

5 个 REST 端点（均位于 `/api/memory/...` 前缀，受 `_require_self_or_admin` 守卫：admin 角色可操作任意 `user_id`，普通用户只能操作自身）：

| 端点 | 用途 |
|---|---|
| `POST /memory/self-edit/write` | 主动写入新记忆 |
| `POST /memory/self-edit/update` | 修订已有记忆（保留 update_history）|
| `POST /memory/self-edit/delete` | 软删除（保留行，可恢复）|
| `POST /memory/core-blocks` | 新增/替换 Core Block |
| `DELETE /memory/core-blocks` | 删除 Core Block |

### Curl 示例：写入

```bash
curl -X POST http://localhost:8000/api/memory/self-edit/write \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "user_id": "alice",
    "app_name": "negentropy",
    "content": "Alice prefers async-first architectures",
    "memory_type": "preference"
  }'
```

### 限流

每个 `(user_id × thread_id × tool)` 组合 1 分钟内最多 10 次调用。超限返回 `400` + `Rate limit exceeded`。修改限流见 `apps/negentropy/src/negentropy/engine/tools/memory_tools.py:MAX_CALLS_PER_MINUTE`。

---

## 3. <a id="agent-tools"></a>Agent Tool 调用（ADK FunctionTool 风格）

```python
from google.adk.tools import FunctionTool
from negentropy.engine.tools.memory_tools import (
    memory_search, memory_write, memory_update, memory_delete, core_block_replace,
    MEMORY_TOOLS_OPENAPI,
)

# 注册到 ADK Agent
tools = [
    FunctionTool(memory_search),
    FunctionTool(memory_write),
    FunctionTool(memory_update),
    FunctionTool(memory_delete),
    FunctionTool(core_block_replace),
]
agent = MyAgent(tools=tools, ...)

# 调用上下文必须包含 user_id 和 app_name
# Agent 在对话中自主决定调用，例如：
#   - "记住用户的咖啡偏好" → memory_write(memory_type='preference')
#   - "用户的偏好是什么？" → memory_search(query='偏好')
#   - 用户更正信息 → memory_update(memory_id, new_content)
#   - "删除我的咖啡偏好" → memory_delete(memory_id)
#   - 重写人格画像 → core_block_replace(scope='user', new_content=...)
```

---

## 4. <a id="core-block"></a>Core Memory Block 用法

Core Block 是 Phase 4 新增的「常驻摘要块」，永不衰减、每次主动召回必加载，最高优先级注入到 Agent 上下文。

### 三种 scope

| Scope | 范围 | 唯一键 | 用法 |
|----|----|----|----|
| `user` | 跨 thread 的人格画像 | `(user, app, label)` | "Alice 是一名后端工程师，偏好 Rust 与 PostgreSQL" |
| `app` | 应用级常识 | `(app, label)` | "本系统支持中英双语交互" |
| `thread` | 会话级目标 | `(user, app, thread, label)` | "用户当前任务：实现 Phase 4 评测脚本" |

### Python 用法

```python
service = get_core_block_service()

# Upsert（按唯一键合并版本）
result = await service.upsert(
    user_id="alice",
    app_name="negentropy",
    scope="user",
    label="persona",
    content="Alice is a backend engineer who prefers Rust and PostgreSQL.\nAvoids npm/yarn (uses pnpm).",
    updated_by="agent_self_edit",
)
# {"id": "...", "version": 2, "scope": "user", "label": "persona", "token_count": 27}

# 列出某用户的所有 Core Block（按 thread → app → user 优先级排序）
blocks = await service.list_for_context(
    user_id="alice",
    app_name="negentropy",
    thread_id="6e7f...uuid",
)
```

### Agent 工具调用

```python
await core_block_replace(
    user_id="alice",
    app_name="negentropy",
    scope="user",
    new_content="Alice 是一名 Senior 后端工程师... <完整画像>",
    updated_by="agent_self_edit",
)
```

---

## 5. <a id="eval"></a>评测基线

```bash
cd apps/negentropy

# 跑迷你评测（默认 markers，无需特殊触发）
uv run pytest tests/eval_tests/memory/test_eval_runner.py -v --no-cov

# 跑全量基线 + 输出报告（手动 -m eval）
uv run pytest tests/eval_tests/memory -m eval -v --no-cov

# 直接运行 baseline runner（不需要 pytest）
uv run python -m tests.eval_tests.memory.eval_runner
# 报告自动写入 .temp/eval/baseline_<timestamp>.md
```

CI 触发：在 PR 上加 `memory-eval` 标签即可激活 [`memory-eval` workflow](../../.github/workflows/memory-eval.yml)。

---

## 6. ContextAssembler（上下文组装）

```python
from negentropy.engine.adapters.postgres.context_assembler import ContextAssembler

assembler = ContextAssembler(
    max_tokens=4000,      # 总 token 预算
    memory_ratio=0.3,     # 记忆占 30%
    history_ratio=0.5,    # 历史占 50%
    # system 占剩余 20%
)

result = await assembler.assemble(
    user_id="alice",
    app_name="negentropy",
    thread_id="6e7f...uuid",
    query="用户最近的编程偏好",      # 可选：触发 query intent 路由
    query_embedding=[...],          # 可选：触发 query-aware 排序
)
print(result["memory_context"])
print(result["budget"])
# budget 含: actual_tokens / overflow / core_block_tokens / query_intent {primary, boost_types, confidence}
```

注入顺序（从最高优先级到最低）：
1. **Core Memory Block**（`thread > app > user`）
2. **Query-Aware 主动召回**（vector × retention）
3. **遗忘曲线兜底**（recent + 高 retention 记忆）

---

## 7. <a id="phase5-features"></a>Phase 5 高级特性使用契约

> 工程契约稿；代码迭代实施中，以白皮书 [§4](../memory-whitepaper.md#4-phase-5-四方向落地记录2026-05-启动) 为准。所有特性默认关闭。

### 7.1 F1 — HippoRAG PPR 检索

**API 形态**（向后兼容；不传该参数走原路径）：
```python
response = await mem.search_memory(
    user_id="alice",
    app_name="negentropy",
    query="用户在分布式系统方面的经验",
    limit=10,
    enable_kg_ppr=True,   # Phase 5 新增；默认读 MEMORY_HIPPORAG_ENABLED
)
# 返回 entry 的 custom_metadata 含：
# {"search_level": "ppr+hybrid", "fusion": {"channels": [...], "rrf_score": 0.034}}
```

**前置条件**：KG 至少有 100 条 `memory_associations.target_type='entity'`；否则自动 short-circuit 回 Hybrid。

### 7.2 F2 — Reflexion 反思召回

**触发路径**：
```python
# 1. 检索后 Agent 给出反馈
await tracker.record_feedback(retrieval_id="...", outcome="harmful")
# 2. 异步反思（60s 内）写入 memories（subtype=reflection）
# 3. 下次同类 query（procedural/episodic intent）自动 few-shot 注入
```

**Few-Shot 注入位**：在 `ContextAssembler.assemble()` 返回的 `memory_context` 顶部（Core Block 之后）。budget 对象多出 `reflection_tokens / reflection_count` 字段。

### 7.3 F3 — 自定义 Memify Step

```python
# apps/negentropy/src/negentropy/engine/consolidation/pipeline/steps/my_step.py
from ..protocol import ConsolidationStep, PipelineContext, StepResult
from ..registry import register

@register("my_normalize")
class MyNormalizeStep:
    name = "my_normalize"
    async def run(self, ctx: PipelineContext) -> StepResult:
        # 处理 ctx.facts，写回 ctx.entities
        return StepResult(outputs={"entities": [...]}, metrics={"duration_ms": 12})

# 配置启用：
# memory:
#   consolidation:
#     steps: [fact_extract, my_normalize, summarize]
```

**默认行为**：不配置 `steps:` 时与 Phase 4 完全一致（`[fact_extract, summarize]` 串行）。

### 7.4 F4 — Presidio PII 引擎

**安装**：
```bash
cd apps/negentropy
uv sync --extra pii-presidio
# 自动下载 zh_core_web_sm + en_core_web_sm（200MB 左右，首次较慢）
```

**配置切换**（`config.yaml`）：
```yaml
memory:
  pii:
    engine: presidio          # 默认 regex；切换后 factory 自动加载 Presidio
    policy: mask              # mark | mask | anonymize
    languages: [en, zh]
    score_threshold: 0.6
    retrieval:
      gatekeeper_enabled: true
      acl_role_threshold: editor   # < editor 看 anonymized 副本
```

**API 变化**：
- Memory 写入返回多 `pii_spans` 字段（命中 PII 列表）；
- `GET /api/memory/{id}/pii` 返回 spans 详情；
- `POST /api/memory/{id}/anonymize` 一键脱敏（写 audit）。

---

## 8. 故障排除速览

| 症状 | 可能原因 | 排查 |
|----|----|----|
| `Rate limit exceeded` | Agent self-edit 短时间高频调用 | [troubleshooting](./memory-troubleshooting.md#rate-limit) |
| 检索返回为空 | embedding_fn 未配置 / DB hybrid_search 函数缺失 | [troubleshooting](./memory-troubleshooting.md#search-empty) |
| Core Block 重复条目 | scope=thread 但 thread_id 漏传 | [troubleshooting](./memory-troubleshooting.md#core-block-dup) |
| Memory `retention=0` 大量记忆 | 自动化清理任务跑过 | [memory-automation](./memory-automation.md) |

详见 [`memory-troubleshooting.md`](./memory-troubleshooting.md)。
