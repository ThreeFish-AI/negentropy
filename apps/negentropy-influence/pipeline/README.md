# 科普视频制作 Pipeline（公共基建）

> 从「论文精读 → 逐字稿 → 配音 → 代码动画 → 终渲」全链路中沉淀的**仓库级可复用流水线**。
> 首个建成的完整范例：[《AI 如何自己变强？》](../episodes/self-improving-agents-video/README.md)（建成时间上的第一个，非系列首集；发布顺序见 [../series.json](../series.json)）。

## 一、Pipeline 总览（9 Stages）

```mermaid
flowchart LR
    subgraph S["内容层（文档驱动）"]
        A[① 论文精读提取<br/>并行子代理<br/>含官方站点信源补充] --> B[② 策划案<br/>受众/结构/视觉契约]
        B --> C[③ 逐字稿 narration.md<br/>★单一事实源]
        C --> D[④ 双重校验<br/>真实性回溯+易懂性]
        D --> E[⑤ 分镜表 storyboard.md]
    end
    subgraph P["生产层（工具驱动）"]
        C --> F[⑥ TTS 合成<br/>逐句 mp3+manifest]
        E --> G[⑦ Remotion 场景实现]
        F --> G
        G --> H[⑧ 草渲+抽帧 QA<br/>迭代修正]
        H --> I[⑨ 终渲 1080p30]
    end
    style C fill:#1a3a5c,stroke:#4A9EFF,color:#fff
    style F fill:#5c3a1a,stroke:#FF9F45,color:#fff
    style I fill:#2d5c1a,stroke:#7ED321,color:#fff
```

每个 Stage 的代理提示词规格见 [skills/](./skills/)，可直接作为子代理 prompt 或未来挂载为 `.claude/skills/` 的底稿。

**九阶段的声明源是 [stages.toml](./stages.toml)**（上图与下表都是它的人读视图）。执行 `uv run --no-project $R/pipeline.py stages` 打印全表。此前「有哪九个阶段」同时声明在四处（skills 散文标题 / `pipeline.py` 子命令 / 上面的 mermaid / [.agent 路由壳](../../../.agent/skills/science-video-pipeline/SKILL.md)），四份可各自漂移且**已经漂移**——⚠️ **序号与文件号刻意不对齐**：Stage ⑥ 是 `07-tts-voice.md`、Stage ⑦ 是 `06-remotion-implementation.md`（入链 ≥5 处，重命名代价大于收益）。该错位现由 [tests/test_stages.py](./tests/test_stages.py) 连同 skill H1、子命令注册表、路由壳覆盖面一起执法。

## 路径变量约定

本文档、[skills/](./skills/) 与各分集 README 中的**命令**统一用下面四个变量书写，使命令与子项目位置解耦（下次搬迁零改动）；**散文里的链接保持真实相对路径**（`check_series.py` 规则 5 正在执法它们的存活，变量化会造出死链）：

```bash
I=apps/negentropy-influence          # 子项目根 —— 全仓唯一一处位置字面量
R=$I/pipeline/scripts                # 公共脚本目录
P=$I/episodes/<slug>-video           # 目标分集工程（各集 README 里换成本集 slug）
V=$I/pipeline/voices                 # 声音样本目录（整目录 gitignored）
```

**四者同锚于仓库根**，故可自由同现在一条命令里。⚠️ 反面教训：`pipeline.toml` 的
`tts.ref` 与 `series.json` 的 `path` 是**子项目根相对**（由 `paths.INFLUENCE` 拼接），
把那套写法搬进命令行会造出 `$R/tts_sample.py --ref pipeline/voices/x.wav` 这类
**在任何 CWD 下都不成立**的混锚命令——命令行里的样本路径一律走 `$V`。
该纪律由 [tests/test_docs_paths.py](./tests/test_docs_paths.py) 执法。

## 二、工程目录约定

每集视频一个 `$P/` 工程：

