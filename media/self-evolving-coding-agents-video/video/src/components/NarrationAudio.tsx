import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import type {TimedSentence} from '../types';

/** 全片旁白：每句一段音频，按 manifest 时序装配 */
export const NarrationAudio: React.FC<{timed: TimedSentence[]}> = ({timed}) => {
  return (
    <>
      {timed.map((s) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.durationInFrames} name={`audio:${s.id}`}>
          <Audio src={staticFile(`audio/${s.id}.mp3`)} />
        </Sequence>
      ))}
    </>
  );
};
