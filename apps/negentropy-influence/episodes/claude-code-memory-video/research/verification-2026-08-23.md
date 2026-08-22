# 阶段④ 双校验记录（Harness Engineering 改造版 · 2026-08-23）

| 口播句 | 断言 | 证据级 | 事实源 | 判定 |
|---|---|---|---|---|
| p0-09 | 窗口越长记得越不准（注意力摊薄） | 【二】 | anthropic.com/engineering/effective-context-engineering（引 Chroma 2025-07 实测） | ✅ VERIFIED |
| p1-18..19 | 官方两级（先清旧输出·不够再摘要）·教学四级是其细化 | 【二】 | 官方 compaction 表述 | ✅ VERIFIED |
| p3-09..13 | 压缩存活矩阵（系统提示绕行/规则重注入/技能封顶五千最旧先丢/回捞五个） | 【二】 | context-window 页「压缩后什么活下来」矩阵 | ✅ VERIFIED |
| p4-08..09 | 第一条腿四层拼接 · 四兆上限 · 两百行 | 【二】 | memory 页（四层位置与加载顺序、上限） | ✅ VERIFIED |
| p4-11..12 | 第二条腿自动记忆四类 · 门限 | 【二】 | memory 页（auto memory type 与 25KB/200 行） | ✅ VERIFIED |
| p4-24..25 | 前缀缓存 · 改规则新开会话 · 换模型那轮慢 | 【二】 | prompt-caching 页（三层前缀、缓存键含模型与档位） | ✅ VERIFIED |
| p6-05..06 | 「都是上下文不是闸门」· 记忆是建议钩子才是规则 | 【二】 | memory 页原话 | ✅ VERIFIED |

易懂性：两条腿框架替代单账本叙事，入口更清楚；「tab 字条」母题保留。遗留：无。
