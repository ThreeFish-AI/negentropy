#!/usr/bin/env bash
# cli.sh — Negentropy 全套服务控制脚本
# Usage: ./scripts/cli.sh <command> [options]
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
log_phase() { printf '\n%s[%s] ── %s ──%s\n' "${BOLD}${BLUE}" "$(_ts)" "$*" "${RESET}"; }

# ── 服务注册表 ───────────────────────────────────────────────────────────────────
# 每个服务: name dir port start_cmd
SVC_BACKEND="backend"
SVC_UI="ui"
SVC_WIKI="wiki"
SVC_PERCEIVES="perceives"

svc_dir() {
  case "$1" in
    backend)   echo "apps/negentropy" ;;
    ui)        echo "apps/negentropy-ui" ;;
    wiki)      echo "apps/negentropy-wiki" ;;
    perceives) echo "apps/negentropy-perceives" ;;
  esac
}

svc_port() {
  case "$1" in
    backend)   echo 3292 ;;
    ui)        echo 3192 ;;
    wiki)      echo 3092 ;;
    perceives) echo 2992 ;;
  esac
}

svc_start_cmd() {
  case "$1" in
    backend)   echo "uv run negentropy serve --port 3292" ;;
    ui)        echo "node ./scripts/start-production.mjs" ;;
    wiki)      echo "node ./scripts/start-production.mjs" ;;
    perceives) echo "uv run negentropy-perceives" ;;
  esac
}

# 启动顺序遵循依赖链：perceives（MCP）→ backend（依赖 perceives）→ ui/wiki（依赖 backend）
ALL_SERVICES=("$SVC_PERCEIVES" "$SVC_BACKEND" "$SVC_UI" "$SVC_WIKI")

# ── 进程管理工具 ─────────────────────────────────────────────────────────────────
run_dir_init() { mkdir -p "$RUN_DIR"; }

pid_file() { echo "$RUN_DIR/$1.pid"; }
log_file() { echo "$RUN_DIR/$1.log"; }

# ── 日志时间戳管道（为 Node.js 服务输出添加统一格式时间戳）──────────────────────────
_ts_pipe() {
  local service="$1"
  while IFS= read -r line; do
    printf '%s | %8s | %32s | %s\n' \
      "$(date '+%Y-%m-%d %H:%M:%S')" "INFO" "$service" "$line"
  done
}

# ── 日志生命周期 Banner ──────────────────────────────────────────────────────────
_log_banner() {
  local file="$1" service="$2" action="$3" detail="${4:-}"
  printf '\n%s | %8s | %32s | %s\n' \
    "$(date '+%Y-%m-%d %H:%M:%S')" "INFO" "$service" \
    "══════ ${action}${detail:+ (${detail})} ══════" >> "$file"
}

is_running() {
  local pid pf
  pf="$(pid_file "$1")"
  [[ -f "$pf" ]] || return 1
  pid="$(cat "$pf")"
  kill -0 "$pid" 2>/dev/null
}

port_in_use() {
  lsof -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | grep -q .
}