```
$P/
├── README.md               # 本集说明（目录表/复现流水线/视觉契约/许可）
├── research/paper-notes.md # 事实源：全部口播断言须可回溯至此
├── script/
│   ├── planning.md         # 策划案
│   ├── narration.md        # 逐字稿（唯一维护处，勿改 narration.json）
│   ├── narration.json      # 派生物（build_narration.py 生成）
│   └── storyboard.md       # 分镜表（镜号↔句 id 区间↔画面↔动效）
├── scripts/*.py            # 薄包装 → ../../pipeline/scripts/（保 CLI 契约）
├── video/                  # Remotion 独立 pnpm 工程（--ignore-workspace 隔离）
└── out/                    # 渲染产物（gitignored）
```

**格式契约**（`build_narration.py` 的解析规则）：
- narration.md：`## P0 标题` 分幕 + `- [p0-01] 文本` 一句一行；句 id 必须以幕名小写为前缀、全片唯一。
- `>` 引用块为画面备注，不进配音；英文方法名做角标不口播。

## 三、公共脚本（单一事实源）与编排入口

**单入口 `pipeline.py`**（参数读各集 `pipeline.toml`；阶段契约见下表）：

```
uv run --no-project $R/pipeline.py --project $P     {status|doctor|build|check|tts|captions|render|qa|all|clean-samples}
```

| Stage | 命令 | 输入 → 产出 | 幂等/续跑 |
|---|---|---|---|
| ③ | `build` | narration.md → narration.json | 纯函数 |
| ④⑤ | `check` | narration.json + storyboard.md + pipeline.toml → 门 | — |
| ⑥ | `tts [--plan]` | narration.json + 参考样本 → 逐句 mp3 + manifest | sidecar 摘要 / 逐句续跑 |
| ⑥+ | `captions` | manifest + timing.json → out/captions.{srt,vtt} | 纯函数 |
| ⑧ | `render` + `qa` | src + audio → draft.mp4 + 抽帧体检 | 渲染否 / 抽帧是 |
| ⑨ | `render --final` | 同上 → final.mp4（前置：⑧ 零 FAIL） | 否 |

`status` 为派生式新鲜度表（无状态文件——幂等已由内容摘要提供，再存阶段状态即第二事实源）；`doctor` 自检配置/时序 SSOT/样本指纹/IndexTTS 服务。

