/** archify 逐章回放的**句边界锚定层**。
 *
 *  运动层铁律⑤「动画时点一律由句边界推导、禁写死帧数」在本组件落地：
 *  每个 cue 的 `at` / `durationInFrames` 都必须由调用侧用
 *  `at('句id') - beat.from` 与 `w('句id').durationInFrames` 算出，
 *  且**各 cue 独立重算、不由前一个 cue 累加** —— 这样每句的取整误差
 *  不会沿镜累积（timing.ts 的游标设计直接给了这个红利）。
 *
 *  一个 cue = 一章 = 一句。为什么不是「一拍一句」：引导故事每拍恒 1.1s，
 *  而全片平均句窗 ≈5s，一拍对一句需 rate≈0.22，边流虚线会慢成糖浆；
 *  一章对一句则 rate ∈ [0.7, 1.35]，落在无感区间，章内的 1.1s 拍脉冲
 *  正好成为句内的次级节拍。
 */
import React from 'react';
import {Sequence} from 'remotion';
import {ARCHIFY, type ArchifySlug} from '../archify.manifest';
import {FPS} from '../timing';
import {ArchifyClip, type ArchifyFit, type ArchifyVariant} from './ArchifyClip';

export type ArchifyCue = {
  /** archify.manifest.ts 里的章节 id（拼错在 tsc 就红） */
  chapterId: string;
  /** 相对本镜起点的起始帧 —— 必须写 `at('pN-xx') - beat.from` */
  at: number;
  /** 占用帧数 —— 必须写 `w('pN-xx').durationInFrames` */
  durationInFrames: number;
  /** 省略则按 rate 自动选：∈[0.7,1.35] → stretch；偏小 → hold；偏大 → trim */
  fit?: ArchifyFit;
};

/** 自动挡：先算 rate，越界就换到不变速的档位，避免把画面拉成糖浆或快放。
 *  fps 取自 timing.ts（← timing.json 单一事实源），与 ArchifyClip 的
 *  useVideoConfig().fps 同源——两处手抄会让 pickFit 选错档、渲染期才抛 strictRate。 */
function pickFit(storySec: number, frames: number): ArchifyFit {
  const rate = storySec / (frames / FPS);
  if (rate < 0.7) return 'hold';
  if (rate > 1.35) return 'trim';
  return 'stretch';
}

export const ArchifyRecap: React.FC<{
  slug: ArchifySlug;
  /** 右下角标 */
  caption: string;
  cues: ArchifyCue[];
  variant?: ArchifyVariant;
}> = ({slug, caption, cues, variant = 'full'}) => {
  const chapters = ARCHIFY[slug].chapters as readonly {
    id: string;
    label: string;
    file: string;
    endStill: string;
    leadSec: number;
    storySec: number;
  }[];
  return (
    <>
      {cues.map((cue, i) => {
        const ch = chapters.find((c) => c.id === cue.chapterId);
        if (!ch) {
          throw new Error(
            `ArchifyRecap ${slug}: 未知章节 ${cue.chapterId}；` +
              `可用：${chapters.map((c) => c.id).join(' / ')}`,
          );
        }
        return (
          <Sequence
            key={`${cue.chapterId}-${i}`}
            from={cue.at}
            durationInFrames={cue.durationInFrames}
            name={`archify ${slug}/${ch.id}`}
          >
            <ArchifyClip
              file={ch.file}
              spanInFrames={cue.durationInFrames}
              leadSec={ch.leadSec}
              storySec={ch.storySec}
              fit={cue.fit ?? pickFit(ch.storySec, cue.durationInFrames)}
              endStill={ch.endStill}
              caption={caption}
              chapterLabel={ch.label}
              variant={variant}
              lead={i === 0}
            />
          </Sequence>
        );
      })}
    </>
  );
};
