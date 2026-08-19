# 2026-08 内容升级审计（v2 → v3）

> 本文档是《上线之后，AI 才开始上学》第三轮升级的可审计记录。**新文件而非续写 v2 文档**：v2 的「站点 111 篇×9 章」条目是错误如何进入的物证（ISSUE-162），改掉它会毁掉支撑新过程规则的取证链。上一轮导航指针：[upgrade-2026-08.md](./upgrade-2026-08.md)。
> 升级动机：系列发布顺序调整（本集改为第一集）+ 全片换 sunny-steady 重录之际，对源论文做第三遍重读校准（审计单位改为**句**，7 个按幕并行代理），并修正 v2 遗留的 3 处事实错误。

## 一、重读方式与结论

- **论文**：88 页 PDF 全文按幕分 7 个并行校准代理（A1 P0+P1 / A2 p2-01..18 / A3 p2-19..37 / A4 p2-38..47+P3 / A5 P4 / A6 P5 / A7 P6），每句一行校准表（承接句强制 `—` 档）；取证工具 `media/pipeline/scripts/paper_extract.py`（§→页映射 / 分栏取文 / caption 收割 / 定点 find / 页面光栅化到 `out/figs/` 供看图，不入库）。
- **站点**：以数据文件为准（`data/papers.json` / `data/manuscript.json`，访问 2026-08-19）——首页 HTML 计数为未水合占位（取证链见 [paper-notes.md](./paper-notes.md)「2026-08 v3 重读校准」节）。
- **结论**：v2 审计「零事实漂移」**不成立**。本轮确证 3 处事实错误（p0-01 归属 / p1-10 编造倍数 / p6-13a.b 站点占位数字与章名）并复核其余全部口播句。

### 审计发现与处置

| # | 发现 | 类别 | 处置 |
|---|---|---|---|
| 1 | p0-01「DeepMind 的两位大神」与 p0-02 矛盾（Sutton 属 U. Alberta/Amii；essay 是 DeepMind 出品） | ❌ 事实错误 | 改「强化学习领域两位泰斗」 |
| 2 | p1-10「便宜一万倍」全文无任何倍数（find "ten thousand"/"orders of magnitude" 零命中；原文 far more frequently and cheaply） | ❌ 编造数字 | 改「便宜得多，也频繁得多」 |
| 3 | p6-13a/b「一百一十一篇」+ 九章含「工具」「定义」（HTML 占位读数 + 推断章名） | ❌ 站点取证错误 | 改「三百多篇」+ 真实九章（画面标 331 与取数日期） |
| 4 | p2-37「大部分环境卡在一楼半」论文无总体比例断言；§5.4 论点是「可执行且协议化仍不可学习」 | ⚠️ 口径偏差 | 改「就算能跑、接口也通了，反馈却稀得没法学」 |
| 5 | P3「按控制权分三级」：Figure 8 实为二维矩阵，1↔2 级分界是「改什么」非「谁控制」 | ⚠️ 降维失真 | 补二维地图表述（见句级 delta） |
| 6 | P5 只讲 3/5 类威胁；>90% 单位是 trials；AI-45° 论文自称 diagnostic lens（roadmap 提议） | ⚠️ 口径细化 | 见句级 delta |
| 7 | p2-15「16 个百分点」实为 +16.2pp（论文数字原样原则） | ⚠️ 取整 | 改「16.2 个百分点」 |
| 8 | SkillsBench「引用冲突」为 v1 笔记误读（Han=SWE-Skills-Bench、Li=SkillsBench 双基准双引） | 笔记更正 | paper-notes 已记裁决 |
| 9 | 释放的 p6-11..13 跨集引用槽（本集改第一集） | 系列定位 | 改写为 §10 收束论点「共同的地基·验证」 |

## 二、句级 delta 清单

（随校准代理返回逐条填写——见下方表格占位）

## 三、双重校验 delta（仅改动/新增句）

（真实性 + 易懂性两独立代理复核后填写；门：RISKY=0，未处理 REWRITE=0）

## 四、验证记录

- `build_narration.py` 重建通过；未触碰句 text 字节稳定（`git diff narration.json` 恰好 N 改 + M 增，其余字节相同）。
- storyboard 引用 id ⊆ narration id 集；`check_script.py` 覆盖率/预算门通过。

## 五、配音重录记录

- 参考样本：`me-bright.wav` 由 `prepare_ref.py ~/Documents/dify/me-1.mp3 --start 0.36 --duration 12` 重建，**sha1 门一次命中 54b699cce97f**（sunny/sunny-steady 的标定样本）。
- 两遍法：A 遍 `--style sunny`（草稿校时间轴）→ B 遍 `sunny-steady`（beams=3 成片）；`--plan` 排期对账。
- 领航片段试听（长分句/枚举/小数点数字各形态）。

## 六、系列定位变更

- 本集改为系列**第一集**：删除口播跨集引用（p6-11..13 改写为论文收束论点）；README/planning/paper-notes 去互引；SeriesEcho 组件替换为 VerificationBedrock（清除本集代码中唯一的他集色板引用）。

## 七、文档漂移修复

- storyboard P0 区间与 P2 镜号字母对齐代码；0-E 补「尾」标注。
- planning.md 形态行（edge-tts→克隆）与七幕时间表（按实测 12.8–13.6 分重排）。
