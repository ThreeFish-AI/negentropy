# 快速上手

## 2. 快速上手

### 2.1 环境要求

| 依赖                             | 最低版本       | 用途            | 获取方式                                      |
| :------------------------------- | :------------- | :-------------- | :-------------------------------------------- |
| Python                           | 3.13+          | 后端运行时      | [python.org](https://www.python.org/)         |
| [uv](https://docs.astral.sh/uv/) | 最新           | Python 包管理器 | `curl -LsSf https://astral.sh/uv/install.sh   | sh` |
| Node.js                          | 22+            | 前端运行时      | [nodejs.org](https://nodejs.org/)             |
| [pnpm](https://pnpm.io/)         | 最新           | 前端包管理器    | `npm install -g pnpm`                         |
| PostgreSQL                       | 16+ (pgvector) | 数据持久化      | [postgresql.org](https://www.postgresql.org/) |

### 2.2 启动后端服务

```bash
# 1. 克隆仓库
git clone https://github.com/ThreeFish-AI/negentropy.git
cd negentropy

# 2. 进入后端目录
cd apps/negentropy

# 3. 安装依赖
uv sync --dev

# 4. 生成用户级配置文件（首次）
uv run negentropy init    # 写入 ~/.negentropy/config.yaml

# 5. 配置密钥/敏感项（通过 shell 环境变量或 config.local.yaml）
#   export NE_DB_URL=postgresql+asyncpg://user:pass@localhost:5432/negentropy
#   export OPENAI_API_KEY=your-openai-key
#   export ANTHROPIC_API_KEY=your-anthropic-key
# 模型 vendor（OpenAI / Anthropic / Gemini 等）通过 Interface → Models 页动态配置

# 6. 应用数据库迁移
uv run alembic upgrade head

# 7. 启动引擎（开发模式，支持热重载，默认端口 3292）
uv run negentropy serve
```

> 后端服务启动后可访问 `http://localhost:3292`，API 文档自动生成于 `/docs`。

### 2.3 启动前端界面

```bash
# 在新终端窗口中执行
cd apps/negentropy-ui

# 1. 安装依赖
pnpm install

# 2. 启动开发服务器
pnpm run dev
```

> 前端启动后访问 `http://localhost:3192` 即可进入 Negentropy 主界面。

### 2.4 首次对话

```mermaid
sequenceDiagram
    participant U as 👤 用户
    participant UI as 🖥️ 前端界面
    participant BE as ⚙️ 后端引擎

    U->>UI: 打开 localhost:3192
    UI->>UI: 显示三栏布局<br/>（Session 列表 / 聊天区 / 调试面板）
    U->>UI: 在 Composer 输入框输入消息
    UI->>BE: 自动创建 Session<br/>发送用户消息
    BE->>BE: NegentropyEngine 分析意图<br/>委派系部 / 触发流水线
    BE-->>UI: 流式返回 Agent 响应
    UI->>UI: ChatStream 实时渲染<br/>EventTimeline 更新事件
    U->>UI: 阅读 Agent 回复<br/>查看右侧调试信息
```

打开浏览器访问 `http://localhost:3192`，你会看到三栏布局的对话界面：

- **左侧**：Session 列表（当前为空）
- **中间**：聊天区域 + 底部输入框（Composer）
- **右侧**：调试面板（可点击右上角按钮展开）

在底部输入框中输入你的第一条消息，系统会**自动创建 Session** 并开始与 Agent 对话。

> 详细的环境搭建与故障排查，请参阅 [开发指南](../development.md)。
