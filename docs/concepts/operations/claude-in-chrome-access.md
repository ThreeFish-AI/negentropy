---
sidebar_position: 6
title: "Agent 登录态浏览器接入 · Claude in Chrome"
---
# Agent 登录态浏览器接入（Claude in Chrome）

> 本文遵循用户级全局配置 `~/.claude/CLAUDE.md` 的协作协议与循证要求。核心锚点：
> - 官方机制：[Use Claude Code with Chrome](https://code.claude.com/docs/en/chrome)（扩展、native messaging、权限与排错全量说明）
> - 标签组硬编码现状：[anthropics/claude-code#72443](https://github.com/anthropics/claude-code/issues/72443)（closed as duplicate of #55332）
> - 与 [浏览器操作 MCP 集成方案](../design/browser-automation-mcp-integration.md) 的分工：彼为 Playwright headless 隔离档案做实机回归；本文为 Agent 会话直接使用**日常浏览器的真实登录态**做交互式访问，两者正交不互替
> - 浏览器验证协议（登录态一律来源于真实用户浏览器，Agent 不碰 OAuth/SSO）：`~/.agents/docs/browser-validation.md`

## 1. 目标与选型结论

- **目标**：Agent（Claude Code 会话，含 Orca workspace 拉起的子会话）访问网页时直接复用日常 Chrome 的全部登录态，无需逐站重新登录或导出 `storageState`。
- **选型结论**：**Claude in Chrome** 官方扩展（[Chrome Web Store](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn)）。Claude 在可见窗口中新开标签页实时操作，共享浏览器登录态；遇登录页或 CAPTCHA 暂停交还用户。该机制与浏览器验证协议完全同构（登录态来自真实用户浏览器，Agent 不执行任何认证流程）。
- **排除项**：`chrome_devtools` / `playwright` MCP 均为隔离 user-data-dir 的无登录态实例；且 Chrome 136 起禁止在默认 user-data-dir 上启用远程调试口，无法把常规 CDP 客户端直连日常 Chrome。

## 2. 前置条件与有效开关

前置条件（2026-11-10 全量实测通过）：扩展 v1.0.106 已安装并完成配对、native messaging host（`~/.claude/chrome/chrome-native-host`）在位、Claude Code ≥ 2.1.290、OAuth（claude.ai 账号）登录。注意 API key 或 `claude setup-token` 认证模式下此功能被强制关闭。

有效开关共三条等价路径：

- **用户级 settings.json（推荐，对 Orca 等 SDK 子会话生效）**：`~/.claude/settings.json` 的 `env` 块写入 `"CLAUDE_CODE_ENABLE_CFC": "1"`。官方允许用户级配置，明确拒绝项目级（仓库不得自行连接作者浏览器）。
- **进程环境变量**：同名变量注入启动环境。
- **交互 CLI 显式开关**：`claude --chrome`，或在交互会话内执行 `/chrome` 选「Enabled by default」。

反例（勿踩）：仅写 `~/.claude.json` 的 `claudeInChromeDefaultEnabled: true` **不激活**集成（无 `--chrome` 的新会话实测无浏览器工具），该键是 UI 状态而非运行时开关。开关只对之后启动的会话生效，进行中的会话不可追溯。

## 3. 会话内使用与排错

- **工具面**：会话内表现为 `claude-in-chrome` MCP 服务器，工具如 `mcp__claude-in-chrome__tabs_context_mcp`、`tabs_create_mcp`、`navigate`、`read_page`。
- **站点授权**：首次在某站点操作会触发扩展的站点级授权；无值守会话建议提前在扩展设置里放行常用站点。
- **常见故障**：`Browser extension is not connected` 优先查扩展与 Claude Code 是否同 claude.ai 账号且同组织（多组织成员的高频坑，用 `/status` 对组织）；网络需可达 `bridge.claudeusercontent.com`；长会话中扩展 service worker 休眠导致断连，`/chrome` 选「Reconnect extension」恢复。
- **验证手法**：`claude -p ... --output-format stream-json --verbose` 起一次性会话，解析 init 事件 `mcp_servers` 中 `claude-in-chrome` 的 `status`（应为 `connected`）；`--debug` 在 `-p` 模式无日志输出，问模型列举工具不可靠，均勿依赖。

## 4. 标签组统一（claude-tab-group-unifier）

- **问题**：官方扩展为每个会话创建独立标签组，组名硬编码 `✅Claude`（会话中）/ `⌛Claude`（闲置标记），手动改名会被重置，无任何官方配置（[#72443](https://github.com/anthropics/claude-code/issues/72443)）；并行会话（多 Orca workspace 同跑）下组迅速膨胀。
- **方案**：自建伴生扩展（源码 SSOT 在 [`scripts/claude-tab-group-unifier/`](../../../scripts/claude-tab-group-unifier/)），把 `Claude` / `✅Claude` / `⌛Claude` 全部同族组收敛为唯一主组：多余组的页签自动并入、空壳移除、Agent 遗留空白页丢弃；主组择优「会话在用的 ✅ 组 > 常驻 Claude 组 > 页签最多者」（常驻页签并入活组等价于给会话上下文，官方支持的模式）；触发为组事件 4s 去抖加 `chrome.alarms` 每分钟兜底扫描。
- **已知抖动**：会话操作期间主组名被官方扩展临时改回 `✅Claude`，下轮扫描归一为 `Claude`（按组 ID 追踪，改名不破坏会话）；并行会话期间短暂存在第二组，结束后一分钟内收敛。
- **关键教训**：`✅→⌛` 状态翻转时序不受控（实测会话结束 4 分钟不翻），不可作为归并触发器；unpacked 扩展的 Service Worker 初次加载可能显示「无效」，在 `chrome://extensions` 点「重新加载」即愈。
- **部署**：拷贝 `manifest.json` 与 `sw.js` 至仓外稳定目录（本机为 `~/tools/claude-tab-group-unifier/`）后以开发者模式「加载未打包」安装；勿直接加载仓内路径（worktree 分支切换会突变 Chrome 侧文件）。改源码后同样需重载。

## 5. 兜底路径

当集成不可用（旧会话、扩展断连）且任务需要登录态时，可用 `orca computer`（Orca computer-use）以无障碍树后台驱动日常 Chrome：实测可定位地址栏、导航、读取登录态页面内容。注意组合键必须用 `hotkey`（`press-key` 只收单键）、a11y 元素索引易失效须每次重查、关闭页签前必须先验证窗口标题为目标页。
