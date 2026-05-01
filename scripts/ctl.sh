#!/usr/bin/env bash
# ctl.sh — Negentropy 全套服务控制脚本
# Usage: ./scripts/ctl.sh <command> [options]
# Commands: start | stop | restart | status | logs | build
set -euo pipefail

# ── 路径 ────────────────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN_DIR="$REPO_ROOT/.temp/run"

# ── 颜色 ────────────────────────────────────────────────────────────────────────
RED="$(tput setaf 1 2>/dev/null || echo '')"
GREEN="$(tput setaf 2 2>/dev/null || echo '')"
YELLOW="$(tput setaf 3 2>/dev/null || echo '')"
BLUE="$(tput setaf 4 2>/dev/null || echo '')"
BOLD="$(tput bold 2>/dev/null || echo '')"
RESET="$(tput sgr0 2>/dev/null || echo '')"

# ── 日志函数 ─────────────────────────────────────────────────────────────────────
_ts() { date '+%Y-%m-%d %H:%M:%S'; }

log_info()  { echo "${BLUE}[$(_ts)]${RESET} $*"; }
log_ok()    { echo "${GREEN}[$(_ts)]${RESET} $*"; }
log_warn()  { echo "${YELLOW}[$(_ts)]${RESET} $*"; }
log_error() { echo "${RED}[$(_ts)]${RESET} $*" >&2; }
log_phase() { echo "\n${BOLD}${BLUE}[$(_ts)] ── $* ──${RESET}"; }

# ── 服务注册表 ───────────────────────────────────────────────────────────────────
# 每个服务: name dir port start_cmd
SVC_BACKEND="backend"
SVC_UI="ui"
SVC_WIKI="wiki"

svc_dir() {
  case "$1" in
    backend) echo "apps/negentropy" ;;
    ui)      echo "apps/negentropy-ui" ;;
    wiki)    echo "apps/negentropy-wiki" ;;
  esac
}

svc_port() {
  case "$1" in
    backend) echo 3292 ;;
    ui)      echo 3192 ;;
    wiki)    echo 3092 ;;
  esac
}

svc_start_cmd() {
  case "$1" in
    backend) echo "uv run negentropy serve --port 3292" ;;
    ui)      echo "node ./scripts/start-production.mjs" ;;
    wiki)    echo "node ./scripts/start-production.mjs" ;;
  esac
}

ALL_SERVICES=("$SVC_BACKEND" "$SVC_UI" "$SVC_WIKI")

# ── 进程管理工具 ─────────────────────────────────────────────────────────────────
run_dir_init() { mkdir -p "$RUN_DIR"; }

pid_file() { echo "$RUN_DIR/$1.pid"; }
log_file() { echo "$RUN_DIR/$1.log"; }

is_running() {
  local pid pid_file="$RUN_DIR/$1.pid"
  [[ -f "$pid_file" ]] || return 1
  pid="$(cat "$pid_file")"
  kill -0 "$pid" 2>/dev/null
}

port_in_use() {
  lsof -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | grep -q .
}

wait_for_health() {
  local name="$1" port="$2" attempts=60 i=1
  while (( i <= attempts )); do
    if curl -sfLo /dev/null "http://localhost:${port}/" 2>/dev/null; then
      return 0
    fi
    sleep 1
    ((i++))
  done
  return 1
}

start_service() {
  local name="$1" port cmd dir
  dir="$(svc_dir "$name")"
  port="$(svc_port "$name")"
  cmd="$(svc_start_cmd "$name")"

  if is_running "$name"; then
    log_warn "${name} 已在运行 (PID $(cat "$(pid_file "$name")"))"
    return 0
  fi

  if port_in_use "$port"; then
    log_error "端口 ${port} 已被占用，请先停止占用进程"
    lsof -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -5
    return 1
  fi

  log_info "启动 ${name} (port ${port})..."
  (cd "$REPO_ROOT/$dir" && eval "$cmd") >> "$(log_file "$name")" 2>&1 &
  echo $! > "$(pid_file "$name")"

  if wait_for_health "$name" "$port"; then
    log_ok "${name} 已就绪 (PID $(cat "$(pid_file "$name")"))"
  else
    log_error "${name} 健康检查失败，最近日志："
    tail -20 "$(log_file "$name")" 2>/dev/null
    return 1
  fi
}

