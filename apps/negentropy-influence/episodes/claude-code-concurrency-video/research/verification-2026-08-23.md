# 阶段④ 双校验记录（Harness Engineering 改造版 · 2026-08-23）

| 口播句 | 断言 | 证据级 | 事实源 | 判定 |
|---|---|---|---|---|
| p0-02..03 | 它感觉不到时间 · 会高高兴兴跑几小时 | 【二】 | anthropic.com/engineering/claude-code-auto-mode（原话） | ✅ VERIFIED |
| p0-10 | 时间盲症（无钟/无闹钟/无回头） | 【二】 | 官方博客三无表述 | ✅ VERIFIED |
| p1-04..05 | 超时自动转后台 · 三类例外照停 | 【二】 | tools-reference（Bash 超时语义） | ✅ VERIFIED |
| p4-19..21 | 三档调度（云端/桌面/会话内） | 【二】 | scheduled-tasks 页 | ✅ VERIFIED |
| p5-14..18 | 管家进程托管 · 六状态 · 穿重启 · 接回续跑 | 【二】 | agent-view 页 | ✅ VERIFIED |
| p6-12 | 官方四件套画像 | 【二】 | claude.com/blog/harnessing-claudes-intelligence | ✅ VERIFIED |

易懂性：P0 从洗衣机比喻切入时间盲症（保留比喻骨架 + 官方原话）；P5 诚实边界升级为
官方新答案（不再以「进程关了表就停」收尾）。遗留：无。
