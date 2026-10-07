# lcc-multiagent--panorama 图意简述

供 archify 四件套统一渲染用（编排者操作，本笔记不自跑 archify）。

- **图型**：flowchart（workflow）。
- **图意**：Learn Claude Code「多 Agent 平台」部分的全貌——把一个 Agent 变成一群需要补齐的六类朴素设施（任务板、收件箱、协议、自治认领、worktree 施工面、外部工具池），全部落在文件系统上；Lead 与持久队友各自跑同一个结构的循环，通过收件箱与任务板协作，最后全部机制挂回 Lead 的一个 while True。
- **三个容器**：LEAD（主循环与工具执行）、FAC（六类设施，横向并列）、MATES（队友的 WORK→IDLE→SHUTDOWN 生命周期）。关键回流边：队友写收件箱 → 统一消费入口（先改协议状态再注入对话）→ 唤醒 Lead 新一轮。
- **色彩语义建议**：LEAD 用主色（决策中枢）、FAC 六节点用同一中性色系（基础设施层）、MATES 用另一色系（执行单元）；「统一消费入口」回流边建议强调色（它是消息语义的正确性关键）。深色模式下全部节点需高对比描边。
- **来源**：docs/research/agent-harness/175-claude-code-multi-agent-platform.md（%% source 行已回链）。
