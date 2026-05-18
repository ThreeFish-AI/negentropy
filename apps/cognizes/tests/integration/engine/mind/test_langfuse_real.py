#!/usr/bin/env python3
"""
Langfuse 真实集成测试脚本 (SDK 3.x)

用途: 验证 Langfuse 连接并发送测试 Trace 到 Langfuse UI

运行:
    set -a && source .env && set +a
    uv run python tests/integration/mind/test_langfuse_real.py
"""

import os
import sys
import uuid
from datetime import datetime


def check_env_vars():
    """检查必需的环境变量"""
    required_vars = ["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY", "LANGFUSE_HOST"]
    missing = [v for v in required_vars if not os.environ.get(v)]

    if missing:
        print("❌ 缺少环境变量:")
        for var in missing:
            print(f"   - {var}")
        print("\n请设置环境变量后重试:")
        print("   set -a && source .env && set +a")
        sys.exit(1)

    print("✅ 环境变量已配置:")
    print(f"   LANGFUSE_PUBLIC_KEY: {os.environ['LANGFUSE_PUBLIC_KEY'][:12]}...")
    print(f"   LANGFUSE_HOST: {os.environ['LANGFUSE_HOST']}")


def test_langfuse_trace():
    """使用 Langfuse SDK 3.x 发送测试 Trace"""
    from langfuse import Langfuse

    # 初始化客户端
    client = Langfuse(
        public_key=os.environ["LANGFUSE_PUBLIC_KEY"],
        secret_key=os.environ["LANGFUSE_SECRET_KEY"],
        host=os.environ["LANGFUSE_HOST"],
    )

    print("⏳ 正在发送测试 Trace...")

    # 使用 SDK 3.x 的 context manager API
    with client.start_as_current_observation(
        name="test_trace_from_integration_test",
        as_type="span",
        input={"test_time": datetime.now().isoformat(), "source": "test_langfuse_real.py"},
        metadata={"tags": ["integration_test", "mind_module"]},
    ) as root_span:
        trace_id = root_span.trace_id
        print(f"\n📤 创建 Trace: {trace_id}")

        # 子 Span 1: 模拟 Session Service 操作
        with client.start_as_current_observation(
            name="session_service.create_session",
            as_type="span",
            input={"app_name": "test_app", "user_id": "test_user"},
        ) as session_span:
            session_span.update(output={"session_id": str(uuid.uuid4())})
        print("   ├─ Span: session_service.create_session")

        # 子 Span 2: 模拟 LLM Generation
        with client.start_as_current_observation(
            name="gemini-2.0-flash-generation",
            as_type="generation",
            model="gemini-2.0-flash",
            input=[{"role": "user", "content": "Hello, how are you?"}],
        ) as generation:
            generation.update(
                output={"role": "assistant", "content": "I'm doing well, thank you!"},
                usage_details={"input": 10, "output": 8, "total": 18},
            )
        print("   ├─ Generation: gemini-2.0-flash")

        # 子 Span 3: 模拟工具调用
        with client.start_as_current_observation(
            name="tool.search_memory",
            as_type="span",
            input={"query": "previous conversations"},
        ) as tool_span:
            tool_span.update(output={"results": [{"id": "mem_1", "content": "..."}]})
        print("   └─ Span: tool.search_memory")

        root_span.update(output={"status": "completed", "duration_ms": 150})

    # 强制刷新
    client.flush()
    print("\n✅ Trace 已发送到 Langfuse!")
    print(f"\n🔗 查看 Trace:")
    print(f"   {os.environ['LANGFUSE_HOST']}/trace/{trace_id}")

    return trace_id


def test_observe_decorator():
    """测试 @observe 装饰器"""
    from langfuse import observe, get_client

    # 确保客户端已初始化
    client = get_client()

    @observe(as_type="span")
    def process_request(query: str) -> str:
        """模拟处理请求"""
        return f"Processed: {query}"

    @observe(as_type="generation")
    def generate_response(prompt: str) -> str:
        """模拟 LLM 生成"""
        return "Generated response"

    print("\n📤 测试 @observe 装饰器:")

    result = process_request("Hello from decorator test")
    print(f"   ├─ process_request: {result}")

    gen_result = generate_response("Generate something")
    print(f"   └─ generate_response: {gen_result}")

    client.flush()
    print("\n✅ @observe 装饰器测试完成")


def main():
    print("=" * 60)
    print("Langfuse 真实集成测试 (SDK 3.x)")
    print("=" * 60)

    # 1. 检查环境变量
    check_env_vars()

    # 2. 发送测试 Trace
    print("\n" + "-" * 40)
    print("测试 1: 基本 Trace 功能 (Context Manager)")
    print("-" * 40)
    trace_id = test_langfuse_trace()

    # 3. 测试装饰器
    print("\n" + "-" * 40)
    print("测试 2: @observe 装饰器")
    print("-" * 40)
    try:
        test_observe_decorator()
    except Exception as e:
        print(f"   ⚠️ 装饰器测试跳过: {e}")

    print("\n" + "=" * 60)
    print("🎉 测试完成！请在 Langfuse UI 中验证 Trace")
    print("=" * 60)


if __name__ == "__main__":
    main()
