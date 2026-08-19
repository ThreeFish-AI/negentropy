# Stage ⑨ 终渲与交付（skill 规格 · 09）

> 前置：Stage ⑧ 的自动体检零 FAIL 且人工目检通过；文稿与音频已冻结（B 遍完成）。

## 终渲

```bash
# 1)（每台渲染主机一次）定并发——写死进共享配置是要消灭的漂移类型，故走 CLI：
cd media/<slug>-video/video && ./node_modules/.bin/remotion benchmark
# 2) 终渲（codec/crf/pixel-format/audio 已固化在 remotion.config.ts；覆盖项只留 --concurrency）
./node_modules/.bin/remotion render Main ../out/final.mp4 --concurrency=<benchmark 建议值>
```

渲染主机约束：**macOS + PingFang SC/Songti SC/SF Mono 系统字体**（三集未内嵌 CJK 字体，Linux/CI 渲染不在支持范围；重启触发器见 pipeline/README「字体可复现性」——渲染迁 Linux/CI，或 Remotion 5.0 将 validateFontIsLoaded 默认翻 true 时必须内嵌子集字体）。

## 交付件清单

```bash
# 字幕（B 站/YouTube 上传件；cue 终点不含句间停顿——外挂字幕静默期不留字）
uv run --no-project media/pipeline/scripts/captions.py --project media/<slug>-video
```

- [ ] `out/final.mp4`（1080p30，h264/aac192K；`remotion ffmpeg -i` 核流摘要）
- [ ] `out/captions.srt` + `out/captions.vtt`
- [ ] 封面帧（可从 `qa_frames.py` 挑一张标题卡帧，或 `remotion still` 单渲）
- [ ] 全片逐幕抽帧复检 + `--last-n 6 --check`（时长在 B 遍后又位移过，勿复用 A 遍结论）
- [ ] `pipeline.py check` 实测口径在预算窗内

## 平台合规（发布前自查）

- 合成语音标注：B 站/YouTube 对 AI 合成语音有披露要求，按平台当期规则标注；
- 许可：Remotion（>3 人公司需商业授权）；IndexTTS-2.5（bilibili 模型许可，个人/研究可用，商用联系 indexspeech@bilibili.com）——详见 [pipeline/README §八](../README.md)；
- 声音克隆仅为本人自愿克隆；克隆他人声音须书面同意（[VOICE-CLONING.md §八](../VOICE-CLONING.md)）。
