# Stage ⑦ Remotion 场景实现（skill 规格 · 06）

> Stage ⑦：把 `script/storyboard.md` 的分镜规格实现为 `video/src/scenes/` 场景组件，直至草渲抽帧 QA 通过、终渲出片。
> 本文件是实现代理的提示词规格，与 skills/01–05（内容层）衔接。

## 输入

- `script/storyboard.md`（分镜规格：镜号 ↔ 句 id 区间 ↔ 画面 ↔ 动效）
- `video/public/audio/manifest.json`（TTS 产物：每句实测时长）
- 任一既有集工程的 `video/` 骨架（脚手架来源；与发布顺序无关）

## 骨架复制适配策略

**复制源头有名字**：[templates/video-skeleton/](../templates/video-skeleton/)。新集用它实例化（`uv run --no-project $R/scaffold.py <slug>-video --title "…"`），**不要**再 `cp -r` 任一既有集——「任一」意味着 4 个同权真理声明者。冻结档位（frozen / overridable / regioned / structured / seeded）、分组语义与已登记漂移的**机器可读单一事实源**是 [skeleton.toml](../templates/video-skeleton/skeleton.toml)，判据由 `verify_skeleton.py` 执行：

```bash
uv run --no-project $R/verify_skeleton.py          # 漂移报告
uv run --no-project $R/verify_skeleton.py --strict  # 有未登记漂移即失败
```

要点（详见 skeleton.toml 内注）：

- **A 档 · frozen 逐字节保留**（14 个文件，含 `src/timing.ts` 的 computeTimeline + beatWindow + SCENE_FADE_FRAMES、`@remotion/media` 的 NarrationAudio、fitText 的 Subtitle、幕间呼吸淡入淡出的 SceneFade、cards、三份薄包装与全部工程配置）。改任何一处 = 改模板 + 改各集，`--strict` 会盯住。
- **B 档 · overridable**：`src/timing.json`（时序常数 SSOT——timing.ts 与 Python 侧共读同一文件，**改常量只改此处**）。覆写许可存在但四集从未行使过。
- **regioned**：`src/Main.tsx` 区外冻结（每集内容只有场景 import 与 SCENE_COMPONENTS 注册表）；**structured**：`package.json` 门住依赖零漂移、忽略 name/description。
- **每集改写**：`src/design/theme.ts`（本集色板）、`src/scenes/*`（全部重写；骨架样例见模板里的 scenes-EXAMPLE.tsx.txt）。

## 事实条（防重复论证）

- `premountFor` 在**渲染期自动关闭**（active 含 `!env.isRendering`）——只优化 Studio 拖拽与 Player 预览；渲染侧收益是 Mediabunny 抽轨与时间轴同步，不是渲染速度。
- 幕间转场**不用** `@remotion/transitions` 的 TransitionSeries：其总时长 = Σ序列 − Σ转场，会把视觉层整体左移而旁白（manifest 帧号绝对定位的独立层）不动 → 逐幕递增失同步。用 `SceneFade`（只花幕间既有静默，from/总时长零改动；不变式 `2×sceneCrossFadeSec ≤ sentenceGap+sceneGap` 由 check_script.py 强制）。
- 字体可复现性：三集用 macOS 系统字体栈（PingFang SC/Songti SC/SF Mono），未内嵌 CJK 字体——**渲染仅限 macOS 主机**。两个重启触发器：渲染迁 Linux/CI；Remotion 5.0 把 fitText 的 validateFontIsLoaded 默认翻 true（届时须内嵌子集字体，注意 pre-commit --maxkb=1024）。
- 路径描画优先 `@remotion/paths`（evolvePath/getPointAtLength）——它是「pathLength 与 px 版 strokeDasharray 互斥」红线的官方正解；线型样式（虚线/点线）另置静态叠加路径，勿与描画动画挤在同一元素。

复用边界的原则（见 [../README.md](../README.md) 第四节）：Python 脚本集中 SSOT；**Remotion 原语复制适配不共享**——共享 TS 包会把一集的视觉改动泄漏进其他集。

**A 档冻结的同步义务范围（多系列后必须显式化）**：「改任何一处须同步并验 md5 唯一」的义务
**限于同一系列内**。新系列的首集从模板实例化后即**建立自己的基线**，此后与其他系列各自演进——
否则「复制不共享」的隔离初衷会被一条跨系列的同步义务反向击穿。判据：md5 一致性按系列分组核对
（`verify_skeleton.py` 已按 series.json 分组；`baselineOf` 指定哪个系列担保模板不过期。
将来真出现跨系列基线分叉时，`cp -r` 一份模板目录 + 改一行 `baselineOf` 即可，验证器不用动）。

