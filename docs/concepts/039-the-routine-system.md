# The Routine System：长周期自主任务架构设计

> 「持续自迭代自主决策任务执行」的全生命周期支持。Negentropy Engine 担任 **Orchestrator + Evaluator**，Claude Code 担任 **Executor**，构成 Evaluator-Optimizer 闭环（结合 Reflexion 跨迭代反思记忆）。
>
> - 理论与工程调研：[Routine Agent 迭代模式调研](../research/110-routine-agent-iteration.md)
> - Claude Code 接入：[Claude Code 集成设计](./038-claude-code-integration.md)
> - 心跳调度引擎：[Framework](./framework.md)

---

## 1. 设计动机

单次 Agent 调用在长周期任务上存在结构性缺陷：无法根据中间产出自我纠偏、缺乏跨轮次的失败记忆、没有客观的完成度判定与预算护栏。Routine 把这一空白补齐为一个**闭环控制系统**：

1. 用户提交一个长任务（目标 + 验收标准 + 预算）；
2. Engine 将目标派发给 Claude Code 执行，记录阶段性结果（摘要 / session_id / 成本 / 轮数）；
3. Engine 用 **LLM-as-Judge + 可选命令门控** 评估结果，产出评分（0-100）、verdict 与自然语言反思；
4. Engine **自主决策**：继续迭代（再次调度 Claude Code，复用其 session 并注入累积反思）或终止（成功 / 不可恢复 / 预算耗尽）；
5. 如此反复，直至取得满意结果或触发终止信号。

**核心原则**：编排与执行职责分离——Engine 决策「做什么 / 是否继续」，Claude Code 决策「怎么做」；所有护栏在 Engine 代码层硬编码强制，不依赖模型自律。

## 2. 架构总览

```mermaid
flowchart TB
    subgraph UI["前端 negentropy-ui · Interface / Routine"]
        PAGE["RoutinePage<br/>列表 / 详情抽屉 / 创建表单"]
        SSE_C["useRoutineStream<br/>SSE 订阅"]
    end

    subgraph API["接口层 interface/routine_api.py"]
        REST["REST: CRUD + start/pause/resume/cancel<br/>+ approve/reject"]
        STREAM["GET /routines/stream (SSE)"]
    end

    subgraph SCHED["调度引擎 schedulers/registry.py"]
        TICK["routine_inspector ScheduledTask<br/>interval=25s 心跳"]
    end

    subgraph ENGINE["编排引擎 engine/routine/"]
        ORCH["RoutineOrchestrator.inspect_once()<br/>reap → evaluate → dispatch"]
        EVAL["RoutineEvaluator<br/>命令门控 + LLM-as-Judge"]
        DEC["decision.py<br/>纯函数守卫"]
        RUN["RoutineRunner<br/>后台 asyncio.Task + 信号量"]
        BUS["RoutineBus<br/>SSE 事件 fan-out"]
    end

    subgraph EXEC["执行层"]
        CC["ClaudeCodeService.invoke()<br/>SDK / CLI + resume_session_id"]
    end

    subgraph DB["PostgreSQL"]
        T1[("routines")]
        T2[("routine_iterations")]
    end

    PAGE -->|fetch| REST
    SSE_C -.->|EventSource| STREAM
    REST --> T1
    REST --> T2
    TICK --> ORCH
    ORCH --> DEC
    ORCH --> EVAL
    ORCH --> RUN
    RUN --> CC
    ORCH --> BUS
    RUN --> BUS
    BUS -.-> STREAM
    ORCH --> T1
    ORCH --> T2
    RUN --> T2

    classDef ui fill:#1e3a5f,stroke:#4a9eff,color:#e0f0ff
    classDef api fill:#3d2f5c,stroke:#a87fff,color:#f0e8ff
    classDef sched fill:#5c4a1e,stroke:#ffc857,color:#fff5e0
    classDef engine fill:#1e4d3a,stroke:#4ade80,color:#e0ffe8
    classDef exec fill:#5c1e2e,stroke:#ff6b81,color:#ffe0e8
    classDef db fill:#2d2d3d,stroke:#8888aa,color:#e0e0f0
    class PAGE,SSE_C ui
    class REST,STREAM api
    class TICK sched
    class ORCH,EVAL,DEC,RUN,BUS engine
    class CC exec
    class T1,T2 db
```

