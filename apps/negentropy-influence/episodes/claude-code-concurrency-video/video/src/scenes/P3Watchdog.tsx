/** P3 有一只狗盯着（分镜 3-A…3-B）
 *  秒表狗趴在旁轨边盯输出线；输出停在 (y/n) 上闪烁等待；
 *  45 秒刻度走满无增长 → 狗起身、放大镜聚焦。「不猜快慢只看死活」。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneHeader} from '../components/motifs';

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
const DogRises: React.FC<{
  watchAt: number;
  riseAt: number;
  contrastAt: number;
  pathsAt: number;
  quoteAt: number;
}> = ({watchAt, riseAt, contrastAt, pathsAt, quoteAt}) => {
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
      {/* p3-09a..c 两条看路：轮询走廊（隔段回头，空跑计费灯闪）vs 事件传送带（结果自己滚来） */}
      {frame >= pathsAt ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 196,
            display: 'flex',
            justifyContent: 'center',
            gap: 26,
            opacity: interpolate(frame - pathsAt, [0, 14], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {/* 走廊：问号卡往返（费字灯闪） */}
          <Panel style={{width: 560, padding: '14px 18px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>{'轮询走廊'}</div>
            <svg width={520} height={86} style={{display: 'block', marginTop: 8}}>
              <line x1={20} y1={48} x2={500} y2={48} stroke={theme.panelBorder} strokeWidth={4} />
              {[110, 260, 410].map((x, i) => (
                <g key={x}>
                  <circle
                    cx={x + Math.sin((frame / 14) + i * 2) * 70}
                    cy={48}
                    r={16}
                    fill={theme.panel}
                    stroke={theme.later}
                    strokeWidth={3}
                  />
                  <text
                    x={x + Math.sin((frame / 14) + i * 2) * 70}
                    y={54}
                    textAnchor="middle"
                    fontFamily={theme.mono}
                    fontSize={16}
                    fill={theme.later}
                  >
                    ?
                  </text>
                </g>
              ))}
            </svg>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 17,
                color: theme.deny,
                marginTop: 2,
                opacity: 0.55 + 0.45 * Math.sin(frame / 6),
              }}
            >
              {'每隔一段回头问一次 —— 空跑也是钱'}
            </div>
          </Panel>
          {/* 传送带：包裹自动滚到脚边 */}
          <Panel accent={theme.mech} style={{width: 560, padding: '14px 18px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>{'事件传送带'}</div>
            <svg width={520} height={86} style={{display: 'block', marginTop: 8}}>
              {Array.from({length: 26}, (_, i) => (
                <circle
                  key={i}
                  cx={20 + i * 20}
                  cy={62}
                  r={7}
                  fill={theme.mech}
                  opacity={(i + Math.floor(frame / 3)) % 3 === 0 ? 0.9 : 0.25}
                />
              ))}
              {[0, 1].map((k) => {
                const bx = 20 + (((frame * 4 + k * 260) % 500) as number);
                return (
                  <rect
                    key={k}
                    x={bx}
                    y={26}
                    width={38}
                    height={24}
                    rx={6}
                    fill={theme.panel}
                    stroke={theme.mech}
                    strokeWidth={3}
                  />
                );
              })}
            </svg>
            <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.mech, marginTop: 2}}>
              {'活儿一出结果就自己滚过来 —— 不空跑，不迟到'}
            </div>
          </Panel>
        </div>
      ) : null}
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
      {/* 金句：必须显式落在 SceneHeader 与主体行之间的上部空带。
          缺省的 position:absolute（无 top/left）会退回父级 flex 居中位，
          正好压在中央的输出线面板上——2026-08 抽帧实拍坐实的叠印。 */}
      {quoteO > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 186,
            textAlign: 'center',
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
  const bB = w('p3-04', 'p3-09c');
  return (
    <AbsoluteFill>
      <SceneHeader index="P3" title="有一只狗盯着" meta="watchdog · poll vs event stream" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="3-A 输出停在问句上">
        <DogWatching stopAt={at('p3-03') - bA.from} />
      </Sequence>
      <Sequence {...bB} name="3-B 四十五秒起身与两条看路">
        <DogRises
          watchAt={0}
          riseAt={at('p3-08') - bB.from}
          contrastAt={at('p3-07') - bB.from}
          pathsAt={at('p3-09a') - bB.from}
          quoteAt={at('p3-08') - bB.from + 40}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
