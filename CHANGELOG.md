# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 约定，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Fixed

- 修复 Home 页对话框发送消息返回 500（`ValueError: Agent not found: 'negentropy'`）：根因为 `cli.py` 的 `--reload_agents` 参数值 `src/negentropy` 使 ADK `AgentLoader` 在 `src/negentropy/` 下查找名为 `negentropy` 的子模块（期望 `src/negentropy/negentropy/`），但 Agent 实际定义在 `src/negentropy/` 本身（通过 `__init__.py` 的 `__getattr__` 导出 `root_agent`）。将 `agents_dir` 从 `src/negentropy` 改为 `src`，使 ADK 在 `src/` 下正确发现 `negentropy` 包；同步在 `src/` 下新建 `services.py` 作为 ADK `load_services_module` 的 service bridge，确保 `apply_adk_patches()`（日志、中间件、路由、模型缓存等）仍被正确加载。前端模型选择"自动变回 Default"为本次 500 错误的次生问题（后端未返回 STATE_DELTA 事件确认选择），后端修复后自动解决。
- 修复 Admin → Models 页 OpenAI Setting 模态框「Add Model」Save 时 `POST /api/auth/admin/model-configs` 返回 404：根因为 Next.js BFF 层缺少 `model-configs` 代理路由文件，补齐 `app/api/auth/admin/model-configs/route.ts`（GET/POST）与 `app/api/auth/admin/model-configs/[config_id]/route.ts`（PATCH/DELETE），与已有 `vendor-configs` 路由模式对齐。
- 修复 Admin → Models → Vendor（OpenAI）Edit 弹窗在自建网关（如 `http://llms.as-in.io`，同一网关下 Anthropic 与 Gemini Ping 均成功）下点击 **Ping** 返回 `litellm.RateLimitError: OpenAIException - Error code: 429 - {'meta': {'code': 429, 'source': 'gateway', 'type': 'TooManyRequests', 'message': 'API rate limit exceeded'}}`：根因为 litellm `1.83.x` 对 `openai/*` 将用户 `api_base` 原样作为 `AsyncOpenAI(base_url=...)`（见 `site-packages/litellm/llms/openai/openai.py::acompletion`），而 OpenAI Python SDK 以相对路径 `chat/completions` 拼接最终 URL（见 `site-packages/openai/resources/chat/completions/completions.py::create`），与 litellm 内置默认 `https://api.openai.com/v1` 的 `/v1` 版本段不对齐；用户按 OpenAI 官网 placeholder 风格填入裸 host `http://llms.as-in.io` 时请求落到 `http://llms.as-in.io/chat/completions`，网关因路径未注册以 catchall `429 TooManyRequests` 响应，反向伪装成「供应商限流」（对照 Anthropic 在 litellm 侧显式拼 `/v1/messages`、Gemini 已由上一条修复补齐 `/v1beta` 而均能成功）。扩展 `negentropy/config/model_resolver.py::normalize_api_base_for_litellm()` 新增 `openai/` 分支作为单一事实源：官方域名（`https://api.openai.com[/v1]`）→ `None` 放行 litellm 内置 URL；自建代理末尾无 `/v1` → 补齐 `/v1` 抵消 SDK 拼接偏差；用户误粘 `/chat/completions`、`/completions`、`/embeddings`、`/responses` 及其 `/v1/*` 变体时迭代剥离后再补齐；URL 中段已显式编码 `/v1`（如 `https://gateway/openai/v1`、`https://gateway/v1/custom`）恒等透传以兼容自定义多租户代理。`_ping_llm` / `_build_llm_kwargs` / `_build_embedding_kwargs` 复用同一规则覆盖 chat 与 embedding 全链路。
- 修复 Knowledge → Corpus 新建/编辑对话框及 Corpus 详情页 `ChunkingStrategyPanel` 中「Separators (one per line)」文本域键入单个 `\` 被自动扩写为 `\\`、无法删除或继续编辑成 `\n\n` 的 UX 阻塞：根因为 4 处 textarea 采用「受控组件 + 非幂等显示变换」反模式，将 `encodeSeparatorsForDisplay(decodeSeparatorsFromInput(input))` 直接作为 value 形成 round-trip，而该组合对「孤立反斜杠」这类中间态非幂等（decode 按字面量 1 字节保留，encode 再补写为 2 字节）。新增 `features/knowledge/components/SeparatorsTextarea.tsx` 将「原始输入字符串」抽离为本地显示缓冲，仅在外部 `value: string[]` 的**语义**变化（经 `separatorsArrayEqual` 判定，而非数组引用）时才重同步，避开 round-trip 抖动；4 处调用点（`CorpusFormDialog` recursive/hierarchical、`app/knowledge/base/page.tsx` recursive/hierarchical）统一替换；补齐 5 个 RTL 回归用例覆盖孤立 `\`、字面量 `\n`、外部重同步、等值引用稳定、退格清空五类行为。后端 schema 与 encode/decode 契约零改动。
- 修复 Admin → Models → Vendor（Gemini）Edit 弹窗点击 **Ping** 返回 `litellm.APIConnectionError: GeminiException - Received=<!DOCTYPE html>...window.__FEATURE_FLAGS__={...}`：根因为 litellm `1.83.x` 在 `vertex_ai/vertex_llm_base.py::_check_custom_proxy` 中一旦 `api_base` 非空即以 `{api_base}/models/{model}:{endpoint}` 拼接，丢失 Google 要求的 `/v1beta/` 版本段；用户按 placeholder 填入 `https://generativelanguage.googleapis.com` 会被路由到不存在的路径并被边缘以 HTML 兜底页响应，litellm 按 JSON 解析失败后抛 `GeminiException`。新增 `negentropy/config/model_resolver.py::normalize_api_base_for_litellm()` 作为单一事实源对 Gemini `api_base` 做正交归一（Google 官方域名 → `None` 放行 litellm 内置 URL；自建代理 → 补齐 `/v1beta` 抵消拼接偏差；非 `gemini/` 模型恒等透传），并在 `_ping_llm` / `_build_llm_kwargs` / `_build_embedding_kwargs` 三处共享同一规则，同步为 Ping 注入 `drop_params=True` 与 `_DEFAULT_LLM_KWARGS` 对齐。
- 修复 `adk web` 启动时 `MemoryAutomationFunctionResponse` 触发的 Pydantic `UserWarning: Field name "schema" in "MemoryAutomationFunctionResponse" shadows an attribute in parent "BaseModel"`：将 Python 属性名改为 `schema_name`，通过 `Field(alias="schema", serialization_alias="schema")` + `model_config = ConfigDict(populate_by_name=True)` 保持线协议（wire format）键名 `"schema"` 不变，前端 TS 类型与后端 SQL 数据零改动。
- 补齐 `opentelemetry-instrumentation-google-genai>=0.6b0,<1.0.0` 依赖，消除 ADK `adk_web_server` 启动期 `Unable to import GoogleGenAiSdkInstrumentor` WARNING，恢复 Google GenAI SDK 的 OTel 自动埋点，与现有 Langfuse OTel 链路打通。
- 站点级安静化两类先于 `negentropy.bootstrap` 触发的上游启动噪声（`AuthlibDeprecationWarning: authlib.jose module is deprecated` 与 `[EXPERIMENTAL] feature FeatureName.PLUGGABLE_AUTH is enabled`）：通过 `apps/negentropy/src/_negentropy_silence.pth`（hatchling `force-include` 至 site-packages 根）+ `negentropy/_silence_upstream_warnings.py` 在解释器 site 初始化期替换 `warnings.showwarning`，按消息子串白名单丢弃噪声；不影响任何其他告警通道，对 `authlib.deprecate` 的 `simplefilter("always", AuthlibDeprecationWarning)` 免疫（在 filter 之后的 showwarning 层拦截）。

