# 分镜：《AI 为什么答不对你公司的数据》v2

> 逐字稿 SSOT：[narration.md](./narration.md)（句 id 即本表的定位锚）；视觉契约见 [planning.md](./planning.md) §三。
> 一镜（beat）= 2–8 句连续句子共享同一主画面；句区间必须**覆盖本幕每一句**（`check_script.py` 强制）。
> 色名对应 [../video/src/design/theme.ts](../video/src/design/theme.ts)：`manual` 琥珀金（手册/金标准）·
> `engine` 青碧（引擎/计算纪律/门禁）· `dig` 淡紫（隐式挖掘/自纠）· `danger` 警示红（错误数字/泄露）。
> **镜号必须与 `scenes/*.tsx` 里内嵌 `<Sequence name="N-X">` 逐字一致**（抽帧 QA 对照用）。
> 动效列 `@动词` 对应 motion 模型（hooks.ts），`--check-motion` 机检。
> v2 新增母题：**archify 回放窗**（components/ArchifyClip：OffthreadVideo + 暗框 + 角标）与
> **代码走廊**（CodeCard 逐段高亮 + 终端卡滚真实 selftest 输出）。

## P0 钥匙给了，还是答错（p0-01..10）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 0-A | p0-01..03 | 终端问答：AI 自信吐数打勾 → 勾翻红叉 + 基线角标 | 打字机（每字 2 帧）；勾 impulse 爆红；角标淡入 ；`@enter:rise` `@impulse` |
| 0-B | p0-04..06 | 乱码列名墙滚出，一列染 `manual` 金 + 角标 `amt_ttl_pre_dsc` | 墙 progress 刷入；金列高亮 + 角标 spring ；`@progress` `@spring` |
| 0-C | p0-07..08 | 净收入文档分裂三张算法卡对撞 → 金句「缺的不是智能，是含义」 | 三卡 stagger 分裂；对撞 impulse；金句 serif 淡入 ；`@stagger` `@impulse` |
| 0-D | p0-09..10 | 片名卡：青碧细线生长 + 标题 | 细线 draw；标题 spring ；`@draw` `@spring` |

## P1 每天重新入职的天才（p1-01..27）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 1-A | p1-01..07 | 实习生每日记忆清零（日历翻落）→ AI 助手同款标签 | 日历页 accelTravel 翻落；记忆条白闪；AI 卡 spring 镜像入场 ；`@accelTravel` `@spring` |
| 1-B | p1-08..15 | 三病灶卡：便利贴散落 / 双面板断链冒火 / 翻墙小人 | 三卡 stagger；断链 shake + 火花；小人弧线 travel 越墙 ；`@stagger` `@shake` `@travel` |
| 1-C | p1-16..23 | 命名帧：三卡收拢成发光楼体「Horizon Context」+ 三句递进卡 | 收拢 spring 合流；三卡阶梯 stagger 上升；「可信」级染 `manual` 辉光 breathe ；`@spring` `@stagger` `@breathe` |
| 1-D | p1-24..27 | **入职包命名帧**：金公文包展开五格（手册/算法页/门禁卡/观察笔记/前台铃）；末句右侧浮小终端角标「lab · selftest ✔」预告代码实景 | 合页 draw 展开；五格 stagger 弹出；终端角标 impulse 一闪 ；`@draw` `@stagger` `@impulse` |

## P2 一本装订成册的公司手册（p2-01..24）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 2-A | p2-01..04 | 左便利贴墙（两张飘落）→ 右手册「啪」落桌 | 贴纸墙 stagger；飘落 travel 弧线；手册 spring 落位 ；`@stagger` `@travel` `@spring` |
| 2-B | p2-05..08 | **代码走廊 ①**：CodeCard 展示 `SemanticView("sales_sv", tables=(…), relationships=(Relationship("buyer", …)), metrics=(Metric("revenue", "sum", …, synonyms=(…))))`，五个参数段依次高亮（表/关联/度量/维度/指标），右缘角标「本仓 lab · 五段式声明」 | 代码逐行显（每行 3 帧）；五参数段按句逐段染色高亮（`manual`）；同义词段到句时 impulse ；`@progress` `@stagger` `@impulse` |
| 2-C | p2-09..11 | FK→键列连线（键=✓ / 普通列=✗ 断裂）+ 终端卡滚出 D6 报错原文 `✗ relationship bad: … not PRIMARY KEY/UNIQUE` | 连线 draw；坏线 shake；报错行打字机 + 红光 impulse；角标「本仓原型实测输出 · D6」 ；`@draw` `@shake` `@progress` |
| 2-D | p2-12..15 | 同义词漏斗：三别名卡 → 汇入一条 `revenue` 定义（命中计数 0→3） | 气泡 travel 汇入；连线 draw；命中数 count ；`@travel` `@draw` `@count` |
| 2-E | p2-16..18 | 分屏：定义卡内嵌说明书随版本翻新（绿流）vs 三张过期提示词蒙灰 | 版本号 flip；说明行 draw 重描；右贴纸 dim 蒙灰 ；`@draw` `@dim` |
| 2-F | p2-19..21 | 签名 FAQ 卡：问答对 + 钢笔签名划线（verified_by/at）；AI 命中时答案行高亮 | 签名曲线 draw；命中 impulse + 署名角标 spring ；`@draw` `@spring` |
| 2-G | p2-22..24 | 条目挂 PRIVATE 锁标（金钥匙旋入）→ 收束金句「定义写一遍，全公司引用」 | 锁标 spring 扣住；钥匙 travel 旋转 90°；金句 serif 淡入 ；`@spring` `@travel` |

