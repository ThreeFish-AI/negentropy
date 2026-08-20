#!/usr/bin/env python3
"""参考音色样本可复现清单——不存音频，只存「怎么造出来的」与指纹。

背景：voices/ 目录因生物特征隐私整目录 gitignore，导致「官方」样本参数与
sha1 只活在文档散文里（me-bright.wav 的 54b699cce97f 散见 VOICE-CLONING.md
三处）。换机器/换源文件后无人能自证复现了同一个音色，而 sunny/sunny-steady
的 alpha 标定**因果地**依赖 me-bright 这个选段——复现错了，10 小时的成片
合成就在错误的音色上跑完。

本脚本 + voices/refs.toml（唯一入库文件，含 .gitignore 白名单例外）补上这条链：

    verify   重算盘上 WAV 指纹，对照清单报「一致 / 不一致 / 缺失」
    rebuild  按清单记录的参数转调 prepare_ref.py 重建样本，再自动 verify
    list     列出清单条目

用法（仓库根，零第三方依赖；rebuild 才需要 soundfile/numpy）：
    uv run --no-project media/pipeline/scripts/refs.py list
    uv run --no-project media/pipeline/scripts/refs.py verify [--name me-bright]
    uv run --no-project --with soundfile --with numpy media/pipeline/scripts/refs.py \
        rebuild --name me-bright
"""

from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
import tomllib
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
REFS_TOML = SCRIPTS_DIR.parent / "voices" / "refs.toml"
VOICES_DIR = REFS_TOML.parent
#: 源录音为本人私有文件，仅记录相对家目录路径占位；真实路径在清单里以 ~ 展开
PREPARE_REF = SCRIPTS_DIR / "prepare_ref.py"


def load_refs() -> dict:
    if not REFS_TOML.is_file():
        sys.exit(f"清单不存在: {REFS_TOML}")
    return tomllib.loads(REFS_TOML.read_text(encoding="utf-8"))


def digest(path: Path) -> tuple[str, str]:
    data = path.read_bytes()
    return hashlib.sha1(data).hexdigest()[:12], hashlib.sha256(data).hexdigest()


def cmd_list(refs: dict) -> None:
    print(f"清单：{REFS_TOML}")
    for name, r in refs.items():
        print(
            f"  {name:<10} {r['source']} --start {r['start']} --duration {r['duration']}"
            f"  sha1 {r['sha1']}  锁定风格 {','.join(r.get('locked_styles', []))}"
        )


def cmd_verify(refs: dict, args: argparse.Namespace) -> int:
    names = [args.name] if args.name else list(refs)
    failures = 0
    for name in names:
        r = refs.get(name)
        if r is None:
            print(f"❌ {name}: 清单无此条目")
            failures += 1
            continue
        wav = VOICES_DIR / f"{name}.wav"
        if not wav.is_file():
            print(
                f"⚠️  {name}: 盘上缺失（{wav}）——音频不入库属预期；需要时用 rebuild 重建后复验"
            )
            continue
        sha1, sha256 = digest(wav)
        if sha1 == r["sha1"]:
            print(f"✅ {name}: sha1 一致（{sha1}）")
        else:
            print(
                f"❌ {name}: sha1 不一致 —— 清单 {r['sha1']} vs 盘上 {sha1}\n"
                f"   源文件或重采样路径已变，勿在未核验音色上跑长合成；"
                f"若确为新样本，请更新 {REFS_TOML}"
            )
            failures += 1
            continue
        if r.get("sha256") and sha256 != r["sha256"]:
            print(f"❌ {name}: sha256 不一致（完整指纹，人工核对用）")
            failures += 1
    return failures


def cmd_rebuild(refs: dict, args: argparse.Namespace) -> int:
    r = refs.get(args.name)
    if r is None:
        print(f"❌ 清单无此条目: {args.name}")
        return 1
    source = Path(r["source"]).expanduser()
    if not source.is_file():
        sys.exit(
            f"源录音不存在: {source}\n  清单记录的是生成该样本时的源文件路径，请把本人录音放回该位置或更新清单"
        )
    cmd = [
        sys.executable,
        str(PREPARE_REF),
        str(source),
        "--start",
        str(r["start"]),
        "--duration",
        str(r["duration"]),
        "--out",
        str(VOICES_DIR / f"{args.name}.wav"),
    ]
    print(f">> 重建 {args.name}: {' '.join(cmd[1:])}")
    subprocess.run(cmd, check=True)
    return cmd_verify(refs, argparse.Namespace(name=args.name))


def main() -> None:
    ap = argparse.ArgumentParser(description="参考音色样本可复现清单")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list", help="列出清单条目")
    p = sub.add_parser("verify", help="核对盘上样本指纹")
    p.add_argument("--name", help="只核对指定样本（默认全部）")
    p = sub.add_parser("rebuild", help="按清单参数重建样本并复验")
    p.add_argument("--name", required=True, help="要重建的样本名")
    args = ap.parse_args()

    refs = load_refs()
    if args.cmd == "list":
        cmd_list(refs)
        return
    failures = {"verify": cmd_verify, "rebuild": cmd_rebuild}[args.cmd](refs, args)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
