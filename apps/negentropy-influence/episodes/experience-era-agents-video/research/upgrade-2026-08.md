# 2026-08 内容升级审计（v1 → v2）

> 本文档是《上线之后，AI 才开始上学》第二轮升级的可审计记录：校准审计、句级 delta、双重校验 delta、信源存档。
> ⚠️ 勘误（2026-08-19）：本文 §一/§三 的「111 篇 × 9 章」为未水合占位读数（ISSUE-162 物证，保留不改）——正确口径 331 篇/9 章见 [upgrade-2026-08-v3.md](./upgrade-2026-08-v3.md) 与 [paper-notes.md](./paper-notes.md) v3 校准节。
> 升级动机：三集系列配音换用本人音色克隆（passionate 风格）之际，对源论文做第二遍重读校准，并按「官方工程站点信源补充」规范引入站点增量事实。

## 一、重读方式与结论

- **论文**：以既有 88 页 PDF 精读笔记为底复核（重点 §1–2 harness 形式化、§8 SIP-Bench、§10 开放问题三处与 v1 口播对应），关键数字锚点全部维持。
- **站点**：https://frontisai.github.io/Awesome-Self-Improving-Agents/ 实时抓取（2026-08-18），事实条目录入 [paper-notes.md](./paper-notes.md) 末尾「信源补充」大节。
- **结论**：narration v1 全部断言与论文一致，零事实漂移。

### 审计发现与处置

| # | 发现 | 类别 | 处置 |
|---|---|---|---|
| 1 | 站点 trace-to-capability 五段闭环图（部署轨迹→经验编译器→双路→闸门）是全片结构的最佳收束复盘，v1 金句仅两句无展开 | 站点信源·结构复盘缺口 | 新增 6-B2 闭环复盘镜（p6-06a..06d，4 句） |
| 2 | 站点 Gen3 精确语义 "whose adaptation surfaces can evolve after deployment" 强于 v1 p1-25 的「自动升级的产品」表述 | 核心遗漏（轻） | 新增 p1-25a 一句 |
| 3 | v1 P4 六指标+SIP-Bench 已覆盖；站点四指标问句更利口播 | 已覆盖 | 不加句；storyboard 4-D 升级三检查点卡+四仪表动效 |
| 4 | 站点 111 篇×9 章规模 | 站点信源 | 新增 6-F 清单卡镜（p6-13a/b，2 句） |
| 5 | 考虑补 §10 多智能体涌现/多模态压缩等开放问题 | — | **放弃**：v1 三问取舍已在 planning.md 声明 |

## 二、句级 delta 清单

| 句 id | 类型 | 文本 | 锚点 |
|---|---|---|---|
| p1-25a | 新增 | 更准确地说：工位上那些允许被改的接口，自己也能在上线之后继续进化。 | 站点 "persistent harness-centered runtimes whose adaptation surfaces can evolve after deployment" |
| p6-06a | 新增 | 把整期视频拼成一张图，其实就是一个闭环： | 承启句（站点 Overview 图） |
| p6-06b | 新增 | 干活的流水，先过一道「经验编译器」——挑出有用的证据、提炼成教训、记下来龙去脉； | 站点 "Selects evidence, abstracts reusable lessons, assigns provenance"（编译步对应论文 z_i=H(τ_i)） |
| p6-06c | 新增 | 快的去路改工位，慢的去路改大脑； | 站点 Fast/Reversible（Harness）与 Slow/Durable（参数）双路；回指 p1-20/21 |
| p6-06d | 新增 | 而在承认任何一步是「进步」之前，都要过评测和安全那道闸。 | 站点闸门句 "…before treating change as improvement"；回指 P4/P5 |
| p6-13a | 新增 | 这篇综述的配套仓库，收录了一百一十一篇论文，正好按九章组织—— | 站点 111 papers / 9 chapters（2026-08-18） |
| p6-13b | 新增 | 技能、记忆、环境、工具、参数、元进化、评测、安全、定义，一章不缺。 | 站点九章节名（skills/memory/environments/tools/RL parameter-side/meta-evolution/evaluation/safety/harness definition） |

其余 172 句零改动（字节稳定，见 §四）。新句预算用量 7/20。

## 三、双重校验 delta（仅新增句）

| 句 id | 真实性 | 易懂性 |
|---|---|---|
| p1-25a | VERIFIED——"adaptation surfaces can evolve after deployment" 直译为「允许被改的接口自己能继续进化」 | VERIFIED——「接口」承接工位比喻 |
| p6-06a | VERIFIED——承启句 | VERIFIED |
| p6-06b | VERIFIED——三步（挑证据/提教训/记出处）逐字对应站点编译器描述；「经验编译器」命名标注站点来源（站点即论文官方可视化，与 §2.1 z_i 编译一致） | VERIFIED——「来龙去脉」口语指 provenance |
| p6-06c | VERIFIED——快/慢双路为论文 §2.1 双时间尺度 + 站点 Fast/Reversible、Slow/Durable 标注 | VERIFIED——回指 P1 已建立的「快的去路/慢的去路」措辞 |
| p6-06d | VERIFIED——闸门句对应论文 §8 评测六目标 + §9 安全；"before treating change as improvement" 直译 | VERIFIED |
| p6-13a | VERIFIED——111/9 为站点 2026-08-18 实测计数 | VERIFIED——中文数字口播自然 |
| p6-13b | VERIFIED——九个章名逐一对应站点章节列表 | VERIFIED——章名均为已出现过的概念词 |

RISKY = 0，REWRITE = 0。✓

## 四、验证记录（G2）

- `build_narration.py` 重建通过（实测见执行日志）。
- 未触碰句 text 字节稳定：build 前后公共 id（172 个）text 全等 ✓。
- storyboard 引用 id ⊆ narration id 集 ✓（1-G 扩至 p1-26、新增句为 p1-25a；P6 重排为 6-B/6-B2/6-C/6-D/6-E/6-F/6-G）。
