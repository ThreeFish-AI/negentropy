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

- **A 档 · frozen 逐字节保留**（清单见 skeleton.toml，含 `src/timing.ts` 的 computeTimeline + beatWindow + SCENE_FADE_FRAMES、`@remotion/media` 的 NarrationAudio、fitText 的 Subtitle、幕间呼吸淡入淡出的 SceneFade、cards、`src/motion/` 运动层（见下节）、三份薄包装与全部工程配置）。改任何一处 = 改模板 + 改各集，`--strict` 会盯住。
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

## 运动层（video/src/motion/，frozen 跨集共享）

**共享的是「怎么动」（机制），不是「画什么」（策略）**：时长/缓动/弹簧/错峰/巡游
等时序语汇跨集一致（同一只手感），theme/motifs/场景构图仍各集自由。落地为
`src/motion/` 七文件（tokens/window/schedule/hooks/index/gallery + 单测），frozen 档
md5 门执法——判据与「不读 theme token」约束见 tests/test_skeleton.py 的 motion 三条。

- **令牌（tokens.ts）**：时长六档 `DUR.f1..f6`（2/3/5/7/12/21 帧，Carbon DTCG 六档
  @30fps；弃 M3 十六档——30fps 量化下 6 对相邻档同帧数，伪选择）；缓动
  `standard/decelerate/accelerate/linear`（M3 贝塞尔控制点）；弹簧 `settle`(damping 200，
  本仓既有 9/10 调用点的实测手感——**刻意不抄规格散文里的 stiffness 120/damping 18**，
  视觉连续性优先于纸面参数) / `settleSoft`(170) / `snap`(12，轻过冲)；`SAFE_TOP_Y=920`
  字幕安全带 SSOT；`EXIT_FACTOR=0.4` 出场快于入场。
- **窗口（window.ts）**：`progress/win/beatProgress/clamp01` 纯函数——「clamped 0→1
  手写 interpolate」惯用形的统一替身；父级持有绝对帧、子动画是 beat 进度上的窗口，
  TTS 实测时长变化 ⇒ 全部窗口自动重定时（写死帧数缺陷类由构造消灭）。
- **编排（schedule.ts）**：`schedule(n, {dur, stride|lag|fit, minStride, minDur})`——
  错峰三模式（固定步长 / Manim lag_ratio / 拟合进 beat 窗口），钳制优先级
  「不外溢窗口 > 最小步长 > 子项时长」。
- **模型（hooks.ts）**：`useProgress`（缓动数值进度）`useSpring`（弹簧数值进度）
  `useEnter`（入场 fall/rise/slide/pop/flyIn/fade；rise 自带 `restBottom` 安全带钳制——
  ISSUE-170 缺陷类构造性消灭）`useStagger`（序列错峰）`useDraw`（描线，红线三构造保证）
  `useImpulse`（一次性强调）`useBreathe`（持续辉光，period=2π·除数）`useTravel`
  `useAccelTravel`（加速绕行，吸收两处克隆）`useCount`（计数/水位=meter）`useReveal`
  （打字机）`usePushIn`（镜头推近）`useDim`（压暗/提亮）`useFlowDash`（flow 行进虚线）
  `useShake` `useFadeOut`（片尾渐黑，红线四构造保证）。
- **铁律**：① hooks 只在组件顶层调用（map/条件内用纯函数 `progress`/`spring`+`SPRING`）；
  ② 弹簧只喂局部帧（`frame - at`）——全局帧会让 spring() 每帧从 0 重模拟 O(frame)；
  ③ effects（不透明度/颜色）永不吃弹簧（M3 spatial/effects 二分）；④ 时长取最近 token
  （±3 帧内），不落标尺的 beat 级动作保留显式帧数并注释；⑤ 动画时点一律由句边界
  推导（`rel(beat,'句id')`）。
- **逃生舱（反模板化对冲）**：裸 `interpolate`/内联正弦是**合法**的——每集保留 ≥1 个
  豁免运动层的 bespoke 签名镜头（EP1 的 0-B 命名帧合拢即例）；等速线性运动在「机械感
  是主题」时优先于缓动（EP1 0-A 搬运弧线即例）。模型是词汇不是牢笼。
- **评审面**：`./node_modules/.bin/remotion still src/motion/gallery.tsx MotionGallery
  ../out/motion-gallery.png --frame=30`——全部模型 × 变体一屏秒级出图；纯函数单测
  `node --test scripts/motion.test.ts`（Node ≥ 23.6 原生跑 TS）。

## 3D 点缀（`@remotion/three`，2026-09 EP1 落地）

