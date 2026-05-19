"""
L1 Reranker 实现

使用 Cross-Encoder 模型对 L0 粗排结果进行精排。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


@dataclass
class RerankedResult:
    """重排后的结果"""

    id: str
    content: str
    original_score: float
    rerank_score: float
    metadata: dict[str, Any] | None = None


class CrossEncoderReranker:
    """
    Cross-Encoder 重排器

    使用 BAAI/bge-reranker-base 模型进行语义重排。
    """

    def __init__(self, model_name: str = "BAAI/bge-reranker-base", device: str | None = None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)
        self.model.to(self.device)
        self.model.eval()

    def rerank(self, query: str, documents: list[dict[str, Any]], top_k: int = 10) -> list[RerankedResult]:
        """
        对文档进行重排序

        Args:
            query: 用户查询
            documents: 待重排文档列表 (需包含 id, content, score)
            top_k: 返回 Top-K 结果

        Returns:
            重排后的结果列表
        """
        if not documents:
            return []

        # 1. 构建 Query-Document 对
        pairs = [[query, doc["content"]] for doc in documents]

        # 2. Tokenize
        inputs = self.tokenizer(pairs, padding=True, truncation=True, max_length=512, return_tensors="pt").to(
            self.device
        )

        # 3. 推理
        with torch.no_grad():
            scores = self.model(**inputs).logits.squeeze(-1)

        # 4. 归一化分数 (sigmoid)
        scores = torch.sigmoid(scores).cpu().numpy()

        # 5. 构建结果
        results = []
        for doc, rerank_score in zip(documents, scores):
            results.append(
                RerankedResult(
                    id=doc["id"],
                    content=doc["content"],
                    original_score=doc.get("score", 0.0),
                    rerank_score=float(rerank_score),
                    metadata=doc.get("metadata"),
                )
            )

        # 6. 按重排分数排序
        results.sort(key=lambda x: x.rerank_score, reverse=True)

        return results[:top_k]


class RerankerPipeline:
    """
    完整的两阶段检索 Pipeline

    L0 (数据库粗排) -> L1 (Cross-Encoder 精排)
    """

    def __init__(
        self,
        db_pool,  # asyncpg.Pool
        reranker: CrossEncoderReranker | None = None,
    ):
        self.db_pool = db_pool
        self.reranker = reranker or CrossEncoderReranker()

    async def search(
        self,
        user_id: str,
        app_name: str,
        query: str,
        query_embedding: list[float],
        l0_limit: int = 50,
        l1_limit: int = 10,
    ) -> list[RerankedResult]:
        """
        两阶段检索

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            query: 用户查询文本
            query_embedding: 查询向量
            l0_limit: L0 粗排返回数量
            l1_limit: L1 精排返回数量

        Returns:
            精排后的结果列表
        """
        # L0: 数据库混合检索
        rows = await self.db_pool.fetch(
            """
            SELECT id, content, combined_score, metadata
            FROM hybrid_search($1, $2, $3, $4, $5)
        """,
            user_id,
            app_name,
            query,
            query_embedding,
            l0_limit,
        )

        documents = [
            {
                "id": str(row["id"]),
                "content": row["content"],
                "score": row["combined_score"],
                "metadata": row["metadata"],
            }
            for row in rows
        ]

        # L1: Cross-Encoder 重排
        results = self.reranker.rerank(query, documents, top_k=l1_limit)

        return results


# 使用示例
async def main():
    from cognizes.core.database import DatabaseManager
    import numpy as np

    # 初始化
    db = DatabaseManager.get_instance()
    pool = await db.get_pool()
    pipeline = RerankerPipeline(pool)

    # 生成查询向量 (实际应使用 Embedding 模型)
    query_embedding = list(np.random.randn(1536).astype(float))

    # 执行两阶段检索
    results = await pipeline.search(
        user_id="user_001",
        app_name="demo_app",
        query="How to implement RAG with PostgreSQL?",
        query_embedding=query_embedding,
        l0_limit=50,
        l1_limit=10,
    )

    # 输出结果
    print("Top 10 Reranked Results:")
    for i, r in enumerate(results, 1):
        print(f"{i}. [Score: {r.rerank_score:.4f}] {r.content[:100]}...")

    # Pool managed by DatabaseManager


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
