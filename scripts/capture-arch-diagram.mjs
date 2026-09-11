#!/usr/bin/env node
/**
 * capture-arch-diagram.mjs — 通用单图采集器：把任一 archify 交互产物采集为双主题 PNG。
 *
 * 与 capture-arch-media.mjs（旗舰专用，含引导叙事 MP4/GIF）并存、互不改动：
 * 本脚本只做「静图双主题」这一件事，供 docs/assets/architecture/<cat>/ 批量产物使用。
 *
 * 用法：
 *   node scripts/capture-arch-diagram.mjs --html docs/assets/architecture/core/x.html \
 *        --out-dir docs/assets/architecture/core --slug x [--themes=dark,light] [--max-bytes=1048576]
 *
 * 设计要点（承自旗舰脚本的实测结论，详见 docs/.agents/doc-media-assets.md）：
 *   1. 静态图走产物内置 exportMenu（RASTER_SCALE=4 原生矢量栅格化），不用整页截图。
 *   2. 拦截导出 blob 必须「记录但透传」URL.createObjectURL，取最后一个 blob。
 *   3. PNG 实际尺寸必须等于 viewBox × 4（防半幅/空图），尺寸断言按每图 viewBox 动态计算。
 *
 * 零 npm 依赖：CDP over WebSocket（Node 内置 WebSocket，需 Node >= 22）。
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CHROME =
  process.env.ARCHIFY_CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// ── CLI ────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = {
    html: "",
    outDir: "",
    slug: "",
    themes: "dark,light",
    maxBytes: 1024 * 1024,
  };
  const alias = { out: "outDir", "out-dir": "outDir" };
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    const m = /^--([^=]+)(?:=(.*))?$/.exec(raw);
    if (!m) continue;
    const [, kRaw, veq] = m;
    const k = alias[kRaw] ?? kRaw;
    // 支持 --k=v 与 --k v 两种形式
    const v = veq !== undefined ? veq : (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true);
    if (k === "themes" || k === "theme") opts.themes = String(v);
    else if (k === "max-bytes") opts.maxBytes = Number(v);
    else if (k in opts) opts[k] = v;
    else throw new Error(`unknown flag: --${kRaw}`);
  }
  opts.themeList = String(opts.themes).split(",").map((s) => s.trim()).filter(Boolean);
  if (!opts.html || !opts.outDir || !opts.slug) {
    throw new Error("必须提供 --html / --out-dir / --slug");
  }
  return opts;
}

// ── 最小 CDP 客户端（与旗舰脚本同构）────────────────────────────────────────
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? "")})`)) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 120_000);
    });
  }
  /** 在页面里跑一段 async 函数体，返回 JSON 化结果。 */
  async evalFn(fnSource, ...args) {
    const expr = `(${fnSource}).apply(null, ${JSON.stringify(args)})`;
    const r = await this.send("Runtime.evaluate", {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(`页面内异常: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    }
    return r.result?.value;
  }
}

async function launchChrome(fileUrl) {
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--force-color-profile=srgb",
    // file:// 下导出与字体内联需要
    "--allow-file-access-from-files",
    "--autoplay-policy=no-user-gesture-required",
    "--remote-debugging-port=0",
    `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), "arch-diagram-"))}`,
    fileUrl,
  ];
  const child = spawn(CHROME, args, { stdio: ["ignore", "pipe", "pipe"] });
  let buf = "";
  const wsUrl = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Chrome 启动超时。stderr:\n${buf.slice(0, 2000)}`)), 30_000);
    child.stderr.on("data", (d) => {
      buf += d;
      const m = /ws:\/\/127\.0\.0\.1:(\d+)\/devtools\/browser\/\S+/.exec(buf);
      if (m) {
        clearTimeout(t);
        resolve({ browserWs: m[0], port: m[1] });
      }
    });
    child.on("exit", (c) => { clearTimeout(t); reject(new Error(`Chrome 提前退出 (${c})\n${buf.slice(0, 2000)}`)); });
  });

  let pageWs = null;
  for (let i = 0; i < 60 && !pageWs; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${wsUrl.port}/json/list`)).json();
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) pageWs = page.webSocketDebuggerUrl;
    } catch { /* 端口尚未就绪 */ }
    if (!pageWs) await new Promise((r) => setTimeout(r, 120));
  }
  if (!pageWs) throw new Error("没有找到可连接的 page target");

  const ws = new WebSocket(pageWs);
  await once(ws, "open");
  return { child, cdp: new Cdp(ws), ws };
}

// ── 页面内注入的辅助函数（承自旗舰脚本，删去引导叙事依赖）─────────────────
const PAGE_FNS = {
  /** 等布局与字体稳定；隐藏浮层 chrome，避免入镜；返回 viewBox 供尺寸断言。 */
  prepare: `async () => {
    const A = window.Archify;
    if (!A) throw new Error("window.Archify 不存在——产物不是 archify 页面？");
    const style = document.createElement("style");
    style.id = "capture-overrides";
    style.textContent = ".toolbar,.archify-toast{opacity:0 !important;pointer-events:none !important}";
    document.head.appendChild(style);
    if (A.waitForStableLayout) await A.waitForStableLayout({ maximumFrames: 240 });
    await (document.fonts ? document.fonts.ready : Promise.resolve());
    const svg = document.querySelector(".diagram-container svg");
    if (!svg) throw new Error("找不到 .diagram-container svg");
    const vb = svg.viewBox && svg.viewBox.baseVal;
    if (!vb || !vb.width || !vb.height) throw new Error("svg 缺少有效 viewBox");
    return {
      theme: document.documentElement.getAttribute("data-theme"),
      viewBox: { width: vb.width, height: vb.height },
      fontsStatus: document.fonts ? document.fonts.status : "n/a",
    };
  }`,

  /** 导出 PNG，返回 base64。记录但透传 objectURL（rasterize 的中间态 objectURL 不能吞）。 */
  exportBlob: `async (fmt) => {
    const A = window.Archify;
    const origCreate = URL.createObjectURL.bind(URL);
    const origClick = HTMLAnchorElement.prototype.click;
    const seen = [];
    URL.createObjectURL = (b) => { if (b instanceof Blob) seen.push(b); return origCreate(b); };
    HTMLAnchorElement.prototype.click = function () {};
    try {
      await A.exportMenu.run(fmt);
      const blob = seen[seen.length - 1];
      if (!blob) throw new Error("没有捕获到导出 blob");
      let dims = null;
      if (!/svg/.test(blob.type)) {
        const bmp = await createImageBitmap(blob);
        dims = { width: bmp.width, height: bmp.height };
        bmp.close();
      }
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (let i = 0; i < buf.length; i += 0x8000) {
        s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      }
      return { base64: btoa(s), bytes: blob.size, type: blob.type, dims };
    } finally {
      URL.createObjectURL = origCreate;
      HTMLAnchorElement.prototype.click = origClick;
    }
  }`,

  setTheme: `async (want) => {
    const A = window.Archify;
    for (let i = 0; i < 3; i++) {
      if (document.documentElement.getAttribute("data-theme") === want) break;
      A.theme.toggle();
      await new Promise((r) => setTimeout(r, 400));
    }
    if (A.waitForStableLayout) await A.waitForStableLayout({ maximumFrames: 180 });
    return document.documentElement.getAttribute("data-theme");
  }`,
};

/** 原子写：先写 .tmp 再 rename，重跑幂等。 */
function writeAtomic(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

// ── 主流程 ────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const htmlPath = path.resolve(REPO, opts.html);
  if (!fs.existsSync(htmlPath)) throw new Error(`产物不存在: ${htmlPath}`);
  const outDir = path.resolve(REPO, opts.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const receipts = [];
  const { child, cdp, ws } = await launchChrome(`file://${htmlPath}`);
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-reduced-motion", value: "no-preference" },
        { name: "prefers-color-scheme", value: "dark" },
      ],
    });
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false,
    });
    await cdp.send("Page.navigate", { url: `file://${htmlPath}` });
    await new Promise((r) => setTimeout(r, 1500));
    const prep = await cdp.evalFn(PAGE_FNS.prepare);
    // exportMenu 的 RASTER_SCALE=4（导出器对宽 viewBox 有 4800px 上限，实际缩放可为 3×）：
    // 断言「整数倍缩放 + 纵横比一致」防半幅/空图
    const vb = prep.viewBox;
    console.log(`[page] theme=${prep.theme} viewBox=${vb.width}×${vb.height} fonts=${prep.fontsStatus}`);

    for (const theme of opts.themeList) {
      const now = await cdp.evalFn(PAGE_FNS.setTheme, theme);
      if (now !== theme) throw new Error(`主题切换失败: 期望 ${theme} 实得 ${now}`);
      const r = await cdp.evalFn(PAGE_FNS.exportBlob, "png");
      const okDims = r.dims
        && r.dims.width % Math.round(vb.width) === 0 && r.dims.height % Math.round(vb.height) === 0
        && r.dims.width / vb.width === r.dims.height / vb.height
        && r.dims.width / vb.width >= 3;
      if (!okDims) {
        throw new Error(`PNG 尺寸异常: ${JSON.stringify(r.dims)}（期望 viewBox ${vb.width}×${vb.height} 的 ≥3 整数倍等比）`);
      }
      const file = path.join(outDir, `${opts.slug}-${theme}.png`);
      writeAtomic(file, Buffer.from(r.base64, "base64"));
      receipts.push({ file, bytes: r.bytes, dims: `${r.dims.width}×${r.dims.height}` });
      console.log(`[png ] ${theme}: ${r.dims.width}×${r.dims.height}  ${(r.bytes / 1024).toFixed(0)} KiB`);
    }
  } finally {
    try { ws.close(); } catch {}
    child.kill("SIGTERM");
  }

  // ── 交付收据 ──────────────────────────────────────────────────────────
  console.log(`\n=== 交付收据（${opts.maxBytes} B 门）===`);
  let bad = 0;
  for (const r of receipts) {
    const flag = r.bytes <= opts.maxBytes ? "OK " : "OVER";
    if (r.bytes > opts.maxBytes) bad++;
    console.log(`${flag} ${String(r.bytes).padStart(9)} B  ${String(r.dims).padStart(12)}  ${path.relative(REPO, r.file)}`);
  }
  if (bad) throw new Error(`${bad} 个产物超出体积门`);
  console.log("全部产物在预算内。");
}

main().catch((e) => {
  console.error(`\n[FATAL] ${e.message}`);
  process.exit(1);
});