**定位**（调研 §5.4 判 P2「轻量 3D 点缀」）：仅当平面表达不出「体积 / 内外 / 咬合」时才上。
落点放各集 `components/`（seeded），**不进 frozen**——frozen 共享「怎么动」，3D 给的是
「画什么的三维形状」。3D 组件**零 motion hook**，运动量全部由调用方以 prop 注入。

### 三条宪法（EP1 实景抽帧得出，跨集适用）

1. **只做直角体，不做圆/环/曲面**。画面里的「圆」若已被某个不变量母题独占（EP1 的
   `LoopRing`：恒色恒线宽、六次出场同形，承载主题句本身），任何三维环/球/柱面都会让
   它读成「有两种」，唯一性即失。副产品是工程护栏：元素词表被钉死在
   `box / edges / lineLoop / basic 材质`，新增 3D **不引入新类型面**（tsc 风险为零）。
2. **读感来自转物体，不来自动相机**。正交 + `zoom:1` 下 1 世界单位 = 1 CSS 像素，这是
   3D 与 DOM 叠层能手算对位的唯一前提；相机一动就要走投影反算（本仓 `BAR_BASE 45` 那道
   疤即此类）。**相机零动画**，深度靠物体静置俯角/偏航。副产品：无相机插值 ⇒ 无浮点累积。
3. **每个颜色是 token 字面值或有注释的确定性派生，永不是「光 × 材质」的乘积**。真光照让
   像素成为运行时乘积——没有名字、不可 grep、`--check-theme` 看不见、WCAG 无法预算，而
   ISSUE-177 教训二正是此形态。故**零光源、只用 unlit 材质**，明暗靠手写面色梯度。
   ⚠️ `<ambientLight>` 对 `meshBasicMaterial` 是**空操作**，写了也不起作用。

### 读色契约（改 3D 必查）

- 概念色只走**棱线**，大面积面色永远是深底族（`panel` 及其派生）。
- 面色常量**放模块内，绝不进 `theme.ts`**——`--check-theme` 会遍历 theme 全部色 token 按
  「概念色 on bg ≥ 4.5:1」判，深色面板色会被当概念色查而直接 FAIL。
- 新面色须人工算两项（`--check-theme` **不检查**「文字 on 面色」，这是工具盲区）：
  `text` 对面色 ≥ 12:1、`dim` 对面色 ≥ 4.5:1。
- **面要被看见，必须与 bg 拉开**：EP1 首版四层壳全取 0.10–0.14 灰度（与 bg `#0E1116` 几乎
  同色），面读不出来、只剩棱线，整组读成「一堆细线框」而非「体」。
- **多层嵌套必须关 edges**：N 层 × 每层的 12 条棱 + 轮廓线，线条密度会压倒面。层身份靠
  每层**一条**正面轮廓表达即可。

### 构造经验

- **井/壳用「实心板嵌套」，不用「四条边框拼框」**：每层一整块板逐层放大后移，内层遮住外层
  中央区，**洞是遮挡的产物**。四条边框拼出的是 N×4 个矩形轮廓，读作线框堆。
- **弹簧过冲要钳行程**：`SPRING.snap` 的 ζ=0.6 ⇒ 峰值 **1.095**，直接喂给「进入深度」会
  穿透底面。内部 `min(seat,1)` 钳制，过冲转为棱线提亮（不丢手感）。
- **一个 beat 一个 `ThreeCanvas`**：每个画布是独立 WebGL 上下文，Chrome 单进程约 16 个上限、
  超出静默丢弃最旧的。多个实体共用一个舞台，绝不「一个物体一个画布」。
- **画布紧贴 3D 区域裁切**，绝不用 `AbsoluteFill` 尺寸——填充成本 ∝ 画布面积 × beat 帧数。
- **z 层级是调用点契约**：3D 画布与同容器内的 DOM（终端/卡片）谁在前，由调用点给
  `position:relative + zIndex`，不写进原语（`zIndex:-1` 会让整个画布沉到兄弟节点之后）。

### 验收

`Config.setChromiumOpenGlRenderer('angle')` 必须在位（无头渲染强制）。禁 `useFrame` /
`Math.random` / `Date.now`；几何 `useMemo` 依赖数组**不含 frame**；不引 drei（无官方确定性
背书清单）。**收敛既有 3D 组件时以「同帧 PNG 逐字节相同」为门**（EP1 的 `PlateSlab3D` →
`Slab3D` 收敛即以 md5 相等验收）。3D 是 `--check` 判据的盲区（它只看黑帧/冻帧/字幕带/对比度），
**必须逐帧目视**，且抽帧要覆盖弹簧过冲峰值那几帧。

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
- beat 内动画优先走 `src/motion/` 运动模型（见上节铁律）；裸 `interpolate`/`spring` 是逃生舱而非默认。一律帧驱动，禁 `Date.now()`/随机数——渲染必须确定。

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