### Removed

- 删除 `apps/negentropy/.env.example`（197 行）：其承载的全部非密钥配置项已在 `config.default.yaml` 中以结构化 YAML 形式表达，密钥类条目改为通过 shell 环境变量或 `.env.local` 提供。
- 下线 ZAI（Zhipu AI GLM）专属的 LiteLLM 集成链路：
  - 删除 `LlmVendor.ZAI` 枚举项；
  - 删除 `apps/negentropy/src/negentropy/config/pricing/glm_pricing.json` 与 `config/pricing/loader.py`、`config/pricing/models.py`（本地定价覆盖链路已由 LiteLLM 在线价目表统一收敛）；
  - 删除 `engine/bootstrap.py` 中 `NE_API_KEY → ZAI_API_KEY` 的环境变量映射；
  - 删除 `config/model_resolver.py` 中针对 ZAI vendor 的 thinking 处理分支；
  - `model_names.canonicalize_model_name()` 下线 GLM→zai 特化规则，退化为通用幂等 no-op（保留函数签名以维持上游调用正交性）。
- 彻底删除 `apps/negentropy-ui/lib/server/backend-url.ts` 的「历史端口迁移守护」（`LEGACY_LOCAL_PORTS` / `applyLegacyPortMigration` / `isLegacyLocalhostUrl` / `__resetLegacyPortWarningsForTests`）及其在 `.env.example`、`docs/development.md`、`tests/unit/lib/server/backend-url.test.ts` 中的关联配对：迁移守护本意为兼容 `:6600` / `:6666` → `:3292` 过渡期，但已完成迁移后继续残留反而构成熵源（让历史端口持续在代码、文档、测试夹具中循环出现，并与运维侧 `.env` 残留互相掩盖，导致「以为 PR 引入端口回退」的误判）。`3292` 为唯一权威端口；若本地 `.env` / `.env.local` 或 Google Cloud Console OAuth 授权重定向 URI 白名单仍残留 `:6600` / `:6666`，请一次性更新至 `:3292`（运维提示已同步进 `docs/sso.md`）。

