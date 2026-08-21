# 2026-08 内容升级审计（v2 → v3）

> 本文档是《会写代码的 AI，开始给自己写代码》第二轮升级的可审计记录：校准审计、句级 delta、双重校验 delta、重读信源存档。
> 升级动机：三集系列配音换用本人音色克隆（passionate 风格）之际，对源论文做第二遍全文重读，校准侧重并补强视觉演绎。

## 一、重读方式与结论

- **信源**：arXiv:2608.03392v1 HTML 全文（WebFetch 二次精读 §2.3 / §3.1 / §3.4 / §4 / §5 / §7，2026-08-17）。本集论文无配套官方工程站点（用户确认「暂无」；GitHub Awesome 仓库为纯文本论文列表，无新增可视觉化事实）。
- **结论**：v2 全部论文断言与原文一致，**零事实漂移**。SICA 0.17→0.53 / LiveCodeBench 0.65→0.71 数字维持。综述正文不含 SICA/DGM 迭代次数、代数、档案规模等工程数字（复核确认），**不新增此类断言**（零编造纪律）。
- **审计发现与处置**：

| # | 发现 | 类别 | 处置 |
|---|---|---|---|
| 1 | p2-07「分数涨了就留下」相对 §4.2 锚点（"selects improved versions using coding benchmark performance, **cost, and runtime**"）简化过度，缺两项选择信号 | 侧重再平衡 | 新增 p2-07b 补全三信号；storyboard 2-B 加双仪表动效 |
| 2 | p3-25 的时机×规律（改流程当场/改模型攒批/攒记忆复盘）在 Table 2 有强结构支撑（Task-time 5 系统中 4 个属 Workflow；Model 7 系统全 Stage-wise；Memory 6 系统全 Post-task+Trajectory-derived），值得点破 | 核心遗漏（轻） | 新增 p3-25b 一句点破「斜线规律」；storyboard 3-F 加斜线光带动效 |
| 3 | §2.3 工作定义、§5.2 指标维度、§7 KEY QUOTE 等锚点已充分覆盖于 v2 各幕 | 已覆盖 | 不动 |
| 4 | 考虑过补 SICA/DGM 工程数字、SWE-bench 家族规模数字 | — | **放弃**：综述正文未展开，零编造纪律优先 |

## 二、句级 delta 清单

| 句 id | 类型 | 文本 | 锚点 |
|---|---|---|---|
| p2-07b | 新增 | 更严格一点：不光看分数，还要看花的钱、跑的时间，三项一起达标才算数。 | §4.2 "coding benchmark performance, cost, and runtime"（paper-notes §3.1 SICA 条目） |
| p3-25b | 新增 | 这不是巧合——论文的分类表里，这条规律几乎是一条斜线。 | Table 2 结构观察（paper-notes「2026-08 升级复核」新增锚点） |

其余 187 句零改动（字节稳定，见 §四 验证）。新句预算用量 2/20。

## 三、双重校验 delta（仅新增句）

| 句 id | 真实性 | 易懂性 |
|---|---|---|
| p2-07b | VERIFIED——「分数+钱+时间」三要素逐字回溯 §4.2 SICA 选择信号 | VERIFIED——「花的钱、跑的时间」口语化指代 cost/runtime，无术语墙 |
| p3-25b | VERIFIED——「分类表」指 Table 2；斜线规律为 Table 2 结构观察的直接转述（非数值断言） | VERIFIED——「斜线」承接 3-F 矩阵画面的行列结构，观众看图即懂 |

RISKY = 0，REWRITE = 0。✓

## 四、验证记录（G2）

- `build_narration.py` 重建通过：189 句（P0:18 / P1:23 / P2:62 / P3:29 / P4:19 / P5:21 / P6:17）。
- 未触碰句 text 字节稳定：build 前后公共 id（187 个）text 全等 ✓。
- storyboard 引用 id ⊆ narration id 集 ✓（2-B、3-F 区间已同步 ..07b / ..25b）。
