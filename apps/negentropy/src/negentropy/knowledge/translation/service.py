"""DocumentTranslationService — Documents 批量翻译的后台执行服务。

执行链（产品化 Agent 装配）：
    POST /documents/translate → BackgroundTasks → 本服务
    → Python 确定性切分（splitter，join==原文不变式）写入临时工作目录 source/chunk_NNNN.md
    → 程序化 ADK Runner 运行 InfluenceFaculty（任务消息内嵌 document-translate 技能渲染模板）
    → InfluenceFaculty 经 invoke_claude_code 驱动 Claude Code 逐块翻译 translated/chunk_NNNN.md
    → 服务端确定性校验（缺块重跑一次 / 代码围栏按源回写 / 结构完整性报告）
    → 按序拼接 → 新 KnowledgeDocument 分录落库（metadata 标记译自来源）
    → 源文档 metadata_.translation 状态机（processing → completed | failed）。

设计原则：LLM/Agent 只做编排执行（best-effort），**正确性由本服务的确定性校验兜底**——
缺块即整体失败，绝不部分入库。

已验证的运行时约束（详见方案）：
- PostgresSessionService 要求 session_id 为 UUID 字符串；
- InfluenceFaculty 必须经 ``create_influence_agent()`` 工厂新建（单例已挂 root_agent，
  二次挂 parent 抛错），且不传 mode（Runner root LlmAgent 仅允许 chat）。
"""

from __future__ import annotations

import asyncio
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from negentropy.logging import get_logger

from .splitter import split_markdown
from .validation import extract_fences, restore_fences, structural_report

if TYPE_CHECKING:
    from negentropy.agents.skills_injector import ResolvedSkill

logger = get_logger("negentropy.knowledge.translation")

SKILL_NAME = "document-translate"
TRANSLATION_METADATA_KEY = "translation"
TRANSLATED_FROM_KEY = "translated_from_document_id"

# 语言代码 → 自然语言名称（技能模板变量用自然语言表述）。
_LANGUAGE_NAMES = {"zh": "中文"}

# 进程内并发护栏：同文档去重 + 全局并发上限（翻译是重 LLM 任务，避免互相饿死）。
_INFLIGHT: set[UUID] = set()
_SEMAPHORE = asyncio.Semaphore(2)

# 译文正文中 CJK 字符占比超过该阈值时视为"已是中文"，跳过翻译。
_CJK_RATIO_THRESHOLD = 0.3


class TranslationError(RuntimeError):
    """翻译流程失败（guard 不满足 / 校验不达标 / Agent 执行异常）。"""


def _cjk_ratio(text: str) -> float:
    """统计 CJK 统一表意文字占非空白字符的比例。"""
    visible = [ch for ch in text if not ch.isspace()]
    if not visible:
        return 0.0
    cjk = sum(1 for ch in visible if "一" <= ch <= "鿿")
    return cjk / len(visible)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _translated_filename(original_filename: str, target_language: str) -> str:
    stem = Path(original_filename).stem or original_filename
    return f"{stem}.{target_language}.md"


