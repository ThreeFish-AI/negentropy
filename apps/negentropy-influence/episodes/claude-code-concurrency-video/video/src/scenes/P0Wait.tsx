/** P0 十分钟干等（分镜 0-A…0-C）
 *  痛点：进度条慢慢爬，计费表狂转——钱在飞，活没动。洗衣机剪影离场引出
 *  「按下→走开」；三格预告三种开始（位置编码，不给三色），收在「一切停摆的房间」。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneTag, Terminal} from '../components/motifs';

/** 计费表：表盘 + 一根按帧匀速狂转的秒针（转速恒快，与进度条形成反差） */
const MeterDial: React.FC<{spinFrom: number}> = ({spinFrom}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = Math.max(0, frame - spinFrom);
  const ang = (t / fps) * 720; // 每秒两圈——「狂转」
  const enter = interpolate(frame, [0, 12], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <div style={{opacity: enter}}>
      <svg width={230} height={230} style={{overflow: 'visible'}}>
        <circle cx={115} cy={115} r={96} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={3} />
        <circle cx={115} cy={115} r={96} fill="none" stroke={theme.deny} strokeWidth={2} opacity={0.35} />
        {Array.from({length: 12}, (_, i) => {
          const a = ((i * 30 - 90) * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={115 + 78 * Math.cos(a)}
              y1={115 + 78 * Math.sin(a)}
              x2={115 + 92 * Math.cos(a)}
              y2={115 + 92 * Math.sin(a)}
              stroke={theme.dim}
              strokeWidth={3}
            />
          );
        })}
        <g transform={`rotate(${ang} 115 115)`}>
          <line x1={115} y1={115} x2={115} y2={33} stroke={theme.deny} strokeWidth={6} strokeLinecap="round" />
          <circle cx={115} cy={115} r={9} fill={theme.deny} />
        </g>
        <text
          x={115}
          y={168}
          textAnchor="middle"
          fontFamily={theme.sans}
          fontSize={19}
          fill={theme.dim}
        >
          {'按字计费'}
        </text>
      </svg>
      <div
        style={{
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 20,
          color: theme.dim,
          marginTop: 2,
        }}
      >
        {'秒针 · 狂转'}
      </div>
    </div>
  );
};

/** 0-A 终端 npm install 进度条一格一格挪 + 计费表狂转 */
const StallBar: React.FC<{tickAt: number; costAt: number; zeroAt: number}> = ({tickAt, costAt, zeroAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 进度条：每 1.6s 才挪一格（30 格），十分钟爬不完的体感
  const cells = Math.min(30, Math.floor((frame / fps) / 1.6));
  const pct = Math.round((cells / 30) * 100);
  // 计费数字：秒针每圈（0.5s）+一档，与进度条拉开两个数量级
  const secs = Math.floor(frame / fps);
  const amount = secs * 2;
  const zero = interpolate(frame - zeroAt, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Background Tasks" tagline="Slow Operations Go to the Background" />
      <div style={{display: 'flex', alignItems: 'center', gap: 70}}>
        <Terminal
          width={820}
          height={360}
          cps={30}
          lines={[
            {prompt: '›', text: 'npm install', delay: 4},
            {text: 'added 1 package, resolving deps…', color: theme.dim, delay: 30},
            {text: `progress  [${'#'.repeat(Math.min(10, cells))}${'·'.repeat(Math.max(0, 10 - cells))}] ${pct}%`, color: theme.core, delay: 46},
          ]}
        />
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
          <MeterDial spinFrom={tickAt} />
          <Panel
            accent={zero > 0.2 ? theme.deny : theme.panelBorder}
            style={{padding: '14px 22px', textAlign: 'center'}}
          >
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'已烧（示意）'}</div>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 40,
                fontVariantNumeric: 'tabular-nums',
                color: zero > 0.2 ? theme.deny : theme.text,
                marginTop: 2,
              }}
            >
              {`$${amount}`}
            </div>
            {zero > 0.2 ? (
              <div
                style={{
                  fontFamily: theme.sans,
                  fontSize: 22,
                  fontWeight: 700,
                  color: theme.deny,
                  opacity: zero,
                }}
              >
                {'产出 0'}
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
      <Footnote delay={costAt}>{'按 token 计费 · 空转也在烧钱'}</Footnote>
    </AbsoluteFill>
  );
};

