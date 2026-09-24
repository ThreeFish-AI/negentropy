# 《让判断变便宜：Jev 决策模型拆解》科普视频工程

> 交付状态：**v2 终渲待审（2026-09-24）**——成片 14:40.00（26400 帧 @30fps · 1080p30），归档 `~/Documents/video/agent-infra/让判断变便宜：Jev 决策模型拆解 v2.mp4`；v2 修复 v1 的双层字幕（11 处画面文字卡逐字复述口播 → 关键词锚点，防复发门见 to-video RSI-007），v1 保留对照；外挂 srt/vtt 在归档目录 `_captions/` 子目录（勿与 mp4 同名同目录，否则播放器自动叠加）；agent-infra 系列 E2；信源 14 条（本仓 200/201/jev_lab @ `5ed96405` + TypeSafe 官方文档/博客/评测站 + 官方 adapter `e1d4cc9` + kev `b8aa777` + laya `76361c8` + Hume 逆向）；逐字稿 v2（180 句 / 4129 字，双重校验清零）；41 镜七幕 · archify 13 图 35 章 35 cue。发布顺序见 [../../series.json](../../series.json)（工作区根）。

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/` | Stage ① 取证产物：全部口播断言须可回溯至此 |
| `script/planning.md` | Stage ② 策划案（六节齐，含本集视觉契约） |
| `script/narration.md` | Stage ③ 逐字稿 **★单一事实源**（勿改 narration.json） |
| `script/storyboard.md` | Stage ⑤ 分镜表（镜号 ↔ 句 id 区间 ↔ 画面 ↔ 动效） |
| `scripts/*.py` | 薄包装 → to-video skill 的 pipeline/scripts/（解析器定位，保 CLI 契约） |
| `video/` | Remotion 独立 pnpm 工程（嵌套 workspace 自锚隔离） |
| `out/` | 渲染产物（gitignored） |
| `pipeline.toml` | 本集可执行参数的唯一来源（字段表见 [to-video skill 的 pipeline/README.md](https://github.com/ThreeFish-AI/to-video/blob/main/pipeline/README.md)） |

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P 的定义见 to-video skill 的 pipeline/README.md 路径变量约定（唯一定义处）
P=$W/episodes/jev-decision-model-video

# ① 信源核验（B 型信源）
uv run --no-project $T/pipeline/scripts/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门（分镜覆盖性 / 时长预算双口径 / 淡入不变式）
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P build
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P check --check-scenes

# ②½ archify 逐章录制 + lead 实测 + manifest（换 worktree 必须重录）
uv run --with playwright $T/pipeline/scripts/record_archify_all.py --project $P
uv run --no-project --with pillow $T/pipeline/scripts/archify_lead.py --project $P   # 必跑：录制器恒写 lead_sec=0
uv run --no-project $T/pipeline/scripts/archify_manifest.py --project $P

# ③ 配音（参数全部取自 pipeline.toml，勿在命令行另写 --style/--ref）
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P tts --plan   # 排期对账
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P tts          # 长跑，建议自愈续跑循环

# ④ 渲染与体检（工具一律 ./node_modules/.bin/ 直调，防污染根 workspace）
cd $P/video && pnpm install && ./node_modules/.bin/tsc --noEmit
cd - && uv run --no-project $T/pipeline/scripts/pipeline.py --project $P render
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P qa --video out/draft.mp4 --check
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P qa --video out/draft.mp4 --last-n 6 --check   # 尾幕渐黑必查

# ⑤ 交付
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P captions
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P render --final
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P deliver --root ~/Documents/video/
```

## 本集特有纪律（口径速查）

1. **证据四级**：【一】钉点代码/原型实测 · 【二】官方文档 · 【三】厂商自报（必带归属）· 【四】第三方（必带归属与限定）。倍数并列义务：193.6×/444.6× 必与 75×/171×、1.2× 同句组并列。
2. **机制形状归属**：一次编码/分支隔离/MoE 是「逆向 + 开源复刻」的假设，非官方披露。
3. **类比失配边界**：分拣中心剧场三条（跨小票统一思考 / 手指点格口≠稳定自知 / 对账≠训练）。
4. 201 映射不进正片；活数据（社区规模/star）不进口播；「中文未证明」须带「官方自认 + 第三方全英文」双口径。
