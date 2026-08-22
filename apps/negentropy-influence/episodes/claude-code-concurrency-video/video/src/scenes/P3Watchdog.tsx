/** P3 有一只狗盯着（分镜 3-A…3-B）
 *  秒表狗趴在旁轨边盯输出线；输出停在 (y/n) 上闪烁等待；
 *  45 秒刻度走满无增长 → 狗起身、放大镜聚焦。「不猜快慢只看死活」。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneTag} from '../components/motifs';

/** 后台命令输出线：逐字爬行，随后停在一个 (y/n) 提示上闪烁等待 */
const OutputLine: React.FC<{stopAt: number; focusAt: number}> = ({stopAt, focusAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const text = 'resolving 214 packages … linking binaries … done. clean cache? (y/n)';
  // 前 40 帧匀速爬行，之后停在 (y/n) 上
  const crawlEnd = stopAt;
  const shown = Math.min(text.length, Math.floor((Math.min(frame, crawlEnd) / fps) * 14));
  const stopped = frame >= crawlEnd;
  const qIdx = text.indexOf('(y/n)');
  const blink = Math.floor((frame / fps) * 2) % 2 === 0 ? 1 : 0.3;
  const focus = interpolate(frame - focusAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{position: 'relative'}}>
      <Panel accent={stopped ? theme.deny : theme.panelBorder} style={{width: 1060, padding: '24px 28px'}}>
        <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginBottom: 10}}>
          {'后台命令的输出（bg_0001）'}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 27, color: theme.text, whiteSpace: 'pre', lineHeight: 1.7}}>
          <span>{text.slice(0, Math.min(shown, qIdx))}</span>
          <span style={{color: theme.deny, opacity: shown >= qIdx ? blink : 1}}>
            {shown >= qIdx ? text.slice(qIdx, shown) : ''}
          </span>
          {shown < text.length ? <span style={{color: theme.later}}>▍</span> : null}
        </div>
      </Panel>
      {/* 放大镜：对准问句末端 */}
      {focus > 0 ? (
        <svg
          width={220}
          height={220}
          style={{position: 'absolute', left: 640 + (1 - focus) * 60, top: -36, pointerEvents: 'none'}}
        >
          <circle cx={90} cy={90} r={64} fill="none" stroke={theme.mech} strokeWidth={7} opacity={focus} />
          <line x1={136} y1={136} x2={196} y2={196} stroke={theme.mech} strokeWidth={12} strokeLinecap="round" opacity={focus} />
          <text x={90} y={-12} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fill={theme.mech} opacity={focus}>
            {'是不是停在问句上？'}
          </text>
        </svg>
      ) : null}
    </div>
  );
};

