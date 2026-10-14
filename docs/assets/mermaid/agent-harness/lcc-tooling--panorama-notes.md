# lcc-tooling--panorama 图意简述（供统一渲染 archify 四件套）

- **主题**：Learn Claude Code「工具与执行」（s01–s04）全貌——一个主循环、一条裁决执行管线、一层生产保护。
- **统一骨架（2026-10-12 视觉优化轮，五图共用）**：archify architecture 型固定网格（6 列 × 3 行，cell 150×64，恒定列距），顺时针回环——
  - 上排（r0）：决策主线——用户输入 → UserPromptSubmit → 调用模型 → 判据 → Stop → 循环退出；
  - 中排（r1）：裁决与执行——PreToolUse → 三道闸门 → 查表执行（「有」自判据直落执行链首）；
  - 下排（r2）：执行后与回喂——PostToolUse → tool_result 配对，「回喂·接着想下一步」沿 c2 单竖线直上调用模型，闭环零折点。
  - 持久槽位跨级不变：调用模型恒在 (r0,c2)、tool_result 恒在 (r2,c2)、执行链首恒在 (r1,c3)——L0–L3 渐进图是同一张图逐章「长大」，空槽即留白。
- **色彩语义**（与渐进图一致）：蓝 `#1f6feb`/`#79c0ff` 描边=主循环骨架（backend）；绿=执行件；琥珀=闸门（security）；紫=messagebus 钩子；深底亮字（GitHub dark 色系），light 主题同组配色仍有足够区分度。图例词条沿用：Agent 逻辑 / 策略 / 工具操作 / 上下文 / 追踪 / 外部系统。
- **生产保护层**（不单独成层）：CC 源码与官方文档的五个保护机制以**节点徽标**标在其守护的骨架节点上（needsFollowUp→判据、partitionToolCalls→查表执行、auto 分类器→闸门 3、不变式→PreToolUse、stopHookActive→Stop）。
- **结论卡片建议（archify cards）**：①循环本体从 s01 到 s20 一行不改，能力全部外挂；②允许需要各方一致、拒绝只要一方摇头（hook 的 allow 压不过 deny/ask）；③教学 30 行与生产 1729 行共享同一骨架，差别全在保护层。
- **文本源**：本目录 `lcc-tooling--panorama.mmd`（字节一致纪律以此为准）。
