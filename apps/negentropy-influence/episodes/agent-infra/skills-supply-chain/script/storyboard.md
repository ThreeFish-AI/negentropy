# 分镜表（storyboard.md）

> 句 id 与 `narration.md`（★SSOT）逐句对齐；各镜时长以 audio manifest 实测为准（`at()/dur()` 均按句 id 推导，禁写死帧数）。
> 色板（theme.ts 契约）：关税橙 `#FF6A3D`=海关/闸门/攻击面 · 检疫绿 `#A6F750`=见证/验证/批准面 · 警示金 `#FFC85C`=悬案/冻结/留白 · danger 红仅攻击命中瞬间 · ok 绿仅确认门拦停瞬间。
> 剧场：知识的港口·海关篇。空间语义恒定：左=堆场/发布方，右=泊位/用户端；「分发流向」永远向右。〔M-001〕铅封+舱单行母题全片同形（橙描边恒定线宽）；〔M-003〕持续陈述配可停驻终态。
> 画面文字一律关键词锚点（≤6 字短语），禁整句复述口播（复述门）。全屏独占：archify 回放期间场景装置让位（forbid_inset）。

## P0 规范里没有的词（p0-01..12，镜 0-A..0-C）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 0-A | p0-01..04 | **终端判词**：gh api 取规范 → 247 行瀑布 → 8 词干逐个扫过 → 定格 L133「De-SIGN-ed」（关键词：8 词干 / 唯一命中） ·**archify full**：grep-verdict 章 `gv-cmd`+`gv-stems`+`gv-hit`+`gv-designed` | archify 逐章回放承担；开场白闪由 lead 实测对位 |
| 0-B | p0-05..09 | **没有海关的港口**：46 家互认的箱体港区（左）× 空置海关大楼（中）× 投毒已开工（右）；三张欠条从大楼窗口抛出（关键词：46 家 / 三张欠条） ·**archify full**：port-no-customs 章 `pn-46`+`pn-gap`+`pn-toxic`+`pn-ious` | archify 逐章回放承担；p0-08 句为装置桥段（港口隐喻总卡 useSpring 压入）`@spring` |
| 0-C | p0-10..12 | **史前悬崖**：npm 八年到投毒 vs 本生态六个月到悬崖；三战场宣言（关键词：8 年 / 6 个月） ·**archify full**：history-cliff 章 `hc-npm`+`hc-six`+`hc-three` | archify 逐章回放承担 |

## P1 停摆的舱单（p1-01..14，镜 1-A..1-E）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 1-A | p1-01..06b | **舱单解剖**：旧姿势挨个翻仓库 → 公示栏总舱单 → 五字段 → 铅封〔M-001〕→ 两箱型 → 相对地址换托管无感（关键词：五字段 / 铅封） ·**archify full**：manifest-anatomy 章 `ma-old`+`ma-index`+`ma-fields`+`ma-seal`+`ma-boxes` | archify 逐章回放承担；p1-06 / p1-06a / p1-06b 为装置桥段（舱单行母题 useStagger 点亮 + 托管工位切换 useSpring）`@stagger` `@spring` |
| 1-B | p1-07..10 | **反对三连**：停摆印章（6+ 月）→ 同域质疑 / 双处同步 footgun / 流水线劝退（关键词：同一域名 / 两处同步） ·**archify full**：three-objections 章 `to-samedomain`+`to-footgun`+`to-pipeline` | p1-07 装置：停摆印章 useImpulse 盖下定格〔M-003〕`@impulse` |
| 1-C | p1-10a..10c | **四处裂缝**：独立实现者刻意不读客户端 → soft-404 字面合法 / 字符单位未定义 / 格式标记缺席三答案（关键词：查无此货 / 差一倍） ·**archify full**：four-cracks 章 `fc-soft404`+`fc-units`+`fc-schema` | archify 逐章回放承担 |
| 1-D | p1-11..13 | **锁步竞态**：14:00→14:01→14:02 三轨 → 新字节配旧铅封 → 关/开校验对照（关键词：阴阳舱单） ·**archify full**：lockstep-race 章 `lr-t0`+`lr-race`+`lr-catch` | archify 逐章回放承担 |
| 1-E | p1-14 | **过渡**：评论区窗口向上生长成三层塔（关键词：三层） | 塔层 useStagger 生长〔M-003〕`@stagger` |