stop_service() {
  local name="$1" pid pid_path port
  pid_path="$(pid_file "$name")"
  port="$(svc_port "$name")"

  if [[ -f "$pid_path" ]]; then
    pid="$(cat "$pid_path")"
    if kill -0 "$pid" 2>/dev/null; then
      log_info "停止 ${name} (PID ${pid})..."
      kill "$pid" 2>/dev/null || true
      local waited=0
      while kill -0 "$pid" 2>/dev/null && (( waited < 10 )); do
        sleep 1
        ((waited++))
      done
      if kill -0 "$pid" 2>/dev/null; then
        log_warn "${name} 未响应 SIGTERM，发送 SIGKILL"
        kill -9 "$pid" 2>/dev/null || true
      fi
    fi
    rm -f "$pid_path"
  fi

  # 端口兜底清理
  local pids
  pids="$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null)" || true
  if [[ -n "$pids" ]]; then
    log_warn "清理端口 ${port} 上的孤儿进程: $(echo $pids | tr '\n' ' ')"
    echo "$pids" | xargs kill 2>/dev/null || true
  fi
}

# ── 子命令: stop ─────────────────────────────────────────────────────────────────
cmd_stop() {
  log_phase "停止所有服务"
  for svc in "${ALL_SERVICES[@]}"; do
    stop_service "$svc"
  done
  log_ok "所有服务已停止"
}

# ── 子命令: status ───────────────────────────────────────────────────────────────
cmd_status() {
  for svc in "${ALL_SERVICES[@]}"; do
    local port pid uptime status
    port="$(svc_port "$svc")"
    if is_running "$svc"; then
      pid="$(cat "$(pid_file "$svc")")"
      uptime="$(ps -o etime= -p "$pid" 2>/dev/null | xargs || echo "?")"
      status="${GREEN}RUNNING${RESET}"
    else
      pid="-"
      uptime="-"
      status="${RED}STOPPED${RESET}"
    fi
    printf "  %-10s [%b]  PID %s  port %s  uptime %s\n" \
      "$svc" "$status" "$pid" "$port" "$uptime"
  done
}

# ── 子命令: start ────────────────────────────────────────────────────────────────
cmd_start() {
  local no_pull=false skip_build=false
  for arg in "$@"; do
    case "$arg" in
      --no-pull)    no_pull=true ;;
      --skip-build) skip_build=true ;;
    esac
  done

  run_dir_init

  # Phase 1 — 预检
  log_phase "Phase 1/5: 预检"
  for tool in uv pnpm; do
    if ! command -v "$tool" &>/dev/null; then
      log_error "${tool} 未安装，请先安装"
      exit 1
    fi
  done
  log_ok "uv $(uv --version 2>/dev/null | head -1), pnpm $(pnpm --version 2>/dev/null)"

  if ! $no_pull && git -C "$REPO_ROOT" rev-parse --is-inside-work-tree &>/dev/null; then
    log_info "拉取最新代码..."
    git -C "$REPO_ROOT" pull --ff-only || log_warn "git pull 失败，继续使用当前代码"
  fi

  # Phase 2 — 依赖安装
  log_phase "Phase 2/5: 依赖安装"
  log_info "安装 backend 依赖..."
  (cd "$REPO_ROOT/apps/negentropy" && uv sync --dev)
  log_ok "backend 依赖已安装"

  log_info "安装 ui + wiki 依赖 (并行)..."
  (cd "$REPO_ROOT/apps/negentropy-ui" && pnpm install) &
  local ui_pid=$!
  (cd "$REPO_ROOT/apps/negentropy-wiki" && pnpm install) &
  local wiki_pid=$!
  local _rc=0; wait "$ui_pid" || _rc=$?; wait "$wiki_pid" || _rc=$?
  (( _rc )) && { log_error "前端依赖安装失败"; exit 1; }
  log_ok "前端依赖已安装"

  # Phase 3 — 数据库迁移
  log_phase "Phase 3/5: 数据库迁移"
  if command -v pg_isready &>/dev/null; then
    if ! pg_isready -h localhost -p 5432 &>/dev/null; then
      log_error "PostgreSQL 未运行 (localhost:5432)，请先启动数据库"
      exit 1
    fi
  fi
  (cd "$REPO_ROOT/apps/negentropy" && uv run alembic upgrade head)
  log_ok "数据库已迁移至最新版本"

  # Phase 4 — 前端构建
  if ! $skip_build; then
    log_phase "Phase 4/5: 前端构建"
    log_info "构建 ui + wiki (并行)..."
    (cd "$REPO_ROOT/apps/negentropy-ui" && pnpm build) &
    local build_ui_pid=$!
    (cd "$REPO_ROOT/apps/negentropy-wiki" && pnpm build) &
    local build_wiki_pid=$!
    local _rc=0; wait "$build_ui_pid" || _rc=$?; wait "$build_wiki_pid" || _rc=$?
    (( _rc )) && { log_error "前端构建失败"; exit 1; }
    log_ok "前端构建完成"
  else
    log_phase "Phase 4/5: 前端构建 (跳过)"
  fi

  # Phase 5 — 服务启动
  log_phase "Phase 5/5: 服务启动"
  # 注册 trap：启动过程中 Ctrl+C 清理已启动的服务
  trap 'log_warn "收到中断信号，清理已启动的服务..."; cmd_stop; exit 130' INT TERM

  for svc in "${ALL_SERVICES[@]}"; do
    start_service "$svc" || { log_error "${svc} 启动失败，中止"; cmd_stop; exit 1; }
  done

  trap - INT TERM

  echo ""
  log_ok "所有服务已启动"
  echo ""
  printf "  %-10s %s\n" "backend" "http://localhost:3292"
  printf "  %-10s %s\n" "ui"      "http://localhost:3192"
  printf "  %-10s %s\n" "wiki"    "http://localhost:3092"
  echo ""
  log_info "查看日志: ./scripts/ctl.sh logs [backend|ui|wiki]"
}

