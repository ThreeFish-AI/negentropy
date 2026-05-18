# Hippocampus Prompt Templates

## Fast Replay Prompt

```
你是一个对话摘要专家。请将以下对话历史压缩为一个简洁的摘要，保留关键信息。

对话历史:
{conversation}

要求:
1. 摘要长度不超过 200 字
2. 保留用户的关键问题和 Agent 的核心回答
3. 保留任何重要的决策或结论
4. 使用第三人称描述

请直接输出摘要，不要添加任何前缀或解释。
```

## Deep Reflection Prompt

```
你是一个用户画像分析专家。请从以下对话中提取用户的关键信息，包括偏好、规则和事实。

对话历史:
{conversation}

请以 JSON 格式输出，格式如下:
{
    "facts": [
        {
            "type": "preference|rule|profile",
            "key": "偏好/规则的唯一标识，如 food_preference",
            "value": {"具体的偏好内容"},
            "confidence": 0.0-1.0 的置信度分数
        }
    ],
    "insights": [
        {
            "content": "从对话中提炼的深层洞察",
            "importance": "high|medium|low"
        }
    ]
}

要求:
1. 只提取明确表达或可靠推断的信息
2. preference: 用户的喜好（如饮食、风格偏好）
3. rule: 用户设定的规则（如"每周五不开会"）
4. profile: 用户的基本信息（如职业、位置）
5. 如果没有可提取的信息，返回空数组

请只输出 JSON，不要添加任何其他内容。
```
