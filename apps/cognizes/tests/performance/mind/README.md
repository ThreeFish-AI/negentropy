# Mind 模块性能压测

本目录包含 Phase 4 (The Realm of Mind) 的性能压测脚本，用于验证 SessionService 和 MemoryService 的性能指标。

## 验收标准

| 指标              | 目标值    | 说明                    |
| :---------------- | :-------- | :---------------------- |
| Session CRUD P99  | < 50ms    | 会话创建/读取/更新/删除 |
| Memory Search P99 | < 100ms   | 向量检索延迟            |
| Error Rate        | < 0.1%    | 错误率                  |
| Throughput        | > 500 RPS | 请求吞吐量              |

## 快速开始

### 1. 安装依赖

```bash
# 安装 locust
uv add locust --dev
```

### 2. 环境准备

```bash
# 设置数据库连接
export DATABASE_URL="postgresql://aigc:@localhost:5432/cognizes-engine"

# 确保数据库表已创建
psql -d 'cognizes-engine' -f src/cognizes/engine/schema/mind_schema.sql
```

### 3. 运行压测

```bash
# 方式 1: Web UI 模式 (推荐首次使用)
./tests/performance/mind/run_benchmark.sh
# 访问 http://localhost:8089

# 方式 2: 无头模式 (CI/CD 使用)
./tests/performance/mind/run_benchmark.sh --headless

# 方式 3: 快速验证 (10 用户, 30 秒)
./tests/performance/mind/run_benchmark.sh --quick

# 方式 4: 直接使用 locust 命令
locust -f tests/performance/mind/locustfile.py \
    --users 100 --spawn-rate 10 --run-time 60s \
    --host $DATABASE_URL \
    --html report.html
```

## 文件说明

| 文件               | 说明                                    |
| :----------------- | :-------------------------------------- |
| `locustfile.py`    | Locust 压测脚本，定义测试任务和用户行为 |
| `locust.conf`      | Locust 配置文件，设置默认参数           |
| `run_benchmark.sh` | 便捷执行脚本，支持多种运行模式          |
| `reports/`         | 压测报告输出目录                        |

## 测试任务分布

### SessionService (权重 75%)

| 任务           | 权重 | 说明     |
| :------------- | :--: | :------- |
| get_session    |  20  | 获取会话 |
| update_state   |  15  | 更新状态 |
| create_session |  10  | 创建会话 |
| list_sessions  |  5   | 列出会话 |
| append_event   |  3   | 追加事件 |
| delete_session |  2   | 删除会话 |

### MemoryService (权重 25%)

| 任务          | 权重 | 说明     |
| :------------ | :--: | :------- |
| search_memory |  15  | 向量检索 |
| add_memory    |  5   | 添加记忆 |
| list_memories |  5   | 列出记忆 |

## 报告分析

压测完成后，检查以下指标:

1. **P99 延迟**: 查看 HTML 报告中各操作的 P99 指标
2. **错误率**: 确保 Failure Rate < 0.1%
3. **吞吐量**: 检查 RPS (Requests Per Second) > 500

## 参考

- [Locust 官方文档](https://docs.locust.io/)
- [Phase 4 验收标准](../../../docs/040-the-realm-of-mind.md#534-性能压测流程)
