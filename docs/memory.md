# Memory 设计与实施管理

## 1. 定位

Memory 模块负责用户长期记忆的形成、保留、检索与治理，区别于静态共享的 Knowledge。为避免控制面与数据面耦合，本次新增 **Memory / Automation** 二级导航页，统一展示与管理仿生记忆自动化过程，包括：

- 艾宾浩斯遗忘曲线参数
- Memory Retention 清理任务
- Context Assembler 组装预算
- Maintenance Consolidation 周期触发
- PostgreSQL 受管函数与 `pg_cron` 调度状态
- 最近执行日志与受控运维动作

## 2. 设计原则

- **控制面/数据面分离**：前端不直接编辑任意 SQL，不直接面向 `cron.job` 暴露数据库内部结构。
- **Single Source of Truth**：自动化配置以服务端 `memory_automation_configs` 为唯一事实源，UI 仅读写该契约。
- **受控运维**：只允许对预定义过程执行 `enable / disable / reconcile / run`。
- **渐进降级**：未安装 `pg_cron` 时仍可查看配置和函数定义，但调度能力退化为只读。

当前设计延续了 ADK MemoryService 的“写入/检索解耦”模式与 LangGraph 的“短期状态/长期记忆分层”思路：实时响应走检索热路径，深度巩固与周期维护走后台过程<sup>[[2]](#ref2)</sup><sup>[[3]](#ref3)</sup>。在 PostgreSQL 落地时，调度层以 `pg_cron` 作为可选增强能力，而不是将数据库内部对象直接暴露为前端控制面<sup>[[4]](#ref4)</sup><sup>[[5]](#ref5)</sup>。

## 3. 核心对象

```mermaid
flowchart TD
    subgraph ControlPlane[Memory Automation Control Plane]
        UI[Memory / Automation]
        API[/memory/automation/*]
        CFG[(memory_automation_configs)]
    end

    subgraph ManagedProcess[Managed Processes]
        RET[Retention Cleanup]
        ASM[Context Assembler]
        CON[Maintenance Consolidation]
    end

    subgraph Postgres[PostgreSQL Runtime]
        FN[Managed SQL Functions]
        CRON[cron.job]
        LOG[cron.job_run_details]
    end

    UI --> API --> CFG
    API --> RET
    API --> ASM
    API --> CON
    RET --> FN
    ASM --> FN
    CON --> FN
    RET --> CRON
    CON --> CRON
    CRON --> LOG
```

## 4. 受管过程

| 过程 | 受管函数 | 受管任务 | 说明 |
| :-- | :-- | :-- | :-- |
| Retention Cleanup | `calculate_retention_score`, `cleanup_low_value_memories` | `cleanup_memories` | 定时更新 retention 并清理低价值记忆 |
| Context Assembler | `get_context_window` | 无 | 按 token budget 组装记忆与历史 |
| Maintenance Consolidation | `trigger_maintenance_consolidation` | `trigger_consolidation` | 批量创建巩固任务 |

## 5. PostgreSQL 初始化前置条件

要让 `Memory / Automation` 进入可用状态，PostgreSQL 至少需要满足以下条件。

### 5.1 最小可用

- 已执行当前 Alembic migration，包含 `negentropy.memory_automation_configs`。
- 仿生记忆依赖表已存在：`memories`、`events`、`threads`、`consolidation_jobs`。
- 已安装 `vector` 扩展，支持 `memories.embedding` 的向量检索。
- 应用连接用户可读取 `pg_extension`，以便后端探测系统能力。

### 5.2 完全可用

在“最小可用”基础上，再补齐以下能力即可让调度控制面可写：

- 已安装 `pg_cron` 扩展。
- 应用连接用户可访问 `cron.job`，用于查看、启停、重建受管任务。
- 应用连接用户可访问 `cron.job_run_details`，用于展示 `Recent Logs`。

说明：

- `pg_cron` 是增强能力，不是 Memory Automation 的硬依赖；未安装时页面仍可查看配置和函数状态。
- `Recent Logs` 依赖 `cron.job_run_details`；日志为空不必然表示任务未运行，也可能是日志表不可访问。

## 6. PostgreSQL 初始化步骤

推荐按“迁移 -> 能力检查 -> 打开控制面 -> 保存并同步 -> 验证”的顺序完成初始化。

### 6.1 执行 migration

```bash
uv run --project apps/negentropy alembic upgrade head
```

执行后，至少应确认 `memory_automation_configs` 已创建：

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'negentropy'
  AND table_name = 'memory_automation_configs';
```

### 6.2 检查底层扩展

```sql
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('vector', 'pg_cron')
ORDER BY extname;
```

判定原则：

- `vector` 缺失：Memory 检索链路本身不完整，应先补齐。
- `pg_cron` 缺失：Automation 页面进入“调度只读”降级态，但函数与配置仍可用。

### 6.3 检查受管函数依赖表

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'negentropy'
  AND table_name IN ('memories', 'events', 'threads', 'consolidation_jobs')
ORDER BY table_name;
```

这些表分别支撑：

- `memories`：长期记忆本体与 retention 清理。
- `events`、`threads`：`get_context_window()` 的历史拼装。
- `consolidation_jobs`：周期性巩固任务投递。

### 6.4 打开 Automation 页面并执行一次“保存并同步”

推荐使用管理员账号进入 `Memory / Automation` 页面执行一次“保存并同步”。当前实现会：

- 始终把配置写入 `negentropy.memory_automation_configs`
- 始终 reconcile 受管函数
- 仅在 `pg_cron` 可用时 reconcile 受管任务

这意味着初始化主路径应以控制面为准，而不是人工先手写完整 SQL。

这一顺序对应“配置为事实源、数据库对象为受管派生物”的控制面模式，可降低函数定义和调度命令被人工漂移改坏的概率<sup>[[2]](#ref2)</sup><sup>[[5]](#ref5)</sup>。

## 7. 系统能力与状态判断

Automation 页面中的系统能力对应后端运行时探测结果：

| 能力位 | 含义 | 对页面的影响 |
| :-- | :-- | :-- |
| `pg_cron_installed` | 是否安装了 `pg_cron` 扩展 | 决定是否具备调度能力基础 |
| `pg_cron_available` | 是否可访问 `cron.job` | 决定 `Managed Jobs` 是否可写 |
| `pg_cron_logs_accessible` | 是否可访问 `cron.job_run_details` | 决定 `Recent Logs` 是否可见 |

常见状态解释：

- `healthy`：配置、函数、任务、日志能力都满足当前期望。
- `degraded`：至少一个能力位、函数状态或 job 状态不满足当前期望，但控制面仍可部分使用。

## 8. 一期接口

- `GET /memory/automation`
- `GET /memory/automation/logs`
- `POST /memory/automation/config`
- `POST /memory/automation/jobs/{job_key}/enable`
- `POST /memory/automation/jobs/{job_key}/disable`
- `POST /memory/automation/jobs/{job_key}/reconcile`
- `POST /memory/automation/jobs/{job_key}/run`

## 9. 配置到运行时的映射

- `retention.decay_lambda`：映射到 `calculate_retention_score()` 与 `cleanup_low_value_memories()` 的默认衰减参数。
- `retention.low_retention_threshold` / `retention.min_age_days`：映射到 `cleanup_low_value_memories()` 的默认清理阈值与最小保留天数。
- `context_assembler.max_tokens` / `memory_ratio` / `history_ratio`：映射到 `get_context_window()` 的默认参数，控制记忆与历史的预算切分。
- `consolidation.lookback_interval`：映射到 `trigger_maintenance_consolidation()` 的默认时间窗口。
- `retention.auto_cleanup_enabled` / `consolidation.enabled` 与各自 `schedule`：映射到受管 `pg_cron` 任务是否启用及其 cron 表达式。

## 10. 过程摘要与启动路径

### 10.1 Retention Cleanup

- 目标：基于艾宾浩斯遗忘曲线更新 retention 并清理低价值记忆。
- 受管函数：`calculate_retention_score()`、`cleanup_low_value_memories()`
- 受管任务：`cleanup_memories`
- 启动方式：
  - 在 `Automation Config` 中设置 `retention.decay_lambda`
  - 设置 `low_retention_threshold`、`min_age_days`
  - 打开 `auto_cleanup_enabled`
  - 设置 `cleanup_schedule`
- 验证方式：
  - `Managed Jobs` 中出现 `cleanup_memories`
  - `command` 包含当前阈值、天数与衰减系数

### 10.2 Context Assembler

- 目标：在检索路径中按 token budget 组装长期记忆与近期历史。
- 受管函数：`get_context_window()`
- 受管任务：无
- 启动方式：
  - 在 `Automation Config` 中设置 `max_tokens`
  - 设置 `memory_ratio` 与 `history_ratio`
  - 点击“保存并同步”以更新函数默认参数
- 验证方式：
  - `Functions` 中的 `get_context_window` 定义与当前配置一致

说明：Context Assembler 没有独立 cron 任务，它通过函数默认参数参与实时检索，而不是后台调度。

### 10.3 Maintenance Consolidation

- 目标：按时间窗口批量创建巩固任务。
- 受管函数：`trigger_maintenance_consolidation()`
- 受管任务：`trigger_consolidation`
- 启动方式：
  - 在 `Automation Config` 中设置 `consolidation.schedule`
  - 设置 `lookback_interval`
  - 打开 `consolidation.enabled`
- 验证方式：
  - `Managed Jobs` 中出现 `trigger_consolidation`
  - `command` 中包含当前 `lookback_interval`

## 11. 页面使用说明

### 11.1 Automation Config

`Automation Config` 是唯一可写的业务配置入口，其底层权威存储为 `negentropy.memory_automation_configs`。

“保存并同步”的效果如下：

- 始终保存当前配置快照。
- 始终按当前 effective config 重新生成受管函数定义。
- 仅在 `pg_cron` 可用时重建 `cleanup_memories` 与 `trigger_consolidation`。

建议：

- 修改 `Context Assembler` 参数后，优先在 `Functions` 面板核对 `get_context_window()` 是否已更新。
- 修改调度参数后，优先在 `Managed Jobs.command` 中核对命令是否与当前配置一致。

### 11.2 Managed Jobs

`Managed Jobs` 只管理两个预定义 job key：

- `cleanup_memories`
- `trigger_consolidation`

按钮行为如下：

- `启用/停用`：切换 enabled 配置，并尝试同步数据库中的 cron 任务。
- `重建`：按当前 effective config 重新生成 schedule 与 command。
- `手动触发`：立即执行当前 job 对应 SQL，不等待 cron。

状态语义：

- `scheduled`：数据库中的 job 与当前期望一致。
- `disabled`：当前配置未启用该 job。
- `missing`：当前配置要求启用，但数据库中未找到对应 job。
- `drifted`：数据库中的 schedule 或 command 与当前配置不一致。
- `degraded`：`pg_cron` 不可访问，页面只能展示期望态。

### 11.3 Functions

`Functions` 面板只展示受管函数，而不是数据库中的全部函数。

状态语义：

- `present`：数据库函数定义与当前 effective config 生成的期望 SQL 一致。
- `missing`：数据库中未找到该函数。
- `drifted`：数据库中的函数定义与当前配置期望不一致。

建议把这里作为“配置是否真正下沉到 PostgreSQL”的最终核验面。

### 11.4 Recent Logs

`Recent Logs` 的数据源是 `cron.job_run_details`。

需要注意：

- 日志为空不必然表示没有任务运行。
- 首次配置后为空属于正常现象。
- 如果 `pg_cron` 未安装，或日志表不可访问，页面会返回空列表并给出降级原因。
- 日志更适合用于核对最近一次执行结果，不应视为长期审计存储。

## 12. PostgreSQL 操作示例

以下 SQL 主要用于验证与排障；日常初始化优先通过 Automation 控制面执行。

### 12.1 检查扩展

```sql
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('vector', 'pg_cron');
```

### 12.2 检查受管函数

```sql
SELECT p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'negentropy'
  AND p.proname IN (
    'calculate_retention_score',
    'cleanup_low_value_memories',
    'get_context_window',
    'trigger_maintenance_consolidation'
  )
ORDER BY p.proname;
```

### 12.3 检查受管任务

```sql
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname IN ('cleanup_memories', 'trigger_consolidation')
ORDER BY jobname;
```

### 12.4 查看最近日志

```sql
SELECT jobid, runid, status, return_message, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

### 12.5 手动验证受管过程

```sql
SELECT negentropy.cleanup_low_value_memories(0.1, 7, 0.1);
SELECT negentropy.trigger_maintenance_consolidation('1 hour'::interval);
```

说明：

- 手动执行适合验证函数本身是否可用，不替代 `Managed Jobs` 的长期调度。
- `get_context_window()` 依赖向量参数与业务上下文，通常应通过服务侧检索路径验证，而不是手工拼接 SQL。

## 13. 降级矩阵与排障

| 场景 | 配置查看 | 函数状态 | 调度任务查看 | 调度动作 | 执行日志 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| `pg_cron` 已安装且可访问 | 可用 | 可用 | 可用 | 可用 | 可用 |
| `pg_cron` 未安装 | 可用 | 可用 | 降级 | 只读禁用 | 空列表 |
| `pg_cron` 已安装但 `cron.job` 不可访问 | 可用 | 可用 | 降级 | 只读禁用 | 降级 |
| `pg_cron` 已安装但 `cron.job_run_details` 不可访问 | 可用 | 可用 | 可用 | 可用 | 空列表 + 降级告警 |

说明：

- “降级”表示 snapshot 仍然返回，但 `health.status` 为 `degraded`，并在 `degraded_reasons` 中给出原因。
- 调度相关动作包括 `enable / disable / reconcile / run`，在调度能力不可用时统一进入只读。

常见排障建议：

- `pg_cron_not_installed`
  - 执行 `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
  - 若未安装，页面仍可使用配置与函数控制面，但调度保持只读。
- `pg_cron_unavailable`
  - 优先检查应用连接用户是否可访问 `cron.job`。
  - 若扩展已安装但权限不足，`Managed Jobs` 会显示降级态。
- `pg_cron_logs_unavailable`
  - 检查 `cron.job_run_details` 是否存在且可读。
  - Recent Logs 为空时，不应直接判定调度未执行。
- `function_drifted`
  - 优先执行一次“保存并同步”，让后端按当前配置重建受管函数。
- `job_drifted`
  - 对照 `Managed Jobs.command` 与 `cron.job.command`，确认 schedule 与参数是否被外部改动。

## 14. 实施记录

- 新增 Memory Automation service，封装配置持久化、函数 reconcile、`pg_cron` 任务管理与日志读取。
- 新增 `memory_automation_configs` 表，保存后端托管配置。
- 新增 `/memory/automation` 页面与 API 代理，管理员可对白盒化过程执行受控运维动作。
- 将 `/memory` 现有 `policies` 摘要改为从 automation 配置派生，避免双源。

## 15. 验证清单

- Memory 主导航出现 `Automation` 二级入口。
- 管理员可查看配置、函数、任务与日志。
- 保存配置后自动 reconcile 预定义函数，并在调度可用时同步 reconcile 预定义任务。
- `pg_cron` 未安装或不可访问时页面进入降级只读态，但配置与函数状态仍可查看。
- 现有 Dashboard / Timeline / Facts / Audit 行为不回归。

## 16. 相关文档

- Memory 与 Knowledge 的职责边界：[`knowledges.md`](./knowledges.md)
- 仿生记忆 DDL 原型：[`schema/hippocampus_schema.sql`](./schema/hippocampus_schema.sql)

## 参考文献

<a id="ref1"></a>[1] H. Ebbinghaus, "Memory: A Contribution to Experimental Psychology," _Teachers College, Columbia University_, 1885/1913.

<a id="ref2"></a>[2] Google, "Memory: Long-Term Knowledge with MemoryService," _Agent Development Kit Documentation_, 2026. [Online]. Available: https://google.github.io/adk-docs/sessions/memory/

<a id="ref3"></a>[3] LangChain, "Memory," _LangGraph Documentation_, 2026. [Online]. Available: https://langchain-ai.github.io/langgraph/concepts/memory/

<a id="ref4"></a>[4] Citus Data, "pg_cron," _GitHub README_, 2026. [Online]. Available: https://github.com/citusdata/pg_cron

<a id="ref5"></a>[5] ThreeFish-AI, "The Hippocampus," _agentic-ai-cognizes_, 2026. [Online]. Available: https://github.com/ThreeFish-AI/agentic-ai-cognizes/blob/09e3e9e3a51e26e96796b8ea15228325d45ecc05/docs/engine/020-the-hippocampus.md