## P2 三层信任栈（p2-01..12，镜 2-A..2-C）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 2-A | p2-01..06a | **三层栈**：运输铅封 → 随箱签章（原型：月下载 12）→ 灯塔见证人 → 18.8 万=文件实例口径（关键词：三层 / 文件数） ·**archify full**：trust-stack 章 `ts-l1`+`ts-l2`+`ts-proto`+`ts-l3`+`ts-count` | p2-01 / p2-06a 装置：评论楼层码垛 useStagger；见证台账签名 useImpulse `@stagger` `@impulse` |
| 2-B | p2-07..08b | **sigstore 重叠**：三层栈 ↔ 2022 sigstore 逐层对齐；动机同构；npm/PyPI 量产版（关键词：四年前 / 同一道题） ·**archify full**：sigstore-overlap 章 `so-map`+`so-reinvent`+`so-motive`+`so-scale` | archify 逐章回放承担 |
| 2-C | p2-09..12 | **强制力缺口**：MUST 纸面 → npm 中心仓拒重发布 → 聊天窗口里舱单链消失（关键词：没有强制力） ·**archify full**：enforcement-gap 章 `eg-must`+`eg-npm`+`eg-chat` | p2-11 装置：空置中心仓虚线框 useDraw `@draw` |

## P3 编号牌失踪（p3-01..13，镜 3-A..3-C）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 3-A | p3-01..05 | **双门失效**：六字段无版本格 → 写死卡死 / 省略全员跳变 → E-05 实测（关键词：写死 / 省略） ·**archify full**：version-gates 章 `vg-nofield`+`vg-pinned`+`vg-floating`+`vg-test` | p3-01 装置：空编号位红叉 useImpulse `@impulse` |
| 3-B | p3-06..07 | **两个物种**：官方仓零版本 vs 云厂商八级发版（关键词：0 标签 / 8 级） ·**archify full**：two-species 章 `ts2-official`+`ts2-supabase` | archify 逐章回放承担 |
| 3-C | p3-08..13 | **锁文件孤本**：四件套 → 24 小时自我推翻 → 回滚盲区 → 锁文件 → 空港孤本（关键词：四件套 / 孤本） ·**archify full**：lockfile-orphan 章 `lo-four`+`lo-flip`+`lo-rollback`+`lo-lock`+`lo-orphan` | p3-13 装置：散文 vs 代码天平 useSpring 持平 `@spring` |

## P4 隔壁港开了航线（p4-01..12，镜 4-A..4-C）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 4-A | p4-01..04 | **双港区**：左港冻结 49 天 × 右港 81 天；四理由否决 → 砍小 → Final（关键词：49 天 / 81 天） ·**archify full**：dual-harbor 章 `dh-frozen`+`dh-81`+`dh-veto`+`dh-final` | archify 逐章回放承担 |
| 4-B | p4-05..07b | **航线机制**：逐文件清单 → 批准绑定内容 → 偷换可检测 → 来源加地址身份 → 预授权铁闸（关键词：批准作废 / 铁闸） ·**archify full**：sep-mechanism 章 `sm-list`+`sm-approval`+`sm-detect`+`sm-identity`+`sm-gate` | archify 逐章回放承担 |
| 4-C | p4-08..12 | **诚实边界与人事桥**：MUST NOT 原文 → 三家部分支持+静态快照 → 内部原型未公开 → 唯一的桥 → 八行条款零评论 → 48 卷宗排队（关键词：不是安全边界 / 24 天） ·**archify full**：honest-boundary 章 `hb-mustnot`+`hb-partial`+`hb-proto`+`hb-546` ＋ dual-harbor 章 `dh-bridge` | p4-09 / p4-12 装置：原文引号卡 useDraw；卷宗 useStagger 排队 `@draw` `@stagger` |

