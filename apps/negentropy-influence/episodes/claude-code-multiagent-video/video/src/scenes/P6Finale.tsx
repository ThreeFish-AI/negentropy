/** P6 收束：机制很多，循环一个（分镜 6-A…6-E）
 *  FullTurn 母题（系列终曲）：七段传送带走一整轮；环从传送带中央升起居中重描
 *  一遍（呼应系列首集环成形动画的节奏）；机制图标环立四周；金句压场；渐黑。
 *  ★ 渐黑窗口从**末 beat 总时长**推导（beatDurationInFrames），不是末句时长
 *    —— 第三集上线教训（skills/06 渲染红线四）。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, phase, SceneTag, useRingDot} from '../components/motifs';

/** 七段传送带：进料 / 护栏 / 选面 / 执行 / 外接 / 补救 / 记账（s20 一整轮） */
const SEGMENTS = [
  {t: '进料', s: '你说一句话'},
  {t: '护栏', s: '输入前钩子'},
  {t: '选面', s: '通知汇入 · 收拾桌面'},
  {t: '执行', s: '问模型 · 过闸分发'},
  {t: '外接', s: '垫纸拼装'},
  {t: '补救', s: '回填 · 记账'},
  {t: '停机', s: '没活就收尾'},
];

/** 6-A 四样东西归位小图 + 七段传送带描线成形 */
const ConveyorForms: React.FC<{beltAt: number}> = ({beltAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 四小图标滑入底部（板/箱/号/桌）
  const four = [
    {t: '板', kind: 'board'},
    {t: '箱', kind: 'mail'},
    {t: '号', kind: 'num'},
    {t: '桌', kind: 'desk'},
  ];
  // 传送带描线：自左向右
  const draw = interpolate(frame - beltAt, [0, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="s20 · Comprehensive" tagline="Many Mechanisms, One Loop" accent={theme.core} />
      {/* 四小图标（顶部一排） */}
      <div style={{display: 'flex', gap: 44, marginBottom: 90}}>
        {four.map((f, i) => {
          const e = spring({frame: frame - 6 - i * 7, fps, config: {damping: 200}});
          const c = theme.mech;
          return (
            <div key={f.t} style={{textAlign: 'center', opacity: e, transform: `translateY(${(1 - e) * 20}px)`}}>
              <svg width={90} height={70}>
                {f.kind === 'board' ? (
                  <>
                    <rect x={8} y={8} width={74} height={54} rx={7} fill="none" stroke={c} strokeWidth={4} />
                    <line x1={8} y1={28} x2={82} y2={28} stroke={c} strokeWidth={3} />
                    <line x1={36} y1={28} x2={36} y2={62} stroke={c} strokeWidth={3} />
                  </>
                ) : f.kind === 'mail' ? (
                  <>
                    <path d="M16 58 V30 A29 24 0 0 1 74 30 V58 Z" fill="none" stroke={c} strokeWidth={4} />
                    <path d="M45 20 L45 46 M37 38 L45 48 L53 38" fill="none" stroke={c} strokeWidth={4} strokeLinecap="round" />
                  </>
                ) : f.kind === 'num' ? (
                  <>
                    <rect x={12} y={16} width={30} height={24} rx={5} fill="none" stroke={c} strokeWidth={4} />
                    <rect x={48} y={30} width={30} height={24} rx={5} fill="none" stroke={c} strokeWidth={4} />
                    <line x1={42} y1={28} x2={48} y2={42} stroke={c} strokeWidth={4} />
                  </>
                ) : (
                  <>
                    <rect x={10} y={14} width={70} height={18} rx={5} fill="none" stroke={c} strokeWidth={4} />
                    <rect x={10} y={38} width={70} height={18} rx={5} fill="none" stroke={c} strokeWidth={4} />
                    <circle cx={20} cy={64} r={4} fill={c} />
                    <circle cx={70} cy={64} r={4} fill={c} />
                  </>
                )}
              </svg>
              <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 4}}>{f.t}</div>
            </div>
          );
        })}
      </div>
      {/* 七段传送带：底线 + 七格 */}
      <div style={{position: 'relative', width: 1560, height: 240}}>
        <svg width={1560} height={240} style={{position: 'absolute', left: 0, top: 0}}>
          {/* 带面主线：描线成形（pathLength 归一化，红线三） */}
          <line
            x1={40}
            y1={170}
            x2={40 + draw * 1480}
            y2={170}
            stroke={theme.mech}
            strokeWidth={6}
            strokeLinecap="round"
          />
          {/* 滚轮：两端 + 中段 */}
          {[60, 780, 1500].map((x, i) => (
            <circle
              key={x}
              cx={x}
              cy={170}
              r={20}
              fill="none"
              stroke={theme.mech}
              strokeWidth={5}
              opacity={draw > (i === 0 ? 0 : i === 1 ? 0.5 : 0.98) ? 1 : 0}
            />
          ))}
        </svg>
        {/* 七段标签格 */}
        {SEGMENTS.map((seg, i) => {
          const x = 90 + i * 210;
          const on = draw > (i + 0.5) / 7;
          return (
            <div
              key={seg.t}
              style={{
                position: 'absolute',
                left: x - 80,
                top: 60,
                width: 160,
                textAlign: 'center',
                opacity: on ? 1 : 0.18,
              }}
            >
              <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.panelBorder}}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{fontFamily: theme.serif, fontSize: 30, fontWeight: 700, color: theme.mech}}>
                {seg.t}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 4}}>{seg.s}</div>
            </div>
          );
        })}
      </div>
      <Footnote delay={beltAt + 24}>{'课程最后一章：一整轮，从头到尾走一遍'}</Footnote>
    </AbsoluteFill>
  );
};

