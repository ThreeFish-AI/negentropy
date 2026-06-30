"""
Session Summarization - 对话标题生成

将对话历史概括为短标题，属于 Session/Memory 治理范畴。

注意: 本模块从 knowledge/ 迁移而来，因为对话摘要是 Session 的职责，
与 Knowledge（静态文档）无关，遵循 Boundary Management 原则。
"""

import re

from google.adk.models import LlmRequest
from google.adk.models.lite_llm import LiteLlm
from google.genai import types

from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.summarization")

# Title 生成对长度的硬约束在响应后处理阶段完成（汉字截 18 / 英文截 36，见
# ``generate_title`` 末尾），这里的 ``max_tokens`` 只用于保护 LLM 总输出预算。
#
# 历史值 20 在面向 reasoning 模型（gpt-5-mini / o1 / o3 等默认配置）时会被
# 内部 reasoning tokens 全数消耗，``response.content.parts`` 为空导致
# ``generate_title`` 返回 None。提升到 256 既能为 reasoning 留预算，又因后处理
# 截断保证 UI 不会被长标题撑破——这是 ISSUE-082 同源根因在 Session 标题路径
# 的呼应修复。
_TITLE_MAX_TOKENS = 256


# ---------------------------------------------------------------------------
# 无语义占位标题判定 —— 标题质量门禁的单一事实源（SoT）
#
# 生产观察到的劣态标题（"首次标题" / "标题 v2" / "会话标题自动生成" 等）已被
# LLM 实际生成并写回 DB（失败路径不写 title，故非空结果必来自 LLM 输出）。
# 本函数作为 SoT 被「生成即拒绝」(generate_title 后处理)、存量回填 CLI、
# 未来巡检自愈三处复用，严禁在他处镜像黑名单。
#
# 三层短路判定：
# 1. 整体命中元词汇黑名单正则 → True（覆盖生产已观察的具体坏标题）
# 2. 剥离元词汇 token 后，剩余实质字符 < 3 → True（泛化未来新组合，同时
#    避免误伤「用户画像摘要」「会话功能设计」这类含元词但有实体的正常标题）
# 3. 与生成指令文本互相包含 → True（防御 LLM 复述指令的退化模式）
# ---------------------------------------------------------------------------

# 整体黑名单：纯元词汇标题。命中即判 vacant。
_VACANT_TITLE_PATTERNS = (
    r"^标题\s*v?\d*$",  # "标题" / "标题 v2" / "标题v3"
    r"^首次标题$",
    r"^新标题$",
    r"^无标题$",
    r"^会话标题(自动生成)?$",
    r"^标题自动生成$",
    r"^对话标题$",
    r"^对话(总结|摘要)?$",
    r"^(摘要|总结)$",
    r"^新(对话|会话)$",
    r"^未命名(会话|对话)?$",
    r"^title$",
    r"^session\s*title$",
    r"^session$",
    r"^summary$",
    r"^conversation$",
    r"^new\s*(chat|session|conversation)?$",
    r"^untitled$",
)
_VACANT_REGEX = re.compile("|".join(_VACANT_TITLE_PATTERNS), re.IGNORECASE)

# 元词汇 token：用于「剥离后看剩余实质长度」，不是整体黑名单。
# 不含单字"新"——避免误伤「新加坡」「新闻」等正常词；"新对话"/"新会话"由黑名单正则覆盖。
_META_TERMS = (
    "标题",
    "会话",
    "对话",
    "摘要",
    "总结",
    "自动生成",
    "首次",
    "未命名",
    "无标题",
    "title",
    "session",
    "summary",
    "conversation",
    "chat",
    "untitled",
)

# 生成指令文本片段：标题复述指令时命中（仅当标题 >= 6 字符才检测，避免短标题误伤）。
_INSTRUCTION_FRAGMENTS = (
    "生成一个简短标题",
    "生成标题",
    "summarize the conversation",
    "会话标题自动生成",
    "标题自动生成",
    "仅输出标题",
    "output only the title",
    "仅输出标题文本",
)

# 剥离元词汇后清理分隔/版本号残渣用的字符集。
_RESIDUE_CHARS_RE = re.compile(r"[\s\-—_:：vV0-9]+")