# ── 子命令: restart ──────────────────────────────────────────────────────────────
cmd_restart() {
  log_phase "重启所有服务"
  cmd_stop
  cmd_start "$@"
}

# ── 子命令: logs ─────────────────────────────────────────────────────────────────
cmd_logs() {
  local target="${1:-all}"
  if [[ "$target" == "all" ]]; then
    tail -f "$(log_file backend)" "$(log_file ui)" "$(log_file wiki)" 2>/dev/null \
      || log_error "无日志文件，请先启动服务"
  else
    local lf
    lf="$(log_file "$target")"
    if [[ -f "$lf" ]]; then
      tail -f "$lf"
    else
      log_error "无 ${target} 日志文件，请先启动服务"
      exit 1
    fi
  fi
}

# ── 子命令: build ────────────────────────────────────────────────────────────────
cmd_build() {
  log_phase "仅构建（不启动）"
  log_info "构建 ui + wiki (并行)..."
  (cd "$REPO_ROOT/apps/negentropy-ui" && pnpm build) &
  local pid_ui=$!
  (cd "$REPO_ROOT/apps/negentropy-wiki" && pnpm build) &
  local pid_wiki=$!
  local _rc=0; wait "$pid_ui" || _rc=$?; wait "$pid_wiki" || _rc=$?
  (( _rc )) && { log_error "前端构建失败"; exit 1; }
  log_ok "前端构建完成"
}

# ── 帮助信息 ──────────────────────────────────────────────────────────────────────
cmd_help() {
  cat <<EOF
${BOLD}Negentropy 服务控制脚本${RESET}

${BOLD}用法:${RESET}
  ./scripts/ctl.sh <command> [options]

${BOLD}命令:${RESET}
  start [--no-pull] [--skip-build]   全生命周期启动所有服务
  restart [--no-pull] [--skip-build] 停止后重新启动
  stop                               优雅停止所有服务
  status                             查看服务运行状态
  logs [backend|ui|wiki]             实时查看日志（默认全部）
  build                              仅构建前端（不启动）

${BOLD}选项:${RESET}
  --no-pull      跳过 git pull
  --skip-build   跳过前端构建

${BOLD}示例:${RESET}
  ./scripts/ctl.sh start              # 完整启动
  ./scripts/ctl.sh restart --no-pull  # 不拉代码，直接重启
  ./scripts/ctl.sh logs backend       # 查看后端日志
EOF
}

# ── 主入口 ────────────────────────────────────────────────────────────────────────
case "${1:-help}" in
  start)   shift; cmd_start "$@" ;;
  stop)    cmd_stop ;;
  restart) shift; cmd_restart "$@" ;;
  status)  cmd_status ;;
  logs)    shift; cmd_logs "${1:-all}" ;;
  build)   cmd_build ;;
  help|*)  cmd_help ;;
esac
