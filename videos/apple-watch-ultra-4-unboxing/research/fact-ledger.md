# 事实底账（fact-ledger.md）★口播断言唯一回溯源

> **纪律**（移植自 vibe-video Stage ① B 型信源）：逐字稿每一句可核查的断言，必须能回溯到本文件某条 F 编号；
> 评测观点口播须带归属语；活数据（价格等）标注口径日期；置信 ✅=官方或多源一致、⚠️=单一来源待复核、❓=低置信仅作线索。
> 冲突项以 ⚠️CONFLICT 标注，官网逐字复核后裁决并记录依据。
> 亲历记录区的锚点 = 用户本人确认；⟨TBD⟩ = 待用户回填或实拍揭晓。

生成：2026-10-10，来源 = awu4-unboxing-research Workflow（8 代理 / 160 条 facts）。
原始 JSON：`.context/awu4-research-raw.json`（工作区级，gitignored）。

---

### ⚖️ 官网逐字复核记录（2026-10-10，冲突裁决）

> 抓取 apple.com.cn/apple-watch-ultra-4/specs/（存档 `.context/awu4-specs-cn.html`）逐字核对：

| 争议项 | 官方页原文 | 裁决 |
|---|---|---|
| 表壳厚度 | 「高度：49 毫米 宽度：44 毫米 厚度：12 毫米」「重量 (原色)：63.0 克 重量 (黑色)：63.1 克」 | **12mm 为准**；评测区「与上代外观完全一致」作废——口播只引 Ultra 4 自身规格，禁做「与上代一致/更薄 X mm」断言（上代数据未在本轮一手核实） |
| 充电 0-100% | 本页仅有「充至 80% 电量约需 2 小时」 | 「0-100% 约 2.5 小时」摘要**不采信**；口播只说「充至 80% 约两小时」 |
| 包装内容 | 「Apple Watch Ultra 4 / 表带 / Apple Watch 磁力充电器转 USB-C 连接线 (1 米)」 | 三件套确认；充电线名称**无「快速」二字**（佐证国行 5W 慢充结论 F 区 specs 条目） |
| 定位系统 | 「精准的双频 GPS (GPS、Galileo、QZSS 和北斗)」 | GLONASS 移除确认；北斗在列 |

---

## 一、官方规格与包装区（specs-packaging）
> 本区条目以苹果官网（apple.com / apple.com.cn）为一级证据；口播引用规格一律以此区为准。

**综述**：国行 Ultra 4 起售价 ¥6,499（仅 GPS+蜂窝、49mm 钛金属、原色/黑两色、20 种官方表带配置，米兰尼斯组合 ¥7,499）。核心规格：S11 双核+4 核 NPU、64GB、3000 尼特广视角 OLED、日常 50h/低电量 84h/最大延长训练 45h、WR100+40m 潜水、双频 GPS（GPS/Galileo/QZSS/北斗，移除 GLONASS）。盒内仅手表+1 条表带+充电线，无适配器，100% 纤维包装。国行三大硬差异：随附 WPT 5W 慢充线且无快充（0-80% 约 2h vs 海外 45 分钟）；卫星 SOS/信息/查找与高血压通知均不可用（未列大陆、待监管审批）；血氧可用，Siri AI/Audio Intelligence 首发不含大陆。

**自报缺口**（调研代理自述未搜到/不确定项，写作时留意）：
- Ultra 4 零售盒内部一手细节未确认：纸模内衬形态、盒面是否延续山景图案、是否含纸质说明书/合格证——充电头网 2026-09-18 国行开箱文存在（标题《手表却无缘快充：国行Apple Watch Ultra 4开箱》）但正文 URL 未获取到，仅有搜索摘要；官方清单只列 3 项且未提任何纸质文件
- 美版钛金属米兰尼斯表带组合的官方美元定价未核实（推断 $899 但无官方页证实；国行 ¥7,499 已多源确认）
- Hermès Ultra 4 官方定价与国行是否开售/售价未核实（$2,199 摘要归属不清，Hermès 系列起点价报道为约 $1,249）
- 钛金属米兰尼斯表带单独购买价 ¥1,779 仅有教育商店页搜索摘要，未在官网主商店页复核
- 运行内存 4GB 无官方规格页佐证（官方仅列 64GB 存储）；「健康传感器数量翻倍」在官方新闻稿/规格页/营销页均无此表述，官方口径是『更强的光学与电学传感器 + 更大更省电的绿色 LED』（心率频率×60、HRV×24），基线事实中这两点建议在视频中避免直接引用
- Siri AI / Apple Intelligence / Audio Intelligence 在中国大陆的后续开放时间无官方时间表；国行可用性页『未列出』不等于官方明示『永久不可用』，视频措辞建议用『国行首发未提供/未列入官方可用清单』
- watchOS 27 Workout Buddy 在国行的可用性未单独核实
- 国行 0-100% 充电约 2.5 小时的数字来自官网电池页搜索摘要，未逐字核对（0-80% 约 2 小时已从国行规格页原文双重确认）
- 「WRS」字样未在任何官方页面出现，官方防水口径为 WR100（ISO 22810:2010 100 米）+ EN13319 40 米休闲潜水
- Ultra 4 是否附赠/支持任何新款充电底座或旅行配件（如 AirPods Pro 3 同款 Watch 充电盒）未查证

---

## 二、评测共识区（vs-ultra3-reviews）
> 本区为二手评测观点，口播引用必须带归属语（如「评测普遍反馈」「DC Rainmaker 认为」），不得说成客观事实。

**综述**：Ultra 4 与 Ultra 3 外观、尺寸、屏幕完全一致（49mm，仅增重约 2g），升级全部向内：S11 芯片+4GB 内存、健康感测系统（传感器翻倍、每 5 秒心率、HRV 频率×24、Recovery HRV、Readiness 评分）、续航 42→50h（低电量 84h、GPS 训练最高 45h）、15 分钟快充回血 18h；5G/卫星连接不变，仅移除 GLONASS、表壳改 3D 打印再生钛。评测共识：心率精度对标胸带（DC Rainmaker 称苹果史上最佳光学心率）、续航普遍兑现宣称（实测 48h～3 天）；最大争议是 Audio Intelligence 录音隐私（MKBHD 直言『隐私噩梦』）。升级结论一边倒：Ultra 3 用户不值得升，Ultra 1/2 与老 Series 用户值得。国行 6499 元起。

**自报缺口**（调研代理自述未搜到/不确定项，写作时留意）：
- The Verge Ultra 4 完整评测原文无法直接打开（theverge.com 抓取失败），9/10 评分经 Tom's Guide 汇总与 Wikipedia 转引间接确认，标题/作者未能从原文核验
- MKBHD 未发布 Ultra 4 单独评测，其观点取自 Series 12 主题视频《The Apple Watch Has a Problem》逐字稿；Waveform 播客对 Ultra 4 的讨论未取得文稿
- 少数派（sspai.com）未检索到 Ultra 4 专门评测文章，仅有首页 Series 12 体验线索
- 知乎上 Ultra 4 专门高赞回答/专栏暂未检索到（热门内容多为 Ultra 3 时代），B站除凰家评测（约 6.3 万播放）外多为小体量开箱（数千播放），缺头部 UP 主深度横评数据
- 佩戴发热反馈：全部已读评测均未明确提及 Ultra 4 发热表现，无法下结论
- 澳元定价两个来源冲突（Tom's Guide 规格表 AU$1,349 vs TechRadar AU$1,399），未定论
- MacRumors Buyer's Guide 与 9to5Mac 评测（Chance Miller）完整 URL 未能解析成功，核心结论经搜索摘要与第三方镜像交叉确认，但未能通读全文
- 端侧 Siri AI 是否需要 S11 硬件（Ultra 3 可否获得完整 Siri AI 体验）边界未完全明确：watchOS 27 支持列表含 Ultra 3，但端侧算力依赖程度无权威拆解
- 国行 Ultra 4 卫星功能可用性未确认（Apple 官网卫星功能标注地区限制，国行页面未提及卫星，历史上国行无卫星服务，疑沿用此口径）
- Health Age/长寿标签页、Quest Diagnostics 实验室整合（$119/50+ 项生物标志物）等『稍后推送』功能的实际上线时间与国行可用性未知

---

## 三、系统已知问题区（known-issues）——分级归因的依据
> 本区直接决定 P1/P4 口播的故障归因措辞：重启=watchOS 27.0 已知问题（27.0.1 修复）；SIM 掉线=无 watchOS 27 专属证据的跨代个案。

**综述**：用户遭遇的「多次自动重启」正是 watchOS 27.0 首发实锤的 Series 12 / Ultra 4「重启门」：内核日志指向神经网络引擎超时（卡死约 2 秒）触发恐慌重启，发售仅 6 天苹果即紧急推送 watchOS 27.0.1（24R365）修复并扩展至全系列；部分用户更新后仍复发、最终换机，与用户获得整机换货的经历吻合。而「蜂窝掉线 SIM 无法识别」是 Ultra 系列跨代长期问题（eSIM/运营商一号双终端侧为主），无 watchOS 27 专属大规模报告。iPhone 端 iOS 27 另有 18 Pro Face ID 死机重启 bug（iOS 27.0.1 修复），编导时必须与手表端区分。硬件端无发黄/掉漆潮，首发最大硬件争议是背部传感器下皮肤刺激。

**自报缺口**（调研代理自述未搜到/不确定项，写作时留意）：
- 苹果未发布专门支持文档或公开声明承认「重启门」，仅 watchOS 27.0.1 更新日志一句带过；无官方受影响设备数统计，也没有 Ultra 4 官方换新/延保计划
- 未找到 watchOS 27 专属的大规模「SIM 无法识别/蜂窝掉线」聚合报告——无法确证用户的蜂窝问题是被广泛报告的 watchOS 27 已知 bug，更符合跨代 eSIM/运营商侧长期问题的个案；反复内核恐慌是否会连带打断 eSIM 会话亦无数据
- 27.0.1 后仍复发重启的比例无量化数据；watchOS 27.1 正式版完整修复清单未取得（仅有『安全修复+兼容』概述级信息）
- 威锋论坛具体讨论帖未能检索到（搜索请求被内容过滤拦截/站内未收录）；微博仅有二手引用（@吃螃蟹的快乐 的图片被凤凰网科技转载），原帖转发量/评论量等热度数据不可得
- Ultra 4 首发硬件：屏幕发黄、掉漆、表带回弹、麦克风异响均无 Ultra 4 专属聚集报告（麦克风仅有跨代通用问题与 Apple 2025-09 通用排查文档）；V2EX 按钮咔哒声仅 1 例，不能当作普遍品质问题呈现
- 部分外媒（AppleInsider/PCMag/ZDNet/MacRumors/凤凰网）具体文章深链 URL 未取得，搜索工具只返回域名级链接，已在事实条目中以『媒体名+文章标题+日期』标注，可按此回查原文
- 国行 Ultra 4 蜂窝掉线的运营商分布（移动/联通/电信哪家更易掉线）无公开统计，一号双终端各省市开放范围无 2026-10 最新名单

