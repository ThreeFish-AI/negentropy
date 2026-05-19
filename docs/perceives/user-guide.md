---
id: user-guide
sidebar_position: 3
title: User Guide
description: Negentropy Perceives MCP Server 用户指南，涵盖快速入门、MCP Server 部署配置、6 个 MCP 工具参考、Python SDK 编程接口、高级使用场景及开发者命令速查。
last_update:
  author: Aurelius
  date: 2026-04-11
tags:
  - User Guide
  - MCP Server
  - MCP Tools
  - API Usage
---

## 概述

Negentropy Perceives 是一个基于 [FastMCP](https://github.com/jlowin/fastmcp) 框架构建的商业级数据提取与转换 MCP Server。它的核心使命很简单：**把网页和 PDF 变成干净的 Markdown**。6 个精心设计的 MCP 工具覆盖了链接发现、页面检查、网页/PDF → Markdown 转换等核心场景，支持 STDIO / HTTP / SSE 三种传输模式，还有 Pipeline 编排、多引擎 PDF 处理、LLM 智能融合等企业级能力。

**核心特性**

- **6 个专业 MCP 工具**：链接发现、页面检查、网页转 Markdown、PDF 转 Markdown（含批量版本）
- **多引擎 PDF 处理**：Docling（GPU 加速）、Marker（学术文档）、MineRU（深度学习）、PyMuPDF、PyPDF 五大引擎，外加 LLM 智能编排融合
- **Pipeline 编排框架**：Stage 化处理管线，支持引擎竞争、降级回退、并行执行
- **多种抓取策略**：simple / selenium / stealth_selenium / stealth_playwright，智能选择最佳方案
- **Python SDK**：一行代码连接服务，类型化便捷方法开箱即用
- **企业级基础设施**：速率限制、重试机制、代理支持、GPU 加速、配置分层管理

## 快速入门

### 30 秒上手

```bash
# 安装并启动（使用 uvx 从 GitHub 安装）
uvx --with git+https://github.com/ThreeFish-AI/data-negentropy.perceives.git@v0.2.0a1 negentropy-perceives
```

服务默认以 HTTP 模式启动在 `http://localhost:2992/mcp`。

### 第一次调用：网页转 Markdown

在 MCP Client（如 Claude Desktop）中配置后，或通过 SDK 调用：

```python
from negentropy.perceives.sdk import NegentropyPerceivesClient

async with NegentropyPerceivesClient("http://localhost:2992/mcp") as client:
    # 网页 → Markdown
    result = await client.parse_webpage_to_markdown(
        url="https://example.com",
        method="auto",
    )
    print(result)
```

### 第一次 PDF 转换

```python
async with NegentropyPerceivesClient("http://localhost:2992/mcp") as client:
    # PDF → Markdown（自动选择最佳引擎）
    result = await client.call_tool(
        "parse_pdf_to_markdown",
        {"pdf_source": "https://example.com/paper.pdf", "method": "auto"},
    )
    print(result)
```

> **完整环境配置**参见[开发指南](./development.md#环境配置)，**MCP Client 配置**参见 [MCP Server 配置](#mcp-server-配置)。

## 开发者命令速查

> 本章节收录日常 CLI 命令速查。完整环境配置见[开发指南](./development.md#环境配置)，测试流程见[开发指南 > 测试执行](./development.md#测试执行)。

### 服务器启动

```bash
# 启动 MCP 服务器（主要启动命令）
uv run negentropy-perceives

# 以 Python 模块方式运行
uv run python -m negentropy.perceives
```

#### 开发模式启动

```bash
# 启用调试级别日志
uv run --env NEGENTROPY_PERCEIVES_LOG_LEVEL=DEBUG negentropy-perceives

# 启用完整功能特性的开发配置
uv run --env NEGENTROPY_PERCEIVES_ENABLE_JAVASCRIPT=true \
          --env NEGENTROPY_PERCEIVES_USE_RANDOM_USER_AGENT=true \
          negentropy-perceives
```

> 全部环境变量配置项见[环境变量完整参考](#环境变量完整参考)。

### 代码质量检查

> 基础 Ruff / MyPy / Pre-commit 命令见[开发指南 · 代码质量保障](./development.md#代码质量保障)

```bash
# 查看 Ruff 所有可用的检查规则
uv run ruff rule --all

# MyPy 显示详细的错误代码信息
uv run mypy src/negentropy/perceives/ --show-error-codes

# MyPy 生成 HTML 格式的类型检查报告
uv run mypy src/negentropy/perceives/ --html-report mypy-report
```

### 项目依赖管理

```bash
# 添加生产/开发依赖
uv add <package-name>
uv add --dev <package-name>

# 移除/更新依赖
uv remove <package-name>
uv lock --upgrade

# 查看依赖信息
uv tree              # 完整依赖树
uv tree --outdated   # 过时依赖
uv list              # 已安装包列表
```

### 项目维护

```bash
# 版本号查询（从 pyproject.toml 动态读取）
uv run python -c "from negentropy.perceives import __version__; print(__version__)"

# 缓存清理
uv cache clean

# Python 编译缓存清理
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
```

> 完整构建发布流程见[开发指南 · 发布流程](./development.md#发布流程)。

### 系统调试与诊断

```bash
# 检查环境变量
printenv | grep NEGENTROPY_PERCEIVES

# 验证配置正确性
uv run python -c "from negentropy.perceives.config import settings; print(settings.model_dump())"

# 检查模块导入
uv run python -c "import negentropy.perceives; print('Import successful')"

# 查看可用工具列表
uv run python -c "import asyncio; from negentropy.perceives.tools import app; print([t.name for t in asyncio.run(app.list_tools())])"

# 检查配置来源
uv run python -c "from negentropy.perceives.config import describe_config_sources; print(describe_config_sources())"

# 生成默认用户配置
uv run negentropy-perceives --init-config
```

## MCP Server 配置

### 配置系统架构

Negentropy Perceives 采用分层配置系统，按优先级从**高到低**：

| 优先级        | 配置源                 | 说明                                     |
| ------------- | ---------------------- | ---------------------------------------- |
| **1（最高）** | `-c/--config` 显式配置 | 通过构造参数传入，覆盖一切               |
| **2**         | 环境变量               | `NEGENTROPY_PERCEIVES_` 前缀             |
| **3**         | 用户 YAML 配置         | `~/.negentropy/perceives.config.yaml`    |
| **4（最低）** | 内置默认配置           | `config.default.yaml`（打包在 wheel 内） |

> **更多信息**
>
> - 系统要求与开发环境搭建 -> [开发指南](./development.md#环境配置)
> - 环境变量完整参考 -> [环境变量完整参考](#环境变量完整参考)

### 传输模式

| 特性         | STDIO          | HTTP (默认)        | SSE (传统)   |
| ------------ | -------------- | ------------------ | ------------ |
| **适用场景** | 本地开发、调试 | 生产环境、远程访问 | 遗留系统兼容 |
| **部署方式** | 子进程通信     | HTTP 服务器        | HTTP 服务器  |
| **远程访问** | 不支持         | 支持               | 支持         |
| **推荐度**   | 适合本地开发   | **生产首选**       | 兼容用途     |

### 方式一：STDIO 传输模式

```json
{
  "mcpServers": {
    "negentropy-perceives": {
      "command": "uv",
      "args": [
        "run",
        "--with",
        "git+https://github.com/ThreeFish-AI/data-negentropy.perceives.git@v0.2.0a1",
        "negentropy-perceives"
      ]
    }
  }
}
```

> 开发环境推荐使用 STDIO 模式并启用调试日志，YAML 配置参考：
>
> ```yaml
> # ~/.negentropy/perceives.config.yaml（开发环境）
> transport:
>   mode: stdio
> log:
>   level: DEBUG
> enable_javascript: true
> browser:
>   headless: false
> concurrent_requests: 4
> ```

### 方式二：HTTP 传输模式（生产推荐）

**传输层环境变量：**

| 环境变量                                 | 类型   | 默认值      | 说明                                         |
| ---------------------------------------- | ------ | ----------- | -------------------------------------------- |
| `NEGENTROPY_PERCEIVES_TRANSPORT_MODE`    | `str`  | `http`      | MCP 传输协议模式（`stdio` / `http` / `sse`） |
| `NEGENTROPY_PERCEIVES_HTTP_HOST`         | `str`  | `localhost` | HTTP 服务器绑定主机                          |
| `NEGENTROPY_PERCEIVES_HTTP_PORT`         | `int`  | `2992`      | HTTP 服务器端口                              |
| `NEGENTROPY_PERCEIVES_HTTP_PATH`         | `str`  | `/mcp`      | HTTP 端点路径                                |
| `NEGENTROPY_PERCEIVES_HTTP_CORS_ORIGINS` | `str?` | `*`         | CORS 来源白名单（`null` 禁用）               |

**服务端启动：**

```bash
NEGENTROPY_PERCEIVES_TRANSPORT_MODE=http \
NEGENTROPY_PERCEIVES_HTTP_HOST=0.0.0.0 \
NEGENTROPY_PERCEIVES_HTTP_PORT=2992 \
negentropy-perceives
```

也可通过用户 YAML 配置文件持久化：

```yaml
# ~/.negentropy/perceives.config.yaml（生产环境）
transport:
  mode: http
http:
  host: "0.0.0.0"
  port: 2992
log:
  level: INFO
enable_javascript: true
browser:
  headless: true
concurrent_requests: 32
use_random_user_agent: true
```

**客户端配置：**

```json
{
  "mcpServers": {
    "negentropy-perceives": {
      "url": "http://localhost:2992/mcp",
      "transport": "http"
    }
  }
}
```

**Python SDK 连接：**

```python
from negentropy.perceives.sdk import NegentropyPerceivesClient

async with NegentropyPerceivesClient("http://localhost:2992/mcp") as client:
    result = await client.parse_webpage_to_markdown(
        url="https://example.com",
        method="auto",
    )
```

### 方式三：SSE 传输模式（传统兼容）

```bash
NEGENTROPY_PERCEIVES_TRANSPORT_MODE=sse \
NEGENTROPY_PERCEIVES_HTTP_PORT=2992 \
negentropy-perceives
```

```json
{
  "mcpServers": {
    "negentropy-perceives": {
      "url": "http://localhost:2992/mcp",
      "transport": "sse"
    }
  }
}
```

### Claude Desktop 配置示例

在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "negentropy-perceives": {
      "command": "uv",
      "args": [
        "run",
        "--with",
        "git+https://github.com/ThreeFish-AI/data-negentropy.perceives.git@v0.2.0a1",
        "negentropy-perceives"
      ],
      "env": {
        "NEGENTROPY_PERCEIVES_ENABLE_JAVASCRIPT": "true",
        "NEGENTROPY_PERCEIVES_CONCURRENT_REQUESTS": "8"
      }
    }
  }
}
```

**注意事项：**

- GitHub 仓库地址：`https://github.com/ThreeFish-AI/data-negentropy.perceives.git`
- 使用当前最新稳定版本

### 安全配置建议

**CORS 配置：**

```bash
NEGENTROPY_PERCEIVES_HTTP_CORS_ORIGINS=https://app.example.com,https://admin.example.com
```

**客户端认证：**

```python
from negentropy.perceives.sdk import NegentropyPerceivesClient

async with NegentropyPerceivesClient(
    "https://api.example.com/mcp",
    headers={
        "Authorization": "Bearer your-jwt-token",
        "X-API-Key": "your-api-key"
    },
) as client:
    tools = await client.list_tools()
```

### 环境变量完整参考

基于 [pydantic-settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) 的分层配置系统，所有环境变量统一使用 `NEGENTROPY_PERCEIVES_` 前缀，由 Pydantic 自动完成类型转换与校验。

#### 服务标识

| 环境变量                              | 类型  | 默认值                 | 说明                                   |
| ------------------------------------- | ----- | ---------------------- | -------------------------------------- |
| `NEGENTROPY_PERCEIVES_SERVER_NAME`    | `str` | `negentropy-perceives` | 服务器标识名称                         |
| `NEGENTROPY_PERCEIVES_SERVER_VERSION` | `str` | 自动读取               | 版本号（从 `pyproject.toml` 自动获取） |

#### 传输层

| 环境变量                                 | 类型   | 默认值      | 约束                     | 说明                           |
| ---------------------------------------- | ------ | ----------- | ------------------------ | ------------------------------ |
| `NEGENTROPY_PERCEIVES_TRANSPORT_MODE`    | `str`  | `http`      | `stdio` / `http` / `sse` | MCP 传输协议模式               |
| `NEGENTROPY_PERCEIVES_HTTP_HOST`         | `str`  | `localhost` | -                        | HTTP 服务器绑定主机            |
| `NEGENTROPY_PERCEIVES_HTTP_PORT`         | `int`  | `2992`      | -                        | HTTP 服务器端口                |
| `NEGENTROPY_PERCEIVES_HTTP_PATH`         | `str`  | `/mcp`      | -                        | HTTP 端点路径                  |
| `NEGENTROPY_PERCEIVES_HTTP_CORS_ORIGINS` | `str?` | `*`         | -                        | CORS 来源白名单（`null` 禁用） |

#### 抓取引擎

| 环境变量                                               | 类型    | 默认值 | 约束   | 说明                   |
| ------------------------------------------------------ | ------- | ------ | ------ | ---------------------- |
| `NEGENTROPY_PERCEIVES_CONCURRENT_REQUESTS`             | `int`   | `16`   | `> 0`  | 并发请求数             |
| `NEGENTROPY_PERCEIVES_DOWNLOAD_DELAY`                  | `float` | `1.0`  | `>= 0` | 下载间隔（秒）         |
| `NEGENTROPY_PERCEIVES_RANDOMIZE_DOWNLOAD_DELAY`        | `bool`  | `true` | -      | 随机化下载间隔         |
| `NEGENTROPY_PERCEIVES_AUTOTHROTTLE_ENABLED`            | `bool`  | `true` | -      | 启用自动节流           |
| `NEGENTROPY_PERCEIVES_AUTOTHROTTLE_START_DELAY`        | `float` | `1.0`  | `>= 0` | 自动节流初始延迟（秒） |
| `NEGENTROPY_PERCEIVES_AUTOTHROTTLE_MAX_DELAY`          | `float` | `60.0` | `>= 0` | 自动节流最大延迟（秒） |
| `NEGENTROPY_PERCEIVES_AUTOTHROTTLE_TARGET_CONCURRENCY` | `float` | `1.0`  | `>= 0` | 自动节流目标并发度     |

#### 速率限制

| 环境变量                                              | 类型  | 默认值 | 约束   | 说明               |
| ----------------------------------------------------- | ----- | ------ | ------ | ------------------ |
| `NEGENTROPY_PERCEIVES_RATE_LIMIT_REQUESTS_PER_MINUTE` | `int` | `60`   | `>= 1` | 每分钟请求频率上限 |

#### 重试策略

| 环境变量                           | 类型    | 默认值 | 约束   | 说明             |
| ---------------------------------- | ------- | ------ | ------ | ---------------- |
| `NEGENTROPY_PERCEIVES_MAX_RETRIES` | `int`   | `3`    | `>= 0` | 失败重试最大次数 |
| `NEGENTROPY_PERCEIVES_RETRY_DELAY` | `float` | `1.0`  | `>= 0` | 重试间隔（秒）   |

#### 缓存系统

| 环境变量                               | 类型   | 默认值 | 约束  | 说明                 |
| -------------------------------------- | ------ | ------ | ----- | -------------------- |
| `NEGENTROPY_PERCEIVES_ENABLE_CACHING`  | `bool` | `true` | -     | 启用响应缓存         |
| `NEGENTROPY_PERCEIVES_CACHE_TTL_HOURS` | `int`  | `24`   | `> 0` | 缓存生存时间（小时） |

#### 日志系统

| 环境变量                             | 类型    | 默认值 | 约束                                                | 说明         |
| ------------------------------------ | ------- | ------ | --------------------------------------------------- | ------------ |
| `NEGENTROPY_PERCEIVES_LOG_LEVEL`     | `str`   | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR` / `CRITICAL` | 日志记录级别 |
| `NEGENTROPY_PERCEIVES_LOG_REQUESTS`  | `bool?` | `null` | -                                                   | 记录请求详情 |
| `NEGENTROPY_PERCEIVES_LOG_RESPONSES` | `bool?` | `null` | -                                                   | 记录响应详情 |

#### 浏览器引擎

| 环境变量                                   | 类型   | 默认值      | 约束   | 说明                 |
| ------------------------------------------ | ------ | ----------- | ------ | -------------------- |
| `NEGENTROPY_PERCEIVES_ENABLE_JAVASCRIPT`   | `bool` | `false`     | -      | 启用 JavaScript 执行 |
| `NEGENTROPY_PERCEIVES_BROWSER_HEADLESS`    | `bool` | `true`      | -      | 无头浏览器模式       |
| `NEGENTROPY_PERCEIVES_BROWSER_TIMEOUT`     | `int`  | `30`        | `>= 0` | 浏览器操作超时（秒） |
| `NEGENTROPY_PERCEIVES_BROWSER_WINDOW_SIZE` | `str`  | `1920x1080` | -      | 浏览器窗口尺寸       |

#### 用户代理

| 环境变量                                     | 类型   | 默认值        | 约束 | 说明                     |
| -------------------------------------------- | ------ | ------------- | ---- | ------------------------ |
| `NEGENTROPY_PERCEIVES_USE_RANDOM_USER_AGENT` | `bool` | `true`        | -    | 启用随机 User-Agent 轮换 |
| `NEGENTROPY_PERCEIVES_DEFAULT_USER_AGENT`    | `str`  | Chrome 120 UA | -    | 默认 User-Agent 字符串   |

#### 代理服务

| 环境变量                         | 类型   | 默认值  | 约束 | 说明                             |
| -------------------------------- | ------ | ------- | ---- | -------------------------------- |
| `NEGENTROPY_PERCEIVES_USE_PROXY` | `bool` | `false` | -    | 启用代理服务器                   |
| `NEGENTROPY_PERCEIVES_PROXY_URL` | `str?` | `null`  | -    | 代理服务器 URL（启用代理时必填） |

#### 请求设置

| 环境变量                               | 类型    | 默认值 | 约束  | 说明                |
| -------------------------------------- | ------- | ------ | ----- | ------------------- |
| `NEGENTROPY_PERCEIVES_REQUEST_TIMEOUT` | `float` | `30.0` | `> 0` | HTTP 请求超时（秒） |
| `NEGENTROPY_PERCEIVES_TASK_TIMEOUT_SECONDS` | `int` | `300` | `>= 1` | 单次解析任务（PDF/Webpage）默认超时（秒），可被 MCP 入参 `timeout` 覆盖 |

#### PDF 引擎进程池（取消传导 / 资源真释放）

| 环境变量                                             | 类型    | 默认值    | 约束                            | 说明                                                                                                     |
| ---------------------------------------------------- | ------- | --------- | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `NEGENTROPY_PERCEIVES_PDF_ENGINE_ISOLATION`          | `str`   | `process` | `process` / `thread` / `inline` | PDF 引擎（Docling/MinerU/Marker）隔离策略。`process`（默认）取消时 kill 子进程真正释放 GPU/CPU；`thread` 仅作兜底无法强制 kill；`inline` 仅调试用 |
| `NEGENTROPY_PERCEIVES_PDF_WORKER_POOL_SIZE`          | `int`   | `1`       | `>= 1`                          | 每种 PDF 引擎的 warm worker 数量（1 足以覆盖 95% 单实例场景）                                           |
| `NEGENTROPY_PERCEIVES_PDF_WORKER_MAX_TASKS`          | `int`   | `50`      | `>= 1`                          | 单个 worker 处理任务数上限；达到后自动回收以防内存泄漏                                                   |
| `NEGENTROPY_PERCEIVES_PDF_WORKER_KILL_GRACE_SECONDS` | `float` | `2.0`     | `>= 0.0`                        | 取消时先 `terminate`，等待此秒数若仍存活再 `kill`                                                        |

#### LLM 编排（Smart 模式）

`method="smart"` 使用 LLM 编排多引擎并行处理 PDF。需安装可选依赖 `litellm`（`uv pip install litellm`）。

| 环境变量                               | 类型    | 默认值                    | 约束        | 说明                                                  |
| -------------------------------------- | ------- | ------------------------- | ----------- | ----------------------------------------------------- |
| `NEGENTROPY_PERCEIVES_LLM_API_KEY`     | `str?`  | `null`                    | -           | LLM API Key（OpenAI），也可通过 `OPENAI_API_KEY` 设置 |
| `NEGENTROPY_PERCEIVES_LLM_API_BASE_URL` | `str?` | `null`                    | -           | LLM API Base URL（OpenAI 兼容协议，如 `https://api.openai.com/v1`） |
| `NEGENTROPY_PERCEIVES_LLM_MODEL`       | `str`   | `gpt-5-nano` | -           | LiteLLM 模型标识                                      |
| `NEGENTROPY_PERCEIVES_LLM_TEMPERATURE` | `float` | `0.1`                     | `0.0 ~ 2.0` | LLM 温度参数                                          |
| `NEGENTROPY_PERCEIVES_LLM_MAX_TOKENS`  | `int`   | `4096`                    | `> 0`       | LLM 最大输出 token                                    |
| `NEGENTROPY_PERCEIVES_LLM_TIMEOUT`     | `float` | `60.0`                    | `> 0`       | LLM API 超时（秒）                                    |
| `NEGENTROPY_PERCEIVES_LLM_MAX_RETRIES` | `int`   | `2`                       | `>= 0`      | LLM API 重试次数                                      |

#### 硬件加速

| 环境变量                                             | 类型  | 默认值 | 约束                                    | 说明                                               |
| ---------------------------------------------------- | ----- | ------ | --------------------------------------- | -------------------------------------------------- |
| `NEGENTROPY_PERCEIVES_ACCELERATOR_DEVICE`            | `str` | `auto` | `auto` / `cpu` / `cuda` / `mps` / `xpu` | 推理设备选择，按运行环境自动或显式指定             |
| `NEGENTROPY_PERCEIVES_ACCELERATOR_NUM_THREADS`       | `int` | `4`    | `>= 1`                                  | CPU 推理线程数                                     |
| `NEGENTROPY_PERCEIVES_ACCELERATOR_OCR_BATCH_SIZE`    | `int` | `0`    | `>= 0`                                  | OCR 推理 batch size（0 = 根据设备显存自动推断）    |
| `NEGENTROPY_PERCEIVES_ACCELERATOR_LAYOUT_BATCH_SIZE` | `int` | `0`    | `>= 0`                                  | Layout 推理 batch size（0 = 根据设备显存自动推断） |
| `NEGENTROPY_PERCEIVES_ACCELERATOR_TABLE_BATCH_SIZE`  | `int` | `0`    | `>= 0`                                  | Table 推理 batch size（0 = 根据设备显存自动推断）  |

> 硬件加速的详细平台行为、Batch Size 推断规则见 [硬件加速配置](#7-硬件加速配置)。

#### Docling PDF 引擎

| 环境变量                                                  | 类型   | 默认值  | 约束                            | 说明                                                            |
| --------------------------------------------------------- | ------ | ------- | ------------------------------- | --------------------------------------------------------------- |
| `NEGENTROPY_PERCEIVES_DOCLING_ENABLED`                    | `bool` | `false` | -                               | 启用 Docling 作为可选 PDF 提取引擎                              |
| `NEGENTROPY_PERCEIVES_DOCLING_OCR_ENABLED`                | `bool` | `true`  | -                               | 为扫描版 PDF 启用 OCR                                           |
| `NEGENTROPY_PERCEIVES_DOCLING_TABLE_EXTRACTION_ENABLED`   | `bool` | `true`  | -                               | 启用 Docling 高级表格提取                                       |
| `NEGENTROPY_PERCEIVES_DOCLING_FORMULA_EXTRACTION_ENABLED` | `bool` | `true`  | -                               | 启用 Docling 数学公式提取（MPS 上自动禁用）                     |
| `NEGENTROPY_PERCEIVES_MINERU_ENABLED`                     | `bool` | `false` | -                               | 启用 MinerU（最佳 LaTeX 公式提取）                              |
| `NEGENTROPY_PERCEIVES_MINERU_DEVICE`                      | `str`  | `auto`  | `auto` / `cpu` / `mlx` / `cuda` | MinerU 设备选择                                                 |
| `NEGENTROPY_PERCEIVES_MINERU_BACKEND`                     | `str`  | `auto`  | `auto` / `pipeline` / `vlm`     | MinerU 后端选择                                                 |
| `NEGENTROPY_PERCEIVES_MINERU_MPS_BACKEND`                 | `str`  | `auto`  | `auto` / `vlm-auto-engine` / `pipeline` | Apple Silicon MPS 下的 MinerU 后端策略；`auto` 探测 mlx_vlm + macOS 13.5+ 后择优 |
| `NEGENTROPY_PERCEIVES_MARKER_ENABLED`                     | `bool` | `false` | -                               | 启用 Marker（最佳整体准确率，GPL-3.0）                          |
| `NEGENTROPY_PERCEIVES_MARKER_LLM_ENHANCED`                | `bool` | `false` | -                               | 启用 Marker LLM 增强模式                                        |
| `NEGENTROPY_PERCEIVES_MARKER_LICENSE_ACKNOWLEDGED`        | `bool` | `false` | -                               | 确认 GPL-3.0 许可证条款（需设为 `true` 方可启用 Marker）        |
| `NEGENTROPY_PERCEIVES_MARKER_TORCH_DEVICE`                | `str`  | `null`  | `null` / `cpu` / `mps` / `cuda` | Marker TORCH_DEVICE 透传；`null` 维持默认 CPU 强制（最稳定）     |
| `NEGENTROPY_PERCEIVES_MARKER_INFERENCE_RAM_GB`            | `int`  | `0`     | `>= 0`                          | Marker INFERENCE_RAM 透传（GB）；0 = 不设置，Apple Silicon 推荐设为统一内存 ~50% |
| `NEGENTROPY_PERCEIVES_MARKER_NUM_WORKERS`                 | `int`  | `0`     | `>= 0`                          | Marker NUM_WORKERS 透传；0 = 不设置                              |
| `NEGENTROPY_PERCEIVES_MARKER_HALF_PRECISION`              | `bool` | `false` | -                               | `marker_torch_device=mps` 时通过 monkey-patch 启用 `MODEL_DTYPE=float16` |
| `NEGENTROPY_PERCEIVES_OPENDATALOADER_ENABLED`             | `bool` | `true`  | -                               | 启用 OpenDataLoader（Apache-2.0 / CPU-only / 全元素 bbox）      |
| `NEGENTROPY_PERCEIVES_OPENDATALOADER_USE_STRUCT_TREE`     | `bool` | `true`  | -                               | 利用 Tagged PDF 原生结构（高质量 reading order）                 |
| `NEGENTROPY_PERCEIVES_OPENDATALOADER_SANITIZE`            | `bool` | `false` | -                               | 启用 prompt injection / PII 过滤                                |
| `NEGENTROPY_PERCEIVES_OPENDATALOADER_HYBRID_ENABLED`      | `bool` | `false` | -                               | 启用 hybrid 模式（需边车 server）                               |
| `NEGENTROPY_PERCEIVES_OPENDATALOADER_HYBRID_ENDPOINT`     | `str`  | `null`  | -                               | hybrid server 端点 URL（hybrid_enabled=true 时必填）            |
| `NEGENTROPY_PERCEIVES_OPENDATALOADER_JAVA_CHECK_TIMEOUT`  | `int`  | `3`     | `>= 1`                          | Java 可用性检测超时（秒）                                        |
| `NEGENTROPY_PERCEIVES_PDF_TABLE_QUALITY_FILTER_ENABLED`   | `bool` | `true`  | -                               | 启用表格质量启发式过滤（剔除空白率高/弱列/同值伪表）            |
| `NEGENTROPY_PERCEIVES_PDF_TABLE_QUALITY_MIN_OCCUPANCY`    | `float`| `0.40`  | `[0.0, 1.0]`                    | 非空单元格占比下限；低于则判定伪表格                             |
| `NEGENTROPY_PERCEIVES_PDF_TABLE_QUALITY_MAX_WEAK_COLS_RATIO` | `float` | `0.5` | `[0.0, 1.0]`                  | 弱列数占比上限（弱列 = 非空率 < 40% 的列）                       |
| `NEGENTROPY_PERCEIVES_PDF_TABLE_QUALITY_MIN_UNIQUE_CELLS` | `int`  | `3`     | `>= 1`                          | 全表去重后单元格种类数下限；≤ 该值判定伪表格                     |
| `NEGENTROPY_PERCEIVES_PDF_TABLE_QUALITY_PROSE_ROWS_THRESHOLD` | `int` | `50`  | `>= 2`                          | 信号 a 行数阈值；> 该值且列数 ≤ prose_cols_max 时判定为正文段落  |
| `NEGENTROPY_PERCEIVES_PDF_TABLE_QUALITY_PROSE_COLS_MAX`   | `int`  | `3`     | `>= 1`                          | 信号 a 列数上限；列数 ≤ 该值时启用正文段落检测                   |
| `NEGENTROPY_PERCEIVES_PDF_TABLE_QUALITY_PROSE_FRAGMENT_RATIO` | `float` | `0.5` | `[0.0, 1.0]`                | 信号 b 单词断裂率阈值；超过该值视为正文段落                       |
| `NEGENTROPY_PERCEIVES_PDF_TABLE_QUALITY_BYPASS_WITH_TITLE` | `bool` | `true`  | -                              | 含 `Table N:` 标题的候选跳过 prose 检测信号                     |
| `NEGENTROPY_PERCEIVES_PDF_STAGE_TIMEOUT_MULTIPLIER`       | `float`| `1.0`   | `(0.0, 10.0]`                   | Pipeline 各 Stage timeout 全局倍率；> 1 放宽，< 1 收紧           |
| `NEGENTROPY_PERCEIVES_PDF_IMAGE_EXTRACTION_CONCURRENCY`   | `int`  | `8`     | `[1, 32]`                       | image_extraction Stage 的页级并发上限                            |
| `NEGENTROPY_PERCEIVES_PDF_PYMUPDF_PARALLEL_PAGES`         | `int`  | `0`     | `>= 0`                          | PyMuPDF text/image Stage 内多页并行 chunk 大小；0 = 自动按 CPU 推断（`max(1, min(8, cpu//2))`，Apple Silicon E-core 不参与），>0 显式覆盖；<10 页强制串行 |
| `NEGENTROPY_PERCEIVES_PDF_DOCLING_FORCE_CPU`              | `bool` | `false` | -                               | 强制 Docling 在 CPU 推理（诊断/MPS 兼容性回退）                  |
| `NEGENTROPY_PERCEIVES_PDF_DOCLING_MPS_ENRICHMENT`         | `str`  | `granite_mlx` | `granite_mlx` / `disable` | Apple Silicon MPS 下 Docling code/formula enrichment 策略；`granite_mlx` 需安装 `docling-mlx` extra |
| `NEGENTROPY_PERCEIVES_PDF_ENGINE_WARMUP_ENABLED`          | `bool` | `true`  | -                               | preprocessing/quick_scan 期间异步预热 docling/mineru/marker     |
| `NEGENTROPY_PERCEIVES_PIPELINE_ENGINE_SELECTOR`           | `str`  | `profile_aware` | `profile_aware` / `identity` | Adaptive Engine Selection 策略；`profile_aware`（默认）基于 `DocumentCharacteristics` 动态重排 Stage tools 与短路无关 Stage，`identity` 保持 YAML 静态顺序回退 |
| `NEGENTROPY_PERCEIVES_PIPELINE`                           | `dict` | `null`  | -                               | Pipeline Stage 编排配置（PDF/WebPage 处理管线），嵌套结构不展平 |

### 配置验证规则

#### 字段验证器

系统内置三个 `@field_validator`，在加载时自动规范化输入：

- **`log_level`** — 自动转为大写，仅接受 `DEBUG`、`INFO`、`WARNING`、`ERROR`、`CRITICAL`
- **`transport_mode`** — 自动转为小写，仅接受 `stdio`、`http`、`sse`
- **`accelerator_device`** — 自动转为小写，仅接受 `auto`、`cpu`、`cuda`、`mps`、`xpu`

#### 配置不可变性

全局实例 `settings` 通过 `frozen=True` 配置为不可变对象，创建后不可修改，保障运行时配置一致性。

### 配置管理最佳实践

- `~/.negentropy/perceives.config.yaml` — 用户本地配置（不纳入版本控制）
- `--init-config` — 从内置模板生成初始用户配置
- `-c /path/to/config.yaml` — 显式指定自定义配置文件（适用于多环境部署）
- 环境变量 `NEGENTROPY_PERCEIVES_*` — 容器化/CI 场景下的配置方式
- 启用代理时务必同时配置 `proxy_url`，否则启动验证将报错

## MCP 工具参考

### 工具总览

Negentropy Perceives 提供 **6 个 MCP 工具**，分布在 3 个领域模块中：

| 工具名称                                | 模块              | 功能                     | 返回类型               |
| --------------------------------------- | ----------------- | ------------------------ | ---------------------- |
| `discover_links`                         | `extraction.py`   | 提取网页链接 + 域名过滤  | `LinksResponse`        |
| `inspect_page`                         | `extraction.py`   | 获取页面元数据           | `PageInfoResponse`     |
| `parse_webpage_to_markdown`           | `markdown.py`     | 网页 → Markdown          | `MarkdownResponse`     |
| `parse_webpages_to_markdown`    | `markdown.py`     | 批量网页 → Markdown      | `BatchMarkdownResponse`|
| `parse_pdf_to_markdown`               | `pdf.py`          | PDF → Markdown           | `PDFResponse`          |
| `parse_pdfs_to_markdown`                 | `pdf.py`          | 批量 PDF → Markdown      | `BatchPDFResponse`     |

### 返回值规范

所有工具使用强类型的 Pydantic BaseModel 定义返回值：

- **`success`**: `bool` — 操作是否成功
- **`error`**: `Optional[str]` — 失败时的错误信息
- **`conversion_time`**: `float` — 处理耗时（秒），大部分工具包含此字段

### 1. discover_links — 链接提取

从网页中提取所有链接，支持域名过滤和内外链分类。

**参数：**

| 参数              | 类型              | 必填 | 默认值  | 说明                     |
| ----------------- | ----------------- | ---- | ------- | ------------------------ |
| `url`             | `str`             | 是   | -       | 目标网页 URL             |
| `filter_domains`  | `List[str]`       | 否   | `null`  | 白名单域名（仅返回这些） |
| `exclude_domains` | `List[str]`       | 否   | `null`  | 黑名单域名（排除这些）   |
| `internal_only`   | `bool`            | 否   | `false` | 仅返回同域名内部链接     |

**使用示例：**

```json
{
  "url": "https://example.com",
  "filter_domains": ["example.com", "blog.example.com"],
  "exclude_domains": ["ads.example.com"],
  "internal_only": false
}
```

**返回结果（`LinksResponse`）：**

```json
{
  "success": true,
  "url": "https://example.com",
  "total_links": 45,
  "internal_links_count": 32,
  "external_links_count": 13,
  "links": [
    {"url": "https://example.com/about", "text": "关于我们", "is_internal": true},
    {"url": "https://partner.com", "text": "合作伙伴", "is_internal": false}
  ]
}
```

### 2. inspect_page — 页面信息

快速获取网页基础元数据——轻量级工具，不抓取完整内容。

**参数：**

| 参数  | 类型  | 必填 | 默认值 | 说明        |
| ----- | ----- | ---- | ------ | ----------- |
| `url` | `str` | 是   | -      | 目标网页 URL |

**返回结果（`PageInfoResponse`）：**

```json
{
  "success": true,
  "url": "https://example.com",
  "title": "Example Website",
  "description": "This is an example website",
  "status_code": 200,
  "content_type": "text/html",
  "content_length": 15420
}
```

### 3. parse_webpage_to_markdown — 网页转 Markdown

将网页内容转换为结构化 Markdown。核心转换工具，支持多种抓取策略和高级格式化。

**抓取方法（`method` 参数）：**

| 方法                | 说明                                         |
| ------------------- | -------------------------------------------- |
| `auto`              | 智能选择（**推荐**，优先尝试 Pipeline 路径） |
| `simple`            | 快速 HTTP 请求，适合静态网页                 |
| `selenium`          | 浏览器渲染，支持 JavaScript 动态页面         |
| `stealth_selenium`  | 隐身 Selenium，绕过反爬虫检测                |
| `stealth_playwright`| 隐身 Playwright，更轻量的反检测方案          |

**关键参数：**

| 参数                  | 类型              | 默认值 | 说明                                             |
| --------------------- | ----------------- | ------ | ------------------------------------------------ |
| `url`                 | `str`             | 必填   | 目标网页 URL                                     |
| `method`              | `ScrapeMethod`    | `auto` | 抓取方法                                         |
| `extract_main_content`| `bool`            | `true` | 仅提取主要内容（排除导航、广告、侧边栏）         |
| `include_metadata`    | `bool`            | `true` | 包含页面元数据（标题、描述、字数等）             |
| `embed_images`        | `bool`            | `false`| 将图片以 data URI 嵌入 Markdown                  |
| `formatting_options`  | `Dict[str, bool]` | `null` | 高级格式化选项（表格对齐、代码检测等）           |
| `custom_options`      | `Dict[str, Any]`  | `null` | 自定义 markitdown 转换选项                       |
| `wait_for_element`    | `str`             | `null` | Selenium 模式下等待加载的 CSS 选择器             |

**使用示例：**

```json
{
  "url": "https://example.com/article",
  "method": "auto",
  "extract_main_content": true,
  "formatting_options": {
    "table_alignment": true,
    "code_detection": true
  }
}
```

**返回结果（`MarkdownResponse`）：**

```json
{
  "success": true,
  "url": "https://example.com/article",
  "method": "pipeline_auto",
  "markdown_content": "# 文章标题\n\n这是文章的主要内容...",
  "metadata": {
    "title": "文章标题",
    "description": "文章描述",
    "word_count": 1250
  },
  "word_count": 1250,
  "images_embedded": 0,
  "conversion_time": 1.23
}
```

> **Pipeline 自动降级**：`method="auto"` 时，工具会优先尝试 Pipeline 路径（Stage 化管线处理）。如果 Pipeline 不可用或执行失败，自动降级到传统的 web_scraper + markdown_converter 路径。两种路径对用户透明，无需额外配置。

### 4. parse_webpages_to_markdown — 批量网页转 Markdown

并发处理多个网页的 Markdown 转换。参数与单页工具基本一致，将 `url` 替换为 `urls` 列表即可。

**使用示例：**

```json
{
  "urls": [
    "https://blog.example.com/post1",
    "https://blog.example.com/post2",
    "https://blog.example.com/post3"
  ],
  "method": "auto",
  "extract_main_content": true
}
```

**返回结果（`BatchMarkdownResponse`）：**

```json
{
  "success": true,
  "total_urls": 3,
  "successful_count": 3,
  "failed_count": 0,
  "results": [
    {"success": true, "url": "https://blog.example.com/post1", "markdown_content": "...", "word_count": 800},
    {"success": true, "url": "https://blog.example.com/post2", "markdown_content": "...", "word_count": 1200},
    {"success": true, "url": "https://blog.example.com/post3", "markdown_content": "...", "word_count": 950}
  ],
  "total_word_count": 2950,
  "total_conversion_time": 3.45
}
```

### 5. parse_pdf_to_markdown — PDF 转 Markdown

将 PDF 文档转换为 Markdown 格式。这是 Negentropy Perceives 的王牌工具——支持 7 种提取方法、图像/表格/公式提取、Pipeline 编排和 LLM 智能融合。

**提取方法（`method` 参数）：**

| 方法      | 说明                                                                   |
| --------- | ---------------------------------------------------------------------- |
| `auto`    | 自动选择最佳引擎（**推荐**，优先 Docling → Pipeline 编排）            |
| `smart`   | LLM 编排多引擎并行处理 + 择优融合（最高质量，需配置 LLM API Key）     |
| `docling` | Docling 引擎，AI 布局分析 + TableFormer 表格 + 代码检测（GPU 加速）   |
| `mineru`  | MineRU 引擎，深度学习文档结构分析，擅长学术论文与多栏排版             |
| `marker`  | Marker 引擎，基于 Nougat 模型，擅长学术文档，保留公式与结构化排版     |
| `pymupdf` | PyMuPDF 引擎，快速处理，适合简单文档                                   |
| `pypdf`   | PyPDF 引擎，纯文本提取，适合最简单的 PDF                               |

**关键参数：**

| 参数              | 类型              | 默认值       | 说明                                     |
| ----------------- | ----------------- | ------------ | ---------------------------------------- |
| `pdf_source`      | `str`             | 必填         | PDF URL 或本地文件绝对路径               |
| `method`          | `PDFMethod`       | `auto`       | 提取方法                                 |
| `include_metadata`| `bool`            | `true`       | 包含 PDF 元数据（标题、作者、页数等）   |
| `page_range`      | `List[int]`       | `null`       | 页面范围 `[start, end]`（页码从 0 开始） |
| `output_format`   | `str`             | `markdown`   | 输出格式（`markdown` / `text`）          |
| `extract_images`  | `bool`            | `true`       | 提取图像                                 |
| `extract_tables`  | `bool`            | `true`       | 提取表格                                 |
| `extract_formulas`| `bool`            | `true`       | 提取数学公式（保持 LaTeX 格式）         |
| `embed_images`    | `bool`            | `false`      | 将图像以 base64 嵌入 Markdown            |
| `enhanced_options`| `Dict[str, Any]`  | `null`       | 增强处理选项（output_dir, image_size 等） |

**基础使用：**

```json
{
  "pdf_source": "https://example.com/document.pdf",
  "method": "auto",
  "page_range": [0, 10]
}
```

**启用所有增强功能：**

```json
{
  "pdf_source": "https://example.com/document.pdf",
  "method": "docling",
  "extract_images": true,
  "extract_tables": true,
  "extract_formulas": true,
  "embed_images": false,
  "enhanced_options": {
    "output_dir": "./extracted_assets",
    "image_size": [800, 600]
  }
}
```

**返回结果（`PDFResponse`）：**

```json
{
  "success": true,
  "pdf_source": "https://example.com/document.pdf",
  "method": "pipeline_auto",
  "output_format": "markdown",
  "content": "# 文档标题\n\n转换后的 Markdown 内容...",
  "metadata": {
    "title": "文档标题",
    "author": "作者姓名",
    "total_pages": 50,
    "pages_processed": 10
  },
  "page_count": 10,
  "word_count": 2500,
  "conversion_time": 5.67,
  "enhanced_assets": {
    "images_extracted": 3,
    "tables_extracted": 2,
    "formulas_extracted": 5,
    "code_blocks_detected": 1,
    "engines_used": ["docling"]
  }
}
```

> **引擎门控**：`docling_enabled`、`opendataloader_enabled`、`mineru_enabled`、`marker_enabled` 四个环境变量控制各引擎的可用性（默认均为 `true`）。未安装对应依赖的引擎会自动跳过（`is_available()` 检测），不会报错；如需在已安装环境下显式禁用某引擎，可通过环境变量或 YAML 覆盖为 `false`。

#### 启用 PDF 引擎（Docling / OpenDataLoader / MinerU / Marker / PyMuPDF）

核心包包含 `PyMuPDF` 与 `Docling`。要让 `layout_analysis` / `table_extraction` / `formula_extraction` / `code_detection` 等 Stage 充分发挥能力（默认已切换为单引擎降级模式，rank=1 默认为 Docling/MinerU），请参照 [开发指南 · 详细环境配置](development.md#详细环境配置) 通过 `all-engines` 或单独 extras 安装可选依赖。

Apple Silicon 上如果希望 Docling 的 code/formula enrichment 也走 GPU 路径，需要安装 `docling-mlx` extra。它与 `marker` / `all-engines` 互斥：`mlx-vlm` 需要 `transformers>=5.1`，而当前 `marker-pdf` 需要 `transformers<5.0`。必须同时使用 Marker 时，可设置 `NEGENTROPY_PERCEIVES_PDF_DOCLING_MPS_ENRICHMENT=disable`，避免 Docling 默认 CodeFormulaV2 静默回 CPU。

服务首次调用 PDF 管线时，日志会打印 `[PDF engines]` 可用性摘要：

```text
[PDF engines] docling=ok(docling), mineru=missing, marker=ok(marker_pdf), pymupdf=ok(fitz)
[PDF engines] 部分引擎未安装：mineru。参考 docs/development.md 的 all-engines extras 指引补齐依赖。
```

每个 Stage 启动时打印 `Stage '...' 参与竞争 tools=[...]` 日志：**默认配置下** 该日志只列出单一 rank=1 引擎；启用 `competition_mode: true` 后才会看到多引擎并列竞争。

> **预热模型（推荐）**：安装完引擎后，首次请求会现场下载 ~1.35GB 的 Marker
> Layout 模型，极易触发 Stage 超时。请先执行 `uv run perceives prefetch-models`
> 将 Docling/Marker/MinerU 模型一次性预下载到本地缓存；详见
> [开发指南 · 模型预热（推荐）](development.md#模型预热推荐)。

#### 切换运行模式：降级（默认）vs 竞争

自 2026-05 起，6 个原本启用竞争模式的 Stage（PDF `layout_analysis` / `table_extraction` / `formula_extraction` / `code_detection`，WebPage `main_content_extraction` / `markdown_conversion`）默认改走降级模式：仅运行各 Stage 的 rank=1 最佳引擎以减少 CPU/GPU/内存开销，fallback 路径无 stage 级硬切超时，rank=1 引擎可充分跑满（顶层 `task_timeout_seconds=900s` 兜底）。

如果你需要追求多视图融合或可靠性兜底（资源开销更高），可在 `~/.negentropy/perceives.config.yaml` 中显式覆写单个 Stage 的 `competition_mode`：

```yaml
pipeline:
  pdf:
    stages:
      - name: layout_analysis
        competition_mode: true # 启用 4 引擎竞争 + LLM 评审择优
      - name: table_extraction
        competition_mode: true
```

YAML 采用深度合并（深层差异覆盖），仅显式列出的 Stage 行为切换，其余 Stage 仍保持默认。

**超大 PDF 提示**：rank=1 引擎单跑虽避免了竞争模式下"等首胜+取消"的 5s grace 浪费，但 200+ 页学术文档仍可能逼近 `task_timeout_seconds=900s` 顶层预算。可通过 MCP 入参 `timeout=1800` 或 YAML 覆写 `task_timeout_seconds: 1800` 提高单任务预算。

### 6. parse_pdfs_to_markdown — 批量 PDF 转 Markdown

并发处理多个 PDF 文档的 Markdown 转换。参数与单文件工具基本一致，将 `pdf_source` 替换为 `pdf_sources` 列表即可。

**使用示例：**

```json
{
  "pdf_sources": [
    "https://example.com/doc1.pdf",
    "/local/path/doc2.pdf",
    "https://example.com/doc3.pdf"
  ],
  "method": "auto",
  "extract_images": true,
  "extract_tables": true,
  "extract_formulas": true
}
```

**返回结果（`BatchPDFResponse`）：**

```json
{
  "success": true,
  "total_pdfs": 3,
  "successful_count": 2,
  "failed_count": 1,
  "results": [
    {"success": true, "pdf_source": "https://example.com/doc1.pdf", "content": "...", "page_count": 10, "word_count": 1500},
    {"success": true, "pdf_source": "/local/path/doc2.pdf", "content": "...", "page_count": 25, "word_count": 5000}
  ],
  "total_pages": 35,
  "total_word_count": 6500,
  "total_conversion_time": 12.34
}
```

## API 编程接口

### Python SDK

[`NegentropyPerceivesClient`](../../apps/negentropy-perceives/src/negentropy/perceives/sdk.py) 是官方 Python SDK，基于 FastMCP Client 封装，提供类型化便捷方法。

#### 连接服务

```python
from negentropy.perceives.sdk import NegentropyPerceivesClient

# 基础连接（默认 http://localhost:2992/mcp）
async with NegentropyPerceivesClient() as client:
    tools = await client.list_tools()
    print([tool.name for tool in tools])

# 自定义端点 + 认证头
async with NegentropyPerceivesClient(
    "http://api.example.com:8081/mcp",
    headers={"X-API-Key": "your-key"},
) as client:
    result = await client.call_tool("inspect_page", {"url": "https://example.com"})
```

#### 通用工具调用

```python
# call_tool() 可以调用任意 MCP 工具
result = await client.call_tool(
    "discover_links",
    {"url": "https://example.com", "internal_only": True},
)

# 带超时控制
result = await client.call_tool(
    "parse_pdf_to_markdown",
    {"pdf_source": "paper.pdf", "method": "auto"},
    timeout=60.0,
)
```

#### 类型化便捷方法

```python
# 网页转 Markdown（便捷封装）
result = await client.parse_webpage_to_markdown(
    url="https://example.com/docs",
    method="auto",
    extract_main_content=True,
)
```

### 核心引擎直接调用

如果不通过 MCP 协议，也可以直接使用核心引擎类：

```python
from negentropy.perceives.scraping import WebScraper
from negentropy.perceives.markdown.converter import MarkdownConverter

# 网页抓取
scraper = WebScraper()
scrape_result = await scraper.scrape_url("https://example.com", method="simple")

# Markdown 转换
converter = MarkdownConverter()
md_result = converter.parse_webpage_to_markdown(
    scrape_result=scrape_result,
    extract_main_content=True,
)
```

## 高级使用场景

### 1. 批量文档归档

将整个网站的内容批量转换为 Markdown，适合知识库构建和内容归档：

```python
from negentropy.perceives.sdk import NegentropyPerceivesClient

async def archive_website(base_url: str, page_urls: list[str]):
    async with NegentropyPerceivesClient() as client:
        # 批量转换
        result = await client.call_tool(
            "parse_webpages_to_markdown",
            {
                "urls": page_urls,
                "method": "auto",
                "extract_main_content": True,
                "include_metadata": True,
            },
        )
        return result
```

### 2. 学术论文处理

PDF 转 Markdown 的杀手级场景——表格、公式、图片一次搞定：

```python
async def process_papers(pdf_paths: list[str]):
    async with NegentropyPerceivesClient() as client:
        result = await client.call_tool(
            "parse_pdfs_to_markdown",
            {
                "pdf_sources": pdf_paths,
                "method": "auto",
                "extract_images": True,
                "extract_tables": True,
                "extract_formulas": True,
                "output_format": "markdown",
            },
        )
        return result
```

### 3. 网站链接地图构建

提取网站的所有链接，用于 SEO 分析或站点地图构建：

```python
async def build_link_map(target_url: str):
    async with NegentropyPerceivesClient() as client:
        # 获取所有内部链接
        result = await client.call_tool(
            "discover_links",
            {"url": target_url, "internal_only": True},
        )
        return result
```

### 4. LLM 智能编排（Smart 模式）

使用 `method="smart"` 启用 LLM 编排多引擎并行处理，自动择优融合最佳输出。适用于含公式、表格、代码、图像的复杂学术文档——让 AI 帮你挑最好的结果。

**前置条件**：安装 `litellm`（`uv pip install litellm`），并配置 `OPENAI_API_KEY` 或 `NEGENTROPY_PERCEIVES_LLM_API_KEY` 环境变量。

```python
async def smart_pdf_processing():
    async with NegentropyPerceivesClient() as client:
        result = await client.call_tool(
            "parse_pdf_to_markdown",
            {
                "pdf_source": "complex_paper.pdf",
                "method": "smart",
                "extract_formulas": True,
                "extract_images": True,
                "extract_tables": True,
            },
        )
        return result
```

> LLM 编排环境变量见 [LLM 编排（Smart 模式）](#llm-编排smart-模式)。

### 5. 技术文档转换

将技术手册 PDF 转换为结构化 Markdown，提取所有图片、表格和公式：

```python
async def convert_technical_manual():
    async with NegentropyPerceivesClient() as client:
        result = await client.call_tool(
            "parse_pdf_to_markdown",
            {
                "pdf_source": "technical_manual.pdf",
                "method": "docling",
                "extract_images": True,
                "extract_tables": True,
                "embed_images": True,
                "enhanced_options": {
                    "output_dir": "./extracted_assets",
                    "image_size": [1200, 900],
                },
            },
        )
        return result
```

### 6. GPU 加速 PDF 处理

Docling 引擎支持 GPU 加速，处理速度可提升数倍：

```bash
# Apple Silicon (MPS) — 自动检测，无需配置
NEGENTROPY_PERCEIVES_DOCLING_ENABLED=true negentropy-perceives

# NVIDIA GPU (CUDA) — 自动检测，无需配置
NEGENTROPY_PERCEIVES_DOCLING_ENABLED=true negentropy-perceives

# 显式指定设备
NEGENTROPY_PERCEIVES_ACCELERATOR_DEVICE=cuda NEGENTROPY_PERCEIVES_DOCLING_ENABLED=true negentropy-perceives
```

### 7. 硬件加速配置

PDF 处理（尤其是 Docling 引擎的 OCR、表格识别、公式提取）支持 GPU 加速。

**环境变量：**

| 环境变量                                             | 类型  | 默认值 | 约束                                    | 说明                                               |
| ---------------------------------------------------- | ----- | ------ | --------------------------------------- | -------------------------------------------------- |
| `NEGENTROPY_PERCEIVES_ACCELERATOR_DEVICE`            | `str` | `auto` | `auto` / `cpu` / `cuda` / `mps` / `xpu` | 推理设备选择，按运行环境自动或显式指定             |
| `NEGENTROPY_PERCEIVES_ACCELERATOR_NUM_THREADS`       | `int` | `4`    | `>= 1`                                  | CPU 推理线程数                                     |
| `NEGENTROPY_PERCEIVES_ACCELERATOR_OCR_BATCH_SIZE`    | `int` | `0`    | `>= 0`                                  | OCR 推理 batch size（0 = 根据设备显存自动推断）    |
| `NEGENTROPY_PERCEIVES_ACCELERATOR_LAYOUT_BATCH_SIZE` | `int` | `0`    | `>= 0`                                  | Layout 推理 batch size（0 = 根据设备显存自动推断） |
| `NEGENTROPY_PERCEIVES_ACCELERATOR_TABLE_BATCH_SIZE`  | `int` | `0`    | `>= 0`                                  | Table 推理 batch size（0 = 根据设备显存自动推断）  |

> **Batch Size 自动推断**：当值为 `0` 时，系统根据检测到的设备类型和可用显存自动推断最优 batch size。GPU 设备通常可从默认值 4 提升至 8-64，显著提升批处理吞吐量。手动设置非零值将覆盖自动推断结果。

#### 设备自动检测优先级

系统按以下顺序检测可用设备（`auto` 模式）：

1. **CUDA** (NVIDIA GPU) — 通过 `torch.cuda.is_available()` 检测
2. **MPS** (Apple Silicon) — 通过 `torch.backends.mps.is_available()` 检测
3. **XPU** (Intel GPU) — 通过 `torch.xpu.is_available()` 检测
4. **CPU** — 通用回退

#### 平台特定行为

##### Apple Silicon (MPS)

| 特性               | 行为                    | 原因                                                                                         |
| ------------------ | ----------------------- | -------------------------------------------------------------------------------------------- |
| Formula Enrichment | **自动禁用**            | Docling CodeFormula VLM 不支持 MPS，启用时整个管道回退 CPU<sup>[[1]](#ref-mps-formula)</sup> |
| Flash Attention 2  | 不可用                  | 仅 CUDA 支持                                                                                 |
| Batch Sizes        | 自动优化                | 基于统一内存大小推断（8-32），详见下表                                                       |
| OCR 引擎           | macOS Vision 可选       | 自动偏好 `OcrMacOptions`（Apple Vision Framework 原生 OCR）                                  |
| TableFormer        | 透明回退 CPU            | Docling 内部处理，无需干预                                                                   |
| 公式降级           | Markdown 正则 + PyMuPDF | 参考 [`math_formula.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pdf/math_formula.py)                    |

> **注意**：公式提取被禁用后，系统自动通过 PyMuPDF 字体分析 + Unicode→LaTeX 映射进行降级补偿，覆盖大部分常见数学公式场景。

##### NVIDIA CUDA

| 特性              | 行为                  | 原因                                               |
| ----------------- | --------------------- | -------------------------------------------------- |
| Flash Attention 2 | **自动启用**          | 需安装 `flash-attn` 包（`pip install flash-attn`） |
| Batch Sizes       | 自动优化              | 基于专用显存大小推断（8-64），详见下表             |
| 全功能支持        | Formula + Table + OCR | 所有 Docling 功能完全兼容                          |

##### Batch Size 自动推断规则

| 设备类型 | 可用显存 | ocr / layout batch | table batch |
| -------- | -------- | ------------------ | ----------- |
| **CPU**  | -        | 4                  | 4           |
| **MPS**  | < 12 GB  | 8                  | 4           |
| **MPS**  | 12-24 GB | 12                 | 6           |
| **MPS**  | 24-48 GB | 16                 | 8           |
| **MPS**  | >= 48 GB | 32                 | 16          |
| **CUDA** | < 8 GB   | 8                  | 4           |
| **CUDA** | 8-12 GB  | 16                 | 8           |
| **CUDA** | 12-24 GB | 32                 | 16          |
| **CUDA** | >= 24 GB | 64                 | 32          |

> MPS 统一内存说明：Apple Silicon 的 GPU 可用显存按物理内存 x 75% 估算。由于统一内存与 CPU 共享，MPS 采用更保守的 batch size 映射。

<a id="ref-mps-formula"></a>[1] MPS + Formula Enrichment 不兼容讨论, https://github.com/docling-project/docling/discussions/2505

## 常见问题

> **配置诊断**：遇到配置相关问题时，服务启动日志会输出配置来源信息。可通过 `uv run python -c "from negentropy.perceives.config import describe_config_sources; print(describe_config_sources())"` 检查配置来源，通过 `uv run negentropy-perceives --init-config` 生成默认用户配置。

### 1. 连接超时

```bash
# 增加超时时间
NEGENTROPY_PERCEIVES_REQUEST_TIMEOUT=60 negentropy-perceives

# 客户端带超时调用
result = await client.call_tool("parse_webpage_to_markdown", {"url": "..."}, timeout=30.0)
```

### 2. JavaScript 内容无法抓取

```bash
# 启用 JavaScript 支持
NEGENTROPY_PERCEIVES_ENABLE_JAVASCRIPT=true negentropy-perceives
```

使用 `selenium` 方法并配合 `wait_for_element`：

```json
{
  "url": "https://example.com",
  "method": "selenium",
  "wait_for_element": ".dynamic-content"
}
```

### 3. 端口被占用

```bash
# 检查端口占用
netstat -tlnp | grep 2992
# 更换端口
NEGENTROPY_PERCEIVES_HTTP_PORT=8082 negentropy-perceives
```

### 4. 配了 YAML 但端口没生效

```bash
# 检查当前入口
which negentropy-perceives
# 检查最终配置
uv run python -c "from negentropy.perceives.config import settings; print(settings.model_dump())"
# 检查用户配置文件
cat ~/.negentropy/perceives.config.yaml
```

### 5. CORS 错误

```bash
NEGENTROPY_PERCEIVES_HTTP_CORS_ORIGINS="http://localhost:3000,https://yourdomain.com" negentropy-perceives
```

### 6. 代理配置不生效

```bash
# 必须同时启用代理开关和配置代理 URL
NEGENTROPY_PERCEIVES_USE_PROXY=true \
NEGENTROPY_PERCEIVES_PROXY_URL=http://proxy.example.com:8080 \
negentropy-perceives
```

### 7. 缓存导致内容陈旧

```bash
# 禁用缓存或缩短 TTL
NEGENTROPY_PERCEIVES_ENABLE_CACHING=false negentropy-perceives
# 或调整缓存生存时间
NEGENTROPY_PERCEIVES_CACHE_TTL_HOURS=1 negentropy-perceives
```

### 8. GPU 加速不生效

```bash
# 显式指定设备
NEGENTROPY_PERCEIVES_ACCELERATOR_DEVICE=cuda negentropy-perceives  # NVIDIA GPU
NEGENTROPY_PERCEIVES_ACCELERATOR_DEVICE=mps negentropy-perceives   # Apple Silicon
```

> 设备检测优先级、batch size 自动推断规则见 [硬件加速配置](#7-硬件加速配置)。

## 相关文档

| 文档                                           | 内容                         | 适用读者        |
| ---------------------------------------------- | ---------------------------- | --------------- |
| [架构设计](./framework.md)                     | 系统架构与设计原则           | 架构师 / 贡献者 |
| [开发指南](./development.md)                   | 环境搭建、编码规范、CI/CD    | 开发者          |
| [开发指南 > 测试](./development.md#测试)       | 测试体系与执行方法           | 开发者 / QA     |
| [用户指南 > MCP Server 配置](#mcp-server-配置) | 环境变量与配置管理           | 运维 / 开发者   |
