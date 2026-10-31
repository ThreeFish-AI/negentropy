# 《Skill Loading：目录常驻，全文按需》科普视频工程

> 交付状态：**文案轮完成、待用户审批**（2026-10-31）——系列《Claude Code 的 20 个核心机制》（claude-code-chapters，20 章 1:1 拆集）第 7 集（s07_skill_loading 单章）；Stage ①–⑤ 已完成（开工复核维持站点轨钉 + C 型冻结现行 172 整改代次 + 策划 + 逐字稿 54 句 1364 字 + 三路双重校验 + 成文优化四层 pass），机器门 build / pre-tts / ledger sync·audit·verify 全绿（正文 est ≈5.4 分在窗 [4.4,5.6]，超幕预算 59 字〔+20 界超 39〕、est+片头 23.5s ≈5.8 分超含片头窗上沿约 0.2 分——压窗删句或放行随审批裁决）；**审批通过后进入制作**（⑥分镜/建图 → ⑦TTS → ⑧场景 → ⑨QA → ⑩交付）。标题随审批落定（候选见 planning.md §0）。发布顺序见 [../../../series.json](series.json)（工作区根）。

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/` | Stage ① 取证产物：全部口播断言须可回溯至此（gl-notes.md = C 型冻结件；source-archive/ = 双轨字节归档） |
| `script/planning.md` | Stage ② 策划案（六节齐，含本集视觉契约） |
| `script/narration.md` | Stage ③ 逐字稿 **★单一事实源**（勿改 narration.json） |
| `scripts/*.py` | 薄包装 → vibe-video skill 的 scripts/（解析器定位，保 CLI 契约） |
| `video/` | Remotion 独立 pnpm 工程（嵌套 workspace 自锚隔离） |
| `out/` | 渲染产物（gitignored） |
| `pipeline.toml` | 本集可执行参数的唯一来源（字段表见 [vibe-video skill 的 references/PIPELINE.md](https://github.com/ThreeFish-AI/vibe-video/blob/main/references/PIPELINE.md)） |

## 信源与钉选（本集要点）

- **维持钉站点轨 `67a9126c`**（开工复核不翻，与 ep2 翻钉 main 互为镜像——本集正源在站点轨）：全部叙事数字锚（三摞文档 2000/1500/3000 行、6500 行开场白 99% 无关、两层设计表 ~100/~2000、s08 衔接金句）与「深入 CC 源码」附录四节【三】级正源只在站点轨 README 在场；main 前移 13 提交后 README.zh.md 逐字节一致、code.py 仅空输入守卫 2 行，对 s07 无叙事增量。
- **main `7226f555` 降为对照轨**：SkillLoader 类封装与 OS-aware 环境段经台账 `s07m-*` 补登，引用须带轨道限定（本集叙事不依赖）；站点页 2026-10-31 fetch 零漂移。
- **实验 3 本集复算【一】级**（2026-10-31 selftest）：技能全文全量拼进开场白 → 三轮总输入 3059→25323（多 22264、8.3 倍，随轮数放大）；episode C 基线 system 281 / 三轮 323→352→2384。
- **官方文档页 `doc-skills` 较旧系列基线漂移**（文档站构建产物常态轮替）：语义面复核成立（正文按需加载 + 1,536 截断两断言逐字在场），1536 按「默认上限」口径口播（现页载明可经 skillListingMaxDescChars 配置）。
- 双钉唯一登记处：[source-map/claude-code-chapters.md](source-map/claude-code-chapters.md)。

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P/$V 的定义见 vibe-video skill 的 references/PIPELINE.md 路径变量约定（唯一定义处）
P=$W/episodes/claude-code-harness/chapters-07-skillloading

# ① 信源核验
uv run --no-project $T/scripts/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门
uv run --no-project $T/scripts/pipeline.py --project $P build
uv run --no-project $T/scripts/pipeline.py --project $P check --check-scenes

# ③ 配音（参数全部取自 pipeline.toml）
uv run --no-project $T/scripts/pipeline.py --project $P tts --plan
uv run --no-project $T/scripts/pipeline.py --project $P tts          # 长跑，建议 nohup

# ④ 渲染与体检（工具一律 ./node_modules/.bin/ 直调，防污染根 workspace）
cd $P/video && pnpm install && ./node_modules/.bin/tsc --noEmit
cd - && uv run --no-project $T/scripts/pipeline.py --project $P render
uv run --no-project $T/scripts/pipeline.py --project $P qa --video out/draft.mp4 --check
uv run --no-project $T/scripts/pipeline.py --project $P qa --video out/draft.mp4 --last-n 6 --check   # 尾幕渐黑必查（--video 按工程目录解析）

# ⑤ 交付
uv run --no-project $T/scripts/pipeline.py --project $P captions
uv run --no-project $T/scripts/pipeline.py --project $P render --final
uv run --no-project $T/scripts/pipeline.py --project $P deliver
```

## 内容修改守则

- 逐字稿只改 `script/narration.md`；`narration.json` / `manifest.json` 是派生物。
- 时序常数只在 `video/src/timing.json`（timing.ts 与 Python 侧 timeline.py 共读）。
- **口播永不出现他集标题与集数序号**——顺序只在视觉层与 series.json（`check_series.py` 执法）。
- 观众层信源标识只许首尾既定署源位（豁免登记工作区 `vibe-video.toml [check_series.source_credit]`，RSI I-080）。
- 骨架冻结档位见 [vibe-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/vibe-video/blob/main/assets/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/scripts/verify_skeleton.py`。

## 许可

源课程 [Learn Claude Code](https://github.com/shareAI-lab/learn-claude-code)（MIT）版权归原作者；本工程为解读与再创作，画面与口播为原创，成片首尾部署源说明（系列 2026-10-29 审批定制）。