---

## 四、换货流程区（exchange-process）
> ⚠️ 用户实物校准（2026-10-10，S12）：本次换货寄来的是**完整零售彩盒**，并非下文 F65 所述的素白服务盒——F65 仅作「其他换货路径」背景，不得用于本片口播；内容物以 Day0 实拍揭晓为准。

**综述**：苹果官方整机换货（replacement）的完整事实链已闭环：国行政策页白纸黑字"更换用的所有 Apple Watch 都是新的"，保修=原保修剩余或 90 天取较长（不重新计算）；换货是素白服务盒只装裸表主机，表带/充电器留用，寄回旧机也只收裸表；迁移三步=取消配对（自动备份+关激活锁）→新表靠近 iPhone 直接转移→运营商 eSIM"一号双终端"退订+补换卡转移；客服诊断靠 Apple 支持 App 收集的诊断日志，Ultra 4 随机重启已被证实为 Neural Engine 看门狗问题并由 watchOS 27.0.1 修复。三包"换货重新计算保修"是否覆盖手表存疑。

**自报缺口**（调研代理自述未搜到/不确定项，写作时留意）：
- Apple Watch（智能手表）是否强制适用《移动电话机商品修理更换退货责任规定》的换货后保修重新计算条款——无权威定论，Apple 官方按自身"剩余或 90 天取长"执行
- 快速更换服务（ERS）在中国大陆对 Apple Watch 的逐项可用性、服务费金额——条款页存在但官方未公示产品级细则，需致电 400-666-8800 确认
- 国行 Ultra 4 换货白盒的 2026 年实拍级细节（盒面标签内容、序列号/部件号贴纸、是否印 Watch 字样、内衬形态）——未搜到国行最新开箱帖，仅有 Reddit 美版 Ultra（约 2023-01）与 9to5Mac 2015 年报道
- 蜂窝掉线/SIM 无法识别与 Neural Engine 重启疫情是否同根因，或独立硬件问题——无权威结论；watchOS 27.0.1 只修复了重启
- 部分官方文档（激活锁/设置新表/备份/蜂窝设置）与联通 eSIM 攻略的精确文章 URL 未钉死，仅有标题、更新日期与域名级链接
- 寄修 7-15 个工作日为 Apple 支持社区经验值，官方无公开 SLA 承诺
- 网传"中国电信 2025-11-04 起全国恢复一号双终端"未见运营商一手公告，电信/移动当前换机转移细则待核

---

## 五、亲历记录区（story-facts，⟨TBD⟩ 待用户确认）

> 锚点 = 用户本人确认（第一手）。以下清单在 Step 1 发给用户逐条回填；未回填项逐字稿一律用定性表述，禁止编整数。**2026-10-10 用户对 narration 人工校准（v2.3）即本区第一手锚点**，校准原话逐字记入 S3/S4/S6/S12/S13。

| 编号 | 事项 | 用户答复 |
|---|---|---|
| S1 | 运营商（移动/联通/电信）——决定 eSIM 转移流程写法与移动暂停风险 | **中国联通**（2026-10-10 用户确认）；转移流程=联通 App 退订一号双终端 → Watch App 重新开通（见四区换货流程条目） |
| S2 | 购买日期 / 渠道（官网/直营店/授权店）/ 实付价 / 是否 AppleCare+ | ⟨TBD⟩ |
| S3 | 首次故障日期；重启频次 | **频次已确认（用户校准原话 p1-04）：「每天至少有一两次」**；首次故障日期 ⟨TBD⟩ |
| S4 | 蜂窝掉线频次与形态 | **频次（用户校准原话 p1-07）：「几乎每次不带手机出门都会遇到」**；**形态（用户校准原话 p1-08）：「设置里就直接报没有 eSIM 卡」**（与首条消息「SIM 卡直接无法发现」一致）；恢复方式 ⟨TBD 待审阅期回填⟩ |
| S5 | 故障发生时手表系统版本 | **watchOS 27.0：多次自动重启 → 升级 27.0.1 后重启消失、但蜂窝掉线仍复发**（2026-10-10 用户确认）。归因分级：重启=27.0 已知问题且修复对我生效；掉线=27.0.1 后仍存、客服未查出根因——**掉线是换货直接原因**。补注：27.0 为 Ultra 4 出厂版本（F 区 known-issues「watchOS 27.0 出厂版即存在」），故重启时段=出厂版本时段，口播用「出厂自带的系统」框架（p0-05/p1-02） |
| S6 | 客服渠道、诊断方式、结论原话 | **组合渠道**（2026-10-10 用户确认）：官网在线客服聊天框（可截图，P1 主力打码素材）+ 电话联系（无文字记录，时间线图形化）+ 邮件知会（可截图）。结论=**官方直接安排整机换新**（用户校准原话 p1-10：「经过与官网客服沟通，官方直接安排了整机换新」）——口播只提官网客服，电话/邮件不入口播 |
| S7 | 换货周期（申请→到手天数）、旧表寄回方式与凭据 | ⟨TBD⟩ |
| S8 | 新表到手日期（决定「观察 X 天」表述与拍摄日程） | ⟨TBD⟩ |
| S9 | 客服记录可导出的截图清单（时间线原话数量） | ⟨TBD⟩ |
| S10 | 旧表使用天数 | **10 天**（2026-10-10 用户第二轮确认「之前换掉的用了 10 天」） |
| S12 | 换货包装形态 | **普通零售彩盒（与旧表那只一模一样），未拆封**（2026-10-10 用户校准 p1-11「整个新的表盒子」+ 澄清问答确认）；内容物预期=表+表带+充电线、无充电头（p2-04 用户预期），以 Day0 实拍为准 |
| S13 | 换货窗口 | **官网购买、交付日起 14 天退换期内反馈**（用户澄清问答确认 p6-03「14 天以内」指官方退换期）；锚点见 F78 |
| S11 | 旧表寄回时序 | **已寄回**（2026-10-10 用户多选未勾「旧表还在手上」+ 换货新盒在手推定）；申请→到手→寄回的确切顺序 ⟨TBD 审阅期确认⟩——若配对时旧表仍在手上，P3 迁移路径按实际改写 |

## 六、批判代理缺口裁决表（critic 9 项 → 处置方式）

| # | 缺口 | 裁决 |
|---|---|---|
| C1 | 白盒 2026 国行实拍细节 | **已由用户实物销账**：本次为零售彩盒非白盒（S12）；内容物仍按 P2 ⟨TBD⟩ 实拍回填 |
| C2 | SIM 掉线归因口径 | 分级表述写入 redlines②（重启=已知已修；SIM=个案）|
| C3 | 换货保修计算两官方口径冲突 | 口播不断言；checkcoverage.apple.com 实机画面自证 |
| C4 | 官换机 M/N 鉴别表述 | 若入片：字段=「型号号码」+ 官网查询兜底（redlines③）|
| C5 | 运营商一号双终端现行流程 | S1 回答后按对应运营商流程写；移动暂停风险写进拍摄预案 |
| C6 | 国行零售盒内部细节 | 用户实物在手，拍摄前实拍核对（非编剧阻塞）|
| C7 | AI 功能国行边界表述 | 措辞锁定「国行首发未列入官方可用清单」（redlines⑥）|
| C8 | watchOS 27.0.1 日期与日志原文 | 执行期核验 support.apple.com「About watchOS 27 Updates」|
| C9 | ERS 快速更换服务细则 | 豁免（口播不提）|

---

### 事实条目（specs-packaging，21 条）

#### F1 国行起售价 RMB 6,499（不是 ¥6,949），仅提供 GPS+蜂窝版

- **置信**：✅ high
- **细节**：苹果中国官网购买页与国行新闻稿明确：Apple Watch Ultra 4 起售价 RMB 6,499（含增值税），仅 49mm 一种尺寸、仅 GPS+蜂窝网络版（无纯 GPS 版），每位顾客限购 6 只。国行新闻稿（2026-09-09/10）：即日起接受订购，9 月 18 日（周五）起零售店发售。参照系：同场 SE 3 国行 ¥1,999 起、Series 12 国行 ¥2,999 起；美版 Ultra 4 $799 / Series 12 $399 / SE 3 $249。
- **来源**：https://www.apple.com.cn/shop/buy-watch/apple-watch-ultra（2026-10-10 抓取（产品 2026-09-18 开售））

#### F2 钛金属米兰尼斯表带组合国行 ¥7,499（比标准组合贵 ¥1,000）

- **置信**：⚠️ medium
- **细节**：多个中文信源一致：49mm 原色钛金属表壳+原色钛金属米兰尼斯表带（M 码）官方购买页售价 ¥7,499（新浪财经 2026-09-16 转载博主晒出的官方页面截图）；ZOL 报价 ¥7,499；淘宝 Apple 授权店同价。教育商店页另显示 49mm 黑色钛金属米兰尼斯表带（-S）单买价 RMB 1,779（仅一条搜索摘要，未在官网主商店页复核，置信 low）。
- **来源**：https://detail.zol.com.cn（2026-09-16（新浪截图）/ 2026-09 后）

#### F3 表壳物理规格：49×44×12mm、原色 63.0g/黑色 63.1g、5 级钛金属

- **置信**：✅ high
- **细节**：国行官方规格页原文：高度 49mm、宽度 44mm、厚度 12mm（较上代 Ultra 明显更薄）；重量：原色 63.0 克、黑色 63.1 克（不含表带）；适合腕围 130–210mm；Grade 5 钛金属表壳，原色（亚光）与黑色两色。美版规格页同样标注 49mm/44mm 与两种重量。
- **来源**：https://www.apple.com.cn/apple-watch-ultra-4/specs/（2026-10-10 抓取）

#### F4 屏幕：422×514 像素、1245mm² 显示面积、峰值 3000 尼特

