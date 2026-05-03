# Memory Troubleshooting Guide：故障排除 FAQ

> 实测过的问题 + SQL 诊断脚本。前置阅读 [`memory-basics.md`](./memory-basics.md)。

---

## <a id="rate-limit"></a>1. `Rate limit exceeded` 报错

**症状**：调用 self-edit 工具返回 `400 Rate limit exceeded: <tool> called 10 times in last 60s`。

**原因**：单个 `(user × thread × tool)` 组合 1 分钟超过 10 次调用。

**修复**：
1. 短期：等 60 秒重试
2. 长期：调高 `MAX_CALLS_PER_MINUTE`（`engine/tools/memory_tools.py`）
3. 排查 Agent 是否陷入循环（同质 self-edit）

```sql
-- 查看最近 5 分钟的工具执行频率
SELECT name, status, COUNT(*) AS calls,
       MAX(started_at) AS last_call
FROM negentropy.tool_executions e JOIN negentropy.tools t ON e.tool_id = t.id
WHERE t.name LIKE 'memory_%' AND e.started_at > NOW() - INTERVAL '5 minutes'
GROUP BY name, status ORDER BY calls DESC;
```

---

## <a id="search-empty"></a>2. 检索返回 0 条结果

**症状**：`search_memory` 持续返回空，但 Timeline 中明明有记忆。

**可能原因 + 诊断**：

### 2.1 embedding_fn 未配置
```python
mem = get_memory_service()
print(mem._embedding_fn)  # 应非 None
```
若 `None`，工厂层未注入；检查 `bootstrap.py` / Agent 启动代码。

### 2.2 hybrid_search SQL 函数缺失
```sql
SELECT proname FROM pg_proc
WHERE proname = 'hybrid_search'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'negentropy');
```
为空说明 `perception_schema.sql` 没跑。运行 `uv run alembic upgrade head` 重建。

