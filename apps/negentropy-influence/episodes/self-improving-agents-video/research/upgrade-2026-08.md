# 2026-08 内容升级审计（v2 → v3）

> 本文档是《AI 如何自己变强？》第二轮升级的可审计记录：校准审计、句级 delta、双重校验 delta、信源存档。
> 升级动机：三集系列配音换用本人音色克隆（passionate 风格）之际，对源论文 PDF 做第二遍重读校准，并按新沉淀的「官方工程站点信源补充」规范引入站点增量事实。

## 一、重读方式与结论

- **论文**：本地 PDF 二次精读（p11–19 §3 Definitions/§4 Taxonomy；p48–56 §8 Evaluation/§9 Discussion，pymupdf 抽取，2026-08-18）。
- **站点**：https://selfimproving-agent.github.io/ 实时抓取（2026-08-18），事实条目已录入 [paper-notes.md](./paper-notes.md) 末尾「信源补充」大节（与论文正文物理隔离）。
- **结论**：narration v2 全部断言与论文原文一致，零事实漂移。

### 审计发现与处置

| # | 发现 | 类别 | 处置 |
|---|---|---|---|
| 1 | 站点 Survey statistics：312 条收录 = 77 FM + 176 Scaffolding + 59 Evaluation；装备条目约为大脑两倍半，为 p3-02「这两年最火的方向」提供定量印证 | 站点信源 | 新增 P5 活地图镜（p5-22a..22d，4 句） |
| 2 | 站点 Quick start 9 篇敲门砖与片内已讲方法高度重合，可作收尾彩蛋强化记忆 | 站点信源 | 新增 P5 卡片墙镜（p5-22e/f，2 句） |
| 3 | §3.2 Skill 定义（"a reusable instance of the self-induced update operator U"）在 v2 仅侧写未点破 | 核心遗漏（轻） | 新增 p3-34b/c（2 句） |
| 4 | §8.1.1 学习曲线报告、§9 快慢双环/分层门禁等核心句已被 v2 意译覆盖 | 已覆盖 | 不动 |
| 5 | 考虑补 §7 应用域、§9.2 六方向展开 | — | **放弃**：planning.md 的取舍声明仍然成立，篇幅不扩张新幕 |

## 二、句级 delta 清单

| 句 id | 类型 | 文本 | 锚点 |
|---|---|---|---|
| p3-34b | 新增 | 论文给"技能"下过一个很妙的定义： | §3.2（承启句） |
| p3-34c | 新增 | 技能，就是把一次自我升级打包保存，随取随用。 | §3.2 "a reusable instance of the self-induced update operator U: a named update to the agent's own configuration that it retains and reuses" |
| p5-22a | 新增 | 这篇论文的作者们，还维护着一张会持续更新的研究地图， | 站点 "This survey is maintained as a living research map." |
| p5-22b | 新增 | 截至今年八月，已经收录了三百一十二项工作： | 站点 "312 curated entries"（2026-08-18 访问） |
| p5-22c | 新增 | 改大脑的七十七项，改装备的一百七十六项，做评测的五十九项。 | 站点 77 FM / 176 Scaffolding / 59 Evaluation & Benchmarking |
| p5-22d | 新增 | 你会发现，装备这条路的条目数，是大脑那条的两倍多——刚才说的"最火"，就在这组数字里。 | 176/77≈2.3，算术转述；"最火"回指 p3-02 |
| p5-22e | 新增 | 想自己上手逛逛的，站点还给了一张九篇论文的敲门砖清单—— | 站点 Quick start（9 篇） |
| p5-22f | 新增 | 这期视频里讲过的名字，都在上面。 | 9 篇（Self-Instruct/Constitutional AI/WebRL/Web Agents with World Models/Self-Refine/TextGrad/MemoryBank/Voyager/DGM）全部在片内出现过 |

其余 220 句零改动（字节稳定，见 §四）。新句预算用量 8/20。

## 三、双重校验 delta（仅新增句）

| 句 id | 真实性 | 易懂性 |
|---|---|---|
| p3-34b | VERIFIED——承启句无断言 | VERIFIED |
| p3-34c | VERIFIED——"打包保存的自我升级/随取随用" 直译 reusable instance + retains and reuses | VERIFIED——口语无术语 |
| p5-22a | VERIFIED——"living research map" 站点原话；**信源等级已标注**（站点，非论文正文） | VERIFIED |
| p5-22b | VERIFIED——312 = 站点 2026-08-18 实测；口播注明"截至今年八月"限定时效 | VERIFIED |
| p5-22c | VERIFIED——77/176/59 逐字对站点统计；蓝/橙语义映射与本片色彩契约一致 | VERIFIED——中文数字口播自然 |
| p5-22d | VERIFIED——176/77≈2.29，"两倍多"保守表述 ✓；"最火"回指 p3-02（v2 已验证句） | VERIFIED——数字对比口语化 |
| p5-22e | VERIFIED——站点 Quick start 实为 9 篇（角标给全名） | VERIFIED |
| p5-22f | VERIFIED——9 篇均在 v2 口播/角标出现过（p2-07 Self-Instruct、p2-22 Constitutional AI、p2-45 世界模型、p2-25 Self-Refine 系、p3-13 TextGrad、p3-31 Voyager、p3-50 DGM；WebRL/MemoryBank 在 §5.3/§6.2 角标序列内） | VERIFIED——彩蛋句，不构成新断言 |

RISKY = 0，REWRITE = 0。✓

## 四、验证记录（G2）

- `build_narration.py` 重建通过（见下方实测行）。
- 未触碰句 text 字节稳定：build 前后公共 id（220 个）text 全等 ✓。
- storyboard 引用 id ⊆ narration id 集 ✓（3-G 扩到 ..34c；P5 新增 5-F/5-G 镜、5-H 原 5-F 重号）。
