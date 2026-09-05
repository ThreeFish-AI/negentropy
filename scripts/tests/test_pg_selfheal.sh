#!/usr/bin/env bash
# test_pg_selfheal.sh — cli.sh Phase 3 PostgreSQL 自愈链的函数级回归测试
#
# 通过 source cli.sh（依赖其 BASH_SOURCE 守卫不触发命令分发）直接调用生产同款函数
# _resolve_pg_formula / _pg_datadir / _clean_stale_pg_pid / _wait_pg_ready / _ensure_postgres，
# 覆盖：
#   用例 1：formula 解析（显式覆盖优先 + 默认探测）；
#   用例 2：数据目录派生（架构无关）；
#   用例 3：残留 postmaster.pid 清理（死 PID / 存活非 postgres PID / 无锁）；
#   用例 4：就绪轮询与编排器（依赖运行中的 PG，无 PG 则优雅跳过）。
# 无需 brew/services 真实启停，秒级完成。
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
check() { if eval "$2"; then ok "$1"; else bad "$1 — 条件不成立: $2"; fi }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "== 用例 1：_resolve_pg_formula =="
f="$(NEGENTROPY_PG_FORMULA=postgresql@17 _resolve_pg_formula)"
check "显式 NEGENTROPY_PG_FORMULA 覆盖优先" "[ '$f' = postgresql@17 ]"

unset NEGENTROPY_PG_FORMULA
f="$(_resolve_pg_formula)"
if command -v brew &>/dev/null; then
  check "无覆盖时返回已装 formula（非空）" "[ -n '$f' ]"
  check "且为合法 formula 名" "echo '$f' | grep -qE '^postgresql(@1[678])?$'"
else
  ok "无 brew 环境，跳过默认探测用例"
fi

echo "== 用例 2：_pg_datadir（架构无关派生）=="
d="$(_pg_datadir postgresql@16)"
check "数据目录含 /var/postgresql@16 后缀" "echo '$d' | grep -q '/var/postgresql@16$'"

echo "== 用例 3：_clean_stale_pg_pid 残留锁清理 =="
FAKE_PG="$TMP/fake_pg"
mkdir -p "$FAKE_PG"

# 3a 无 pid 文件 → 静默返回 0
rm -f "$FAKE_PG/postmaster.pid"
out="$(_clean_stale_pg_pid "$FAKE_PG"; echo rc=$?)"
check "无 pid 文件时静默返回 0" "echo '$out' | grep -q 'rc=0'"

# 3b 死 PID（未回收占用）→ 判残留锁并清理
echo "999999" > "$FAKE_PG/postmaster.pid"
_clean_stale_pg_pid "$FAKE_PG" >/dev/null
check "死 PID 残留锁被清理" "[ ! -f '$FAKE_PG/postmaster.pid' ]"

# 3c 存活但非 postgres 进程的 PID（OS 回收复用为他进程，本次根因）→ 判残留锁并清理
printf '%s\n/tmp\n' "$$" > "$FAKE_PG/postmaster.pid"
_clean_stale_pg_pid "$FAKE_PG" >/dev/null
check "存活非 postgres PID 残留锁被清理" "[ ! -f '$FAKE_PG/postmaster.pid' ]"

echo "== 用例 4：_wait_pg_ready / _ensure_postgres（依赖运行中的 PG）=="
if command -v pg_isready &>/dev/null && pg_isready -h localhost -p 5432 &>/dev/null; then
  _wait_pg_ready localhost 5432 >/dev/null 2>&1; rc=$?
  check "_wait_pg_ready 对就绪 PG 返回 0" "[ $rc -eq 0 ]"
  NEGENTROPY_PG_READY_TIMEOUT=5 _ensure_postgres >/dev/null 2>&1; rc=$?
  check "_ensure_postgres 在 PG 就绪时返回 0" "[ $rc -eq 0 ]"
else
  ok "无 pg_isready 或 PG 未运行，跳过集成用例"
fi

echo
if [ "$FAIL" -eq 0 ]; then
  printf '\033[32m== 全部通过：PASS=%d FAIL=%d ==\033[0m\n' "$PASS" "$FAIL"
  exit 0
else
  printf '\033[31m== 存在失败：PASS=%d FAIL=%d ==\033[0m\n' "$PASS" "$FAIL"
  exit 1
fi
