"""HTTP Range / 条件请求决策助手（RFC 9110/7233）。

为「字节源自 PostgreSQL ``bytea``、非磁盘文件」的下载/预览端点补齐 Starlette
``FileResponse`` 未暴露的范围决策能力：解析 ``Range`` / ``If-Range`` /
``If-None-Match`` / ``If-Modified-Since``，裁决 ``200 / 206 / 304 / 416`` 并产出
对应响应头。本模块为**纯函数、无 DB 依赖**，可脱库单测；实际字节读取与传输由
调用方（路由层 + 存储层 ``substring`` 部分读）完成，机制与策略正交。

设计取舍：

- **强 ETag**：原文按 ``file_hash``（SHA-256）内容寻址，使用强校验器
  ``"{file_hash}"``，令 ``If-None-Match`` / ``If-Range`` 判定精确。
- **单段 Range**：仅支持单段 ``bytes=`` 区间；多段逗号 Range **退化为 200 全量**
  （规避 ``multipart/byteranges`` 复杂度，浏览器原生 PDF 查看器对此退化兼容良好）。
- **条件优先级**：``If-None-Match`` 优先于 ``If-Modified-Since``（RFC 9110 §13.2.2）。
- **越界裁剪**：``end`` 超出 EOF 时裁剪到 ``total-1``（返回可用部分），仅当
  ``start >= total`` 才判 416（RFC 9110 §14.1.2）。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from email.utils import format_datetime, parsedate_to_datetime

__all__ = [
    "RangeSpec",
    "RangeDecision",
    "build_etag",
    "http_date",
    "decide_range_response",
]


@dataclass(frozen=True)
class RangeSpec:
    """206 响应需读取的字节切片（``start`` 0-based，闭区间长度为 ``length``）。"""

    start: int
    """0-based 起始偏移（含）。"""
    length: int
    """切片字节数（恒 > 0）。"""
    total: int
    """资源总字节数。"""


@dataclass(frozen=True)
class RangeDecision:
    """范围 / 条件请求裁决结果。"""

    status_code: int
    """``200`` | ``206`` | ``304`` | ``416``。"""
    headers: dict[str, str]
    """该响应应携带的头部（已含 ``Accept-Ranges`` / ``ETag`` 等）。"""
    spec: RangeSpec | None
    """仅 ``206`` 时非空，指示调用方需读取的字节切片。"""
    is_full: bool
    """``True`` 表示调用方应回整份资源（``200``）。"""


def build_etag(file_hash: str) -> str:
    """由内容哈希构造强 ETag（带双引号）。"""
    return f'"{file_hash}"'


def http_date(dt: datetime) -> str:
    """格式化为 RFC 1123 HTTP-date（GMT）。"""
    return format_datetime(dt, usegmt=True)


def _normalize_etag(token: str) -> str:
    """去除空白与 ``W/`` 弱校验前缀，便于按值比较。"""
    return token.strip().removeprefix("W/").strip()


def _etag_matches(if_none_match: str, etag: str) -> bool:
    """``If-None-Match`` 是否命中：支持 ``*`` 与逗号分隔列表，按值比较。"""
    candidate = if_none_match.strip()
    if candidate == "*":
        return True
    target = _normalize_etag(etag)
    return any(tok and _normalize_etag(tok) == target for tok in candidate.split(","))


def _safe_parse_http_date(value: str) -> datetime | None:
    """宽松解析 HTTP-date；非法/缺失返回 ``None``（保守地不触发 304）。"""
    try:
        dt = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    return dt


def _parse_range_header(range_header: str, total: int) -> tuple[int, int] | str:
    """解析单段 ``bytes=`` Range。

    Returns:
        - ``(start, end)``：可满足的闭区间（``end`` 已裁剪到 ``total-1``）。
        - ``"ignore"``：非 ``bytes=`` / 多段 / 语法非法 → 调用方应回 200 全量。
        - ``"unsatisfiable"``：语法合法但越界 → 调用方应回 416。
    """
    value = range_header.strip()
    prefix = "bytes="
    if not value.lower().startswith(prefix):
        return "ignore"
    spec = value[len(prefix) :].strip()
    if "," in spec:  # 多段 Range：退化为 200 全量
        return "ignore"
    if "-" not in spec:
        return "ignore"

    start_s, _, end_s = spec.partition("-")
    start_s, end_s = start_s.strip(), end_s.strip()
    try:
        if start_s == "":
            # 后缀区间 ``-N``：末尾 N 字节
            if end_s == "":
                return "ignore"
            suffix = int(end_s)
            if suffix <= 0 or total == 0:
                return "unsatisfiable"
            start = 0 if suffix >= total else total - suffix
            return (start, total - 1)

        start = int(start_s)
        if start < 0:
            return "ignore"
        if total == 0 or start >= total:
            return "unsatisfiable"
        if end_s == "":
            return (start, total - 1)
        end = int(end_s)
        if end < start:
            return "ignore"  # 非法区间，忽略 → 200 全量
        return (start, min(end, total - 1))
    except ValueError:
        return "ignore"


def decide_range_response(
    *,
    total_size: int,
    etag: str,
    last_modified: datetime,
    cache_control: str,
    content_type: str,
    range_header: str | None,
    if_range: str | None,
    if_none_match: str | None,
    if_modified_since: str | None,
    enable_range: bool = True,
) -> RangeDecision:
    """裁决一次下载/预览请求应返回 200 / 206 / 304 / 416 及其响应头。

    Args:
        total_size: 资源总字节数（来自 ``file_size`` / blob ``size``）。
        etag: 强 ETag（``build_etag(file_hash)``）。
        last_modified: 资源最后修改时间（tz-aware）。
        cache_control: ``Cache-Control`` 头值。
        content_type: 资源 MIME。
        range_header / if_range / if_none_match / if_modified_since: 对应请求头原值。
        enable_range: 是否启用 Range（206）。``False`` 时不声明 ``Accept-Ranges``、
            忽略任何 ``Range`` / ``If-Range`` 统一回 200 全量；条件 304 仍照常生效。
            用于「非线性化 PDF 关闭 Range、仅保留缓存」以规避 range 风暴拖慢首屏。

    Returns:
        :class:`RangeDecision`。调用方据 ``status_code`` 分发：304/416 回空 body；
        ``is_full`` 回整份；``spec`` 非空时读取切片回 206。
    """
    base_headers: dict[str, str] = {
        "ETag": etag,
        "Last-Modified": http_date(last_modified),
        "Cache-Control": cache_control,
        "Content-Type": content_type,
    }
    # 仅在启用 Range 时声明 Accept-Ranges：否则浏览器原生查看器不会切到范围模式，
    # 对非线性化 PDF 即回退为「单次顺序下载」，避免分块往返风暴拖慢首屏。
    if enable_range:
        base_headers["Accept-Ranges"] = "bytes"

    # 1) 条件 GET：If-None-Match 优先于 If-Modified-Since（RFC 9110 §13.2.2）。
    #    无论是否启用 Range，条件缓存都生效——这是「二次打开快」的来源。
    not_modified = False
    if if_none_match is not None:
        not_modified = _etag_matches(if_none_match, etag)
    elif if_modified_since is not None:
        ims = _safe_parse_http_date(if_modified_since)
        if ims is not None:
            try:
                not_modified = last_modified.replace(microsecond=0) <= ims
            except TypeError:
                # naive/aware 混比等异常：保守地不触发 304。
                not_modified = False
    if not_modified:
        # 304：无 body、无 Content-Length / Content-Range。
        return RangeDecision(304, dict(base_headers), spec=None, is_full=False)

    def full_200() -> RangeDecision:
        headers = dict(base_headers)
        headers["Content-Length"] = str(total_size)
        return RangeDecision(200, headers, spec=None, is_full=True)

    # 2) Range 关闭（如非线性化 PDF）：忽略 Range / If-Range，统一回 200 全量。
    if not enable_range:
        return full_200()

    # 3) 无 Range（或语法不可解析）→ 200 全量。
    if not range_header:
        return full_200()

    # 4) If-Range：存在且与当前强 ETag 不匹配 → 忽略 Range，回 200 全量。
    #    （If-Range 亦可为 HTTP-date 形态；此处仅认强 ETag，其余一律保守回 200，
    #    不影响正确性，仅放弃该次 Range 优化。）
    if if_range is not None and _normalize_etag(if_range) != _normalize_etag(etag):
        return full_200()

    parsed = _parse_range_header(range_header, total_size)
    if parsed == "ignore":
        return full_200()
    if parsed == "unsatisfiable":
        headers = dict(base_headers)
        headers["Content-Range"] = f"bytes */{total_size}"
        return RangeDecision(416, headers, spec=None, is_full=False)

    start, end = parsed  # type: ignore[misc]  # 此处必为 (int, int)
    length = end - start + 1
    headers = dict(base_headers)
    headers["Content-Range"] = f"bytes {start}-{end}/{total_size}"
    headers["Content-Length"] = str(length)
    return RangeDecision(
        206,
        headers,
        spec=RangeSpec(start=start, length=length, total=total_size),
        is_full=False,
    )