- **置信**：✅ high
- **细节**：全天候视网膜显示屏（广视角 OLED + LTPO3，最低 1Hz 刷新）；422 x 514 像素、326 ppi、1245 平方毫米显示面积（上代 Ultra 2 为 410×502/1185mm²）；峰值亮度 3000 尼特（Apple Watch 最高档）、最低 1 尼特；平坦蓝宝石玻璃表镜；Ultra 模块化、寻路者、定向越野表盘支持夜间模式（红光）。
- **来源**：https://www.apple.com.cn/apple-watch-ultra-4/specs/（2026-10-10 抓取）

#### F5 S11 芯片：64 位双核处理器 + 4 核神经网络引擎，64GB 存储

- **置信**：✅ high
- **细节**：官方规格页：「S11 芯片，配备 64 位双核处理器的 S11 芯片」「4 核神经网络引擎」「64GB 容量」。新闻稿称 S11 为「Apple 最强大的可穿戴芯片」，驱动 Health Sensing System、更准计步、Audio Intelligence，并以 Secure Exclave 做音频隔离处理。Series 12 同样搭载 S11（IT之家/美版商店对比页）。注：官方规格页未公布运行内存容量（基线称 4GB，无官方页佐证）。
- **来源**：https://www.apple.com.cn/apple-watch-ultra-4/specs/（2026-10-10 抓取）

#### F6 传感器清单：Health Sensing System 含 4 类健康传感器，心率每 5 秒、HRV 每 5 分钟

- **置信**：✅ high
- **细节**：健康感测系统（Health Sensing System）：第二代电极式心率传感器（ECG）、全天候光学心率传感器、血氧传感器、体温传感器；另含深度计（±1 米）、水温传感器、指南针、全天候高度计、高 g 值加速感应器、高动态范围陀螺仪、环境光传感器。营销页：背景心率读取「每 5 秒一次」（较 Ultra 3 频率×60）、HRV「最快每 5 分钟一次」（较 Ultra 3 ×24，分 Recovery HRV 与整体 HRV 两种），宣传「可穿戴设备中最精准的心率感测」（基于 Apple 2026 年 7–8 月研究，脚注 2）；光学传感器改用更大、更省电的绿色 LED。注意：官方文案没有「传感器数量翻倍」的表述（基线此点待校准，官方口径为传感器更强大而非更多）。
- **来源**：https://www.apple.com/apple-watch-ultra-4/（2026-10-10 抓取）

#### F7 电池续航：日常 50 小时、低电量 84 小时、最大延长体能训练 45 小时

- **置信**：✅ high
- **细节**：国行规格页原文：正常使用最长 50 小时；低电量模式最长 84 小时；户外体能训练（开 GPS）最长 18 小时；延长体能训练最长 25 小时（新闻稿称比上代+25%）；最大延长体能训练最长 45 小时（每秒记录 GPS，「通常足够完成百英里赛事」）。美版商店脚注给出 50 小时测试协议：630 次时间检查、190 条通知、30 分钟 App 使用、两段各 60 分钟带蓝牙音乐的体能训练、12 小时睡眠追踪；84 小时=10 小时蜂窝+40 小时蓝牙（配对 iPhone）。
- **来源**：https://www.apple.com.cn/apple-watch-ultra-4/specs/（2026-10-10 抓取）

#### F8 国行充电硬差异：随附 WPT 标准 5W 慢充线、无快充，0-80% 约 2 小时

- **置信**：✅ high
- **细节**：国行规格页原文「充至 80% 电量约需 2 小时」（官网电池页另载 0-100% 约 2.5 小时）。苹果官方支持文档《关于符合 WPT 标准的 Apple Watch 在中国大陆和印度尼西亚》（2026-09-19 更新）：在中国大陆销售的 CH/B 机型随附「符合 WPT 标准的 Apple Watch 磁力充电器转 USB-C 连接线（1 米）」，该充电器不支持快速充电。充电头网 2026-09-18 国行开箱实测佐证：国行盒内是老款 5W 充电线，且苹果中国官网至今未上架那根 10W 快充线。海外版则随附磁力快充线（型号 A3277，配 20W 适配器测试）：0-80% 约 45 分钟、快充 15 分钟可用最长 18 小时（美版官方对比表原文）。这是国行与海外版「实打实的差异」，对开箱视频是核心卖点级素材。
- **来源**：https://support.apple.com/zh-cn（2026-09-19（支持文档）/ 2026-09-18（充电头网开箱））

#### F9 防水与坚固性：WR100（100 米）、IP6X、EN13319 休闲潜水 40 米、MIL-STD-810H

- **置信**：✅ high
- **细节**：官方规格页：按 ISO 22810:2010 标准防水 100 米（WR100m，页面未出现「WRS」字样）；防尘 IP6X（IEC 60529）；经 EN13319 认证可用于最深 40 米休闲水肺潜水（精度 ±1 米，水深 1 米自动启用，可配 Oceanic+ app）；符合 MIL-STD-810H（高空、低温/高温、冲击、振动等）；支持高速水上运动。
- **来源**：https://www.apple.com.cn/apple-watch-ultra-4/specs/（2026-10-10 抓取）

#### F10 定位系统：双频 GPS 仅支持 GPS、Galileo、QZSS、北斗，GLONASS 已移除

- **置信**：✅ high
- **细节**：国行与美版规格页一致原文：「双频 GPS (GPS、Galileo、QZSS、北斗)」/「Precision dual-frequency GPS (GPS, Galileo, QZSS, and BeiDou)」——GLONASS 确认从支持列表移除（上代 Ultra 2 规格含 GLONASS）。北斗在列对中国用户 GPS 表现是正向点。
- **来源**：https://www.apple.com/apple-watch-ultra-4/specs/（2026-10-10 抓取）

#### F11 连接与蜂窝：蓝牙 5.3、双频 Wi-Fi、第二代 UWB、5G RedCap；国行蜂窝不支持港澳台及国际漫游

- **置信**：✅ high
- **细节**：规格页：Wi-Fi 802.11n 双频（2.4/5GHz）、蓝牙 5.3、第二代超宽带（UWB）芯片（支持 Precision Finding 找 iPhone）；蜂窝型号 A3580 支持 5G RedCap 和 LTE（完整频段表见规格页）；兼容 iPhone 11 或后续机型（含 iPhone SE 第 2 代起）+ iOS 27 或更新。国行购买页注明：蜂窝需开通移动通信服务计划，且不支持港澳台及国际漫游（换货叙事中「SIM 掉线」排查时值得引用）。另：新手势「甩腕轻拂」（wrist flick）单手操作，需 Series 9/Ultra 2/SE 3 及以上。
- **来源**：https://www.apple.com.cn/apple-watch-ultra-4/specs/（2026-10-10 抓取）

#### F12 国行差异：卫星 SOS/卫星信息/卫星查找三项国行均不可用

- **置信**：✅ high
- **细节**：海外版 Ultra 4 支持 Emergency SOS via satellite、Messages via satellite、Find My via satellite，由 Globalstar 提供连接，激活 Ultra 3 或更新机型后免费两年（脚注：卫星信息/查找需运营商套餐；卫星收发信息需配对 iPhone 开机并有 Wi-Fi/蜂窝）。国行 watchOS 功能可用性页明确：卫星 SOS 仅 18 个国家/地区（美、加、日、澳、法、德等），卫星信息仅 4 地（美、加、日、墨），卫星查找 13 地（美、加、日、墨、澳、新西兰、英、法、德、荷、西、葡、瑞士）——三份名单均不含中国大陆；国行 Ultra 4 营销页与规格页也无任何卫星条目。
- **来源**：https://www.apple.com.cn/watchos/feature-availability/（2026-10-10 抓取）

#### F13 国行差异：高血压通知国行不可用（待监管审批），国行页面零宣传；官方功能名为「高血压通知」而非「血压趋势」

- **置信**：✅ high
- **细节**：海外版营销页有专门段落「Receive hypertension notifications」：通过光学传感器分析 30 天周期内血管对心跳的响应、识别高血压模式后提醒；脚注：不适用于 22 岁以下、已确诊高血压者及孕妇。国行 watchOS 功能可用性页的高血压通知名单约 150 个国家/地区，含香港、澳门、台湾，但不含中国大陆，且脚注 6 明示「该功能在你所处地区的 Series 12 和 Ultra 4 上可能无法使用，尚待完成额外的监管审批」。国行营销页/规格页全文无「血压/高血压」字样。另：功能可用性页没有单独的「血压趋势」条目（官方口径只有高血压通知；无绝对血压值测量）。
- **来源**：https://www.apple.com.cn/watchos/feature-availability/（2026-10-10 抓取）

#### F14 国行血氧可用：血氧 app 在国行正常宣传且在官方可用性名单内

- **置信**：✅ high
- **细节**：国行营销页明确宣传：「Ultra 4 上的传感器和血氧 app，让你能在需要时测量自己的血氧水平，也可开启后台测量」（脚注 9：仅用于健康生活目的，非医疗用途）；watchOS 国行功能可用性页的血氧 App 名单明确包含中国大陆（及港澳台）。ECG 心电图、心律不齐提示、房颤历史、睡眠呼吸暂停提示、生命体征（Vitals）等也均在国行健康功能中列出。
- **来源**：https://www.apple.com.cn/apple-watch-ultra-4/（2026-10-10 抓取）

#### F15 Siri AI 与 Audio Intelligence：首发仅英语、初期不含欧盟，国行可用性清单未列

- **置信**：⚠️ medium
- **细节**：美版商店/营销页脚注：Siri AI 为 watchOS 27 beta 功能，需 Apple Intelligence 支持的设备，「首发仅英语（Siri AI is rolling out in English）」，watchOS 上初期不在欧盟提供；依赖服务器模型的功能有每日用量限制，未来扩展访问将收费。Audio Intelligence 需 Series 12 或 Ultra 4：Sound Recognition 与更快的 Shazam 随机可用，Live Rewind（回看前 15 秒对话文字）与 Siri Recap（对话摘要）2026 年底 beta，需搭配支持 Apple Intelligence 的 iPhone 16 或更新机型（不含 iPhone 16e），首发英语、初期不含欧盟。国行 watchOS 功能可用性页没有 Apple Intelligence/Siri AI/Audio Intelligence 任何条目（传统 Siri、嘿 Siri、Siri 语音回应在大陆可用，含普通话/粤语）；国行规格页无障碍功能列表含「声音识别」（Sound Recognition 辅助功能）。结论：国行首发无 Siri AI/Audio Intelligence，但苹果未发「大陆永久不可用」声明。
- **来源**：https://www.apple.com/shop/buy-watch/apple-watch-ultra/49mm-natural-titanium-titanium-milanese-loop（2026-10-10 抓取）