**关键架构决策：心跳 Inspector + 后台 Runner**。Routine 不为每个任务起一个独立调度任务，而是用**单个** `routine_inspector` 心跳任务（复用统一调度引擎）周期性调用 `inspect_once()`；`inspect_once()` 只做轻量决策（DB 读写 + 后台任务调度），真正长耗时的 Claude Code 执行交由进程内 `asyncio.Task` 后台 Runner 异步完成。这样心跳 tick 始终远低于其超时阈值，且评估—决策—执行三阶段得以解耦。

> **否决方案**：「每 Routine 一个 backing ScheduledTask」。原因：① 调度引擎默认 lease（120s）短于 Claude Code 执行时长（可达 300s+），会导致重复派发；② Execute+Evaluate+Decide 三阶段无法优雅塞入单次 handler；③ Routine 是事件驱动（评估完立即再派发），非 wall-clock 定时。

## 3. 数据模型

```mermaid
erDiagram
    routines ||--o{ routine_iterations : "1:N (CASCADE)"

    routines {
        uuid id PK
        string key UK
        string title
        text goal
        text acceptance_criteria
        text cwd
        text verification_command
        string status "pending|running|paused|succeeded|failed|cancelled"
        string termination_reason
        int max_iterations
        float max_cost_usd
        timestamptz deadline_at
        int success_score_threshold
        int no_progress_patience
        string approval_mode "auto|first|every"
        int iteration_count "反规范化"
        float total_cost_usd "反规范化"
        int best_score
        int last_score
        string claude_session_id "session 续接"
        jsonb reflections "Reflexion 记忆 {items:[]}"
        jsonb config "Claude Code 配置覆盖"
    }

    routine_iterations {
        uuid id PK
        uuid routine_id FK
        int seq "UNIQUE(routine_id,seq)"
        string status "dispatched|in_flight|executed|evaluated|..."
        text prompt
        string resume_session_id
        string exec_status "success|error|timeout"
        text summary
        string claude_session_id
        float cost_usd
        int turn_count
        int score "0-100"
        string verdict "pass|progressing|stalled|regressed|unrecoverable"
        text reflection "评估器反馈"
        int gate_exit_code "命令门控退出码"
        timestamptz lease_expires_at "崩溃恢复租约"
        jsonb metrics
    }
```

- **`routines`**：长周期任务注册源。`reflections` JSONB 存累积反思（Reflexion episodic memory）；`config` 存 Claude Code 配置覆盖（model / max_turns / allowed_tools 等）；`iteration_count` / `total_cost_usd` / `best_score` 反规范化以加速守卫判定。
- **`routine_iterations`**：单次 Execute→Evaluate→Decide 周期的 append-mostly 事实表。`lease_expires_at` 为后台 Runner 的崩溃恢复租约；`UNIQUE(routine_id, seq)` 为并发派发的硬幂等兜底。

模型定义：[`models/routine.py`](../../apps/negentropy/src/negentropy/models/routine.py)；建表与种子迁移：[`0048_routine_tables.py`](../../apps/negentropy/src/negentropy/db/migrations/versions/0048_routine_tables.py)。

## 4. 生命周期状态机

### 4.1 Routine 状态机

```mermaid
stateDiagram-v2
    [*] --> pending: 创建
    pending --> running: start()
    pending --> cancelled: cancel()
    running --> paused: pause() + 中止在途迭代
    paused --> running: resume()
    paused --> cancelled: cancel()
    running --> succeeded: 评分≥阈值且门控通过
    running --> failed: 守卫触发(预算/停滞/振荡/不可恢复)
    running --> cancelled: cancel()
    succeeded --> [*]
    failed --> [*]
    cancelled --> [*]
```

### 4.2 迭代状态机（含审批门控）

```mermaid
stateDiagram-v2
    [*] --> pending_approval: approval_mode≠auto
    [*] --> dispatched: approval_mode=auto
    pending_approval --> dispatched: 用户 approve
    pending_approval --> aborted: 用户 reject
    dispatched --> in_flight: Runner 拾取
    in_flight --> executed: Claude Code 返回
    in_flight --> reaped: lease 过期(崩溃)
    in_flight --> aborted: 用户 cancel
    executed --> evaluated: 评估器评分
    evaluated --> [*]
    reaped --> [*]
    aborted --> [*]
```

