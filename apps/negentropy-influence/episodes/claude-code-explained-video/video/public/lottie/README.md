# Lottie 资产目录（设计师资产管线 · C 轨）

> 形状归 Lottie、文字归 Remotion——本目录只放**无文本、无表达式**的装饰强调资产，
> 由 `src/components/LottieEmphasis.tsx` 包装后在 beat 窗口内播放（经 `@remotion/lottie`
> 逐帧 goToAndStop 寻址，确定性渲染）。选型依据与机制证据见
> [动效建模与 Web 可视化搭建工具调研](../../../../../../../docs/research/video-production/160-video-motion-modeling-web-visual-tooling.md) §5.3。

## ⚠️ 占位资产声明

**`plug-pulse.json` 是手工编写的最小 JSON**（2026-09 A/C 轨改造时为打通管线临时手绘），
**不是** Cavalry/Jitter 的真实设计导出。正式使用前须以设计工具导出**同名替换**
（文件名不变即零代码改动，LottieEmphasis 的结构断言自动把关）。

## 设计契约（LottieEmphasis 硬断言，违约即 cancelRender）

| 约束 | 原因 |
|:---|:---|
| 顶层无 `fonts` 键、无 `chars` 数组 | Lottie 文本双轨（字体引用/字形轮廓）在无头渲染下均不可靠，文字一律留 Remotion |
| 无 `ty: 5` 文本图层 | 同上 |
| 全树无属性级表达式 `"x"` 字符串键 | 表达式经 goToAndStop 逐帧 seek 可能非确定性闪烁（官方明示无法上游修复） |
| 单色 `#64C4C0`（theme.mech） | 三色契约：mech=可插拔机制语义。**维护债**：颜色硬编码于 JSON，theme.ts 改色时本资产不同步 |
| 24 帧 @30fps（0.8s） | 与既有 beat 时长粒度同档（P4 4-C 咬合点），远短于 beat 窗口 |

## 接入点

`src/scenes/P4Hooks.tsx` `PullOut`（4-C 插头咬合）：`plugAt + 6` 触发，替换原 2 帧布尔闪。
