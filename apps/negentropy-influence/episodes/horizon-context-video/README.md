# 拆解 Horizon Context：Context 怎么治理，结果怎么验证（完全重制版）

Context Layer 系列第 1 集。Snowflake Horizon Context（受治理上下文层）的精读拆解：七个承重机制
（语义视图双不变量 / 行列级策略 / 语义级治理 / 验证锚定 VQR / 列级血缘 / Agent Identity / 分类纳管）
逐件「讲机制 + 走查 + 拆掉一次」——零跨域剧场，gen2 白话直讲教学法（C 型信源直通承接）。

> **交付状态 v2 终渲待审**（2026-10-02，评审 H 轮）：15:05.90 = 27177 帧 @30fps · 1920×1080（ffprobe 视频流 27177 帧与帧复算一致）· 97.1MB；
> 归档 `~/Documents/video/context-layer/拆解 Horizon Context：Context 怎么治理，结果怎么验证 v2.mp4` + `v2_captions/`（v1 存档保留）。

## 结构

- **八幕 156 句**（实测全片 15:05.90，首轮校准窗 [14.0, 16.3]；story 块合成实测 302 字/分含时距）：P0 三个症状一个病根 →
  P1 七机制地图 → P2 口径与现算（M1）→ P3 规则与执法（M2+M3）→ P4 背书与血缘（M4+M5）→
  P5 身份与纳管（M6+M7）→ P6 供给与生态 → P7 规律与边界
- **story 段落演绎配音**：me-bright 声音克隆 + `script/narration.cues.toml` 导演台本（71 块情绪标记 · TTS 合成 78 块 + 7 句表演标点）
- **视觉母题**：「同一份定义单」金描边定义卡全片同形〔M-001〕——P0 空卡座缺席 → P2 注册 →
  P3 挂策略扣件 → P4 签名盖章 → P7 满屏回照；色彩契约 金=口径 / 紫=治理 / 青=验证
- **archify 图例**：47 图 104 章逐章录制 106 cue 全屏独占回放，句级锚定 67.9% · 7.0 cue/分 · 5 图型；
  红绿消融同屏演尽破坏实验（左崩溃右拦截，⑨ 视觉抽查修复 2-I 整镜遮盖一例），证据徽三级

## 信源（C 型 · guided-learn gen2 直通承接）

- 冻结快照 `research/gl-notes.md` = 011 精读笔记 gen2 @192ae6ca9（011 本体 548 行，全文含冻结头与附录 616 行；2026-09-30 信源实况）
- 原型双 selftest 复算 2026-10-01 与基线逐字节一致（升【一】级证据）：`research/selftest-*-2026-10-01.txt`
- 穿透抽查 126 条断言零 MISS：`research/penetration-report.md` + `penetration-claims.json`
- 信源台账 71 条（3 repo 钉 192ae6ca9 + 68 site）：`research/sources.toml` · verify FAIL 0
- 勘误登记：011 §7「200:3」系官方例与 lab 实测混编，本集口播采用 lab 实测 200:5（gl-notes 附录 B；011 章号已于 2026-10-09 重排，登记时点为旧号 §19）

## 目录

```
research/     gl-notes 冻结快照 · sources.toml 台账 · 穿透报告 · selftest 复算 · GL 台账冻结归档
script/       planning（六节）· narration v2（156 句）· cues.toml（story 台本）· storyboard v3（66 镜）· verification（④⑤ 报告）
scripts/      build_narration / tts / qa_frames 薄包装（转发 vibe-video skill）
video/        Remotion 工程：scenes 八幕 · components 装置层 13 件+archify 消费端 · motion（frozen）
              public/archify/ 47 图 sidecar+views（mp4/end.png 派生物 gitignored）
out/          渲染产物（gitignored）
```

## 复现流水线

