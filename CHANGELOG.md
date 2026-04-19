# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 约定，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Fixed

- 修复 Admin → Models 对 OpenAI 兼容代理 `base_url`（如 `http://llms.as-in.io/v1`）下 `gpt-5-mini` 等新一代模型 Ping 返回 `404 NotFound` 的问题，并一并收敛 Anthropic / Gemini 的同类风险：
  - `auth.api._ping_llm` 原本手写最小 kwargs（`max_tokens=20 + api_key + api_base`），绕过业务主链路的 `_build_llm_kwargs` / `_DEFAULT_LLM_KWARGS` 合并策略，缺失 `drop_params=True`，导致 LiteLLM 无法将 `max_tokens` 自动映射为 gpt-5 / o-系要求的 `max_completion_tokens`，代理兜底以 `{'meta':{'code':404}, 'data':{}}` 返回 404；
  - 新增 `config.model_resolver.build_ping_llm_kwargs(vendor, model_name, ...)`：内部复用 `_build_llm_kwargs` 以继承 vendor 专属适配（Anthropic `thinking={"type":"disabled"}`、OpenAI o 系列 `reasoning_effort`），并强制 `drop_params=True`，但故意不注入 `_DEFAULT_LLM_KWARGS["temperature"]`（gpt-5 仅接受 `temperature=1`，Ping 阶段不应耦合模型版本）；
  - 新增 `config.model_resolver.normalize_api_base(...)`：防御性剥离用户误贴的 `/chat/completions`、`/v1/messages`、`/completions` 后缀及尾部多余 `/`，幂等且对合法 `https://host/v1` 配置零影响；
  - `auth.api.ping_model` / `_ping_llm` 重构为复用上述入口，异常路径新增结构化日志（vendor / full_model_name / 归一化 api_base / latency / 脱敏 error）；
  - 新增单元测试 `tests/unit_tests/config/test_model_resolver_ping.py`（17 用例）与端点测试 `tests/unit_tests/auth/test_admin_models_ping.py`（9 用例），覆盖三家 vendor kwargs 透传、DB vendor_configs 回退、api_base 规范化、401 / 404 / timeout 中文文案分类、非 admin 403 拦截。
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

### Changed

- 默认 LLM 模型由 `zai/glm-5` 切换为 `openai/gpt-5-mini`；模型 vendor（OpenAI / Anthropic / Gemini 等）通过 Admin → Model 页动态配置，数据源为 `model_configs` 表。
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
