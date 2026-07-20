"""patrol_verify_fidelity — PDF Fidelity Patrol 客观验证命令（Routine.verification_command）。

被 RoutineEvaluator 的门控（``_run_gate``）在 worktree 内执行，退出码锚定 Judge 评分：
退出码 0 = 文档经客观验证全绿（每页文本 distinctive-token 覆盖达标 + 每图资产可达 200），
非 0 = 存在客观缺陷或环境异常。

客观口径（无视觉主观）：
1. 取生产 markdown_content（= wiki 渲染源）+ img alt 图注 → 去空白归一化语料。
2. 每页 PDF distinctive token（len>4）在语料中**子串存在**的覆盖率 ≥ ``--text-thr``（默认 0.85）。
   子串匹配（CJK 空格鲁棒）：PDF 与 markdown 的 CJK 分词边界常因抽取空格/换行 artifact 不一致，
   exact-token 集合匹配会假阴性；改查 token 字符在去空白语料中是否连续出现，消除边界差异，
   仍能正确捕获真实内容缺失（图内烘文字、整段漏抽）。
3. 每个 figure 资产经后端 ``/knowledge/wiki/documents/{doc}/assets/{file}`` HTTP 200。

CLI::

    python -m negentropy.perceives.tools.patrol_verify_fidelity \\
        --doc-id <uuid> --pdf /tmp/.../source.pdf [--backend http://127.0.0.1:3292]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request

_TEXT_THR_DEFAULT = 0.85


def _norm(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"<img[^>]*>", " ", s)
    s = re.sub(r"[^a-z0-9一-鿿]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _norm_nospace(s: str) -> str:
    """CJK 空格鲁棒归一：去 ``<img>``、小写、移除**所有**分隔符（含空格/换行/标点）。

    供 distinctive-token **子串匹配**用。PDF（PyMuPDF）与 markdown（docling）对 CJK
    文本的分词边界常不一致——任一方都可能在 CJK 字符间插入空格/换行，使 ``_norm`` 产生的
    token 边界不同。exact-token 集合匹配会因此产生大量假阴性（内容实存但边界不同即判缺失）。
    改在去空白语料上做子串匹配：page distinctive token 的字符连续出现在 markdown 中即视为
    覆盖，仍能正确捕获真实内容缺失（图内烘文字、整段漏抽）。实测 308 页中文图书：exact 仅
    61 页过 0.85，子串匹配 292 页过——内容确在；余下 16 页为真实图内文字缺失。
    """
    s = (s or "").lower()
    s = re.sub(r"<img[^>]*>", " ", s)
    return re.sub(r"[^a-z0-9一-鿿]+", "", s)


def _http_code(url: str, timeout: int = 5) -> int:
    try:
        return urllib.request.urlopen(url, timeout=timeout).getcode()
    except Exception as e:  # noqa: BLE001 - 任意异常都转退出码
        return getattr(e, "code", 0) or 0


def main() -> int:
    ap = argparse.ArgumentParser(prog="patrol_verify_fidelity")
    ap.add_argument("--doc-id", required=True)
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--backend", default="http://127.0.0.1:3292")
    ap.add_argument("--text-thr", type=float, default=_TEXT_THR_DEFAULT)
    args = ap.parse_args()

    fails: list[str] = []

    # 1) 取生产 markdown_content（wiki 忠实渲染它）
    try:
        with urllib.request.urlopen(
            f"{args.backend}/knowledge/documents/{args.doc_id}", timeout=10
        ) as r:
            doc = json.load(r)
        md = doc.get("markdown_content") or ""
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: backend markdown fetch error: {e!r}")
        return 1
    if not md.strip():
        print("FAIL: empty markdown_content")
        return 1

    alts = re.findall(r'<img\b[^>]*?alt=["\']([^"\']+)["\']', md, re.I)
    # CJK 空格鲁棒：PDF（PyMuPDF）与 markdown（docling）的 CJK 分词边界常不一致
    # （空格/换行 artifact），exact-token 集合匹配会假阴性。改在去空白语料上做子串匹配——
    # page distinctive token 的字符连续出现在 markdown 中即覆盖（见 _norm_nospace）。
    md_nospace = _norm_nospace(md + " " + " ".join(alts))

    # 2) 每页文本 distinctive-token 覆盖（CJK 空格鲁棒子串匹配）
    import fitz  # PyMuPDF  # noqa: PLC0415

    low: list[tuple[int, float]] = []
    with fitz.open(args.pdf) as d:
        n_pages = d.page_count
        for i, pg in enumerate(d, start=1):
            toks = {t for t in _norm(pg.get_text("text")).split() if len(t) > 4}
            if not toks:  # 纯图页（由 image 维度覆盖）
                continue
            cov = sum(1 for t in toks if t in md_nospace) / len(toks)
            if cov < args.text_thr:
                low.append((i, round(cov, 3)))
    if low:
        fails.append(f"text_cov_below_{args.text_thr}: {low}")

    # 3) 每个 figure 资产后端可达 200
    fns = sorted(
        {
            re.sub(r".*/", "", m)
            for m in re.findall(r'src=["\']([^"\']*fig_p\d+_\d+\.png)["\']', md)
        }
    )
    bad_imgs = [
        fn
        for fn in fns
        if _http_code(
            f"{args.backend}/knowledge/wiki/documents/{args.doc_id}/assets/{fn}"
        )
        != 200
    ]
    if bad_imgs:
        fails.append(f"asset_not_200: {bad_imgs}")

    print(f"pages={n_pages} text_thr={args.text_thr} low_cov={low}")
    print(f"images={len(fns)} asset_not_200={bad_imgs}")
    print(f"FAILS={fails}")
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
