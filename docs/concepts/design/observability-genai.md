# GenAI 可观测性 · OpenTelemetry GenAI Semantic Conventions 落地

> 本文档说明 negentropy 如何把 LLM 调用的可观测信号对齐到 **OpenTelemetry GenAI Semantic Conventions 1.28+** 标准；与 [conversation-foundation.md §7](../conversation-foundation.md) 的理论坐标系对应。

## 0. 范围

适用对象：所有走 LiteLLM 完成的 chat completion 调用（系部 LLM、根 Agent、Skills、Sub-Agents 等）。
不在本文档范围：

- **业务级 trace**（HTTP request, KG build run）→ 见 [framework.md](../framework.md) §10；
- **Tool Progress 旁路**（state delta）→ 见 [framework.md §9.7](../framework.md) 与 [conversation-foundation.md §2.2](../conversation-foundation.md)；
- **KG SSE 进度**（P3-1）→ 见 [user-guide/chat-essentials.md §8](../user-guide/chat-essentials.md)。

## 1. 设计动机

OTel GenAI semconv 是当前**唯一可移植**的 LLM trace 字段标准 <sup>[[1]](#ref1)</sup>。Langfuse / SigNoz / Phoenix / Arize 等观测后端均以本规范作为入参约束；写出标准属性后，未来切换后端零代码改动。

negentropy 自 Phase 1 起接入 Langfuse + LiteLLM `otel` callback；Phase 3 P3-3 在此基础上：
1. 用 `_inject_genai_semconv_attrs` 显式补齐 OTel GenAI 1.28+ 标准 attribute；
2. 用 `_detect_genai_system` 把模型名前缀映射到标准 `gen_ai.system` 值；
3. 通过单测固化 mapping 表 + 写入契约。

## 2. 实现位置

| 组件            | 路径                                                                                                                                       | 角色                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Bootstrap       | [`apps/negentropy/src/negentropy/engine/bootstrap.py`](../../../apps/negentropy/src/negentropy/engine/bootstrap.py)                        | 注入 OTLP endpoint + Basic Auth + 注册 LiteLLM callback        |
| 自定义 Callback | [`apps/negentropy/src/negentropy/instrumentation.py`](../../../apps/negentropy/src/negentropy/instrumentation.py) `LiteLLMLoggingCallback` | 结构化日志 + cost 注入                                         |
| Semconv 写入    | [`instrumentation.py`](../../../apps/negentropy/src/negentropy/instrumentation.py) `_inject_genai_semconv_attrs`                           | 补齐 OTel GenAI 1.28+ 标准 attribute（P3-3）                   |
| Span Patch      | [`instrumentation.py`](../../../apps/negentropy/src/negentropy/instrumentation.py) `patch_litellm_otel_cost`                               | 在 LiteLLM 内置 OpenTelemetry callback 之后追加 cost + semconv |

## 3. 已写入的 GenAI 标准属性

| Attribute                                                                | 来源                                             | 示例值                                                                                                  | 说明                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `gen_ai.system`                                                          | 模型名前缀映射                                   | `anthropic`, `openai`, `gemini`, `vertex_ai`, `mistral`, `cohere`, `meta`, `ollama`, `groq`, `deepseek` | 未识别 vendor 时省略，避免污染未知值                |
| `gen_ai.operation.name`                                                  | 固定 `chat`                                      | `chat`                                                                                                  | TODO（Phase 3+）：区分 `embedding` / `tool_use`     |
| `gen_ai.request.model`                                                   | `kwargs.model` 经 `canonicalize_model_name` 归一 | `claude-opus-4-7`                                                                                       | 与 Langfuse 模型聚合一致                            |
| `gen_ai.response.model`                                                  | `response_obj.model` 归一                        | `claude-opus-4-7`                                                                                       | LiteLLM 重写后实际模型，可与 request 不同           |
| `gen_ai.request.temperature` / `top_p` / `max_tokens` / `stop_sequences` | `kwargs[k]`                                      | `0.7` / `0.95` / `4096`                                                                                 | 仅当存在时上报                                      |
| `gen_ai.usage.input_tokens`                                              | `response.usage.prompt_tokens`                   | `120`                                                                                                   | semconv 1.28+ 用 `input_tokens`（非 prompt_tokens） |
| `gen_ai.usage.output_tokens`                                             | `response.usage.completion_tokens`               | `360`                                                                                                   | 同上                                                |
| `gen_ai.usage.cost`                                                      | LiteLLM cost / 在线价目 / 本地 override          | `0.001234`                                                                                              | `langfuse.observation.cost_details` 同步对齐        |
| `gen_ai.response.id`                                                     | `response_obj.id`                                | `msg_01abc...`                                                                                          | 用于 Langfuse provider trace 反查                   |
| `gen_ai.response.finish_reasons`                                         | `response.choices[].finish_reason` 数组          | `["stop"]` / `["length"]` / `["tool_use"]`                                                              | semconv 用列表                                      |

## 4. 模型 → vendor 映射表（_detect_genai_system）

| 前缀（不区分大小写）            | system 值   |
| ------------------------------- | ----------- |
| `openai/`, `gpt-`, `o1-`, `o3-` | `openai`    |
| `anthropic/`, `claude-`         | `anthropic` |
| `gemini/`, `gemini-`            | `gemini`    |
| `vertex_ai/`                    | `vertex_ai` |
| `mistral/`                      | `mistral`   |
| `cohere/`                       | `cohere`    |
| `llama-`                        | `meta`      |
| `ollama/`                       | `ollama`    |
| `groq/`                         | `groq`      |
| `deepseek/`                     | `deepseek`  |

未匹配者 `system` 字段省略（避免写错值）；扩展新 vendor 时同步更新映射表与单测。

## 5. fail-soft 契约

任何 attribute 写入失败（属性访问异常 / span 已结束 / 不可写）一律静默忽略，**绝不抛回 LLM 主路径**。具体实现见 `_inject_genai_semconv_attrs` 的外层 `try/except`，以及 `_safe_set_span_attribute` 的 `is_recording()` 守卫。

## 6. 验证

- 单测：[`tests/unit_tests/engine/test_genai_semconv.py`](../../../apps/negentropy/tests/unit_tests/engine/test_genai_semconv.py)
  - `_detect_genai_system` 14 种已知前缀 + 4 种未知形态；
  - `_inject_genai_semconv_attrs` 完整字段写入 / 缺字段降级 / 不可写 span / 异常 fail-soft / None span。
- 实机：本地启 Langfuse → 触发对话 → 在 Langfuse trace 详情查看 LLM observation 应携带 `gen_ai.system`、`gen_ai.usage.input_tokens` 等字段。

## 7. 后续 Phase 工作

| 项目                                                                     | 期望落点                                                                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `gen_ai.operation.name` 区分 chat / embedding / tool_use                 | 引入 LiteLLM `kwargs.litellm_call_type` 或显式分支                                                                       |
| Embedding 调用的 input 文本数                                            | `gen_ai.usage.input_tokens` 同字段，需在 embedding callback 也注入                                                       |
| Streaming 场景的 finish_reasons 聚合                                     | 跟踪 stream 终态而非首 chunk                                                                                             |
| OTel GenAI Events（`gen_ai.user.message`、`gen_ai.assistant.message`）   | 替代当前 `_emit_semantic_logs` 的私有字段，等 LiteLLM 默认实现稳定后切换                                                 |
| Metrics（`gen_ai.client.token.usage`、`gen_ai.server.request.duration`） | 引入支持 metrics 的后端（SigNoz / Phoenix）后再启用，参见 `bootstrap.py` `_disable_adk_otel_logs_metrics_exporters` 注释 |

## 参考文献

<a id="ref1"></a>[1] OpenTelemetry Project, "Semantic Conventions for Generative AI," 2024-2025 (v1.28+). [Online]. Available: https://opentelemetry.io/docs/specs/semconv/gen-ai/
[2] CNCF Langfuse, "OpenTelemetry Integration Guide," 2024. [Online]. Available: https://langfuse.com/docs/opentelemetry/get-started
[3] LiteLLM Documentation, "OpenTelemetry Logging," 2024-2025. [Online]. Available: https://docs.litellm.ai/docs/observability/opentelemetry_integration