#### F16 零售盒内物品：仅手表 + 1 条表带 + 1 米磁吸充电线，无电源适配器

- **置信**：✅ high
- **细节**：官方规格页「包装内容/What's in the Box」逐字清单（两地区一致的三项）：①Apple Watch Ultra 4；②表带（1 条）；③充电线——美版「Apple Watch Magnetic Fast Charger to USB-C Cable (1 m)」（快充线，型号 A3277，官方按 20W USB-C 适配器测试，适配器不随附）；国行「Apple Watch 磁力充电器转 USB-C 连接线 (1 米)」（注意：无「快速」二字，即 WPT 5W 慢充线，见快充条目）。无电源适配器、无耳机；官方清单未列纸质文件（上代 Ultra 拆解开箱含说明书/合格证，Ultra 4 未一手确认）。
- **来源**：https://www.apple.com/apple-watch-ultra-4/specs/（2026-10-10 抓取）

#### F17 包装设计：100% 纤维基材料、紧凑化设计，未官方提及「纸模内衬」字样

- **置信**：✅ high
- **细节**：国行营销页「与环境」版块：Apple Watch Ultra 4 包装采用紧凑高效设计（单次运输装载量+30%）；「各款 Apple 新产品的纸质包装都采用 100% 纤维材料」，整个包装盒可直接放入家用回收箱；规格页环保脚注：回收材料重量占比 45%、表壳 100% 再生钛金属、电池 100% 再生钴、再生铜线与再生钨、制造 100% 可再生电力。上代 Ultra 开箱先例（充电头网/EDN/什么值得买）：手表与表带分盒、纸质托盘固定、无塑封、盒面印山景图案——Ultra 4 是否延续盒面图案与纸模内衬布局，本轮未拿到一手开箱图文（充电头网有 9-18 国行开箱文/视频但正文未能抓取），编导拍摄前建议实拍自己的盒子。
- **来源**：https://www.apple.com.cn/apple-watch-ultra-4/（2026-10-10 抓取）

#### F18 官方表带阵容：三大运动表带全新配色 + Ultra 系列首次提供钛金属米兰尼斯表带，共 20 种官方配置

- **置信**：✅ high
- **细节**：新闻稿+官方商店 20 种配置（每种壳色各 10 种）：野径回环式表带 Trail Loop——深棕褐（dark umber）/沙砾色（sand）/勃艮第酒红（burgundy）；高山回环式表带 Alpine Loop——沙漠色（desert）/深橄榄（dark olive）/勃艮第酒红；海洋表带 Ocean Band——全新半透明硅胶材质，半透明灰/半透明海藻绿（translucent kelp）/半透明黑；钛金属米兰尼斯表带——原色/黑色各一款，颜色须与表壳同色搭配（此前 Ultra 三代从未有官方米兰尼斯配置，属 Ultra 4 新增）。无链式表带（Link Bracelet）；新闻稿未提 Nike 版 Ultra。每款整机只随附所选 1 条表带。
- **来源**：https://www.apple.com/newsroom/2026/09/apple-unveils-apple-watch-ultra-4/（2026-09-09）

#### F19 Hermès 版 Ultra 4 存在：Grand H 钛金属表带（可延展至湿式潜水服外）+ Fathom and Wonder 表盘

- **置信**：❓ low
- **细节**：新闻稿：Apple Watch Hermès Ultra 4 提供原色钛金属版本，Hermès 系列新推 Grand H 钛金属表带，内置延展机构、可调节佩戴于湿式潜水服之上；新表盘 Fathom and Wonder，旋转数码表冠可在四个「海面到海床」主题间切换（各有独特蓝色调与动画）。美版 Apple Store 有「Apple Watch Hermès Ultra 4 49mm Gris Titane Grand H Titane」购买页；一条搜索摘要显示某 Hermès 49mm Gris Titane Grand H Titane 配置 $2,199（12 期 $183.25/月），但归属 Ultra 4 还是 Series 12 Hermès 不明；另有报道称 Hermès 系列约 $1,249 起。国行是否开售 Hermès Ultra 4 及定价未核实。
- **来源**：https://www.apple.com/newsroom/2026/09/apple-unveils-apple-watch-ultra-4/（2026-09-09）

#### F20 watchOS 27 生态与兼容：2026-09-14 发布，要求 iPhone 11+/iOS 27

- **置信**：✅ high
- **细节**：新闻稿：watchOS 27 于 9 月 14 日（周一）发布；Ultra 4 需搭配 iPhone 11 或后续机型（含 SE 第 2 代起）并安装 iOS 27 或更新系统——与用户「升级 iOS 27/watchOS 27 后出现重启与蜂窝掉线」的时间线吻合，可作为视频叙事锚点。watchOS 27 其他要点：Siri AI 上腕、Audio Intelligence、Smart Stack 情境化建议与单手操作（甩腕轻拂手势）、Workout Buddy 可脱离 iPhone 使用（新增西班牙语）、经期追踪支持围绝经期/绝经期。健康 App 改版新增 Insights/Longevity 标签页（含 Health Age，美区另有 Quest 检测预约合作）。
- **来源**：https://www.apple.com/newsroom/2026/09/apple-unveils-apple-watch-ultra-4/（2026-09-09）

#### F21 媒体一手评价参考：心率精度与续航是本代核心升级点

- **置信**：⚠️ medium
- **细节**：CNET 上手（2026-09-10）：$799 起，「新处理器+重构的健康传感器，解锁更高频的健康测量」；Tom's Guide 评测（2026-09-17）：实测跑 22 英里，重点验证连续心率与 HRV 追踪的重构传感器系统；Hodinkee 上手（2026-09-17）：主要提升来自更强的芯片与背部大幅改进的传感器；T-Mobile 对照页：日常续航 50 小时（上代 Ultra 2 为 36 小时）。这些可作为视频「官方参数 → 实际体验」过渡段素材。
- **来源**：https://www.cnet.com（2026-09-10 至 2026-09-17）

### 事实条目（vs-ultra3-reviews，23 条）

#### F22 外观与尺寸零变化：Ultra 4 与 Ultra 3 共用同一模具，仅增重约 2g

- **置信**：✅ high
- **细节**：9to5Mac 逐项对比确认无任何外部变化；Tom's Guide 规格表：两者均为 49×44×12mm、422×514 LTPO3 显示屏、3000 尼特、100 米防水、蓝宝石镜面、操作键（Action Button）保留；重量 Ultra 4 约 63g vs Ultra 3 约 61g（+2g，来自更大电池与新传感器）。Expert Reviews 亦称『设计不变、材料相同』。原色钛/黑色钛两色延续。
- **来源**：https://9to5mac.com/2026/09/11/apple-watch-ultra-4-vs-ultra-3/（2026-09-11）

#### F23 芯片与内存：S11 为 Ultra 系列三年来首个新芯片，内存翻倍至 4GB

- **置信**：✅ high
- **细节**：Ultra 2/Ultra 3 均用 S10（2025 年苹果跳过新芯片），Ultra 4 搭载 Apple 称『最强可穿戴芯片』的 S11 + 4GB RAM（Ultra 3 为 2GB）。S11 内含 Secure Exclave 硬件隔离区，专用于音频处理（Audio Intelligence 的隐私基础）。Series 12 同用 S11。
- **来源**：https://9to5mac.com/2026/09/11/apple-watch-ultra-4-vs-ultra-3/（2026-09-11）

#### F24 健康感测系统：传感器数量翻倍、每 5 秒全天心率、HRV 频率提升 24 倍

- **置信**：✅ high
- **细节**：Apple 官方：全新 Health Sensing System，第二代电极式心率传感器+全天候光学心率传感器，更大更省电的绿光 LED 实现全天每 5 秒测心率（Ultra 3 仅训练时连续监测、背景约每 5 分钟一次，即频率最高提升 60 倍）；HRV 监测频率提升至 24 倍，并拆分为 Recovery HRV（恢复心率变异性）与整体 HRV 两项指标。AppleInsider 汇总确认传感器数量较上代翻倍。Tom's Guide 补充：光学传感器由 2 瓣改为 32 瓣设计，深肤色与纹身场景精度改善（纹身仍会干扰）。Apple 基于 1000+ 人研究自称『可穿戴设备中最准的心率监测』。
- **来源**：https://www.apple.com/newsroom/2026/09/apple-unveils-apple-watch-ultra-4/（2026-09-09）

#### F25 Readiness（准备状态）App：0-10 分+四档建议，Ultra 3 拿不到

- **置信**：✅ high
- **细节**：官方：Readiness 每日给 0-10 分，综合近期活动、训练负荷、生命体征、睡眠评分，输出 Recover/Pace Yourself/Ready/Go For It 四档建议，基于 Apple Heart and Movement Study 数据开发。DC Rainmaker 确认该功能与 Recovery HRV 均需 Series 12/Ultra 4 的第二代传感器，Ultra 3 无法获得。实测门槛：需连续佩戴 7 晚且单晚睡眠≥4 小时才出分（Tom's Guide；Engadget 在 Series 12 上戴满 7 晚仍未能出分，Vitals 数据不足）。
- **来源**：https://www.apple.com/newsroom/2026/09/apple-unveils-apple-watch-ultra-4/（2026-09-09）

#### F26 续航：日常 42→50 小时、低电量模式 72→84 小时、GPS 训练档位全线拉长

- **置信**：✅ high
- **细节**：官方数字：日常 50h（Ultra 3 为 42h）；低电量模式 84h（72h）；标准 GPS+心率训练 14→18h；延长运动模式 20→25h；最长运动模式（每秒 GPS）35→45h。Apple 中国官网 50h 测试口径：630 次查看时间、190 次通知、30 分钟 App、两次 60 分钟训练、蜂窝 10h+蓝牙 40h。TechRadar 评测称电池物理容量增大约 5%。
- **来源**：https://www.apple.com/newsroom/2026/09/apple-unveils-apple-watch-ultra-4/（2026-09-09）

#### F27 快充：15 分钟回血从 12 小时增至 18 小时（提升 50%）

