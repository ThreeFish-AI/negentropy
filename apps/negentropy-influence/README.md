# negentropy-influence

> 知识影响力**内容工作区**：三个系列 10 集动效图解科普视频的成片工程。机制的九阶段流水线（信源精读→策划→逐字稿→双重校验→分镜→TTS→Remotion→草渲 QA→终渲）已于 2026-09 外置为公开 skill [to-video](https://github.com/ThreeFish-AI/to-video)（MIT），本目录只承载内容。

内容清单：

- **episodes/**：每集一个 `<slug>-video/` 工程（research/ script/ scripts/ video/），各自发布；
- **series.json / series.md**：发布顺序 SSOT（机读 seriesList[] + 人读总览），由系列一致性门执法；
- **source-map/**：多集系列的章节→集归属信源地图（source_ledger.py 的 sync/audit 消费它）；
- **voices/**：参考音色指纹清单（refs.toml 只存哈希与生成参数，不含音频字节）。

skill 安装位 `~/.claude/skills/to-video`（软链到上述仓库的 clone，或以 `TO_VIDEO_HOME` 指向任意 clone）。机制的完整契约（九阶段总览 / 目录约定 / 脚本表 / 复用边界）见 skill 的 [pipeline/README.md](https://github.com/ThreeFish-AI/to-video/blob/main/pipeline/README.md)。

## 目录结构

```
apps/negentropy-influence/
├── .influence-root     # 工作区哨兵（skill 兼容识别、据此定位工作区，勿删）
├── series.json         # 发布顺序 SSOT（机读，顶层 seriesList[]）
├── series.md           # 作品总览（人读）
├── source-map/         # 多集系列的章节→集归属信源地图
├── voices/             # 参考音色样本（gitignored 生物特征；refs.toml 只存指纹）= $V
├── to-video.toml       # 工作区机制配置（check_series 受检面与系列 id 集）
├── scripts/            # 工作区级薄包装（check_series.py / pipeline.py → skill 解析器）
└── episodes/           # 每集一个 <slug>-video 工程（research/ script/ scripts/ video/）
```

## 如何迭代

机制命令统一用 $T / $W / $P / $V（skill 根 / 工作区根 / 分集工程 / 音色目录）四个变量书写，**唯一定义处**是 skill 的 [pipeline/README.md 路径变量约定](https://github.com/ThreeFish-AI/to-video/blob/main/pipeline/README.md#路径变量约定)。常用命令（经已装 skill）：

```bash
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P status      # 派生式新鲜度表
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P tts --plan  # TTS 排期预演
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P qa          # 草渲抽帧 QA
uv run --no-project $T/pipeline/scripts/check_series.py                      # 系列一致性门
```

工作区内等价形态（`scripts/` 薄包装自证工作区锚并写回 `TO_VIDEO_WORKSPACE`，从任意 CWD 调用都锚定本工作区）：

```bash
uv run --no-project apps/negentropy-influence/scripts/pipeline.py --project $P status
```

机制改动去 skill 仓（`$T/pipeline/scripts/`，全量机制测试 `$T/pipeline/tests/` 亦随 skill 走；验证门 = 受影响工程的 narration.json / manifest.json 字节级不变），不落本工作区。仓级 pre-commit 的系列一致性钩子 entry 即上述工作区包装器——**依赖 to-video skill 已安装**，缺失时大声失败并打印安装指令（git clone + 软链 `~/.claude/skills/to-video`，或设 `TO_VIDEO_HOME`），绝不静默通过。

## 两条不变量

- **Python 工具集中共享（SSOT）**：原则不变，共享载体已随机制外置为 skill 仓（`$T/pipeline/scripts/`）；纯文本变换工具跨集零差异，中心化防 split-brain——工作区与分集工程只持薄包装（复制「转发」而非「实现」）。
- **Remotion 工程原语复制适配、不做共享包**：每集须保持独立可渲染（嵌套 workspace 隔离 + Remotion 版本自由），共享 TS 包会把「一集的视觉改动」泄漏进**已发布**的其他集。复制源头 `templates/video-skeleton/` 与「改任何一处须同步」的 verify_skeleton.py 机器执法均随 skill 分发。

声音样本属生物特征信息，永不入库：voices/ 整目录 gitignored，refs.toml 指纹制（只存哈希与生成参数）。
