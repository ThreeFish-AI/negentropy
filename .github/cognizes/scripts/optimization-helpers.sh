#!/bin/bash

# Optimization helpers for GitHub Actions
# This script provides functions to optimize dependency management and caching

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to generate optimized cache keys
generate_python_cache_key() {
    local python_version="${1:-3.12}"
    local cache_scope="${2:-full}"

    # Create hash for Python dependencies
    if [[ -f "pyproject.toml" ]]; then
        local dep_hash=$(sha256sum pyproject.toml | cut -d' ' -f1)
    elif [[ -f "requirements.txt" ]]; then
        local dep_hash=$(sha256sum requirements.txt | cut -d' ' -f1)
    else
        local dep_hash="no-requirements"
    fi

    # Include Python version in key
    local cache_key="${RUNNER_OS}-python-v3-${python_version}-${dep_hash}"

    # Add cache scope modifier
    case "${cache_scope}" in
        "minimal")
            echo "${cache_key}-minimal"
            ;;
        "full")
            echo "${cache_key}-full-$(date +%Y-%m)"
            ;;
        "dev")
            echo "${cache_key}-dev-$(date +%Y-%m-%d)"
            ;;
        *)
            echo "${cache_key}"
            ;;
    esac
}

# Function to install Python dependencies with parallelization
install_python_deps_parallel() {
    local dev_deps="${1:-true}"
    local max_workers="${2:-4}"

    log_info "Installing Python dependencies with ${max_workers} workers..."

    # Upgrade pip with parallel downloads
    python -m pip install --upgrade pip --use-pep517 --no-cache-dir

    # Install dependencies in parallel if possible
    if [[ -f "pyproject.toml" ]]; then
        if [[ "${dev_deps}" == "true" ]]; then
            # Install base dependencies first
            pip install -e . --no-deps

            # Extract and install dependencies in parallel batches
            python << 'EOF'
import subprocess
import sys
import concurrent.futures
from pathlib import Path

# Read dependencies from pyproject.toml
try:
    import tomllib
except ImportError:
    import tomli as tomllib

with open('pyproject.toml', 'rb') as f:
    data = tomllib.load(f)

deps = []
# Get main dependencies
if 'project' in data and 'dependencies' in data['project']:
    deps.extend(data['project']['dependencies'])

# Get dev dependencies
if 'project' in data and 'optional-dependencies' in data['project']:
    for group in data['project']['optional-dependencies'].values():
        deps.extend(group)

# Split dependencies into batches for parallel installation
batch_size = 10
batches = [deps[i:i + batch_size] for i in range(0, len(deps), batch_size)]

def install_batch(batch):
    if not batch:
        return True
    try:
        subprocess.run(['pip', 'install'] + batch, check=True, capture_output=True)
        return True
    except subprocess.CalledProcessError:
        return False

print(f"Installing {len(deps)} dependencies in {len(batches)} batches...")
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    futures = [executor.submit(install_batch, batch) for batch in batches]
    results = [f.result() for f in concurrent.futures.as_completed(futures)]

if not all(results):
    print("Some dependency batches failed, falling back to sequential install")
    subprocess.run(['pip', 'install', '-e', '.[dev]'], check=True)
else:
    print("All dependencies installed successfully in parallel")
EOF
        else
            pip install -e . --quiet
        fi
    else
        # Fallback to traditional installation
        if [[ "${dev_deps}" == "true" ]] && [[ -f "requirements-dev.txt" ]]; then
            pip install -r requirements.txt -r requirements-dev.txt --quiet
        elif [[ -f "requirements.txt" ]]; then
            pip install -r requirements.txt --quiet
        fi
    fi

    log_info "Python dependencies installed successfully"
}

# Function to optimize pip cache
optimize_pip_cache() {
    log_info "Optimizing pip cache..."

    # Clean old cache
    pip cache purge 2>/dev/null || true

    # Pre-download common packages for future runs
    local common_packages=(
        "pytest"
        "pytest-cov"
        "pytest-xdist"
        "mypy"
        "ruff"
        "black"
        "flake8"
        "bandit"
        "safety"
    )

    log_info "Pre-downloading common packages..."
    for package in "${common_packages[@]}"; do
        pip download "${package}" --dest ~/.cache/pip/pre-downloads --no-deps 2>/dev/null || true
    done
}

# Function to setup Node.js with advanced caching
setup_node_optimized() {
    local node_version="${1:-18}"
    local working_dir="${2:-.}"

    log_info "Setting up Node.js ${node_version} with optimization..."

    cd "${working_dir}"

    # Setup Node.js with caching
    if command -v volta &> /dev/null; then
        volta install node@${node_version}
    else
        # Use npm for faster installation
        npm config set cache ~/.npm-cache
        npm config set prefer-offline true
        npm config set audit false
        npm config set fund false
    fi

    # Install dependencies with optimization
    if [[ -f "package.json" ]]; then
        if [[ -f "yarn.lock" ]]; then
            # Use yarn with optimizations
            yarn config set cache-folder ~/.yarn-cache
            yarn config set enableTelemetry false
            yarn config set prefer-offline true
            yarn install --frozen-lockfile --prefer-offline --silent
        else
            # Use npm with optimizations
            npm ci --prefer-offline --no-audit --no-fund --silent
        fi
    fi

    cd - >/dev/null
}

