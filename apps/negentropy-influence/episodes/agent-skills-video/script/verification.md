# Stage ④ 双重校验报告（真实性 RISKY=0 / 易懂性 REWRITE=0）

> 逐句回溯 `research/source-notes.md` A1–A28 与 X 表；类比句全部对应 210 映射表已登记角色。

## 真实性核查（抽查全部含数字/厂商/断言句）

| 句 | 内容 | 判定 | 依据 |
| --- | --- | --- | --- |
| p0-01/03/04 | 2025年发起、四家竞对采纳、46 家 | VERIFIED | A17（源码清点）A19；Anthropic 官宣 2025-10（anthropic-skills） |
| p0-06 | 247 行、无版本号/日志/安全章节 | VERIFIED | spec-mdx 247 行实数；无 changelog（210 遴选纪要） |
| p0-12a | 20 技能×3000token≈六万 | VERIFIED（口径句） | A5/G:30 的算术展开，非实测主张 |
| p1-03 | 六十四字符/同名 | VERIFIED | A2 |
| p1-08a | 三格选填+私货正门 | VERIFIED | A1/A7 + spec metadata 节 |
| p1-09/10 | 「格式要保持小」治理原则 | VERIFIED | A8 直引意译（未逐字引英文） |
| p2-04 | 一行 50–100 token | VERIFIED | A4 |
| p2-09/10 | 四万 vs 两千三、快十七倍 | VERIFIED（自建限定已带） | 090 §9 实测（39,222/2,321=16.9×），句中「我们自己搭了个玩具实测」「玩具规模」双限定 |
| p2-11 | OpenAI 百分之二/八千字符 | VERIFIED（归属句已带：「OpenAI给自家助手定的规矩」） | A21【三】 |
| p2-08a/c | 5000token/500行/一层深 | VERIFIED | A4/A6 |
| p2-12a/b/c | 钉版本/脚本四条家规 | VERIFIED | guide-scripts（using-scripts 要点直译） |
| p1-08c..g | 从真实任务长出来/gotchas/跑了再改/模型会的别写 | VERIFIED | guide-best（best-practices 要点直译） |
| p3-03/04 | 「帮忙处理文档」永不触发/静默退化 | VERIFIED | A3 差例+A15；「静默退化」为 210 术语（guide-desc 意译） |
| p3-07/08 | 近失配 | VERIFIED | A14 |
| p3-09/10 | 20×3 触发率、六四分、按验证集选优 | VERIFIED | A13 |
| p4-02..05 | 四家口径 | VERIFIED | A20–A23（各家官方文档【三】，句式为对照陈述非贬损） |
| p4-05a/b | 目录混战/.agents 事实锚点 | VERIFIED | 生态抽样小结（【四】对照结论） |
| p4-06/07 | warn & load 与理由 | VERIFIED | A10 直引意译 |
| p4-08 | 严格拒三分之一/宽容全进 | VERIFIED（自建限定已带） | X2（33%） |
| p4-08a..e | 双跑盲评/断言清单/成本收益记账 | VERIFIED | A16（guide-eval 要点直译） |
| p4-09 | 13 条分歧/自称演示 | VERIFIED | A25 |
| p4-10/11 | 四家无签名/Gemini 唯一确认门 | VERIFIED | A22/A24（「以四家公开文档为准」的否定性结论，口播以「四家没有一家」直陈，证据级【三】【四】） |
| p5-02..05 | 项目压个人/拆除后 2/10 漂移/无报错 | VERIFIED（自建限定已带：「我们回实验室拆了两样」） | A9 + X1 |
| p5-05a..c | 遮蔽生效/告警义务 | VERIFIED | A9 shadowed+log a warning |
| p5-07..09 | 缩进伪字段注入 allowed-tools | VERIFIED（自建限定同上） | X4 |
| p5-09a/b | metadata str 强转 truthiness | VERIFIED（自建限定同上） | X3 |
| p5-10/11 | 被解释的文本 | VERIFIED | 210 规律 4（机制归纳，标注为「这一点」的观点句） |
| p6-05..07 | 停摆七个月/对冲/互通最顺 | VERIFIED | A26（墙钟可复算）A27 A28 |
| p6-08..b | 集装箱史 | VERIFIED | 210 参考[8]（Levinson《The Box》+ ISO 668 史实；「开卡车出身的发明者」= Malcom McLean） |

**RISKY=0**：无未溯源断言；三处厂商数字均带归属或自建限定（source-notes §三纪律逐条核过）。

## 易懂性核查

全句 8–35 字、单句一义；术语首现即释义（token/渐进披露/近失配/gotchas 均有白话伴随）；剧场角色无未登记新增。
**REWRITE=0**：无需重写句。（⑤ 成文优化只做表达层打磨，改动句回本表复核。）