```bash
# 全链（vibe-video skill · 十阶段）
uv run --no-project $T/scripts/pipeline.py --project apps/negentropy-influence/episodes/horizon-context-video \
  build && check            # ③④ 内容层（覆盖门自动串联）
uv run --no-project --with playwright $T/scripts/record_archify_all.py --project <P>   # ⑥' 逐章录制
uv run --no-project --with pillow $T/scripts/archify_lead.py --project <P>            # lead 白闪实测
uv run --no-project $T/scripts/archify_manifest.py --project <P>                      # manifest 真值
uv run --no-project --with mutagen $T/scripts/tts_resume.py -- --engine indextts --project <P> \
  --ref <W>/voices/me-bright.wav --expect-ref-sha1 54b699cce97f                       # ⑦ 长跑自愈
uv run --no-project $T/scripts/pipeline.py --project <P> render && qa --video out/draft.mp4 --check  # ⑨
uv run --no-project $T/scripts/pipeline.py --project <P> render --final && captions && deliver      # ⑩
```

## 机器门（收口回填）

- [x] 清场双门 verify_skeleton/check_series FAIL 0 · 信源台账 verify 71 条 FAIL 0
- [x] selftest 复算 diff 双零 · 穿透 126 条 MISS 0
- [x] build/④ RISKY=0/⑤ 评审 REWRITE=0 · --pre-tts FAIL 0 WARN 0 · 多音字语义未标注 0
- [x] tsc 零错 · archify 覆盖门 106 cue/67.9%/5 型 FAIL 0（WARN 15=叙事性章序重组 14 + 镜锚 1；该 1 为 7-B vendor-claim 同章跨镜接力声明，覆盖门 hit-first 语义的已知盲区——P7Laws 两条真实 cue 各自锚 p7-02/p7-03 已核验，渲染无误）
- [x] ⑦ manifest 156 句全成 · 首轮校准回写 302 字/分 + 窗 [14.0, 16.3]（story 块合成消除块内停顿）
- [x] ⑨ qa --check 五项 FAIL 0 WARN 0 · 八幕逐 scene FAIL 0 · beat-heads 91 帧 · 四帧视觉抽查（修复 2-I）
- [x] ⑩ 终渲 15:05.90 落窗（ffprobe 视频流 27177 帧与帧复算双口径一致）· captions srt/vtt · deliver v2 + 字幕随片归档
- [x] H 轮（2026-10-02）：p2-21/22 口播对齐画面实例数字后 `[block.p2-20]` 重录（27169→27177 帧）；换场交界逐帧亮度
  实测（句界 −2..+4 连续帧中区 max 单调无断层，P2×4/P4×3/3-G 全覆盖）；终渲修复句 qa --check 11 句 FAIL 0 WARN 0

## 重制差异（vs v6.1 旧版）

| 维 | 旧版 v6.1 | 本版 |
|---|---|---|
| 信源 | 旧 011（797 行·类比剧场） | 011 gen2 冻结 @192ae6ca9（548 行·白话直讲）+ 穿透复算 |
| 叙事 | 七幕类比剧场（天才实习生/大厦） | 八幕零剧场，机制四拍（术语→机制→走查→拆掉） |
| 配音 | sunny-steady 稳态 | story 段落演绎（71 块情绪标记 · 合成 78 块，302 字/分实测） |
| 数字 | 200:3（承笔记混编） | 200:5（lab 实测口径 + 勘误登记） |
| 图例 | 67 图 156 cue 83.4% | 47 图 106 cue 67.9%（剧场词图 10+ 张退役） |
| ⑧ 装置 | devices.tsx 剧场母图 | 装置层 13 件（定义卡母题/红绿消融/基线标尺…） |

## C 型首例偏差记录（vibe-video 01 §C）

1. **链接落位平移**：gl-notes 冻结正文 51 处相对链接按新落位机械改写指回仓内目标（内容零变更）。
2. **archify 3.0 代际差**：当前 archify viewer 已移除 guided-views 模块——five-laws 新图无法被录制器
   消费（canonical 容器注入亦不奏效，模块而非数据缺失），视频侧改原生实现；该图转为 docs 研究资产。
   15 张既有 3.0 代扩产图以空容器注入通过录制预检（数据面补齐即可消费）。注入使 five-laws.html
   较交付时 +1024B，delivery/browser-check 双回执 artifact 指纹已重同步至入库实物（2026-10-02 评审修复）。
