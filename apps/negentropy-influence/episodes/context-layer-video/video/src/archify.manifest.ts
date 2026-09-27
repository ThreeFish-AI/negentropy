// 占位：录制完成后由 archify_manifest.py 从 sidecar JSON 生成覆盖（勿手改）
export type ArchifyChapter = {
  id: string;
  label: string;
  file: string;
  endStill: string;
  beats: number;
  leadSec: number;
  storySec: number;
  beatNodes: string[];
};
export type ArchifyDiagram = {slug: string; type?: string; chapters: ArchifyChapter[]};
const ARCHIFY: Record<string, ArchifyDiagram> = {};
export type ArchifySlug = keyof typeof ARCHIFY;
export {ARCHIFY};
