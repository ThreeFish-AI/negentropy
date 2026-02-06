"""
L1 Reranking 层 - 两阶段检索的精排阶段

基于研究文档 [034-knowledge-base.md](https://github.com/ThreeFish-AI/agentic-ai-cognizes/blob/master/docs/research/034-knowledge-base.md)
中的两阶段检索架构，实现 Cross-Encoder 重排序能力。

参考文献:
[1] N. Reimers and I. Gurevych, "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks,"
    *arXiv preprint arXiv:1908.10084*, 2019.
[2] QAnything (网易有道), "两阶段检索: Embedding 检索 (高召回) + Rerank 精排 (高精度)," GitHub, 2024.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, List, Optional

from negentropy.logging import get_logger

from .types import KnowledgeMatch

logger = get_logger("negentropy.knowledge.reranking")


@dataclass(frozen=True)
class RerankConfig:
    """重排序配置

    控制重排序行为。
    """
    top_k: int = 10  # 返回结果数量
    score_threshold: float = 0.0  # 最低分数阈值
    normalize_scores: bool = True  # 是否归一化分数


class Reranker(ABC):
    """重排序器抽象基类

    定义重排序器的通用接口，支持多种实现方式:
    - LocalReranker: 本地模型 (BGE-Reranker)
    - APIReranker: 商业 API (Cohere Reranker)
    - NoopReranker: 无操作 (用于测试)
    """

    @abstractmethod
    async def rerank(
        self,
        query: str,
        candidates: List[KnowledgeMatch],
        config: Optional[RerankConfig] = None,
    ) -> List[KnowledgeMatch]:
        """重排序候选结果

        Args:
            query: 原始查询
            candidates: L0 召回的候选结果
            config: 重排序配置

        Returns:
            重排序后的结果列表
        """
        pass


class NoopReranker(Reranker):
    """无操作重排序器

    不进行任何重排序，直接返回原始结果。
    用于测试和性能对比。
    """

    async def rerank(
        self,
        query: str,
        candidates: List[KnowledgeMatch],
        config: Optional[RerankConfig] = None,
    ) -> List[KnowledgeMatch]:
        """返回原始结果，仅限制数量"""
        config = config or RerankConfig()
        return candidates[: config.top_k]


class LocalReranker(Reranker):
    """本地模型重排序器

    使用本地部署的 Cross-Encoder 模型进行重排序。
    支持 BGE-Reranker 等开源模型。

    注意: 需要安装额外的依赖包 (sentence-transformers 或 torch)
    """

    def __init__(
        self,
        model_name: str = "BAAI/bge-reranker-v2-m3",
        device: str = "cpu",
    ):
        """初始化本地重排序器

        Args:
            model_name: 模型名称
            device: 运行设备 ("cpu" 或 "cuda")
        """
        self._model_name = model_name
        self._device = device
        self._model = None
        self._initialized = False

    async def _ensure_initialized(self) -> None:
        """延迟加载模型

        避免在模块导入时加载模型，减少启动时间。
        """
        if self._initialized:
            return

        try:
            # 动态导入 sentence-transformers
            from sentence_transformers import CrossEncoder

            logger.info(
                "loading_reranker_model",
                model_name=self._model_name,
                device=self._device,
            )
            self._model = CrossEncoder(self._model_name, device=self._device)
            self._initialized = True
            logger.info("reranker_model_loaded", model_name=self._model_name)
        except ImportError as exc:
            logger.error(
                "sentence_transformers_not_installed",
                error=str(exc),
                hint="Install sentence-transformers to use local reranking: pip install sentence-transformers",
            )
            raise RuntimeError(
                "sentence-transformers is required for LocalReranker. "
                "Install it with: pip install sentence-transformers"
            ) from exc

    async def rerank(
        self,
        query: str,
        candidates: List[KnowledgeMatch],
        config: Optional[RerankConfig] = None,
    ) -> List[KnowledgeMatch]:
        """使用本地模型重排序"""
        config = config or RerankConfig()

        if not candidates:
            return []

        await self._ensure_initialized()

        # 构建查询-文档对
        pairs = [[query, candidate.content] for candidate in candidates]

        # 批量推理
        try:
            scores = self._model.predict(pairs)
        except Exception as exc:
            logger.error("reranker_inference_failed", exc_info=exc)
            # 回退到原始排序
            return candidates[: config.top_k]

        # 更新分数并排序
        reranked = []
        for match, score in zip(candidates, scores):
            reranked.append(
                KnowledgeMatch(
                    id=match.id,
                    content=match.content,
                    source_uri=match.source_uri,
                    metadata=match.metadata,
                    semantic_score=float(score),
                    keyword_score=match.keyword_score,
                    combined_score=float(score),
                )
            )

        # 过滤低分结果
        if config.score_threshold > 0:
            reranked = [r for r in reranked if r.semantic_score >= config.score_threshold]

        # 归一化分数 (可选)
        if config.normalize_scores and reranked:
            max_score = max(r.semantic_score for r in reranked)
            min_score = min(r.semantic_score for r in reranked)
            if max_score > min_score:
                reranked = [
                    KnowledgeMatch(
                        id=r.id,
                        content=r.content,
                        source_uri=r.source_uri,
                        metadata=r.metadata,
                        semantic_score=(r.semantic_score - min_score) / (max_score - min_score),
                        keyword_score=r.keyword_score,
                        combined_score=(r.combined_score - min_score) / (max_score - min_score),
                    )
                    for r in reranked
                ]

        # 按分数降序排序并限制数量
        reranked.sort(key=lambda x: x.semantic_score, reverse=True)
        return reranked[: config.top_k]


class APIReranker(Reranker):
    """API 重排序器

    使用商业 API 进行重排序。
    支持 Cohere Rerank API 等服务。
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "rerank-english-v3.0",
        base_url: str = "https://api.cohere.ai/v1/rerank",
    ):
        """初始化 API 重排序器

        Args:
            api_key: API 密钥 (如果为 None，从环境变量读取)
            model: 模型名称
            base_url: API 端点 URL
        """
        self._api_key = api_key
        self._model = model
        self._base_url = base_url

    async def rerank(
        self,
        query: str,
        candidates: List[KnowledgeMatch],
        config: Optional[RerankConfig] = None,
    ) -> List[KnowledgeMatch]:
        """使用 API 重排序"""
        config = config or RerankConfig()

        if not candidates:
            return []

        import httpx

        # 准备请求
        documents = [candidate.content for candidate in candidates]
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "X-Client-Name": "negentropy-knowledge",
        }
        payload = {
            "query": query,
            "documents": documents,
            "top_n": config.top_k,
            "model": self._model,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self._base_url, headers=headers, json=payload)
                response.raise_for_status()
                result = response.json()
        except Exception as exc:
            logger.error("reranker_api_failed", exc_info=exc)
            # 回退到原始排序
            return candidates[: config.top_k]

        # 解析结果
        reranked_indices = [item["index"] for item in result.get("results", [])]
        reranked = [candidates[i] for i in reranked_indices if i < len(candidates)]

        # 更新分数
        for i, item in enumerate(result.get("results", [])):
            if i < len(reranked):
                original_match = candidates[item["index"]]
                reranked[i] = KnowledgeMatch(
                    id=original_match.id,
                    content=original_match.content,
                    source_uri=original_match.source_uri,
                    metadata=original_match.metadata,
                    semantic_score=float(item.get("relevance_score", 0.0)),
                    keyword_score=original_match.keyword_score,
                    combined_score=float(item.get("relevance_score", 0.0)),
                )

        return reranked[: config.top_k]


