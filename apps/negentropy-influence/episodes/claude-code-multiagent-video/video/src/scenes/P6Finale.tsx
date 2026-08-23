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

/** 七段传送带：进料 / 护栏 / 选面 / 执行 / 外接 / 补救 / 记账（一整轮） */
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
      <SceneTag chapter="Comprehensive" tagline="Many Mechanisms, One Loop" accent={theme.core} />
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
      <Footnote delay={beltAt + 24}>{'收尾全景：一整轮，从头到尾走一遍'}</Footnote>
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

/** 6-D ★谁持有计划：四象对比（Harness Engineering 收官纲图）
 *  官方 workflows 的四方对比——临时工/技能包/队友：计划由模型逐回合现场决定；
 *  第四种（动态工作流）：脚本持有计划，中间结果住变量、上下文只装最终答案。
 *  p6-11a/b 六模式选二（扇出汇总 / 对抗核验）；p6-11c/d resume 重放
 *  （干完的秒亮 / 没干完的重跑 / 其后启动的全部重跑）。
 *  分水岭竖线落下是全片思想高点；收官反转「Harness 第一次由它自己来写」。 */
const WhoHoldsPlan: React.FC<{
  gridAt: number;
  divideAt: number;
  runtimeAt: number;
  modesAt: number;
  resumeAt: number;
  twistAt: number;
}> = ({gridAt, divideAt, runtimeAt, modesAt, resumeAt, twistAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cols = [
    {t: '临时工', who: '模型逐回合', mid: '各自的上下文'},
    {t: '技能包', who: '模型按提示', mid: '上下文窗口'},
    {t: '队友', who: '领队逐回合', mid: '共享任务表'},
    {t: '脚本', who: '脚本决定', mid: '脚本变量', fourth: true},
  ];
  const divide = spring({frame: frame - divideAt, fps, config: {damping: 160}});
  const runtime = interpolate(frame - runtimeAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const twist = interpolate(frame - twistAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const CX = 960;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1760, height: 640}}>
        <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.text, textAlign: 'center', marginBottom: 24}}>
          {'谁持有计划？'}
        </div>
        <div style={{display: 'flex', gap: 18, justifyContent: 'center'}}>
          {cols.map((c, i) => {
            const e = spring({frame: frame - gridAt - i * 7, fps, config: {damping: 200}});
            const color = c.fourth ? theme.core : theme.panelBorder;
            return (
              <div
                key={c.t}
                style={{
                  width: 340,
                  opacity: e,
                  transform: `translateY(${(1 - e) * 24}px)`,
                  border: `2.5px solid ${color}`,
                  borderRadius: 14,
                  background: c.fourth ? theme.coreDeep : theme.panel,
                  padding: '18px 20px',
                  boxShadow: c.fourth ? `0 0 22px ${theme.core}44` : 'none',
                }}
              >
                {/* 列顶：计划持有者图章 */}
                <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12}}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      border: `2.5px solid ${c.fourth ? theme.core : theme.dim}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      color: c.fourth ? theme.core : theme.dim,
                    }}
                  >
                    {c.fourth ? 'S' : 'M'}
                  </div>
                  <div>
                    <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.text}}>{c.t}</div>
                    <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim}}>{c.who}</div>
                  </div>
                </div>
                <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, lineHeight: 1.6}}>
                  <div>{'中间结果：'}</div>
                  <div style={{color: theme.text}}>{c.mid}</div>
                </div>
              </div>
            );
          })}
        </div>
        {/* 分水岭竖线：三四列之间落下 */}
        {divide > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: CX - 9,
              top: 90,
              width: 5,
              height: 420 * divide,
              background: theme.core,
              boxShadow: `0 0 18px ${theme.core}88`,
            }}
          />
        ) : null}
        {divide > 0.9 ? (
          <div
            style={{
              position: 'absolute',
              left: CX,
              top: 62,
              transform: 'translateX(-50%)',
              fontFamily: theme.sans,
              fontSize: 20,
              color: theme.core,
              whiteSpace: 'nowrap',
            }}
          >
            {'分水岭'}
          </div>
        ) : null}
        {/* 运行时三分区一行（缩略） */}
        {runtime > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 60,
              display: 'flex',
              justifyContent: 'center',
              gap: 26,
              opacity: runtime,
              transform: `translateY(${(1 - runtime) * 14}px)`,
            }}
          >
            {[
              {t: '会话侧', s: '只装最终答案'},
              {t: '运行时侧', s: '循环·分支·中间结果'},
              {t: 'agent 侧', s: '并发 16 · 总量 1000'},
            ].map((z) => (
              <div
                key={z.t}
                style={{
                  border: `1.5px solid ${theme.panelBorder}`,
                  borderRadius: 10,
                  padding: '10px 22px',
                  background: theme.panel,
                  textAlign: 'center',
                }}
              >
                <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.text}}>{z.t}</div>
                <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginTop: 3}}>{z.s}</div>
              </div>
            ))}
          </div>
        ) : null}
        {/* p6-11a/b 六模式选二：扇出汇总 / 对抗核验（两张小卡浮在四象图上方） */}
        {frame >= modesAt && frame < resumeAt ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 66,
              display: 'flex',
              justifyContent: 'center',
              gap: 26,
              opacity: interpolate(frame - modesAt, [0, 12], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {/* 扇出→汇总漏斗 */}
            <div
              style={{
                border: `2px solid ${theme.mech}`,
                borderRadius: 12,
                background: theme.panel,
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <svg width={150} height={64}>
                {[0, 1, 2].map((k) => (
                  <circle key={k} cx={26} cy={14 + k * 18} r={7} fill={theme.mech} />
                ))}
                <path d="M40 32 C 74 32, 86 32, 118 32" fill="none" stroke={theme.mech} strokeWidth={2.5} opacity={0.6} />
                <polygon points="148,32 132,24 132,40" fill={theme.mech} />
              </svg>
              <div>
                <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.text}}>{'扇出 → 汇总'}</div>
                <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, marginTop: 2}}>
                  {'一批活各自干完，合成一份'}
                </div>
              </div>
            </div>
            {/* 对抗核验：挑刺→改到合格 */}
            <div
              style={{
                border: `2px solid ${theme.mech}`,
                borderRadius: 12,
                background: theme.panel,
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <svg width={150} height={64}>
                <rect x={12} y={12} width={52} height={40} rx={8} fill="none" stroke={theme.mech} strokeWidth={2.5} />
                <text x={38} y={38} textAnchor="middle" fontFamily={theme.mono} fontSize={17} fill={theme.mech}>
                  干
                </text>
                <text x={92} y={38} textAnchor="middle" fontFamily={theme.mono} fontSize={19} fill={theme.peer}>
                  挑刺
                </text>
                <path d="M66 32 C 76 32, 80 32, 84 32" fill="none" stroke={theme.dim} strokeWidth={2.5} />
                <polygon points="84,32 78,28 78,36" fill={theme.dim} />
              </svg>
              <div>
                <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.text}}>{'干完 → 挑刺 → 改'}</div>
                <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, marginTop: 2}}>
                  {'改到合格才算完'}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {/* p6-11c/d resume 重放：A 干完秒亮（绿）/ B 没干完重跑（黄）/ C、D 其后启动全部重跑（对勾抹掉） */}
        {frame >= resumeAt && twist <= 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 58,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 14,
              opacity: interpolate(frame - resumeAt, [0, 12], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginRight: 8}}>
              {'中断重放：'}
            </div>
            {[
              {t: 'A · 已干完', fate: '秒亮', ok: true},
              {t: 'B · 没干完', fate: '从头重跑', warn: true},
              {t: 'C · 其后启动', fate: '全部重跑', fail: true},
              {t: 'D · 其后启动', fate: '全部重跑', fail: true},
            ].map((r, i) => {
              const e = interpolate(frame - resumeAt - 4 - i * 5, [0, 8], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const c = r.ok ? theme.ok : r.warn ? theme.peer : theme.deny;
              return (
                <div
                  key={r.t}
                  style={{
                    border: `2px solid ${c}`,
                    borderRadius: 10,
                    background: theme.panel,
                    padding: '10px 16px',
                    textAlign: 'center',
                    opacity: e,
                  }}
                >
                  <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.text}}>{r.t}</div>
                  <div style={{fontFamily: theme.sans, fontSize: 17, color: c, marginTop: 3}}>{r.fate}</div>
                </div>
              );
            })}
          </div>
        ) : null}
        {/* 收官反转 */}
        {twist > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -46,
              textAlign: 'center',
              opacity: twist,
              fontFamily: theme.serif,
              fontSize: 34,
              color: theme.core,
            }}
          >
            {'Harness 第一次，开始由它自己来写'}
          </div>
        ) : null}
      </div>
      <Footnote delay={runtimeAt}>
        {'四形态对比·六模式选二·resume 重放 —— 官方文档 workflows'}
      </Footnote>
    </AbsoluteFill>
  );
};

const SourceAndFade: React.FC<{beatDurationInFrames: number; partsAt: number; costAt: number; seriesAt: number}> = ({
  beatDurationInFrames,
  partsAt,
  costAt,
  seriesAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // p6-12 零件四连小图（板/箱/号/桌）与 p6-13/14 十五倍对比条先于信源卡（分镜 6-E 承诺）
  const partsT = interpolate(frame - partsAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const costT = interpolate(frame - costAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const preludeGone = interpolate(frame - (seriesAt - 26), [0, 20], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const enter = spring({frame: frame - (seriesAt - 22), fps, config: {damping: 200}});
  const rows = [
    ['官方文档', 'code.claude.com/docs · 取数2026年8月'],
    ['工程博客', 'anthropic.com/engineering'],
    ['源码分析', '第三方逆向分析 · 片中逐处标注'],
    ['数字口径', '开源仓库钉版 67a9126c 实测 · 字节归档'],
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
      {/* p6-12 零件四连小图 + p6-13/14 官方冷水（十五倍）——信源卡之前的收束段 */}
      {preludeGone > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            opacity: partsT * preludeGone,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 30,
          }}
        >
          <div style={{display: 'flex', gap: 40}}>
            {[
              {t: '板子', d: 'M14 10 h36 v26 h-36 Z M22 42 v8 M42 42 v8'},
              {t: '信箱', d: 'M12 14 h40 v26 h-40 Z M12 22 h40 M44 22 v6 a4 4 0 0 1 -8 0 v-6'},
              {t: '编号', d: 'M10 16 h44 v24 h-44 Z M10 24 h44 M10 32 h44 M20 16 v24'},
              {t: '桌子', d: 'M10 20 h48 M14 20 v24 M54 20 v24 M28 30 h12 v8 h-12 Z'},
            ].map((p, i) => (
              <div key={p.t} style={{textAlign: 'center'}}>
                <svg width={68} height={60} style={{overflow: 'visible'}}>
                  <path d={p.d} fill="none" stroke={theme.dim} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.text, marginTop: 6}}>{p.t}</div>
              </div>
            ))}
          </div>
          {/* 十五倍对比条：普通对话 1× vs 多智能体 15× */}
          {costT > 0 ? (
            <div style={{opacity: costT, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
                <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, width: 150, textAlign: 'right'}}>
                  {'普通对话'}
                </span>
                <div style={{width: 90, height: 18, borderRadius: 5, background: theme.dim, opacity: 0.7}} />
                <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'1×'}</span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
                <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.text, width: 150, textAlign: 'right'}}>
                  {'多智能体'}
                </span>
                <div
                  style={{
                    width: interpolate(frame - costAt, [0, 22], [90, 90 * 15], {extrapolateRight: 'clamp'}),
                    maxWidth: 1350,
                    height: 18,
                    borderRadius: 5,
                    background: theme.peer,
                  }}
                />
                <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.peer}}>{'≈15×'}</span>
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 4}}>
                {'并行和专精，必须挣回它们的协调成本 —— 官方工程博客'}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
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
            {'涉及产品内部的部分，均为第三方的源码分析，片中已逐处标注'}
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
            {'Claude Code Harness Engineering'}
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
            {'协作层：从一个到一群'}
          </div>
          {/* 下期预告卡：标题只在画面（反串线纪律） */}
          <div
            style={{
              marginTop: 26,
              padding: '13px 28px',
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 12,
              background: theme.panel,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, letterSpacing: 2}}>
              {'下期 · 新方向'}
            </div>
            <div style={{fontFamily: theme.serif, fontSize: 31, color: theme.text, marginTop: 5}}>
              {'给这样的系统打分'}
            </div>
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
  const bB = w('p6-03', 'p6-04');
  const bC = w('p6-05', 'p6-06');
  const bD = w('p6-07', 'p6-11d');
  const bE = w('p6-12', 'p6-17');
  const rel = (b: {from: number}, id: string) => at(id) - b.from;
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="6-A 四样归位与传送带">
        <ConveyorForms beltAt={rel(bA, 'p6-02')} />
      </Sequence>
      <Sequence {...bB} name="6-B 一整轮快闪">
        <FullTurn pkgAt={rel(bB, 'p6-03')} />
      </Sequence>
      <Sequence {...bC} name="6-C 系列终曲帧">
        <SeriesFinale riseAt={0} quoteAt={rel(bC, 'p6-06')} />
      </Sequence>
      <Sequence {...bD} name="6-D 谁持有计划">
        <WhoHoldsPlan
          gridAt={rel(bD, 'p6-07')}
          divideAt={rel(bD, 'p6-08')}
          runtimeAt={rel(bD, 'p6-10')}
          modesAt={rel(bD, 'p6-11a')}
          resumeAt={rel(bD, 'p6-11c')}
          twistAt={rel(bD, 'p6-11')}
        />
      </Sequence>
      <Sequence {...bE} name="6-E 零件·十五倍·信源卡·渐黑">
        {/* p6-12 零件四连；p6-13/14 十五倍对比条；p6-15 起信源卡；渐黑窗口从本 beat 总时长推导（红线四） */}
        <SourceAndFade
          beatDurationInFrames={bE.durationInFrames}
          partsAt={rel(bE, 'p6-12')}
          costAt={rel(bE, 'p6-13')}
          seriesAt={rel(bE, 'p6-15')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
