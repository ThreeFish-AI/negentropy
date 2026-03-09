type MarkdownRenderSegment =
  | { kind: "markdown"; content: string }
  | { kind: "text"; content: string };

const TABLE_DELIMITER_RE =
  /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+(?:\s*:?-{3,}:?\s*)?\|?\s*$/;

function isFence(line: string): boolean {
  return /^\s*(```|~~~)/.test(line);
}

function isLikelyTableLine(line: string): boolean {
  return line.includes("|");
}

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

function isRiskyTrailingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  return (
    /^\s{0,3}#{1,6}(?:\s|$)/.test(line) ||
    /^\s*>\s?/.test(line) ||
    isFence(line) ||
    isLikelyTableLine(line)
  );
}

function splitStablePrefix(content: string): { stable: string; tail: string } {
  const lines = content.split("\n");
  const stableLines: string[] = [];
  let insideFence = false;
  let openTableStart = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const nextLine = lines[index + 1] ?? "";

    if (isFence(line)) {
      insideFence = !insideFence;
      stableLines.push(line);
      continue;
    }

    if (insideFence) {
      stableLines.push(line);
      continue;
    }

    if (openTableStart >= 0) {
      if (isLikelyTableLine(line)) {
        stableLines.push(line);
        continue;
      }
      if (isBlank(line)) {
        stableLines.push(line);
        openTableStart = -1;
        continue;
      }
      return {
        stable: stableLines.slice(0, openTableStart).join("\n").trimEnd(),
        tail: lines.slice(openTableStart).join("\n"),
      };
    }

    if (isLikelyTableLine(line) && TABLE_DELIMITER_RE.test(nextLine)) {
      openTableStart = stableLines.length;
      stableLines.push(line, nextLine);
      index += 1;
      continue;
    }

    stableLines.push(line);
  }

  if (insideFence) {
    const lastFenceIndex = stableLines.findLastIndex((line) => isFence(line));
    return {
      stable: stableLines.slice(0, lastFenceIndex).join("\n").trimEnd(),
      tail: lines.slice(lastFenceIndex).join("\n"),
    };
  }

  if (openTableStart >= 0) {
    return {
      stable: stableLines.slice(0, openTableStart).join("\n").trimEnd(),
      tail: lines.slice(openTableStart).join("\n"),
    };
  }

  if (!content.endsWith("\n")) {
    const lastLine = lines[lines.length - 1] ?? "";
    if (isRiskyTrailingLine(lastLine)) {
      return {
        stable: lines.slice(0, -1).join("\n").trimEnd(),
        tail: lastLine,
      };
    }
  }

  return {
    stable: stableLines.join("\n").trimEnd(),
    tail: "",
  };
}

export function getStreamingMarkdownSegments(
  content: string,
  streaming: boolean,
): MarkdownRenderSegment[] {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!streaming || normalized.trim().length === 0) {
    return normalized.trim().length === 0
      ? []
      : [{ kind: "markdown", content: normalized }];
  }

  const { stable, tail } = splitStablePrefix(normalized);
  const segments: MarkdownRenderSegment[] = [];

  if (stable.trim().length > 0) {
    segments.push({ kind: "markdown", content: stable });
  }
  if (tail.trim().length > 0) {
    if (isFence(tail.split("\n")[0] ?? "")) {
      segments.push({ kind: "markdown", content: `${tail}\n\`\`\`` });
    } else {
      segments.push({ kind: "text", content: tail });
    }
  }

  return segments.length > 0
    ? segments
    : [{ kind: "text", content: normalized }];
}
