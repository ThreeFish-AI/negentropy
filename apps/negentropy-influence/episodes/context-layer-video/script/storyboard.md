# 分镜：《自己动手，给 AI 搭一个上下文层》v2

> 逐字稿 SSOT：[narration.md](./narration.md)（句 id 即本表的定位锚）；视觉契约见 [planning.md](./planning.md) §三。
> 一镜（beat）= 2–8 句连续句子共享同一主画面；句区间必须**覆盖本幕每一句**（`check_script.py` 强制）。
> 色名对应 [../video/src/design/theme.ts](../video/src/design/theme.ts)：`blueprint` 工程蓝（架构/五层）·
> `grown` 苔绿（生命周期/自纠）· `activate` 暖橙（resolve/MCP 插头）· `danger` 警示红（冲突/越权/错数）。
> **镜号必须与 `scenes/*.tsx` 里内嵌 `<Sequence name="N-X">` 保持规范对应**。
> 动效列 `@动词` 对应 motion 模型（hooks.ts）。
> v2 母题：**archify 回放窗**（components/ArchifyClip）与**代码走廊**（CodeCard 逐段高亮 + 终端卡滚真实 selftest / JSON-RPC 报文）。

## P0 你的 AI 也在裸奔吗（p0-01..10）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 0-A | p0-01..05 | AI 助手 + 三张对话卡（周报✓/查数?/错✗）→ 红色卡片「一个连接良好的猜测器」 | 三卡 stagger；日历碎裂 impulse 粒子四散；问号 breathe ；`@stagger` `@impulse` `@breathe` |
| 0-B | p0-06..10 | 大楼远景拉回 → 桌面铺开深蓝市政蓝图纸 + 片名（右下小终端角标「每块积木都配代码 ✔」） | 蓝图纸 spring 四角展开；片名 draw 描线；终端角标 impulse ；`@spring` `@draw` `@impulse` |

## P1 市政五系统：为什么必须正交（p1-01..22）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 1-A | p1-01..05 | **五块积木命名帧 ①**：地籍册（抽屉柜卡）+ 门牌索引（账本页指针行指回源对象） | 积木 spring 拔地而起；指针箭头 draw 逐条；四标签 stagger 贴边 ；`@spring` `@draw` `@stagger` |
| 1-B | p1-06..11 | **五块积木命名帧 ②**：规划局 + 在路上执勤的门禁 + 国标插座与问询台落位拼成完整城市 | 三积木 stagger；机身轮廓 draw 点亮；插头 snap 咬合 ；`@stagger` `@draw` `@snap` |
| 1-C | p1-12..17 | **行业四路线象限图**：平台内嵌 / 定义即代码 / 元数据平面 + 异类 Palantir 动作本体 | 四象限 progress 划分；代表卡片 stagger 飞入；Palantir 异类卡 pulse ；`@progress` `@stagger` `@breathe` |
| 1-D | p1-18..22 | **蓝图落位与正交解耦**：独立可执行层落位于查询生成前；正交演示（换门牌不修路，其余纹丝不动） | 蓝图卡 spring 扎根；门牌层 travel 抽出 + 「不动」徽章 impulse ；`@spring` `@travel` `@impulse` |

