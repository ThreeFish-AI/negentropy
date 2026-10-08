# Stage① 深度评审修复台账（2026-10-09）

> 评审形态：P0 机器预检 + 七维 reader（D1 事实保真/D2 因果机制/D3 素材映射/D4 可懂性/D5 系列反串线/D6 台账登记面/D7 完备性 critic）+ 四批对抗核验（默认反驳、独立重 derive）+ 综合归级。
> 流量：14 条原始 → 去重 12 → 存活 11 → 归并 7 + 移交 1（session 工作流 wf_01123624-795）。
> 机器门基线（修复前实测）：冻结 diff 仅 3 行链接适配 / 归档指纹 10/10 / audit 15/15 FAIL 0 / 网络 verify 28·FAIL 0·WARN 2 / check_series FAIL 0·WARN 5（ISSUE-211 已知态）/ narration 3561 字 ≈ 14.02 分。

| ID | 级/严重度 | 结论 | 处置 | 复验 |
|---|---|---|---|---|
| F01 | B·major | 「清单渲染文本作 tool_result 回填」误归站点轨 s05（站点轨只 print 终端、回填仅 `Updated N tasks` 计数；渲染回填是主轨 `return self.render()` 与原型形态）；§3「两轨差异」漏第四处 | 172 三处按行补丁（§2 汇合句加主轨限定 / §3 首段按轨归属 + 走查取主轨形态声明 / 差异清单补第四处）→ **第三次重冻**（头部登记）→ 级联 planning:69 两笔 + narration p2-04 轻限定 | 冻结 diff 门：281↔281 行仅 3 行链接适配；build 3574 字窗内；p2-04 新句已入 narration.json |
| F02 | A·minor | C.2/C.3 穿透登记缺口：30 轮上限、压缩保尾部 5 条、main s15 重试 3 次与七段每轮重建、深读三项（attempt-1 起算/技能来源十类/mcp_instructions 易失）、课程叙事例数、阈值 1/999 | 附录 C.2 增第 10–11 条 + C.3 两档补登（冻结正文零改动） | 锚点逐条带行号，本轮亲证：s06 code:212 / s11 code:240-241 / main s15 code:70、:803-846 / s11 README:235 / s07 README:147-151 / s10 README:212-216 / s05 README:17-19 / s06 README:15 |
| F03 | A·minor | 官方两页（sub-agents/skills）text sha 漂移（verify WARN 2），但【二】级断言经现页实抓**全数逐字在场** | C.1 补记一行复核结论；台账 accessed 维持 2026-10-07（与「截至」口径一致） | 现页命中：15,000 tokens 告警线 / 1,536 截断 / 正文按需加载 / 只回摘要 |
| F04 | A·minor | 参考 [5]–[9] 文献性信源不入台账且无豁免说明（集合差不闭环） | sources.toml 头部加一行豁免注记 | doi/aws.amazon 在台账 grep 零命中 → 注记后覆盖面自述闭环 |
| F05 | A·minor | LICENSE 字节副本未按 skill 规格「连同 sha256 记录在旁」（系列三集共态） | 归档 README 许可行补 sha256 前 16 位 `204ff5ee216c8f89` | shasum 实测 |
| F06 | A·minor | pipeline.toml 残留 2 条陈旧 TODO 注释 + 已被取代的 280 字/分口径提示 | 删两行 TODO 前缀与 280 提示；保留 ref_sha1 取位等有效约束 | grep TODO 零残留 |
| F07 | 驳回（预检纠偏） | 预检种子 S3 为假阳性：归档 README.md 在 `source-archive/` 根在场且六要素齐备（预检误锚到 pin 子目录） | 不修；教训入账——归档 README 探测层级在归档根 | ls 亲证 + 怀疑者独立复核一致 |
| S2 | C·移交 | planning.md §一定位表时长窗仍写旧口径 13.0–14.6/3302–3708（pipeline.toml 已改 [13.0,15.5] 含片头） | **移交②策划轮**：§一该行与分幕表目标时间列对齐现行口径 | 待② |

## 预算台账

- F01 级联净 **+13 字**（3561 → 3574），窗 [3302,3937]，余量 +363；改动句 1 句（≤5，无需④全量 pass 标记）。

## 复验机器门（修复后实测）

- 冻结 diff 门：仅 3 行链接层级适配，文字零漂移 ✅
- `pipeline.py build`：147 句 / 3574 字 / 14.1 分 ✅（narration.json 与 chapters.json 已重建）
- `check_series`：FAIL 0 / WARN 5（维持 ISSUE-211 已知态，无新增）✅
- `source_ledger audit`：15/15 在册 FAIL 0 ✅
- ④ 双重校验门按序列留待 script-review→④，本阶段不重跑。

## 盲区声明（本工作流未覆盖，移交对应阶段）

⑦–⑩ 音视频全链；en 双语镜像（若产出，P2 机制句随 F01 口径同查）；姊妹集对称面（LICENSE 缺 sha 为三集共态，F05 仅修本集）；C.2 穷举完备性（本轮补登为发现项全集，非穷举证明）；外行四测实跑（④）；其余 25 条信源正文级漂移排查（本轮仅指纹/可达性）；main 轨引用全量重取数对账与 s17 附录对照。