| 脚本                                                       | 用途                                                                                                                    | 工程内等价调用                                                                                                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [scripts/build_narration.py](./scripts/build_narration.py) | narration.md → narration.json + 时长估算                                                                                | `uv run --no-project scripts/build_narration.py`                                                                                                 |
| [scripts/tts.py](./scripts/tts.py)                         | 逐句配音合成 + 时长 manifest（幂等，双引擎：edge 预置音色 / indextts 声音克隆；风格推荐位 sunny 明快阳光，`--steady` 混合档让关键句单独升束宽，`--plan` 预演排期） | `uv run --no-project --with edge-tts --with mutagen scripts/tts.py`（克隆模式免 edge-tts，见 [VOICE-CLONING.md](./VOICE-CLONING.md)）            |
| [scripts/tts_server.py](./scripts/tts_server.py)           | IndexTTS 推理服务（声音克隆后端，**运行于 index-tts 环境**，非本仓）                                                    | 在 `~/tools/index-tts` 内启动，见 [VOICE-CLONING.md §二](./VOICE-CLONING.md)                                                                     |
| [scripts/tts_sample.py](./scripts/tts_sample.py)           | 单句声音小样试听（直调 IndexTTS 服务合成一句话 + 全风格 A/B，定稿风格前的必经关口）                                      | 无工程薄包装，从仓库根调用：`uv run --no-project --with mutagen $R/tts_sample.py --ref <样本.wav> --all-styles --play`，见 [VOICE-CLONING.md §5.1](./VOICE-CLONING.md) |
| [scripts/prepare_ref.py](./scripts/prepare_ref.py)         | 参考音色样本裁剪/规范化（长录音 → **10–14s** 干净 WAV；硬上限 15s——上游超出即静默前截）                                                                      | 无工程薄包装（与具体工程无关），从仓库根调用：`uv run --no-project --with soundfile --with numpy $R/prepare_ref.py <源音频>` |
| [scripts/prospect_ref.py](./scripts/prospect_ref.py)       | 参考样本选段勘探（按 F0/起伏/音节率/限带质心筛「更亮更轻快」的候选起点）+ `--accept` **保真度验收**（削波/底噪/动态/有效带宽/超 15s，与风格分正交；损伤事后无法弥补故只否决不加权）                              | 无工程薄包装，从仓库根调用：`uv run --no-project --with soundfile --with numpy $R/prospect_ref.py <源音频…>`，见 [VOICE-CLONING.md §3.2](./VOICE-CLONING.md) |
| [scripts/pipeline.py](./scripts/pipeline.py)             | **单入口编排**（上表）                                                                                                  | `uv run --no-project $R/pipeline.py --project $P tts --plan`                                                      |
| [scripts/timeline.py](./scripts/timeline.py)             | 时间轴 Python 侧实现（与 timing.ts 同构，直读 timing.json）                                                            | 被 qa_frames/captions/check_script 复用                                                                                                          |
| [scripts/check_script.py](./scripts/check_script.py)     | ④⑤ 内容门：beat 覆盖性 / 时长预算双口径 / SceneFade 不变式 / `--check-scenes` 分镜↔代码互比                            | `uv run --no-project scripts/check_script.py --check-scenes`                                                                                   |
| [scripts/check_series.py](./scripts/check_series.py)     | 系列一致性五规则（口播反串线 / 多标题顺序 / 序号绑定 / 清单完整性 / 死链），执法 [../series.json](../series.json)         | 仓库根：`uv run --no-project $R/check_series.py`（已挂 pre-commit）                                                          |
| [scripts/captions.py](./scripts/captions.py)             | 导出 srt/vtt（cue 终点不含句间停顿——外挂字幕静默期不留字）                                                             | `uv run --no-project scripts/captions.py`                                                                                                        |
| [scripts/qa_frames.py](./scripts/qa_frames.py)           | 抽帧 QA（幕/句/`--last-n` 末 N 句）+ `--check` 四项自动体检 + `--check-theme` WCAG 对比度                               | `uv run --no-project --with pillow --with numpy scripts/qa_frames.py out/draft.mp4 --last-n 6 --check`（工程根；视频路径按 CWD 解析，仓库根调用写全 `$P/out/draft.mp4`）                                          |
| [scripts/paper_extract.py](./scripts/paper_extract.py)   | Stage ① 取证工具箱（§→页映射 / 分栏取文 / caption 收割 / 定点 find / 页面光栅化）                                       | `uv run --no-project --with pymupdf $R/paper_extract.py "<PDF>" find "原文措辞"`                                             |
| [scripts/refs.py](./scripts/refs.py)                     | 参考样本可复现清单（verify/rebuild；指纹在 [voices/refs.toml](./voices/refs.toml)，只存哈希不存音频）                    | `uv run --no-project $R/refs.py verify`                                                                                     |
| [scripts/source_ledger.py](./scripts/source_ledger.py)   | Stage ① **B 型信源**可复现清单（fetch/list/verify；`repo` 类固定提交 raw 指纹漂移即 FAIL，`site` 类只比归一正文、漂移报 WARN） | `uv run --no-project $R/source_ledger.py --project $P verify`                                               |
| [scripts/pron_marks.py](./scripts/pron_marks.py)         | 发音标注 `<原文\|读音>` 的解析与校验（纯函数库，无 IO）：多音字/英文专名的精确读音控制；被 `build_narration.py` 用于硬失败拦非法标注 | 库，不直接调用；语法与规则见其模块文档，台账见 [PRON-GLOSSARY.md](./PRON-GLOSSARY.md)                                                            |
| [scripts/tts_bench.py](./scripts/tts_bench.py)           | 合成耗时基准与**测量环境体检**（**运行于 index-tts 环境**，同 tts_server.py）：A/A 复现性判定 + 分段计时 + 换页/分配器诊断。本机漂移已定因为热节流，做任何耗时 A/B 前先用它确认环境合格 | 在 `~/tools/index-tts` 内：`./.venv/bin/python <本仓>/$R/tts_bench.py --check-only`；A/A 见 [INDEXTTS-2.5-ADVANCED.md §6.5](./INDEXTTS-2.5-ADVANCED.md) |

中心脚本以 `--project <工程根>` 参数化；工程内 `scripts/*.py` 为薄包装（透传参数、保持原 CLI）。改造/迭代只改 `$R/`，验证门 = 受影响工程的 `narration.json` / `manifest.json` 字节级不变。

