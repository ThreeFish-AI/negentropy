# 数据库迁移 (Database Migrations)

**数据库迁移**是系统数据架构演进的版本控制机制。本项目采用 [Alembic](https://alembic.sqlalchemy.org/en/latest/) 确保数据库 Schema 能够随同领域模型（Models）有序迭代，保障系统熵减过程中的数据一致性与完整性。

- **唯一信源 (Source of Truth)**：[`src/negentropy/models/`](../apps/negentropy/src/negentropy/models/) 中的领域模型定义。
- **演进机制 (Mechanism)**：Alembic 负责捕捉信源变更并生成版本化的迁移脚本。
- **脚本位置**：[`apps/negentropy/src/negentropy/db/migrations/`](../apps/negentropy/src/negentropy/db/migrations/)

## Schema 分离策略 (Schema Isolation)

为避免业务表与 ADK 原生表冲突（如 `sessions`、`events`、`app_states`、`user_states`），系统采用 PostgreSQL **Schema 隔离**策略：

| Schema       | 归属     | 说明                                               |
| ------------ | -------- | -------------------------------------------------- |
| `negentropy` | 业务模型 | `src/negentropy/models/` 下所有表，由 Alembic 管理 |
| `public`     | ADK 原生 | `DatabaseSessionService` 自动创建的会话/事件表     |

> [!NOTE]
>
> Schema 名称由 [`NEGENTROPY_SCHEMA`](../apps/negentropy/src/negentropy/models/base.py) 常量定义。Alembic 迁移时会自动创建此 Schema。

## 环境准备 (Prerequisites)

为了维护系统的完整性，所有迁移操作必须严格在 **应用根目录** (`apps/negentropy`) 下执行。

1. **环境一致性**：同步开发依赖，确保本地环境与 `pyproject.toml` 定义的信源一致。
   ```bash
   cd apps/negentropy
   uv sync --dev
   ```
2. **基础设施**：确保 PostgreSQL 服务处于运行状态，且连接配置（`database_url`）已在 `.env` 或 `src/negentropy/config.py` 中正确加载。

## 基础设施元定义 (Infrastructure Meta-Definition)

### 1. 演进模板 (Evolution Template)

- **实现**：[`script.py.mako`](../apps/negentropy/src/negentropy/db/migrations/script.py.mako)
- **作用**：生成新迁移脚本的**蓝图**。定义所有演进步骤的标准代码结构。
- **用法**：当需要为所有未来的迁移脚本引入通用依赖（例如自定义的 `Vector` 类型）或统一代码风格时，应修改此文件。它是确保迁移脚本结构一致性的**元定义**。

### 2. 全局配置 (Global Configuration)

- **实现**：[`alembic.ini`](../apps/negentropy/alembic.ini)
- **作用**：Alembic CLI 的**入口配置**。定义：
  1. `script_location`: 迁移脚本目录路径。
  2. `sqlalchemy.url`: 默认数据库连接字符串（可被 `env.py` 覆盖）。
  3. `timezone`: 迁移文件时间戳的时区（默认 `UTC`）。
  4. 日志配置。
- **用法**：当需要调整迁移脚本存放位置、修改默认连接字符串或自定义日志行为时，修改此文件。

### 3. 运行时上下文 (Runtime Context)

- **实现**：[`env.py`](../apps/negentropy/src/negentropy/db/migrations/env.py)
- **作用**：运行迁移时的**环境上下文**。负责：
  1. 加载所有领域模型以初始化 `Base.metadata`（信源）。
  2. 从 `negentropy.config.settings` 读取数据库连接配置，确保连接与应用程序一致。
  3. 无缝衔接异步 SQLAlchemy 引擎（`asyncpg`），让迁移以异步方式运行。
- **用法**：多数情况下无需修改。当模型包结构变更或连接方式需调整时，才修改此文件。

## pgvector (vector 类型) 的 Alembic 识别

当数据库启用了 `pgvector`，且模型中使用 `Vector` 类型时，Alembic autogenerate 可能在反射阶段报出 “unknown type 'vector' / Couldn't determine database type” 等告警。为避免**抑制告警**、同时确保**正常功能**，本项目在 [`env.py`](../apps/negentropy/src/negentropy/db/migrations/env.py) 中注册了 `vector` 的反射映射，并在 `compare_type` 中对 `Vector` 做等价比较，从源头消除不必要的类型告警。

关键约束：

- **不屏蔽告警**：保留 Alembic 的正常提示机制，仅让 `vector` 类型能够被正确识别。
- **不改变运行时逻辑**：只影响 Alembic 反射与比对行为，不影响应用读写。

## 演进工作流 (Workflow)

### 1. 捕捉变更 (Capture)

当 `src/negentropy/models/` 中的领域模型发生变更时，需生成对应的迁移脚本以捕捉状态差异。

```bash
uv run alembic revision --autogenerate -m "描述变更内容"
```

> **关键步骤**：自动生成的脚本位于 `src/negentropy/db/migrations/versions/`。**务必人工审查生成的 Python 脚本**，确保其精准反映了模型变更意图，且不包含意外的破坏性操作（如删除表）。

### 2. 应用变更 (Apply)

确认脚本无误后，执行迁移将数据库状态推进至最新版本（Head）。

```bash
uv run alembic upgrade head
```

### 3. 版本回溯 (Rollback)

在验证失败或需要调试时，可有序回退数据库状态。

- **回退至上一版本**：
  ```bash
  uv run alembic downgrade -1
  ```
- **重置至初始状态**：
  ```bash
  uv run alembic downgrade base
  ```

## 状态观测与审计 (Observability & Audit)

保持对数据库架构状态的清晰认知，是系统稳定运行的基础。

### 1. 状态一致性检查

确认当前数据库实例所处的版本位置，确保其与代码库中的 `head` 版本一致。

```bash
uv run alembic current
```

### 2. 演进历史审计

追溯架构的演进路线，审查迁移历史以确保变更的连续性。

```bash
uv run alembic history
```