## 本集之外可复用的视觉母题

每集的 `scenes/*` 是一次性的，但可复用的画面语言分两层，落点不同：

- **chrome 层（机械排版/标注）已随骨架播种**：`Panel` / `Footnote` / `SceneTag` /
  `Counter` / `CodeCard` / `NumberedCard` / `ease` 在模板
  [motifs.tsx](../templates/video-skeleton/video/src/components/motifs.tsx)（seeded 档，
  随 scaffold 复制、复制后自由演进）。它只读底座 token，概念色一律经 `accent` prop
  注入——scaffold 后 tsc 直接干净，无需先动 theme。
- **创作性母题**（承载各集叙事隐喻）不进模板，从出处集复制后裁剪：

| 母题 | 出处 | 适用 |
|---|---|---|
| 终端窗口 + 打字机 | [claude-code-explained-video](../../episodes/claude-code-explained-video/video/src/components/motifs.tsx) `Terminal` | 任何「人机对话/命令行」痛点开场 |
| **恒定视觉锚**（环形循环） | 同上 `LoopRing` | 主题是「某个东西始终不变」时：锁死 `stroke` 与 `strokeWidth`（绝对像素、不随 size 缩放），让「不变」被**看见**而不是被听说 |
| 字典分发表 | 同上 `DispatchTable` | 键值查表、注册表、路由表 |
| 闸门路由 | 同上 `GateRouter` | 多级判定/准入/过滤管线 |
| 插槽注册板 | 同上 `SlotRing` | 扩展点、生命周期钩子、插件位 |

借用方式仍是**复制该文件后裁剪、追加进本集的 motifs.tsx**，不做跨集 import。
「反枚举并列项」模式（N 个并列概念不给 N 色，panel 底 + 编号、激活时才染色）
已随 chrome 层播种——用 `NumberedCard` 传本集概念色即可。两条经验：
- 小尺寸下 SVG 环形节点的 0°/180° 标签会互相压字 —— 需要 `showLabels` 之类的显式开关
  （本集实测：size < 260 必须关掉）。
- 「用无动效表达无聊」是有效手法：金句期间让主体继续匀速运动、**不加任何强调动效**。

## 场景组件模式

```tsx
export const P2FiveObjects: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p2-03', 'p2-07')} name="2-B 框架·SICA">
        <SicaDiff />
      </Sequence>
      {/* 一镜一组件；Sequence name = storyboard 镜号 */}
    </AbsoluteFill>
  );
};
```

- 一幕一文件 `P<n><Name>.tsx`；一「镜」一内部子组件；
- `Sequence name` 与 storyboard 镜号一一对应（QA 时可对照）；
- beat 内动画只用 `useCurrentFrame()` + `interpolate`/`spring`（帧驱动，禁 `Date.now()`/随机数——渲染必须确定）。

## theme.ts 色彩契约设计规则

1. 底座恒定：bg `#0E1116` / panel / panelBorder / text / dim / danger `#FF5C5C`（恒配 ✗，仅失败态）/ 字体三族。
2. 本集概念色 2–3 个，映射**深层轴**而非枚举项（反枚举色彩原则：N 个并列概念不给 N 色，统一 panel 底+编号，被"激活"时加主色辉光）。
3. 深底对比度：主色对 `#0E1116` 亮度比 ≥ 4.5:1；**系列内**不得与已用色撞值——当前占用以 `check_series.py` 的「已用色 INFO 行」实时输出为准（勿在文档里维护静态清单，必陈旧；跨系列撞色已不可避免，不作设计目标）。
4. 若覆写底座语义色（如 ok 与主色合一），在 theme.ts 注释 + planning.md + README 三处记录。
5. 时间/顺序等非色彩维度用**位置、线型、亮度**编码，不用色相。

## 渲染缺陷自检清单（历史教训公共化）

来自 PR #1101/#1102 review 修复，每集实现与 QA 必查：

1. **百分比定位量纲**：`left/top` 混用 `%` 与 px 时计算基准不同——居中场景统一用 px（`width/2 - w/2`）推导，避免「看着居中、渲染偏移」。
2. **底部角标避让字幕条**：字幕条占底部 ~54+44px；角标/公式/说明文字 `bottom ≥ 150`。
3. **SVG 描边动画**：`pathLength={1}` 会归一化路径长度，与像素级 `strokeDasharray` 互斥——二选一；描边生长用 `pathLength + strokeDashoffset` 归一化方案。
4. **片尾渐黑窗口**：不写死帧数，从**末 beat 总时长**（`beatDurationInFrames` 传入收尾组件）实时推导淡出区间——勿用末句时长（第三集上线教训：末句短于 beat 时渐黑提前收尾，导致收尾长黑屏）。
5. **首帧内容必须可渲染**：`calculateMetadata` 依赖 manifest；缺 manifest 时 Root 已有中文报错引导先跑 tts.py。
6. **JSX 文本中的弯引号/特殊 Unicode**：直接放 JSX 文本里的 `“…”` 可能触发解析器歧义——字符串字面量一律用 `{'...'}` 包裹。
7. **对象字面量重复属性**：`width` 等属性写两次 tsc 才报（TS1117）——review diff 时留意复制粘贴残留。