### 2.3 Memory 表全部 retention_score=0
```sql
SELECT memory_type, COUNT(*) AS n,
       AVG(retention_score) AS avg_ret
FROM negentropy.memories
WHERE user_id = 'alice'
GROUP BY memory_type;
```
若全部 0，说明自动化清理过激；调整 `min_retention_threshold` 见 [`memory-automation.md`](./memory-automation.md#3-通过-rest-api-配置)。

---

## <a id="core-block-dup"></a>3. Core Block 出现重复条目

**症状**：UI Automation tab 看到同一 user 的 `persona` 块出现多条。

**原因**：唯一键是 `(user, app, scope, thread_id, label)`，scope=user 时 thread_id 必须为 NULL，但客户端误传了 thread_id 字符串。

**修复**：
```python
# ✓ 正确
await service.upsert(user_id="alice", app_name="x", scope="user", content="...")
# ✗ 错误（导致 scope=user 但 thread_id 非 NULL，绕过唯一约束）
await service.upsert(user_id="alice", app_name="x", scope="user", thread_id="abc", content="...")
```

`CoreBlockService._normalize_thread_id` 会强制 scope=user/app 时 thread_id=NULL；如发现历史脏数据：

```sql
-- 找重复
SELECT user_id, app_name, scope, label, COUNT(*) FROM negentropy.memory_core_blocks
WHERE scope IN ('user', 'app') AND thread_id IS NOT NULL
GROUP BY 1,2,3,4 HAVING COUNT(*) > 1;
-- 清理多余条目（保留最新）
DELETE FROM negentropy.memory_core_blocks
WHERE scope IN ('user','app') AND thread_id IS NOT NULL;
```

---

## 4. 低 retention_score 大量出现

**症状**：UI Timeline 一片 🔴。

**诊断**：
```sql
-- 看分布
SELECT memory_type, ROUND(retention_score::numeric, 2) AS rs, COUNT(*)
FROM negentropy.memories WHERE user_id = 'alice'
GROUP BY 1, 2 ORDER BY 1, 2;
```

**可能原因**：
- 用户长期未访问（自然衰减）
- 类型主要是 `episodic`（默认 λ=0.10/天，14 天会衰减到 0.25）
- 巩固管线初始 retention=0.8 + 信息密度低

**对策**：
- 高价值内容主动用 `memory_write(memory_type='semantic')` 写入（λ=0.005，超慢衰减）
- 用 `core_block_replace` 把关键画像沉到 Core Block（不衰减）

---

## 5. PII 锁标 🔒 误报

**症状**：Timeline 上正常对话也被标 🔒。

**诊断**：
```sql
SELECT id, content, metadata->'pii_flags' AS flags FROM negentropy.memories
WHERE metadata ? 'pii_flags' AND user_id = 'alice'
ORDER BY created_at DESC LIMIT 20;
```

**常见误报来源**：
- 用户在对话中分享了非真实邮箱（如 `noreply@example.com`）
- 长串数字看起来像信用卡（已用 Luhn 校验过滤大部分）
- 北美电话格式与中国手机号格式相似

**对策**：
- PII 检测仅做提示，**不阻断写入或检索**
- 误报无需修复；如需精细治理参考 [Phase 5 路线图](../memory-whitepaper.md#4-未来路线phase-5)的 Presidio 计划

---

## 6. 巩固管线 advisory_lock 阻塞

**症状**：`add_session_to_memory` 返回 `consolidate_skipped_concurrent`。

**原因**：同 thread_id 的并发巩固调用 → 后到的被 advisory lock 拒绝。

**修复**：
- 这是预期行为（防止重复写入）
- 若确需强制重跑，确认前一次已结束后再调用
- 长期方案：在调用方做 idempotency 检查，避免重复请求

---

## 7. 评测脚本跑不起来

**症状**：`uv run python -m tests.eval_tests.memory.eval_runner` 报 `ModuleNotFoundError`。

**修复**：
```bash
cd apps/negentropy
uv sync --frozen
uv run python -m tests.eval_tests.memory.eval_runner
```

确认 `pyproject.toml` 中 `[tool.pytest.ini_options].pythonpath = ["src"]` 存在。

---

## 8. 冲突消解未触发

**症状**：明明有矛盾事实，但 `memory_conflicts` 表为空。

**诊断**：
```sql
SELECT detected_by, conflict_type, resolution, COUNT(*)
FROM negentropy.memory_conflicts
WHERE user_id = 'alice' GROUP BY 1, 2, 3;
```

**原因**：
- key-collision 检测要求 `fact_type + key` 完全相同
- embedding-collision 要求 cosine ≥ 0.85
- LLM 路径需要在巩固时被启用

详见 [`engine/governance/conflict_resolver.py`](../../apps/negentropy/src/negentropy/engine/governance/conflict_resolver.py)。

---

## 9. 自动化任务"假在线"

**症状**：UI Automation 显示 enabled=true，但 `last_run_at` 永远不更新。

**诊断**：
```bash
# 应用层调度
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/memory/automation/logs?limit=10"

# pg_cron 端
SELECT * FROM cron.job WHERE jobname LIKE 'memory_%';
SELECT * FROM cron.job_run_details WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname LIKE 'memory_%'
) ORDER BY start_time DESC LIMIT 10;
```

**可能原因**：
- `AsyncScheduler` 未启动（应用进程未跑或线程死锁）
- pg_cron 扩展未启用
- cron 表达式错误（用 `* * * * *` 测试是否真触发）

---

## 10. 服务启动失败：alembic 多 head

**症状**：`alembic upgrade head` 报 `Multiple heads detected`。

**修复**：
```bash
uv run alembic heads -v
# 找到分叉点
uv run alembic merge -m "merge phase4 head" <head1> <head2>
uv run alembic upgrade head
```

参考 CI 中的 `Verify Alembic graph has a single head` 步骤（`reusable-negentropy-backend-quality.yml:43-55`）。

---

## 11. F1 HippoRAG PPR 通道 0 召回

**症状**：开启 `MEMORY_HIPPORAG_ENABLED=true` 后，`custom_metadata.search_level` 始终为 `hybrid`，从不出现 `ppr+hybrid`。

**诊断**：
```sql
-- 检查 KG 中 memory ↔ entity 关联数（要求 ≥ 100）
SELECT COUNT(*) FROM negentropy.memory_associations
WHERE target_type = 'entity';
-- 检查 query 是否能链接到种子节点
SELECT * FROM negentropy.kg_entities
WHERE name ILIKE '%<query 关键词>%' LIMIT 5;
```

**常见原因**：
- KG 关联数不足（启动期门控）→ 等 KG 同步累积或调低门控
- query 太短/太抽象，entity linker 0 命中 → 默认 short-circuit 回 Hybrid，不报错
- AGE Cypher 超时（> 120ms）→ 写 `_log_fallback_event("ppr","hybrid",...)`，搜结构化日志

---

## 12. F2 反思队列堆积

**症状**：`record_feedback` 调用大量 `harmful`/`irrelevant`，但 `metadata.subtype='reflection'` 的记忆数远少于反馈数。

**诊断**：
```sql
-- 反思生成数 vs 反馈数（最近 24h）
SELECT
  (SELECT COUNT(*) FROM negentropy.retrieval_logs
    WHERE outcome IN ('irrelevant','harmful') AND created_at > NOW() - INTERVAL '1 day') AS feedback_n,
  (SELECT COUNT(*) FROM negentropy.memories
    WHERE metadata->>'subtype'='reflection' AND created_at > NOW() - INTERVAL '1 day') AS reflection_n;
```

**常见原因**：
- 反思 dedup 命中（同一 query 7 天内已反思过 / cosine ≥ 0.92 簇）→ 预期行为
- LLM 调用失败连续触发 pattern fallback → 看 Langfuse trace
- 每日上限触顶（默认 ≤10/用户）→ `MEMORY_REFLECTION_DAILY_LIMIT` 调高

---

## 13. F3 Pipeline step 失败

**症状**：`add_session_to_memory` 抛 `step_failed: <step_name>`。

**诊断**：
```sql
SELECT step_name, status, duration_ms, error
FROM negentropy.consolidation_audit
WHERE thread_id = '<uuid>' ORDER BY started_at DESC;
```

**对策**：
- 单 step 偶发失败 → `policy: fail_tolerant` 让其他 step 继续提交部分结果
- 必须强保证一致性 → `policy: serial`（默认），整体失败可重试
- 临时回退到 Phase 4 行为 → `memory.consolidation.legacy=true`

---

## 14. F4 Presidio 模型缺失 / 冷启动慢

**症状**：切换 `engine=presidio` 后启动报 `OSError: [E050] Can't find model 'zh_core_web_sm'`。

**修复**：
```bash
cd apps/negentropy
uv sync --extra pii-presidio
# 手动下载 spaCy 模型（uv extra 已自动包含，仍失败时单独跑）
uv run python -m spacy download zh_core_web_sm
uv run python -m spacy download en_core_web_sm
```

**冷启动慢**：
- Presidio + spaCy 首次加载 ~3-5s
- 通过 `lifespan` 在应用启动时预热 `PresidioPIIDetector` 单例
- 容器镜像中预拷贝 `~/.cache/spacy/models/`

**导入失败时**：factory 自动 fallback 到 `RegexPIIDetector`，并写一条 WARNING 日志；`engine=regex` 是确定无依赖回退点。

---

## 救援手册

仍未解决？按顺序排查：
1. 重启服务：`bash ctl/restart.sh`
2. 跑健康检查：`uv run python -m negentropy.cli health`
3. 检查 `docs/issue.md` 是否已记录同类问题
4. 提 GitHub Issue 并附带 SQL 诊断输出
