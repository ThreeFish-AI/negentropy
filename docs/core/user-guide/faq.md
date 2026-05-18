# 常见问题

> 本文从用户手册拆分而来，原路径 [docs/user-guide.md](../../user-guide.md)。

## 9. 常见问题

### 9.1 对话相关

**Q: Agent 没有响应怎么办？**

检查以下几点：
1. 确认后端服务已启动（`http://localhost:8000`）
2. 查看连接状态指示器是否从 `idle` 变为 `connecting`
3. 检查右侧 LogBufferPanel 是否有错误日志
4. 确认 LLM 模型配置正确（Interface > Models，Ping 测试通过）

**Q: 标题栏显示「等待确认」无法继续？**

这是 HITL 确认机制。在 ChatStream 中找到确认卡片，选择「确认」「修正」或「补充」操作后，Agent 才会继续执行。

**Q: 如何回到之前的对话？**

点击左侧 SessionList 中的历史会话即可切换。中间区域会加载历史消息，右侧面板加载历史事件。

**Q: 调试面板中 EventTimeline 和 LogBuffer 有什么区别？**

- **EventTimeline**：展示 Agent 执行过程中的结构化事件（工具调用、状态变更等），面向业务逻辑
- **LogBufferPanel**：展示系统日志（info/warn/error），面向运维排错

### 9.2 知识库相关

**Q: 摄取文档后搜索不到相关内容？**

1. 确认文档摄取状态为 Completed（在 Pipeline Runs 中查看）
2. 检查分块策略配置是否适合你的文档类型
3. 尝试调整搜索查询，使用更具体的关键词
4. 确认 Embedding 模型配置正确（Interface > Models）

**Q: 如何选择合适的分块策略？**

| 策略             | 适用场景                         |
| :--------------- | :------------------------------- |
| **Fixed**        | 结构统一的文档（日志、表格）     |
| **Recursive**    | 通用场景，按分隔符递归切分       |
| **Semantic**     | 语义密集的文档（论文、技术文档） |
| **Hierarchical** | 层次化文档（书籍、手册）         |

**Q: 知识图谱为空怎么办？**

知识图谱需要手动触发构建。进入 Graph 页面，确认已有文档摄取完成，然后触发图谱构建。

### 9.3 记忆系统相关

**Q: 记忆为什么会被遗忘？**

系统基于 Ebbinghaus 遗忘曲线模型计算记忆的保留分数。长期未被访问的记忆，保留分数会逐渐降低。这是系统的自我净化机制，避免无效信息堆积。

**Q: 如何手动保留低保留分数的记忆？**

进入 Memory > Audit 页面，选择用户和目标记忆，执行「Retain」操作。

**Q: 自动化任务未执行？**

确认 Automation 页面中 pg_cron 状态为正常，相关 Job 已启用（`enabled = true`），且 `schedule` 配置正确。

### 9.4 管理后台相关

**Q: 无法访问 Admin 模块？**

Admin 模块需要 `admin` 角色。联系系统管理员为你的账户分配 admin 角色（Admin > Users）。

**Q: 模型 Ping 测试失败？**

1. 检查 API Key 是否正确
2. 检查 API Base URL 是否可访问
3. 检查网络连接（尤其是需要代理访问的供应商）
4. 确认模型名称是否与供应商提供的模型 ID 一致

**Q: 如何切换默认模型？**

进入 Interface > Models，找到目标模型，点击「设为默认」按钮。每种模型类型（LLM/Embedding/Rerank）可独立设置默认模型。

### 9.5 Wiki 相关

**Q: Wiki 页面内容不更新？**

Wiki 使用 ISR 机制，最长 5 分钟自动更新。如需立即更新，可在知识库中重新发布 Wiki Publication。

**Q: 构建失败怎么办？**

检查 Pipeline Runs 中的错误信息，确认文档内容格式正确（支持 Markdown），且相关依赖服务（如数学公式渲染）可用。

---

## 附录 A：术语表

