#!/bin/bash
# ==============================================================================
# Mind 模块性能压测执行脚本
# 
# 使用方式:
#   ./run_benchmark.sh              # 交互式 (启动 Web UI)
#   ./run_benchmark.sh --headless   # 无头模式 (自动运行并输出报告)
#   ./run_benchmark.sh --quick      # 快速测试 (10 用户, 30 秒)
#
# 验收标准 (docs/040-the-realm-of-mind.md Section 5.3.4):
#   - P99 Latency < 50ms (SessionService)
#   - P99 Latency < 100ms (MemoryService)
#   - Error Rate < 0.1%
#   - Throughput > 500 RPS
# ==============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 默认配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCUSTFILE="${SCRIPT_DIR}/locustfile.py"
REPORT_DIR="${SCRIPT_DIR}/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 默认参数
USERS=100
SPAWN_RATE=10
RUN_TIME="60s"
MODE="web"

# 数据库连接 (从环境变量读取或使用默认值)
DATABASE_URL="${DATABASE_URL:-postgresql://aigc:@localhost:5432/cognizes-engine}"

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --headless)
            MODE="headless"
            shift
            ;;
        --quick)
            MODE="headless"
            USERS=10
            RUN_TIME="30s"
            shift
            ;;
        --users)
            USERS="$2"
            shift 2
            ;;
        --spawn-rate)
            SPAWN_RATE="$2"
            shift 2
            ;;
        --run-time)
            RUN_TIME="$2"
            shift 2
            ;;
        --help|-h)
            echo "Mind 模块性能压测脚本"
            echo ""
            echo "使用方式:"
            echo "  $0                  # 启动 Web UI (http://localhost:8089)"
            echo "  $0 --headless       # 无头模式运行"
            echo "  $0 --quick          # 快速测试 (10 用户, 30 秒)"
            echo ""
            echo "选项:"
            echo "  --users N           设置并发用户数 (默认: 100)"
            echo "  --spawn-rate N      设置每秒生成用户数 (默认: 10)"
            echo "  --run-time T        设置运行时间, 如 60s, 5m (默认: 60s)"
            echo ""
            echo "环境变量:"
            echo "  DATABASE_URL        PostgreSQL 连接字符串"
            exit 0
            ;;
        *)
            echo -e "${RED}未知参数: $1${NC}"
            exit 1
            ;;
    esac
done

# 创建报告目录
mkdir -p "${REPORT_DIR}"

# 检查依赖
echo -e "${YELLOW}[1/4] 检查依赖...${NC}"
if ! command -v locust &> /dev/null; then
    echo -e "${RED}错误: 未安装 locust${NC}"
    echo "请执行: pip install locust"
    exit 1
fi

# 检查数据库连接
echo -e "${YELLOW}[2/4] 检查数据库连接...${NC}"
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}警告: psql 未安装，跳过数据库检查${NC}"
else
    if psql "${DATABASE_URL}" -c "SELECT 1;" &> /dev/null; then
        echo -e "${GREEN}✓ 数据库连接正常${NC}"
    else
        echo -e "${RED}错误: 无法连接数据库 ${DATABASE_URL}${NC}"
        exit 1
    fi
fi

# 检查表是否存在
echo -e "${YELLOW}[3/4] 检查数据库 Schema...${NC}"
if command -v psql &> /dev/null; then
    TABLES=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('threads', 'events', 'memories');" 2>/dev/null || echo "0")
    if [[ "${TABLES}" -ge 3 ]]; then
        echo -e "${GREEN}✓ 必要表存在 (threads, events, memories)${NC}"
    else
        echo -e "${YELLOW}警告: 部分表可能不存在，请确保已执行数据库初始化${NC}"
    fi
fi

# 运行压测
echo -e "${YELLOW}[4/4] 启动压测...${NC}"
echo "  模式: ${MODE}"
echo "  用户数: ${USERS}"
echo "  生成速率: ${SPAWN_RATE}/s"
echo "  运行时间: ${RUN_TIME}"
echo "  数据库: ${DATABASE_URL:0:50}..."
echo ""

if [[ "${MODE}" == "headless" ]]; then
    # 无头模式
    REPORT_HTML="${REPORT_DIR}/report_${TIMESTAMP}.html"
    REPORT_CSV="${REPORT_DIR}/results_${TIMESTAMP}"
    
    echo -e "${GREEN}运行无头模式压测...${NC}"
    locust -f "${LOCUSTFILE}" \
        --users "${USERS}" \
        --spawn-rate "${SPAWN_RATE}" \
        --run-time "${RUN_TIME}" \
        --host "${DATABASE_URL}" \
        --headless \
        --html "${REPORT_HTML}" \
        --csv "${REPORT_CSV}"
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}压测完成!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "报告文件:"
    echo "  - HTML: ${REPORT_HTML}"
    echo "  - CSV:  ${REPORT_CSV}_stats.csv"
    echo ""
    
    # 分析结果 (简单检查 P99)
    if [[ -f "${REPORT_CSV}_stats.csv" ]]; then
        echo -e "${YELLOW}性能摘要:${NC}"
        # 使用 awk 解析 CSV 并检查 P99
        awk -F',' 'NR > 1 && $3 != "Aggregated" {
            name = $3;
            p99 = $12;
            failures = $6;
            total = $5;
            if (total > 0) {
                error_rate = (failures / total) * 100;
                printf "  %-20s P99=%.0fms ErrorRate=%.2f%%\n", name, p99, error_rate;
            }
        }' "${REPORT_CSV}_stats.csv"
    fi
else
    # Web UI 模式
    echo -e "${GREEN}启动 Locust Web UI...${NC}"
    echo "访问: http://localhost:8089"
    echo "按 Ctrl+C 停止"
    echo ""
    
    locust -f "${LOCUSTFILE}" \
        --host "${DATABASE_URL}" \
        --web-host 127.0.0.1 \
        --web-port 8089
fi
