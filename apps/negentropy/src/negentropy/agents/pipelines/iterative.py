"""
Iterative Refinement Loop - 迭代精化循环

使用 ADK 的 LoopAgent 实现质量驱动的迭代精化。
通过反馈闭环持续改进输出质量，实现熵减。

参考文献:
[1] Google. "Agent Development Kit - LoopAgent," _Google ADK Documentation_, 2025.
    https://google.github.io/adk-docs/agents/workflow-agents/#loopagent
[2] D. E. Knuth, "The Art of Computer Programming, Volume 1: Fundamental Algorithms,"
    _Addison-Wesley_, 3rd ed., 1997. (关于迭代改进的讨论)
"""

from google.adk.agents import LlmAgent, LoopAgent

from negentropy.agents.faculties.contemplation import contemplation_agent

# 迭代精化循环配置
DEFAULT_MAX_ITERATIONS = 3
DEFAULT_QUALITY_THRESHOLD = 0.8
MIN_IMPROVEMENT_THRESHOLD = 0.05


def create_refinement_loop(
    sub_agent: LlmAgent | None = None,
    max_iterations: int = DEFAULT_MAX_ITERATIONS,
    quality_threshold: float = DEFAULT_QUALITY_THRESHOLD,
) -> LoopAgent:
    """创建迭代精化循环

    实现质量驱动的迭代精化机制，持续改进输出直到满足质量要求。

    Args:
        sub_agent: 要迭代的子智能体 (默认为沉思系部)
        max_iterations: 最大迭代次数
        quality_threshold: 质量阈值 (达到此值则停止迭代)

    Returns:
        配置好的 LoopAgent
    """
    if sub_agent is None:
        sub_agent = contemplation_agent

    return LoopAgent(
        name="RefinementLoop",
        sub_agent=sub_agent,
        max_iterations=max_iterations,
        instruction=f"""
你是 **RefinementLoop** 的控制器，负责执行迭代精化流程。

## 目标

通过迭代改进输出质量，直到满足以下条件之一：
1. 质量评分达到 {quality_threshold:.2f} 以上
2. 达到最大迭代次数（{max_iterations} 次）
3. 连续两次迭代无显著改进（改进幅度 < {MIN_IMPROVEMENT_THRESHOLD:.2f}）

## 迭代策略

每次迭代时，你应该：

1. **评估当前输出**
   - 检查完整性：是否包含所有必要信息
   - 检查准确性：信息是否准确无误
   - 检查清晰度：表达是否清晰易懂
   - 计算整体质量评分

2. **识别改进点**
   - 缺失的关键信息
   - 不准确或模糊的表述
   - 结构不清晰的部分
   - 可以优化的表达方式

3. **应用改进**
   - 补充缺失信息
   - 修正不准确内容
   - 优化结构布局
   - 改进表达方式

4. **验证改进效果**
   - 比较迭代前后的质量评分
   - 确保改进是正向的
   - 避免过度精化（边际收益递减）

## 质量标准

- **完整性** (40%): 包含所有必要信息和要素
- **准确性** (40%): 信息准确、逻辑一致
- **清晰度** (20%): 结构清晰、表达明确

整体评分 = 完整性 × 0.4 + 准确性 × 0.4 + 清晰度 × 0.2

## 停止条件

迭代应该在以下情况停止：

1. **质量达标**: 整体评分 ≥ {quality_threshold:.2f}
2. **达到上限**: 已执行 {max_iterations} 次迭代
3. **收益递减**: 连续两次迭代改进幅度 < {MIN_IMPROVEMENT_THRESHOLD:.2f}

## 输出要求

每次迭代后，你应该输出：
- 当前质量评分
- 主要改进点
- 下一步计划（如果继续迭代）
- 最终评估（如果停止迭代）

## 约束

- 避免过度精化：质量评分达到阈值后即可停止
- 保持原意：精化过程中不要改变原始意图
- 效率优先：优先改进影响最大的方面
""",
    )


def create_contemplation_refinement_loop(
    max_iterations: int = DEFAULT_MAX_ITERATIONS,
) -> LoopAgent:
    """创建沉思系部专用的精化循环

    专门用于沉思系部输出的迭代精化。

    Args:
        max_iterations: 最大迭代次数

    Returns:
        配置好的 LoopAgent
    """
    return create_refinement_loop(
        sub_agent=contemplation_agent,
        max_iterations=max_iterations,
        quality_threshold=DEFAULT_QUALITY_THRESHOLD,
    )


def create_perception_refinement_loop(
    perception_agent,  # Lazy import to avoid circular dependency
    max_iterations: int = 2,
) -> LoopAgent:
    """创建感知系部专用的精化循环

    专门用于感知系部输出的迭代精化（信噪比优化）。

    Args:
        perception_agent: 感知系部智能体
        max_iterations: 最大迭代次数（感知精化通常需要较少迭代）

    Returns:
        配置好的 LoopAgent
    """
    return LoopAgent(
        name="PerceptionRefinementLoop",
        sub_agent=perception_agent,
        max_iterations=max_iterations,
        instruction="""
你是 **PerceptionRefinementLoop** 的控制器，负责优化感知输出的信噪比。

## 目标

通过迭代改进提升信息质量，直到满足以下条件：
1. 信噪比达到 0.8 以上
2. 达到最大迭代次数（2 次）
3. 信息来源已充分验证

## 优化重点

1. **过滤噪音**
   - 移除重复信息
   - 排除低质量来源
   - 剔除无关内容

2. **增强信号**
   - 补充关键细节
   - 交叉验证信息
   - 提供更多权威来源

3. **结构化组织**
   - 按主题分类
   - 标注信息来源
   - 提供摘要概述

## 输出要求

每次迭代后输出：
- 当前信噪比评分
- 过滤的噪音内容
- 新增的高质量信息
- 来源验证结果
""",
    )


def create_action_refinement_loop(
    action_agent,  # Lazy import to avoid circular dependency
    max_iterations: int = 2,
) -> LoopAgent:
    """创建行动系部专用的精化循环

    专门用于行动系部输出的迭代精化（执行精确性优化）。

    Args:
        action_agent: 行动系部智能体
        max_iterations: 最大迭代次数

    Returns:
        配置好的 LoopAgent
    """
    return LoopAgent(
        name="ActionRefinementLoop",
        sub_agent=action_agent,
        max_iterations=max_iterations,
        instruction="""
你是 **ActionRefinementLoop** 的控制器，负责优化行动执行的精确性。

## 目标

通过迭代改进提升执行质量，直到满足以下条件：
1. 执行成功且无错误
2. 验证结果符合预期
3. 达到最大迭代次数（2 次）

## 优化重点

1. **精确性**
   - 修正执行参数
   - 优化操作顺序
   - 补充必要的前置条件

2. **安全性**
   - 添加边界检查
   - 增加错误处理
   - 确保幂等性

3. **完整性**
   - 验证所有变更
   - 确认副作用可控
   - 提供回滚信息

## 输出要求

每次迭代后输出：
- 执行结果验证
- 发现的问题
- 应用的修正
- 最终执行报告
""",
    )


__all__ = [
    "create_refinement_loop",
    "create_contemplation_refinement_loop",
    "create_perception_refinement_loop",
    "create_action_refinement_loop",
    "DEFAULT_MAX_ITERATIONS",
    "DEFAULT_QUALITY_THRESHOLD",
    "MIN_IMPROVEMENT_THRESHOLD",
]
