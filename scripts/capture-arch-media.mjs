#!/usr/bin/env node
/**
 * capture-arch-media.mjs — 把 archify 交互式架构图产物采集为可投放的静态图与动效视频。
 *
 * 输入：docs/concepts/architecture-diagram.html（自包含单文件，file:// 直开）
 * 输出：5120×2880 双主题 PNG、双主题矢量 SVG、引导叙事 MP4/GIF
 *
 * 设计要点（均为实测结论，改动前请先读 docs/.agents/doc-media-assets.md）：
 *   1. 静态图走产物内置的 exportMenu（RASTER_SCALE=4 原生矢量栅格化），不用整页截图——
 *      页面内的图受 reader 宽度上限约束，整页截图有效像素远低于内置导出。
 *   2. 拦截导出 blob 必须「记录但透传」URL.createObjectURL：rasterize() 会先为中间态 SVG
 *      建一次 objectURL，吞掉它会让中间态 Image 永远 load 不了、导出静默失败。
 *   3. 该产物没有 data-animation="trace"，内置 WebM 导出不可用；真实动效是 guidedViews
 *      引导叙事（4 章 13 停）。guidedViews.activate() 受内部门控返回 false，只能点 DOM。
 *   4. 必须把 prefers-reduced-motion 仿真成 no-preference，否则动效被 CSS 全量关掉。
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
    html: "docs/concepts/architecture-diagram.html",
    out: "docs/assets/architecture",
    tmp: ".temp/arch-media",
    only: "png,svg,frames,mp4,gif",
    themes: "dark,light",
    fps: 20,
    width: 1280,
    gifWidth: 800,
    gifFps: 6,
    gifSeconds: 0,      // 0 = 全程（实测：体积由分辨率主导，降帧率比截短更划算）
    dryRun: false,
  };
  for (const raw of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(raw);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "dry-run") opts.dryRun = true;
    else if (k === "theme" || k === "themes") opts.themes = v;
    else if (k === "gif-width") opts.gifWidth = Number(v);
    else if (k === "gif-fps") opts.gifFps = Number(v);
    else if (k === "gif-seconds") opts.gifSeconds = Number(v);
    else if (k in opts) opts[k] = /^\d+$/.test(v ?? "") ? Number(v) : v;
    else throw new Error(`unknown flag: --${k}`);
  }
  opts.onlySet = new Set(String(opts.only).split(",").map((s) => s.trim()).filter(Boolean));
  opts.themeList = String(opts.themes).split(",").map((s) => s.trim()).filter(Boolean);
  return opts;
}

// ── ffmpeg 定位（Remotion compositor 自带二进制是本机唯一全功能 ffmpeg）────────
function semverKey(v) {
  return String(v).split(".").map((n) => String(Number(n) || 0).padStart(6, "0")).join(".");
}
function findFfmpeg() {
  if (process.env.NE_FFMPEG) {
    const p = process.env.NE_FFMPEG;
    if (!fs.existsSync(p)) throw new Error(`NE_FFMPEG 指向的文件不存在: ${p}`);
    return { ffmpeg: p, dir: path.dirname(p), ffprobe: path.join(path.dirname(p), "ffprobe") };
  }
  const base = path.join(
    os.homedir(),
    "Library/pnpm/store/v11/links/@remotion/compositor-darwin-arm64",
  );
  if (!fs.existsSync(base)) {
    throw new Error(
      `找不到 Remotion compositor 目录：${base}\n` +
        `本机 PATH 上没有 ffmpeg，请设 NE_FFMPEG=/path/to/ffmpeg 覆盖。`,
    );
  }
  // 目录层级：<version>/<content-hash>/node_modules/@remotion/compositor-darwin-arm64/ffmpeg
  // 按 semver 降序选取（勿用 mtime：本机同时存在 4.0.512 与 4.0.519）
  const versions = fs.readdirSync(base).filter((d) => /^\d+\.\d+\.\d+$/.test(d));
  versions.sort((a, b) => semverKey(b).localeCompare(semverKey(a)));
  for (const v of versions) {
    const vdir = path.join(base, v);
    for (const hash of fs.readdirSync(vdir)) {
      const dir = path.join(vdir, hash, "node_modules/@remotion/compositor-darwin-arm64");
      const ffmpeg = path.join(dir, "ffmpeg");
      if (fs.existsSync(ffmpeg)) {
        return { ffmpeg, dir, ffprobe: path.join(dir, "ffprobe"), version: v };
      }
    }
  }
  throw new Error(`在 ${base} 下没找到可用的 ffmpeg 二进制`);
}

function runFfmpegTool(bin, dir, args, { capture = true } = {}) {
  return new Promise((resolve, reject) => {
    // DYLD_LIBRARY_PATH 必须指向二进制自身目录，否则 dyld 找不到 libavdevice.dylib
    const child = spawn(bin, args, {
      env: { ...process.env, DYLD_LIBRARY_PATH: dir },
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let out = "";
    let err = "";
    if (capture) {
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
    }
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve({ out, err }) : reject(new Error(`${path.basename(bin)} exit ${code}\n${err.slice(-4000)}`)),
    );
  });
}

// ── 最小 CDP 客户端 ────────────────────────────────────────────────────────
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
    `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), "arch-media-"))}`,
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

  // 找到页面 target 的专属 WS
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

// ── 页面内注入的辅助函数（字符串形式传给 Runtime.evaluate）─────────────────
const PAGE_FNS = {
  /** 等布局与字体稳定；隐藏浮层 chrome，避免入镜。 */
  prepare: `async () => {
    const A = window.Archify;
    if (!A) throw new Error("window.Archify 不存在——产物不是 archify 页面？");
    const style = document.createElement("style");
    style.id = "capture-overrides";
    style.textContent = ".toolbar,.archify-toast{opacity:0 !important;pointer-events:none !important}";
    document.head.appendChild(style);
    if (A.waitForStableLayout) await A.waitForStableLayout({ maximumFrames: 240 });
    await (document.fonts ? document.fonts.ready : Promise.resolve());
    return {
      theme: document.documentElement.getAttribute("data-theme"),
      chapters: [...document.querySelectorAll(".guided-view-chapter")].length,
      guidedCount: A.guidedViews ? A.guidedViews.count : 0,
      fontsStatus: document.fonts ? document.fonts.status : "n/a",
    };
  }`,

  /** 导出一种格式，返回 base64。记录但透传 objectURL（见文件头注释 2）。 */
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

  /** 计算 16:9 取景框：引导面板顶 → 图容器底，居中扩成 16:9。 */
  clipRect: `() => {
    const cont = document.querySelector(".container");
    const diagram = document.querySelector(".diagram-container");
    if (!cont || !diagram) throw new Error("找不到 .container / .diagram-container");
    const kids = [...cont.children];
    const head = kids.find((k) => /GUIDED VIEWS/i.test(k.textContent || "")) || diagram;
    const top = head.getBoundingClientRect().top;
    const bottom = diagram.getBoundingClientRect().bottom;
    const cr = cont.getBoundingClientRect();
    const pad = 10;
    let x = Math.max(0, cr.left - pad);
    let w = Math.min(window.innerWidth - x, cr.width + pad * 2);
    let y = Math.max(0, top - pad);
    let h = bottom - top + pad * 2;
    const target = 9 / 16;
    if (h / w < target) {
      const nh = w * target;                                  // 高不足：向下补，必要时上移
      const grow = nh - h;
      y = Math.max(0, y - grow / 2);
      h = Math.min(window.innerHeight - y, nh);
    } else {
      const nw = h / target;                                  // 宽不足：左右对称扩
      const grow = nw - w;
      x = Math.max(0, x - grow / 2);
      w = Math.min(window.innerWidth - x, nw);
    }
    return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
  }`,

  /** 触发一个分镜动作。返回本次动作的标签，供日志核对。 */
  act: `async (action, index) => {
    const A = window.Archify;
    const chapters = [...document.querySelectorAll(".guided-view-chapter")];
    if (action === "showAll") {
      const b = document.getElementById("guided-view-all");
      if (b) b.click(); else A.guidedViews.showAll();
      return "show-all";
    }
    if (action === "chapter") {
      if (!chapters[index]) throw new Error("章节按钮不存在: " + index);
      chapters[index].click();                                 // activate() 受门控返回 false，必须点 DOM
      return "chapter-" + (index + 1);
    }
    if (action === "next") {
      const b = document.getElementById("guided-view-next");
      if (!b) throw new Error("找不到 #guided-view-next");
      b.click();
      return "next";
    }
    throw new Error("未知动作: " + action);
  }`,

  /** 状态签名：节点视觉态 + 相机 + 聚焦集，用于判定过渡收敛。 */
  signature: `() => {
    const A = window.Archify;
    const nodes = [...document.querySelectorAll("[data-node-id]")];
    const vis = nodes.map((n) => {
      const cs = getComputedStyle(n);
      return n.getAttribute("data-node-id") + ":" + cs.opacity + ":" + (cs.filter || "").slice(0, 24);
    }).join("|");
    return vis + "#" + JSON.stringify(A.view.state()) + "#" + JSON.stringify(A.focus.active());
  }`,

  storyMeta: `() => {
    const A = window.Archify;
    return {
      chapters: [...document.querySelectorAll(".guided-view-chapter")].map((b) =>
        (b.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 40)),
      count: A.guidedViews.count,
    };
  }`,
};