### pipeline.toml 字段表

schema、默认值与校验的单一事实源是 [scripts/config.py](./scripts/config.py) 的 `SCHEMA`（此前 schema 只是「两个脚本里 `.get()` 调用的并集」，无处可查、键名 typo 静默生效）。**默认值在代码、toml 只写偏离**——判据是「删机制常数、留策略声明」。跑 `pipeline.py doctor` 打印带来源标注（`pipeline.toml` / `default` / `env:*`）的生效配置表。

| 键 | 必填 | 默认 | 性质 |
|---|---|---|---|
| `episode.slug` | ✅ | — | 须等于工程目录名，且能在 series.json 命中（跨源身份校验） |
| `narration.target_minutes` | ✅ | — | `[下限, 上限]` 分钟；缺失会让时长预算门**点名跳过** |
| `narration.chars_per_min` | | `280` | 机制常数 |
| `tts.engine` | | `indextts` | **策略声明**（有替代项 edge，且受 `.engine` 签名护栏约束），故保留在 toml |
| `tts.ref` | engine=indextts | — | **子项目根相对**；内容入缓存摘要（改拼法不失效缓存） |
| `tts.ref_sha1` | engine=indextts | — | 12 位，同 tts.py 口径 |
| `tts.style` | engine=indextts | — | STYLE_PRESETS 档名 |
| `tts.lang` | | `ZH` | 机制常数 |
| `tts.server` | | `http://127.0.0.1:8766` | **机器属性**：可用 `INDEXTTS_SERVER` 覆盖，永不写进 toml |
| `render.draft_scale` | | `0.5` | 机制常数（`qa --scale` 推断依赖它） |
| `render.draft_jpeg_quality` | | `60` | 机制常数 |

未知键报 WARN 并给最近邻建议（保留前向兼容）；类型/取值域/必填/slug 不符报 FAIL。`status` 与 `doctor` 只报不退——诊断工具因被诊断对象有病而拒绝运行是荒谬的；其余子命令 FAIL 即退出。

**默认值只许有一份**：消费者脚本需要兜底时一律写 `config.default("<节>.<键>")`，不得内联字面量。`config.load(required=False)` 在缺 `pipeline.toml` 时直接返回 `{}`（不走 `resolve()`），所以内联的 `.get(k, 280)` 是**可达**的第二事实源——改 SCHEMA 时那条路径会静默沿用旧口径。该纪律由 [tests/test_config.py](./tests/test_config.py) 执法。

## 四、复用边界（显式权衡）

- **Python 脚本：集中共享（SSOT）**——三个纯文本变换工具，跨集零差异，中心化防 split-brain。
- **Remotion 工程原语：复制适配，不做共享包**——`timing.ts` / `Subtitle` / `cards.tsx` / `theme.ts` 等每集复制后按本集视觉契约修改。理由：每集工程须保持 pnpm `--ignore-workspace` 独立可渲染（嵌套 workspace 隔离 + Remotion 版本自由），共享 TS 包会把「一集的视觉改动」泄漏进其他集。**复制源头是 [templates/video-skeleton/](./templates/video-skeleton/)**（14 个 frozen 文件 + skeleton.toml 档位清单），新集用 `scaffold.py` 实例化、「改任何一处须同步」由 `verify_skeleton.py` 机器执法——此前「以任一既有集为模板」的说法等于给 391 行冻结基建设 4 个同权真理声明者，且纸面义务从未被执行过（详见 skeleton.toml 内注）。同类做法：`go mod vendor` + `go mod verify`（物理副本 + 校验门）、Copier（模板 + 应答记录）。
- **每集视觉契约独立设计**（色彩语义映射到本集核心概念），但底层规范复用：深色底 `#0E1116` 系、警示红 `#FF5C5C`、确认绿 `#7ED321`、金句卡衬线体、公式只作角标彩蛋。

## 五、音画同步机制（零手工对轨）

每句一段 MP3；`tts.py` 产出 `video/public/audio/manifest.json`（含每句实测时长）；Remotion `calculateMetadata` 读取 manifest 计算全片时间轴。**改稿后只需重跑：build → tts → render**。引擎可选 edge 预置音色（默认）或用自己的声音克隆（[VOICE-CLONING.md](./VOICE-CLONING.md)），两种引擎的 manifest 契约完全一致。