class CompositeReranker(Reranker):
    """组合重排序器

    支持多级回退策略:
    1. 首选重排序器
    2. 备用重排序器 (如 API 失败时回退到本地模型)
    3. 最终回退 (直接返回原始结果)
    """

    def __init__(
        self,
        primary: Optional[Reranker] = None,
        fallback: Optional[Reranker] = None,
        final_fallback: Optional[Reranker] = None,
    ):
        """初始化组合重排序器

        Args:
            primary: 首选重排序器
            fallback: 备用重排序器
            final_fallback: 最终回退重排序器 (默认为 NoopReranker)
        """
        self._primary = primary
        self._fallback = fallback
        self._final_fallback = final_fallback or NoopReranker()

    async def rerank(
        self,
        query: str,
        candidates: List[KnowledgeMatch],
        config: Optional[RerankConfig] = None,
    ) -> List[KnowledgeMatch]:
        """使用组合策略重排序"""
        rerankers = [self._primary, self._fallback, self._final_fallback]
        valid_rerankers = [r for r in rerankers if r is not None]

        last_error = None
        for reranker in valid_rerankers:
            try:
                logger.debug(
                    "reranking_attempt",
                    reranker_type=type(reranker).__name__,
                    candidate_count=len(candidates),
                )
                result = await reranker.rerank(query, candidates, config)
                logger.info(
                    "reranking_success",
                    reranker_type=type(reranker).__name__,
                    result_count=len(result),
                )
                return result
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "reranking_failed",
                    reranker_type=type(reranker).__name__,
                    error=str(exc),
                )
                continue

        logger.error("all_rerankers_failed", error=str(last_error))
        # 返回原始结果
        config = config or RerankConfig()
        return candidates[: config.top_k]


def create_default_reranker() -> Reranker:
    """创建默认重排序器

    返回一个组合重排序器，支持多级回退:
    1. API Reranker (Cohere) - 如果配置了 API key
    2. Local Reranker (BGE) - 如果安装了 sentence-transformers
    3. Noop Reranker - 最终回退

    Returns:
        配置好的重排序器实例
    """
    import os

    primary: Optional[Reranker] = None
    fallback: Optional[Reranker] = None

    # 尝试使用 API Reranker
    cohere_api_key = os.getenv("COHERE_API_KEY")
    if cohere_api_key:
        try:
            primary = APIReranker(api_key=cohere_api_key)
            logger.info("reranker_api_configured", provider="cohere")
        except Exception as exc:
            logger.warning("reranker_api_init_failed", error=str(exc))

    # 本地模型作为备用
    try:
        fallback = LocalReranker()
        logger.info("reranker_local_available")
    except Exception as exc:
        logger.debug("reranker_local_unavailable", error=str(exc))

    return CompositeReranker(primary=primary, fallback=fallback)
