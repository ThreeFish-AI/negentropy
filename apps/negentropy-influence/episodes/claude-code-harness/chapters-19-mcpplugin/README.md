# 《MCP 与插件：发现、命名、组装》科普视频工程

> 交付状态：**已交付 v2**（v2 2026-11-08 配音提速 1.25× + 片头空白压缩重渲；v1 2026-11-02 制作轮收官：⑥ 20 镜零建图 G1 修名单事实 1R+4W → ⑦ me-bright/story 克隆声 54 句 4.9 分 → ⑧ 前缀挂牌/归一网格/统一池/旧池消融装置族+片头孪生（组五 groupOf(19)=5）→ ⑨ 零修复三路 0R0W → ⑩ 终渲 294.6s=4 分 54.6 秒落窗，`~/Documents/video/claude-code-chapters/MCP 与插件：发现、命名、组装 v1.mp4`）

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

- **翻钉 main `7226f555`**（站点轨 s19 判据无法支撑本集叙事，开工复核翻钉，对比证据全表见 gl-notes 附录 B.1）：main 轨 s14_mcp_plugin 有三节机制级正源增量——§6「权限由宿主配置决定」（`MCP_HOST_POLICY` 4 条宿主策略表，注释原话「Authorization comes from host configuration, never server descriptions.」）、§4 规范化撞名直接报错 + 全名超 64 字符拒收（教学版口径）、§7「工具输入错误留在工具边界内」；175 §8 收束原则「外部服务的自我描述不能当授权依据」的唯一教学载体在 main 轨。
- **站点轨 `67a9126c` 降为对照件**：s19 独有「深入 CC 源码」八小节附录（6 种 transport / 配置优先级 / OAuth / 错误分类重连等，恒【三】级）与「无缓存」叙事（E5 实验锚）经台账 `s19f-*` 补登。
- **实验 E5 本集复算【一】级**（2026-10-31 selftest 18 断言全绿）：连接文档服务后不重建工具池 → `Unknown tool: mcp__docs__search`，重建后正常返回——「池是动态的，依赖它的缓存必须随它失效」。
- **官方双页补读**：`doc-mcp`（命名归一 / 权限按全名书写 / `.mcp.json` 项目批准；128 字符阈值与教学 64 分歧登记 B.1，口播引 64 恒钉教学版口径）+ `doc-mcp-io`（开放标准定位；2026-10-31 收口复核同日变更、语义一致钉新态，见 B.1 WARN 处置行）。
- **台账口径注意**：本集翻钉后目录名跨轨不共用（章节表 id=s19_mcp_plugin 为站点轨目录、main 轨目录为 s14_mcp_plugin），`sync` 按章节表拼 URL 会 404 报 FAIL 2——地图 SSOT 已登记为机制表达力缺口，`s19-readme/-code` 按 main 真实路径手工登记（指纹可 verify、audit 三断言全过），**跑 sync 跳过本集、以 audit + verify 为准**。
- 双钉唯一登记处：[source-map/claude-code-chapters.md](../../../source-map/claude-code-chapters.md)。

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P/$V 的定义见 vibe-video skill 的 references/PIPELINE.md 路径变量约定（唯一定义处）
P=$W/episodes/claude-code-harness/chapters-19-mcpplugin

# ① 信源核验（sync 对本集结构性 FAIL 2，见上「台账口径注意」；以 audit + verify 为准）
uv run --no-project $T/scripts/source_ledger.py --project $P verify
uv run --no-project $T/scripts/source_ledger.py --project $P audit --map $W/source-map/claude-code-chapters.toml --episode 19

# ② 逐字稿派生 + 内容门
uv run --no-project $T/scripts/pipeline.py --project $P build
uv run --no-project $T/scripts/pipeline.py --project $P check --check-scenes

# ③ 配音（参数全部取自 pipeline.toml）
uv run --no-project $T/scripts/pipeline.py --project $P tts --plan
uv run --no-project $T/scripts/pipeline.py --project $P tts          # 长跑，建议 nohup
# 配音提速 1.25×（速率 SSOT=video/src/timing.json narrationTempo；源取 tts-store raw，幂等；tts 复跑/恢复后须重跑）
uv run --no-project $W/scripts/tempo_audio.py --project $P
uv run --no-project $W/scripts/tempo_audio.py --project $P --check   # 渲染前门

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
- 配音速率只在同一文件的 `narrationTempo`（仅 `scripts/tempo_audio.py` 读取，timing.ts/timeline.py 忽略）；`tts` 复跑或恢复会带回 1.0× raw，须重跑该脚本，`--check` 为渲染前门。
- **口播永不出现他集标题与集数序号**——顺序只在视觉层与 series.json（`check_series.py` 执法）。
- 观众层信源标识只许首尾既定署源位（豁免登记工作区 `vibe-video.toml [check_series.source_credit]`，RSI I-080；本集条目随系列层批次登记）。
- 骨架冻结档位见 [vibe-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/vibe-video/blob/main/assets/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/scripts/verify_skeleton.py`。

## 许可

源课程 [Learn Claude Code](https://github.com/shareAI-lab/learn-claude-code)（MIT）版权归原作者；本工程为解读与再创作，画面与口播为原创，成片首尾部署源说明（系列 2026-10-29 审批定制）。
