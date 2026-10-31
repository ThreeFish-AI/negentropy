import type {ManifestItem, SceneRange, TimedSentence} from './types';
import constants from './timing.json';

/** 时序常量单一事实源：本目录 timing.json（qa_frames.py / captions.py 读同一文件，
 *  双语言镜像由此消灭；本集要调节奏只改 timing.json，不动代码） */
export const FPS = constants.fps;
/** 句间停顿 */
const SENTENCE_GAP_SEC = constants.sentenceGapSec;
/** 幕间额外停顿（转场呼吸） */
const SCENE_GAP_SEC = constants.sceneGapSec;
/** 片头静默引导 */
const LEAD_IN_SEC = constants.leadInSec;
/** 片尾静默淡出 */
const TAIL_SEC = constants.tailSec;
/** 幕间呼吸淡入淡出帧数（见 components/SceneFade.tsx；首幕不淡入、末幕不淡出） */
export const SCENE_FADE_FRAMES = Math.round(constants.sceneCrossFadeSec * constants.fps);

export function computeTimeline(manifest: ManifestItem[]): {
  timed: TimedSentence[];
  scenes: SceneRange[];
  totalDurationInFrames: number;
} {
  const timed: TimedSentence[] = [];
  let cursor = Math.round(LEAD_IN_SEC * FPS);
  for (let i = 0; i < manifest.length; i++) {
    const item = manifest[i];
    const next = manifest[i + 1];
    const gap = next && next.scene !== item.scene ? SENTENCE_GAP_SEC + SCENE_GAP_SEC : SENTENCE_GAP_SEC;
    const durationInFrames = Math.max(1, Math.round((item.durationSec + gap) * FPS));
    timed.push({...item, from: cursor, durationInFrames});
    cursor += durationInFrames;
  }

  const scenes: SceneRange[] = [];
  for (const s of timed) {
    const last = scenes[scenes.length - 1];
    if (!last || last.scene !== s.scene) {
      scenes.push({scene: s.scene, from: s.from, durationInFrames: s.durationInFrames, sentences: [s]});
    } else {
      last.durationInFrames = s.from + s.durationInFrames - last.from;
      last.sentences.push(s);
    }
  }

  return {timed, scenes, totalDurationInFrames: cursor + Math.round(TAIL_SEC * FPS)};
}

/** 场景内使用：取一段句 id 区间（含端点）的本地 Sequence 窗口 */
export function beatWindow(
  sceneSentences: TimedSentence[],
  sceneFrom: number,
  fromId: string,
  toId?: string,
): {from: number; durationInFrames: number} {
  const start = sceneSentences.find((s) => s.id === fromId);
  const end = sceneSentences.find((s) => s.id === (toId ?? fromId));
  if (!start || !end) {
    throw new Error(`beatWindow: 未找到句 id ${fromId}..${toId}`);
  }
  return {
    from: start.from - sceneFrom,
    durationInFrames: end.from + end.durationInFrames - start.from,
  };
}