/** 秒表狗：趴姿 → 起身 + 耳朵竖起。SVG 剪影（帧驱动，无随机） */
const StopwatchDog: React.FC<{riseAt: number}> = ({riseAt}) => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame - riseAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ear = interpolate(frame - riseAt, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 趴姿 y 偏移大（贴地），起身抬高
  const bodyY = 92 - rise * 34;
  const legLen = 10 + rise * 42;
  return (
    <svg width={330} height={220} style={{overflow: 'visible'}}>
      {/* 秒表挂脖（狗的身体是个秒表：表盘 + 指针） */}
      <g transform={`translate(140 ${bodyY})`}>
        <ellipse cx={0} cy={78} rx={104} ry={26 + rise * 4} fill={theme.laterDeep} opacity={0.9} />
        {/* 腿：趴着短、起身长 */}
        {[-70, -30, 40, 78].map((dx, i) => (
          <line
            key={i}
            x1={dx}
            y1={70}
            x2={dx}
            y2={70 + legLen}
            stroke={theme.later}
            strokeWidth={9}
            strokeLinecap="round"
          />
        ))}
        {/* 头 + 耳朵（耳朵随起身竖起） */}
        <g transform={`translate(96 ${-8 - rise * 18}) rotate(${rise * -4})`}>
          <circle cx={0} cy={0} r={30} fill={theme.laterDeep} stroke={theme.later} strokeWidth={3} />
          {/* 耳：垂 → 竖 */}
          <path
            d={`M-12 -22 q${-10 - ear * 8} ${-4 - ear * 14} ${-6 + ear * 10} ${-16 - ear * 10}`}
            stroke={theme.later}
            strokeWidth={7}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M10 -22 q${10 + ear * 6} ${-4 - ear * 12} ${6 - ear * 8} ${-14 - ear * 8}`}
            stroke={theme.later}
            strokeWidth={7}
            strokeLinecap="round"
            fill="none"
          />
          <circle cx={14} cy={-2} r={4} fill={theme.text} />
          <circle cx={2} cy={4} r={5} fill={theme.later} />
        </g>
        {/* 秒表表盘（狗身） */}
        <circle cx={-6} cy={34} r={38} fill={theme.panel} stroke={theme.later} strokeWidth={4} />
        <line x1={-6} y1={34} x2={-6 + 26} y2={34 - 10} stroke={theme.later} strokeWidth={4} strokeLinecap="round" />
        <circle cx={-6} cy={34} r={4} fill={theme.later} />
      </g>
    </svg>
  );
};

/** 3-A 狗趴在旁轨边；输出线停在 (y/n) 上 */
const DogWatching: React.FC<{stopAt: number}> = ({stopAt}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Background Tasks" tagline="A Dog Watches Every Task" />
      <div style={{display: 'flex', alignItems: 'center', gap: 50}}>
        <div style={{position: 'relative'}}>
          <OutputLine stopAt={stopAt} focusAt={9999} />
        </div>
        <div style={{position: 'relative'}}>
          <StopwatchDog riseAt={9999} />
          <div style={{textAlign: 'center', fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: -6}}>
            {'看门狗 · 趴着盯输出'}
          </div>
        </div>
      </div>
      <Footnote delay={stopAt}>{'不是坏了，是它停下来问了个问题'}</Footnote>
    </AbsoluteFill>
  );
};

/** 3-B 45 秒刻度走满 → 狗起身 + 放大镜聚焦 + 正常增长对照线一闪而过 */
const DogRises: React.FC<{watchAt: number; riseAt: number; contrastAt: number; quoteAt: number}> = ({
  watchAt,
  riseAt,
  contrastAt,
  quoteAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 45 秒刻度：压缩为 2.5 秒演示（视觉 45 格刻度走满）
  const t = Math.max(0, frame - watchAt);
  const walk = Math.min(1, t / (2.5 * fps));
  const full = walk >= 1;
  // 秒表环刻度（45 格）+ 指针
  const needle = -120 + walk * 240; // -120° → +120°
  const contrast = interpolate(frame - contrastAt, [0, 8, 34], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const quoteO = interpolate(frame - quoteAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Background Tasks" tagline="Not Speed. Aliveness." />
      <div style={{display: 'flex', alignItems: 'center', gap: 66, opacity: 1 - quoteO * 0.7}}>
        {/* 45 秒刻度盘 */}
        <div style={{position: 'relative'}}>
          <svg width={330} height={330}>
            <circle cx={165} cy={165} r={128} fill={theme.panel} stroke={full ? theme.deny : theme.later} strokeWidth={5} />
            {Array.from({length: 45}, (_, i) => {
              const a = ((-120 + (i / 44) * 240) * Math.PI) / 180;
              const lit = i / 44 <= walk;
              const r1 = lit ? 106 : 112;
              return (
                <line
                  key={i}
                  x1={165 + r1 * Math.cos(a)}
                  y1={165 + r1 * Math.sin(a)}
                  x2={165 + 122 * Math.cos(a)}
                  y2={165 + 122 * Math.sin(a)}
                  stroke={lit ? theme.later : theme.panelBorder}
                  strokeWidth={i % 5 === 0 ? 4 : 2.5}
                />
              );
            })}
            <g transform={`rotate(${needle} 165 165)`}>
              <line x1={165} y1={165} x2={165} y2={47} stroke={full ? theme.deny : theme.later} strokeWidth={6} strokeLinecap="round" />
            </g>
            <text x={165} y={165 - 4} textAnchor="middle" fontFamily={theme.mono} fontSize={34} fill={full ? theme.deny : theme.text}>
              {'45'}
            </text>
            <text x={165} y={165 + 26} textAnchor="middle" fontFamily={theme.sans} fontSize={20} fill={theme.dim}>
              {'秒 · 无增长'}
            </text>
          </svg>
          <div style={{textAlign: 'center', fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 2}}>
            {'一毫米都没动'}
          </div>
        </div>
        {/* 狗起身 */}
        <div>
          <StopwatchDog riseAt={riseAt} />
          <div
            style={{
              textAlign: 'center',
              fontFamily: theme.sans,
              fontSize: 22,
              color: frame >= riseAt ? theme.text : theme.dim,
              marginTop: -6,
            }}
          >
            {frame >= riseAt ? '起身查看 · 告诉循环' : '继续趴着'}
          </div>
        </div>
        {/* 输出线停在问句上 + 放大镜 */}
        <div style={{transform: `scale(0.82)`}}>
          <OutputLine stopAt={1} focusAt={riseAt + 6} />
        </div>
      </div>
      {/* 正常增长的对照线：一闪而过 */}
      {contrast > 0 && contrast < 1 ? (
        <div
          style={{
            position: 'absolute',
            top: 214,
            left: 960,
            width: 420,
            opacity: contrast,
          }}
        >
          <Panel accent={theme.mech} style={{padding: '12px 18px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.mech}}>{'对照：还在长的输出'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 4}}>
              {'linked 118/214 …  linked 119/214 …'}
            </div>
          </Panel>
        </div>
      ) : null}
      {quoteO > 0 ? (
        <div
          style={{
            position: 'absolute',
            fontFamily: theme.serif,
            fontSize: 52,
            fontWeight: 700,
            color: theme.text,
            opacity: quoteO,
          }}
        >
          {'不猜快慢，只看死活'}
        </div>
      ) : null}
      <Footnote delay={riseAt}>{'看门狗 · 45 秒停滞检测 —— 第三方的源码分析'}</Footnote>
    </AbsoluteFill>
  );
};

export const P3Watchdog: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p3-01', 'p3-03');
  const bB = w('p3-04', 'p3-09');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A 输出停在问句上">
        <DogWatching stopAt={at('p3-03') - bA.from} />
      </Sequence>
      <Sequence {...bB} name="3-B 四十五秒与起身">
        <DogRises
          watchAt={0}
          riseAt={at('p3-08') - bB.from}
          contrastAt={at('p3-07') - bB.from}
          quoteAt={at('p3-08') - bB.from + 40}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
