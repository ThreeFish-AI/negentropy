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
# 长录音先裁剪（截取 10s–25s 的一段干净人声）：
uv run --no-project --with soundfile media/pipeline/scripts/prepare_ref.py \
    ~/Documents/dify/me-1.mp3 --start 10 --duration 15

# 合成时通过 --ref 指定：
uv run --no-project --with mutagen media/pipeline/scripts/tts.py \
    --project media/<工程> --engine indextts --ref media/pipeline/voices/me-1.wav --style lively
```

## 隐私提醒

个人声音属于生物特征信息。**本目录下的音频文件已被根 `.gitignore` 忽略，不会提交入库**；请勿通过其它途径（聊天工具/公开仓库）传播克隆源音频。克隆他人声音需获得本人书面同意，见 [VOICE-CLONING.md](../VOICE-CLONING.md) §八 许可。
