/** P5 桌子换了五样，环没动（分镜 5-A…5-C）—— 主题回收 + 系列锚帧
 *  五装置归位 → ★环从桌后浮到画面中央（第二次出场：同色同宽同节点）桌子线稿化 → 金句两行。
 *  ★ LoopRing 不变量：stroke 恒 core、strokeWidth 恒 6px 绝对像素，任何调用点不得覆写。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Desk, Footnote, LoopRing, Panel, SceneTag, Stamp, useRingDot} from '../components/motifs';

/** 五样装置（编号即桌面位置——反枚举：不给五色）。
 *  装置缩略图统一 panel 底 + 编号；职责字以印章形式落下。 */
const DEVICES = [
  {t: '清单', s: '别忘', icon: 'pin'},
  {t: '副桌', s: '别堵', icon: 'desk'},
  {t: '目录', s: '别贪', icon: 'card'},
  {t: '垫纸', s: '别写死', icon: 'paper'},
  {t: '梯子', s: '别断', icon: 'ladder'},
] as const;

/** 装置缩略图（绘制 SVG，无 emoji） */
const DeviceIcon: React.FC<{kind: (typeof DEVICES)[number]['icon']; on: boolean}> = ({kind, on}) => {
  const c = on ? theme.view : theme.dim;
  return (
    <svg width={72} height={64}>
      {kind === 'pin' ? (
        <g stroke={c} strokeWidth={3.5} fill="none">
          <rect x={8} y={20} width={56} height={32} rx={5} />
          <line x1={16} y1={30} x2={52} y2={30} />
          <line x1={16} y1={42} x2={40} y2={42} />
          <circle cx={36} cy={12} r={7} />
          <line x1={36} y1={19} x2={36} y2={20} />
        </g>
      ) : kind === 'desk' ? (
        <g stroke={c} strokeWidth={3.5} fill="none">
          <rect x={4} y={14} width={38} height={26} rx={4} />
          <rect x={34} y={28} width={34} height={24} rx={4} strokeDasharray="6 5" />
        </g>
      ) : kind === 'card' ? (
        <g stroke={c} strokeWidth={3.5} fill="none">
          <rect x={10} y={8} width={30} height={20} rx={3} />
          <rect x={22} y={26} width={34} height={24} rx={3} />
          <line x1={28} y1={34} x2={50} y2={34} />
          <line x1={28} y1={42} x2={44} y2={42} />
        </g>
      ) : kind === 'paper' ? (
        <g stroke={c} strokeWidth={3.5} fill="none">
          <path d="M12 6 h34 l12 12 v40 h-46 Z" />
          <path d="M46 6 v12 h12" />
          <line x1={20} y1={28} x2={48} y2={28} />
          <line x1={20} y1={38} x2={44} y2={38} strokeDasharray="7 5" />
        </g>
      ) : (
        <g stroke={c} strokeWidth={3.5} fill="none">
          <line x1={20} y1={6} x2={20} y2={58} />
          <line x1={50} y1={6} x2={50} y2={58} />
          <line x1={20} y1={18} x2={50} y2={18} />
          <line x1={20} y1={34} x2={50} y2={34} />
          <line x1={20} y1={50} x2={50} y2={50} />
        </g>
      )}
    </svg>
  );
};

/** 5-A 五装置自左向右滑入归位；各配的职责字以印章形式逐枚落下。 */
const FiveDevices: React.FC<{devAt: number[]; stampAt: number[]}> = ({devAt, stampAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="五章回顾" tagline="视野管理：别忘 · 别堵 · 别贪 · 别写死 · 别断" accent={theme.view} />
      <div style={{display: 'flex', gap: 24, alignItems: 'flex-end'}}>
        {DEVICES.map((d, i) => {
          const e = spring({frame: frame - devAt[i], fps, config: {damping: 200}});
          const on = frame >= devAt[i];
          return (
            <div
              key={d.t}
              style={{
                width: 250,
                opacity: e,
                transform: `translateX(${(1 - e) * -50}px)`,
                position: 'relative',
              }}
            >
              <Panel
                accent={on ? theme.view : theme.panelBorder}
                style={{padding: '18px 16px', minHeight: 190}}
              >
                <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{display: 'flex', justifyContent: 'center', margin: '10px 0'}}>
                  <DeviceIcon kind={d.icon} on={on} />
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    fontFamily: theme.sans,
                    fontSize: 26,
                    fontWeight: 600,
                    color: theme.text,
                  }}
                >
                  {d.t}
                </div>
              </Panel>
              {/* 职责印章：逐枚落下 */}
              <Stamp
                text={d.s}
                color={theme.view}
                at={stampAt[i]}
                size={96}
                rotate={-10}
                fontSize={d.s.length > 2 ? 26 : 32}
                style={{position: 'absolute', right: -18, top: -30}}
              />
            </div>
          );
        })}
      </div>
      <Footnote delay={stampAt[4] + 8}>{'五句话合起来，就是视野管理'}</Footnote>
    </AbsoluteFill>
  );
};

