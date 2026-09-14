/** archify 工程图 Play 回放窗（v2 母题）。
 *  webm 由 pipeline/scripts/record_archify.py 录制（sidecar 记录片头空白秒数），
 *  trimBefore 裁掉空白后从故事起点播放；静音（录制本身无声）。 */
import React from 'react';
import {OffthreadVideo, staticFile} from 'remotion';
import {theme} from '../design/theme';
import {DUR, useProgress, useSpring} from '../motion';

export const ArchifyClip: React.FC<{
  /** public/archify/ 下的文件名（含 .webm） */
  file: string;
  /** 片头空白秒数（录制 sidecar 的 lead_sec） */
  leadSec: number;
  /** 右下角标（工程图名） */
  caption: string;
}> = ({file, leadSec, caption}) => {
  const win = useSpring('settle', {at: 2, dur: DUR.f5});
  const label = useProgress(10, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '88%',
          aspectRatio: '16 / 9',
          opacity: win,
          transform: `scale(${0.94 + 0.06 * win})`,
          border: `3px solid ${theme.panelBorder}`,
          borderRadius: 14,
          overflow: 'hidden',
          position: 'relative',
          background: '#0B0E13',
        }}
      >
        <OffthreadVideo
          src={staticFile(`archify/${file}`)}
          muted
          trimBefore={Math.round(leadSec * 30)}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
        <div
          style={{
            position: 'absolute',
            right: 14,
            bottom: 12,
            fontFamily: theme.sans,
            fontSize: 19,
            color: theme.dim,
            background: 'rgba(11, 14, 19, 0.78)',
            border: `1.5px solid ${theme.panelBorder}`,
            borderRadius: 8,
            padding: '4px 12px',
            opacity: label,
          }}
        >
          {`archify 工程图 · ${caption}`}
        </div>
      </div>
    </div>
  );
};