class DocumentTranslationService:
    """编排 InfluenceFaculty 完成单文档分批翻译，并以确定性校验兜底。"""

    def __init__(self, *, max_chars: int = 6000) -> None:
        self._max_chars = max_chars

    # ------------------------------------------------------------------ #
    # 入口：BackgroundTasks 调用，永不向上抛（失败落 metadata + 日志）。
    # ------------------------------------------------------------------ #

    async def translate_document(self, *, document_id: UUID, target_language: str = "zh") -> None:
        if document_id in _INFLIGHT:
            logger.info("document_translation_inflight_skip", document_id=str(document_id))
            return
        _INFLIGHT.add(document_id)
        try:
            async with _SEMAPHORE:
                await self._run(document_id=document_id, target_language=target_language)
        except Exception as exc:
            logger.error(
                "document_translation_failed",
                document_id=str(document_id),
                error=str(exc),
                exc_info=True,
            )
            await self._mark_translation(
                document_id,
                status="failed",
                target_language=target_language,
                error=str(exc)[:500],
            )
        finally:
            _INFLIGHT.discard(document_id)

    # ------------------------------------------------------------------ #
    # 主流程
    # ------------------------------------------------------------------ #

    async def _run(self, *, document_id: UUID, target_language: str) -> None:
        from negentropy.storage.service import DocumentStorageService

        storage = DocumentStorageService()
        doc = await storage.get_document(document_id=document_id)
        if doc is None:
            raise TranslationError("document not found")

        metadata = dict(doc.metadata_ or {})
        if metadata.get(TRANSLATED_FROM_KEY):
            raise TranslationError("document is already a translation")

        markdown = await storage.get_document_markdown(document_id)
        if not markdown or not markdown.strip():
            raise TranslationError("markdown content not ready")
        if _cjk_ratio(markdown) > _CJK_RATIO_THRESHOLD:
            raise TranslationError("document content already appears to be Chinese")

        chunks = split_markdown(markdown, max_chars=self._max_chars)
        workdir = Path(tempfile.mkdtemp(prefix=f"negentropy-translate-{str(document_id)[:8]}-"))
        try:
            await self._execute_in_workdir(
                storage=storage,
                doc=doc,
                markdown=markdown,
                chunks=chunks,
                workdir=workdir,
                target_language=target_language,
            )
        except Exception:
            # 失败保留 workdir 供排障（错误信息由入口写 metadata）。
            logger.warning(
                "document_translation_workdir_kept",
                document_id=str(document_id),
                workdir=str(workdir),
            )
            raise
        shutil.rmtree(workdir, ignore_errors=True)

    async def _execute_in_workdir(
        self,
        *,
        storage: Any,
        doc: Any,
        markdown: str,
        chunks: list[str],
        workdir: Path,
        target_language: str,
    ) -> None:
        source_dir = workdir / "source"
        translated_dir = workdir / "translated"
        source_dir.mkdir(parents=True)
        translated_dir.mkdir(parents=True)
        for index, chunk in enumerate(chunks):
            (source_dir / f"chunk_{index:04d}.md").write_text(chunk, encoding="utf-8")

        skill = await self._resolve_skill()
        self._materialize_workdir_skill(workdir, skill)

        chunk_count = len(chunks)
        tool_timeout = min(300 + 90 * chunk_count, 3600)
        total_timeout = min(900 + 120 * chunk_count, 5400)
        task_msg = self._render_task_message(
            skill,
            workdir=workdir,
            chunk_count=chunk_count,
            target_language=target_language,
            tool_timeout=tool_timeout,
        )

        await asyncio.wait_for(self._run_influence(task_msg), timeout=total_timeout)

        invalid = self._invalid_chunks(translated_dir, chunks)
        if invalid:
            # 失败块（缺失 / 空 / 围栏数量漂移）单次重跑：删除无效产物后明确点名补译，仍无效即整体失败。
            for name in invalid:
                (translated_dir / name).unlink(missing_ok=True)
            retry_msg = (
                f"{task_msg}\n\n## 补漏重跑\n上次执行后以下分块缺失、为空或代码围栏数量与原块不一致，"
                f"仅需重新翻译这些文件（其余不要改动）：\n"
                + "\n".join(f"- source/{name} → translated/{name}" for name in invalid)
            )
            await asyncio.wait_for(self._run_influence(retry_msg), timeout=total_timeout)
            invalid = self._invalid_chunks(translated_dir, chunks)
            if invalid:
                raise TranslationError(f"translated chunks invalid after retry: {invalid[:5]}")

        translated_md, warnings = self._assemble_and_validate(
            chunks=chunks, translated_dir=translated_dir, source_markdown=markdown
        )

        target_doc = await self._store_target_document(
            storage=storage,
            source_doc=doc,
            translated_markdown=translated_md,
            target_language=target_language,
            warnings=warnings,
        )

        await self._mark_translation(
            doc.id,
            status="completed",
            target_language=target_language,
            target_document_id=str(target_doc.id),
            warnings=warnings or None,
        )
        logger.info(
            "document_translation_completed",
            document_id=str(doc.id),
            target_document_id=str(target_doc.id),
            chunk_count=chunk_count,
            warnings=len(warnings),
        )

    # ------------------------------------------------------------------ #
    # InfluenceFaculty 程序化执行
    # ------------------------------------------------------------------ #

    async def _run_influence(self, task_msg: str) -> str:
        from google.genai import types

        from negentropy.agents.faculties.influence import create_influence_agent
        from negentropy.engine.factories.runner import get_runner

        # 工厂新实例（单例已挂 root_agent，二次挂 parent 抛错）；不传 mode（Runner 仅允许 chat）。
        runner = get_runner(agent=create_influence_agent())
        session_id = str(uuid4())  # PostgresSessionService 要求 UUID 字符串
        content = types.Content(role="user", parts=[types.Part(text=task_msg)])

        final_text = ""
        async for event in runner.run_async(
            user_id="system:document-translation",
            session_id=session_id,
            new_message=content,
        ):
            if event.is_final_response() and event.content and event.content.parts:
                final_text = "".join(part.text or "" for part in event.content.parts if getattr(part, "text", None))
        return final_text

    # ------------------------------------------------------------------ #
    # Skill 解析 / 渲染 / 工作目录材料化
    # ------------------------------------------------------------------ #

    async def _resolve_skill(self) -> ResolvedSkill:
        """DB 技能优先（迁移 0067 种子行），未命中回退内置模板（部署未迁移时兜底）。"""
        from negentropy.agents.skills_injector import ResolvedSkill, resolve_skills
        from negentropy.db.session import AsyncSessionLocal

        try:
            async with AsyncSessionLocal() as session:
                resolved = await resolve_skills(session, [SKILL_NAME], owner_id="system")
            if resolved:
                return resolved[0]
        except Exception:
            logger.warning("document_translate_skill_db_lookup_failed", exc_info=True)

        from negentropy.agents import skill_templates

        for template in skill_templates.load_all():
            if template.name == SKILL_NAME:
                return ResolvedSkill(
                    id=template.template_id,
                    name=template.name,
                    display_name=template.display_name,
                    description=template.description,
                    prompt_template=template.prompt_template,
                    required_tools=tuple(template.required_tools),
                    is_enabled=True,
                    enforcement_mode=template.enforcement_mode,
                    resources=tuple(template.resources),
                )
        raise TranslationError(f"skill '{SKILL_NAME}' not found in DB nor templates")

    def _render_task_message(
        self,
        skill: ResolvedSkill,
        *,
        workdir: Path,
        chunk_count: int,
        target_language: str,
        tool_timeout: int,
    ) -> str:
        from negentropy.agents.skills_injector import format_skill_invocation

        rendered = format_skill_invocation(
            skill,
            variables={
                "workdir": str(workdir),
                "chunk_count": chunk_count,
                "target_language": _LANGUAGE_NAMES.get(target_language, target_language),
                "tool_timeout": tool_timeout,
            },
        )
        if not rendered:
            raise TranslationError(f"skill '{SKILL_NAME}' has no prompt_template")
        return f"请执行以下文档翻译任务，严格按技能模板操作：\n\n{rendered}"

    def _materialize_workdir_skill(self, workdir: Path, skill: ResolvedSkill) -> None:
        """把 document-translate 技能材料化进 Claude Code 工作目录（.claude/skills/）。

        使 Claude Code 子进程在工作目录内可直接发现该技能（Interface/Tools 的
        ``builtin_tools(claude_code).config.skills`` 装配的运行时兑现）。技能正文
        渲染时剔除「执行方式」节——该节面向 InfluenceFaculty（invoke_claude_code
        编排），对 Claude Code 子进程无意义。fail-soft：材料化失败不阻断主链路
        （任务消息已内嵌完整铁律）。
        """
        try:
            body = skill.prompt_template or ""
            # 剔除面向 ADK 编排层的「执行方式」节（## 边界手术，未命中则保留全文）。
            start = body.find("## 执行方式")
            if start != -1:
                end = body.find("## ", start + 4)
                body = body[:start] + (body[end:] if end != -1 else "")
            skill_dir = workdir / ".claude" / "skills" / SKILL_NAME
            skill_dir.mkdir(parents=True, exist_ok=True)
            description = (skill.description or "").replace("\n", " ").strip()
            (skill_dir / "SKILL.md").write_text(
                f"---\nname: {SKILL_NAME}\ndescription: {description}\n---\n\n{body}",
                encoding="utf-8",
            )
        except Exception:
            logger.warning("document_translate_skill_materialize_failed", exc_info=True)

    # ------------------------------------------------------------------ #
    # 校验 / 拼接 / 落库
    # ------------------------------------------------------------------ #

    @staticmethod
    def _invalid_chunks(translated_dir: Path, chunks: list[str]) -> list[str]:
        """返回无效的译文分块文件名：缺失 / 空 / 代码围栏数量与源块不一致（不可对位回写）。"""
        invalid: list[str] = []
        for index, source_chunk in enumerate(chunks):
            name = f"chunk_{index:04d}.md"
            path = translated_dir / name
            if not path.is_file():
                invalid.append(name)
                continue
            translated_chunk = path.read_text(encoding="utf-8")
            if not translated_chunk.strip():
                invalid.append(name)
                continue
            if len(extract_fences(translated_chunk)) != len(extract_fences(source_chunk)):
                invalid.append(name)
        return invalid

    def _assemble_and_validate(
        self,
        *,
        chunks: list[str],
        translated_dir: Path,
        source_markdown: str,
    ) -> tuple[str, list[str]]:
        """逐块代码围栏确定性回写 → 按序拼接 → 结构完整性报告（fatal 即失败）。"""
        warnings: list[str] = []
        translated_chunks: list[str] = []
        for index, source_chunk in enumerate(chunks):
            name = f"chunk_{index:04d}.md"
            translated_chunk = (translated_dir / name).read_text(encoding="utf-8")
            source_fences = extract_fences(source_chunk)
            repaired, repairable = restore_fences(translated_chunk, source_fences)
            if not repairable:
                raise TranslationError(
                    f"code fence count drift in {name}: "
                    f"source={len(source_fences)} translated={len(extract_fences(translated_chunk))}"
                )
            if repaired != translated_chunk:
                warnings.append(f"{name}: code fences restored from source")
            translated_chunks.append(repaired)

        translated_md = "".join(translated_chunks)
        report = structural_report(source_markdown, translated_md)
        warnings.extend(report["warnings"])
        if report["fatal"]:
            raise TranslationError(
                "content loss detected: "
                f"images_missing={report['images_missing']} urls_missing={report['urls_missing'][:5]}"
            )
        return translated_md, warnings

    async def _store_target_document(
        self,
        *,
        storage: Any,
        source_doc: Any,
        translated_markdown: str,
        target_language: str,
        warnings: list[str],
    ) -> Any:
        filename = _translated_filename(source_doc.original_filename, target_language)
        metadata: dict[str, Any] = {
            "source": "document_translation",
            TRANSLATED_FROM_KEY: str(source_doc.id),
            "translated_from_filename": source_doc.original_filename,
            "translation_language": target_language,
        }
        if warnings:
            metadata["translation_warnings"] = warnings[:20]

        target_doc, is_new = await storage.upload_and_store(
            corpus_id=source_doc.corpus_id,
            app_name=source_doc.app_name,
            content=translated_markdown.encode("utf-8"),
            filename=filename,
            content_type="text/markdown",
            metadata=metadata,
            created_by=source_doc.created_by,
        )
        if not is_new:
            # hash 去重命中既有译文：补写来源标记，保证双向链接不缺失。
            await storage.update_document_metadata(document_id=target_doc.id, metadata_patch=metadata)
        # save_markdown_content 内置置 markdown_extract_status=completed + NUL 清洗。
        await storage.save_markdown_content(document_id=target_doc.id, markdown_content=translated_markdown)
        return target_doc

    # ------------------------------------------------------------------ #
    # 状态机
    # ------------------------------------------------------------------ #

    async def _mark_translation(
        self,
        document_id: UUID,
        *,
        status: str,
        target_language: str,
        target_document_id: str | None = None,
        error: str | None = None,
        warnings: list[str] | None = None,
    ) -> None:
        from negentropy.storage.service import DocumentStorageService

        state: dict[str, Any] = {
            "status": status,
            "target_language": target_language,
            "target_document_id": target_document_id,
            "error": error,
            "finished_at": _now_iso() if status in ("completed", "failed") else None,
        }
        if warnings:
            state["warnings"] = warnings[:20]
        try:
            await DocumentStorageService().update_document_metadata(
                document_id=document_id,
                metadata_patch={TRANSLATION_METADATA_KEY: state},
            )
        except Exception:
            logger.error(
                "document_translation_metadata_update_failed",
                document_id=str(document_id),
                status=status,
                exc_info=True,
            )
