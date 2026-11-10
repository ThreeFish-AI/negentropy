# Claude Tab Group Unifier

自建 Chrome 扩展（unpacked，开发者模式加载），解决 Claude in Chrome「每会话新建 ✅Claude 标签组、组名硬编码、手动改名会被重置」（[anthropics/claude-code#72443](https://github.com/anthropics/claude-code/issues/72443)，无官方配置）的问题。机制背景与实测记录见 [Agent 登录态浏览器接入](../../docs/concepts/operations/claude-in-chrome-access.md) §4。

## 行为（v1.1.0）

- 把所有 Claude 系组（`Claude` / `✅Claude` / `⌛Claude`）收敛为唯一主组，多余组的页签自动并入、空壳移除、Agent 遗留的空白 new tab 丢弃。
- 主组择优：会话使用中的 `✅` 组 > 常驻 `Claude` 组 > 页签最多者（常驻页签并入活组即给会话上下文，官方支持的模式）。
- 主组统一命名 `Claude`；会话操作时官方扩展会临时改回 `✅Claude`，下轮扫描（组事件 4s 去抖 / `chrome.alarms` 每分钟兜底）再归一，属预期抖动。
- 并行会话期间短暂存在第二组，结束后一分钟内收敛。

## 部署

本目录为源码 SSOT。安装时拷贝 `manifest.json` 与 `sw.js` 至仓外稳定目录（本机为 `~/tools/claude-tab-group-unifier/`），再到 `chrome://extensions` 开启开发者模式并「加载已解压的扩展程序」指向该目录。勿直接加载仓内路径：worktree 分支切换会突变 Chrome 侧文件。

## 维护

- 改 `sw.js` 后：先同步拷贝到部署目录，再在 `chrome://extensions` 卡片上点「重新加载」。
- Service Worker 显示「无效」时点「重新加载」即愈。
- 临时停用关卡片开关；彻底移除点「移除」。
- Chrome 启动偶弹「停用开发者模式扩展」提示，属 unpacked 扩展正常现象，保留即可。
- 已保存的标签页分组（saved groups）里若存有 `✅Claude` 条目，本扩展只能在其打开时归并、无法删除保存记录，建议手动取消保存。
