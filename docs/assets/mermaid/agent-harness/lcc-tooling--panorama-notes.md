# lcc-tooling--panorama 图意简述（供统一渲染 archify 四件套）

- **主题**：Learn Claude Code「工具与执行」（s01–s04）全貌——一个主循环、一条裁决执行管线、一层生产保护。
- **两个容器（subgraph）与色彩语义**（2026-10-10 评审改造：主循环串联全图，生产保护层改节点徽标、不另起子图）：
  - 主循环（蓝 `#1f6feb`/`#79c0ff` 描边）：s01 的 while 循环骨架——用户输入 → UserPromptSubmit → 调用模型 → 判据；判据为否走 Stop 钩子（续跑或退出）。它是全图唯一不变的骨架，其余一切都挂在它上面。
  - 裁决与执行（绿=执行件 `#238636`，琥珀=闸门 `#9e6a03`）：PreToolUse → 三道闸门 → 查表执行 → PostToolUse → tool_result 配对，「拒绝结果」与「执行结果」同汇入一条回喂边，回指模型节点（闭环）。
  - 生产保护层（不再单独成层）：CC 源码与官方文档的五个保护机制以**节点徽标**标在其守护的骨架节点上（needsFollowUp→判据、partitionToolCalls→查表执行、auto 分类器→闸门 3、不变式→PreToolUse、stopHookActive→Stop）。
- **深色模式**：全部节点采用深底亮字配色（GitHub dark 色系），描边用高亮度色保证暗背景对比度；渲染 light 主题时同组配色仍有足够区分度。
- **结论卡片建议（archify cards）**：①循环本体从 s01 到 s20 一行不改，能力全部外挂；②允许需要各方一致、拒绝只要一方摇头（hook 的 allow 压不过 deny/ask）；③教学 30 行与生产 1729 行共享同一骨架，差别全在保护层。
- **文本源**：本目录 `lcc-tooling--panorama.mmd`（字节一致纪律以此为准）。