- **置信**：✅ high
- **细节**：Tom's Guide/9to5Mac：Ultra 4 充 15 分钟获 18 小时续航，Ultra 3 同样时间仅 12 小时。Engadget 在 Series 12 上实测 12 分钟从 51% 充到 79%。Ultra 3 本就支持快充（约 1 小时充至 80%），Ultra 4 是在同规格充电器上更快。
- **来源**：https://www.tomsguide.com/wellness/smartwatches/apple-watch-ultra-4-review（2026-09-17）

#### F28 连接性不变：5G 与卫星功能与 Ultra 3 完全对等

- **置信**：✅ high
- **细节**：PCMag 对比明确：两款在卫星连接与双频 L1/L5 精准 GPS 上『同等配备』；卫星（Emergency SOS via satellite、Find My、Messages via satellite，经 Globalstar）是 Ultra 3 首发的功能，Ultra 4 原样继承，免费 2 年。第三方评测（biggo 转述 CNET）确认 5G 与卫星 SOS 均自 Ultra 3 沿袭。Ultra 1/2 无卫星——the5krunner 认为这是 Ultra 1/2 用户升级的最大单点理由。
- **来源**：https://uk.pcmag.com/apple-watch/111845/apple-watch-ultra-4-vs-ultra-3-theres-a-clear-winner（2026-09）

#### F29 GLONASS 被移除，官方未解释，媒体推测反而有利

- **置信**：✅ high
- **细节**：MacRumors（2026-09-10）：Ultra 4 技术规格仅保留 GPS、Galileo、QZSS、BeiDou 四系统（Ultra 3 含 GLONASS 共五系统）。iLounge 与 AppleInsider 跟进：GLONASS 历史上精度较差，剔除后可能减少定位解算负载、略降功耗甚至提高精度。国行用户视角：北斗仍在支持列表内，无实质影响。
- **来源**：https://www.macrumors.com/2026/09/10/apple-watch-ultra-4-glownass/（2026-09-10）

#### F30 表壳改用 3D 打印 100% 再生钛金属，环保材料比例 45%

- **置信**：✅ high
- **细节**：Apple 官方：Ultra 4 钛壳以 3D 打印工艺制造、采用 100% 再生钛，电池 100% 再生钴，整机再生材料占比 45%。国内媒体（网易/凤凰）以『3D 打印钛金属表壳』为题专门解读。新表带：Trail Loop（深褐/沙色/酒红）、Alpine Loop（荒漠/深橄榄/酒红）、半透明硅胶 Ocean Band（灰/海藻绿/黑）；Hermès 联名 Grand H 钛表链+潜水延伸。
- **来源**：https://www.apple.com/newsroom/2026/09/apple-unveils-apple-watch-ultra-4/（2026-09-09）

#### F31 Ultra 4 独占软件清单：Readiness、Recovery HRV、每 5 秒心率、新 ML 计步器（含实时步数复杂功能）、Audio Intelligence 四件套、Health Age

- **置信**：✅ high
- **细节**：Apple 支持文档（2026-09-30）明确 Audio Intelligence（声音辨识、Live Rewind、Siri Recap、Shazam 加速）仅支持 Series 12/Ultra 4，且需搭配 iPhone 11 及以上+iOS 27。DC Rainmaker：Ultra 3 经软件更新可获得训练时心率精度改善，但 Readiness、Recovery HRV、新硬件计步均不可得。Tom's Guide：新计步模型依赖 S11 硬件，旧表无法通过更新获得更准步数；Health Age/长寿标签页（Health App 改版 Insights/Longevity）年底随软件更新上线，同样绑定新传感器。
- **来源**：https://support.apple.com/en-us/121670（2026-09-30）

#### F32 watchOS 27 本身 Ultra 3 也能升：通用与独占功能边界清晰

- **置信**：✅ high
- **细节**：watchOS 27 于 2026-09-14 发布，支持 Series 9 及以后、SE 3、Ultra 2 及以后（Ultra 1 与 Series 8 及更早被淘汰）。通用功能：Siri AI（beta）、Smart Stack 单手点按手势、动态 App 网格（5 个 Siri 建议应用）、Workout Buddy 脱离 iPhone（新增西班牙语）、围绝经期/绝经期生理周期追踪。独占（需新硬件）：Readiness、Recovery HRV、每 5 秒背景心率、新计步器、Audio Intelligence、Health Age。注意 Audio Intelligence 的 Live Rewind/Siri Recap 发布时仍为 beta/稍后推送，多数评测者发布时未能实测。
- **来源**：https://www.apple.com/newsroom/2026/09/apple-unveils-apple-watch-ultra-4/（2026-09-09）

#### F33 Live Rewind 与 Siri Recap 的技术机制与隐私设计

- **置信**：✅ high
- **细节**：MKBHD 视频逐字稿披露：麦克风常态截取 15 秒原始音频片段做本地模式识别（Secure Exclave 内），平时不保存；双击表冠触发 Live Rewind 时，才加密最近 15 秒音频传至 iPhone 解密转写后删除；Siri Recap 则全天每 15 分钟采样生成对话要点（可选时段、端到端加密、不识别说话人、原始音频不保存不上云）。发布时均未上线（beta 后续推送）。Apple 官方对 Siri Recap 强调默认关闭、完全 opt-in。
- **来源**：https://www.youtube.com/watch?v=pOX1l1edBME（2026-09-22）

#### F34 MKBHD 立场：Series 12/Ultra 4 是小改款，Live Rewind/Siri Recap 是『隐私噩梦』

- **置信**：✅ high
- **细节**：Marques Brownlee《The Apple Watch Has a Problem》（2026-09-22，524 万播放、7.5 万赞）：更新『相当小』、被 iPhone 18 抢走风头是合理的；他读出苹果两路战略——围剿 Whoop 等无屏追踪器（5 秒心率+睡眠分+Readiness+健康年龄+代谢健康）与卡位 Open AI 传闻中的 Jony Ive AI 伴侣硬件；但对 Live Rewind/Siri Recap 直言『creepy』『隐私噩梦』『没人要求这个』——Siri Recap 全天静默录音、被录的旁人毫无知情同意，『这才是侵入性的、令人震惊的』。
- **来源**：https://www.youtube.com/watch?v=pOX1l1edBME（2026-09-22）

#### F35 The Verge 给 Ultra 4 打 9/10，但主线评测标题是『更快的健康追踪撞上未完成的 AI』

- **置信**：⚠️ medium
- **细节**：Tom's Guide 评测汇总与 Wikipedia 词条均引 The Verge 对 Ultra 4 评 9/10。Victoria Song 的 Series 12 评测（经 AppleInsider 转述）标题为『Faster health tracking collides with unfinished AI』：心率精度接近 Polar H10 胸带、充电更快、单手手势好用，但多个主打功能（Audio Intelligence）评测期间不可用、隐私有疑虑；Readiness 戴满 7 晚后拿到 7 分。Verge 可穿戴版面同期对比：Ultra 4 最长 84 小时 vs Garmin 新款 Enduro 4（$899.99）最长 320 小时活动追踪，续航仍是苹果短板。Verge 另指出 Ultra 4 可维修性仅 4/10（较上代改善，但远低于 Pixel Watch 5 的 9/10）。
- **来源**：https://appleinsider.com/articles/26/09/17/apple-watch-series-12-and-apple-watch-ultra-4-reviewers-praise-health-upgrades（2026-09-17）

#### F36 Tom's Guide 评测（Jane McGuire）：22 英里实测心率可对标胸带，结论『史上最佳 Ultra』但自己都不确定该不该从 Ultra 3 升

- **置信**：✅ high
- **细节**：赞：S11、连续心率显著改善（长跑中与胸带读数高度一致）、Readiness、Siri AI、Audio Intelligence、50h 续航不加价；槽：屏幕/尺寸/设计与上代完全相同（唯一 listed con）、GPS 距离精度仅『还行』（误差长距离内互相抵消）、跨国旅行扰乱 Readiness 基线、希望有更小尺寸和 LED 手电筒、对 Siri Recap 录旁人隐私存疑。原话：『如果我有 Ultra 3 会不会升？我不确定……但若你戴的是更老的 Ultra、想要更长续航或对 Audio Intelligence 感兴趣，值得买』。实测：22 英里 GPS+心率训练耗电后估算 25 小时训练续航（Ultra 3 为 20h）。
- **来源**：https://www.tomsguide.com/wellness/smartwatches/apple-watch-ultra-4-review（2026-09-17）

#### F37 续航实测各家数字：48 小时～3 天不等，共识是『兑现 50 小时宣称』

- **置信**：✅ high
- **细节**：9to5Mac（Chance Miller，09-17）：含 90 分钟训练+3 小时离 iPhone+两晚睡眠追踪仍撑 48 小时，『兑现苹果宣称』；Mashable（Stan Schroeder）：轻度使用约 3 天一充；DC Rainmaker：50h 宣称『勉强守住』，重度训练周仍达约 2.5 天，LTE 开启+蓝牙心率带 1.5 小时仅耗电 5%；CNET 在 Series 12 实测约 30 小时（官方 24h）。Mashable 同时吐槽：无新表盘、心率传感器闪烁在暗处肉眼可见且烦人、记录步数反而比自己的 Series 11 略少。
- **来源**：https://appleinsider.com/articles/26/09/17/apple-watch-series-12-and-apple-watch-ultra-4-reviewers-praise-health-upgrades（2026-09-17）

#### F38 DC Rainmaker：苹果史上最佳光学心率，但 Readiness 生态仍远逊 Garmin

- **置信**：✅ high
- **细节**：DC Rainmaker 深度评测（09-17）：新光学传感器『绝对是苹果迄今最好』，心率准确度章节表现突出；GPS 达到『运动手表中最准的端侧 GPS』之一；但 Readiness+Health Age 组合相对 Garmin 训练建议生态仍粗糙；明确提示 Readiness/Recovery HRV 需 Series 12/Ultra 4 硬件，Ultra 3 只能通过软件更新获得训练时心率精度改善——这构成 Ultra 3 用户升级与否的分水岭。
- **来源**：https://www.dcrainmaker.com/2026/09/apple-watch-ultra-4-in-depth-review.html（2026-09-17）

#### F39 「从 Ultra 3 值不值得升级」英文媒体结论一边倒：绝大多数不值得

