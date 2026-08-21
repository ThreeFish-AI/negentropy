# negentropy-influence

> 知识影响力子项目：把论文与技术文档做成**动效图解科普视频**的可复用流水线，以及各集成片工程。

本子项目 2026-08 从仓库根 `media/` 迁入 `apps/`，同时把「机制」与「内容」的边界显式化为两个目录。

## 目录结构

```
apps/negentropy-influence/
├── .influence-root          # 子项目根哨兵（scripts/paths.py 靠它定位，勿删）
├── series.json              # 发布顺序 SSOT（机读，顶层 seriesList[]）
├── series.md                # 作品总览（人读）
├── pipeline/                # ── 机制：跨集共享，单一事实源 ──
│   ├── README.md            #    九阶段总览 / 目录约定 / 脚本表 / 复用边界 / 新集清单
│   ├── scripts/             #    公共脚本，pipeline.py 为单入口编排
│   ├── skills/01–09         #    九阶段代理提示词规格（内容 SSOT）
│   ├── tests/               #    全量 5 秒内跑完，零基建依赖（刻意不写条数：会漂）
│   ├── voices/              #    声音样本指纹清单（refs.toml，只存哈希不存音频）
│   ├── VOICE-CLONING.md     #    IndexTTS 声音克隆操作手册
│   ├── INDEXTTS-2.5-ADVANCED.md  # 上游能力面与机制循证
│   └── PRON-GLOSSARY.md     #    发音标注台账
└── episodes/                # ── 内容：每集独立，各自发布 ──
    └── <slug>-video/        #    research/ script/ scripts/ video/（Remotion 独立 pnpm 工程）
```

## 路径变量约定（`$R` / `$P`）

公共脚本与技能文档中的命令统一用 `$I`/`$R`/`$P`/`$V` 四个变量书写，使命令与子项目位置
解耦。**定义只有一处**（本文件刻意不复制，否则搬迁时又要改两份）：
[pipeline/README.md 路径变量约定](./pipeline/README.md#路径变量约定)。

单入口编排（参数读各集 `pipeline.toml`）：

```bash
uv run --no-project $R/pipeline.py --project $P {status|doctor|build|check|tts|captions|render|qa|all}
```

各阶段的完整契约、脚本表与复用边界见 [pipeline/README.md](./pipeline/README.md)；
作为子代理提示词的九阶段规格见 [pipeline/skills/](./pipeline/skills/)，
Claude Code 侧的路由壳是 [.agent/skills/science-video-pipeline](../../.agent/skills/science-video-pipeline/SKILL.md)。

## 运行测试

本子项目无 Python 包依赖清单，依赖在调用侧注入：

```bash
uv run --no-project --with pytest --with numpy --with pillow --with mutagen --with soundfile \
    python -m pytest apps/negentropy-influence/pipeline/tests -q
```

## 两条不变量

- **Python 脚本集中共享（SSOT）**：纯文本变换工具跨集零差异，中心化防 split-brain。
- **Remotion 工程原语复制适配、不做共享包**：每集须保持 `pnpm install --ignore-workspace`
  独立可渲染（嵌套 workspace 隔离 + Remotion 版本自由），共享 TS 包会把「一集的视觉改动」
  泄漏进**已发布**的其他集。复制源头是 [pipeline/templates/](./pipeline/README.md)，
  冻结档位与漂移判据同见 pipeline/README.md 第四节。

声音样本属生物特征信息，永不入库；`.gitignore` 已按分集通配覆盖音频与渲染产物。