// ── 主流程 ────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const htmlPath = path.resolve(REPO, opts.html);
  if (!fs.existsSync(htmlPath)) throw new Error(`产物不存在: ${htmlPath}`);
  const outDir = path.resolve(REPO, opts.out);
  const tmpDir = path.resolve(REPO, opts.tmp);

  const ff = findFfmpeg();
  console.log(`[env] chrome   = ${CHROME}`);
  console.log(`[env] ffmpeg   = ${ff.ffmpeg}${ff.version ? ` (remotion ${ff.version})` : ""}`);
  console.log(`[env] html     = ${htmlPath}`);
  console.log(`[env] out      = ${outDir}`);
  console.log(`[env] only     = ${[...opts.onlySet].join(",")}`);

  if (opts.dryRun) {
    const v = await runFfmpegTool(ff.ffmpeg, ff.dir, ["-hide_banner", "-version"]);
    console.log(`[dry-run] ffmpeg ok: ${v.out.split("\n")[0]}`);
    const enc = await runFfmpegTool(ff.ffmpeg, ff.dir, ["-hide_banner", "-encoders"]);
    for (const need of ["libx264", "gif", "png"]) {
      if (!new RegExp(`\\b${need}\\b`).test(enc.out)) throw new Error(`ffmpeg 缺少编码器: ${need}`);
      console.log(`[dry-run] encoder ok: ${need}`);
    }
    console.log("[dry-run] 未做任何写操作。");
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  const receipts = [];
  const { child, cdp, ws } = await launchChrome(`file://${htmlPath}`);
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    // 决定性：不做这步会落入 prefers-reduced-motion: reduce，动效被 CSS 全量关闭
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
    console.log(`[page] theme=${prep.theme} chapters=${prep.chapters} guided=${prep.guidedCount} fonts=${prep.fontsStatus}`);
    if (prep.chapters === 0) throw new Error("引导叙事章节数为 0，产物形态与预期不符");

    // ── 静态图 ────────────────────────────────────────────────────────────
    for (const theme of opts.themeList) {
      const now = await cdp.evalFn(PAGE_FNS.setTheme, theme);
      if (now !== theme) throw new Error(`主题切换失败: 期望 ${theme} 实得 ${now}`);

      if (opts.onlySet.has("png")) {
        const r = await cdp.evalFn(PAGE_FNS.exportBlob, "png");
        if (!r.dims || r.dims.width !== 5120 || r.dims.height !== 2880) {
          throw new Error(`PNG 尺寸异常: ${JSON.stringify(r.dims)}（期望 5120×2880）`);
        }
        const file = path.join(outDir, `negentropy-architecture-${theme}.png`);
        fs.writeFileSync(file, Buffer.from(r.base64, "base64"));
        receipts.push({ file, bytes: r.bytes, dims: `${r.dims.width}×${r.dims.height}` });
        console.log(`[png ] ${theme}: ${r.dims.width}×${r.dims.height}  ${(r.bytes / 1024).toFixed(0)} KiB`);
      }
      if (opts.onlySet.has("svg") && theme === opts.themeList[0]) {
        // SVG 导出带 autoTheme，单文件双主题，只需导一次
        const r = await cdp.evalFn(PAGE_FNS.exportBlob, "svg");
        const file = path.join(outDir, "negentropy-architecture.svg");
        fs.writeFileSync(file, Buffer.from(r.base64, "base64"));
        receipts.push({ file, bytes: r.bytes, dims: "vector" });
        console.log(`[svg ] dual-theme: ${(r.bytes / 1024).toFixed(0)} KiB`);
      }
    }

    // ── 动效帧序列 ────────────────────────────────────────────────────────
    if (opts.onlySet.has("frames")) {
      await cdp.evalFn(PAGE_FNS.setTheme, "dark");
      const meta = await cdp.evalFn(PAGE_FNS.storyMeta);
      console.log(`[story] ${meta.count} 章: ${meta.chapters.join(" | ")}`);

      const clip = await cdp.evalFn(PAGE_FNS.clipRect);
      const scale = Number((opts.width / clip.width).toFixed(4));
      console.log(`[clip ] ${clip.width}×${clip.height} @${scale} → ${Math.round(clip.width * scale)}×${Math.round(clip.height * scale)}`);

      const framesDir = path.join(tmpDir, "frames");
      fs.rmSync(framesDir, { recursive: true, force: true });
      fs.mkdirSync(framesDir, { recursive: true });

      let seq = 0;
      const shotCache = [];
      const shoot = async () => {
        const r = await cdp.send("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: false,
          fromSurface: true,
          clip: { ...clip, scale },
        });
        const file = path.join(framesDir, `f${String(seq++).padStart(5, "0")}.png`);
        fs.writeFileSync(file, Buffer.from(r.data, "base64"));
        shotCache.push(file);
        return file;
      };
      /** 复制上一帧 n 次（硬链接，零额外磁盘） */
      const holdFrames = (n) => {
        const src = shotCache[shotCache.length - 1];
        for (let i = 0; i < n; i++) {
          const file = path.join(framesDir, `f${String(seq++).padStart(5, "0")}.png`);
          try { fs.linkSync(src, file); } catch { fs.copyFileSync(src, file); }
        }
      };
      /** 过渡期：实时连拍直到状态签名收敛 */
      const shootTransition = async (maxMs = 3000) => {
        const t0 = Date.now();
        let last = null;
        let stable = 0;
        let n = 0;
        while (Date.now() - t0 < maxMs) {
          await shoot();
          n++;
          const sig = await cdp.evalFn(PAGE_FNS.signature);
          if (sig === last) { stable++; if (stable >= 2) break; } else { stable = 0; last = sig; }
        }
        return { frames: n, ms: Date.now() - t0 };
      };

      // 分镜：总览 → 4 章 13 停 → 收尾总览
      const CHAPTER_BEATS = [5, 3, 2, 3];
      const HOLD_OVERVIEW = 2.5;
      const HOLD_CHAPTER = 2.0;
      const HOLD_BEAT = 1.7;
      const board = [{ action: "showAll", hold: HOLD_OVERVIEW }];
      CHAPTER_BEATS.forEach((beats, ci) => {
        board.push({ action: "chapter", index: ci, hold: HOLD_CHAPTER });
        for (let b = 1; b < beats; b++) board.push({ action: "next", hold: HOLD_BEAT });
      });
      board.push({ action: "showAll", hold: HOLD_OVERVIEW });

      for (const step of board) {
        const label = await cdp.evalFn(PAGE_FNS.act, step.action, step.index ?? 0);
        const t = await shootTransition();
        const holdCount = Math.max(1, Math.round(step.hold * opts.fps) - t.frames);
        holdFrames(holdCount);
        console.log(`[shot ] ${label.padEnd(12)} 过渡 ${String(t.frames).padStart(2)} 帧/${String(t.ms).padStart(4)}ms + 停留 ${holdCount} 帧`);
      }
      console.log(`[frames] 总帧数 ${seq}（${(seq / opts.fps).toFixed(1)}s @ ${opts.fps}fps）`);
      fs.writeFileSync(path.join(tmpDir, "capture.json"), JSON.stringify({ clip, scale, fps: opts.fps, frames: seq, board }, null, 2));
    }
  } finally {
    try { ws.close(); } catch {}
    child.kill("SIGTERM");
  }

  // ── 编码 ──────────────────────────────────────────────────────────────
  const framesDir = path.join(tmpDir, "frames");
  const framePattern = path.join(framesDir, "f%05d.png");
  const LIMIT = 1024 * 1024;
  let frameCount = 0;
  if (opts.onlySet.has("mp4") || opts.onlySet.has("gif")) {
    if (!fs.existsSync(framesDir)) throw new Error(`帧目录不存在: ${framesDir}（先跑 --only=frames）`);
    frameCount = fs.readdirSync(framesDir).filter((f) => /^f\d+\.png$/.test(f)).length;
    if (frameCount === 0) throw new Error("帧目录为空（先跑 --only=frames）");
    console.log(`[enc  ] 复用已有帧 ${frameCount} 张（${(frameCount / opts.fps).toFixed(1)}s @ ${opts.fps}fps）`);
  }

  if (opts.onlySet.has("mp4")) {
    const mp4 = path.join(outDir, "negentropy-architecture-story.mp4");
    // 低运动内容：CRF 阶梯递进直到进入 1 MiB 预算
    let ok = false;
    for (const crf of [23, 26, 28, 30, 32]) {
      await runFfmpegTool(ff.ffmpeg, ff.dir, [
        "-y", "-hide_banner", "-loglevel", "error",
        "-framerate", String(opts.fps), "-i", framePattern,
        "-c:v", "libx264", "-preset", "slow", "-crf", String(crf),
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-r", String(opts.fps), mp4,
      ]);
      const bytes = fs.statSync(mp4).size;
      console.log(`[mp4  ] crf=${crf} → ${(bytes / 1024).toFixed(0)} KiB`);
      if (bytes <= LIMIT) { receipts.push({ file: mp4, bytes, dims: `crf${crf}` }); ok = true; break; }
    }
    if (!ok) throw new Error("MP4 在最高 CRF 下仍超 1 MiB，需缩短时长或降分辨率");
  }

  if (opts.onlySet.has("gif")) {
    const gif = path.join(outDir, "negentropy-architecture-story.gif");
    // 实测（566 帧 / 28.3s 素材）：800px@6fps 全程 = 1031 KiB OVER；720px@6fps 全程 = 875 KiB OK；
    // 1000px@4fps 全程 = 1091 KiB OVER ⇒ 体积由分辨率主导，降帧率比降分辨率更划算。
    // 阶梯策略：优先保住「全程 13 停」的叙事完整性，只在分辨率见底后才截短时长。
    const full = frameCount / opts.fps + 1;
    const ladder = [
      { w: opts.gifWidth, fps: opts.gifFps, secs: opts.gifSeconds || full },
      { w: 720, fps: 6, secs: opts.gifSeconds || full },
      { w: 720, fps: 5, secs: opts.gifSeconds || full },
      { w: 640, fps: 6, secs: opts.gifSeconds || full },
      { w: 800, fps: 8, secs: 12 },
      { w: 720, fps: 8, secs: 12 },
    ];
    let ok = false;
    for (const cfg of ladder) {
      const palette = path.join(tmpDir, "palette.png");
      const common = ["-framerate", String(opts.fps), "-i", framePattern];
      await runFfmpegTool(ff.ffmpeg, ff.dir, [
        "-y", "-hide_banner", "-loglevel", "error", ...common,
        "-vf", `scale=${cfg.w}:-2:flags=lanczos,palettegen=stats_mode=diff:max_colors=128`,
        palette,
      ]);
      await runFfmpegTool(ff.ffmpeg, ff.dir, [
        // -t 必须留在输出侧：夹在两个 -i 之间会被解析为 palette 输入的选项（单帧，空操作），GIF 永不截短
        "-y", "-hide_banner", "-loglevel", "error", ...common, "-i", palette, "-t", String(cfg.secs),
        "-lavfi", `scale=${cfg.w}:-2:flags=lanczos[s];[s][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
        "-r", String(cfg.fps), "-loop", "0", gif,
      ]);
      const bytes = fs.statSync(gif).size;
      console.log(`[gif  ] ${cfg.w}px @${cfg.fps}fps ${cfg.secs}s → ${(bytes / 1024).toFixed(0)} KiB`);
      if (bytes <= LIMIT) { receipts.push({ file: gif, bytes, dims: `${cfg.w}px@${cfg.fps}fps/${cfg.secs}s` }); ok = true; break; }
    }
    if (!ok) throw new Error("GIF 走完降档阶梯仍超 1 MiB");
  }

  // ── 交付收据 ──────────────────────────────────────────────────────────
  console.log("\n=== 交付收据（1 MiB = 1048576 B 门）===");
  let bad = 0;
  for (const r of receipts) {
    const flag = r.bytes <= LIMIT ? "OK " : "OVER";
    if (r.bytes > LIMIT) bad++;
    console.log(`${flag} ${String(r.bytes).padStart(9)} B  ${String(r.dims).padStart(12)}  ${path.relative(REPO, r.file)}`);
  }
  if (bad) throw new Error(`${bad} 个产物超出 1 MiB 体积门`);
  console.log("全部产物在预算内。");
}

main().catch((e) => {
  console.error(`\n[FATAL] ${e.message}`);
  process.exit(1);
});
