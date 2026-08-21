#!/usr/bin/env python3
"""从 narration.md 解析生成 narration.json（逐句：id/scene/text[/ttsText]）——公共管线版本。

narration.md 是单一事实源；本脚本是纯派生转换，不做任何内容改写。
适用于任何 `episodes/*-video/` 科普视频工程（目录约定见 pipeline/README.md）。

**发音标注的正交拆分**：逐字稿里可内联 `<原文|读音>` 标注（多音字/英文专名，语法见
[pron_marks.py](./pron_marks.py)）。本脚本据此派生两个字段：

  text     剥离标注后的**人读文本** —— 同时被字幕（captions.py）与时长预算
           （check_script.py）消费，因此绝不能含标注，否则标注会漏进 SRT/VTT
           并污染字数口径；
  ttsText  原始带标注文本，**仅当该句含标注时才写入** —— tts.py 优先取它送合成。

未标注的句子不产生 ttsText 字段，取值与历史完全一致 ⇒ 存量缓存摘要不失效。
标注本身携带原字，故一处书写即可派生两者，不存在两份副本漂移。

用法：uv run --no-project $R/build_narration.py --project $P
     工程内薄包装等价于：uv run --no-project scripts/build_narration.py
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from pron_marks import has_marks, load_vocab, strip_marks, validate

LINE_RE = re.compile(r"^- \[(?P<id>[a-z0-9-]+)\]\s+(?P<text>.+)$")
SCENE_RE = re.compile(r"^## (?P<scene>P\d+)\b")
FORMAT_DOC = "pipeline/README.md 第二节格式契约"

#: pinyin.vocab 在 index-tts checkout 内（不在本仓）。存在则用于 WARN 级「音节是否在表内」，
#: 缺失时格式类 ERROR 仍然生效（规则内联在 pron_marks.py，不依赖该文件）。
PINYIN_VOCAB = Path("~/tools/index-tts/checkpoints/pinyin.vocab").expanduser()


def main() -> None:
    parser = argparse.ArgumentParser(description="narration.md → narration.json")
    parser.add_argument("--project", default=".", help="视频工程根目录（含 script/）")
    args = parser.parse_args()

    root = Path(args.project).resolve()
    src = root / "script" / "narration.md"
    dst = root / "script" / "narration.json"

    # 与 tts.py 同口径的可操作退出（而非裸 FileNotFoundError 栈）
    if not src.is_file():
        sys.exit(f"narration.md 不存在: {src} —— 见 {FORMAT_DOC}")

    vocab = load_vocab(PINYIN_VOCAB)
    scene = ""
    items: list[dict[str, str]] = []
    seen: set[str] = set()
    mark_errors: list[str] = []
    mark_warnings: list[str] = []
    marked = 0
    for lineno, raw in enumerate(src.read_text(encoding="utf-8").splitlines(), 1):
        if m := SCENE_RE.match(raw):
            scene = m.group("scene")
            continue
        if m := LINE_RE.match(raw):
            sid, text = m.group("id"), m.group("text").strip()
            if not scene:
                # 幕名为空时下一条校验会报出「与所在幕  不一致」这种令人困惑的信息，
                # 故先明确指出真正的原因：首句之前缺 `## Pn` 标题。
                sys.exit(
                    f"{src}:{lineno} 句 {sid} 出现在任何 `## Pn` 分幕标题之前 —— 每句必须归属于某一幕，见 {FORMAT_DOC}"
                )
            if sid in seen:
                sys.exit(f"{src}:{lineno} 重复句 id: {sid}")
            if not sid.startswith(scene.lower() + "-"):
                sys.exit(
                    f"{src}:{lineno} 句 id {sid} 与所在幕 {scene} 不一致 —— "
                    f"句 id 必须以幕名小写为前缀（应为 {scene.lower()}-…）"
                )
            seen.add(sid)
            # 发音标注：先校验（标注错 = 必然读错，上游丢弃原字、无字形兜底），
            # 再派生「人读 text」与「送合成 ttsText」
            errs, warns = validate(text, vocab)
            mark_errors += [f"{src}:{lineno} 句 {sid} {e}" for e in errs]
            mark_warnings += [f"{src}:{lineno} 句 {sid} {w}" for w in warns]
            item: dict[str, str] = {
                "id": sid,
                "scene": scene,
                "text": strip_marks(text),
            }
            if has_marks(text):
                item["ttsText"] = text
                marked += 1
            items.append(item)

    for w in mark_warnings:
        print(f"WARN  {w}", file=sys.stderr)
    if mark_errors:
        # 与「重复句 id」「幕前置句」同口径硬失败：绝不产出一份带坏标注的 narration.json，
        # 否则会静默合成出读错音的整集（单槽位 mp3，事后只能靠听发现）
        for e in mark_errors:
            print(f"FAIL  {e}", file=sys.stderr)
        sys.exit(f"发音标注校验失败（{len(mark_errors)} 处）—— 语法见 $R/pron_marks.py")

    dst.write_text(
        json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    total_chars = sum(len(i["text"]) for i in items)
    per_scene: dict[str, int] = {}
    for i in items:
        per_scene[i["scene"]] = per_scene.get(i["scene"], 0) + 1
    print(f"句数: {len(items)}  总字数: {total_chars}")
    print(f"各幕句数: {per_scene}")
    print(f"估算时长(280字/分): {total_chars / 280:.1f} 分钟")
    if marked:
        print(
            f"发音标注: {marked} 句带 ttsText（字数与字幕仍取剥离后的 text）"
            + ("" if vocab else "；未找到 pinyin.vocab，已跳过「音节是否在表内」告警")
        )


if __name__ == "__main__":
    main()