**Human-in-the-Loop**：`approval_mode` 决定迭代初始状态——`auto` 全自动（直接 `dispatched`）；`first` 仅首迭代需审批；`every` 每迭代需审批。`pending_approval` 的迭代不会被 Runner 拾取，等待 API `approve` 转 `dispatched` 后才执行。

## 5. 编排循环 `inspect_once()`

每次心跳 tick 执行三阶段（顺序：先回收、再评估、后派发）：

```mermaid
sequenceDiagram
    participant Tick as routine_inspector 心跳
    participant Orch as RoutineOrchestrator
    participant Eval as RoutineEvaluator
    participant Dec as decision.py
    participant Run as RoutineRunner
    participant CC as ClaudeCodeService
    participant DB as PostgreSQL

    Tick->>Orch: inspect_once()

    Note over Orch,DB: (a) REAP 回收孤儿
    Orch->>DB: 查 in_flight 且 lease 过期
    Orch->>DB: 本进程不持有 → 标记 reaped

    Note over Orch,Dec: (b) EVALUATE + DECIDE
    Orch->>DB: 查最新迭代=executed 的 routine
    Orch->>Eval: evaluate(routine, iteration)
    Eval->>Eval: 命令门控(可选) + LLM-as-Judge
    Eval-->>Orch: score / verdict / reflection
    Orch->>DB: 写评估结果 + 追加反思
    Orch->>Dec: decide(routine, latest, history)
    Dec-->>Orch: continue | terminate(reason)
    alt terminate
        Orch->>DB: 置终态 + termination_reason
    end

    Note over Orch,CC: (c) DISPATCH 派发下一迭代
    Orch->>DB: 查 running 且无在途迭代(FOR UPDATE SKIP LOCKED)
    Orch->>Dec: pre_dispatch_check(预算/截止)
    Orch->>DB: 创建迭代(dispatched 或 pending_approval)
    Orch->>Run: launch(非阻塞)
    Run->>CC: invoke(prompt, config, abort_event)
    CC-->>Run: ClaudeCodeResult
    Run->>DB: 写回结果 + 更新 routine 累计
```

模块布局（[`engine/routine/`](../../apps/negentropy/src/negentropy/engine/routine/)）：

| 模块 | 职责 |
|------|------|
| `orchestrator.py` | `inspect_once()` 主控制循环（reap / evaluate / dispatch） |
| `runner.py` | 进程内后台执行器注册表 + 全局并发信号量；非阻塞调用 ClaudeCodeService |
| `evaluator.py` | LLM-as-Judge + 命令门控，产出 score / verdict / reflection |
| `decision.py` | 纯函数守卫与决策（可单元测试，无 IO） |
| `prompt_builder.py` | 构建含目标 + 验收标准 + 累积反思的 prompt（Reflexion 注入） |
| `bus.py` | RoutineBus，SSE 事件 fan-out |

## 6. 评估管线：混合方案

评估采用 **LLM-as-Judge + 可选命令门控** 的混合方案：

1. **命令门控**（若配置 `verification_command`）：在 routine 工作目录执行测试命令，退出码喂给 Judge prompt 并作为成功的硬约束——门控失败时评分封顶，成功的判定要求 `gate_exit_code == 0`。这是 Codex 式「测试驱动自校验」的客观锚点。
2. **LLM-as-Judge**：复用 `LLMFactExtractor` 的 LLM 调用范式（`resolve_model_config_async("routine.evaluate")` + `litellm.acompletion` 结构化 JSON 输出 + 指数退避重试），`temperature=0` 保证确定性，输出 `{score, verdict, reflection}`。

**偏差治理**：客观门控锚定评分以缓解 LLM 评审的 verbosity / self-preference 偏差；score 与 verdict 解耦，使停滞检测在绝对分数漂移时仍可依趋势判定。详见[调研 §3](../research/110-routine-agent-iteration.md)。

## 7. 停止准则与护栏