## P3 菜谱：临出锅再勾芡（p3-01..51）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 3-A | p3-01..03 | **archify 回放窗 ①**（declaration-execution.webm，故事段 ~13s）：声明相五段式→校验门→执行相权限闸→按粒度重算；窗外框 `engine` 描边 + 右下角标「archify 工程图 · declaration-execution」 | 回放窗 spring 落位（全屏 88% 宽）；视频播放（OffthreadVideo，裁掉片头空白）；末句窗体 dim 收束过渡 ；`@spring` `@dim` |
| 3-B | p3-04..08 | 菜谱卡三步打勾 → 上游倾倒芡水 → 红章「菜谱救不了」 | 步骤 stagger 打勾；芡水弧线 travel + flowDash 流动；红章 snap 拍下 ；`@stagger` `@travel` `@flowDash` |
| 3-C | p3-09..12 | 存好的数（冰块）vs 现场算式（齿轮）；**代码走廊 ②**：CodeCard 高亮 `spec_rows = … if agg_before_join else _naive_joined_rows(…)` 一行分岔 | 冰块 breathe 冷光；齿轮 travel 转动；分岔代码行高亮 + 两个分支标签（先聚合=`engine` / 先关联=`danger`）impulse ；`@breathe` `@impulse` |
| 3-D | p3-13..19 | **复印机陷阱**：$100 订单进复印机 → 三张副本 → 求和器滚 $300 爆红；官方案例角标卡 | 订单滑入 progress；副本 stagger 弹出；计数 count 至 300 + shake 爆红；案例卡 rise + $100→$300 flip ；`@progress` `@stagger` `@count` `@shake` |
| 3-E | p3-20..25 | **复现双卡**：左 CodeCard（分岔行「先聚合」侧点亮）+ 右终端卡逐行滚出 `[PASS] B1: fan trap: 引擎 Jan=200 vs 朴素 Jan=440`；解法小图：两方块聚合后合体 | 代码行高亮 progress；终端行逐条上滚（每行 ~14 帧）+ 命中行 impulse；合体 spring ；`@progress` `@impulse` `@spring` |
| 3-F | p3-26..27 | 去重安全：行复制 6 行 vs 集合圈收 3 人 | 行复制 stagger；集合圈 count；重复小人 travel 弹飞 ；`@stagger` `@count` `@travel` |
| 3-G | p3-28..34 | **平均的平均**：不等宽教室天平失衡（16.0 vs 4.8 角标）+ 客单价公式条 + 幽灵错值 122.22 | 教室 stagger；天平 rotate 缓动失衡；公式条 progress 填充；幽灵数字 dim 飘散 ；`@stagger` `@progress` `@dim` |
| 3-H | p3-35..41 | 银行卡余额（可加/不可加对撞）→ 末快照时间轴（7 vs 24 实测角标） | 两卡 travel 相加 ✓ / 叠加 shake ✗；时间轴 draw；末点 engine 高亮 pulse、错误版 count 到 24 变红 ；`@travel` `@shake` `@draw` `@count` |
| 3-I | p3-42..47 | **477 vs 48 复盘**：四道绿灯工序 + 上游预聚合紫烟 + 数字对撞裂缝（第三方归属角标）；芡水回收小卡 | 绿灯 stagger；紫烟 flowDash；对撞 travel + 裂缝 draw；回收卡 pushIn 回归 ；`@stagger` `@flowDash` `@draw` `@pushIn` |
| 3-J | p3-48..51 | 题眼金句卡「SQL 完全合法，分析完全错误」（合法=engine / 错误=danger 分色） | 金句 progress 淡入 + impulse 强调一帧；分色字落位 ；`@progress` `@impulse` |

