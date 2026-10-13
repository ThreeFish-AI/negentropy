# 《工具与执行：一个循环，三层装置》科普视频工程

> 剧本 v3 待审（2026-10-07）：planning/narration/storyboard 已换代（C 型信源=171 新精读），场景/TTS/图集未动。
> 交付状态：**v1 已交付**（2026-09-30，14:02.6 @1080p30（total_duration_in_frames 复算），归档 ~/Documents/video/claude-code-explained/ v1 + _captions）。发布顺序见 [../../series.json](../../series.json)（工作区根）。

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/` | Stage ① 取证产物：全部口播断言须可回溯至此 |
| `script/planning.md` | Stage ② 策划案（六节齐，含本集视觉契约） |
| `script/narration.md` | Stage ③ 逐字稿 **★单一事实源**（勿改 narration.json） |
| `script/storyboard.md` | Stage ⑥ 分镜表（镜号 ↔ 句 id 区间 ↔ 画面 ↔ 动效） |
| `scripts/*.py` | 薄包装 → vibe-video skill 的 scripts/（解析器定位，保 CLI 契约） |
| `video/` | Remotion 独立 pnpm 工程（嵌套 workspace 自锚隔离） |
| `out/` | 渲染产物（gitignored） |
| `pipeline.toml` | 本集可执行参数的唯一来源（字段表见 [vibe-video skill 的 references/PIPELINE.md](https://github.com/ThreeFish-AI/vibe-video/blob/main/references/PIPELINE.md)） |

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P/$V 的定义见 vibe-video skill 的 references/PIPELINE.md 路径变量约定（唯一定义处）
P=$W/episodes/claude-code-explained-video

# ① 信源核验（B 型信源；A 型论文集跳过）
uv run --no-project $T/scripts/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门（分镜覆盖性 / 时长预算双口径 / 淡入不变式）
uv run --no-project $T/scripts/pipeline.py --project $P build
uv run --no-project $T/scripts/pipeline.py --project $P check --check-scenes

# ③ 配音（参数全部取自 pipeline.toml，勿在命令行另写 --style/--ref）
uv run --no-project $T/scripts/pipeline.py --project $P tts --plan   # 排期对账
uv run --no-project $T/scripts/pipeline.py --project $P tts          # 长跑，建议 nohup

# ④ 渲染与体检（工具一律 ./node_modules/.bin/ 直调，防污染根 workspace）
cd $P/video && pnpm install && ./node_modules/.bin/tsc --noEmit
cd - && uv run --no-project $T/scripts/pipeline.py --project $P render
uv run --no-project $T/scripts/pipeline.py --project $P qa --video out/draft.mp4 --check
uv run --no-project $T/scripts/pipeline.py --project $P qa --video out/draft.mp4 --last-n 6 --check   # 尾幕渐黑必查（--video 按工程目录解析）

# ⑤ 交付
uv run --no-project $T/scripts/pipeline.py --project $P captions
uv run --no-project $T/scripts/pipeline.py --project $P render --final
# 交付归档（可选；根 = --root 一次性 或 env VIBE_VIDEO_DELIVER_ROOT 持久，机器属性不进 toml）
uv run --no-project $T/scripts/pipeline.py --project $P deliver
```

## 内容修改守则

- 逐字稿只改 `script/narration.md`；`narration.json` / `manifest.json` 是派生物。
- 时序常数只在 `video/src/timing.json`（timing.ts 与 Python 侧 timeline.py 共读）。
- **口播永不出现他集标题与集数序号**——顺序只在视觉层与 series.json（`check_series.py` 执法）。
- 骨架冻结档位见 [vibe-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/vibe-video/blob/main/assets/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/scripts/verify_skeleton.py`。

## 建图轮（Stage ⑥/⑧）archify 对账清单（2026-10-09 登记）

> archify 承接方式 = repo 级 `docs/assets/architecture/agent-harness/` SSOT 链接直取（.mmd 图源 / 交互 HTML / dark·light PNG），**不设 `archify-html/` 实体拷贝**——skill 契约条文与系列实践的该分叉已在 skill 仓 RSI 台账登记。建图轮启动前逐项对账：

1. **图集取舍**：v3 storyboard 图集表为 6 个 `tooling-*` 新 slug（本轮「图未建」）；`video/public/archify/views/` 现存 12 个上一代（#1179）旧 slug——按 v3 表决定清理或复用，取舍结论写回 storyboard 图集表。
2. **html_overrides 对齐**：`pipeline.toml [archify.html_overrides]` 注释仍指上一代分镜条目 #11/#12（v3 分镜无此条目号）——映射改指 v3 条目，或删除并在注释中对齐 v3 图集表口径。
3. **GL 全景承接**：冻结件所载全景 `lcc-tooling--panorama.html` 系 GL 换代产物、无 guided-views 数据**不可直录**；`views/` 中可录旧图 `claude-code-tooling--execution-panorama.html` 与冻结全景**非同一张图**。路线二选一：按 storyboard 既定「以 GL notes 为底稿新建 tooling-panorama」，或按 ep5 已验证范式注入 guidedViews 兼容层（RSI-038）。

## 进⑦（TTS）鲜度门（2026-10-09 登记）

> 冻结口径「截至 2026-10-07」随审校期推进须复核；录音后改口播成本剧增（ISSUE-162 前科）。**⑥→⑦ 之间必跑**：

1. `doc-hooks`：hook 不变式句「Deny and ask rules are still evaluated regardless of what the hook returns」在场；事件计数与口播口径对账——2026-10-09 抽验：事件清单已明显超过 33 个快照口径（InstructionsLoaded / UserPromptExpansion / MessageDisplay / PostToolUseFailure / PermissionRequest 等新增），「三十三个」趋势化（「三十多个」）待②审校拍板。
2. `doc-permissions`：「Permission rules are enforced by Claude Code, not by the model」句在场（2026-10-09 微调形态，原「not the model」）；六种权限模式齐。
3. `doc-tool-use-overview`：`stop_reason: tool_use` 与 `tool_result` 配对语义未变。
4. 方法：`uv run --no-project $T/scripts/source_ledger.py --project $P verify`——任一 doc-* WARN 即抓 `research/source-archive/doc-snapshots-<日期>/` 快照做定点比对，结论与日期回填 gl-notes.md 附录 C.1。

## 许可

源论文/文档版权归原作者；本工程仅为解读与再创作，画面与口播为原创。
