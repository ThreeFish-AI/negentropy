"""
性能基准测试：对比 Google InMemory 与 Open Agent Engine (PostgreSQL) 的响应延迟
"""

import asyncio
import statistics
import sys
import time
from dataclasses import dataclass
from pathlib import Path

# 添加 src 目录到 Python 路径
_HERE = Path(__file__).resolve().parent
_SRC = _HERE.parent / "src"
_PROJECT_ROOT = _HERE.parents[4]  # agentic-ai-engine

if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))
if str(_PROJECT_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT / "src"))

# 导入服务
from agent import create_travel_agent  # noqa: E402
from config import BackendType, config  # noqa: E402
from google.adk.runners import Runner  # noqa: E402
from services import create_services  # noqa: E402


@dataclass
class BenchmarkResult:
    backend: str
    total_requests: int
    avg_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    errors: int


class PerformanceBenchmark:
    """性能基准测试器"""

    def __init__(self, num_requests: int = 50, concurrent_users: int = 5):
        self.num_requests = num_requests
        self.concurrent_users = concurrent_users
        self.test_messages = [
            "帮我查一下去巴厘岛的机票",
            "推荐几个适合度假的地方",
            "我想订一个海景酒店",
            "查一下明天的天气",
            "我不喜欢辣的食物，有什么推荐？",
        ]

    async def run_single_request(
        self, runner: Runner, session_service, user_id: str, session_id: str, message: str
    ) -> tuple[float, bool]:
        """执行单次请求并返回延迟"""
        from google.genai import types

        start = time.perf_counter()
        try:
            new_message = types.Content(parts=[types.Part(text=message)])
            response_text = None
            async for event in runner.run_async(user_id=user_id, session_id=session_id, new_message=new_message):
                if hasattr(event, "content") and event.content:
                    for part in event.content.parts:
                        if hasattr(part, "text") and part.text:
                            response_text = part.text
            success = response_text is not None and len(response_text) > 0
            latency = (time.perf_counter() - start) * 1000
            return (latency, success)
        except Exception as e:
            latency = (time.perf_counter() - start) * 1000
            print(f"Request failed: {e}")
            return (latency, False)

    async def run_benchmark(self, backend_type: BackendType) -> BenchmarkResult:
        """运行基准测试"""
        # 设置后端
        config.backend = backend_type

        # 创建服务
        session_service, memory_service = await create_services()
        agent = create_travel_agent()
        runner = Runner(
            agent=agent, app_name="benchmark_app", session_service=session_service, memory_service=memory_service
        )

        # 预热
        print(f"Warming up {backend_type.value} backend...")
        warmup_session = await session_service.create_session(app_name="benchmark_app", user_id="warmup_user")
        for _i in range(2):
            await self.run_single_request(runner, session_service, "warmup_user", warmup_session.id, "test")

        # 执行基准测试
        print(f"Running benchmark for {backend_type.value}...")
        latencies = []
        errors = 0

        async def user_workload(user_id: str):
            nonlocal errors
            # 为每个用户创建独立的 Session
            user_session = await session_service.create_session(app_name="benchmark_app", user_id=user_id)
            user_latencies = []
            for i in range(self.num_requests // self.concurrent_users):
                msg = self.test_messages[i % len(self.test_messages)]
                latency, success = await self.run_single_request(runner, session_service, user_id, user_session.id, msg)
                user_latencies.append(latency)
                if not success:
                    errors += 1
            return user_latencies

        # 并发执行
        results = await asyncio.gather(*[user_workload(f"user_{i}") for i in range(self.concurrent_users)])

        # 合并延迟数据
        for user_latencies in results:
            latencies.extend(user_latencies)

        # 计算统计数据
        latencies.sort()
        return BenchmarkResult(
            backend=backend_type.value,
            total_requests=len(latencies),
            avg_latency_ms=statistics.mean(latencies),
            p50_latency_ms=latencies[int(len(latencies) * 0.50)],
            p95_latency_ms=latencies[int(len(latencies) * 0.95)],
            p99_latency_ms=latencies[int(len(latencies) * 0.99)],
            errors=errors,
        )

    async def compare_backends(self) -> dict:
        """对比两种后端的性能"""
        results = {}

        # 测试 Google InMemory (基线)
        results["google"] = await self.run_benchmark(BackendType.GOOGLE_MANAGED)

        # 测试 PostgreSQL (我们的实现)
        results["postgres"] = await self.run_benchmark(BackendType.OPEN_ENGINE)

        return results


def print_comparison_report(results: dict):
    """打印性能对比报告"""
    google = results["google"]
    postgres = results["postgres"]

    print("\n" + "=" * 70)
    print("📊 性能对比报告 - Open Agent Engine vs Google InMemory")
    print("=" * 70)

    print(f"\n{'指标':<25} {'Google InMemory':>18} {'PostgreSQL':>18} {'差异':>12}")
    print("-" * 70)

    metrics = [
        ("Total Requests", google.total_requests, postgres.total_requests),
        ("Avg Latency (ms)", google.avg_latency_ms, postgres.avg_latency_ms),
        ("P50 Latency (ms)", google.p50_latency_ms, postgres.p50_latency_ms),
        ("P95 Latency (ms)", google.p95_latency_ms, postgres.p95_latency_ms),
        ("P99 Latency (ms)", google.p99_latency_ms, postgres.p99_latency_ms),
        ("Errors", google.errors, postgres.errors),
    ]

    for name, g_val, p_val in metrics:
        diff = p_val - g_val if isinstance(g_val, float) else p_val - g_val
        diff_str = f"+{diff:.2f}" if diff > 0 else f"{diff:.2f}"
        print(f"{name:<25} {g_val:>18.2f} {p_val:>18.2f} {diff_str:>12}")

    # 验证 KPI
    p99_diff = postgres.p99_latency_ms - google.p99_latency_ms
    print("\n" + "-" * 70)
    if p99_diff < 100:
        print(f"✅ KPI 达成: P99 延迟差异 {p99_diff:.2f}ms < 100ms 阈值")
    else:
        print(f"❌ KPI 未达成: P99 延迟差异 {p99_diff:.2f}ms >= 100ms 阈值")
    print("=" * 70)


async def main():
    benchmark = PerformanceBenchmark(num_requests=50, concurrent_users=5)
    results = await benchmark.compare_backends()
    print_comparison_report(results)


if __name__ == "__main__":
    asyncio.run(main())