## P4 门禁装在楼里（p4-01..20）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 4-A | p4-01..05 | 墙上告示三块 + 小人翻墙直查库 | 告示 stagger 立起；小人抛物线 travel；库桶 danger 亮 ；`@stagger` `@travel` |
| 4-B | p4-06..09 | 引擎剖面命名帧：闸机嵌承重墙，三类访客同闸（官方引文条） | 剖面 draw；闸机自墙体 spring 推出；访客 stagger 过闸各闪绿 ；`@draw` `@spring` `@count` |
| 4-C | p4-10..12 | **代码走廊 ③**：CodeCard 三行 RBAC（`if metric.visibility == "PRIVATE" and role not in PRIVATE_ALLOWED: raise AccessDenied`）逐行点亮 + 终端卡滚出 `[PASS] C2 … 直闯执行层 → AccessDenied` | 代码三行 stagger 高亮（`engine`）；raise 行 impulse；终端行上滚 + 红字定格 ；`@stagger` `@impulse` `@progress` |
| 4-D | p4-13..16 | 双层防线剖面：前台滤卡（体验）/ 闸机拒绝（底线）；反事实拆闸 → `[90,560]` 泄露卡 | 前台滤卡 dim 抽走；绕行弧线 draw；闸机红灯 impulse；泄露卡 danger 滑出（角标 C2/D5） ；`@dim` `@draw` `@impulse` |
| 4-E | p4-17..18 | 出口保险：回答气泡过扫描线，PII 块打码 | 气泡 travel 上升；扫描线 progress 横扫；打码格 stagger 翻黑 ；`@travel` `@progress` `@stagger` |
| 4-F | p4-19..20 | 楼体缩小退场，CSV 拷贝走出光圈 → 门禁光圈熄灭（伏笔角标） | 楼体 pushIn 反向缩小；光圈 dim 熄灭；雾区 breathe ；`@pushIn` `@dim` `@breathe` |

## P5 手册写不完，怎么办（p5-01..35）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 5-A | p5-01..03 | **archify 回放窗 ②**（collect-enrich-activate.webm，故事段 ~13s）：三路信源汇入目录 → 双轨富化 → 四因子排序 → 三路激活；角标「archify 工程图 · collect-enrich-activate」 | 回放窗 spring 落位；视频播放；末句 dim 收束 ；`@spring` `@dim` |
| 5-B | p5-04..07 | 覆盖率墙：100 格亮 4 金（<5%），新表持续涌入（角标 9,685 表） | 网格 stagger（4ms/格）；金格脉冲；新表 flowDash 涌入；百分比 count 爬到 5 停 ；`@stagger` `@flowDash` `@count` |
| 5-C | p5-08..11 | 双轨：百科全书（权威满格）vs 维基节点网自生长（半格），汇入目录 | 书页 progress 慢翻；节点网络 stagger 蔓延 + 连线 draw；权威条双速 count ；`@progress` `@stagger` `@draw` |
| 5-D | p5-12..15 | 纠错环考卷：错答红叉 → 补同义词 + 调热度两动作卡 → 重排绿勾（角标 C4） | 笔迹 draw 快描；红叉 impulse；修复卡 stagger；绿勾 snap；环线 draw 闭合 ；`@draw` `@impulse` `@stagger` `@spring` |
| 5-E | p5-16..19 | 冲突引入：两派对峙卡（市场部 vs 增长部） | 对峙卡 travel 相向 + 问号 pulse ；`@travel` `@breathe` |
| 5-F | p5-20..22 | D4 反事实：错卡登座 danger 红光、对卡坠落（角标 D4） | 热度柱 count 对比；错卡 spring 登座 + breathe；对卡 dim 坠落 ；`@count` `@spring` `@dim` |
| 5-G | p5-23..24 | CONFLICT 卡片并列（数字区空白虚线框）+ 裁决灯落下 | 空白框 draw；裁决灯 travel ；`@draw` `@travel` |
| 5-H | p5-25..29 | 前台四因子天平 + **代码走廊 ④**：CodeCard 一行 `pop = math.log1p(p) / math.log1p(POP_CAP)` 高亮；签名 FAQ 短路⚡ | 四砝码 stagger 落盘；代码行高亮 impulse；短路卡 flip 弹出带署名 ；`@stagger` `@impulse` `@spring` |
| 5-I | p5-30..35 | 价值数字卡组：24.1%→86.3% 翻牌 + 三小卡 + 红星号常驻（厂商自家基准） | 大数 count 翻牌；小卡 stagger；星号 impulse 两闪后 breathe 低亮常驻 ；`@count` `@stagger` `@impulse` `@breathe` |

## P6 它没证明什么（p6-01..16）

| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 6-A | p6-01..08 | 五条边界清单逐条压暗（「治理≠验证」行 danger 微光） | 清单行 stagger 压入；第 4 行 impulse；`@stagger` `@impulse` |
| 6-B | p6-09..12 | 金句「含义第一次被当成资产」+ 四徽章（定义/版本/权限/裁决） | 金句 progress；四徽章 stagger 归位 + breathe 一次 ；`@progress` `@stagger` `@breathe` |
| 6-C | p6-13..16 | 下期钩子（入职包五格重现）+ 信源卡（pinned commit + 笔记/复现代码/**archify 工程图**路径）+ 渐黑 | 五格 stagger 缩略；信源卡 rise；末句起亮度均匀降 0（渐黑窗口=beat 时长）；`@stagger` `@enter:rise` `@dim` |