def is_semantically_vacant_title(title: str) -> bool:
    """判定标题是否为无语义占位符。

    命中（返回 True）表示该标题应被视为无效——调用方应丢弃并回退到「不写 title」，
    让前端以 ``Session <id前8位>`` 兜底，优于保留一个无语义标题。

    纯函数、无 IO、无副作用：生成路径、存量回填 CLI、巡检自愈均可安全调用。
    """
    if not title:
        return True
    text = title.strip()
    if not text:
        return True

    # 规则 1：整体命中元词汇黑名单正则
    if _VACANT_REGEX.match(text):
        return True

    # 规则 2：剥离元词汇 token 后，剩余实质字符过短
    stripped = text
    for term in _META_TERMS:
        stripped = stripped.replace(term, "")
    stripped = _RESIDUE_CHARS_RE.sub("", stripped)
    if len(stripped) < 3:
        return True

    # 规则 3：复述生成指令文本（仅较长标题检测，避免短标题误伤）
    if len(text) >= 6:
        lowered = text.lower()
        for frag in _INSTRUCTION_FRAGMENTS:
            frag_low = frag.lower()
            if frag_low in lowered or lowered in frag_low:
                return True

    return False


# ---------------------------------------------------------------------------
# 标题生成指令 —— 全部结构化约束收敛到 system_instruction（单一载体）
#
# 设计要点（修复 prompt 双用缺陷）：
# - 历史问题：同一份指令文本曾同时塞进 system_instruction 与追加到 contents
#   末尾的 user message，弱模型把"指令本身"当对话内容描述，输出"会话标题自动生成"
#   这类元描述。现改为 system 承载全部指令、contents 仅追加极简触发句。
# - few-shot 中英 + 动作型各一，锚定"概括用户需求"而非"描述对话"。
# - 显式禁止元词汇（含生产观察到的坏标题字面量作反向锚定）。
# ---------------------------------------------------------------------------

_TITLE_SYSTEM_INSTRUCTION = (
    "你是会话标题生成器。根据用户与助手的对话，概括出用户的核心需求或问题主题，"
    "生成一个简短的会话标题。\n\n"
    "【输出规则】\n"
    "1. 概括「用户想做什么 / 问了什么」，不要描述这段对话本身。\n"
    "2. 中文标题 8-18 个汉字；英文标题不超过 36 个字符。\n"
    "3. 只输出标题文本本身：不要引号、不要前缀（如「标题:」「Title:」）、"
    "不要句末标点、不要任何解释。\n"
    "4. 使用名词短语或短句，不要以句号结尾。\n\n"
    "【禁止输出的内容】\n"
    "禁止输出对「标题/对话/任务」本身的描述或元词汇，例如：\n"
    "「标题」「会话标题」「标题自动生成」「首次标题」「无标题」「新对话」「未命名」、\n"
    "「Title」「Session Title」「Summary」「Conversation」「对话总结」。\n"
    "标题必须包含来自对话内容的具体信息（人名、产品名、技术词、动作、主题）。\n\n"
    "【示例】\n"
    "对话：\n"
    "用户：帮我查一下 AfterShip 最近一个季度的财报数据\n"
    "助手：AfterShip 2025 Q3 营收……\n"
    "标题：AfterShip Q3 财报查询\n\n"
    "对话：\n"
    "用户：How do I set up OAuth2 for a Next.js API route?\n"
    "助手：You can use NextAuth……\n"
    "标题：Next.js OAuth2 setup\n\n"
    "对话：\n"
    "用户：把这段中文翻译成英文\n"
    "助手：……\n"
    "标题：中译英翻译请求\n\n"
    "现在请根据下方对话生成标题。"
)

# contents 末尾的极简触发句：不含任何约束/元词汇，仅触发模型按 system 指令输出。
_TITLE_TRIGGER = "请根据以上对话，给出会话标题："