## P2 地籍册与门牌索引：万物皆对象与单一事实源（p2-01..30）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 2-A | p2-01..05 | 地籍册展开，展示 YAML 词条卡；同义词气泡撞玻璃（没同义词在检索面上隐形） | 条目卡 rise；字段槽 stagger；气泡 travel 撞玻璃 spring 反向 + shake ；`@enter:rise` `@stagger` `@travel` `@shake` |
| 2-B | p2-06..10 | 说明书随对象分发 vs 散落提示词蒙灰；**代码走廊 ①**：结构校验门拦截非法结构注册 | 版本 flip；说明行 draw；报错行打字机 + 红光 impulse ；`@flip` `@draw` `@progress` `@impulse` |
| 2-C | p2-11..15 | **词条一生轨道图**：draft 起点站 → governed 站台 → conflict 岔道 → superseded 缓行线；弃用窗口通知下游 | 轨道 draw 铺设；指示灯 stagger 变换；弃用通知卡 travel 滑出 ；`@draw` `@stagger` `@travel` |
| 2-D | p2-16..20 | 门牌索引：只立门牌不盖楼，逻辑视图汇聚元数据指针；全城一本账，杜绝精神分裂 | 门牌 draw 树立；指针合流 spring；分裂账本 shake 碎裂 ；`@draw` `@spring` `@shake` |
| 2-E | p2-21..25 | 目录四层活信号（结构/运维/语义/行为）；元数据联邦周界承诺（永不碰数据行，受限退化为路由） | 四信号卡 stagger 贴合；周界隔离光环 breathe；路由箭头 draw ；`@stagger` `@breathe` `@draw` |
| 2-F | p2-26..30 | 实体与街道清晰锚定；活水引入动画，引出第三块积木规划局 | 街道描线 draw 点亮；水流 flowDash 汇入 ；`@draw` `@flowDash` |

## P3 规划局、近道与听证会：双轨富化与冲突浮出（p3-01..26）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 3-A | p3-01..05 | 覆盖率困局：人工覆盖不到 5%；双轨显式修志（金标准满格权威，机器辅助起草人类盖章） | 百分比 count 爬至 5 停住；书页 progress 翻开；权威条 count ；`@count` `@progress` |
| 3-B | p3-06..11 | 隐式轨道：航拍草坪近道（desire paths）；后台自纠环（补同义词、调热度权重，缺口榜驱动自愈） | 近道纹理 draw 浮现；纠错环 draw 闭合；修复卡 stagger ；`@draw` `@stagger` |
| 3-C | p3-12..16 | 冲突引入：两部门对活跃用户各执一词；**冲突浮出听证会核心契约**（严禁自动站队） | 对峙卡 travel 相向；问号 pulse；听证会大门 spring 推开 ；`@travel` `@breathe` `@spring` |
| 3-D | p3-17..22 | **CONFLICT 听证会卡片**：两定义并列、数值区刻意空白；**代码走廊 ②**：D4 实验按热度自动选导致错误翻倍事故（477 vs 48） | 双卡并列 stagger；空白框 draw；错误卡登座 danger 红光 + 真实日志行 impulse ；`@stagger` `@draw` `@impulse` |
| 3-E | p3-23..26 | 机器绝不假装共识，裁决权交还责任人；听证会胜者转正、败者归档收束 | 裁决木槌 snap 敲定；胜卡 spring 归位；全景辉光 breathe ；`@snap` `@spring` `@breathe` |

## P4 国标插座与海关检疫：MCP 供给面与深度防御（p4-01..34）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 4-A | p4-01..07 | 问询台（resolve）：三 AI 排队，递出两页盖章底稿；四因子天平对数封顶 log1p 防刷榜；无覆盖诚实告警 | 窗口 spring；天平 rotate；刻度柱 count 压缩回落；警告条 impulse 黄闪 ；`@spring` `@rotate` `@count` `@impulse` |
| 4-B | p4-08..14 | **国标插座与 MCP 实录**：USB-C 插座咬合；**代码走廊 ③**：纯标准库四工具（list/resolve/compile/report）JSON-RPC 报文对上滚 | 插头 travel + snap 咬合；四工具卡 stagger；报文对逐对 progress 上滚 ；`@travel` `@snap` `@stagger` `@progress` |
| 4-C | p4-15..18 | 开放互操作三重边界（可携带≠可执行≠已验证）；城市口岸大门展开，海关安检机红外扫描线亮起 | 三重边界卡 stagger；口岸大门 draw 升起；扫描线 progress 往返 ；`@stagger` `@draw` `@progress` |
| 4-D | p4-19..24 | **海关检疫四大威胁**：描述投毒、间接注入、混淆提权、凭证透传；真实事件案例：官方受信组件也必须当不可信输入 | 四威胁卡 stagger 撞击盾牌；真实漏洞卡 shake；警示红灯 impulse ；`@stagger` `@shake` `@impulse` |
| 4-E | p4-25..30 | 海关检疫七项硬核控制：工具哈希钉住、细粒度拆分、高危动作人工强确认、指令监控、网络白名单 | 控制盾牌 stagger 展开并排；哈希链条 draw 锁死；确认窗 snap 弹出 ；`@stagger` `@draw` `@snap` |
| 4-F | p4-31..34 | 双层防线与编译期把关；开箱即用与寸步不让，智能体始终在受治理笼子里运转 | 笼子线条 draw 闭合；指示灯全部转绿 breathe ；`@draw` `@breathe` |