/** 0-B 洗衣机剪影：人形站在滚筒前逐步转身离开；滚筒上出现小计时环自己转 */
const LaundryLeave: React.FC<{turnAt: number; ringAt: number; quoteAt?: number}> = ({turnAt, ringAt, quoteAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const turn = interpolate(frame - turnAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const walk = interpolate(frame - turnAt - 24, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ringO = interpolate(frame - ringAt, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 小计时环：匀速自转（周期 2s），无人盯着也在走
  const ringA = ((frame / (fps * 2)) % 1) * 360;
  const drumA = ((frame / fps) * 60) % 360;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width={1360} height={560} style={{overflow: 'visible'}}>
        {/* 洗衣机：方机身 + 圆滚筒 */}
        <g transform="translate(300 90)">
          <rect x={0} y={0} width={340} height={400} rx={26} fill={theme.panel} stroke={theme.dim} strokeWidth={3} />
          <circle cx={170} cy={210} r={112} fill={theme.bg} stroke={theme.dim} strokeWidth={3} />
          {Array.from({length: 3}, (_, i) => {
            const a = ((drumA + i * 120) * Math.PI) / 180;
            return (
              <circle key={i} cx={170 + 52 * Math.cos(a)} cy={210 + 52 * Math.sin(a)} r={9} fill={theme.dim} opacity={0.6} />
            );
          })}
          <circle cx={170} cy={210} r={112} fill="none" stroke={theme.core} strokeWidth={2} opacity={0.35} />
        </g>
        {/* 人形剪影：站在滚筒前 → 转身 → 走开（水平右移 + 淡出） */}
        <g
          transform={`translate(${760 + walk * 320} 130) rotate(${turn * 78} 120 190)`}
          opacity={1 - walk * 0.85}
        >
          <circle cx={120} cy={64} r={40} fill={theme.dim} />
          <path
            d="M120 112 L120 236 M120 146 L64 200 M120 146 L176 200 M120 236 L74 330 M120 236 L166 330"
            stroke={theme.dim}
            strokeWidth={16}
            strokeLinecap="round"
            fill="none"
          />
        </g>
        {/* 小计时环：洗衣机顶上自己转（core 色——它自己把等待接过去了） */}
        <g transform="translate(470 44)" opacity={ringO}>
          <circle cx={0} cy={0} r={30} fill="none" stroke={theme.core} strokeWidth={5} />
          <g transform={`rotate(${ringA} 0 0)`}>
            <line x1={0} y1={0} x2={0} y2={-30} stroke={theme.core} strokeWidth={5} strokeLinecap="round" />
            <circle cx={0} cy={-30} r={6} fill={theme.core} />
          </g>
          <text x={54} y={8} fontFamily={theme.sans} fontSize={22} fill={theme.dim}>
            {'计时中，不用盯'}
          </text>
        </g>
        {/* 两格漫画提示：按下 / 走开 */}
        {ringO > 0.5 ? (
          <g opacity={ringO}>
            <rect x={880} y={110} width={180} height={110} rx={12} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2} />
            <text x={970} y={172} textAnchor="middle" fontFamily={theme.sans} fontSize={26} fill={theme.text}>
              {'① 按下启动'}
            </text>
            <rect x={1080} y={110} width={180} height={110} rx={12} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2} />
            <text x={1170} y={172} textAnchor="middle" fontFamily={theme.sans} fontSize={26} fill={theme.text}>
              {'② 人走开'}
            </text>
          </g>
        ) : null}
      </svg>
      <Footnote delay={turnAt}>{'活儿交给机器，人不陪着等'}</Footnote>
          {/* 官方引文条：时间盲症（Harness Engineering 改造） */}
      {quoteAt !== undefined && frame >= quoteAt ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 190,
            transform: `translateX(-50%) translateY(${interpolate(frame - quoteAt, [0, 16], [14, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}px)`,
            opacity: interpolate(frame - quoteAt, [0, 16], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <div
            style={{
              padding: '14px 28px',
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 12,
              background: theme.panel,
              maxWidth: 1050,
              textAlign: 'center',
            }}
          >
            <div style={{fontFamily: theme.serif, fontSize: 25, color: theme.text}}>
              {'“它感觉不到时间——不看着，会高高兴兴把测试跑上几个小时。”'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginTop: 6}}>
              {'— 官方工程博客 claude-code-auto-mode'}
            </div>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 三种开始的通用小格：位置编码（人在环上 / 人在环外 / 没有人），不给三色 */
const MiniStart: React.FC<{mode: 'onRing' | 'offRing' | 'noOne'; active: boolean}> = ({mode, active}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dot = ((frame / (fps * 2)) % 1 + 1) % 1;
  const a = -90 + dot * 360;
  const rad = (a * Math.PI) / 180;
  const cx = 96;
  const cy = 108;
  const r = 62;
  const stroke = active ? theme.core : theme.panelBorder;
  return (
    <svg width={192} height={216} style={{overflow: 'visible'}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={5} />
      <circle cx={cx + r * Math.cos(rad)} cy={cy + r * Math.sin(rad)} r={8} fill={stroke} />
      {mode === 'onRing' ? (
        /* 人在环上：人形站在环顶（它陪着你一起等） */
        <g fill={active ? theme.text : theme.dim} opacity={active ? 1 : 0.55}>
          <circle cx={cx} cy={cy - r - 26} r={11} />
          <path
            d={`M${cx} ${cy - r - 12} v22 M${cx - 12} ${cy - r - 4} h24 M${cx} ${cy - r + 10} l-9 14 M${cx} ${cy - r + 10} l9 14`}
            stroke={active ? theme.text : theme.dim}
            strokeWidth={5}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      ) : null}
      {mode === 'offRing' ? (
        /* 人在环外：人形站在环右侧远处，一条细线（风筝绳）连着环 */
        <g>
          <g fill={active ? theme.text : theme.dim} opacity={active ? 1 : 0.55}>
            <circle cx={cx + r + 52} cy={cy - 44} r={10} />
            <path
              d={`M${cx + r + 52} ${cy - 32} v20 M${cx + r + 41} ${cy - 25} h22 M${cx + r + 52} ${cy - 12} l-8 13 M${cx + r + 52} ${cy - 12} l8 13`}
              stroke={active ? theme.text : theme.dim}
              strokeWidth={4.5}
              strokeLinecap="round"
              fill="none"
            />
          </g>
          <path
            d={`M${cx + r} ${cy} q28 26 ${cx + r + 52 - (cx + r) - 6} ${cy - 44 + 6 - 0}`}
            stroke={theme.later}
            strokeWidth={2.5}
            fill="none"
            strokeDasharray="6 6"
            opacity={active ? 0.9 : 0.4}
          />
        </g>
      ) : null}
      {mode === 'noOne' ? (
        /* 没有人：只有表盘替它守时（表在环上方，无人体） */
        <g>
          <circle cx={cx} cy={cy - r - 34} r={17} fill={theme.panel} stroke={active ? theme.core : theme.panelBorder} strokeWidth={3} />
          <line
            x1={cx}
            y1={cy - r - 34}
            x2={cx}
            y2={cy - r - 46}
            stroke={active ? theme.core : theme.dim}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
      ) : null}
    </svg>
  );
};

/** 0-C 三种开始三格预告（later 描边统一）→ 荒诞升级：一切停摆的房间 */
const ThreeStartsRoom: React.FC<{twoAt: number; roomAt: number}> = ({twoAt, roomAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cards = [
    {mode: 'onRing' as const, t: '有人按，并等着'},
    {mode: 'offRing' as const, t: '有人按，不等了'},
    {mode: 'noOne' as const, t: '没人按，时间按'},
  ];
  const litAt = [0, 16, twoAt];
  const roomT = interpolate(frame - roomAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 房间里别的活：待办灯亮（later）但整行冻结；只有第一个活的时间条在走（core）
  const rows = [
    {t: '读别的文件', moving: false},
    {t: '想别的问题', moving: false},
    {t: '安排别的活', moving: false},
  ];
  const barA = ((frame / fps) * 0.6) % 1;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          display: 'flex',
          gap: 28,
          opacity: 1 - roomT,
          transform: `scale(${1 - roomT * 0.1})`,
        }}
      >
        {cards.map((c, i) => {
          const on = frame >= litAt[i];
          const e = spring({frame: frame - litAt[i], fps, config: {damping: 200}});
          return (
            <div key={c.t} style={{opacity: on ? e : 0}}>
              <Panel
                accent={on ? theme.later : theme.panelBorder}
                style={{width: 300, padding: '18px 20px 12px'}}
              >
                <div style={{display: 'flex', justifyContent: 'center'}}>
                  <MiniStart mode={c.mode} active={on} />
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    fontFamily: theme.sans,
                    fontSize: 24,
                    color: on ? theme.text : theme.dim,
                    paddingBottom: 6,
                  }}
                >
                  {c.t}
                </div>
              </Panel>
            </div>
          );
        })}
      </div>
      {roomT > 0 ? (
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            alignItems: 'center',
            opacity: roomT,
            transform: `translateY(${(1 - roomT) * 24}px)`,
          }}
        >
          <Panel accent={theme.core} style={{width: 780, padding: '16px 24px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14}}>
              <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.core}}>{'npm install'}</div>
              <div style={{flex: 1, height: 12, borderRadius: 999, background: theme.panelBorder, overflow: 'hidden'}}>
                <div style={{width: `${barA * 100}%`, height: '100%', background: theme.core}} />
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.core}}>{'时间条在走'}</div>
            </div>
            {rows.map((r) => (
              <div key={r.t} style={{display: 'flex', alignItems: 'center', gap: 16, opacity: 0.75}}>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: theme.later,
                    boxShadow: `0 0 10px ${theme.later}`,
                  }}
                />
                <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim, width: 220}}>{r.t}</div>
                <div style={{flex: 1, height: 10, borderRadius: 999, background: theme.panelBorder}} />
                <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.later}}>{'冻结'}</div>
              </div>
            ))}
          </Panel>
          <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text, marginTop: 6}}>
            {'一切都停着，就因为第一个活还没完'}
          </div>
        </div>
      ) : null}
      <Footnote delay={roomAt}>{'这一集把「等」从人身上摘走'}</Footnote>
    </AbsoluteFill>
  );
};

export const P0Wait: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p0-01', 'p0-04');
  const bB = w('p0-05', 'p0-08');
  const bC = w('p0-09', 'p0-13');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 进度条与计费表">
        <StallBar tickAt={at('p0-01') - bA.from} costAt={at('p0-03') - bA.from} zeroAt={at('p0-04') - bA.from} />
      </Sequence>
      <Sequence {...bB} name="0-B 洗衣机与人走开">
        <LaundryLeave turnAt={at('p0-06') - bB.from} ringAt={at('p0-07') - bB.from} quoteAt={6} />
      </Sequence>
      <Sequence {...bC} name="0-C 三种开始与停摆的房间">
        <ThreeStartsRoom twoAt={at('p0-11') - bC.from} roomAt={at('p0-12') - bC.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