wait_for_health() {
  # 端口绑定 = 服务存活：去掉 `-f` 让任意 HTTP 响应（含 404/405/406）都视为就绪，
  # 兼容 FastMCP 等仅在 /mcp 子路径暴露端点、根路径 404 的服务；
  # 进程级活性仍由 `is_running` 兜底，崩溃可立即检出。
  local name="$1" port="$2" attempts=60 i=1
  while (( i <= attempts )); do
    if curl -sLo /dev/null "http://localhost:${port}/" 2>/dev/null; then
      return 0
    fi
    is_running "$name" || return 1
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
    log_info "${name} 已在运行 (PID $(cat "$(pid_file "$name")"))"
    return 0
  fi

  if port_in_use "$port"; then
    log_error "端口 ${port} 已被占用，请先停止占用进程"
    lsof -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -5
    return 1
  fi

  log_info "启动 ${name} (port ${port})..."
  _log_banner "$(log_file "$name")" "$name" "STARTING" "port $port"

  if [[ "$name" == "ui" || "$name" == "wiki" ]]; then
    # Node.js 服务：通过 FIFO 管道添加时间戳，同时保持 PID 追踪
    local fifo="/tmp/.negentropy_${name}_log_fifo"
    rm -f "$fifo"; mkfifo "$fifo"
    _ts_pipe "$name" < "$fifo" >> "$(log_file "$name")" &
    (cd "$REPO_ROOT/$dir" && exec $cmd) >> "$fifo" 2>&1 &
    rm -f "$fifo"
  else
    # Python 服务：自带格式化，直接重定向
    (cd "$REPO_ROOT/$dir" && exec $cmd) >> "$(log_file "$name")" 2>&1 &
  fi
  echo $! > "$(pid_file "$name")"

  if wait_for_health "$name" "$port"; then
    log_ok "${name} 已就绪 (PID $(cat "$(pid_file "$name")"))"
  else
    log_error "${name} 健康检查失败，最近日志："
    tail -20 "$(log_file "$name")" 2>/dev/null
    # 清理失败的孤儿进程与陈旧 PID 文件，避免 is_running 误判导致后续重试被静默跳过
    stop_service "$name" >/dev/null 2>&1 || true
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
    _log_banner "$(log_file "$name")" "$name" "STOPPED"
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
  # 倒序停止：先停下游（ui/wiki），再停 backend，最后停 perceives，
  # 避免下游在依赖被回收期间发起新请求。
  local idx
  for (( idx=${#ALL_SERVICES[@]}-1; idx>=0; idx-- )); do
    stop_service "${ALL_SERVICES[idx]}"
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
  log_info "安装 backend + perceives 依赖 (并行)..."
  (cd "$REPO_ROOT/apps/negentropy" && uv sync --dev) &
  local backend_pid=$!
  (cd "$REPO_ROOT/apps/negentropy-perceives" && uv sync --dev) &
  local perceives_pid=$!
  local _rc=0; wait "$backend_pid" || _rc=$?; wait "$perceives_pid" || _rc=$?
  (( _rc )) && { log_error "backend/perceives 依赖安装失败"; exit 1; }
  log_ok "backend + perceives 依赖已安装"

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
    # 依赖链：perceives（MCP 前置）→ backend（wiki SSG 数据源）
    # backend 在 MCP 工具调用链上依赖 perceives，必须先就绪。
    start_service "$SVC_PERCEIVES" || log_warn "perceives 启动失败，backend 与 wiki SSG 可能降级"
    start_service "$SVC_BACKEND" || log_warn "backend 启动失败，wiki SSG 将退化为空"

    # agents-chat-core 是 ui/wiki 共享的工作区依赖，且 tsup 配置 clean:true
    # （每次构建先清空 dist）。若任由下方并行的两个 pnpm build 各自触发 prebuild
    # 重建，会并发清空/写入同一 dist 而偶发构建失败。故在此显式顺序重建一次，
    # 并通过 NEGENTROPY_CORE_PREBUILT 让并行子进程的 prebuild 跳过重建。
    log_info "构建 agents-chat-core..."
    (cd "$REPO_ROOT" && pnpm --filter @negentropy/agents-chat-core build) \
      || { log_error "agents-chat-core 构建失败"; cmd_stop; exit 1; }

    # NEGENTROPY_CORE_PREBUILT=1：core 已在上方构建，跳过子进程 prebuild 的并发重建。
    log_info "构建 ui + wiki (并行)..."
    (cd "$REPO_ROOT/apps/negentropy-ui" && NEGENTROPY_CORE_PREBUILT=1 pnpm build) &
    local build_ui_pid=$!
    (cd "$REPO_ROOT/apps/negentropy-wiki" && NEGENTROPY_CORE_PREBUILT=1 pnpm build) &
    local build_wiki_pid=$!
    local _rc=0; wait "$build_ui_pid" || _rc=$?; wait "$build_wiki_pid" || _rc=$?
    (( _rc )) && { log_error "前端构建失败"; cmd_stop; exit 1; }
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
  printf "  %-10s %s\n" "backend"   "http://localhost:3292"
  printf "  %-10s %s\n" "ui"        "http://localhost:3192"
  printf "  %-10s %s\n" "wiki"      "http://localhost:3092"
  printf "  %-10s %s\n" "perceives" "http://localhost:2992"
  echo ""
  log_info "查看日志: ./scripts/cli.sh logs [backend|ui|wiki|perceives]"
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
  if [[ "$target" != "all" ]]; then
    local valid=false
    for svc in "${ALL_SERVICES[@]}"; do
      [[ "$target" == "$svc" ]] && valid=true && break
    done
    if ! $valid; then
      log_error "未知服务 '${target}'，可用: ${ALL_SERVICES[*]}"
      exit 1
    fi
  fi
  if [[ "$target" == "all" ]]; then
    tail -f "$(log_file backend)" "$(log_file ui)" "$(log_file wiki)" "$(log_file perceives)" 2>/dev/null \
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
  run_dir_init
  # 依赖链：perceives（MCP 前置）→ backend（wiki SSG 数据源）
  start_service "$SVC_PERCEIVES" || log_warn "perceives 启动失败，backend 与 wiki SSG 可能降级"
  start_service "$SVC_BACKEND" || log_warn "backend 启动失败，wiki SSG 将退化为空"
  log_info "构建 ui + wiki (并行)..."
  (cd "$REPO_ROOT/apps/negentropy-ui" && pnpm build) &
  local pid_ui=$!
  (cd "$REPO_ROOT/apps/negentropy-wiki" && pnpm build) &
  local pid_wiki=$!
  local _rc=0; wait "$pid_ui" || _rc=$?; wait "$pid_wiki" || _rc=$?
  # 倒序回收，先停 backend 再停 perceives
  if (( _rc )); then
    log_error "前端构建失败"
    stop_service "$SVC_BACKEND"
    stop_service "$SVC_PERCEIVES"
    exit 1
  fi
  stop_service "$SVC_BACKEND"
  stop_service "$SVC_PERCEIVES"
  log_ok "前端构建完成"
}

# ── 帮助信息 ──────────────────────────────────────────────────────────────────────
cmd_help() {
  cat <<EOF
${BOLD}Negentropy 服务控制脚本${RESET}

${BOLD}用法:${RESET}
  ./scripts/cli.sh <command> [options]

${BOLD}命令:${RESET}
  start [--no-pull] [--skip-build]   全生命周期启动所有服务
  restart [--no-pull] [--skip-build] 停止后重新启动
  stop                               优雅停止所有服务
  status                             查看服务运行状态
  logs [backend|ui|wiki|perceives]   实时查看日志（默认全部）
  build                              仅构建前端（不启动）

${BOLD}选项:${RESET}
  --no-pull      跳过 git pull
  --skip-build   跳过前端构建

${BOLD}示例:${RESET}
  ./scripts/cli.sh start              # 完整启动
  ./scripts/cli.sh restart --no-pull  # 不拉代码，直接重启
  ./scripts/cli.sh logs backend       # 查看后端日志
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
