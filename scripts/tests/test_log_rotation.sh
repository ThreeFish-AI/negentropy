#!/usr/bin/env bash
# test_log_rotation.sh — cli.sh 日志滚动功能的函数级回归测试
#
# 通过 source cli.sh（依赖其 BASH_SOURCE 守卫不触发命令分发）直接调用生产同款函数
# _log_sink / _rotate_log / _file_size，覆盖两条真实落盘路径：
#   用例 1：直接管道写入（验证滚动、保留数上限、内容完整性）；
#   用例 2：FIFO 实链路（验证后台 sink 生命周期、EOF 自然退出、Node 时间戳列注入）。
# 无需启动真实服务，秒级完成。
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="$SCRIPT_DIR/../cli.sh"

# shellcheck source=/dev/null
source "$CLI"
set +e +u   # 关闭 errexit/nounset，由断言逻辑自行控制流程

PASS=0
FAIL=0
ok()  { PASS=$((PASS + 1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad() { FAIL=$((FAIL + 1)); printf '  \033[31mFAIL\033[0m %s\n' "$1"; }
check() { if eval "$2"; then ok "$1"; else bad "$1 — 条件不成立: $2"; fi; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 隔离运行目录 + 小阈值，便于快速触发多次滚动
RUN_DIR="$TMP"
LOG_MAX_BYTES=$((64 * 1024))   # 64KB
LOG_BACKUPS=3

echo "== 用例 1：直接管道 _log_sink，验证滚动 / 保留数上限 / 内容完整性 =="
# 6000 行 × 47B ≈ 282KB，阈值 64KB → 4 次滚动（> LOG_BACKUPS，触发最旧文件淘汰）
{ for ((i = 1; i <= 6000; i++)); do
    printf 'line-%05d-pad-pad-pad-pad-pad-pad-pad-pad-pad\n' "$i"
  done; } | _log_sink svc 0

LOGF="$(log_file svc)"
active_size="$(_file_size "$LOGF")"
rotated_count=$(ls -1 "${LOGF}".[0-9]* 2>/dev/null | wc -l | tr -d ' ')

check "活动日志存在"                    "[ -f '$LOGF' ]"
check "活动日志 ≤ 阈值+单行余量"         "[ $active_size -le $((LOG_MAX_BYTES + 256)) ]"
check "发生滚动（存在 svc.log.1）"        "[ -f '${LOGF}.1' ]"
check "历史文件数严格收敛到 LOG_BACKUPS"  "[ $rotated_count -eq $LOG_BACKUPS ]"
check "最后一行落在活动日志（无损坏）"     "grep -q 'line-06000-' '$LOGF'"

echo "== 用例 2：FIFO 实链路（后台 sink ← fifo），验证 EOF 退出 + 时间戳列注入 =="
FIFO="$TMP/.fifo_w"
rm -f "$FIFO"
mkfifo "$FIFO"
_log_sink wiki 1 < "$FIFO" &      # add_ts=1：Node(ui/wiki) 路径
SINK_PID=$!
# 3000 行 × ~108B（含时间戳列）≈ 324KB → 4 次滚动；写端在块结束时关闭 → sink 收 EOF
{ for ((i = 1; i <= 3000; i++)); do
    printf 'wiki-line-%05d-pad-pad-pad-pad-pad-pad\n' "$i"
  done; } > "$FIFO"
wait "$SINK_PID" 2>/dev/null
sink_alive=1
kill -0 "$SINK_PID" 2>/dev/null && sink_alive=0   # 0 = 仍存活（异常）

WLOG="$(log_file wiki)"
check "wiki 活动日志存在"                 "[ -f '$WLOG' ]"
check "wiki 发生滚动（存在 wiki.log.1）"   "[ -f '${WLOG}.1' ]"
check "EOF 后 sink 已自然退出"            "[ $sink_alive -eq 1 ]"
check "时间戳列已注入（行首为 ts + |）"     "grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2} \\| ' '$WLOG'"
check "wiki 内容完整（末行存活）"          "grep -q 'wiki-line-03000-' '$WLOG'"

echo
if [ "$FAIL" -eq 0 ]; then
  printf '\033[32m== 全部通过：PASS=%d FAIL=%d ==\033[0m\n' "$PASS" "$FAIL"
  exit 0
else
  printf '\033[31m== 存在失败：PASS=%d FAIL=%d ==\033[0m\n' "$PASS" "$FAIL"
  exit 1
fi