- **置信**：✅ high
- **细节**：MacRumors Buyer's Guide（09-16）：『对绝大多数 Ultra 3 用户，Ultra 4 不值得升级——Ultra 3 已拥有全部招牌功能（大屏、卫星、5G、长续航）』；PCMag：『Ultra 4 明显胜出，但这不意味着 Ultra 3 用户该换』；Cult of Mac：仅『需要更多恢复指导或常把 Ultra 3 电池榨干的人』有强理由；the5krunner：Ultra 1/2 用户该升（卫星是决定性差异），Ultra 3 用户不必；反向共识：从 Ultra 1/2 或 Series 8/9 老表升级则非常值得。
- **来源**：https://www.macrumors.com/2026/09/16/apple-watch-ultra-3-vs-ultra-4/（2026-09-16）

#### F40 中文社区升级结论与英文一致：仅超长距离玩家与恢复数据重度依赖者建议升

- **置信**：⚠️ medium
- **细节**：什么值得买首发评测（09-17）：Ultra 3 用户不建议升级，仅两类例外——跑百公里越野的超长距离玩家、训练监控中重度依赖恢复数据（Recovery HRV/Readiness）的用户；Ultra 2 用户可先看电池健康度再决定。知乎检索到的高热内容多为 Ultra 3 时代（如《花 6499 值不值？Ultra 3 深度体验：变化不大》，2026-01），Ultra 4 专门高赞讨论暂未成规模。
- **来源**：https://post.smzdm.com/p/axd98765/（2026-09-17）

#### F41 国行定价 6499 元起，与上代持平；『功能加一轮、价格没动』是国内外共同叙事

- **置信**：✅ high
- **细节**：IT之家（09-18 开售报道）：Series 12 起售价 2999 元、Ultra 4 起售价 6499 元，两者均搭 S11+全新健康感测系统，Ultra 4 最长续航 84 小时（低电量模式口径）。国际版 $799 与 Ultra 3 持平（TechRadar：$799/£749）。京东首发可享以旧换新补贴 300 元。
- **来源**：https://www.ithome.com/0/815/6499.htm（2026-09-18）

#### F42 爱范儿定性：国行 Apple Intelligence 缺位下，Apple Watch 反而先成为『个人 AI 时代』入口

- **置信**：✅ high
- **细节**：爱范儿（09-10，腾讯新闻/36氪双发）：Apple Watch 曾被定位『配件』，在苹果 AI 转型关键年跃升为『个人智能中枢』——每日活动摘要（麦克风+GPS+传感器全天数据生成文字摘要）、Siri 对话摘要、准备指数、每 5 秒心率、高血压提示均强调本地运行与隐私；评论区共识：国行 iPhone 的 Apple Intelligence 未落地，手表的本地 AI 功能反而先行可用。凰家评测（凤凰网科技）B站双视频观点一致：往年是运动健康基础上加智能，这一代『完全向内升级，直接重构健康监测硬件』，《真正的升级，在背面？》直接点名表背传感器阵列才是本代主角。
- **来源**：https://www.bilibili.com/video/BV1s9eu6oEBp（2026-09-18）

#### F43 Series 12 与 Ultra 4 共享全部新内脏，构成『要不要多花 350 美元买 Ultra』的新纠结

- **置信**：✅ high
- **细节**：Tom's Guide 明言：Series 12 拥有与 Ultra 4 完全相同的传感器与功能（S11、健康感测系统、Readiness、Audio Intelligence），且更小更轻更适合 24/7 佩戴；Series 12 为 42/46mm、铝/钛/白陶瓷（陶瓷回归）三材质、2000 尼特、50 米防水、$399 起、续航 24h（CNET 实测约 30h）；Ultra 4 独有 49mm 钛壳、3000 尼特、100 米防水、操作键、50h 续航。9to5Mac 评测称赞新配色材质『fantastic』。B站亦有 UP 主以《巨大升级的一代？巨难选择的一代》为题讨论此纠结。
- **来源**：https://www.tomsguide.com/wellness/smartwatches/apple-watch-ultra-4-review（2026-09-17）

#### F44 佩戴/重量/传感器可见性反馈：+2g 无感，但暗处心率传感器闪烁被点名

- **置信**：⚠️ medium
- **细节**：重量从约 61g 增至约 63g（Tom's Guide/MacObserver 规格表），主流评测未见明显佩戴负担反馈；Mashable 槽点：新光学传感器绿灯在暗处（影院/夜间）闪烁肉眼可见且『annoying』——升级自硬件翻倍的直接副作用。发热问题：各家评测均未见提及（见 gaps）。
- **来源**：https://appleinsider.com/articles/26/09/17/apple-watch-series-12-and-apple-watch-ultra-4-reviewers-praise-health-upgrades（2026-09-17）

### 事实条目（known-issues，16 条）

#### F45 watchOS 27.0 首发爆发「重启门」：Series 12 / Ultra 4 大量随机重启报告

- **置信**：✅ high
- **细节**：2026-09-18 发售日起，Apple Watch Series 12（国行 2999 元起）与 Ultra 4 用户集中反馈意外重启：触发场景包括编辑表盘、拨打电话、用 Siri、打开 App、仅调节设置、甚至游泳过程中；有人到手激活几分钟即重启、一天多次。Apple Support Community 有「Apple Watch Ultra 4 randomly restarts」「Apple Watch Series 12 Unexpected Restart, Kernel Panic」等帖（09-19/20 发起）；Reddit r/applewatchultra 有专帖汇总。这与用户「多次不明原因自动重启」经历完全吻合。
- **来源**：https://discussions.apple.com（帖子标题 Apple Watch Series 12 Unexpected Restart, Kernel Panic）（2026-09-19）

#### F46 重启根因：诊断日志指向神经网络引擎（ANE）超时触发内核恐慌

- **置信**：✅ high
- **细节**：至少 4 名用户上传完整内核崩溃（panic-full）日志，内容为完全相同的 ANE 超时故障；AppleInsider 披露具体机制：ANE 命令等待 2020ms 超过 2000ms 看门狗上限→内核恐慌→强制重启；IT之家/凤凰科技等中文媒体表述为「神经网络引擎卡死约 2 秒后设备重启」。Apple 论坛跟帖另有次要猜测：损坏的 App、发热、固件损坏。
- **来源**：https://appleinsider.com/articles + https://www.ithome.com/1/005/373.htm（2026-09-21 至 2026-09-23）

#### F47 影响范围：MacRumors 论坛约 30 人 + 国内用户，多家权威媒体跟进

- **置信**：✅ high
- **细节**：什么值得买 09-18 核查帖对照 MacRumors 论坛约 30 位用户反馈与国内用户报告；MacRumors（09-21）、AppleMagazine、MacObserver、PhoneArena（09-24 称苹果发出 emergency update）、heise、India Today 均报道。凤凰网科技 09-24 报道配图来源为微博用户 @吃螃蟹的快乐，证明微博端有实拍传播，可作为视频素材线索。
- **来源**：https://post.smzdm.com + https://www.macrumors.com（2026-09-18 至 2026-09-24）

#### F48 官方修复：watchOS 27.0.1（内部版本 24R365）9 月 23-24 日紧急推送，后扩展至全系列

- **置信**：✅ high
- **细节**：发售仅约 6 天苹果即定向推送 watchOS 27.0.1，官方更新日志措辞：「This update provides bug fixes for your Apple Watch including fixing an issue where Apple Watch may restart unexpectedly」；9to5Mac 报道 09-28 该更新扩展至所有兼容机型（Series 9 及以后）。这是苹果以更新日志形式事实上承认 bug；未发现专门支持文档或公开致歉。更新条件：电量 ≥50%、连 Wi-Fi（也可经 iPhone Watch App 推送）。
- **来源**：https://9to5mac.com/2026/09/28/ + https://tech.ifeng.com（2026-09-23 至 2026-09-28）

#### F49 27.0.1 后仍有用户复发重启，社区共识指向硬件问题→换机路径

- **置信**：⚠️ medium
- **细节**：Apple Support Community「Ultra 4 randomly restarts」帖内有用户更新到最新版后仍全天随机重启；Reddit 有用户寄望 watchOS 27.1/27.2 beta 修复；社区共识：更新后仍复发可能是硬件问题，应联系 Apple 支持——与本次用户获得整机换货的结果吻合。临时自救：强制重启（同时按住数码表冠+侧边键直至出现苹果标志）；顽固案例取消配对后「作为新 Apple Watch 设置」（不恢复备份）。
- **来源**：https://discussions.apple.com + https://www.reddit.com/r/applewatchultra/comments/1wmb81x/（2026-09-20 至 2026-10）

#### F50 蜂窝「无 SIM/无连接」是 Apple Watch 跨代长期复发问题，非 Ultra 4 专属新 bug

- **置信**：✅ high
- **细节**：从初代 Ultra（2022-2023 帖「suddenly says No SIM - No Connection」）到 Ultra 3（2025-10 MacRumors 论坛 AT&T「No SIM, No Connection」、2026-06「Fails to receive calls」帖）均有报告，症状为「设置→蜂窝网络」显示 Plan-No SIM / Status-No Connection；多与 watchOS 升级后 eSIM 配置丢失或运营商开通/写入失败有关。通用解法：双端飞行模式开关、重启双端、手表设置内蜂窝开关切换（Ultra 3 用户实测有效）、重装 eSIM、运营商重新下发。截至 2026-10-10 未发现 watchOS 27 专属的大规模蜂窝掉线事件聚合报告。
- **来源**：https://discussions.apple.com + https://forums.macrumors.com（2022-10 至 2026-06）

#### F51 国行蜂窝依赖「一号双终端」eSIM，开通失败常见且多在运营商侧

- **置信**：✅ high
- **细节**：国行 Apple Watch 蜂窝走移动/联通/电信一号双终端 eSIM：移动需主卡开通 VoLTE 并经「和多号」App 激活（接听 12599800 来电）；电信 2025-11 才重启试点、仅限部分城市/套餐，不在试点即失败；联通有用户重新配对后手表显示「无SIM卡」的官方社区案例（thread/253496658），另有 Ultra 蜂窝版通话失败（thread/256102459）。Apple 于 2026-09-16 更新《在 Apple Watch 上设置和使用蜂窝网络服务》官方排查文档（飞行模式→重启→双端更新→换网络环境→查 eSIM 业务）。
- **来源**：https://discussionschinese.apple.com/thread/253496658 + https://support.apple.com/zh-cn（在 Apple Watch 上设置蜂窝网络）（2025-11 至 2026-09-16）

