# Skill 06 · Remotion 场景实现（生产层 Stage ⑦）

> Stage ⑦：把 `script/storyboard.md` 的分镜规格实现为 `video/src/scenes/` 场景组件，直至草渲抽帧 QA 通过、终渲出片。
> 本文件是实现代理的提示词规格，与 skills/01–05（内容层）衔接。

## 输入

- `script/storyboard.md`（分镜规格：镜号 ↔ 句 id 区间 ↔ 画面 ↔ 动效）
- `video/public/audio/manifest.json`（TTS 产物：每句实测时长）
- 上一集工程的 `video/` 骨架（脚手架来源）

## 骨架复制适配策略

从上一集 `cp -r` 复制后，**逐字节保留**（跨集零差异，勿改）：

- `src/timing.ts`（computeTimeline + beatWindow；常量与 `qa_frames.py` 镜像对齐——改常量必须双改）
- `src/types.ts` / `src/Root.tsx` / `src/index.ts`
- `src/components/Subtitle.tsx`（CJK 宽度估算防溢出）/ `NarrationAudio.tsx` / `cards.tsx`
- `scripts/*.py` 薄包装、`remotion.config.ts`、`.npmrc`、`tsconfig.json`

**每集改写**：`package.json`（name）、`src/design/theme.ts`（本集色板）、`src/scenes/*`（全部重写）、`src/Main.tsx`（仅 import 与 SCENE_COMPONENTS 注册表）。

复用边界的原则（见 [../README.md](../README.md) 第四节）：Python 脚本集中 SSOT；**Remotion 原语复制适配不共享**——共享 TS 包会把一集的视觉改动泄漏进其他集。

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
3. 深底对比度：主色对 `#0E1116` 亮度比 ≥ 4.5:1；与已用色相错开（系列已用：蓝 #4A9EFF/橙 #FF9F45/金 #F5C542/青 #2DD4BF/紫 #B78CFF）。
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