# Function to parallelize test execution
run_tests_parallel() {
    local test_type="${1:-all}"
    local max_workers="${2:-auto}"
    local test_dir="${3:-tests/}"

    log_info "Running ${test_type} tests with ${max_workers} workers..."

    case "${test_type}" in
        "unit")
            if command -v pytest &> /dev/null; then
                pytest "${test_dir}/unit" -n "${max_workers}" --dist=loadscope --tb=short
            else
                python -m unittest discover -s "${test_dir}/unit" -p "test_*.py"
            fi
            ;;
        "integration")
            if command -v pytest &> /dev/null; then
                pytest "${test_dir}/integration" -n 2 --dist=loadscope --tb=short
            else
                python -m unittest discover -s "${test_dir}/integration" -p "test_*.py"
            fi
            ;;
        "coverage")
            if command -v pytest &> /dev/null; then
                pytest "${test_dir}" --cov=. --cov-report=xml --cov-report=html -n "${max_workers}"
            fi
            ;;
        "all")
            if command -v pytest &> /dev/null; then
                pytest "${test_dir}" -n "${max_workers}" --dist=loadscope --tb=short
            else
                python -m unittest discover -s "${test_dir}" -p "test_*.py"
            fi
            ;;
        *)
            log_error "Unknown test type: ${test_type}"
            exit 1
            ;;
    esac
}

# Function to optimize Docker layer caching
optimize_docker_build() {
    local dockerfile="${1:-Dockerfile}"
    local context="${2:-.}"
    local image_name="${3:-optimized-image}"

    log_info "Optimizing Docker build for ${dockerfile}..."

    # Create optimized Dockerfile if it doesn't exist
    if [[ ! -f "${dockerfile}.optimized" ]]; then
        cat > "${dockerfile}.optimized" << 'EOF'
# Multi-stage optimized Dockerfile
FROM python:3.12-slim as base

# Set environment variables for optimization
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100

# Install system dependencies in a single layer
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
        curl \
        libmagic1 \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Create app directory
WORKDIR /app

# Copy requirements first for better caching
COPY pyproject.toml ./

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install -e .[dev] --no-cache-dir

# Copy application code
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "-m", "agents.main"]
EOF
    fi

    # Build with optimization flags
    docker build \
        -f "${dockerfile}.optimized" \
        -t "${image_name}" \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --cache-from type=local,src=/tmp/.buildx-cache \
        --cache-to type=local,dest=/tmp/.buildx-cache \
        "${context}"
}

# Function to cleanup old cache entries
cleanup_cache() {
    local cache_type="${1:-all}"
    local days_old="${2:-7}"

    log_info "Cleaning up cache entries older than ${days_old} days..."

    case "${cache_type}" in
        "pip")
            pip cache remove '*.whl' --verbose 2>/dev/null || true
            pip cache remove '*.tar.gz' --verbose 2>/dev/null || true
            ;;
        "docker")
            docker system prune -f --filter "until=${days_old}d" 2>/dev/null || true
            docker volume prune -f --filter "label!=keep" 2>/dev/null || true
            ;;
        "npm")
            npm cache verify 2>/dev/null || true
            ;;
        "all")
            pip cache purge 2>/dev/null || true
            docker system prune -f --filter "until=${days_old}d" 2>/dev/null || true
            npm cache verify 2>/dev/null || true
            ;;
    esac

    log_info "Cache cleanup completed"
}

# Function to report optimization statistics
report_optimization_stats() {
    log_info "Optimization Statistics:"

    # Python cache stats
    if command -v pip &> /dev/null; then
        local pip_cache_size=$(pip cache dir 2>/dev/null | xargs du -sh 2>/dev/null | cut -f1 || echo "Unknown")
        echo "  - Pip cache size: ${pip_cache_size}"
    fi

    # Docker stats
    if command -v docker &> /dev/null; then
        local docker_size=$(docker system df --format "{{.Size}}" 2>/dev/null | head -1 || echo "Unknown")
        echo "  - Docker usage: ${docker_size}"
    fi

    # Node.js stats
    if [[ -d "~/.npm" ]]; then
        local npm_size=$(du -sh ~/.npm 2>/dev/null | cut -f1 || echo "Unknown")
        echo "  - NPM cache size: ${npm_size}"
    fi

    # Available disk space
    local disk_space=$(df -h . | tail -1 | awk '{print $4}')
    echo "  - Available disk space: ${disk_space}"
}

# Main execution logic
main() {
    local command="${1:-help}"

    case "${command}" in
        "generate-cache-key")
            generate_python_cache_key "${2:-3.12}" "${3:-full}"
            ;;
        "install-python")
            install_python_deps_parallel "${2:-true}" "${3:-4}"
            ;;
        "setup-node")
            setup_node_optimized "${2:-18}" "${3:-.}"
            ;;
        "run-tests")
            run_tests_parallel "${2:-all}" "${3:-auto}" "${4:-tests/}"
            ;;
        "optimize-docker")
            optimize_docker_build "${2:-Dockerfile}" "${3:-.}" "${4:-optimized-image}"
            ;;
        "cleanup")
            cleanup_cache "${2:-all}" "${3:-7}"
            ;;
        "stats")
            report_optimization_stats
            ;;
        "help"|*)
            echo "Usage: $0 {generate-cache-key|install-python|setup-node|run-tests|optimize-docker|cleanup|stats|help}"
            echo ""
            echo "Commands:"
            echo "  generate-cache-key [version] [scope]  Generate optimized cache key"
            echo "  install-python [dev] [workers]        Install Python deps in parallel"
            echo "  setup-node [version] [dir]           Setup Node.js with optimization"
            echo "  run-tests [type] [workers] [dir]     Run tests with parallelization"
            echo "  optimize-docker [dockerfile] [ctx]   Optimize Docker build"
            echo "  cleanup [type] [days]                Clean old cache entries"
            echo "  stats                               Show optimization statistics"
            echo "  help                                Show this help"
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"