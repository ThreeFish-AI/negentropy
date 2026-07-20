"""patrol_verify_fidelity — PDF Fidelity Patrol 客观验证命令（Routine.verification_command）。

被 RoutineEvaluator 的门控（``_run_gate``）在 worktree 内执行，退出码锚定 Judge 评分：
退出码 0 = 文档经客观验证全绿（每页文本 distinctive-token 覆盖达标 + 每图资产可达 200），
非 0 = 存在客观缺陷或环境异常。

客观口径（无视觉主观）：
1. 取生产 markdown_content（= wiki 渲染源）+ img alt 图注 → 归一化语料 token 集。
2. 每页 PDF distinctive token（len>4）覆盖率 ≥ ``--text-thr``（默认 0.85）。
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
    cset = set(_norm(md + " " + " ".join(alts)).split())
    corpus_id = doc.get("corpus_id")

    # 2) 每页文本 distinctive-token 覆盖
    import fitz  # PyMuPDF  # noqa: PLC0415

    def _figure_coverage_ratio(pg) -> float:
        """页内光栅图+矢量绘图面积占比（>0.5 判为图主导页）。

        整页 figure（如多子图流水线图）的文字几乎全是图内标签/图注，由 image
        维度覆盖、不应套用文本 token 覆盖率阈值（否则验证器对图主导页恒误报）。
        """
        page_area = pg.rect.width * pg.rect.height
        if page_area <= 0:
            return 0.0
        area = 0.0
        for info in pg.get_image_info():
            b = info.get("bbox")
            if b:
                area += (b[2] - b[0]) * (b[3] - b[1])
        for dr in pg.get_drawings():
            r = dr.get("rect")
            if r:
                area += (r[2] - r[0]) * (r[3] - r[1])
        return min(area, page_area) / page_area

    low: list[tuple[int, float]] = []
    figure_pages: list[int] = []
    with fitz.open(args.pdf) as d:
        n_pages = d.page_count
        for i, pg in enumerate(d, start=1):
            toks = {t for t in _norm(pg.get_text("text")).split() if len(t) > 4}
            if not toks:  # 纯图页（由 image 维度覆盖）
                continue
            if _figure_coverage_ratio(pg) > 0.5:
                # 图主导页：文字为图内标签/图注，由 image 维度覆盖
                figure_pages.append(i)
                continue
            cov = len(toks & cset) / len(toks)
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

    def _asset_reachable(fn: str) -> bool:
        # 巡检文档可能未发布到 wiki publication（wiki 资产端点的
        # WikiPublicationEntry 授权 join 会 404），但资产字节已落
        # derived/{doc}/assets/（refresh_markdown 持久化）。先探 wiki 公开端点
        # （已发布文档命中），回退 corpus base 端点（无发布要求、同源 bytea）；
        # 二者皆非 200 才判不可达。
        if (
            _http_code(
                f"{args.backend}/knowledge/wiki/documents/{args.doc_id}/assets/{fn}"
            )
            == 200
        ):
            return True
        if corpus_id:
            return (
                _http_code(
                    f"{args.backend}/knowledge/base/{corpus_id}/documents/{args.doc_id}/assets/{fn}"
                )
                == 200
            )
        return False

    bad_imgs = [fn for fn in fns if not _asset_reachable(fn)]
    if bad_imgs:
        fails.append(f"asset_not_200: {bad_imgs}")

    print(
        f"pages={n_pages} text_thr={args.text_thr} low_cov={low} figure_pages={figure_pages}"
    )
    print(f"images={len(fns)} asset_not_200={bad_imgs}")
    print(f"FAILS={fails}")
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