## P5 投毒现场（p5-01..11，镜 5-A..5-C）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 5-A | p5-01..04 | **战报漏斗**：3,984→76 / 98,380→157 / 月装 2,982 万 / 三件老手法（关键词：76 / 157 / 4.03） ·**archify full**：toxic-funnel 章 `tf-snyk`+`tf-usenix`+`tf-installs`+`tf-tricks` | p5-01 装置：警报灯 useImpulse `@impulse` |
| 5-B | p5-04a..04d | **隐形墨水**：171 个无字形字符 → 自动激活弹计算器 → 三分钟不修 → 26 字符复刻 → 一字母之差双装零告警（关键词：隐形 / 零告警） ·**archify full**：invisible-ink 章 `ii-tag`+`ii-calc`+`ii-replay`+`ii-typo` | archify 逐章回放承担 |
| 5-C | p5-05..11 | **四道闸门**：代码级确认门 / 信任不拦字段 / 预授权直执链 / 明文被拒（关键词：只一道真卡） ·**archify full**：four-gates 章 `fg-gemini`+`fg-trust`+`fg-chain`+`fg-explicit`；p5-09..11 装置：双通道分叉定格 + 2018/2026 双轨叠影 | 双通道 useProgress 分叉；叠影 useDraw `@progress` `@draw` |

## P6 三张欠条的对账（p6-01..10，镜 6-A..6-C）

| 镜 | 句区间 | 画面 | 动效 |
| --- | --- | --- | --- |
| 6-A | p6-01..05 | **盖章对账**：签名零条款 → 答案在评论区 → 租客先开张 → 活·404·DNS 000 → 版本入口不存在（关键词：三张欠条 / 四零四） ·**archify full**：ious-route 章 `ir-sign`+`ir-stack`+`ir-dist`+`ir-404`+`ir-vers` | archify 逐章回放承担 |
| 6-B | p6-06..08 | **信号灯面板**：三信号灯（合并 / 解冻 / 首验签）+ 包管理器战例两枚勋章（关键词：三个信号） | 信号灯 useStagger 依次亮起〔M-003〕；勋章 useSpring `@stagger` `@spring` |
| 6-C | p6-09..10 | **裸运收尾**：港口全景每箱无铅封 → 海关大楼亮起第一盏红灯（反转帧）→ 下期卡 → 信源卡渐黑（信源：agentskills@69ef37e9 / ext-skills@b0b3272f / cloudflare-rfc@1bd11679 / 本仓 220·221 / lab3 实测） | 全景 useProgress 横移；红灯 useImpulse；信源卡 useFadeOut 渐黑（末 beat 分镜标「渐黑」）`@progress` `@impulse` `@fadeOut` |

## 实现映射

- scenes/P0..P6.tsx ↔ 上表七幕；SCENE_COMPONENTS 注册顺序 P0→P6；chapters.json 由 build 派生（勿手改）。
- archify 资产 20 图（18 新绘 + 2 张 220 入库图补章重交付：dual-harbor / ious-route），`supply-chain--` 前缀入 `docs/assets/architecture/agent-infra/`；图型 5 种（architecture 5 / workflow 6 / sequence 3 / lifecycle 2 / dataflow 4）；79 章＝79 cue（manifest-anatomy 受 archify 5 章上限，p1-06a 改由装置承接）；views 章节清单 = 上表各章 id；cue 全部经 `<ArchifyRecap>`（`at('句id')` 锚定、`dur('句id')` 单参取长、跨实例背靠背后挂 `lead={false}`）。
- 动效 hook 全部走 `src/motion/hooks.ts` frozen 层；装置（停摆印章/评论塔/信号灯/双通道/叠影/红灯反转）在 `src/components/devices.tsx`；铅封/舱单行母题在 `src/components/motifs.tsx`（色随 #FF6A3D/#A6F750）。
- 字幕规范：单行 ≤26 字（两行 35 字上限内），关键词锚点不整句上屏。
