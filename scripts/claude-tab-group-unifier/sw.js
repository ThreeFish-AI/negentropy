// Claude Tab Group Unifier v2
// 目标：任一时刻只保留一个 Claude 系标签组（Claude / ✅Claude / ⌛Claude 均视为同族），
// 其余同族组的页签自动并入主组后移除空壳。官方扩展无此配置（issue #72443/#55332）。
// 主组择优：已命名 "Claude" 的 > 会话使用中的 ✅ 组 > 页签最多的组。
// 会话使用中的组名会被官方扩展在操作时改回 ✅Claude，属预期抖动，不影响收敛。
// 另以每分钟 alarms 兜底，事件丢失也能收敛。

const CLAUDE_RE = /^(✅|⌛|⏳)?Claude$/;
const isClaudeGroup = (t) => CLAUDE_RE.test(t || "");
const isNewTab = (url) => /^chrome:\/\/newtab\/?$/i.test(url || "");

async function normalize() {
  try {
    const groups = (await chrome.tabGroups.query({})).filter((g) => isClaudeGroup(g.title));
    if (groups.length === 0) return;

    // 主组择优：✅（会话在用，保其稳定；常驻页签并入活组=给它上下文，官方支持的模式）
    // > 精确 "Claude" 常驻主组 > 页签数多
    let master = groups.find((g) => g.title.startsWith("✅"));
    if (!master) master = groups.find((g) => g.title === "Claude");
    if (!master) {
      master = await Promise.all(
        groups.map(async (g) => ({ g, n: (await chrome.tabs.query({ groupId: g.id })).length }))
      ).then((rs) => rs.sort((a, b) => b.n - a.n)[0].g);
    }
    // 复核主组仍存在（择优期间可能被官方扩展清理）
    if (!(await chrome.tabGroups.get(master.id).catch(() => null))) return;

    const rest = groups.filter((g) => g.id !== master.id);
    for (const g of rest) {
      const fresh = await chrome.tabGroups.get(g.id).catch(() => null);
      if (!fresh || !isClaudeGroup(fresh.title)) continue;
      const tabs = await chrome.tabs.query({ groupId: g.id });
      const keep = tabs.filter((t) => !isNewTab(t.url));
      if (keep.length) {
        await chrome.tabs.group({ tabIds: keep.map((t) => t.id), groupId: master.id });
      }
      // 丢弃 Agent 遗留的空白 new tab；组迁空后由 Chrome 自动移除
      const drop = tabs.filter((t) => isNewTab(t.url));
      if (drop.length) await chrome.tabs.remove(drop.map((t) => t.id));
    }

    // 主组统一命名为 "Claude"；会话操作时官方扩展会改回 ✅Claude，
    // 下轮扫描再归一（扩展按组 ID 追踪会话，改名不破坏其使用）
    const m = await chrome.tabGroups.get(master.id).catch(() => null);
    if (m && m.title !== "Claude") {
      await chrome.tabGroups.update(master.id, { title: "Claude" });
    }
  } catch (e) {
    console.warn("[claude-tab-group-unifier]", e);
  }
}

let timer = null;
const schedule = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(normalize, 4000); // 去抖，等组状态稳定
};

chrome.tabGroups.onCreated.addListener((g) => isClaudeGroup(g.title) && schedule());
chrome.tabGroups.onUpdated.addListener((g) => isClaudeGroup(g.title) && schedule());
chrome.tabs.onRemoved.addListener(schedule); // 组随末页关闭时事件可能只落在 tabs 上
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("sweep", { periodInMinutes: 1 });
  schedule();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("sweep", { periodInMinutes: 1 });
  schedule();
});
chrome.alarms.onAlarm.addListener((a) => a.name === "sweep" && normalize());
