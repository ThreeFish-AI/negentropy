# lcc-planning--panorama 图意简述

> 供编排者统一渲染 archify 四件套（.mmd 文本源 → HTML → 双主题 PNG → 暗色内嵌 + 索引登记）时理解图意使用；来源笔记：[172-claude-code-planning-coordination.md](../../../research/agent-harness/172-claude-code-planning-coordination.md)。

## 一句话图意

Learn Claude Code「规划与协调」五章的全貌：五个装置中的四个（左侧绿区）通过「每轮可见文本」的通道作用于模型（红色核心），第五装置 s10 组装（紫色台面，另置 ASSEMBLE 区）把运行时真实状态（蓝区）拼进 system prompt，s11 恢复则包住 LLM 调用本身。

## 结构与色彩语义

- **左区（绿）＝四个装置**：s05 TodoWrite、s06 Subagent、s07 Skill Loading、s11 Error Recovery。它们是「往台面上放/挪东西」和「保住台面」的执行者。第五装置 s10 System Prompt 组装不在本区——它是台面本身，另置中区 ASSEMBLE 区承载。s06 的虚线指向 ✕ 表示子代理中间过程被丢弃（只回结论）。
- **下区（蓝）＝运行时真实状态**：工具表、记忆文件、MCP 连接。段加载看状态不看话术，这是 s10 的核心判据。
- **中区（紫）＝组装台面**：system prompt 分段拼装与 messages 对话列表，三通道中的两个（第三个是工具表本身，已并入状态区表达）。
- **红色核心＝模型**：每轮只看当轮可见文本——全图的因果枢纽。
- **灰色＝工具执行**：文件系统副作用对主/子代理共享（s06 边界的另一半）。
- 连线实线＝常规注入通道（tool_result / user 消息 / system prompt 段）；虚线＝非注入关系（过程丢弃、恢复包裹）。

## 深色模式说明

classDef 全部采用暗底亮字（深绿/深蓝/深紫/深红底 + 高亮描边 + 浅色文字），在深色背景下对比度充足；渲染 archify 时沿用此色彩语义映射。

## 图型建议

flowchart → archify `architecture`（分组组件全景，实际产物即按 architecture 渲染器生成）；主链：四装置 → 三通道 → 模型 → 工具执行 → tool_result 回填（闭环，第五装置 s10 组装即三通道汇合的台面）；结论卡片建议三条：①可见性即影响力 ②常驻与按需分层 ③恢复分类且有界。
