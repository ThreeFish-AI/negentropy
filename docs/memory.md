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

## 5. 一期接口

- `GET /memory/automation`
- `GET /memory/automation/logs`
- `POST /memory/automation/config`
- `POST /memory/automation/jobs/{job_key}/enable`
- `POST /memory/automation/jobs/{job_key}/disable`
- `POST /memory/automation/jobs/{job_key}/reconcile`
- `POST /memory/automation/jobs/{job_key}/run`

## 6. 实施记录

- 新增 Memory Automation service，封装配置持久化、函数 reconcile、`pg_cron` 任务管理与日志读取。
- 新增 `memory_automation_configs` 表，保存后端托管配置。
- 新增 `/memory/automation` 页面与 API 代理，管理员可对白盒化过程执行受控运维动作。
- 将 `/memory` 现有 `policies` 摘要改为从 automation 配置派生，避免双源。

## 7. 验证清单

- Memory 主导航出现 `Automation` 二级入口。
- 管理员可查看配置、函数、任务与日志。
- 保存配置后自动 reconcile 预定义函数与任务。
- `pg_cron` 未安装时页面进入降级只读态。
- 现有 Dashboard / Timeline / Facts / Audit 行为不回归。

## 参考文献

<a id="ref1"></a>[1] H. Ebbinghaus, "Memory: A Contribution to Experimental Psychology," _Teachers College, Columbia University_, 1885/1913.

<a id="ref2"></a>[2] Google, "Memory: Long-Term Knowledge with MemoryService," _Agent Development Kit Documentation_, 2026. [Online]. Available: https://google.github.io/adk-docs/sessions/memory/

<a id="ref3"></a>[3] Citus Data, "pg_cron," _GitHub README_, 2026. [Online]. Available: https://github.com/citusdata/pg_cron