/** 6-B ★一整轮：包裹逐段走，每段亮起时回闪该段机制的小图标 */
const FullTurn: React.FC<{pkgAt: number}> = ({pkgAt}) => {
  const frame = useCurrentFrame();
  // 包裹逐段推进：七段 × 每段 ~14 帧
  const per = 14;
  const prog = Math.max(0, frame - pkgAt);
  const segIdx = Math.min(6, Math.floor(prog / per));
  const within = (prog % per) / per;
  // 每段机制小图标（回闪母题缩略）：与前几集机制对应
  const icons: {t: string; draw: (c: string, lit: boolean) => React.ReactNode}[] = [
    {
      t: '清单',
      draw: (c, lit) => (
        <svg width={74} height={58}>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={8} y={8 + i * 17} width={10} height={10} rx={2} fill="none" stroke={c} strokeWidth={3} />
              <line x1={24} y1={13 + i * 17} x2={64} y2={13 + i * 17} stroke={c} strokeWidth={3} opacity={lit ? 1 : 0.5} />
            </g>
          ))}
        </svg>
      ),
    },
    {
      t: '闸门',
      draw: (c) => (
        <svg width={74} height={58}>
          {[0, 1].map((i) => (
            <rect key={i} x={14 + i * 28} y={10} width={10} height={38} rx={3} fill={c} />
          ))}
        </svg>
      ),
    },
    {
      t: '抽屉',
      draw: (c) => (
        <svg width={74} height={58}>
          <rect x={8} y={12} width={58} height={16} rx={4} fill="none" stroke={c} strokeWidth={3} />
          <rect x={8} y={34} width={58} height={16} rx={4} fill="none" stroke={c} strokeWidth={3} />
        </svg>
      ),
    },
    {
      t: '分发表',
      draw: (c) => (
        <svg width={74} height={58}>
          <rect x={8} y={8} width={58} height={42} rx={5} fill="none" stroke={c} strokeWidth={3} />
          <line x1={8} y1={22} x2={66} y2={22} stroke={c} strokeWidth={2.5} />
          <line x1={8} y1={36} x2={66} y2={36} stroke={c} strokeWidth={2.5} />
        </svg>
      ),
    },
    {
      t: '插口',
      draw: (c) => (
        <svg width={74} height={58}>
          <rect x={10} y={16} width={54} height={26} rx={6} fill="none" stroke={c} strokeWidth={3} />
          <line x1={24} y1={8} x2={24} y2={16} stroke={c} strokeWidth={5} strokeLinecap="round" />
          <line x1={50} y1={8} x2={50} y2={16} stroke={c} strokeWidth={5} strokeLinecap="round" />
        </svg>
      ),
    },
    {
      t: '信箱',
      draw: (c) => (
        <svg width={74} height={58}>
          <path d="M14 50 V26 A23 19 0 0 1 60 26 V50 Z" fill="none" stroke={c} strokeWidth={3} />
          <line x1={37} y1={18} x2={37} y2={40} stroke={c} strokeWidth={3} />
          <path d="M31 33 L37 41 L43 33" fill="none" stroke={c} strokeWidth={3} strokeLinecap="round" />
        </svg>
      ),
    },
    {
      t: '握手',
      draw: (c) => (
        <svg width={74} height={58}>
          <rect x={6} y={18} width={26} height={20} rx={4} fill="none" stroke={c} strokeWidth={3} />
          <rect x={42} y={18} width={26} height={20} rx={4} fill="none" stroke={c} strokeWidth={3} />
          <line x1={32} y1={28} x2={42} y2={28} stroke={c} strokeWidth={3} />
        </svg>
      ),
    },
  ];
  const pkgX = 130 + (segIdx + within) * 210;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1560, height: 520}}>
        {/* 传送带：底线 + 滚轮 */}
        <svg width={1560} height={520} style={{position: 'absolute', left: 0, top: 0}}>
          <line x1={40} y1={330} x2={1520} y2={330} stroke={theme.panelBorder} strokeWidth={6} />
          {[60, 780, 1500].map((x) => (
            <circle key={x} cx={x} cy={330} r={18} fill="none" stroke={theme.panelBorder} strokeWidth={5} />
          ))}
        </svg>
        {/* 七段：段名 + 机制小图标（走过即亮） */}
        {SEGMENTS.map((seg, i) => {
          const lit = i <= segIdx;
          const flash = i === segIdx;
          const x = 130 + i * 210;
          const c = lit ? theme.mech : theme.panelBorder;
          return (
            <div key={seg.t} style={{position: 'absolute', left: x - 85, top: 110, width: 170, textAlign: 'center'}}>
              {/* 机制小图标（回闪） */}
              <div style={{height: 64, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                {icons[i].draw(c, lit)}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, marginTop: 6}}>
                {icons[i].t}
              </div>
              <div
                style={{
                  fontFamily: theme.serif,
                  fontSize: 28,
                  fontWeight: 700,
                  color: lit ? theme.mech : theme.dim,
                  marginTop: 8,
                  textShadow: flash ? `0 0 18px ${theme.mech}` : 'none',
                }}
              >
                {seg.t}
              </div>
            </div>
          );
        })}
        {/* 包裹：沿带推进的小方块（带编号） */}
        <div
          style={{
            position: 'absolute',
            left: pkgX - 22,
            top: 330 - 64,
            width: 44,
            height: 44,
            borderRadius: 8,
            background: theme.panel,
            border: `3px solid ${theme.core}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 17,
            color: theme.core,
            boxShadow: `0 0 16px ${theme.core}66`,
          }}
        >
          {'活'}
        </div>
      </div>
      <Footnote delay={pkgAt + 30}>{'从头到尾，十几样机制各就各位'}</Footnote>
    </AbsoluteFill>
  );
};

/** 6-C ★★系列终曲帧：环从传送带中央升起居中重描一遍；机制图标环立四周；金句压场 */
const SeriesFinale: React.FC<{riseAt: number; quoteAt: number}> = ({riseAt, quoteAt}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5, 40);
  // 环升起：从传送带中央（小环）升起放大居中（px 居中推导，红线一）
  const rise = interpolate(frame - riseAt, [0, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 环重描：升起到位后从 0 重画一遍（呼应系列首集 RingBirth 的描线节奏 4→40 帧）
  const redraw = interpolate(frame - riseAt - 40, [4, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 机制图标环立四周（升起后浮现，下半环八方小柱——顶部让位金句）
  const pillars = phase(frame, riseAt + 52, 20);
  // 金句
  const quote = phase(frame, quoteAt, 18);
  const CX = 960;
  const CY = 520;
  const size = 200 + rise * 260; // 从小环放大到居中大环
  // 四周机制图标（八方，椭圆分布：横向 480 / 纵向 290，全部落在环下方与两侧——
  // 顶部留给金句、底部避让字幕安全带 y≥920）
  const around = ['清单', '闸门', '插口', '分发表', '信箱', '握手', '桌子', '看板'];
  return (
    <AbsoluteFill>
      {/* 背景余留：传送带淡去 */}
      <div style={{position: 'absolute', inset: 0, opacity: 1 - rise * 0.7}}>
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
          <svg width={1560} height={200}>
            <line x1={40} y1={160} x2={1520} y2={160} stroke={theme.panelBorder} strokeWidth={5} opacity={0.6} />
            {[60, 780, 1500].map((x) => (
              <circle key={x} cx={x} cy={160} r={16} fill="none" stroke={theme.panelBorder} strokeWidth={4} opacity={0.6} />
            ))}
          </svg>
        </AbsoluteFill>
      </div>
      {/* 环：从传送带中央升起放大居中，重描一遍（同色同宽同节点） */}
      <div style={{position: 'absolute', left: CX - size / 2, top: CY - size / 2}}>
        <LoopRing
          size={size}
          draw={rise < 1 ? 1 : redraw}
          dotProgress={rise >= 1 && redraw > 0.98 ? dot : undefined}
        />
      </div>
      {/* 机制图标环立四周：下半环八方小立牌（mech 描边） */}
      {pillars > 0 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          {around.map((t, i) => {
            const ang = (20 + i * 20) * (Math.PI / 180); // 20°..160°：两侧 + 下半环
            const px = CX + 480 * Math.cos(ang);
            const py = CY + 290 * Math.sin(ang);
            return (
              <g key={t} opacity={pillars}>
                <rect
                  x={px - 52}
                  y={py - 20}
                  width={104}
                  height={40}
                  rx={8}
                  fill={theme.panel}
                  stroke={theme.mech}
                  strokeWidth={2.5}
                />
                <text
                  x={px}
                  y={py + 7}
                  textAnchor="middle"
                  fontFamily={theme.sans}
                  fontSize={20}
                  fill={theme.mech}
                >
                  {t}
                </text>
              </g>
            );
          })}
        </svg>
      ) : null}
      {/* 金句：机制很多，循环一个（core 大字；无强调动效期间环匀速巡游——首集手法） */}
      {quote > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 120,
            textAlign: 'center',
            opacity: quote,
            transform: `translateY(${(1 - quote) * 26}px)`,
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 66, fontWeight: 700, color: theme.core, letterSpacing: 6}}>
            {'机制很多，循环一个'}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 14}}>
            {'变的从来不是它，是它周围的脚手架'}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 6-D 旧零件四连小图：看板=文件夹 / 信箱=文本 / 握手=对照表 / 隔离=空目录 */
const PlainParts: React.FC = () => {
  const frame = useCurrentFrame();
  const parts = [
    {t: '看板', v: '一个文件夹', kind: 'folder'},
    {t: '信箱', v: '一个文本文件', kind: 'file'},
    {t: '握手', v: '一张对照表', kind: 'table'},
    {t: '隔离', v: '一间空目录', kind: 'dir'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 40}}>
        {parts.map((p, i) => {
          const e = interpolate(frame - 8 - i * 12, [0, 14], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const c = theme.text;
          return (
            <div key={p.t} style={{width: 330, opacity: e, transform: `translateY(${(1 - e) * 22}px)`}}>
              <Panel style={{padding: '26px 24px', textAlign: 'center'}}>
                {/* 旧零件小图（mono 标注：terminal 风格文件树/表） */}
                <svg width={200} height={130}>
                  {p.kind === 'folder' ? (
                    <>
                      <path d="M30 30 L60 30 L70 42 L170 42 L170 106 L30 106 Z" fill="none" stroke={c} strokeWidth={4} />
                      {['task-01.json', 'task-02.json', 'task-03.json'].map((f, k) => (
                        <text key={f} x={46} y={66 + k * 17} fontFamily={theme.mono} fontSize={14} fill={theme.dim}>
                          {f}
                        </text>
                      ))}
                    </>
                  ) : p.kind === 'file' ? (
                    <>
                      <path d="M60 18 L120 18 L140 38 L140 112 L60 112 Z" fill="none" stroke={c} strokeWidth={4} />
                      <path d="M120 18 L120 38 L140 38" fill="none" stroke={c} strokeWidth={3} />
                      {['report', 'assign', 'ack'].map((f, k) => (
                        <g key={f}>
                          <line x1={74} y1={60 + k * 17} x2={126} y2={60 + k * 17} stroke={c} strokeWidth={3} />
                          <line x1={74} y1={55 + k * 17} x2={126} y2={65 + k * 17} stroke={theme.deny} strokeWidth={2} opacity={0.7} />
                        </g>
                      ))}
                    </>
                  ) : p.kind === 'table' ? (
                    <>
                      <rect x={40} y={24} width={120} height={84} rx={6} fill="none" stroke={c} strokeWidth={4} />
                      <line x1={40} y1={50} x2={160} y2={50} stroke={c} strokeWidth={3} />
                      <line x1={40} y1={76} x2={160} y2={76} stroke={c} strokeWidth={3} />
                      <text x={58} y={44} fontFamily={theme.mono} fontSize={13} fill={theme.dim}>
                        {'req_0042'}
                      </text>
                      <text x={58} y={70} fontFamily={theme.mono} fontSize={13} fill={theme.dim}>
                        {'req_0042'}
                      </text>
                      <text x={58} y={96} fontFamily={theme.mono} fontSize={13} fill={theme.dim}>
                        {'approved'}
                      </text>
                    </>
                  ) : (
                    <>
                      <rect x={46} y={26} width={108} height={80} rx={6} fill="none" stroke={c} strokeWidth={4} strokeDasharray="8 6" />
                      <text x={100} y={74} textAnchor="middle" fontFamily={theme.mono} fontSize={15} fill={theme.dim}>
                        {'(空)'}
                      </text>
                    </>
                  )}
                </svg>
                <div style={{fontFamily: theme.serif, fontSize: 32, fontWeight: 700, color: theme.text, marginTop: 10}}>
                  {p.t}
                </div>
                <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.mech, marginTop: 8}}>{p.v}</div>
              </Panel>
            </div>
          );
        })}
      </div>
      <Footnote delay={40}>{'听起来越神的功能，拆开越是旧零件'}</Footnote>
    </AbsoluteFill>
  );
};

/** 6-E 信源卡 + 身份卡 + 渐黑（末 beat 总时长推导，红线四） */
const SourceAndFade: React.FC<{beatDurationInFrames: number; seriesAt: number}> = ({
  beatDurationInFrames,
  seriesAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 4, fps, config: {damping: 200}});
  const rows = [
    ['课程', 'Learn Claude Code · 多 Agent 平台七章'],
    ['站点', 'learn.shareai.run/zh/s12..s20'],
    ['仓库', 'github.com/shareAI-lab/learn-claude-code'],
    ['仓库钉版', 'main @ 67a9126c（2026-08-22）'],
    ['访问日期', '2026-08-22'],
    ['许可', 'MIT'],
  ];
  const seriesT = phase(frame, seriesAt, 20);
  // 渐黑：末 1.2 秒线性压暗到全黑，窗口从 beat 总时长反推
  const fadeFrames = Math.round(1.2 * fps);
  const fadeStart = beatDurationInFrames - fadeFrames;
  const dark = interpolate(frame, [fadeStart, beatDurationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: enter * (1 - seriesT * 0.85), transform: `translateY(${(1 - enter) * 20}px)`}}>
        <Panel style={{padding: '30px 40px', width: 940}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.peer, marginBottom: 18}}>
            {'信源'}
          </div>
          {rows.map(([k, v], i) => (
            <div
              key={k}
              style={{
                display: 'flex',
                marginBottom: 10,
                opacity: interpolate(frame - 8 - i * 4, [0, 10], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              <div style={{width: 150, fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>
                {k}
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 23, color: theme.text}}>{v}</div>
            </div>
          ))}
          {/* 诚实行：产品内部断言均为源码分析（三级证据的公开落点） */}
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: `1px solid ${theme.panelBorder}`,
              fontFamily: theme.sans,
              fontSize: 20,
              color: theme.dim,
              opacity: interpolate(frame - 8 - rows.length * 4, [0, 10], [0, 0.9], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {'涉及产品内部的部分，均为课程作者的源码分析，片中已逐处标注'}
          </div>
        </Panel>
      </div>
      {/* 系列身份卡 */}
      {seriesT > 0 ? (
        <div
          style={{
            position: 'absolute',
            textAlign: 'center',
            opacity: seriesT,
            transform: `translateY(${(1 - seriesT) * 18}px)`,
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.dim, letterSpacing: 3}}>
            {'Claude Code 通俗全解'}
          </div>
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 62,
              fontWeight: 700,
              color: theme.core,
              marginTop: 18,
            }}
          >
            {'一群 AI 怎么干活'}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.text, marginTop: 14}}>
            {'看板、信箱与各自的桌子'}
          </div>
        </div>
      ) : null}
      {/* 渐黑遮罩（末 1.2s 线性压暗；窗口从 beat 总时长推导——红线四） */}
      <AbsoluteFill style={{background: '#000', opacity: dark, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

export const P6Finale: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p6-01', 'p6-02');
  const bB = w('p6-03', 'p6-06');
  const bC = w('p6-07', 'p6-11');
  const bD = w('p6-12', 'p6-15');
  const bE = w('p6-16', 'p6-19');
  const rel = (b: {from: number}, id: string) => at(id) - b.from;
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="6-A 四样归位与传送带">
        <ConveyorForms beltAt={rel(bA, 'p6-02')} />
      </Sequence>
      <Sequence {...bB} name="6-B 一整轮">
        <FullTurn pkgAt={rel(bB, 'p6-03')} />
      </Sequence>
      <Sequence {...bC} name="6-C 系列终曲帧">
        <SeriesFinale riseAt={rel(bC, 'p6-07')} quoteAt={rel(bC, 'p6-09')} />
      </Sequence>
      <Sequence {...bD} name="6-D 旧零件四连">
        <PlainParts />
      </Sequence>
      <Sequence {...bE} name="6-E 信源卡与渐黑">
        {/* 渐黑窗口从**本 beat 总时长**推导，不是末句时长（红线四） */}
        <SourceAndFade beatDurationInFrames={bE.durationInFrames} seriesAt={rel(bE, 'p6-19')} />
      </Sequence>
    </AbsoluteFill>
  );
};
