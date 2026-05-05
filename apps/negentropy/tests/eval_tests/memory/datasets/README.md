# Memory Eval Datasets

迷你评测数据集（每份 30 条）用于 Memory 模块端到端检索效果回归基线。

## 文件清单

| 文件 | 来源 | License | 用途 |
|-----|-----|---------|-----|
| `locomo_mini.jsonl` | 仿造 LoCoMo<sup>[1]</sup> 模式手工构造 | 内部使用，参考 LoCoMo 公共子集 license | 长会话事实问答 |
| `longmemeval_mini.jsonl` | 仿造 LongMemEval<sup>[2]</sup> 模式手工构造 | 内部使用，参考 LongMemEval 公共子集 license | 多会话推理、知识更新、时序推理 |

## 数据 Schema

```jsonc
{
  "sample_id": "locomo_001",
  "session_id": "alice_2026_01",   // 同 session 内的 memories 共享上下文
  "memories": [                     // 灌入 PostgresMemoryService 的语料
    {"speaker": "user", "text": "..."},
    {"speaker": "assistant", "text": "..."}
  ],
  "question": "What food allergy does the user have?",
  "expected_answer_substrings": ["peanut"],   // 期望命中的子串（lower 比对）
  "task_type": "single_session_user"          // LongMemEval 任务分类（可选）
}
```

## 引用文献（IEEE）

[1] A. Maharana et al., "Evaluating very long-term conversational memory of LLM agents," in *Proc. ACL*, 2024.
[2] D. Wu et al., "LongMemEval: Benchmarking chat assistants on long-term memory," arXiv:2410.10813, 2024.
