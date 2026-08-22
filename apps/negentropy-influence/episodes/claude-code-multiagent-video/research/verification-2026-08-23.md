# 阶段④ 双校验记录（Harness Engineering 改造版 · 2026-08-23）

| 口播句 | 断言 | 证据级 | 事实源 | 判定 |
|---|---|---|---|---|
| p0-03 | 官方三失败模式（干一半宣布完成/偏爱自己的产出/目标越走越散） | 【二】 | claude.com/blog/a-harness-for-every-task（agentic laziness / self-preferential bias / goal drift） | ✅ VERIFIED |
| p1-13 | 任务认领用文件锁防竞态 | 【二】 | tools-reference 原话 | ✅ VERIFIED |
| p2-14..15 | 信箱就是用户目录下的文件 · 写文件加锁 | 【二】 | agent-teams（磁盘布局） | ✅ VERIFIED |
| p2-16 | 消息十五种 | 【三】 | 第三方计数（归属句保留「有人数过」） | ✅ VERIFIED（带归属） |
| p2-20..22 | 三禁止（不替批权限/不代同意/被拒不转给别的队友） | 【二】 | agent-teams「Messages between agents」 | ✅ VERIFIED |
| p5-07..09 | worktree 四道闸 · 第四道不能关 | 【二】 | worktrees「How Claude Code enforces isolation」 | ✅ VERIFIED |
| p5-22 | 装十个服务上下文几乎不占（按需取用） | 【二】 | mcp（tool search 延迟装载） | ✅ VERIFIED |
| p6-08..11 | 谁持有计划四形态 · 中间结果住变量 · 并发十六/一千 · 挽具由它自己写 | 【二】 | workflows（When to use a workflow + Behavior and limits） | ✅ VERIFIED |
| p6-13..14 | 协调成本 · 十五倍 token | 【二】 | 官方工程博客（multi-agent research system） | ✅ VERIFIED |
| p3-12..14 | 三向关机 | 【三】 | 第三方源码分析（归属句保留） | ✅ VERIFIED（带归属） |

易懂性：P0 三症状卡先立病、P6 四象图给药（病—药闭环）；「谁持有计划」是全系列思想高点。
遗留：下期预告话题「给这样的系统打分」为建议方向，画面卡可随频道规划调整（口播零依赖）。
