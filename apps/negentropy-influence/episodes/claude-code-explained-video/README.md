# 《执行层：一个循环，就是全部》

> 系列「Claude Code Harness Engineering」首作（发布顺序 SSOT：[../series.json](../../series.json)；口播永不携带集数序号）。
> **改造状态（2026-09-03 运动层重制）**：全片动效收敛至 frozen 运动层（`video/src/motion/`，跨集共享「怎么动」）；HarnessStack 系列装置落地（P0 开场落板+顶边常驻条+P6 收尾）；配音全量重合成（音频版本库入库，改稿只重配变更句）。
> 选题：开源课程 [Learn Claude Code](https://learn.shareai.run/zh/s01/) 的「工具与执行」四章
> —— s01 Agent Loop / s02 Tool Use / s03 Permission / s04 Hooks。
> 形态：1080p30 横屏，代码动画图解 + 本人音色克隆旁白，无真人出镜、无 BGM。
> 制作走[公共管线](../../pipeline/README.md)九阶段；本集的可执行参数唯一来源是 [pipeline.toml](./pipeline.toml)。

## 交付状态

| 项 | 状态 |
|---|---|
| 逐字稿 | ✅ 167 句 / 3979 字 / 7 幕（原「170 句/4048 字」为勘误——narration.json 实测口径） |
| 分镜 | ✅ 39 镜，`check_script` 覆盖性 FAIL 0 |
| 信源取证 | ✅ 12 条双轨信源入清单（8 条仓库 @ 固定提交 + 4 条站点），`source_ledger verify` FAIL 0 |
| 场景实现 | ✅ 7 幕 / 39 镜，`tsc --noEmit` 通过；39 镜逐镜抽帧复检无黑帧、无重复帧 |
| 配音 | ✅ 167/167 句，`sunny-steady` + `me-bright.wav`（`.engine` 签名 `indextts\|sunny-steady\|54b699cce97f`）；纯语音 12.95 分钟（2026-09-03 全量重合成，墙钟 1.6 h——旧缓存随 worktree 遗失，本次入库**音频版本库** `~/Library/Application Support/negentropy-influence/tts-store`，跨工作区改稿只重配变更句，回收幂等已 e2e 验证）|
| 时长双口径门 | ✅ 估算 14.2 分钟（3979 字 ÷ 280）· **实测含时距 13.98 分钟**（838.8 秒 / 25164 帧；TTS 复跑漂移 -478 帧属正常 nondeterminism），均落预算窗 13.0–14.6；`check --check-scenes --check-motion` FAIL 0 WARN 0 |
| 字幕 | ✅ `out/captions.srt` + `.vtt`，各 167 cue |
| 主题对比度 | ✅ `--check-theme` FAIL 0（core 6.06 / mech 9.18 / deny 6.00 : 1，全过 4.5:1） |
| 尾幕渐黑 | ✅ 末 beat 中部 0.085 → 前 24 帧 0.056 → 末帧 0.012，窗口贴合 beat 结尾（无提前收尾的长黑屏） |
| 草渲 + 抽帧 QA | ✅ 25164 帧；七幕中点 + **beat 头部连抽**（39 镜 × 4 帧，ISSUE-170 入场瞬态补盲）+ 末 6 句全量 **FAIL 0 · WARN 0**；A/B 对拍（基线=重制前代码、同 manifest）：167 帧中仅 2 帧 >5%（p0-01/p6-08 = HarnessStack 新装置），其余 ≤1.5% 且全部归因（顶边常驻条 / SceneTag 移位右上 / 令牌化缓动 / 硬门改淡入）|
| **终渲交付** | ✅ `out/final.mp4` **13:58.80**（838.8 秒 / 25164 帧，与草渲同 manifest 同帧数）· 1920×1080 @30fps · 43.6 MB；`cover.png` = 标题卡帧 1031<br>时长**可复算**：`total_duration_in_frames(narration.json, timing.json)` = 25164 帧 @30fps = 838.8s<br>终渲全分辨率七幕抽帧 **FAIL 0 · WARN 1**（p0-09/10 帧指纹相同 = 0-D 标题卡跨两句静止，刻意）<br>**2026-08-22 画面优化版**（narration 与配音零改动，纯 tier-i 视觉增强 + `--update` 走查）：P6 三挂件卡物理咬合上环 + 信源卡增站点/双钉/实测口径诚实行；P0 走秒芯片（凝住即停）、轮次钢印 01/02/03、载荷箭头（命令/输出）；P5 环第 6 次出场 + 20–28 行实测基准带；1-D 诚实角注（站点教学版仍按停止标记）；3-C 三判定小抄（allow/ask/deny 各带载荷）；`📣`/`⚠` emoji 全部替换为绘制图形<br>**同日评审四修**（逐帧抽帧实证，见下方「评审修复」）：6-A 挂件卡文字朝向与落位、6-A 挂件卡**入场瞬态**压字幕安全带、5-B 基准带锚点与标注避让、3-C 小抄不再遮挡闸门名。末次重渲 473s，七幕抽帧复检 **FAIL 0 · WARN 1**（仍为 0-D 刻意静止） |
| 交付件 | ✅ `final.mp4` + `captions.srt` + `captions.vtt` + `cover.png`（标题卡帧，1920×1080） |
| 动效工具三轨改造 | ✅ 2026-09-04 按 [调研 §8](../../../../docs/research/video-production/160-video-motion-modeling-web-visual-tooling.md) 落地：**A** `@remotion/paths` evolvePath ×2（P3 兜底弧 / P4 回流弧，零时序改动）+ `@remotion/three` 3D 层板（P0/P6 开收尾，HarnessBadge 不变）；**C** Lottie 管线（`LottieEmphasis` + 手工占位资产 plug-pulse 替换 4-C 二帧闪，见 [public/lottie/README.md](./video/public/lottie/README.md)）；**B** HyperFrames 垂直切片 PoC 渲染打通（确定性/重定时实证，audio-first 通道待 TTS，详见 [./poc-hyperframes/FINDINGS.md](./poc-hyperframes/FINDINGS.md)）；评审面 `video/src/dev/retrofit-gallery.tsx`（`remotion still` 三帧目检过）|
| 三轨改造·全链回归 | ✅ 2026-09-05：IndexTTS（8766）启动 + `refs.py rebuild` 按 sha1 台账重建 me-bright.wav → **TTS 音频版本库 167/167 句 1.7s 回收**（零重合成，纯语音 12.95 分钟与成片一致）→ 总帧数复算 **25164 = 已交付成片**（逐帧对齐前提）；全片草渲 → 七幕 `--check` FAIL 0（唯一 WARN 为 p2-07/p2-10 16×16 均值哈希假阳性——实测差异 13.83%≈基线 13.72%，画面未冻）+ `--beat-heads` P0/P4/P6 FAIL 0 + 末 6 句 FAIL 0；**A/B 对拍**（基线=2722929e 同 manifest 硬链接）167 帧仅 **p6-08 一帧 >5%**（3D 层板所在，目检归因）其余 ≤1%；回归中修掉三处实景缺陷（badge 塌陷/Lottie 定位/3D 读色，教训入 [ISSUE-177](../../../../docs/.agents/issue.md)——A/B 低差异≠无回归，小面积严重缺陷须逐帧目检且覆盖非改动幕）|

> 音画同步的验证方式：配音期间**分幕**用已合成的真实时长重算 beat 帧位并逐镜抽帧复检
> （P0–P2 → P3 → P4 → P5/P6 四轮），共修 9 处缺陷，其中 3 处**只在真实时长下才暴露**
> ——2-G 分批动画写死帧数与口播脱钩、3-F 优先级堆叠方向与旁白相反、4-G 对撞动画
> 在四秒长句里只演了半秒。等长外推的假音频下这三处都看不出来（静帧恰好落在别的时刻）。

### 评审修复（2026-08-22，画面优化版之后）

四处都是**自动判据的盲区**。前三处是判据本身看不见的维度——`--check` 只查黑帧 /
重复帧 / 字幕安全区侵入，看不见文字朝向、几何锚点与图层遮挡；第四处更隐蔽：判据
**覆盖**字幕安全区，但每幕 ~8 帧的采样密度覆盖不到 0.33 秒的入场瞬态（[ISSUE-170](../../../../docs/.agents/issue.md)）。
所以「FAIL 0」当时并不构成这四点的证据。全部靠 `remotion still` / 终片抽帧逐帧目视
定位、修完再抽同一帧对照：

| 位置 | 症状 | 根因 | 判据 |
|---|---|---|---|
| 6-A `P6Ending.tsx` | 「闸门」卡侧倒 90°、「插口」卡上下颠倒；卡片压在环线上 | `rotate(ang)` 罩住整个 `<g>`，挂点角度变成文字角度；卡心落位半径恰等于环半径 | 卡片组 `rotate(-ang)` 反向抵消；挂脚长度由 `RING_R` 反算（`size/2 - 46`，与外框参 `R` 差 8px），挂点角改 −45/75/195 避开四个节点文案 |
| 6-A `P6Ending.tsx`（入场） | 「闸门」卡入场约 10 帧被字幕条切掉下半，落位态却干净 | 径向滑入起点写死 `px = 1.6`，起点下沿到 y≈1047；每幕 ~8 帧的抽样几乎抽不到句首这 10 帧 | 起步倍率改为逐卡反算：向下入场的卡按「下沿贴住 `SAFE_TOP_Y = 1080 - 160`」封顶（与 `qa_frames.SUBTITLE_BAND_PX` 同口径），向上的两张不受限；重渲后抽第 24666 帧对照 |
| 5-B `P5Stack.tsx` | 「20–28 行实测带」悬在 core 段上方约 60px | 带体锚在区间**上界** + `+90` 比柱底实距多 45px | 锚到下界 `yFor(20) + BAR_BASE`；标注移到带右侧（原位置撞四柱的 loop 行数） |
| 3-C `P3Gates.tsx` | 闸门名「拒绝表 / 规则匹配」被 allow/ask/deny 小抄完全盖住 | 小抄 `top: 150` 与 `GateRouter` 的 `y - h - 18`（本幕 y≈243）相交 | 小抄整体上移到 `top: 56`，收在闸柱之上 |

> 同轮还将终渲抽帧 WARN 0 修正为 **WARN 1**（0-D 标题卡跨两句静止，刻意）。这正是 ISSUE-168 的形态：
> 旧 `--scene` 单值 store 只查末幕，出来的「WARN 0」与「全幕通过」不可区分。

## 目录结构

| 路径 | 作用 |
|---|---|
| [pipeline.toml](./pipeline.toml) | ★可执行参数唯一来源（episode / narration / tts / render） |
| [research/source-notes.md](./research/source-notes.md) | ★**口播的单一事实源**，含证据三级与站点↔仓库分歧清单 |
| [research/sources.toml](./research/sources.toml) | 信源清单（URL / 固定提交 / 取数日期 / 双指纹），`source_ledger.py` 维护 |
| [script/planning.md](./script/planning.md) | 策划案六节（定位 / 叙事 / 视觉语言 / 幕结构 / 管线 / 边界） |
| [script/narration.md](./script/narration.md) | ★逐字稿 SSOT（唯一人工维护处） |
| `script/narration.json` | 派生物，`pipeline.py build` 生成，勿手改 |
| [script/storyboard.md](./script/storyboard.md) | 分镜表（镜号 ↔ 句区间 ↔ 画面 ↔ 动效） |
| `scripts/*.py` | 薄包装，转发到 [`../../pipeline/scripts/`](../../pipeline/scripts/) |
| [video/](./video/) | Remotion 独立 pnpm 工程 |
| `video/src/components/motifs.tsx` | 本集五个视觉母题（终端 / 环形循环 / 分发表 / 闸门 / 插槽） |
| `video/src/motion/` | ★frozen 运动层（令牌/窗口/编排/12 运动模型 hooks——规格见 [skills/06 运动层](../../pipeline/skills/06-remotion-implementation.md)） |
| `video/src/components/harness-stack.tsx` | 系列身份装置（P0 开场栈 / 顶边常驻条 / P6 收尾栈；层数据派生自 series.json） |
| `out/` | 渲染产物（gitignored） |

## 复现流水线

```bash
# 在仓库根执行。$I/$R/$V 的定义见 ../../pipeline/README.md 路径变量约定（唯一定义处）
P=$I/episodes/claude-code-explained-video

# ① 信源核验（repo 类固定提交硬校验；site 类只比正文，漂移报 WARN）
uv run --no-project $R/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门（分镜覆盖性 / 时长预算双口径 / 淡入不变式）
uv run --no-project $R/pipeline.py --project $P build
uv run --no-project $R/pipeline.py --project $P check --check-scenes

# ③ 配音（参数全部取自 pipeline.toml，勿在命令行另写 --style/--ref）
uv run --no-project --with soundfile --with numpy $R/refs.py rebuild --name me-bright
uv run --no-project $R/pipeline.py --project $P tts --plan   # 排期对账
uv run --no-project $R/pipeline.py --project $P tts          # 长跑，建议 nohup

# ④ 渲染与体检
cd $P/video && pnpm install --ignore-workspace && ./node_modules/.bin/tsc --noEmit
cd - && uv run --no-project $R/pipeline.py --project $P render
uv run --no-project $R/pipeline.py --project $P qa --video out/draft.mp4 --check
uv run --no-project $R/pipeline.py --project $P qa --video out/draft.mp4 --last-n 6 --check   # 尾幕渐黑必查（--video 按工程目录解析）

# ⑤ 交付
uv run --no-project $R/pipeline.py --project $P captions
uv run --no-project $R/pipeline.py --project $P render --final
```

## 音画同步机制

每句一段 MP3 → `tts.py` 把**实测时长**写进 `video/public/audio/manifest.json` →
`Root.tsx` 的 `calculateMetadata` 读 manifest 算全片时间轴 → 画面、字幕、旁白三层共读同一份
`timed[]`。**改稿只需重跑 `build → tts → render`，无需手工对轨。**
时序常数的单一事实源是 `video/src/timing.json`（`timing.ts` 与 Python 侧的 `timeline.py` 读同一文件）。

## 内容修改守则

1. **只改 `script/narration.md`** —— `narration.json` / `manifest.json` 都是派生物。
2. 改动任何一句，必须能回溯到 [research/source-notes.md](./research/source-notes.md)；
   【三级】证据（课程作者对 Claude Code 源码的分析）**必须带归属句**，不得表述为产品既成事实。
3. **不引用活数据**：课程标注的行数、总章数、star 数一律不进口播（禁用清单见事实源 §九）。
4. 英文标识符只进画面角标，不进口播（唯一例外是产品名 Claude Code）。
5. 换配音风格或参考样本 = 整集重合成，且须显式 `--allow-voice-switch`（`.engine` 签名护栏）。

## 信源与引用

- **课程正文**：Learn Claude Code，「工具与执行」s01–s04，https://learn.shareai.run/zh/s01/ ，访问日期 2026-08-21。
- **代码原文**：shareAI-lab/learn-claude-code，固定提交 `f9e8b280f715f9ba107d4517fd39bc5f8ddda618`（2026-08-18），License **MIT**。
  片中所有行数均为该提交上的**实测值**（`wc -l` 与「非空非注释」两个口径，见事实源 §五）。
- ⚠️ 课程站点标注的章节行数（102 / 135 / 180 / 232）在该提交上用任何口径都复算不出，
  应为早期提交的遗留值；本片改用实测值，且口播只说趋势不说绝对数（详见事实源 §六）。

## 许可注意

- Remotion 用于商业用途需遵守其授权条款；本工程仅用于内容创作。
- IndexTTS-2.5 按 bilibili 模型使用许可发布，商用需另行联系；克隆的是**本人**声音。
- 课程内容为 MIT 许可，引用其代码与表述已标注来源与固定提交。
- 不使用任何未经授权的第三方图片/音频素材——**站点配图一律不下载不嵌入**，
  画面全部用 Remotion 代码重建（只取信息结构，不复刻美术）。
- 发布时按平台要求标注 **AI 合成语音**。
