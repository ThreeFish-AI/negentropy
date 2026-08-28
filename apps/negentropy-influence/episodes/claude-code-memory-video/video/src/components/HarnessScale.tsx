/** 官方四件套标尺（系列共用母题）：循环／工具／上下文管理／护栏 四格横排。
 *  反枚举纪律：panel 底 + 编号 01–04，不给四色——只有被点名的那格点亮。
 *  0-C2（本集）：dropAt 四格自左依次落位、第三格 keep 描边点亮；splitAt 第三格
 *  裂为两半「安排看什么／满了怎么办」——右半 keep 填充（今天拆的），左半保持
 *  dim 标「另拆」。
 *  6-C 尾帧：compact 模式四格整体淡入、第三格「上下文管理」常亮（不裂格）。 */
import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';

const SLOTS = ['循环', '工具', '上下文管理', '护栏'] as const;
/** 第三格＝上下文管理：本集（EP3）填的格 */
const LIT = 2;

export const HarnessScale: React.FC<{
  /** 四格落位锚（compact 模式即整体淡入锚） */
  dropAt: number;
  /** 第三格裂两半锚（0-C2 专用；缺省不裂） */
  splitAt?: number;
  /** 尾帧复用模式：整体淡入、第三格常亮 */
  compact?: boolean;
  cellW?: number;
  /** 纵向落点（px；缺省垂直居中） */
  top?: number;
}> = ({dropAt, splitAt, compact = false, cellW = 360, top}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const split = splitAt !== undefined && frame >= splitAt;
  return (
    <AbsoluteFill
      style={
        top === undefined
          ? {justifyContent: 'center', alignItems: 'center'}
          : {justifyContent: 'flex-start', alignItems: 'center'}
      }
    >
      <div style={{display: 'flex', gap: 24, marginTop: top}}>
        {SLOTS.map((t, i) => {
          const e = compact
            ? interpolate(frame - dropAt, [0, 12], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
            : spring({frame: frame - dropAt - i * 6, fps, config: {damping: 200}});
          // 第三格落位后点亮（keep 描边；compact 模式随整体淡入常亮）
          const lit = i === LIT && (compact || frame >= dropAt + LIT * 6 + 10);
          return (
            <div
              key={t}
              style={{
                width: cellW,
                opacity: e,
                transform: compact ? undefined : `translateY(${(1 - e) * -26}px)`,
              }}
            >
              <div
                style={{
                  height: 128,
                  borderRadius: 12,
                  border: `2.5px solid ${lit ? theme.keep : theme.panelBorder}`,
                  background: lit ? 'rgba(169,196,108,0.05)' : theme.panel,
                  padding: '14px 18px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                {i === LIT && split ? (
                  // p0-11：第三格裂两半——左「安排看什么」dim 标「另拆」，右「满了怎么办」keep 填充
                  <div style={{display: 'flex', marginTop: 10, height: 66}}>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        borderRight: `2px solid ${theme.panelBorder}`,
                        paddingRight: 8,
                      }}
                    >
                      <div style={{fontFamily: theme.serif, fontSize: 21, color: theme.dim}}>
                        {'安排看什么'}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          alignSelf: 'flex-start',
                          padding: '1px 7px',
                          border: `1.5px solid ${theme.panelBorder}`,
                          borderRadius: 5,
                          fontFamily: theme.mono,
                          fontSize: 13,
                          color: theme.dim,
                        }}
                      >
                        {'另拆'}
                      </div>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: theme.keepDeep,
                        borderRadius: 8,
                        marginLeft: 8,
                      }}
                    >
                      <div style={{fontFamily: theme.serif, fontSize: 21, fontWeight: 700, color: theme.keep}}>
                        {'满了怎么办'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: theme.serif,
                      fontSize: 34,
                      fontWeight: 700,
                      color: lit ? theme.keep : theme.text,
                    }}
                  >
                    {t}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
