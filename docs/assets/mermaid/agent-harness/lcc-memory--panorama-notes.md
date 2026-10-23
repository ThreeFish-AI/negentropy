# lcc-memory--panorama 图意说明（供编排者统一渲染 archify 四件套）

- 对应笔记：`docs/research/agent-harness/173-claude-code-memory-management.md` §2 全貌解剖的图化。
- 拓扑：三个分组（subgraph）呈现两套机制的咬合。
  - **上下文压缩（会话内）**：①budget→②snip→③micro→④fit→⑤compact_history 的固定主链，reactive 应急挂在链侧；②与⑤的「切口保护/留档」动作下连磁盘层。
  - **磁盘（不参与压缩）**：transcripts 留档与 tool-results 落盘，是压缩各步的恢复后盾。
  - **持久记忆（跨会话）**：存储→召回→提取→整理四件套小闭环；提取在回合结束（stop）触发，召回正文注回 Agent Loop。
  - 外层：用户请求（active_request 单独携带）与 Agent Loop 的每轮 prepare() 入口。
- 色彩语义（深色模式可读的暗底亮边配色，渲染时可沿用或映射为 archify 主题变量）：
  - 蓝（mech）：压缩管线机制节点；
  - 琥珀（disk）：磁盘持久物；
  - 绿（mem）：记忆子系统；
  - 玫红（guard）：门控/防线（配对保护、scope 门、熔断语义所在节点）；
  - 紫灰（api）：外部接口（用户请求、API 侧约束）。
- 关键结论（正文 §2 因果链的图化一句话）：压缩管线按「调用成本×信息损失」递增排步、一切裁剪先落盘留档；记忆系统以索引常驻+正文按需跨会话取回，补压缩必然丢掉的细节。