**动效列 @动词 标注**：分镜「动效」列以反引号代码记号声明本镜主力运动模型
（如 `` `@enter:fall` ``、`` `@stagger` ``、`` `@draw` ``——动词表 = hooks.ts 的 use*
导出派生，勿凭记忆写）。`check_script.py --check-motion`（WARN-only）核对镜内声明
的动词在该幕场景代码中确有调用——「分镜写了动效、代码没实现」这一实测缺陷类的机检。
反向不报：动效列是意图摘要而非全量清单。入场瞬态另走 `qa_frames.py --beat-heads N`
（每 beat 头部连抽 N 帧，ISSUE-170 补盲）；重制/重构回归用 `--compare A B`同帧号对拍。

## 系列身份视觉：五层 Harness 栈（2026-08-23 Harness Engineering 改造引入）

「Claude Code Harness Engineering」五集共用一套**首尾统一的系列装置**。实现仍遵守
「复制适配不共享」：母题代码落各集 `motifs.tsx`（seeded 档），**本节是五集一致性的规格 SSOT**——
改规格先改这里，再逐集同步。

> **落地状态（2026-09-03 运动层重制）**：**EP1 已落地**——P0 开场落板+缩退常驻
> （HarnessStackP0）、P1–P5 常驻角标（HarnessBadge）、P6 收尾放大+下期层呼吸预告
> （HarnessStackP6），实现于 EP1 `components/harness-stack.tsx`（复制源，seeded 档）；
> 层序/层名/发布态/下集标题自 `video/src/series-layers.json`（build_narration 从
> series.json 派生，硬编码即漂移）。**EP2–5 待同步**（复制 harness-stack.tsx + 各幕
> 挂 HarnessBadge + P0/P6 编排）——五集不一致状态显式化于此，终渲前逐集补齐。

### 五层栈母题（HarnessStack）

- **结构**：纵向五层（自底向上：执行 → 规划 → 记忆 → 时机 → 协作），每层一条横板：
  图标 + 层名 + 一句话职责；层序与层名从 `series.json` 的 episode 顺序 + cardSub 派生（硬编码即漂移）。
- **P0 开场用法**（每集 ≤3 句内完成）：五层自底向上快速落板（层落 = translateY + 透明度，约 6 帧一层），
  **本集层高亮脉冲**（主色描边 + 辉光呼吸两次），其余层压暗至 55% 亮度；随后栈整体缩小淡出，与常驻条
  交叉淡入衔接。**常驻形式 = 顶边横条**（y 12–48，本集层高亮）：EP1 评审实测纵向左上角标（300×194）
  与既有各幕左上内容五处碰撞（各幕内容最早 y=56 起），顶边横条是唯一零碰撞常驻区——形式适配的
  实测依据见 harness-stack.tsx 文件头，不占字幕安全区。
- **P6 收尾用法**：栈重新放大居中；已发布层保持点亮，**下期层呼吸预告**（画面卡显示下集标题——
  派生自 series.json，口播只说「下期 + 话题描述」）；系列标语压在栈底。
- **动画时点**一律由句边界推导（`rel(beat, '句id')`），禁写死帧数。

### 动效语法（五集统一）

| 语法 | 模型（src/motion/hooks.ts） | 用途 |
|---|---|---|
| `flow` | `useFlowDash`（行进虚线）+ `useTravel`（巡游点） | 数据流向（循环回灌/消息传递/判定路径） |
| `pushIn` | `usePushIn(at)`（scale 1.0→1.06 decelerate，DUR.f5） | 镜头语言，替代纯淡入 |
| `glow` | `useImpulse`（一次性强调）/ `useBreathe`（持续辉光） | 高亮语义（仅概念色元素，禁滥用） |
| `meter` | `useCount`（帧驱动数值，禁随机） | 数据动感 |
| `settle` | `useEnter(..., {springPreset: 'settle'})` / `useSpring('settle')` | 卡片/节点落位统一手感 |

深度感：背景网格（60px 网距、8% 透明度）随场景帧缓慢漂移（每帧 0.2px，全片 ≤40px 循环）。

### 信源卡（P6「依据与致谢」，观众层）

行固定四条：①官方文档 `code.claude.com` + 取数日期；②Anthropic Engineering 博客；
③第三方源码分析（不点名，「片中已逐处标注」）；④「画面数字均为实测口径」。
课程站点与仓库链接**不进观众层**（仓内 `sources.toml` 保留全指纹——两层口径见 check_series.py 规则 7）。