#### F52 iOS 27（iPhone 端）首发 bug：iPhone 18 Pro/Pro Max Face ID 失败后死机/意外重启+显色异常，iOS 27.0.1 修复

- **置信**：✅ high
- **细节**：ZDNet 09-28：iOS 27.0.1 修复 iPhone 18 Pro/Pro Max 使用 Face ID 时冻结或重启；Tom's Guide 标题明确「Apple confirms」；PCMag 09-29：同更新还修复控制中心快速滑动后的冻结与色彩伪影问题；Forbes：仅影响 18 Pro/18 Pro Max。编导注意：这是 iPhone 端独立 bug，与手表「重启门」是两回事，但同属 27.0 首发稳定性翻车、可并置叙事。
- **来源**：https://www.pcmag.com + https://www.zdnet.com（2026-09-25 至 2026-09-29）

#### F53 iOS 27 其他已知抱怨：掉电快、键盘卡顿、CarPlay、显示 bug、备份 bug 波及手表配对

- **置信**：⚠️ medium
- **细节**：MacObserver 09-28 汇总 iOS 27 用户报告：battery drain、Face ID 崩溃、键盘延迟、CarPlay 问题、显示 bug（附临时解决办法）；MacRumors 论坛 09-14 有「升级 iOS 27 是否后悔」讨论帖；Facebook iOS 群组有用户称 iOS 27 备份 bug 导致 Apple Watch 无法连接（重配新 iPhone 场景），Reddit 亦有 Series 6 升级 iOS 27 后无法配对案例（修复：先把表升到最新兼容 watchOS）。
- **来源**：https://www.macobserver.com + https://www.reddit.com/r/AppleWatch/comments/1ucr891/（2026-09-14 至 2026-09-28）

#### F54 watchOS 27 电量：beta 期抱怨集中，正式版 Ultra 4 续航达标为主流结论

- **置信**：⚠️ medium
- **细节**：r/watchOSBeta beta 期多帖抱怨掉电（「overnight drain 到怀疑充电器坏了」「AWU3 明显掉电」）；正式版后实测两极：r/AppleWatch 有用户 91 小时亮屏待机、也有人带锻炼仅 24 小时；DC Rainmaker 09-17 深度评测称 50 小时标称「squeaking by and holding up」（重度锻炼日也撑得住）；V2EX 楼主 28 小时（含 1 小时跑步）剩 31%。无系统性电池缺陷的媒体结论；Apple 官方口径：升级后数天后台索引导致临时耗电属正常。
- **来源**：https://www.reddit.com/r/AppleWatch/comments/1wn2t6e/apple_watch_ultra_4_battery_life + https://www.dcrainmaker.com/2026/09/（2026-06 至 2026-10）

#### F55 Ultra 4 首发硬件最大争议是皮肤刺激（背部传感器下红疹），非屏幕/涂层问题

- **置信**：✅ high
- **细节**：MacRumors 约 10-07 报道「Apple Watch Series 12, Ultra 4 Owners Report Skin Irritation」：部分新机主皮肤刺激/传感器下红肿，MacRumors 论坛多帖；Chipokia 等指出新机背部重新设计（健康传感器数量翻倍）可能是诱因（推测，未证实）；Apple 官方口径为表带过紧/过松、肥皂汗水等刺激物所致，建议保持表体表带皮肤清洁干燥。iGeeksBlog、PowerPage、Mactrast 及印尼语等多语种媒体跟进。V2EX 亦有 1 例「表盘下皮肤褪皮」回复（楼主归因传感器灼烧，未证实）。
- **来源**：https://www.macrumors.com（文章标题 Apple Watch Series 12, Ultra 4 Owners Report Skin Irritation）（2026-10-07）

#### F56 屏幕发黄、掉漆无 Ultra 4 专属大规模报告（阴性结论）；黑色钛划痕是延续性既有担忧

- **置信**：⚠️ medium
- **细节**：检索 Ultra 4 screen yellow tint：主流评测（DC Rainmaker/Wired/Gizmodo/Slowtwitch，09 月中）均未报告发黄，无论坛聚集帖（iPhone 12/16 Pro 发黄史不能平移到 Ultra 4）。黑色钛 DLC 涂层易留划痕、划伤后露出银色底金属格外显眼，且 Ultra 锐利表圈边缘易磕碰，是 Ultra 2/3 一脉相承的既有槽点（Digital Trends 长测、MacRumors 论坛），Ultra 4 沿用同工艺但尚无新的爆发性报告。
- **来源**：https://www.dcrainmaker.com/2026/09/ + https://www.digitaltrends.com（2026-09-17（评测）及历史延续报道）

#### F57 V2EX 中文长测帖：Ultra 4「毫无征兆死机重启 3 次」+ 零星硬件吐槽

- **置信**：⚠️ medium
- **细节**：V2EX t/1243510（09-21，楼主佩戴 Apple Watch 第 3124 天升级 Ultra 4）：优点=心率采样「史诗级提升」、跑步机实时配速误差从 20-30 秒缩至约 4 秒；缺点=28 小时（含 1 小时跑步）剩 31%、「已经毫无征兆地死机重启了 3 次，应该是软件 bug」。回复区：S12 用户同样死机（更新后出现，「感觉 27 还得修」）、控制中心按钮咔哒异响（1 人）、国行充电被「阉割成 5V1A」慢充（2 人）、跑步距离数据不准（1 人引述他人）。
- **来源**：https://www.v2ex.com/t/1243510（2026-09-21）

#### F58 新功能配套问题：tap 手势有官方排查文档；AI Siri 上腕仍被吐槽慢

- **置信**：⚠️ medium
- **细节**：Apple 2026-09-14 发布支持文档《If tap gestures aren't working on your Apple Watch》：低电量模式/睡眠专注/水锁会禁用手势，部分动作会误触发需在设置→手势中调整——侧面印证新 tap 手势（食指拇指单点）收到足够反馈；MacRumors 论坛有用户称 watchOS 27 新 AI Siri 在 Ultra 2 上是「huge step backwards」，重置并「作为新表设置」后明显改善（另注：AI Siri/Workout Buddy 仅限较新机型，CNET 06-09《watchOS 27 Fixes Siri at Last, but You May Need to Buy a New Watch》）。
- **来源**：https://support.apple.com（If tap gestures aren't working on your Apple Watch）+ https://forums.macrumors.com（2026-06-09 至 2026-09-23）

#### F59 版本时间线：watchOS 27.1 为小幅维护更新，27.2 beta 已于 09-16 放出

- **置信**：⚠️ medium
- **细节**：9to5Mac 09-16 报道 Apple 放出 watchOS 27.2 beta 1（含改版健康 App、Siri AI 新语言、摄像头动作评估等），并指出 watchOS 27.1 可能仅含安全修复与 iPhone Duo 兼容性改动；AppleVis 09-14 汇总了 watchOS 27 的 VoiceOver 无障碍问题 hoping 27.1 修复。编导可用：用户 9 月购机恰逢 27.0→27.0.1→27.1/27.2 beta 的密集补丁窗口期。
- **来源**：https://9to5mac.com/2026/09/16/ + https://www.applevis.com（2026-09-14 至 2026-09-16）

#### F60 换货叙事素材：保留故障视频+诊断日志是申请换货/退款的关键证据

- **置信**：⚠️ medium
- **细节**：smzdm 09-21 消费指南建议：遇到随机重启应保留所有故障视频与诊断日志（手表端：设置→隐私与安全性→分析与改进→分析数据，找 panic-full 文件）作为申请换货或退款的关键证据；未激活可走 7 天无理由；已激活超期走售后流程；先升级 watchOS 27.0.1 排除软件问题，仍复发则按硬件问题换机——这条路径与用户「联系官方客服→整机换货」的实际经历一致，可直接作为视频叙事骨架。
- **来源**：https://post.smzdm.com（2026-09-21）

### 事实条目（exchange-process，16 条）

#### F61 国行 Apple Watch 换货整机为全新设备（官方政策页明文）

- **置信**：✅ high
- **细节**：《Apple 产品在中国大陆的硬件保修政策》（官方，发布 2025-08-20）：Apple Watch 和 Apple 品牌配件享 1 年保修（表带除外）；"根据具体问题，我们可能会维修或恢复设备或更换整机"，且明确"更换用的所有 Apple Watch、配件和组件都是新的"——开箱视频可放心把白盒机定性为全新备换机而非官翻机。
- **来源**：https://support.apple.com/zh-cn/122259（2025-08-20）

#### F62 换货后保修 = 原保修剩余时长或 90 天，取较长者（不重新计算一年）

- **置信**：✅ high
- **细节**：同一官方政策页原文："更换用的组件和配件享有原始 1 年保修期的剩余时长或 90 天的保障期限，以时间较长者为准"；保外（付费）维修则统一"维修和更换后的部件或配件将享有 90 天的有限保修保障"。即 2026-09 购机、2026-10 换货后新机保修按原购机日推算的剩余期（约 11 个月）延续，而非重新起算。
- **来源**：https://support.apple.com/zh-cn/122259（2025-08-20）

#### F63 中国三包规定：换货应给新商品，且换货后三包有效期重新计算

- **置信**：✅ high
- **细节**：《移动电话机商品修理更换退货责任规定》第二十条"换货时，应当提供新的商品"；第二十一条"换货后，商品三包有效期自换货之日起重新计算，由销售者在发货票背面加盖印章，注明更换日期，并提供新的三包凭证"。注意：该规定调整"移动电话机"，Apple Watch 属智能手表是否强制适用无官方定论（Apple 按自身保修条款执行，见上一条），编导引用时应区分两个口径。
- **来源**：https://scjgj.beijing.gov.cn（2022-04-11）

#### F64 Genius Bar 官方口径：维修部件可能含"使用过的正品部件"（与 122259 页"全部新的"存在表述差异）

- **置信**：✅ high
- **细节**：Apple 中国天才吧页面原文："Apple 在维修或更换服务中提供的部件，可能是新部件，也可能包含使用过的、经测试并符合 Apple 功能要求的正品 Apple 部件"。这是对"维修换部件"的一般表述；中国大陆政策页对 Apple Watch 整机更换则单独承诺全新——两处表述可在片中作为"苹果怎么保证换给你的不是翻新机"的展开点。
- **来源**：https://www.apple.com.cn/retail/geniusbar/（2026-10-10）

#### F65 换货白盒实物：素白服务纸盒、只装裸表主机，无表带、无充电线、无卡针