class SessionSummarizer:
    """Uses LLM to summarize conversation history into a short title.

    凭证解析与 LiteLlm 构造由 ``create()`` 工厂统一在异步边界内完成，避免
    同步 ``__init__`` 在缓存未命中时回退到无 ``api_key`` 的硬编码默认值导致
    ``litellm.AuthenticationError``（与 ``DynamicRootLiteLlm._resolve_override``
    走同一 SoT：``resolve_llm_config()`` 从 DB 读取）。
    """

    def __init__(self, model: LiteLlm) -> None:
        self.model = model
        logger.debug("session_summarizer_initialized")

    # task_registry.py 中登记的 task_key；用户可在 /interface/task-models 为本任务单独绑定模型。
    _TASK_KEY = "session.title"

    @classmethod
    async def create(cls) -> "SessionSummarizer":
        """异步工厂：从 DB 解析当前任务对应 LLM 配置（含 api_key）后构造 LiteLlm。

        与 commit 8ce35d5 修复 ``DynamicRootLiteLlm`` 的范式一致——所有默认
        模型路径统一走 ``resolve_llm_config*()``，不再回退到无凭证的硬编码值。
        改造点：从 ``resolve_llm_config()`` 切换到 ``resolve_llm_config_for_task("session.title")``，
        以允许用户在 ``/interface/task-models`` 为标题生成单独指定模型。

        额外，对支持 reasoning 的 OpenAI 模型族（gpt-5 / o1 / o3 / o4）强制
        ``reasoning_effort="minimal"``——title 生成只需短文本响应，若不显式
        降低推理预算，模型会用尽 ``max_tokens`` 进行内部 reasoning 而返回
        空 content，导致 ``generate_title`` 一律失败（线上观察到的根因）。
        """
        from negentropy.config.model_resolver import (
            _split_vendor_and_model,
            _supports_anthropic_thinking,
            _supports_openai_reasoning,
            resolve_llm_config_for_task,
        )

        name, kwargs = await resolve_llm_config_for_task(cls._TASK_KEY)
        # 防御性浅拷贝：resolver 内部已 copy（model_resolver.py:80/90/448），
        # 这里再独立一份避免对调用方/缓存层的契约耦合，max_tokens 不污染上游 dict。
        kwargs = dict(kwargs)
        kwargs["max_tokens"] = _TITLE_MAX_TOKENS

        vendor, model_name = _split_vendor_and_model(name)
        if _supports_openai_reasoning(vendor or "", model_name):
            kwargs["reasoning_effort"] = "minimal"
        elif _supports_anthropic_thinking(vendor or "", model_name):
            # title 不需要 extended thinking；显式 disabled 避免吞光预算
            kwargs["thinking"] = {"type": "disabled"}

        return cls(LiteLlm(name, **kwargs))

    async def generate_title(self, history: list[types.Content]) -> str | None:
        """
        Generates a short title (~18 Chinese chars / ~36 English chars) for the given conversation history.
        """
        if not history:
            return None

        logger.info("generating_title", event_count=len(history))

        try:
            # 指令全部收敛到 system_instruction（消除历史双用缺陷）；
            # contents 仅保留纯净对话 history + 末尾极简触发句。
            chat_history = list(history)
            chat_history.append(types.Content(role="user", parts=[types.Part(text=_TITLE_TRIGGER)]))

            logger.debug("title_generation_request", event_count=len(history), max_tokens=_TITLE_MAX_TOKENS)

            request = LlmRequest(
                contents=chat_history,
                config=types.GenerateContentConfig(
                    system_instruction=_TITLE_SYSTEM_INSTRUCTION,
                    temperature=0.3,
                    max_output_tokens=_TITLE_MAX_TOKENS,
                ),
            )

            response_text = ""
            async for response in self.model.generate_content_async(request):
                if response.content and response.content.parts:
                    for part in response.content.parts:
                        # 跳过 reasoning / thought parts（gpt-5 系反应模型常见），
                        # 仅采纳可见输出。否则 response_text 会混入推理流水账，
                        # 后处理截断后得到一段无意义片段。
                        if getattr(part, "thought", False):
                            continue
                        if part.text:
                            response_text += part.text

            logger.debug("llm_response_received", response_length=len(response_text))

            if not response_text:
                logger.warning("title_generation_empty_response", history_length=len(history))

            if response_text:
                title = response_text.strip().strip('"').strip("'")

                if len(title) > 100:
                    logger.warning(
                        "title_too_long",
                        title_length=len(title),
                        history_length=len(history),
                    )
                    words = title.split()[:8]
                    title = " ".join(words)

                prefixes = ["Title:", "标题：", "Summary:", "摘要：", "The title is"]
                for prefix in prefixes:
                    if title.startswith(prefix):
                        title = title[len(prefix) :].strip()

                # Normalize whitespace/newlines
                title = re.sub(r"\s+", " ", title).strip()

                # Enforce length for UI width (~18 Chinese chars / ~36 English chars)
                if re.search(r"[\u4e00-\u9fff]", title):
                    title = title[:18].strip()
                else:
                    if len(title) > 36:
                        title = title[:36].strip()

                if len(title) > 100:
                    logger.error("title_still_too_long_after_processing")
                    return None

                if len(title) < 3:
                    logger.warning("title_too_short", title_length=len(title))
                    return None

                # 质量门禁（SoT）：拒绝元词汇占位符 / 复述指令的标题，宁可不写也不写无语义标题。
                if is_semantically_vacant_title(title):
                    logger.warning("title_semantically_vacant", title=title)
                    return None

                logger.info("session_title_generated", title=title)
                return title

            return None

        except Exception as e:
            logger.warning("title_generation_failed", error=str(e))
            return None
