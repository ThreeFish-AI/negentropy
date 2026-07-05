/**
 * 剥离 Markdown 正文开头的「# 标题」H1。
 *
 * 背景：后端抽取产物会在 Markdown 正文首行写入 `# {entry_title}`，与页面标题
 * （面包屑末段 / `.wiki-doc-title`）重复。该函数在渲染前去掉这条冗余的首标题，
 * 使标题在页面上仅出现一次。
 *
 * 行为约束：
 *   - 仅当**首个非空行**为 ATX H1（`# 文本`，容错前导 ≤3 空格与闭合 `##`）时才剥离；
 *     首个非空行是 H2/段落等则原样返回，避免误伤合法的首个非标题内容。
 *   - 传入 `title` 时，仅当 H1 文本与标题**归一化相等**（去 emphasis/空白、小写）才剥离；
 *     不符则保留，防止误删与文档标题不同的合法首标题。未传 `title` 则剥离任意首 H1。
 *   - 剥离后顺带移除紧跟其后的一个空行，避免正文顶部残留空行。
 *
 * 正确性要点（TOC 一致性）：调用方需将**剥离后的同一字符串**同时喂给
 * `extractHeadings`（右栏 TOC）与 `MarkdownRenderer`（正文），确保二者基于相同输入，
 * `rehype-slug` 注入的锚点 id 与 TOC 不因 H1 缺席而产生漂移。
 */
export function stripLeadingTitleHeading(md: string, title?: string | null): string {
  if (!md) return md;

  const lines = md.split(/\r?\n/);

  // 跳过前导空行，定位首个实质行。
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return md;

  // ATX H1：至多 3 个前导空格 + 单个 # + 必需空白 + 文本（容错末尾闭合 # 序列）。
  const match = lines[i].match(/^ {0,3}#\s+(.+?)\s*#*\s*$/);
  if (!match) return md; // 首个非空行非 H1：不剥离

  const normalize = (s: string): string =>
    s
      .replace(/[*_`~]/g, "") // 去 emphasis / code 标记
      .replace(/\s+/g, " ") // 折叠空白
      .trim()
      .toLowerCase();

  // 提供标题时强制比对，防误伤合法的首个非标题 H1。
  if (title && title.trim() && normalize(title) !== normalize(match[1])) {
    return md;
  }

  // 移除 H1 行，并顺带去掉其后一个空行（避免正文顶部空行）。
  lines.splice(i, 1);
  if (i < lines.length && lines[i].trim() === "") lines.splice(i, 1);

  // 清除结果顶部残留空行（含 H1 之前的前导空行），使正文从首个实质行干净起始。
  let start = 0;
  while (start < lines.length && lines[start].trim() === "") start++;
  return lines.slice(start).join("\n");
}
