# lcc-concurrency--panorama 图意简述

供编排者统一渲染 archify 四件套（.mmd 为文本源 SSOT，本文仅为图意说明；**不要**据此另建文本源）。

- **图意**：Learn Claude Code「并发」部分的全貌——两种时间机制汇入同一条对话循环。左上「后台任务链」（命令级并发，「不等它」）：模型显式请求 → 判定 → daemon 线程执行 + 占位 tool_result 当场闭合调用编号 → 完成后以 task_notification（带任务编号）借道后续轮次捎回。下方「定时调度链」（回合级并发，「没人按开始也照跑」）：CronJob 定义（durable 落盘只存定义不存节拍）→ 调度线程每秒对表（带日期分钟标记去重）→ cron_queue → 交付线程持空闲锁巡检 → 主动拉起一轮注入 [Scheduled] prompt。右侧绿色汇合点是全文最重要的一张对照：前者往后续轮次里放「命令完成了」的结果事件，后者在无轮可续时专门拉起一轮、放一条新任务。
- **色彩语义**（深色模式可读为设计基准）：蓝系=后台任务链（命令级）；紫系=定时调度链（回合级）；绿=对话循环（汇合点，加重描边）；黄=存储件（cron_queue 缓冲、durable 磁盘文件）。两个 subgraph 分层解构业务跨度，图自解说。
- **建议图型**：architecture（分组组件全景，实际产物即按 architecture 渲染器生成；两条链汇入一个消费点，两处虚线为异步/恢复边）。
- **服务章节**：docs/research/agent-harness/174-claude-code-concurrency.md §2（正文已有一句结论式图注；正文内嵌 mermaid 块与 .mmd 图体逐字节一致，渲染后按管线替换为暗色 PNG）。
