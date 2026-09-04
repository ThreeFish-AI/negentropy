# HyperFrames PoC 结论（B 轨 · 2026-09-04）

> 调研依据：[动效建模与 Web 可视化搭建工具调研](../../../../../docs/research/video-production/160-video-motion-modeling-web-visual-tooling.md) §5.1 / §8.2（四关验收）。
> 范围：本集 P0 开场「层栈落板」的 3–5 句垂直切片（p0-01…p0-04 真实口播文案）。
> **一句话裁决：四关中的确定性渲染、CJK 排版、时序自动重定时三关在本机全数打通；audio-first 通道 A（duration-less 媒体探测）未测（需真实 TTS 音频，IndexTTS 服务不在本沙箱）。HyperFrames 具备作为第二管线的现实可行性，残余未知集中在音频链路。**

## 环境与工具

| 项 | 值 |
|:---|:---|
| hyperframes | 0.8.27（npx 钉版，Apache-2.0） |
| Node | v24.14.0（满足 >=22） |
| 本机 | Apple M4 / 24GB / macOS（与现役渲染主机同型） |
| ffmpeg 状况 | 系统无 ffmpeg；hyperframes 明确要求 PATH 上有 FFmpeg/FFprobe（doctor 实测） |

## 试跑序列与结果（全部命令可复现）

| # | 命令 | 结果 | 结论 |
|:---|:---|:---|:---|
| 1 | `npx -y hyperframes@0.8.27 doctor` | Node/CPU/内存/磁盘全绿；**FFmpeg/FFprobe 缺失**（whisper-cpp/Kokoro/MusicGen 为可选项缺失，不影响渲染） | 唯一硬阻塞 = ffmpeg |
| 2 | `lint .` | 首轮 2 error（`timeline_id_mismatch`：camelCase 重复键；`font_family_without_font_face`：PingFang SC/SF Mono 无 @font-face）+ 3 warning → 修复后 **0 error / 1 warning**（track 密度建议，5 板同组属刻意） | linter 的报错即修复指引，agent 友好性属实 |
| 3 | `snapshot --at 2,5,15 .` | **成功**出 3 帧 + contact sheet（`snapshots/`）；字体告警 PingFang SC/SF Mono 加载失败 → 回退字体渲染，CJK 字形/断行/标点目检正常 | 确定性抽帧管线可用；ANGLE 硬件渲染探明（`browserGpuMode probe → hardware (ANGLE Apple M4)`） |
| 4 | `render -c index.html -o out/poc-p0.mp4 --fps 30 --crf 18` | 失败：`FFmpeg not found`（如预期） | — |
| 5 | PATH 前置 Remotion 自带 ffmpeg 目录重试 | 失败：hyperframes 以自身 cwd 调起二进制 → dyld 找不到 libavdevice.dylib（Remotion 自己是带正确 cwd 调用的，所以现役管线无此问题）；DYLD_LIBRARY_PATH 直调可用但被子进程环境清洗丢弃 | workaround 需 shim（见下） |
| 6 | **两行 shell shim**（cd 进二进制目录再 exec）后重试 | ✅ **渲染成功**：441 帧 / 14.7s / 17.8s 完成，`captureMode: beginframe`（文档承诺的原子逐帧捕获） | 产物 `out/poc-p0.mp4`（gitignored） |
| 7 | ffprobe 产物 | `h264 / 1920×1080 / yuv420p / 30fps / 14.7s` | **与现役交付硬化规格逐项一致**（CRF 交付档默认即 18） |
| 8 | **重定时往返**：缩退时点 14s→16s（sed 一处）重渲 | 日志 `duration resolved: durationSeconds: 16.7, totalFrames: 501`（改前 441）；产物 16.7s | **「改一处时点 → 总帧数自动重算、零手工对轨」实证成立**——audio-first 的 GSAP 时间线等价物（通道 B probe 求值） |

### ffmpeg shim（复用 Remotion 自带二进制，非新装系统软件）

```bash
FFDIR=$(dirname "$(find video/node_modules/.pnpm -path "*compositor-darwin-arm64*/ffmpeg" -type f | head -1)")
mkdir -p .bin
printf '#!/bin/bash\ncd "%s" && exec "./ffmpeg" "$@"\n'  "$FFDIR" > .bin/ffmpeg
printf '#!/bin/bash\ncd "%s" && exec "./ffprobe" "$@"\n' "$FFDIR" > .bin/ffprobe
chmod +x .bin/ffmpeg .bin/ffprobe
PATH="$PWD/.bin:$PATH" npx -y hyperframes@0.8.27 render -c index.html -o out/poc-p0.mp4 --fps 30 --crf 18
```

（shim 含本机 pnpm store 绝对路径，不入库——按上述命令现场重建。）

## 实测要点（对调研文档 D1 深评的回验）

- **HTML+GSAP 契约**：`data-composition-id/data-width/data-height` 根元素 + clip 的 `data-start/data-duration/data-track-index` + `window.__timelines['<composition-id>']`（paused timeline 全用 fromTo）——文档原文与实现一致，linter 逐条对账。
- **确定性**：同一 HTML 两次渲染逐帧 beginframe 捕获；snapshot 与成片抽帧画面一致（见 `frame-at-10s.png` vs `snapshots/frame-01-at-5s.png`）。禁 rAF/墙钟的确定性设计未被本次试跑打破。
- **总时长模型**：clip 窗口并集与 GSAP timeline 总时长取大者——本次 timeline（缩退末点 14.7s）主导，clip（18s）未触发截断警告；重定时演示确认 timeline 改动即时反映到 totalFrames。
- **CJK**：linter 强制 @font-face 声明（`src: local('PingFang SC')` 即满足 lint），但 headless Chrome 的 local() 解析失败告警（Fonts FAILED）→ 回退字体渲染正常。**正式采用时须走编译期内嵌字体路线**（调研文档 §5.1 门 b 的结论不变：Noto Sans SC 子集内嵌 + 对照排版验收）。
- **可选件缺失无害**：whisper-cpp/Kokoro/MusicGen 缺失只降级转写/本地语音/BGM 能力，不阻塞渲染。

## 未测项（残余未知）

1. **audio-first 通道 A**（duration-less `<audio>` 编译期 ffprobe 实测回填）：需真实逐句音频；IndexTTS（localhost:8766）不在本沙箱。shim ffprobe 就位后该通道大概率可用，待 TTS 可达后补测。
2. **成片级中文排版验收**：回退字体 ≠ PingFang 字形；须按四关验收第②关做 Noto Sans SC 内嵌 + 对照排版 diff。
3. **与现役 QA 的对拍**：本切片无 Remotion 对照版（非同 manifest 同帧号），`qa_frames --compare` 留待正式试点。

## 建议下一步

1. TTS 可达后：补 `poc-p0-audio.html` duration-less 音频切片 → 通道 A 实测 → 四关验收收口。
2. 若采纳：EP2–5 之外**新集**先行 HyperFrames 平行（存量 8 集不动，调研文档 §6.2 口径）；CI 需装系统 ffmpeg（shim 仅本机过渡方案）。
3. `render --docker`（钉死 Chromium/字体/编码器）值得作为跨机复现的首选路径试跑。