## 命令闭环（工具一律 `./node_modules/.bin/` 直调，防 workspace 污染）

```bash
cd video
pnpm install --ignore-workspace          # 首次；根 lockfile 必须零变更
./node_modules/.bin/tsc --noEmit         # 类型零错误
./node_modules/.bin/remotion render Main ../out/draft.mp4 --scale=0.5 --jpeg-quality=60  # 草渲
cd .. && uv run --no-project scripts/qa_frames.py out/draft.mp4 --scene P2   # 抽帧 QA（--scene 或句 id）
cd video && ./node_modules/.bin/remotion render Main ../out/final.mp4          # 终渲 1080p30
```

QA 验收：逐幕抽帧目检色契约遵守、beat 窗口不越界、角标不入字幕区、无文字溢出/遮挡；高风险镜（矩阵图/全景图/金句卡）单独指定句 id 抽帧。

## 系列身份视觉：五层 Harness 栈（2026-08-23 Harness Engineering 改造引入）

「Claude Code Harness Engineering」五集共用一套**首尾统一的系列装置**。实现仍遵守
「复制适配不共享」：母题代码落各集 `motifs.tsx`（seeded 档），**本节是五集一致性的规格 SSOT**——
改规格先改这里，再逐集同步。

> **落地状态（2026-08-23 评审）**：规格先行，**未落地**——改造版草渲（draft-review）中
> 各集 P0/P6 均未实现本节装置（EP1 P0 为五辐条供给图，各集 P6 为文字身份卡 + 下期卡）。
> 本节是终渲前待办的目标规格而非现状描述；落地时逐集同步并在本块更新状态，
> 防止「SSOT 与已交付草渲事实漂移」再次发生。

### 五层栈母题（HarnessStack）

- **结构**：纵向五层（自底向上：执行 → 规划 → 记忆 → 时机 → 协作），每层一条横板：
  图标 + 层名 + 一句话职责；层序与层名从 `series.json` 的 episode 顺序 + cardSub 派生（硬编码即漂移）。
- **P0 开场用法**（每集 ≤3 句内完成）：五层自底向上快速落板（层落 = translateY + 透明度，约 6 帧一层），
  **本集层高亮脉冲**（主色描边 + 辉光呼吸两次），其余层压暗至 55% 亮度；随后栈整体缩小退至画面左上角
  作常驻角标（宽 ≤ 300px，本集层保持高亮）——不占字幕安全区。
- **P6 收尾用法**：栈重新放大居中；已发布层保持点亮，**下期层呼吸预告**（画面卡显示下集标题——
  派生自 series.json，口播只说「下期 + 话题描述」）；系列标语压在栈底。
- **动画时点**一律由句边界推导（`rel(beat, '句id')`），禁写死帧数。

### 动效语法（五集统一）

| 语法 | 值 | 用途 |
|---|---|---|
| `flow` | 连线上的行进光点：2–3 个 6px 圆点沿路径循环，`stroke-dashoffset` 驱动 | 数据流向（循环回灌/消息传递/判定路径） |
| `pushIn` | beat 切换时图解组 scale 1.0→1.06（easeOut，12 帧） | 镜头语言，替代纯淡入 |
| `glow` | 主色辉光：`box-shadow: 0 0 24px color/40%, 0 0 64px color/25%` | 高亮语义（仅概念色元素，禁滥用） |
| `meter` | 帧驱动数值条（水位/预算/计数） | 数据动感；值 = f(frame)，禁随机 |
| `settle` | 入场落位：spring(stiffness 120, damping 18) 或 10 帧 easeOut | 卡片/节点落位统一手感 |

深度感：背景网格（60px 网距、8% 透明度）随场景帧缓慢漂移（每帧 0.2px，全片 ≤40px 循环）。

### 信源卡（P6「依据与致谢」，观众层）

行固定四条：①官方文档 `code.claude.com` + 取数日期；②Anthropic Engineering 博客；
③第三方源码分析（不点名，「片中已逐处标注」）；④「画面数字均为实测口径」。
课程站点与仓库链接**不进观众层**（仓内 `sources.toml` 保留全指纹——两层口径见 check_series.py 规则 7）。
