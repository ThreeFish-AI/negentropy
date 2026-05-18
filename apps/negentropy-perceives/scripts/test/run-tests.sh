#!/bin/bash

# Negentropy Perceives 测试运行脚本
# 通用执行器 + 数据驱动路由模式

set -e

# --- 颜色与输出 ---
readonly RED='\033[0;31m' GREEN='\033[0;32m' BLUE='\033[0;34m' YELLOW='\033[1;33m' NC='\033[0m'
readonly SUITE_TIMEOUT=300  # 全量测试套件超时（秒）

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# --- 跨平台超时执行器 ---
# 超时后先发 SIGTERM，10s 后 SIGKILL 强杀进程树
run_with_timeout() {
    local secs="$1"; shift
    if command -v timeout >/dev/null 2>&1; then
        timeout --signal=SIGTERM --kill-after=10 "$secs" "$@"
    elif command -v gtimeout >/dev/null 2>&1; then
        gtimeout --signal=SIGTERM --kill-after=10 "$secs" "$@"
    else
        log_info "未找到 timeout/gtimeout 命令，跳过套件级超时保护"
        "$@"
    fi
}

# --- 环境前置守卫 ---
preflight() {
    log_info "检查测试依赖..."
    if ! uv --version >/dev/null 2>&1; then
        log_error "uv 未安装，请先安装 uv"
        exit 1
    fi
    uv sync --group dev --quiet
    log_info "依赖检查完成"

    log_info "清理旧的测试结果..."
    rm -rf tests/reports/htmlcov/ tests/reports/ .coverage tests/reports/coverage.xml tests/reports/coverage.json
    mkdir -p tests/reports
    log_info "清理完成"
}

# --- 通用 pytest 执行器 ---
run_pytest() {
    local test_path="$1" report_prefix="$2"
    shift 2

    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}运行测试: ${report_prefix} (超时=${SUITE_TIMEOUT}s)${NC}"
    echo -e "${BLUE}======================================${NC}"

    run_with_timeout "$SUITE_TIMEOUT" uv run pytest "$test_path" \
        --cov=negentropy.perceives \
        --cov-report=term-missing \
        --html="tests/reports/${report_prefix}-report.html" \
        --self-contained-html \
        --json-report \
        --json-report-file="tests/reports/${report_prefix}-results.json" \
        "$@"
    local exit_code=$?
    if [ "$exit_code" -eq 124 ]; then
        log_error "测试套件超时 (${SUITE_TIMEOUT}s)，已终止进程"
        return 1
    fi
    return "$exit_code"
}

# --- 覆盖率报告生成 ---
generate_coverage_report() {
    if [ ! -f .coverage ]; then
        echo -e "${YELLOW}[WARN]${NC} 未找到覆盖率数据文件"
        return
    fi

    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}生成覆盖率报告${NC}"
    echo -e "${BLUE}======================================${NC}"

    uv run coverage html -d tests/reports/htmlcov
    uv run coverage xml -o tests/reports/coverage.xml
    uv run coverage json -o tests/reports/coverage.json
    uv run coverage report --show-missing

    log_info "覆盖率报告已生成:"
    log_info "  HTML: tests/reports/htmlcov/index.html"
    log_info "  XML: tests/reports/coverage.xml"
    log_info "  JSON: tests/reports/coverage.json"
}

# --- 帮助信息 ---
show_help() {
    echo "Negentropy Perceives 测试运行脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  unit          运行单元测试"
    echo "  integration   运行集成测试"
    echo "  full          运行优化版测试套件 (默认，排除 network/browser/llm)"
    echo "  quick         运行快速测试 (排除慢速测试)"
    echo "  performance   运行性能测试"
    echo "  llm           运行需要 LLM API 的测试 (smart 模式、编排)"
    echo "  ci            运行全量测试套件 (包含所有标记，用于 CI)"
    echo "  coverage      仅生成覆盖率报告"
    echo "  clean         清理测试结果"
    echo "  help          显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 unit       # 仅运行单元测试"
    echo "  $0 quick      # 快速测试，适用于开发阶段 (< 3min 目标)"
    echo "  $0 full       # 优化版完整测试，适用于本地开发 (< 3min 目标)"
    echo "  $0 ci         # 全量测试（含 LLM/网络），适用于 CI/CD"
    echo "  $0 llm        # 仅运行 LLM 相关集成测试"
    echo ""
}

# --- 主入口 ---
main() {
    local mode="${1:-full}"

    # 无需 preflight 的模式
    case "$mode" in
        coverage)    generate_coverage_report; return ;;
        clean)       rm -rf tests/reports/htmlcov/ tests/reports/ .coverage
                     mkdir -p tests/reports
                     log_info "清理完成"; return ;;
        help)        show_help; return ;;
    esac

    preflight

    # 数据驱动路由：mode -> (test_path, report_prefix, extra_args...)
    case "$mode" in
        unit)        run_pytest "tests/unit/" "unit-test" \
                         -n auto -m "unit or not integration" ;;
        integration) run_pytest "tests/integration/" "integration-test" \
                         -n auto --cov-append -m "integration or not unit" ;;
        full)        run_pytest "tests/" "full-test" \
                         -n auto \
                         -m "not (requires_network or requires_browser or requires_llm)" \
                         --cov-report=html:tests/reports/htmlcov \
                         --cov-report=xml:tests/reports/coverage.xml \
                         --cov-report=json:tests/reports/coverage.json ;;
        quick)       run_pytest "tests/" "quick-test" \
                         -n auto -m "not slow" -x ;;
        performance) run_pytest "tests/integration/test_comprehensive_integration.py::TestPerformanceAndLoad" \
                         "performance-test" ;;
        llm)         run_pytest "tests/" "llm-test" \
                         -n auto -m "requires_llm" ;;
        ci)          run_pytest "tests/" "ci-test" \
                         -n auto \
                         --cov-report=html:tests/reports/htmlcov \
                         --cov-report=xml:tests/reports/coverage.xml \
                         --cov-report=json:tests/reports/coverage.json ;;
        *)           log_error "未知选项: $mode"
                     show_help
                     exit 1 ;;
    esac

    # performance 模式也生成覆盖率报告（如有数据）
    generate_coverage_report
}

main "$@"