- **置信**：✅ high
- **细节**：Reddit r/AppleWatch 用户晒 Apple Watch Ultra 换货开箱："They took the watch without the band or any other accessories and sent it back in this box"——苹果收走裸表、寄回的白色盒子只有手表本体。与零售盒差异：无彩色外盒/表带盒/充电线/说明书套装，Apple Watch 为 eSIM 也无卡针；表带和磁吸充电器沿用原机那套。9to5Mac 2015 年即报道换货 Apple Watch 用简白白盒（带 Watch 字样），多年形态一致。
- **来源**：https://www.reddit.com/r/AppleWatch/comments/10gdcua/unboxing_my_apple_watch_ultra_replacement_from（2023-01）

#### F66 寄回旧机只收裸表：表带/配件随寄不归还（官方明文）

- **置信**：✅ high
- **细节**：Apple 官方支持文档《Prepare your Apple Watch for Express Replacement Service》（2026-03-26 更新）原文："When you pack your Apple Watch, don't include anything else in the box — like the watch band or other accessories. If you do, they won't be returned"（装盒时别放表带等任何配件，放了也不退回），并要求电池贴纸平贴不遮信息。这是白盒只含裸表的政策根因。
- **来源**：https://support.apple.com/en-us（2026-03-26）

#### F67 快速更换服务（ERS）：先寄白盒新机再退旧机，10 日退回期、原包装回寄、信用卡授权

- **置信**：⚠️ medium
- **细节**：Apple《快速更换服务条款与条件》（中文版）：Apple 先邮寄更换产品并附寄回套件；"确保 Apple 在发出更换产品之日起十(10)日内（退回期）收到该产品"，原产品须按指示放入换货产品的包装寄回，Apple 留存原机；需提供信用卡信息作担保，逾期或不符合保修条件则扣款。iPhone 版准备文档（zh-cn，2026-09-17 更新）描述同样"先收到套件（含更换设备+寄回所需一切）"流程。中国大陆对 Apple Watch 的逐项可用性与费用未见官方逐条公示。
- **来源**：https://www.apple.com/Legal/Sales%20&%20Support（2026-10-10）

#### F68 送修/换货前必须关闭激活锁：官方路径是"取消配对"，且取消配对会自动先做备份

- **置信**：✅ high
- **细节**：官方《关于 Apple Watch 上的激活锁》："在将 Apple Watch 送修、出售或赠与他人之前，你应关闭激活锁。只需取消 Apple Watch 与 iPhone 的配对"——Watch App→所有 Apple Watch→(ⓘ)→取消配对，输入 Apple 账户密码以停用激活锁。取消配对时 iPhone 会先制作包含 App 设置、表盘自定义、健康与健身数据的最新备份，再抹掉手表并从"查找"移除。iPhone 不在手边时：icloud.com/find 登录→所有设备选手表→抹掉，以移除激活锁；直接在手表上"抹掉所有内容和设置"不会移除激活锁。
- **来源**：https://support.apple.com/zh-cn（2026-10-10）

#### F69 新表数据迁移官方首选：iPhone 检测到新表后"直接从当前 Apple Watch 传输数据"

- **置信**：✅ high
- **细节**：官方《设置你的 Apple Watch》（2026-09-16 更新）：若当前 iPhone 已配对另一台 Apple Watch，配对新表时会出现"将此设为你的新 Apple Watch"屏，轻点"App 与数据""设置"后可直接从当前手表传输数据到新表（设备对设备，不必先手动备份恢复）。健康/健身数据另靠 iCloud 同步兜底：设置→[姓名]→iCloud→已存储至 iCloud→健康，确认开启同步。
- **来源**：https://support.apple.com/zh-cn（2026-09-16）

#### F70 旧表已交回时的兜底迁移：Apple Watch 备份存在 iPhone 里，取消配对那一刻自动生成

- **置信**：✅ high
- **细节**：官方《备份你的 Apple Watch》（2026-04-15 更新）：手表会自动备份到配对的 iPhone；备份含 App 设置、表盘自定义、健康和健身数据等；同步到 iCloud 的信息（如"信息"数据）不含在手表备份内。换机叙事可讲两条时间线：旧表还在→直接转移；旧表已寄走→拿取消配对时自动落下的备份恢复新表。
- **来源**：https://support.apple.com/zh-cn（2026-04-15）

#### F71 蜂窝计划迁移：中国走运营商 eSIM"一号双终端"，联通两步转移（退订→补换卡数据）

- **置信**：⚠️ medium
- **细节**：中国蜂窝 Apple Watch 的号码是三大运营商 eSIM 一号双终端副设备，不能像美版那样在 Watch App 里一键转蜂窝计划。中国联通官方换机攻略（新浪财经 2025-09-19 报道）：第一步联通 App→eSIM 专区→业务退订（一号双终端）；第二步联通 App→eSIM 专区→"补换卡数据"，按提示把原 eSIM 号码转移到新表。中国移动经"和多号"App（需先开通 VoLTE）办理一号双终端。Apple 官方入口：Watch App→蜂窝网络→设置蜂窝网络，按运营商说明操作；旧号码可先在 Watch App 蜂窝网络(ⓘ)中移除。
- **来源**：https://finance.sina.com.cn（2025-09-19）

#### F72 用户遭遇的随机重启是已证实的 Ultra 4/Series 12 通病：Neural Engine 超时触发看门狗重启，watchOS 27.0.1 修复

- **置信**：✅ high
- **细节**：IT之家 2026-09-21：发售以来 MacRumors 论坛持续出现 Ultra 4/Series 12 意外重启反馈，多名用户上传的 panic-full 内核崩溃日志显示同一故障——苹果神经网络引擎（ANE）卡死约 2 秒，固件看门狗判定异常触发内核崩溃强制重启（日志如"ANE0: ANEHWDevice::ANE 超时"），watchOS 27.0 出厂版即存在，编辑表盘/打电话/Siri 均可触发；IT之家后续报道苹果推送 watchOS 27.0.1 修复。这为"客服靠诊断日志认定故障"的换货叙事提供实证锚点（蜂窝 SIM 无法识别是否同源无权威结论）。
- **来源**：https://www.ithome.com/1/005/373.htm（2026-09-21）

#### F73 客服远程诊断机制：Apple 支持 App 可运行诊断/收集日志，手表日志需开"共享 iPhone 与 Watch 分析"

- **置信**：⚠️ medium
- **细节**：《Apple 支持 app 和隐私》（apple.com.cn 法律页）：选择用 Apple 支持 App 运行诊断时，Apple 可能收集序列号、SEID、IMEI 等设备标识符及配件标识。官方文档《Collect logs from Apple devices》：为 AppleCare 案例收集设备日志是诊断特定行为的常规步骤。手表侧开关：iPhone 设置→隐私与安全性→分析与改进→开启"共享 iPhone 与 Watch 分析"，手表分析数据同步到配对 iPhone 后可随诊断上传。
- **来源**：https://www.apple.com.cn/legal/privacy/apple-support-app/（2026-10-10）

#### F74 服务方式与周期：到店（天才吧/授权服务商）当场诊断、视库存当场换新；寄修全程约 7-15 个工作日

- **置信**：⚠️ medium
- **细节**：官方：天才吧技术人员"在店内检查你的产品，并免费进行必要的诊断测试"，随后按保修/AppleCare+ 状态给出方案；Apple Watch 集成度高，门店通常不拆修而直接换整机，能否当场拿取决于库存。寄修（Mail-In）：Apple 安排顺丰上门取件，寄前需取消配对关激活锁，可通过官网"维修状态查询"凭维修确认号跟踪；社区经验全程约 7-15 个工作日（含往返物流，非官方 SLA）。
- **来源**：https://www.apple.com.cn/retail/geniusbar/（2026-10-10）

#### F75 换货机辨识细节：序列号必不同于原机；社区惯例部件号前缀区分 M 零售/N 服务更换/F 官翻

- **置信**：❓ low
- **细节**：换货是另一台物理设备，序列号与原机不同，保修与 AppleCare+ 挂到新序列号上。论坛（MacRumors/Apple 社区）通行说法：关于页部件号 M 开头=零售机、N=服务换机（白盒）、F=官翻；但这是社区归纳、无 Apple 官方背书，且 Apple 已在中国政策页承诺换货 Apple Watch 全新——片中引用建议标注为"民间鉴别法"。
- **来源**：https://forums.macrumors.com（2026-10-10）

#### F76 官方支持文档索引（中文优先，编导备查包）

- **置信**：✅ high
- **细节**：① 中国大陆硬件保修政策 support.apple.com/zh-cn/122259（2025-08-20）；② 天才吧与支持选项 apple.com.cn/retail/geniusbar/；③ 关于 Apple Watch 上的激活锁（zh-cn，含 icloud.com/find 远程移除）；④ 设置你的 Apple Watch（2026-09-16，含旧表直接传输）；⑤ 备份你的 Apple Watch（2026-04-15）；⑥ 将 Apple Watch 与新 iPhone 配对（2026-09-16）；⑦ 在 Apple Watch 上设置蜂窝网络（zh-cn，2026-09-16 更新）；⑧ Prepare your Apple Watch for Express Replacement Service（en，2026-03-26）；⑨ 快速更换服务条款与条件（apple.com/legal）；⑩ Apple 支持 app 和隐私（apple.com.cn/legal）。③④⑤⑥⑦经搜索引用确认存在，精确文章 URL 未逐一钉死，可按标题在 support.apple.com/zh-cn 检索。
- **来源**：https://support.apple.com/zh-cn/122259（2026-10-10）

### 补录条目（2026-10-10 用户校准轮）

#### F78 苹果中国官网：产品交付之日起 14 天内可申请退货

- **置信**：✅ high
- **细节**：apple.com.cn 退货与退款政策页原文：「如需退回产品，您仅需在产品交付之日起 14 天内在您的个人账户中进行自助退货操作，或者联系我们的顾客服务团队提出退货申请。」（存档 `.context/apple-cn-returns.html`）。本片 p6-03「14 天以内」口径 = 官网购买的交付日起退换期；**角标须注「官网购买 · 交付日起」**，不得泛化为「所有渠道都能 14 天换新」，也不得断言「14 天内必然整机换新」（换新由官方客服诊断后安排，见 S6）。
- **来源**：https://www.apple.com.cn/shop/help/returns_refund（2026-10-10 抓取）