## P5 边界、评测与街道命名权：怎么知道它有效（p5-01..31）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 5-A | p5-01..07 | **三级对策台阶**：图纸救不了塌方地基；一级表达式扫描、二级问答对账、三级 eval 兜底 | 台阶 stagger 逐级升起；地基塌陷 shake；对账公章 snap 盖下 ；`@stagger` `@shake` `@snap` |
| 5-B | p5-08..12 | **基准鸿沟对比**：Spider 2.0 柱状图暴跌至 21.3%；高校审计公开基准金标准 62.8% 错标率警示 | 柱状图 count 骤降；错标率数字 danger 爆红闪烁 ；`@count` `@impulse` |
| 5-C | p5-13..16 | 业务亲自出题，便衣警察越权闯红灯用例；题眼「**报错优于错数**」分色卡片 | 考卷 progress 展开；便衣小人 travel 闯红灯被拒；题眼金句 serif 淡入 ；`@progress` `@travel` `@enter:rise` |
| 5-D | p5-17..21 | **街道命名权 RACI 审批流**：Propose → Draft → Test → Review → Certify 流程卡，每步留痕 | 流程箭头 draw 连接；角色印章 stagger 盖定 ；`@draw` `@stagger` |
| 5-E | p5-22..26 | 失败史三死因（不在执行路径上）；避坑处方：高管站台，从 5 个核心指标起步生根发芽 | 墓碑卡 shake 倒下；嫩芽 spring 破土生长 ；`@shake` `@spring` |
| 5-F | p5-27..31 | **城市仪表盘三刻度**：覆盖缺口榜、受信任命中率、越权拒绝率，城市健康呼吸 | 三仪表盘 draw；指针 travel 摆动；呼吸辉光 breathe ；`@draw` `@travel` `@breathe` |

## P6 路线图与理性落点（p6-01..20）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 6-A | p6-01..06 | **四阶演进路线**：P0 机制验证绿勾 ✔ 实心高亮 / P1–P3 虚线阶梯流动；落地施工指南 | 阶梯 draw 升起；P0 绿勾 snap 盖定；虚线 flowDash 流动 ；`@draw` `@snap` `@flowDash` |
| 6-B | p6-07..13 | 理性思考一：新关键基础设施；城修多大取决于养多少智能体；循序渐进拒绝空心蓝图 | 基础设施金徽章 rise；城市模型按需缩放 travel ；`@enter:rise` `@travel` |
| 6-C | p6-14..17 | 理性思考二：大模型狂奔，但物理乱码依然存在；指标定义权属于真实商业契约 | 模型齿轮 fastRotate 飞转；底层契约岩石稳固 breathe ；`@breathe` |
| 6-D | p6-18..20 | 题眼金句卡「含义被治理好之前，AI 的聪明都是租来的」+ 信源卡 + 平缓渐黑收尾 | 金句 progress 淡入；信源卡 rise；末句起亮度均匀降为 0 ；`@progress` `@enter:rise` `@dim` |
