export type ManifestItem = {
  /** 句 id，如 p2-15，对应 public/audio/{id}.mp3 */
  id: string;
  /** 所属幕，如 P2 */
  scene: string;
  /** 口播文本（同字幕） */
  text: string;
  /** 该句音频实测时长（秒） */
  durationSec: number;
};

export type TimedSentence = ManifestItem & {
  /** 全片时间轴上的起始帧 */
  from: number;
  /** 含句间停顿的占用帧数 */
  durationInFrames: number;
};

export type SceneRange = {
  scene: string;
  from: number;
  durationInFrames: number;
  sentences: TimedSentence[];
};
