# voices/ · 参考音色样本目录

本目录存放**声音克隆**用的参考音色样本（个人录音），供 `scripts/tts.py --engine indextts --ref ...` 使用。

## 录制要求

| 项 | 要求 | 原因 |
|---|---|---|
| 时长 | **5–15 秒**（最长不超过 30s） | 过长不提升克隆质量，反而拖慢每句合成的条件提取 |
| 内容 | 自然说话，与目标成片语速/语调一致 | 克隆音色+韵律风格均取自样本 |
| 环境 | 安静房间、单一麦克风距离、无背景音乐/混响/降噪痕迹 | 噪声会被一起克隆进音色 |
| 说话人 | **仅本人一人** | 多人声混杂会污染音色 |
| 格式 | WAV 16-bit（≥22.05 kHz）优先；mp3/flac 可先经 `prepare_ref.py` 转换；m4a 需先 `ffmpeg -i in.m4a out.wav` | IndexTTS 内部会重采样，但干净源更稳 |

## 使用方式

```bash
# 0) 长录音里挑哪一段？先按客观指标筛候选（F0/起伏/音节率/谱质心）：
uv run --no-project --with soundfile --with numpy media/pipeline/scripts/prospect_ref.py \
    ~/Documents/dify/me-1.mp3 --window 12

# 1) 裁剪并规范化（当前推荐档：me-1.mp3 的 [0.36s, 12.36s)，sunny 风格即在此样本上定档）：
uv run --no-project --with soundfile media/pipeline/scripts/prepare_ref.py \
    ~/Documents/dify/me-1.mp3 --start 0.36 --duration 12 \
    --out media/pipeline/voices/me-bright.wav

# 2) 先用单句小样试听择优（不需要视频工程）：
uv run --no-project --with mutagen media/pipeline/scripts/tts_sample.py \
    --ref media/pipeline/voices/me-bright.wav --all-styles --play

# 3) 定稿后全量合成：
uv run --no-project --with mutagen media/pipeline/scripts/tts.py \
    --project media/<工程> --engine indextts \
    --ref media/pipeline/voices/me-bright.wav --style sunny
```

**样本决定基线**：克隆会连韵律一起继承，样本比参数更关键——同一位说话人换一段录音，克隆音的音高可差 12~16%、语调起伏差 25~40%（实测见 [VOICE-CLONING.md](../VOICE-CLONING.md) §3.3）。

## 隐私提醒

个人声音属于生物特征信息。**本目录下的音频文件已被根 `.gitignore` 忽略，不会提交入库**；请勿通过其它途径（聊天工具/公开仓库）传播克隆源音频。克隆他人声音需获得本人书面同意，见 [VOICE-CLONING.md](../VOICE-CLONING.md) §八 许可。
