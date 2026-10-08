# Lottie 资产目录（设计师资产管线 · C 轨）

> 形状归 Lottie、文字归 Remotion——本目录只放**无文本、无表达式**的装饰强调资产，
> 由 `src/components/LottieEmphasis.tsx` 包装后在 beat 窗口内播放（经 `@remotion/lottie`
> 逐帧 goToAndStop 寻址，确定性渲染）。选型依据与机制证据见
> [动效建模与 Web 可视化搭建工具调研](../../../../../../../docs/research/video-production/160-video-motion-modeling-web-visual-tooling.md) §5.3。

## 资产来源声明

**`plug-pulse.json` 由脚本按仓内运动令牌生成**（同目录 `gen_plug_pulse.py`，可就地重跑；2026-09-05），
**不是** Cavalry / Jitter 等设计工具的导出物——本机未安装设计工具，且其登录需人工完成。

这不只是「没有更好选择时的替代」：Lottie 的关键帧切线本身就是贝塞尔控制点，
因此 `motion/tokens.ts` 的 **M3 缓动控制点可以逐字写进 JSON 的 `i`/`o` 字段**，
使本资产与全片 16 个动效模型**逐帧同源**，而非事后目测对齐。若日后换成设计工具
导出，缓动曲线是设计师现场手拉的，反而需要按 tokens 回校。

替换方式：**同名覆盖**即可（零代码改动），`LottieEmphasis` 的四条断言自动把关。

## 时序结构（全部落 `motion/tokens.ts` 令牌）

| 图层 | 动作 | 时长 | 缓动 |
|:---|:---|:---|:---|
| `pulse-ring-outer` | 26%→132% 扩散、透明度 78→0 | `DUR.f6` = 21f（700ms 幕级大动作） | M3 `decelerate` |
| `pulse-ring-inner` | 错峰起跳、22%→88% 回响 | 起于 `DUR.f2` = 3f，历时 `DUR.f5` = 12f | M3 `decelerate` |
| `check-draw` | trim path 描画对勾 | `DUR.f3`→`DUR.f3+DUR.f5`（5→17f，400ms 描线） | M3 `standard` |
| `check-draw` | 收束过冲 **109.5%** 落回 | `DUR.f4` = 7f（200ms 强调） | 取 `SPRING.snap` 的 ζ=0.6 → `overshootPeak` |
| 整体 | 淡出 | 末 `DUR.f3` = 5f | M3 `accelerate`（出场快于入场） |

过冲值 109.5% 与 P4「插头咬合」的 `useSpring('snap')` **同源同公式**
（`Mp = exp(-πζ/√(1-ζ²))`，由 `motion.test.ts` 钉死）——视觉上两者的弹性手感一致。

## 设计契约（LottieEmphasis 硬断言，违约即 cancelRender）

| 约束 | 状态 | 原因 |
|:---|:---:|:---|
| 顶层无 `fonts` 键、无 `chars` 数组 | ✅ | Lottie 文本双轨在无头渲染下均不可靠，文字一律留 Remotion |
| 无 `ty: 5` 文本图层 | ✅ | 同上 |
| 全树无属性级表达式 `"x"` 字符串键 | ✅ | 表达式经 goToAndStop 逐帧 seek 可能非确定性闪烁（官方明示无法上游修复） |
| 单色 `#64C4C0`（theme.mech） | ✅ 三层描边同色 | 三色契约：mech = 可插拔机制语义。**维护债**：颜色硬编码于 JSON，theme.ts 改色时本资产不同步 |
| 96×96 / 30fps / 24 帧（0.8s） | ✅ | 与 beat 时长粒度同档，远短于 P4 4-C 的 beat 窗口 |

## 接入点

`src/scenes/P4Hooks.tsx` `PullOut`（4-C 插头咬合）：`plugAt + 6` 触发，
锚定环右上「工具执行之前」插口节点（中心 `190+218·cos/sin(-20°)`）。
