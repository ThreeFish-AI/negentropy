# 执行阶段一：基座部署与 Unified Schema 设计 (Foundation)

本文档作为 **Phase 1** 的详细操作指引，涵盖 **OceanBase V4.5.0+** 在 GCP Compute Engine VM 上的 Docker 部署、向量能力验证以及 "Unified Memory Bank" 的 Schema 设计。此类设计参考了 Google Agent Builder 的 Memory Bank 模式，旨在实现 Structured Log (Short-term) 与 Semantic Episodic Memory (Long-term) 的统一存储。

## 1. 任务 1.1: 部署与环境准备

**环境**：Google Cloud Platform (GCP) Compute Engine VM Instance.
**目标**：在 GCP VM 实例上通过 Docker 拉起 OceanBase (SeekDB) 单机版，并确认 Vector 能力可用。

### 1.1.0 连接 VM 并准备环境

所有后续指令请在 VM 的 SSH 终端中执行。

**1. SSH 登录 VM**
参考官方文档：[Connect to Linux instances](https://docs.cloud.google.com/compute/docs/instances/ssh)

```bash
# 本地终端示例 (需安装 gcloud SDK):
# gcloud compute ssh --zone "YOUR_ZONE" "YOUR_INSTANCE_NAME" --project "YOUR_PROJECT_ID"
```

**2. 安装 Docker 与 MySQL Client (如未安装)**
大多数标准 Linux 镜像 (Ubuntu/Debian) 需要手动安装：

```bash
# 1. 安装 Docker
sudo apt-get update
sudo apt-get install -y docker.io
# 启动并授权当前用户 (避免 sudo)
sudo systemctl start docker
sudo usermod -aG docker $USER
newgrp docker

# 2. 安装 MySQL 客户端 (用于连接 OceanBase)
sudo apt-get install -y default-mysql-client
```

### 1.1.1 部署 OceanBase V4.5.0 (Docker)

官方推荐使用 `oceanbase/oceanbase-ce` 镜像。根据 V4.5.0 Release Note，向量能力已默认集成。在 VM 上执行：

```bash
# 1. 拉取最新社区版镜像 (必须确认 tag 为 4.5.0 或更新)
# 注意: 'latest' 标签可能仍指向 stable 4.3.x 版本，需手动查找最新 tag.
# 请访问 DockerHub 或 ghcr.io 查询 `oceanbase/oceanbase-ce` 的 4.5.0+ tag
docker pull oceanbase/oceanbase-ce:4.5.0.0-100000012025112711


# 2. 启动容器 (Mini 模式，适合本地开发验证)
# 注意：向量索引构建需要一定的内存，建议至少分配 8GB+ RAM 给容器
docker run -p 2881:2881 -p 8080:8080 --name ob-agent-engine \
    -e FULL_DRY_RUN=false \
    -e MODE=mini \
    -e OB_MEMORY_LIMIT=8G \
    -e OB_DATAFILE_SIZE=10G \
    -d oceanbase/oceanbase-ce:4.5.0.0-100000012025112711

# 3. 检查启动状态
docker logs -f ob-agent-engine | grep "boot success!"
```

OceanBase 启动后，默认会有 `sys` 租户。我们需要创建一个业务租户来测试 Vector 功能。可以通过宿主机的 `mysql` 客户端或容器内的 `obclient` 进行连接。

> [!NOTE]
>
> OceanBase V4.5.0 引入了原生向量类型 `VECTOR` 和 HNSW 索引，无需额外插件。确保租户内存资源充足（建议 2G+）以支持向量索引构建。

```bash
# 在 VM 终端连接 OceanBase (默认为 sys 租户, 无密码)
mysql -h127.0.0.1 -P2881 -uroot

# 或者使用 Docker 内置客户端 (无需在宿主机安装 mysql-client):
docker exec -it ob-agent-engine obclient -h127.0.0.1 -P2881 -uroot
```

```sql
-- 1. 确认版本 (必须 >= 4.5.0)
-- ⚠️ 如果 SELECT version() 返回类似 4.3.x.x, 请更换 image
SELECT version();

-- 重置环境:
-- 1. 清理默认的 'test' 租户及其资源池 (test 租户可能已删但 pool 仍在占用 13 核 CPU)
DROP TENANT IF EXISTS test;
DROP RESOURCE POOL IF EXISTS test_pool;
DROP RESOURCE UNIT IF EXISTS test_unit;

-- 2. 清理 agent 相关旧数据
DROP TENANT IF EXISTS agent_tenant;
DROP RESOURCE POOL IF EXISTS agent_pool;
DROP RESOURCE UNIT IF EXISTS agent_unit;

-- 检查当前服务器资源状态 (排查 CPU/MEM/DISK 不足)
SELECT SVR_IP, CPU_CAPACITY, CPU_ASSIGNED, MEMORY_LIMIT, MEM_ASSIGNED, LOG_DISK_CAPACITY, LOG_DISK_ASSIGNED
FROM oceanbase.GV$OB_SERVERS;

-- 2. 创建一个支持向量的业务单元 (Unit) 和 资源池 (Resource Pool)
-- 修正:
--  a. 针对 Mini 模式 CPU 不足: 使用 MAX_CPU 1 (或 0.5)
--  b. 针对 MEMORY_SIZE 小于最小限制: 使用 2G
--  c. 针对 LOG_DISK 不足: 显式指定 2G (默认值可能不够)
CREATE RESOURCE UNIT agent_unit MAX_CPU 1, MIN_CPU 1, MEMORY_SIZE '2G', LOG_DISK_SIZE '2G';
CREATE RESOURCE POOL agent_pool UNIT = 'agent_unit', UNIT_NUM = 1;

-- 验证资源池是否创建成功
SELECT name, unit_count FROM oceanbase.DBA_OB_RESOURCE_POOLS WHERE name = 'agent_pool';

-- 3. 创建业务租户 (Tenant)
-- 注意：OceanBase 租户模式通常为 MySQL 模式
CREATE TENANT agent_tenant
    RESOURCE_POOL_LIST=('agent_pool'),
    CHARSET='utf8mb4',
    Locality='F@zone1';

-- 4. 配置访问白名单 (重要: 解决 Access denied 问题)
-- Docker 容器内这步是必须的，否则宿主机连接会被拒绝
ALTER TENANT agent_tenant SET VARIABLES ob_tcp_invited_nodes='%';
```

```bash
# 5. 登录业务租户 (格式: 用户名@租户名)
# 退出当前 sys 租户会话，重新连接:
mysql -h127.0.0.1 -P2881 -uroot@agent_tenant
# 或: docker exec -it ob-agent-engine obclient -h127.0.0.1 -P2881 -uroot@agent_tenant
```

### 1.1.4 通过 IntelliJ IDEA 连接 (本地开发推荐)

对于日常开发，建议使用 IntelliJ IDEA 的 Database 面板通过 **SSH Tunnel** 直接连接 VM 上的 OceanBase。

**配置步骤：**

1.  **新建数据源**：`Database` 面板 -> `+` -> `Data Source` -> `MySQL`。
2.  **General (常规) 设置**：
    - **Host**: `127.0.0.1` (注意：由于使用 SSH 隧道，这里填 VM 本地的回环地址)。
    - **Port**: `2881`。
    - **User**: `root@agent_tenant` (格式为 `用户名@租户名`)。
    - **Password**: (留空，除非您手动设置过密码)。
    - **Database**: `agent_db` (或您创建的数据库名)。
3.  **SSH/SSL 设置**：
    - 勾选 **Use SSH tunnel**。
    - **Proxy host**: GCP VM 的公网 IP。
    - **Port**: `22`。
    - **Proxy user**: 您的 SSH 用户名 (GCP 登录名)。
    - **Authentication**: 选择密钥文件 (`Key pair`)，通常在 `~/.ssh/google_compute_engine`。
4.  **驱动检查**：
    - IDEA 会提示下载 MySQL Connector/J 驱动，点击下载即可。
    - **进阶提示**：如果需要更强的兼容性，可在 `Drivers` 中搜索并使用 OceanBase 专用驱动 (支持更多 OB 特有语法提示)，但标准 MySQL 驱动已足够支持 Vector 相关的 SQL 操作。
5.  **测试连接**：点击 `Test Connection`。成功后即可像操作本地 MySQL 一样管理 OceanBase 及其向量数据。

> [!IMPORTANT]
>
> **关于 `CREATE` 失败的常见错误排查**:
>
> 1. `ERROR 4733 ... CPU resource not enough`:
>    - 原因: 资源被其他租户 (默认的 `test` 或 `sys`) 占满。
>    - 解决: 务必执行 `DROP TENANT IF EXISTS test;` 释放资源。
> 2. `ERROR 1235 ... unit MEMORY_SIZE less than __min_full_resource_pool_memory`:
>    - 原因: Resource Pool 最小内存限制 (通常 1G-5G)。
>    - 解决: `MEMORY_SIZE` 至少设为 '2G'。
> 3. `ERROR 4659 ... invalid MAX_CPU value`:
>    - 原因: `MAX_CPU` 必须 >= 1 (旧版本或特定配置限制)。
>    - 解决: 设置 `MAX_CPU 1` 并确保有足够剩余 CPU。
> 4. `ERROR 4733 ... LOG_DISK resource not enough`:
>    - 原因: Mini 模式下 Log Disk 通常仅 5G，Sys 租户占用了 ~2G，剩余不足以分配默认值。
>    - 解决: 在 `CREATE RESOURCE UNIT` 中显式添加 `LOG_DISK_SIZE '2G'`。
> 5. `ERROR 1210 ... zone name illegal`:
>    - 原因: `Locality` 中指定了不存在的 Zone (如 `F@1`)。
>    - 解决: 查询 `GV$OB_SERVERS` 确认 Zone 名 (通常为 `zone1`)。
> 6. `ERROR 1227 ... Access denied`:
>    - 原因: 租户默认白名单限制，容器网关 IP 未被允许。
>    - 解决: 执行 `ALTER TENANT ... SET VARIABLES ob_tcp_invited_nodes='%';`。

### 1.1.3 验证 Vector 能力

在 `agent_tenant` 下执行以下测试，确认向量类型和索引可用。

```sql
-- 0. 创建并选择数据库 (必选, 否则报错 'No database selected')
CREATE DATABASE IF NOT EXISTS agent_db;
USE agent_db;

-- 1. 创建测试表 (验证 VECTOR 类型)
CREATE TABLE vector_test (
    id INT PRIMARY KEY,
    embedding VECTOR(3) -- 3维向量
);

-- 2. 插入向量数据
INSERT INTO vector_test VALUES (1, '[0.1, 0.2, 0.3]');
INSERT INTO vector_test VALUES (2, '[0.4, 0.5, 0.6]');
INSERT INTO vector_test VALUES (3, '[0.7, 0.8, 0.9]');

-- 3. 验证 HNSW 索引创建
-- 语法修正: 使用 CREATE VECTOR INDEX 语法，l2 (欧氏距离) 由 OceanBase 自动定义
CREATE VECTOR INDEX idx_vector_hnsw ON vector_test(embedding)
    WITH (distance=l2, type=hnsw, lib=vsag);

-- 4. 验证向量距离查询
SELECT id, l2_distance(embedding, '[0.1, 0.2, 0.3]') as dist
FROM vector_test
ORDER BY dist ASC
LIMIT 3;

-- 5. 删除索引 (清理环境)
-- 使用 show index from vector_test; 查看当前索引
-- 注意: 部分 OB 版本不支持 IF EXISTS 语法，请直接执行 DROP
-- (清理我实验留下的索引: idx_test_3)
DROP INDEX idx_test_3 ON vector_test;
-- (清理您创建的索引: idx_vector_hnsw)
DROP INDEX idx_vector_hnsw ON vector_test;
```

## 2. 任务 1.2: "Unified Memory Bank" Schema 设计

**目标**：设计一套 "All-in-One" 的 Schema，涵盖 Short-term (Log), Episodic (Vector), Semantic (KV)。

### 2.1 Schema 概览 (Unified Memory Model)

我们将设计 3 张核心表：

1.  `memory_sessions`: 会话元数据 (Session Scope)。
2.  `memory_logs`: 即 Short-term Memory，高频写入的 Append-only 日志。
3.  `memory_artifacts`: 即 Long-term Memory (Episodic + Semantic)，存储提炼后的向量化记忆和实体知识。

### 2.2 DDL 实现 (`docs/schema-unified-memory.sql`)

```sql
/*
 * OceanBase Unified Schema for Agentic AI
 * Mode: MySQL compatible
 */

-- 1. 会话表 (管理 Context Window 的生命周期)
CREATE TABLE memory_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    agent_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    metadata JSON COMMENT '存储会话级别的配置，如 Model 参数、User Profile 快照'
);

-- 2. 会话日志表 (Short-term Memory / Raw Stream)
-- 特性:
--   - 极高频写入 (Append-only)
--   - 通常按 session_id + seq_id 检索
--   - 自动过期 (TTL) 可选 (Partition by Range)
CREATE TABLE memory_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    seq_id INT NOT NULL COMMENT '会话内的消息序号',
    role ENUM('system', 'user', 'assistant', 'tool') NOT NULL,
    content TEXT COMMENT '原始文本内容',
    embedding VECTOR(1536) COMMENT '可选: 这里的向量用于 Context Window 的即时检索 (Short-term RAG)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session_seq (session_id, seq_id)
);

-- 3. 记忆制品表 (Long-term: Episodic + Semantic)
-- 这是一张 "Memory Bank" 的核心宽表
-- 包含了 Vector (用于模糊语义检索) 和 JSON (用于精确事实检索)
CREATE TABLE memory_artifacts (
    artifact_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,

    -- Memory Type 分类
    --   'episodic': 对话片段的总结 (Experience)
    --   'semantic': 事实性知识 (Fact)，如 "User likes Python"
    --   'procedural': 技能 or Tool 使用偏好
    memory_type VARCHAR(32) NOT NULL,

    -- Content & Vector
    content TEXT NOT NULL COMMENT '记忆的具体文本描述',
    embedding VECTOR(1536) NOT NULL COMMENT 'Sematic Vector (e.g. OpenAI text-embedding-3-small)',

    -- Metadata (for Filter)
    source_session_id VARCHAR(64) COMMENT '来源会话 ID (Lineage)',
    importance_score FLOAT DEFAULT 0.5 COMMENT '记忆重要性，用于 Reflection 淘汰',
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tags JSON COMMENT '标签，如 ["preference", "coding"]',

    -- Indexing
    INDEX idx_user_type (user_id, memory_type)
);

-- 4. 创建向量索引 (分离创建以确保 V4.5.0 语法兼容性)
CREATE VECTOR INDEX idx_memory_vec ON memory_artifacts (embedding)
    WITH (distance=l2, type=hnsw, lib=vsag);
```

### 2.3 准备样本数据 (Data Mock)

为了验证上述 Schema 和向量索引，我们需要插入一些模拟数据。由于 1536 维向量过长，我们使用 SQL 函数生成 Mock 数据。

```sql
-- 1. 插入模拟 Session
INSERT INTO memory_sessions (session_id, user_id, agent_id, metadata) VALUES
('sess_001', 'user_001', 'agent_alpha', '{"mode": "dev"}'),
('sess_002', 'user_001', 'agent_alpha', '{"mode": "prod"}'),
('sess_003', 'user_001', 'agent_alpha', '{"mode": "test"}');

-- 2. 插入 Short-term Logs (模拟最近的对话)
INSERT INTO memory_logs (session_id, seq_id, role, content) VALUES
('sess_001', 1, 'user', 'How do I use Python list comprehensions?'),
('sess_001', 2, 'assistant', 'You can use [x for x in iterable].'),
('sess_001', 3, 'user', 'Can I filter items too?'),
-- JOIN 验证数据:
('sess_003', 1, 'user', 'My API key is sk-12345, please remember it.'),
('sess_003', 2, 'assistant', 'I will save that securely.');

-- 3. 插入 Long-term Artifacts (模拟记忆)
-- 注意: 使用 CONCAT 和 REPEAT 生成符合 1536 维定义的 Dummy Vector (此处仅为示例，实际应由 Embedding 模型生成)
INSERT INTO memory_artifacts (artifact_id, user_id, memory_type, content, tags, embedding, source_session_id) VALUES
('mem_001', 'user_001', 'semantic', 'User prefers concise code style.', '["preference", "coding"]',
 CONCAT('[', REPEAT('0.1,', 1535), '0.1]'), 'sess_001'),
('mem_002', 'user_001', 'episodic', 'User asked about Python list optimization in previous session.', '["python", "optimization"]',
 CONCAT('[', REPEAT('0.2,', 1535), '0.2]'), 'sess_001'),
-- JOIN 验证数据 (关联 sess_003):
('mem_abc_123', 'user_001', 'episodic', 'User provided API key.', '["security", "config"]',
 CONCAT('[', REPEAT('0.3,', 1535), '0.3]'), 'sess_003');
```

### 2.4 验证 SQL (Unified Retrieval)

验证是否能通过一条 SQL 完成混合检索，不需要 Application Layer 做 Join。

```sql
/*
 * 场景: User A 正在问 Python 相关问题
 * 需求:
 *   1. 检索 Long-term Memory 中关于 'coding' 的偏好 (Hybrid: Tag='coding' + Vector Search)
 *   2. 关联最近 5 分钟的 Short-term Logs (Session Context)
 * 预期:
 *   OceanBase 的执行计划应能高效处理 Vector Scan + Relational Access
 */

SELECT
    m.content AS memory_content,
    m.memory_type,
    -- 计算与 Query Vector (模拟为全 0.15) 的距离
    l2_distance(m.embedding, CONCAT('[', REPEAT('0.15,', 1535), '0.15]')) as relevance
FROM
    memory_artifacts m
WHERE
    m.user_id = 'user_001'
    -- 混合检索条件 1: Metadata Filter (JSON or Column)
    AND JSON_CONTAINS(m.tags, '"coding"')
    -- 混合检索条件 2: Vector Search
    AND l2_distance(m.embedding, CONCAT('[', REPEAT('0.15,', 1535), '0.15]')) < 5.0
ORDER BY
    relevance ASC
LIMIT 5;

-- 联合查询示例 (Join Log for Context)
-- 实际场景通常分别查询，但 OB 支持 Join
-- 假设 memory_artifacts 记录了 source_session_id
SELECT
    m.content as insight,
    l.content as source_chat
FROM
    memory_artifacts m
JOIN
    memory_logs l ON m.source_session_id = l.session_id
WHERE
    m.artifact_id = 'mem_abc_123'
LIMIT 10;
```

### 2.5 场景化验证集 (Scenario Verification Suite)

为了验证 Unified Schema 在真实 Agent 框架中的适应性，我们选取了 10 个经典的 Agent Memory 交互场景（参考 LangGraph, Agno/Phidata, Google Agent Builder 等最佳实践），并提供了对应的 SQL 验证脚本。

#### 场景 1: Basic Conversation History (短期记忆回溯)

**描述**: 模拟一个标准的 Chat Agent，验证 `memory_logs` 的有序写入与 Context Window 的重建能力。
**关键点**: 严格的 `seq_id` 排序与 `session_id` 隔离。
**参考**: Agno Session Memory, Phidata Chat History.

```sql
-- 1. 准备数据: 创建会话与对话流 (使用 IGNORE 避免重复插入)
INSERT IGNORE INTO memory_sessions (session_id, user_id, agent_id) VALUES ('sess_chat_001', 'user_alice', 'agent_chat');
INSERT INTO memory_logs (session_id, seq_id, role, content) VALUES
('sess_chat_001', 1, 'user', 'Hello, who are you?'),
('sess_chat_001', 2, 'assistant', 'I am your AI assistant.'),
('sess_chat_001', 3, 'user', 'Tell me a joke.');

-- 2. 验证查询: 重建 Context (Top-K Messages)
SELECT role, content
FROM memory_logs
WHERE session_id = 'sess_chat_001'
ORDER BY seq_id ASC
LIMIT 10;
```

#### 场景 2: Semantic User Profiling (用户画像学习)

**描述**: 从对话中提取用户偏好（User Insights），存入 `memory_artifacts` (`memory_type='semantic'`)，用于个性化增强。
**关键点**: 通过 User ID 关联而非 Session ID，实现跨会话记忆。
**参考**: Agno User Memory, Google Agent Builder User Profile.

```sql
-- 1. 准备数据: 假设 Agent 分析出 Alice 是素食者
INSERT IGNORE INTO memory_artifacts (artifact_id, user_id, memory_type, content, embedding) VALUES
('fact_u001_01', 'user_alice', 'semantic', 'User is vegetarian.',
 CONCAT('[', REPEAT('0.1,', 1535), '0.1]')); -- 模拟向量

-- 2. 验证查询: 检索用户偏好 (Vector Search)
-- Query: "Suggest a dinner place" -> Embedding: [0.1...]
SELECT content, l2_distance(embedding, CONCAT('[', REPEAT('0.1,', 1535), '0.1]')) as dist
FROM memory_artifacts
WHERE user_id = 'user_alice' AND memory_type = 'semantic'
ORDER BY dist ASC
LIMIT 1;
```

#### 场景 3: Episodic Summarization (长周期记忆压缩)

**描述**: 当 Context Window 满时，将旧的 Session Log 压缩为 Summary 存入 Artifacts (`memory_type='episodic'`)。
**关键点**: 建立 `source_session_id` 溯源关系。
**参考**: Phidata Summaries, LangChain Memory Summarization.

```sql
-- 1. 准备数据: 插入摘要
INSERT IGNORE INTO memory_artifacts (artifact_id, user_id, source_session_id, memory_type, content, embedding) VALUES
('episode_sess_001', 'user_alice', 'sess_chat_001', 'episodic',
 'In session sess_chat_001, user asked for jokes and introductions.',
 CONCAT('[', REPEAT('0.2,', 1535), '0.2]'));

-- 2. 验证查询: 查找历史对话摘要
SELECT content, source_session_id
FROM memory_artifacts
WHERE user_id = 'user_alice' AND memory_type = 'episodic';
```

#### 场景 4: State Checkpointing & Persistence (状态断点续传)

**描述**: 在 Human-in-the-Loop 流程中，保存当前的执行状态到 `memory_sessions.metadata`，以便稍后恢复。
**关键点**: 利用 JSON 字段存储非结构化状态。
**参考**: LangGraph Checkpointer.

```sql
-- 1. 更新状态: 记录当前步骤
UPDATE memory_sessions
SET metadata = JSON_MERGE_PATCH(COALESCE(metadata, '{}'), '{"current_step": "approval_pending", "draft_id": "doc_123"}')
WHERE session_id = 'sess_chat_001';

-- 2. 验证查询: 读取断点状态以恢复执行
SELECT session_id, JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.current_step')) as status
FROM memory_sessions
WHERE session_id = 'sess_chat_001';
```

#### 场景 5: Procedural Tool Knowledge (工具使用技能)

**描述**: 记录 Agent 对特定工具的成功调用参数，形成“肌肉记忆”。
**关键点**: 使用 `tags` 标记工具类型，利用 Vector 检索相似任务的工具用法。
**参考**: ADK / ReAct Logs.

```sql
-- 1. 准备数据: 记录一次成功的工具调用
INSERT INTO memory_logs (session_id, seq_id, role, content) VALUES
('sess_chat_001', 4, 'tool', '{"tool_name": "weather_api", "params": {"city": "Paris"}, "status": "success"}');

-- 2. 提取为 Procedural Artifact
INSERT IGNORE INTO memory_artifacts (artifact_id, user_id, memory_type, content, tags, embedding) VALUES
('proc_001', 'user_alice', 'procedural', 'Use weather_api with city name for forecast.', '["tool", "weather"]',
 CONCAT('[', REPEAT('0.3,', 1535), '0.3]'));

-- 3. 验证查询: 检索相关工具经验
SELECT content
FROM memory_artifacts
WHERE JSON_CONTAINS(tags, '"tool"');
```

#### 场景 6: Domain Knowledge Base RAG (外部知识库)

**描述**: 存储上传的 PDF/文档切片，作为只读知识库。
**关键点**: 使用 `memory_type='knowledge'` (需扩展 Enum 或复用 semantic) 区分外部知识。
**参考**: Agno Knowledge Base.

```sql
-- 假设我们将外部知识也存入 artifacts，type为 'knowledge'
-- 0. 扩展类型定义 (若采用 ENUM 严格模式)
-- ALTER TABLE memory_artifacts MODIFY COLUMN memory_type ENUM('episodic', 'semantic', 'procedural', 'knowledge') NOT NULL;

-- 1. 准备数据: 插入知识片段
INSERT IGNORE INTO memory_artifacts (artifact_id, user_id, memory_type, content, embedding) VALUES
('kb_doc_001_chunk1', 'system_global', 'knowledge', 'OceanBase V4.5 supports native vector types.',
 CONCAT('[', REPEAT('0.8,', 1535), '0.8]'));

-- 2. 验证查询: 知识库问答
SELECT content
FROM memory_artifacts
WHERE user_id = 'system_global' -- 假设 public data 归属 system
ORDER BY l2_distance(embedding, CONCAT('[', REPEAT('0.8,', 1535), '0.8]')) ASC
LIMIT 1;
```

#### 场景 7: Shared Multi-Agent Workspace (多智能体协作)

**描述**: 多个 Agent (如 Planner, Coder) 共享同一个 System Context。
**关键点**: 在同一 `session_id` 下，通过 Log 内容或 Metadata 区分不同 Agent 的发言。
**参考**: MetaGPT / LangGraph Multi-agent.

```sql
-- 1. 准备数据: Team Session
INSERT IGNORE INTO memory_sessions (session_id, user_id, agent_id) VALUES ('sess_team_001', 'sub-task-1', 'squad-leader');
INSERT INTO memory_logs (session_id, seq_id, role, content) VALUES
('sess_team_001', 1, 'user', 'Build a snake game.'),
('sess_team_001', 2, 'assistant', '[Planner]: Designed architecture.'),
('sess_team_001', 3, 'assistant', '[Coder]: Implemented main loop.');

-- 2. 验证查询: 获取完整协作流
SELECT content FROM memory_logs WHERE session_id = 'sess_team_001' ORDER BY seq_id;
```

#### 场景 8: Time-Travel & Audit (审计回溯)

**描述**: 查找特定时间段的记忆或操作，用于 Debug 或回滚。
**关键点**: 利用 `created_at` 索引进行时间范围查询。
**参考**: LangGraph Time Travel.

```sql
-- 1. 验证查询: 查询最近 5 分钟的操作日志
SELECT *
FROM memory_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
ORDER BY created_at DESC;
```

#### 场景 9: Fact Update & Conflict Resolution (记忆修正)

**描述**: 用户更新了偏好（如“不再喜欢吃辣”），需要标记旧记忆失效或权重降低。
**关键点**: 利用 `importance_score` 降权实现 Soft Delete。
**参考**: Cognitive Architectures (e.g. Generative Agents).

```sql
-- 0. 准备数据: 插入旧的偏好 (Likes spicy)
INSERT IGNORE INTO memory_artifacts (artifact_id, user_id, memory_type, content, importance_score, embedding) VALUES
('fact_u001_old', 'user_alice', 'semantic', 'User likes spicy food.', 0.8,
 CONCAT('[', REPEAT('0.9,', 1535), '0.9]'));

-- 1. 操作: 降低旧记忆权重 (Soft Delete)
UPDATE memory_artifacts
SET importance_score = 0.1
WHERE user_id = 'user_alice' AND content LIKE '%likes spicy%';

-- 2. 操作: 插入新事实
INSERT IGNORE INTO memory_artifacts (artifact_id, user_id, memory_type, content, embedding) VALUES
('fact_u001_02', 'user_alice', 'semantic', 'User dislikes spicy food.',
 CONCAT('[', REPEAT('0.15,', 1535), '0.15]'));

-- 3. 验证查询: 只取高权重记忆
SELECT content FROM memory_artifacts
WHERE user_id = 'user_alice' AND importance_score > 0.4;
```

#### 场景 10: Feedback Loop (强化反馈)

**描述**: 用户点赞了某条回复，增加对应知识条目的权重。
**关键点**: 动态调整 `importance_score` 以优化 RAG 召回。
**参考**: DSPy / RLHF.

```sql
-- 1. 操作: 用户点赞，增加关联 Artifact 的权重
UPDATE memory_artifacts
SET importance_score = importance_score + 0.1
WHERE artifact_id = 'fact_u001_02';

-- 2. 验证查询: 确认权重更新
SELECT importance_score FROM memory_artifacts WHERE artifact_id = 'fact_u001_02';
```

### 2.6 环境重置 (Teardown)

为了确保测试环境的整洁，建议在每一轮验证结束后清理 Mock 数据。

```sql
/**
 * Global Cleanup Script
 * Warning: This will delete all data created by the verification suite.
 */

-- 1. 清理 Sessions (级联清理 Logs 如果有外键，但此处 Schema 无外键约束)
DELETE FROM memory_sessions WHERE session_id IN ('sess_chat_001', 'sess_team_001');

-- 2. 清理 Logs
DELETE FROM memory_logs WHERE session_id IN ('sess_chat_001', 'sess_team_001');

-- 3. 清理 Artifacts
DELETE FROM memory_artifacts WHERE user_id IN ('user_alice', 'system_global') OR artifact_id LIKE 'proc_%';
```

## 3. References

本文档步骤经过以下官方文档验证：

1.  **OceanBase V4.5.0 Release Notes (Vector Support)**

    - Confirmed `VECTOR` data type, `VECTOR_HNSW` index support, and `l2_distance` function.
    - [OceanBase 4.5.0 Feature Highlights - Vector Search](https://github.com/oceanbase/oceanbase/releases)
    - [OceanBase Community Edition 4.5.0 Release](https://open.oceanbase.com/softwareCenter/community)

2.  **OceanBase Docker Deployment**

    - Standard `oceanbase/oceanbase-ce` image deployment for local dev/mini mode.
    - [OceanBase Quick Start (Docker)](https://open.oceanbase.com/quickStart)
    - [OceanBase Community Edition Documentation](https://open.oceanbase.com/docs)

3.  **Google Agent Builder - Memory & Unified Schema**
    - Validated "Memory Bank" concepts: Session-scoped logs vs. consolidated episodic/semantic memory.
    - Validated "Clean Schema" approach for agentic histories.
    - [Vertex AI Agent Builder Documentation](https://docs.cloud.google.com/agent-builder/overview)
    - [Building AI Agents with Vertex AI Agent Builder](https://codelabs.developers.google.com/devsite/codelabs/building-ai-agents-vertexai)
