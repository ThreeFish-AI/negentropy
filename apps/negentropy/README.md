# negentropy（后端引擎）

「一核五翼」智能体系统的后端引擎：Google ADK Web Server + FastAPI，承载根智能体编排、五大系部、三条标准流水线、统一调度、Routine 长周期任务、Definitions 注册表与知识子系统。

## 启动

```bash
uv run negentropy serve --port 3292
```

进程入口链：[`src/negentropy/cli.py`](./src/negentropy/cli.py)（`negentropy serve` 子命令，进程内调起 ADK `web`）→ ADK 导入 [`src/services.py`](./src/services.py)（触发 `apply_adk_patches()`）→ [`src/negentropy/engine/bootstrap.py`](./src/negentropy/engine/bootstrap.py)（Monkey-Patch ADK 服务工厂与 `get_fast_api_app`，挂载 `/knowledge` `/memory` `/interface` `/scheduler` `/routines` `/auth` 等路由与 `/mcp/knowledge` 子应用）。

容器内由 [`docker/backend/entrypoint.sh`](../../docker/backend/entrypoint.sh) 先执行 `alembic upgrade head` 再启动服务。

> 架构全景见 [docs/concepts/framework.md](../../docs/concepts/framework.md)；开发工作流见 [operations/development.md](../../docs/concepts/operations/development.md)。
