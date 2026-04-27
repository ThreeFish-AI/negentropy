from __future__ import annotations

import json
import tempfile
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.auth.service import AuthUser
from negentropy.logging import get_logger
from negentropy.models.plugin import McpServer, McpTool, McpToolRun, McpToolRunEvent, McpTrialAsset
from negentropy.storage.gcs_client import GCSStorageClient

from .mcp_client import McpClientService, McpResourceContent, McpToolCallResult

logger = get_logger("negentropy.interface.execution")

RUN_ORIGIN_TRIAL_UI = "trial_ui"
RUN_ORIGIN_KNOWLEDGE_EXTRACTION = "knowledge_extraction"
RUN_ORIGIN_SYSTEM = "system"


@dataclass
class ExecutionResult:
    run: McpToolRun
    events: list[McpToolRunEvent]
    call_result: McpToolCallResult
    # 同会话内拉取的动态资源（resource_link URI -> 资源载荷）。仅在调用方
    # 显式开启 ``resolve_resource_links`` 时才有数据；否则保持空字典。
    resolved_resources: dict[str, McpResourceContent] = field(default_factory=dict)
    # 资源拉取部分失败时的错误记录（uri -> error），不阻断主流程。
    resource_errors: dict[str, str] = field(default_factory=dict)


class McpToolExecutionService:
    """统一的 MCP Tool 执行与审计服务。"""

    def __init__(
        self,
        db: AsyncSession,
        *,
        client: McpClientService | None = None,
        gcs_client: GCSStorageClient | None = None,
    ) -> None:
        self._db = db
        self._client = client or McpClientService()
        self._gcs = gcs_client

    async def upload_trial_asset(
        self,
        *,
        server: McpServer,
        owner_id: str,
        filename: str,
        content: bytes,
        content_type: str | None,
        metadata: dict[str, Any] | None = None,
    ) -> McpTrialAsset:
        safe_name = _sanitize_filename(filename)
        sha256 = GCSStorageClient.compute_hash(content)
        asset = McpTrialAsset(
            server_id=server.id,
            owner_id=owner_id,
            original_filename=safe_name,
            content_type=content_type,
            size_bytes=len(content),
            sha256=sha256,
            gcs_uri=self._get_gcs_client().upload(
                content=content,
                gcs_path=f"mcp-trials/negentropy/{server.id}/{sha256[:12]}-{safe_name}",
                content_type=content_type,
            ),
            metadata_=metadata or {},
        )
        self._db.add(asset)
        await self._db.commit()
        await self._db.refresh(asset)
        return asset

    async def execute_tool(
        self,
        *,
        server: McpServer,
        user: AuthUser | None,
        tool_name: str,
        arguments: dict[str, Any] | None = None,
        asset_refs: dict[str, Any] | None = None,
        origin: str = RUN_ORIGIN_TRIAL_UI,
        timeout_seconds: float | None = None,
        external_event_sink: Callable[[dict[str, Any]], None] | None = None,
        resolve_resource_links: bool = False,
        resource_concurrency: int = 4,
    ) -> ExecutionResult:
        tool = await self._db.scalar(select(McpTool).where(McpTool.server_id == server.id, McpTool.name == tool_name))
        initial_payload = _json_safe(arguments or {})
        run = McpToolRun(
            server_id=server.id,
            tool_id=tool.id if tool else None,
            tool_name=tool_name,
            origin=origin,
            status="running",
            created_by=user.user_id if user else None,
            request_payload=initial_payload,
            normalized_request_payload={},
            result_payload={},
        )
        self._db.add(run)
        await self._db.flush()

        events: list[McpToolRunEvent] = []
        sequence_num = 0

        def append_event(
            stage: str,
            status: str,
            title: str,
            *,
            detail: str | None = None,
            payload: dict[str, Any] | None = None,
            duration_ms: int = 0,
        ) -> None:
            nonlocal sequence_num
            sequence_num += 1
            event = McpToolRunEvent(
                run_id=run.id,
                sequence_num=sequence_num,
                stage=stage,
                status=status,
                title=title,
                detail=detail,
                payload=_json_safe(payload or {}),
                duration_ms=duration_ms,
            )
            events.append(event)
            self._db.add(event)

        append_event(
            "request_validated",
            "completed",
            "请求参数已校验",
            payload={"tool_name": tool_name, "origin": origin, "arguments": initial_payload},
        )

        if tool:
            append_event(
                "tool_resolved",
                "completed",
                "已解析 Tool 定义",
                payload={
                    "tool_id": str(tool.id),
                    "input_schema": tool.input_schema or {},
                    "output_schema": tool.output_schema or {},
                },
            )

        cleanup_paths: list[Path] = []
        normalized_arguments = dict(arguments or {})
        if asset_refs:
            normalized_arguments = await self._apply_asset_refs(
                server=server,
                asset_refs=asset_refs,
                arguments=normalized_arguments,
                cleanup_paths=cleanup_paths,
                append_event=append_event,
            )

        run.normalized_request_payload = _json_safe(normalized_arguments)
        await self._db.flush()

        stderr_lines: list[str] = []

        def handle_client_event(event: dict[str, Any]) -> None:
            append_event(
                str(event.get("stage") or "transport"),
                str(event.get("status") or "info"),
                str(event.get("title") or "MCP 阶段事件"),
                detail=_truncate_text(event.get("detail")),
                payload=_json_safe(event.get("payload") or {}),
                duration_ms=int(event.get("duration_ms") or 0),
            )
            if external_event_sink:
                external_event_sink(event)

        def handle_stderr(message: str) -> None:
            stderr_lines.append(message)
            append_event(
                "stderr",
                "info",
                "服务端 stderr 输出",
                detail=_truncate_text(message, limit=2000),
                payload={},
            )

        call_started = datetime.now(UTC)
        append_event(
            "tool_called",
            "running",
            "开始调用 MCP Tool",
            payload={"transport_type": server.transport_type},
        )

        resolved_resources: dict[str, McpResourceContent] = {}
        resource_errors: dict[str, str] = {}
        # 仅在调用方显式开启且 client 真实支持 resource resolution 时使用同会话路径；
        # 否则回退到既有 call_tool（保持向后兼容，覆盖测试桩 / 旧 client）。
        use_resource_resolution = resolve_resource_links and hasattr(self._client, "call_tool_and_resolve_resources")
        try:
            if use_resource_resolution:
                # 关键不变量：动态 FileResource 的生命周期与 tool 会话绑定，
                # 必须在同一会话内立即拉取，避免事后失链。
                bundle = await self._client.call_tool_and_resolve_resources(
                    transport_type=server.transport_type,
                    tool_name=tool_name,
                    arguments=normalized_arguments,
                    command=server.command,
                    args=server.args,
                    env=server.env,
                    url=server.url,
                    headers=server.headers,
                    timeout_seconds=timeout_seconds,
                    resource_concurrency=resource_concurrency,
                    event_callback=handle_client_event,
                    stderr_callback=handle_stderr,
                )
                result = bundle.tool_result
                resolved_resources = bundle.resources
                resource_errors = bundle.resource_errors
            else:
                result = await self._client.call_tool(
                    transport_type=server.transport_type,
                    tool_name=tool_name,
                    arguments=normalized_arguments,
                    command=server.command,
                    args=server.args,
                    env=server.env,
                    url=server.url,
                    headers=server.headers,
                    timeout_seconds=timeout_seconds,
                    event_callback=handle_client_event,
                    stderr_callback=handle_stderr,
                )
            tool_called = True
        except Exception as exc:  # noqa: BLE001
            result = McpToolCallResult(success=False, error=str(exc))
            tool_called = False

        if tool_called and tool:
            tool.call_count = (tool.call_count or 0) + 1

        result_payload = {
            "success": result.success,
            "content": _json_safe(result.content),
            "structured_content": _json_safe(result.structured_content),
            "error": result.error,
            "duration_ms": result.duration_ms,
            "stderr": stderr_lines,
        }
        run.result_payload = result_payload
        run.error_summary = result.error
        run.duration_ms = result.duration_ms
        run.ended_at = datetime.now(UTC)
        run.status = "completed" if result.success else "failed"
        append_event(
            "result_normalized",
            "completed" if result.success else "failed",
            "执行结果已归一化",
            detail=_truncate_text(result.error),
            payload=result_payload,
            duration_ms=int((run.ended_at - call_started).total_seconds() * 1000),
        )
        append_event(
            "run_persisted",
            "completed",
            "执行历史已持久化",
            payload={"run_id": str(run.id), "status": run.status},
        )
        await self._db.commit()

        for path in cleanup_paths:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                logger.warning("mcp_trial_temp_cleanup_failed", path=str(path))

        await self._db.refresh(run)
        return ExecutionResult(
            run=run,
            events=events,
            call_result=result,
            resolved_resources=resolved_resources,
            resource_errors=resource_errors,
        )

    async def _apply_asset_refs(
        self,
        *,
        server: McpServer,
        asset_refs: dict[str, Any],
        arguments: dict[str, Any],
        cleanup_paths: list[Path],
        append_event,
    ) -> dict[str, Any]:
        normalized = dict(arguments)
        for field_name, raw_ref in asset_refs.items():
            if raw_ref is None:
                continue
            if isinstance(raw_ref, list):
                normalized[field_name] = []
                for asset_id in raw_ref:
                    file_path = await self._materialize_asset(server=server, asset_id=UUID(str(asset_id)))
                    cleanup_paths.append(file_path)
                    normalized[field_name].append(str(file_path))
                append_event(
                    "asset_resolved",
                    "completed",
                    "批量试用资产已解析",
                    payload={"field_name": field_name, "count": len(normalized[field_name])},
                )
                continue

            file_path = await self._materialize_asset(server=server, asset_id=UUID(str(raw_ref)))
            cleanup_paths.append(file_path)
            normalized[field_name] = str(file_path)
            append_event(
                "asset_resolved",
                "completed",
                "试用资产已解析",
                payload={"field_name": field_name, "asset_id": str(raw_ref), "path": str(file_path)},
            )
        return normalized

    async def _materialize_asset(self, *, server: McpServer, asset_id: UUID) -> Path:
        asset = await self._db.get(McpTrialAsset, asset_id)
        if not asset or asset.server_id != server.id:
            raise ValueError(f"Trial asset not found: {asset_id}")
        content = self._get_gcs_client().download(asset.gcs_uri)
        suffix = Path(asset.original_filename).suffix or ".pdf"
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp_file.write(content)
        temp_file.flush()
        temp_file.close()
        return Path(temp_file.name)

    def _get_gcs_client(self) -> GCSStorageClient:
        if self._gcs is None:
            self._gcs = GCSStorageClient.get_instance()
        return self._gcs


def _sanitize_filename(filename: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "_" for ch in filename).strip("._")
    return cleaned[:180] or "upload.pdf"


def _truncate_text(value: Any, *, limit: int = 1000) -> str | None:
    if value is None:
        return None
    text = str(value)
    if len(text) <= limit:
        return text
    return f"{text[:limit]}..."


def _json_safe(value: Any) -> Any:
    try:
        return json.loads(json.dumps(value, default=str))
    except TypeError:
        return str(value)