全部在 `decision.py` 中以**纯函数**实现，硬编码强制（非模型自律）：

| 守卫 | 触发条件 | termination_reason |
|------|---------|--------------------|
| 成功 | `score ≥ success_score_threshold` 且门控通过 | `success` |
| 迭代上限 | `iteration_count ≥ max_iterations` | `max_iterations` |
| 成本熔断 | `total_cost_usd ≥ max_cost_usd` | `max_cost` |
| 截止时间 | `now ≥ deadline_at` | `deadline` |
| 进度停滞 | 最近 N 次评分均未超历史最优 | `no_progress` |
| 振荡 | 评分无净增长且 verdict 反复横跳 | `oscillation` |
| 不可恢复 | judge 判 unrecoverable / 连续执行失败 / 连续评估失败 | `unrecoverable_error` |

**崩溃恢复**：进程内 Runner 非崩溃安全，由 Reaper 兜底——迭代携带 `lease_expires_at`（= 执行超时 + slack），进程重启后孤儿在途迭代被标记 `reaped`，下一 tick 重新派发并复用 `claude_session_id` 续接。

## 8. 配置

配置源：[`config/routine.py`](../../apps/negentropy/src/negentropy/config/routine.py)（`RoutineSettings`，env 前缀 `NE_ROUTINE_`，YAML 节点 `routine:`，默认值见 `config.default.yaml`）。

| 配置项 | 默认 | 说明 |
|--------|------|------|
| `enabled` | `false` | 灰度开关；关闭时心跳 no-op |
| `inspector_interval_seconds` | `25` | 心跳 tick 间隔 |
| `max_concurrent_executions` | `2` | 全局并发 Claude Code 执行上限 |
| `lease_slack_seconds` | `60` | Runner 租约宽裕量 |
| `gate_timeout_seconds` | `120` | 命令门控执行超时 |
| `max_reflections_injected` | `5` | 注入 prompt 的最近反思条数 |
| `eval_failure_patience` | `3` | 评估连续失败容忍次数 |
| `default_max_iterations` | `20` | 创建默认迭代上限 |
| `default_max_cost_usd` | `5.0` | 创建默认成本熔断 |
| `evaluator_model` | `null` | 评估器模型覆盖（走 `routine.evaluate` task slot 解析） |

评估器模型可在 Interface / Task Models 页为 `routine.evaluate` 槽位单独绑定。

## 9. API 与前端

REST 端点（[`interface/routine_api.py`](../../apps/negentropy/src/negentropy/interface/routine_api.py)，prefix `/routines`）：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/routines` · `/routines/{id}` · `/routines/{id}/iterations` · `/routines/kpis` | 查询 |
| POST | `/routines` · PUT/DELETE `/routines/{id}` | CRUD |
| POST | `/routines/{id}/{start\|pause\|resume\|cancel}` | 控制 |
| POST | `/routines/{id}/iterations/{iid}/{approve\|reject}` | 审批门控 |
| GET | `/routines/stream` | SSE 实时事件（routine + iteration） |

前端位于 [`app/interface/routine/`](../../apps/negentropy-ui/app/interface/routine/)：列表 + KPI + 过滤 + 创建/编辑表单 + 详情抽屉（迭代时间线 + 评分趋势 + 控制按钮 + 审批操作）。导航在 `InterfaceNav.tsx` 的 Scheduler 之后新增 Routine 二级菜单。SSE 实时更新经 `useRoutineStream` 订阅 `/api/routine/stream`。

## 10. 涟漪效应与边界

- **对调度引擎**：仅新增一个种子 ScheduledTask（`routine_inspector`），复用既有心跳与 SSE 范式，零侵入。
- **对 Claude Code**：仅作为 `ClaudeCodeService.invoke()` 的调用方，复用既有 SDK/CLI 双路径与 `resume_session_id` 能力。
- **单进程假设**：进程内 Runner 注册表要求单 engine 进程持有 Routine 编排（与调度引擎同进程同 loop）。DB 层 `FOR UPDATE SKIP LOCKED` + 每 routine 单在途 + 唯一约束为多并发 tick 的硬幂等兜底。
- **灰度**：`routine.enabled=false` 默认关闭，对现有功能零影响。