### Changed

- Admin / Models → Interface / Models 信息架构迁移，同时彻底清除 `plugins` 命名残留，校正 Interface 二级导航顺序，并让 Dashboard 与 Nav 顺序严格对齐：
  - **IA 迁移**：Models 页（供应商凭证 + 模型注册 + Ping）归属从 Admin 迁到 Interface，二级路径 `/admin/models` → `/interface/models`；Admin 模块只保留 Users / Roles 治理职责，`AdminNav` 同步移除 Models 条目。
  - **命名统一**：UI 路径 `/plugins/*` → `/interface/*`、前端源码目录 `app/plugins/` → `app/interface/`、API 代理 `app/api/plugins/` → `app/api/interface/`、后端模块 `negentropy/plugins/` → `negentropy/interface/`（路由前缀 `/plugins` → `/interface`）、组件 `PluginsNav` → `InterfaceNav`、类型 `types/admin-models.ts` → `types/interface-models.ts`、组件 `components/admin/VendorModelsDisclosure.tsx` → `components/interface/VendorModelsDisclosure.tsx`；所有 `PluginStatsResponse` / `PluginsPage` / `PluginsLayout` 等符号同步更名为 `InterfaceStatsResponse` / `InterfacePage` / `InterfaceLayout`，不再残留 legacy `plugins` 概念。
  - **端点迁移**：原 `auth/api.py` 承载的 6 条 Models 路由（`/auth/admin/{vendor-configs,model-configs,models/ping}`）整体摘出至 `negentropy/interface/models_api.py`，前缀统一为 `/interface/models/*`；前端代理同步迁入 `app/api/interface/models/{vendor-configs,configs,ping}/`，`auth/api.py` 侧旧端点连同辅助函数一并移除。
  - **导航与 Dashboard 对齐**：`InterfaceNav` NAV_ITEMS 顺序改为 `Dashboard → Models → SubAgents → MCP → Skills`（SubAgents 上移至 MCP 之前）；`/interface` Dashboard 新增 Models StatCard（`total` / `enabled` / `vendors`）与「Manage Models」Quick Link，卡片 / Quick Link 顺序严格对齐 Nav。
  - **权限双层守卫（保守策略）**：Models 权限父项向 `interface:*` 命名看齐（`rbac.PERMISSIONS` 新增 `interface:read` / `interface:write`，`user` 角色获得 `interface:read`/`interface:write`，`admin` 角色以 `interface:*` 通配覆盖），但后端仍保留 `"admin" in current_user.roles` 的 role 校验（403），并在前端 `InterfaceNav` / Dashboard Models 入口基于 `useAuth().user.roles` 条件渲染，`/interface/models/page.tsx` 内部以 `useEffect` 重定向守卫兜底，避免非 admin 绕过入口直接访问。
  - **后端 `/interface/stats` 扩展**：聚合响应新增 `models: { total, enabled, vendors }` 字段，`total` 来自 `ModelConfigRecord` 总数、`enabled` 按 `ModelConfigRecord.enabled=True` 计数、`vendors` 为启用 `VendorConfig` 的数量。
  - **测试同步**：`tests/unit/plugins/` → `tests/unit/interface/` 整目录迁入；`PluginsNav.test.tsx` → `InterfaceNav.test.tsx` 并新增 Models 入口 admin/非 admin 可见性、NAV_ITEMS 顺序断言；`InterfacePage.test.tsx` 新增 Models StatCard 与 Quick Link 的条件渲染断言；后端 `tests/unit_tests/interface/test_models_api.py` / `test_models_ping.py` 从 auth 目录迁入并把 URL 断言改为 `/interface/models/*`，`test_deps_and_rbac.py` 同步更新 `interface:write` 断言。