**时序常数单一事实源** = 每集 `video/src/timing.json`（句间/幕间/片头/片尾/幕间淡入淡出）：`timing.ts` 经 `resolveJsonModule` 同步 import，Python 侧（qa_frames/captions/check_script）经 `timeline.py` 直读同一文件——改节奏只动 JSON，双语言镜像漂移结构性不存在。**渲染主机约束**：三集未内嵌 CJK 字体（PingFang SC/Songti SC/SF Mono 系统栈），渲染仅限 macOS；两个重启触发器见 [skills/06 事实条](./skills/06-remotion-implementation.md)。

## 六、新集脚手架清单

1. 实例化骨架（替代旧的「`cp -r` 任一既有集」——那句话给 391 行冻结基建留了 4 个同权真理声明者）：
   ```bash
   uv run --no-project $R/scaffold.py <slug>-video --title "本集标题" \
       --ref <样本名> --ref-sha1 <12位指纹> --style <档名>
   ```
   scaffold 复制 14 个 frozen 文件 + 渲染 4 个模板（package.json / theme.ts / pipeline.toml / README），
   **刻意不生成 scenes/**（样例留在模板里）、不改根 `.gitignore`（已通配到分集级）、不写 series.json。
   跑完立刻 `uv run --no-project $R/verify_skeleton.py` 确认新集与模板零漂移。
2. `theme.ts` 换本集概念色；`video/src/scenes/*` 与 `Main.tsx` 注册表全部新写。
3. `cd video && pnpm install --ignore-workspace`（必须显式忽略根 workspace；`onlyBuiltDependencies: [esbuild]` 已在 package.json）；装完检查根 lockfile 零变更。
   > pnpm ≥ 11 会提示 `package.json` 的 `pnpm` 字段不再被读取，并报 `ERR_PNPM_IGNORED_BUILDS: esbuild`
   > （[ISSUE-076](../../../docs/.agents/issue.md)）。**已实测确认对本工程无害**：esbuild 的平台二进制
   > 是 optionalDependency，落地不依赖 postinstall —— 旧写法下 `remotion bundle` 端到端通过。
   > 故**刻意不改** `.npmrc`/`package.json` 去消掉这条提示（改了会让 A 档冻结文件产生一处
   > 只为静音噪声的跨集差异）。真正需要 postinstall 的依赖若将来出现，再按官方新家
   > `pnpm-workspace.yaml` 的 `allowBuilds` 处理。
4. **登记到 [../series.json](../series.json)**：顶层是 `seriesList[]`，新系列追加一个 series 对象
   （`id` / `title` / `sourceKind` / `rule` / `episodes`），既有系列的新集追加到其 `episodes`。
   同步 [../series.md](../series.md) 的分节表格。注意**漏登没有阻塞门**：`check_series.py` 只遍历
   series.json（看不见孤儿目录），`verify_skeleton.py` 会点名**未登记的孤儿工程目录**但不计入
   未登记漂移（`--strict` 不失败）——登记义务靠这条警告 + 本清单自觉执行。
5. 按 [skills/](./skills/) 01→05 顺序走内容层，再进生产层。Stage ① 先判**信源型别**：
   论文型走 A 型（`paper_extract.py` + `paper-notes.md`），文档/代码/课程站点型走 B 型
   （`source_ledger.py` + `source-notes.md` + 证据三级），见 [skills/01](./skills/01-source-extraction.md)。

## 七、工程模式

本仓统一采用 **Remotion 工程模式**（全代码动画 + manifest 自动对轨、可编程复渲）。早期的单文件 Canvas 轻量制作包模式已于 2026-08 废弃移除（见 commit `f7d72814`）。

## 八、许可注意

Remotion 对超过 3 人的公司需商业授权（个人/小团队免费）；edge-tts 为微软在线语音，发布前确认平台对合成语音的标注要求；**IndexTTS-2.5 按 bilibili 模型使用许可发布，个人/研究可用，商用需联系 indexspeech@bilibili.com**（详见 [VOICE-CLONING.md §八](./VOICE-CLONING.md)）；不使用任何未经授权的第三方图片/音频素材。
