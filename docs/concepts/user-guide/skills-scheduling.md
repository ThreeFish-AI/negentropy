# Skills · 定时调度（Phase 3）

> 让 Paper Hunter 等 Skill 按 cron 表达式自动跑，不依赖 LLM 触发。

## 1. 入口

`/interface/skills` 卡片右上黄色 ⏰ 图标 → **Schedules** 弹窗：

1. **New schedule** 区填 cron 表达式（POSIX 5 字段）+ vars JSON + enabled checkbox；
2. **Existing schedules** 区列出所有已注册 schedule，每行：cron / next_run_at / last_run_at / last_error / Run Now / Delete；
3. cron 校验由后端 `croniter` 完成，前端非法表达式会以 toast.error 显示。

## 2. cron 表达式速查

| 表达式        | 含义                               |
| ------------- | ---------------------------------- |
| `0 9 * * 1`   | 每周一 09:00                       |
| `0 */4 * * *` | 每 4 小时                          |
| `0 9 1 * *`   | 每月 1 号 09:00                    |
| `0 9 * * 1-5` | 工作日 09:00                       |
| `* * * * *`   | 每分钟（**仅调试用**，会持续触发） |

## 3. 行为契约（重要）

- **执行 ≠ LLM 调用**：scheduler 仅渲染 prompt（与 `POST /skills/{id}/invoke` 一致）+ 写入 Memory（`app_name=skill_scheduler`）做留痕；
- **不直接执行 ADK Agent**：避免本地无 LLM 部署时 schedule 会失败；要让 LLM 真正消费，需把 `app_name=skill_scheduler` 的 Memory 作为 trigger 接入 SubAgent runtime（Phase 4 路线）；
- **多 worker 安全**：`FOR UPDATE SKIP LOCKED + UPDATE next_run_at` 原子认领，多个 backend 进程并发跑 tick 也只触发一次；
- **fail-soft**：执行异常写入 `last_error` 字段 + warning 日志，不影响其他 schedule。

## 4. 启动机制

backend 启动时**不自动**启动 scheduler tick；首次 `POST /skills/{id}/schedules` 端点访问时 `ensure_scheduler_running()` 懒启动（绕开 ADK 嵌入下 FastAPI startup hook 不触发的问题）。

`feature flag NEGENTROPY_SKILL_SCHEDULER_ENABLED=false` → 跳过注册，端点仍可用但无后台 tick；手动 `POST /schedules/{id}/run` 仍可触发。

## 5. API 速查

```bash
# 创建 schedule（每周一 09:00 跑 paper_hunter）
curl -X POST -H "Content-Type: application/json" -b "ne_sso=$TOKEN" \
  -d '{
    "cron_expr":"0 9 * * 1",
    "enabled":true,
    "vars":{"query":"AI agent","top_n":5,"days_back":7,"topic_tag":"ai-agent"}
  }' \
  http://localhost:3192/api/interface/skills/$SKILL_ID/schedules

# 列出
curl -b "ne_sso=$TOKEN" http://localhost:3192/api/interface/skills/$SKILL_ID/schedules

# 手动触发（不等 tick）
curl -X POST -b "ne_sso=$TOKEN" \
  http://localhost:3192/api/interface/skills/$SKILL_ID/schedules/$SCHEDULE_ID/run

# 删除
curl -X DELETE -b "ne_sso=$TOKEN" \
  http://localhost:3192/api/interface/skills/$SKILL_ID/schedules/$SCHEDULE_ID
```

## 6. Paper Hunter 周报范式

```yaml
cron_expr: "0 9 * * 1"          # 每周一 09:00
enabled: true
vars:
  query: "AI agent"
  top_n: 10
  days_back: 7
  topic_tag: "weekly-digest"
```

每周一 09:00 渲染一份周报 prompt 写入 Memory。可叠加 SubAgent 触发器（Phase 4）让 LLM 真正消费。

## 7. 引用

- POSIX cron 标准 https://pubs.opengroup.org/onlinepubs/9699919799/utilities/crontab.html
- croniter PyPI https://pypi.org/project/croniter/
- PostgreSQL `FOR UPDATE SKIP LOCKED` https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE
