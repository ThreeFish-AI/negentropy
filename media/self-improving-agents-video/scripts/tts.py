#!/usr/bin/env python3
"""逐句合成配音并产出时长 manifest。

- 输入：script/narration.json（单一事实源派生）
- 输出：video/public/audio/{id}.mp3 + video/public/audio/manifest.json
- 引擎：edge-tts（免密钥）；每句一个文件，幂等（文本未变则跳过）。

用法：uv run --no-project --with edge-tts --with mutagen scripts/tts.py [--force]
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import sys
from pathlib import Path

import edge_tts
from mutagen.mp3 import MP3

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "script" / "narration.json"
OUT_DIR = ROOT / "video" / "public" / "audio"

VOICE = "zh-CN-YunxiNeural"
RATE = "+4%"
CONCURRENCY = 6
RETRIES = 4


def tts_text(text: str) -> str:
    """口播文本微调：破折号换为逗号停顿，避免 TTS 念成怪音。"""
    return text.replace("——", "，").replace("……", "。")


async def synth_one(sem: asyncio.Semaphore, item: dict, force: bool) -> dict:
    sid, text = item["id"], item["text"]
    mp3 = OUT_DIR / f"{sid}.mp3"
    meta = OUT_DIR / f"{sid}.sha"
    digest = hashlib.sha1(f"{VOICE}|{RATE}|{text}".encode()).hexdigest()

    if not force and mp3.exists() and mp3.stat().st_size > 0 and meta.exists() and meta.read_text() == digest:
        pass
    else:
        async with sem:
            last_err: Exception | None = None
            for attempt in range(RETRIES):
                try:
                    communicate = edge_tts.Communicate(tts_text(text), VOICE, rate=RATE)
                    await communicate.save(str(mp3))
                    if mp3.stat().st_size == 0:
                        raise RuntimeError("空音频文件")
                    meta.write_text(digest)
                    break
                except Exception as e:  # noqa: BLE001 - 网络服务需要整体重试
                    last_err = e
                    await asyncio.sleep(1.5 * (attempt + 1))
            else:
                raise RuntimeError(f"{sid} 合成失败: {last_err}")

    duration = MP3(str(mp3)).info.length
    return {**item, "durationSec": round(duration, 3)}


async def main() -> None:
    force = "--force" in sys.argv
    items = json.loads(SRC.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(CONCURRENCY)
    results = await asyncio.gather(*(synth_one(sem, i, force) for i in items))

    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(
        json.dumps(results, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    total = sum(r["durationSec"] for r in results)
    print(f"合成 {len(results)} 句，纯语音总时长 {total / 60:.2f} 分钟")
    print(f"manifest: {manifest_path}")


if __name__ == "__main__":
    asyncio.run(main())