/** 5-B ★系列锚帧：环从桌后浮到画面中央（第二次出场，同色同宽同节点），桌子与五装置整体淡为线稿退后。 */
const RingFloatsForward: React.FC<{floatAt: number; footnoteAt: number}> = ({floatAt, footnoteAt}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 环：从桌后（半透明、偏下）浮到中央（100% 亮度）——尺寸不变，位置与透明度变
  const rise = interpolate(frame, [0, 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bright = interpolate(frame - floatAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const draw = interpolate(frame, [floatAt, floatAt + 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 桌子与五装置：淡为线稿退后（描边保留填充淡出）
  const outline = interpolate(frame - floatAt, [10, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const recede = outline;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 桌子 + 五装置：线稿化退后 */}
      <div
        style={{
          position: 'absolute',
          transform: `translateY(${recede * 40}px) scale(${1 - recede * 0.06})`,
          opacity: 1 - recede * 0.25,
        }}
      >
        <div style={{display: 'flex', gap: 20, alignItems: 'flex-end'}}>
          {DEVICES.map((d, i) => (
            <div key={d.t} style={{width: 210}}>
              <Desk width={210} height={140} outline={outline} accent={`${theme.view}`}>
                <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 1 - outline * 0.6}}>
                  <DeviceIcon kind={d.icon} on={false} />
                  <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginTop: 4}}>{d.t}</div>
                </div>
              </Desk>
            </div>
          ))}
        </div>
      </div>
      {/* 环：从桌后浮到画面中央（第二次出场） */}
      <div
        style={{
          position: 'absolute',
          opacity: 0.35 + bright * 0.65,
          transform: `translateY(${(1 - rise) * 130}px)`,
        }}
      >
        <LoopRing size={520} draw={draw} dotProgress={draw > 0.98 ? dot : undefined} showExit={false} />
      </div>
      {/* 外挂注记：五个装置全部挂在循环外（全屏画布，px 坐标直取，红线一） */}
      <svg
        width={1920}
        height={1080}
        style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none', opacity: outline * 0.8}}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          // 桌组：1130px 宽居中于 1920 → 左缘 395；每桌 210 + 间隙 20
          const x = 395 + i * 230 + 105;
          const y = 700;
          const cx = 960;
          const cy = 540;
          return (
            <path
              key={i}
              d={`M${x} ${y} Q ${(x + cx) / 2} ${y + 60}, ${cx} ${cy}`}
              fill="none"
              stroke={theme.view}
              strokeWidth={2.5}
              strokeDasharray="6 6"
              opacity={outline * 0.6}
            />
          );
        })}
      </svg>
      <Footnote delay={footnoteAt}>
        {'五章增量全部为「外挂」 · while 骨架未换（实测 @ 67a9126c）'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 5-C 金句帧：环居中，桌上线稿，两行落点字（serif，core）。 */
const ClosingQuote: React.FC<{l1At: number; l2At: number}> = ({l1At, l2At}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.8);
  const l1 = interpolate(frame - l1At, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const l2 = interpolate(frame - l2At, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 环居中（后景，金句压前） */}
      <div style={{position: 'absolute', opacity: 0.4}}>
        <LoopRing size={620} draw={1} dotProgress={dot} dimNodes showExit={false} />
      </div>
      {/* 桌上线稿（底部弧线示意） */}
      <svg width={1600} height={300} style={{position: 'absolute', bottom: 60, opacity: 0.35}}>
        <path d="M100 260 Q 800 120, 1500 260" fill="none" stroke={theme.panelBorder} strokeWidth={3} />
      </svg>
      <div style={{textAlign: 'center', zIndex: 2}}>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 64,
            fontWeight: 700,
            color: theme.core,
            lineHeight: 1.6,
            opacity: l1,
          }}
        >
          {'不是它变聪明了'}
        </div>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 64,
            fontWeight: 700,
            color: theme.core,
            lineHeight: 1.6,
            opacity: l2,
            transform: `translateY(${(1 - l2) * 18}px)`,
          }}
        >
          {'是有人替它把视野管了起来'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P5Ring: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p5-01', 'p5-06');
  const relA = (id: string) => at(id) - bA.from;
  const bB = w('p5-07', 'p5-12');
  const relB = (id: string) => at(id) - bB.from;
  const bC = w('p5-13', 'p5-16');
  const relC = (id: string) => at(id) - bC.from;
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A 五装置归位">
        {/* p5-02 五样摆在一起：自左向右滑入；p5-04..05 职责印章逐枚落下 */}
        <FiveDevices
          devAt={[0, 8, 16, 24, 32]}
          stampAt={[
            relA('p5-04'),
            relA('p5-04') + 18,
            relA('p5-04') + 36,
            relA('p5-05'),
            relA('p5-05') + 18,
          ]}
        />
      </Sequence>
      <Sequence {...bB} name="5-B 环浮中央">
        {/* p5-09「全部挂在循环外面」起：环描线一遍 + 亮度升满；桌子线稿化 */}
        <RingFloatsForward floatAt={relB('p5-09')} footnoteAt={relB('p5-11')} />
      </Sequence>
      <Sequence {...bC} name="5-C 金句两行">
        {/* p5-14 第一行；p5-15 第二行 */}
        <ClosingQuote l1At={relC('p5-14')} l2At={relC('p5-15')} />
      </Sequence>
    </AbsoluteFill>
  );
};