| 术语     | 英文                            | 说明                                               |
| :------- | :------------------------------ | :------------------------------------------------- |
| 熵减     | Negentropy                      | 对抗知识无序化的系统理念，源自薛定谔《生命是什么》 |
| 系部     | Faculty                         | 负责特定认知功能的智能体子单元                     |
| 流水线   | Pipeline                        | 预定义的多系部协作序列                             |
| 会话     | Session                         | 一次独立对话的容器                                 |
| 语料库   | Corpus                          | 一组相关文档的集合                                 |
| 分块     | Chunk                           | 文档被切分后的最小检索单元                         |
| 嵌入     | Embedding                       | 文本转换为向量表示的过程                           |
| 记忆     | Memory                          | 系统持久化的知识条目                               |
| 事实     | Fact                            | 结构化的键值对知识                                 |
| 保留分数 | Retention Score                 | 衡量记忆重要性的指标（基于遗忘曲线）               |
| 审计     | Audit                           | 对记忆的合规治理操作（保留/删除/匿名化）           |
| MCP      | Model Context Protocol          | 连接外部工具的标准协议                             |
| Skill    | Skill                           | 预定义的 Prompt 模板，为 Agent 赋能特定能力        |
| 子智能体 | SubAgent                        | 可被 Agent 委派任务的独立智能体                    |
| HITL     | Human-in-the-Loop               | 关键决策交由人工确认的机制                         |
| ISR      | Incremental Static Regeneration | 增量静态再生成，定期更新预渲染页面                 |

## 附录 B：环境变量速查表

> 后端完整配置清单请参考 `apps/negentropy/src/negentropy/config/config.default.yaml`（单一事实源），密钥类配置需通过 shell 环境变量或 `apps/negentropy/config.local.yaml` 注入；前端变量请参考 `apps/negentropy-ui/.env.example`。

| 变量名                      | 说明                                          | 默认值                  |
| :-------------------------- | :-------------------------------------------- | :---------------------- |
| `NE_ENV`                    | 运行环境                                      | `development`           |
| `NE_DB_URL`                 | PostgreSQL 连接字符串                         | —                       |
| `NE_LOG_LEVEL`              | 日志级别                                      | `INFO`                  |
| `NE_AUTH_ENABLED`           | 是否启用认证                                  | `true`                  |
| `NE_AUTH_MODE`              | 认证模式 (`off` / `optional` / `strict`)      | `optional`              |
| `NE_SEARCH_PROVIDER`        | 搜索供应商 (`google` / `duckduckgo` / `bing`) | `google`                |
| `ZAI_API_KEY`               | LLM API 密钥                                  | —                       |
| `ZAI_API_BASE`              | LLM API Base URL                              | —                       |
| `AGUI_BASE_URL`             | ADK 后端地址（前端服务端变量）                | `http://localhost:8000` |
| `NEXT_PUBLIC_AGUI_APP_NAME` | 应用名称（前端客户端变量）                    | `negentropy`            |

## 附录 C：文档导航

| 文档                                       | 路径                                  | 说明                               |
| :----------------------------------------- | :------------------------------------ | :--------------------------------- |
| **用户手册**（本文档）                     | [docs/user-guide.md](../../user-guide.md) | 面向最终用户的使用指南             |
| [开发指南](../architecture/development.md)               | `docs/architecture/development.md`                 | 环境搭建、开发工作流、数据库迁移   |
| [架构设计](../architecture/framework.md)                 | `docs/architecture/framework.md`                   | 一核五翼架构、流水线编排、设计模式 |
| [知识系统](../knowledge/design/knowledges.md)                | `docs/knowledges.md`                  | 知识管理模块的详细设计             |
| [记忆系统](../../docs/memory/overview.md)                    | `docs/memory/overview.md`                      | 记忆生命周期与治理机制             |
| [知识图谱](../knowledge/design/kg-overview.md)           | `docs/knowledge-graph/overview.md`             | 图建模与查询实现                   |
| [SSO 集成](../infrastructure/design/sso.md)                       | `docs/sso.md`                         | Google OAuth 认证配置              |
| [QA 流水线](../infrastructure/design/qa-delivery-pipeline.md)     | `docs/qa-delivery-pipeline.md`        | 质量门禁与发布流程                 |
| [Wiki 运维](../../docs/wiki/ops.md)      | `docs/wiki/ops.md`         | Wiki 站点的部署与运维              |
| [工程变更日志](../core/engineering-changelog.md) | `docs/engineering-changelog.md`       | 里程碑与基线变更记录               |
| [AI 协作协议](../AGENTS.md)                | `AGENTS.md`                           | Agent 协作准则与工程规范           |

---

<a id="ref1"></a>[1] E. Schrödinger, "What is Life? The Physical Aspect of the Living Cell," _Cambridge University Press_, 1944.