- 默认 LLM 模型由 `zai/glm-5` 切换为 `openai/gpt-5-mini`；模型 vendor（OpenAI / Anthropic / Gemini 等）通过 Interface → Models 页动态配置，数据源为 `model_configs` 表。
- 激进重构 `apps/negentropy/src/negentropy/config/config.default.yaml`：
  - 引入 `_constants` YAML anchor/alias 块，消除 ≥7 处魔法数字/字符串重复；
  - 顶级 `env:` 重组为 `environment.env`，与其他 8 个子块结构对齐（对 legacy 顶级 `env:` 保留向后兼容回退）；
  - `database.url` 去凭证化为模板值 `postgresql+asyncpg://USER:PASSWORD@localhost:5432/negentropy`；
  - `auth.cookie_secure` 注释增加「生产必须为 true」警示；
  - 头部注释增补密钥类环境变量清单（OpenAI / Anthropic / Gemini / Langfuse / Google Search 等）。
- 为 9 个 Settings 类（主 `Settings` + 8 子 Settings）启用 Pydantic `env_nested_delimiter="__"`，支持扁平环境变量覆盖深层嵌套字段，例如 `NE_KNOWLEDGE_DEFAULT_EXTRACTOR_ROUTES__URL__PRIMARY__TIMEOUT_MS=90000`。
- 文档统一推荐 `uv run negentropy init` 生成 `~/.negentropy/config.yaml`，密钥通过 shell 环境变量或 `.env.local` 注入。

### Breaking

- 合并 `0001_init_schema.py` / `0002_add_vendor_configs.py` 为单一 `0001_init_schema.py`（revision id 重置为 `0001`）；升级路径：**需先 `DROP SCHEMA negentropy CASCADE` 再 `uv run alembic upgrade head`**（项目处于早期阶段，无线上负担，不做自动兼容）。
- 移除 6 个孤岛型 ORM 与对应表：`SandboxExecution`、`Instruction`、`ConsolidationJob`、`Run`、`Message`、`Snapshot`；两轮审计下均为业务零引用，遵循熵减原则。配套裁撤 `Thread.{runs,messages,snapshots,consolidation_jobs}` 与 `Event.messages` 五个 relationship。业务表数由 42 降为 37。
- 新迁移不包含任何种子数据（`model_configs` / `mcp_servers` 预设）；默认配置改由应用侧初始化流程（如 `negentropy init` 或管理员首次登录）承担。
- 用户级 `~/.negentropy/config.yaml` 或部署脚本中若配置了 `zai/*` 模型，需在 Admin → Model 页迁移至 OpenAI / Anthropic / Gemini 等 vendor 重新配置；历史 DB 中 `vendor=zai` 的 `model_configs` 记录不会被自动清理，但调用时将因缺失解析逻辑而返回「模型未配置」。
- 下线 `NE_API_KEY → ZAI_API_KEY` 映射；依赖该映射的部署需改为直接设置各 vendor 原生环境变量（如 `OPENAI_API_KEY`、`ANTHROPIC_API_KEY`）。
