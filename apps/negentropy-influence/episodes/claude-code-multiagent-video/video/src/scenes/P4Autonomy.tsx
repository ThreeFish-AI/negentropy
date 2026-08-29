/** P4 自己看板，自己认领（分镜 4-A…4-E）
 *  三段生命周期环（干活/歇着/走人）；五秒心跳两看（先信箱后看板）；
 *  认领三查 + 锁闪光；六十秒表盘走满收工；身份重注入；包工头→项目经理；
 *  4-E 官方战例：十六个它写编译器（B 方案改稿新增镜）。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, NamePlate, Panel, SceneHeader, phase} from '../components/motifs';

/** 4-A 派工之累 ×10 快闪 → 三段生命周期环描线登场 */
const DispatchFatigue: React.FC<{cycleAt: number}> = ({cycleAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 十次派工快闪：每 4 帧一张分发卡从领队飞向队友（p4-01「十个任务分十次」约 1.3s 的快蒙太奇）
  const per = 4;
  const flashes = Math.min(10, Math.floor(frame / per) + 1);
  const showCycle = frame >= cycleAt;
  const draw = interpolate(frame - cycleAt, [0, 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const stages = [
    {t: '干活', ang: -90},
    {t: '歇着', ang: 30},
    {t: '走人', ang: 150},
  ];
  const polar = (cx: number, cy: number, r: number, deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
  };
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
            {!showCycle ? (
        <div style={{position: 'relative', width: 1240, height: 420}}>
          {/* 领队（左）：一张张派 */}
          <div style={{position: 'absolute', left: 40, top: 110, textAlign: 'center'}}>
            <LoopRing size={200} draw={1} dotProgress={undefined} />
            <div style={{marginTop: 6}}>
              <NamePlate name="领队" tone="core" />
            </div>
          </div>
          {/* 分发卡 ×10：叠层快闪（每张停留一小段后飞走） */}
          <svg width={1240} height={420} style={{position: 'absolute', left: 0, top: 0}}>
            {Array.from({length: 10}, (_, i) => {
              const t = interpolate(frame - i * per, [0, 2, per + 3], [0, 1, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const gone = interpolate(frame - i * per - per - 3, [0, 8], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              if (t <= 0 || gone >= 1) return null;
              const y = 210 - 100 + (i % 5) * 42;
              const x = 300 + t * 420 + gone * 320;
              const fade = i === flashes - 1 ? 1 : Math.max(0, 1 - gone * 1.4);
              return (
                <g key={i} opacity={fade}>
                  <rect
                    x={x}
                    y={y - 20}
                    width={130}
                    height={40}
                    rx={7}
                    fill={theme.panel}
                    stroke={theme.peer}
                    strokeWidth={2.5}
                  />
                  <text
                    x={x + 65}
                    y={y + 6}
                    textAnchor="middle"
                    fontFamily={theme.mono}
                    fontSize={17}
                    fill={theme.text}
                  >
                    {`任务 ${i + 1}`}
                  </text>
                </g>
              );
            })}
          </svg>
          {/* 队友（右） */}
          <div style={{position: 'absolute', right: 40, top: 130, textAlign: 'center'}}>
            <LoopRing size={170} draw={1} tone="peer" showLabels={false} dotProgress={undefined} />
            <div style={{marginTop: 6}}>
              <NamePlate name="阿珍" />
            </div>
          </div>
          {/* 派工计数：×10 的疲惫 */}
          <div
            style={{
              position: 'absolute',
              right: 30,
              top: 20,
              fontFamily: theme.mono,
              fontSize: 40,
              color: theme.dim,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {`派工 ×${flashes}`}
          </div>
        </div>
      ) : (
        /* 三段生命周期环：描线登场（干活/歇着/走人 三节点大环） */
        <div style={{display: 'flex', alignItems: 'center', gap: 110}}>
          <div style={{position: 'relative'}}>
            <svg width={480} height={480}>
              <circle
                cx={240}
                cy={240}
                r={168}
                fill="none"
                stroke={theme.peer}
                strokeWidth={6}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - draw}
                transform="rotate(-90 240 240)"
              />
              {stages.map((s, i) => {
                const p = polar(240, 240, 168, s.ang);
                const o = draw > 0.15 + i * 0.28 ? 1 : 0;
                return (
                  <g key={s.t} opacity={o}>
                    <circle cx={p.x} cy={p.y} r={20} fill={theme.bg} stroke={theme.peer} strokeWidth={5} />
                    <text
                      x={p.x}
                      y={p.y + (s.ang === -90 ? -36 : s.ang === 30 ? 56 : 56)}
                      dx={s.ang === 30 ? 40 : s.ang === 150 ? -40 : 0}
                      textAnchor={s.ang === 30 ? 'start' : s.ang === 150 ? 'end' : 'middle'}
                      fontFamily={theme.sans}
                      fontSize={30}
                      fontWeight={700}
                      fill={theme.text}
                    >
                      {s.t}
                    </text>
                  </g>
                );
              })}
              {/* 干完不退出 → 歇着 的回弧 */}
              {draw > 0.9 ? (
                <path
                  d="M382 156 A168 168 0 0 0 396 324"
                  fill="none"
                  stroke={theme.mech}
                  strokeWidth={4}
                  strokeDasharray="7 7"
                  opacity={0.7}
                />
              ) : null}
            </svg>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: -18,
                textAlign: 'center',
                fontFamily: theme.sans,
                fontSize: 24,
                color: theme.dim,
                opacity: phase(frame, cycleAt + 30, 10),
              }}
            >
              {'干完手头的活，不退出'}
            </div>
          </div>
          <div style={{width: 520}}>
            {['干活：领了活埋头干', '歇着：每五秒看两眼', '走人：六十秒没新活'].map((s, i) => {
              const e = spring({frame: frame - cycleAt - 10 - i * 8, fps, config: {damping: 200}});
              return (
                <div
                  key={s}
                  style={{
                    fontFamily: theme.sans,
                    fontSize: 30,
                    color: theme.text,
                    marginBottom: 22,
                    opacity: e,
                    transform: `translateX(${(1 - e) * 30}px)`,
                  }}
                >
                  {s}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {!showCycle ? <Footnote delay={10}>{'派工的人是瓶颈'}</Footnote> : null}
    </AbsoluteFill>
  );
};

/** 4-B 五秒心跳两看：视线先扫信箱再扫看板；认领三查 + 锁闪光 */
const HeartbeatTwoLooks: React.FC<{beatAt: number; mailAt: number; boardAt: number; claimAt: number}> = ({
  beatAt,
  mailAt,
  boardAt,
  claimAt,
}) => {
  const frame = useCurrentFrame();
  // 心跳脉冲：五秒一次（150 帧）的整帧脉冲列
  const beatCycle = (frame / 150) % 1;
  const pulse = beatCycle < 0.06 ? 1 - beatCycle / 0.06 : 0;
  // 视线：先信箱（mailAt 起）后看板（boardAt 起）
  const lookMail = phase(frame, mailAt, 14);
  const lookBoard = phase(frame, boardAt, 14);
  // 认领：三查 + 锁闪光
  const checks = ['是待办吗', '有主人吗', '依赖齐了吗'];
  const claimed = frame >= claimAt;
  const lockFlash = claimed ? interpolate(frame - claimAt, [0, 6, 20], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) : 0;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1560, height: 660}}>
        {/* 顶部：心跳脉冲线（五秒一次） */}
        <svg width={1560} height={90} style={{position: 'absolute', left: 0, top: 0}}>
          <line x1={40} y1={50} x2={1520} y2={50} stroke={theme.panelBorder} strokeWidth={3} />
          {[0, 1, 2, 3].map((i) => {
            const cx = 200 + i * 380;
            const h = i === Math.floor(beatCycle * 4) && pulse > 0 ? 30 * pulse : 14;
            return (
              <g key={i}>
                <path
                  d={`M${cx - 26} 50 L${cx - 8} 50 L${cx - 3} ${50 - h} L${cx + 4} ${50 + h * 0.5} L${cx + 9} 50 L${cx + 30} 50`}
                  fill="none"
                  stroke={theme.peer}
                  strokeWidth={4}
                  strokeLinejoin="round"
                  opacity={i === Math.floor(beatCycle * 4) ? 1 : 0.35}
                />
                <text
                  x={cx + 52}
                  y={56}
                  fontFamily={theme.mono}
                  fontSize={19}
                  fill={theme.dim}
                >
                  {`${(i + 1) * 5}s`}
                </text>
              </g>
            );
          })}
        </svg>
        {/* 中部：队友环居左，两个查看目标居右 */}
        <div style={{position: 'absolute', left: 130, top: 210, textAlign: 'center'}}>
          <LoopRing
            size={240}
            draw={1}
            dotProgress={(frame / 75) % 1}
            tone="peer"
            showLabels={false}
          />
          <div style={{marginTop: 8}}>
            <NamePlate name="阿珍" />
          </div>
          {/* 心跳外圈脉冲 */}
          {pulse > 0 ? (
            <svg width={280} height={280} style={{position: 'absolute', left: -20, top: -20, pointerEvents: 'none'}}>
              <circle
                cx={140}
                cy={140}
                r={120 + (1 - pulse) * 26}
                fill="none"
                stroke={theme.peer}
                strokeWidth={3}
                opacity={pulse * 0.7}
              />
            </svg>
          ) : null}
        </div>
        {/* 目标一：信箱（先看） */}
        <div
          style={{
            position: 'absolute',
            left: 620,
            top: 150,
            opacity: lookMail,
            transform: `translateY(${(1 - lookMail) * 16}px)`,
          }}
        >
          <Panel accent={lookMail > 0.5 ? theme.mech : theme.panelBorder} style={{width: 420, padding: '14px 20px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.mech}}>{'① 先看信箱'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text, marginTop: 8}}>
              {'有关机请求 → 立刻收尾'}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 4}}>
              {'有新指令 → 先处理信'}
            </div>
          </Panel>
        </div>
        {/* 目标二：看板（其次） */}
        <div
          style={{
            position: 'absolute',
            left: 620,
            top: 360,
            opacity: lookBoard,
            transform: `translateY(${(1 - lookBoard) * 16}px)`,
          }}
        >
          <Panel accent={lookBoard > 0.5 ? theme.mech : theme.panelBorder} style={{width: 420, padding: '14px 20px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.mech}}>{'② 再看看板'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text, marginTop: 8}}>
              {'没人领 · 依赖齐了 → 认领'}
            </div>
          </Panel>
        </div>
        {/* 视线轨迹：环 → 信箱 → 看板 */}
        <svg width={1560} height={660} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          {lookMail > 0 && lookMail < 1 ? (
            <line
              x1={400}
              y1={330}
              x2={400 + lookMail * 220}
              y2={330 - lookMail * 140}
              stroke={theme.mech}
              strokeWidth={4}
              strokeDasharray="8 8"
            />
          ) : null}
          {lookBoard > 0 && lookBoard < 1 ? (
            <line
              x1={620}
              y1={220}
              x2={620}
              y2={220 + lookBoard * 140}
              stroke={theme.mech}
              strokeWidth={4}
              strokeDasharray="8 8"
            />
          ) : null}
        </svg>
        {/* 认领三查（右列）+ 锁闪光 */}
        <div style={{position: 'absolute', right: 60, top: 170, width: 380}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginBottom: 14}}>
            {'认领前三查'}
          </div>
          {checks.map((c, i) => {
            const on = phase(frame, claimAt - 30 + i * 8, 10);
            return (
              <div
                key={c}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 14,
                  opacity: on,
                }}
              >
                <span style={{fontSize: 26, color: theme.mech, fontFamily: theme.mono}}>{'✓'}</span>
                <span style={{fontFamily: theme.sans, fontSize: 25, color: theme.text}}>{c}</span>
              </div>
            );
          })}
          {/* owner 格写入 + 锁闪光 */}
          <div
            style={{
              marginTop: 18,
              padding: '12px 16px',
              borderRadius: 10,
              border: `2px solid ${claimed ? theme.mech : theme.panelBorder}`,
              background: lockFlash > 0 ? theme.mechDeep : theme.panel,
              boxShadow: lockFlash > 0 ? `0 0 ${30 * lockFlash}px ${theme.mech}` : 'none',
              opacity: phase(frame, claimAt - 6, 10),
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <svg width={26} height={26}>
                <rect x={4} y={11} width={18} height={12} rx={3} fill="none" stroke={theme.mech} strokeWidth={3} />
                <path d="M9 11 V7 A4 4 0 0 1 17 7 V11" fill="none" stroke={theme.mech} strokeWidth={3} />
              </svg>
              <span style={{fontFamily: theme.mono, fontSize: 21, color: claimed ? theme.mech : theme.dim}}>
                {claimed ? 'owner: 阿珍' : 'owner: —'}
              </span>
            </div>
          </div>
        </div>
      </div>
      <Footnote delay={claimAt}>{'信箱优先，看板其次；认领先上锁'}</Footnote>
    </AbsoluteFill>
  );
};

/** 4-C 六十秒表盘走满收工 + 压缩后身份重注入（「我是谁」卡插回） */
const SixtyClock: React.FC<{clockAt: number; doneAt: number; compactAt: number; cardAt: number}> = ({
  clockAt,
  doneAt,
  compactAt,
  cardAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 表盘：快走满（60 秒压缩到 ~40 帧演示）
  const sweep = interpolate(frame - clockAt, [0, 44], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const full = frame >= doneAt;
  const confetti = spring({frame: frame - doneAt, fps, config: {damping: 200}});
  // 压缩：对话堆坍缩成一小段
  const compact = phase(frame, compactAt, 18);
  // 身份卡：从顶部插回
  const card = phase(frame, cardAt, 16);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 120}}>
        {/* 左：六十秒表盘 */}
        <div style={{position: 'relative', width: 420, height: 420}}>
          <svg width={420} height={420}>
            {/* 刻度盘：12 大格 */}
            {Array.from({length: 12}, (_, i) => {
              const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
              return (
                <line
                  key={i}
                  x1={210 + 158 * Math.cos(ang)}
                  y1={210 + 158 * Math.sin(ang)}
                  x2={210 + 178 * Math.cos(ang)}
                  y2={210 + 178 * Math.sin(ang)}
                  stroke={theme.panelBorder}
                  strokeWidth={4}
                />
              );
            })}
            {/* 进度弧：走满的部分 peer 色 */}
            <circle
              cx={210}
              cy={210}
              r={168}
              fill="none"
              stroke={full ? theme.mech : theme.peer}
              strokeWidth={10}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - sweep}
              transform="rotate(-90 210 210)"
            />
            {/* 指针 */}
            <line
              x1={210}
              y1={210}
              x2={210 + 130 * Math.cos(sweep * Math.PI * 2 - Math.PI / 2)}
              y2={210 + 130 * Math.sin(sweep * Math.PI * 2 - Math.PI / 2)}
              stroke={theme.text}
              strokeWidth={6}
              strokeLinecap="round"
            />
            <circle cx={210} cy={210} r={12} fill={theme.text} />
            <text
              x={210}
              y={286}
              textAnchor="middle"
              fontFamily={theme.mono}
              fontSize={34}
              fill={full ? theme.mech : theme.text}
              style={{fontVariantNumeric: 'tabular-nums'}}
            >
              {full ? '60s' : `${Math.round(sweep * 60)}s`}
            </text>
          </svg>
          {/* 收工礼花：表盘走满时定点绽放（确定性：8 条固定径向短线） */}
          {full ? (
            <svg width={420} height={420} style={{position: 'absolute', left: 0, top: 0}}>
              {Array.from({length: 8}, (_, i) => {
                const ang = (i / 8) * Math.PI * 2;
                const r0 = 190 + confetti * 30;
                const r1 = r0 + 26 * confetti;
                return (
                  <line
                    key={i}
                    x1={210 + r0 * Math.cos(ang)}
                    y1={210 + r0 * Math.sin(ang)}
                    x2={210 + r1 * Math.cos(ang)}
                    y2={210 + r1 * Math.sin(ang)}
                    stroke={theme.mech}
                    strokeWidth={5}
                    strokeLinecap="round"
                    opacity={confetti}
                  />
                );
              })}
            </svg>
          ) : null}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -16,
              textAlign: 'center',
              fontFamily: theme.sans,
              fontSize: 24,
              color: full ? theme.mech : theme.dim,
            }}
          >
            {full ? '收工 · 总结投进领队信箱' : '一分钟等不来新活'}
          </div>
        </div>
        {/* 右：压缩 + 身份卡插回 */}
        <div style={{width: 620}}>
          {/* 对话堆：一摞消息块，坍缩成一小段 */}
          <div style={{position: 'relative', height: 300}}>
            {Array.from({length: 7}, (_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: i * 38,
                  width: 560 - i * 26,
                  height: 26,
                  borderRadius: 5,
                  background: i === 0 ? theme.core : theme.panel,
                  border: `1px solid ${i === 0 ? theme.core : theme.panelBorder}`,
                  opacity: (1 - compact) * (0.5 + i * 0.07),
                  transform: `translateY(${compact * (140 - i * 38)}px) scale(${1 - compact * 0.4})`,
                }}
              />
            ))}
            {/* 坍缩后的一小段 */}
            <div
              style={{
                position: 'absolute',
                left: 120,
                top: 140,
                width: 240,
                height: 30,
                borderRadius: 5,
                background: theme.panel,
                border: `1px solid ${theme.panelBorder}`,
                opacity: compact,
              }}
            />
            {/* 「我是谁」身份卡：从顶部插回 */}
            {card > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  left: 90,
                  top: 170 - card * 0,
                  width: 320,
                  padding: '12px 18px',
                  borderRadius: 10,
                  background: theme.panel,
                  border: `2px solid ${theme.peer}`,
                  opacity: card,
                  transform: `translateY(${(1 - card) * -70}px)`,
                  boxShadow: `0 0 ${18 * card}px ${theme.peer}55`,
                }}
              >
                <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.peer}}>{'身份卡'}</div>
                <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text, marginTop: 4}}>
                  {'我是阿珍 · 负责接口改造'}
                </div>
              </div>
            ) : null}
          </div>
          <div
            style={{
              fontFamily: theme.sans,
              fontSize: 24,
              color: theme.dim,
              marginTop: 30,
              opacity: phase(frame, cardAt + 10, 10),
            }}
          >
            {'对话被压得太短 → 「我是谁」重新插回去'}
          </div>
        </div>
      </div>
      <Footnote delay={doneAt}>{'六十秒收工为示教设计；实际实现无固定时限（源码分析）'}</Footnote>
    </AbsoluteFill>
  );
};

/** 4-E ★官方战例：十六个它写编译器（B 方案改稿新增镜，p4-17..24）。
 *  舞台主体 = 4×4 容器网格（每格 peer 色小环 + 容器描边——16 个不 16 色，
 *  反枚举），随句锚依次换「配件层」：锁文件占坑（p4-18）→ 战果数字带 + 空席
 *  盖章（p4-19）→ boot 脉冲 + 账单停格（p4-20）→ deny 冻霜级联（p4-21/22）→
 *  文件块分流两堆 + 二分箭头收敛（p4-23/24）。全部时点由句锚推导。 */
const CompilerCase: React.FC<{
  gridAt: number;
  lockAt: number;
  scoreAt: number;
  bootAt: number;
  frostAt: number;
  splitAt: number;
}> = ({gridAt, lockAt, scoreAt, bootAt, frostAt, splitAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 4×4 容器网格：逐格点亮（间隔 4 帧，分镜动效约定）
  const lit = (i: number) =>
    interpolate(frame - gridAt - i * 4, [0, 8], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  // 锁文件卡：飞入 + 写入闪光（p4-18）
  const lockFly = interpolate(frame - lockAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lockFlash = interpolate(frame - lockAt - 18, [0, 6, 22], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 战果数字带：逐项滚动（p4-19）——确定性 ease，无随机
  const scoreItems = [
    {t: '并行', v: 16},
    {t: '会话', v: 2000},
    {t: '代码行', v: 100000},
  ];
  const scoreIn = phase(frame, scoreAt, 14);
  // 空席盖章：领队席空 + deny 叉章（p4-19「没有总调度，没有领队」）
  const seatStamp = spring({frame: frame - scoreAt - 14, fps, config: {damping: 130}});
  // boot 脉冲 + 账单停格（p4-20）
  const bootPulse =
    frame >= bootAt
      ? interpolate((frame - bootAt) % 36, [0, 6, 30], [0, 1, 0], {extrapolateRight: 'clamp'})
      : 0;
  const billIn = phase(frame, bootAt + 10, 14);
  // 冻霜级联：从第 0 格扩散冻结全部 16 格（p4-21/22——一个报错全场停摆）
  const frostSpread = interpolate(frame - frostAt, [0, 52], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cellFrost = (i: number) =>
    Math.max(0, Math.min(1, (frostSpread * 17 - i) / 2));
  // 分流：文件块分两堆 + 二分箭头逐轮收敛（p4-23/24）
  const split = phase(frame, splitAt, 20);
  const bisectRounds = interpolate(frame - splitAt - 10, [0, 60], [0, 3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 网格几何：4×4 紧凑格（CELL 112——给底部分流条带与角标让出垂直空间，
  // 避开字幕带与 Footnote 双行区，skills/06 红线二）
  const GX = 150;
  const GY = 90;
  const CELL = 112;
  const GAP = 14;
  const GRID_W = 4 * CELL + 3 * GAP;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1760, height: 760}}>
        {/* 主体：4×4 容器网格（16 个 peer 同色小环，反枚举） */}
        <div style={{position: 'absolute', left: GX, top: GY}}>
          {Array.from({length: 16}, (_, i) => {
            const e = lit(i);
            if (e <= 0) return null;
            const r = Math.floor(i / 4);
            const c = i % 4;
            const fr = cellFrost(i);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: c * (CELL + GAP),
                  top: r * (CELL + GAP),
                  width: CELL,
                  height: CELL,
                  borderRadius: 12,
                  border: `2px solid ${fr > 0.3 ? theme.deny : theme.peer}`,
                  background: fr > 0.3 ? `${theme.deny}1a` : theme.panel,
                  opacity: e,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width={CELL - 24} height={CELL - 24} style={{overflow: 'visible'}}>
                  <circle
                    cx={(CELL - 24) / 2}
                    cy={(CELL - 24) / 2}
                    r={(CELL - 24) / 2 - 14}
                    fill="none"
                    stroke={fr > 0.3 ? theme.dim : theme.peer}
                    strokeWidth={4}
                    opacity={fr > 0.3 ? 0.4 : 1}
                  />
                  {/* 占坑一行：认领 = 往锁文件写一行 */}
                  <text
                    x={(CELL - 24) / 2}
                    y={(CELL - 24) / 2 + 5}
                    textAnchor="middle"
                    fontFamily={theme.mono}
                    fontSize={15}
                    fill={fr > 0.3 ? theme.dim : theme.text}
                  >
                    {`ag-${String(i + 1).padStart(2, '0')}`}
                  </text>
                </svg>
                {/* 冻霜角标：格内右上小雪花刻线（deny，确定性六线星） */}
                {fr > 0.4 ? (
                  <svg
                    width={30}
                    height={30}
                    style={{position: 'absolute', right: 4, top: 4, opacity: (fr - 0.4) / 0.6}}
                  >
                    {[0, 60, 120].map((a) => (
                      <line
                        key={a}
                        x1={15 - 11 * Math.cos((a * Math.PI) / 180)}
                        y1={15 - 11 * Math.sin((a * Math.PI) / 180)}
                        x2={15 + 11 * Math.cos((a * Math.PI) / 180)}
                        y2={15 + 11 * Math.sin((a * Math.PI) / 180)}
                        stroke={theme.deny}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                      />
                    ))}
                  </svg>
                ) : null}
              </div>
            );
          })}
          {/* 冻霜扩散波纹（从一格级联） */}
          {frostSpread > 0 && frostSpread < 1 ? (
            <svg
              width={GRID_W}
              height={GRID_W}
              style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}
            >
              <circle
                cx={CELL / 2}
                cy={CELL / 2}
                r={frostSpread * GRID_W}
                fill="none"
                stroke={theme.deny}
                strokeWidth={3}
                opacity={0.35 * (1 - frostSpread)}
              />
            </svg>
          ) : null}
          {/* 领队席：空（盖 deny 叉章——没有总调度；网格右缘旁） */}
          {seatStamp > 0 ? (
            <div
              style={{
                position: 'absolute',
                left: GRID_W + 34,
                top: GRID_W / 2 - 64,
                width: 190,
                textAlign: 'center',
                opacity: Math.min(1, seatStamp * 1.2),
                transform: `rotate(${-6 * seatStamp}deg)`,
              }}
            >
              <div
                style={{
                  border: `3px dashed ${theme.panelBorder}`,
                  borderRadius: 12,
                  padding: '16px 12px',
                  background: 'transparent',
                  color: theme.dim,
                  fontFamily: theme.sans,
                  fontSize: 22,
                  position: 'relative',
                }}
              >
                {'领队席：空'}
                <svg
                  width={60}
                  height={60}
                  style={{position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-55%)'}}
                >
                  <circle cx={30} cy={30} r={26} fill="none" stroke={theme.deny} strokeWidth={4} opacity={seatStamp} />
                  <line x1={12} y1={12} x2={48} y2={48} stroke={theme.deny} strokeWidth={4} strokeLinecap="round" opacity={seatStamp} />
                  <line x1={48} y1={12} x2={12} y2={48} stroke={theme.deny} strokeWidth={4} strokeLinecap="round" opacity={seatStamp} />
                </svg>
              </div>
            </div>
          ) : null}
        </div>
        {/* 右侧配件列：锁文件 → 战果带 → boot/账单（随句锚换页；右移避让领队席） */}
        <div style={{position: 'absolute', left: 1040, top: 110, width: 600}}>
          {/* 锁文件卡：current_tasks/xxx.txt 飞入 + 占坑标签（p4-18） */}
          {lockFly > 0 ? (
            <div
              style={{
                transform: `translateX(${(1 - lockFly) * 130}px)`,
                opacity: lockFly,
                boxShadow: lockFlash > 0 ? `0 0 ${26 * lockFlash}px ${theme.mech}` : 'none',
              }}
            >
              <Panel accent={theme.mech} style={{padding: '14px 18px', width: 440}}>
                <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>
                  {'current_tasks/'}
                </div>
                <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.text, marginTop: 4}}>
                  {'ag-03.txt'}
                </div>
                <div
                  style={{
                    display: 'inline-block',
                    marginTop: 8,
                    padding: '3px 12px',
                    borderRadius: 6,
                    border: `1.5px solid ${theme.mech}`,
                    fontFamily: theme.sans,
                    fontSize: 18,
                    color: theme.mech,
                  }}
                >
                  {'占坑'}
                </div>
              </Panel>
            </div>
          ) : null}
          {/* 战果数字带：逐项滚动（p4-19） */}
          {scoreIn > 0 ? (
            <div style={{opacity: scoreIn, marginTop: 24, transform: `translateY(${(1 - scoreIn) * 14}px)`}}>
              <Panel accent={theme.peer} style={{padding: '14px 20px', width: 440}}>
                {scoreItems.map((s, k) => {
                  const o = phase(frame, scoreAt + k * 8, 10);
                  const n = Math.round(s.v * phase(frame, scoreAt + k * 8, 22));
                  return (
                    <div
                      key={s.t}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontFamily: theme.mono,
                        fontSize: 21,
                        color: theme.text,
                        marginTop: 6,
                        opacity: o,
                      }}
                    >
                      <span style={{color: theme.dim}}>{s.t}</span>
                      <span style={{fontVariantNumeric: 'tabular-nums'}}>
                        {n.toLocaleString('en-US')}
                      </span>
                    </div>
                  );
                })}
                {/* boot 脉冲行：可启动内核（p4-20） */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 12,
                    opacity: bootPulse > 0 ? 1 : billIn > 0 ? 0.75 : 0,
                  }}
                >
                  <svg width={70} height={18}>
                    <line x1={2} y1={9} x2={58} y2={9} stroke={theme.dim} strokeWidth={3} />
                    <line
                      x1={2}
                      y1={9}
                      x2={2 + 54 * Math.max(0.15, bootPulse)}
                      y2={9}
                      stroke={theme.mech}
                      strokeWidth={4}
                      strokeLinecap="round"
                    />
                    <polygon points="68,9 58,4 58,14" fill={theme.mech} opacity={bootPulse > 0 ? 1 : 0.6} />
                  </svg>
                  <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.text}}>
                    {'可启动的内核'}
                  </span>
                </div>
                {/* 账单停格（p4-20） */}
                {billIn > 0 ? (
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 8,
                      borderTop: `1px solid ${theme.panelBorder}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      opacity: billIn,
                    }}
                  >
                    <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'账单'}</span>
                    <span style={{fontFamily: theme.mono, fontSize: 21, color: theme.text}}>{'< $20,000'}</span>
                  </div>
                ) : null}
              </Panel>
            </div>
          ) : null}
        </div>
        {/* 底部条带：文件块分流两堆 + 二分箭头收敛（p4-23/24） */}
        {split > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 26,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 34,
              opacity: split,
              transform: `translateY(${(1 - split) * 16}px)`,
            }}
          >
            {/* 大堆：走现成的编译器（mech） */}
            <div style={{textAlign: 'center'}}>
              <div style={{display: 'flex', gap: 5, alignItems: 'flex-end', height: 66}}>
                {Array.from({length: 10}, (_, i) => {
                  const o = interpolate(frame - splitAt - 4 - i * 2, [0, 6], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  });
                  const h = 30 + ((i * 37) % 36);
                  return (
                    <div
                      key={i}
                      style={{
                        width: 22,
                        height: h,
                        borderRadius: 4,
                        border: `2px solid ${theme.mech}`,
                        background: `${theme.mech}22`,
                        opacity: o,
                      }}
                    />
                  );
                })}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.mech, marginTop: 6}}>
                {'大部分文件 → 现成的编译器'}
              </div>
            </div>
            {/* 二分箭头：逐轮收敛（三轮，确定性——每轮一对更短的叉线） */}
            <svg width={200} height={90}>
              {[0, 1, 2].map((k) => {
                const on = bisectRounds >= k + 1;
                const half = 32 - k * 10; // 每轮摆幅收窄
                const yMid = 45;
                const x1 = 40 + k * 14;
                const x2 = 150 - k * 14;
                return (
                  <g key={k} opacity={on ? 1 : 0.25}>
                    <line
                      x1={x1}
                      y1={yMid - half}
                      x2={x2}
                      y2={yMid + half}
                      stroke={on ? theme.mech : theme.panelBorder}
                      strokeWidth={3.5}
                      strokeLinecap="round"
                    />
                    <polygon
                      points={`${x2 - 10},${yMid + half - 6} ${x2},${yMid + half} ${x2 - 4},${yMid + half - 12}`}
                      fill={on ? theme.mech : theme.panelBorder}
                    />
                  </g>
                );
              })}
              <text x={100} y={84} textAnchor="middle" fontFamily={theme.sans} fontSize={16} fill={theme.dim}>
                {'二分 · 谁也不挡谁'}
              </text>
            </svg>
            {/* 小堆：留给它（peer） */}
            <div style={{textAlign: 'center'}}>
              <div style={{display: 'flex', gap: 5, alignItems: 'flex-end', height: 66}}>
                {Array.from({length: 3}, (_, i) => {
                  const o = interpolate(frame - splitAt - 10 - i * 3, [0, 6], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  });
                  return (
                    <div
                      key={i}
                      style={{
                        width: 22,
                        height: 40 + i * 10,
                        borderRadius: 4,
                        border: `2px solid ${theme.peer}`,
                        background: `${theme.peer}22`,
                        opacity: o,
                      }}
                    />
                  );
                })}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.peer, marginTop: 6}}>
                {'一小撮 → 它'}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <Footnote delay={gridAt + 30}>
        {'16 并行 · ~2,000 会话 · ~$20K · ~100K LOC —— 官方工程博客 2026-02-05'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 4-D 包工头帽 → 项目经理牌：帽子换牌 + 两件事卡片钉在环旁 */
const ForemanToManager: React.FC<{swapAt: number; cardsAt: number}> = ({swapAt, cardsAt}) => {
  const frame = useCurrentFrame();
  const dot = (frame / 75) % 1;
  // 帽子摘下（升走淡出）→ 牌子落下
  const hatOff = interpolate(frame - swapAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const badgeOn = frame >= swapAt + 12;
  const badgeIn = spring({frame: frame - swapAt - 12, fps: 30, config: {damping: 12}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 100}}>
        {/* 领队环 + 帽/牌 */}
        <div style={{position: 'relative', width: 460, height: 460}}>
          <div style={{position: 'absolute', left: 60, top: 100}}>
            <LoopRing size={340} draw={1} dotProgress={dot} />
          </div>
          {/* 帽子：包工头鸭舌帽（环顶），摘下升走 */}
          <svg
            width={200}
            height={110}
            style={{
              position: 'absolute',
              left: 130,
              top: 12 - hatOff * 90,
              opacity: 1 - hatOff,
              overflow: 'visible',
            }}
          >
            <path
              d="M30 70 A70 44 0 0 1 170 70 Z"
              fill={theme.panel}
              stroke={theme.dim}
              strokeWidth={5}
            />
            <rect x={14} y={66} width={130} height={16} rx={8} fill={theme.panel} stroke={theme.dim} strokeWidth={4} />
          </svg>
          {/* 牌子：项目经理胸牌（环下方挂上） */}
          {badgeOn ? (
            <div
              style={{
                position: 'absolute',
                left: 110,
                bottom: 8,
                transform: `translateY(${(1 - badgeIn) * -50}px) scale(${0.8 + 0.2 * badgeIn})`,
                opacity: badgeIn,
              }}
            >
              <Panel accent={theme.core} style={{padding: '12px 26px'}}>
                <div style={{fontFamily: theme.serif, fontSize: 30, fontWeight: 700, color: theme.core}}>
                  {'项目经理'}
                </div>
                <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 2}}>
                  {'挂任务 · 告别握手'}
                </div>
              </Panel>
            </div>
          ) : null}
          {!badgeOn ? (
            <div
              style={{
                position: 'absolute',
                left: 130,
                top: 96,
                fontFamily: theme.serif,
                fontSize: 26,
                color: theme.dim,
              }}
            >
              {'包工头'}
            </div>
          ) : null}
        </div>
        {/* 两件事卡片 */}
        <div style={{display: 'flex', flexDirection: 'column', gap: 30}}>
          {[
            {t: '挂任务上板', s: '剩下的分发全自动'},
            {t: '告别握手', s: '需要时发一次'},
          ].map((c, i) => {
            const e = spring({frame: frame - cardsAt - i * 10, fps: 30, config: {damping: 200}});
            return (
              <div key={c.t} style={{width: 380, opacity: e, transform: `translateY(${(1 - e) * 24}px)`}}>
                <Panel accent={theme.mech} style={{padding: '18px 22px'}}>
                  <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.mech}}>
                    {`两件事 · ${i + 1}/2`}
                  </div>
                  <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text, marginTop: 6}}>
                    {c.t}
                  </div>
                  <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginTop: 4}}>{c.s}</div>
                </Panel>
              </div>
            );
          })}
          <div
            style={{
              fontFamily: theme.sans,
              fontSize: 23,
              color: theme.dim,
              opacity: phase(frame, cardsAt + 22, 10),
            }}
          >
            {'认领、开工、汇报、等待、再认领——全是队友自己的节奏'}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P4Autonomy: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p4-01', 'p4-03');
  const bB = w('p4-04', 'p4-09');
  const bC = w('p4-10', 'p4-13');
  const bD = w('p4-14', 'p4-16');
  const bE = w('p4-17', 'p4-24');
  const rel = (b: {from: number}, id: string) => at(id) - b.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P4" title="自己看板，自己认领" meta="WORK · IDLE · SHUTDOWN" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="4-A 派工之累与生命周期">
        <DispatchFatigue cycleAt={rel(bA, 'p4-03')} />
      </Sequence>
      <Sequence {...bB} name="4-B 五秒心跳两看">
        <HeartbeatTwoLooks
          beatAt={0}
          mailAt={rel(bB, 'p4-05')}
          boardAt={rel(bB, 'p4-06')}
          claimAt={rel(bB, 'p4-07')}
        />
      </Sequence>
      <Sequence {...bC} name="4-C 六十秒收工与身份重注入">
        <SixtyClock
          clockAt={rel(bC, 'p4-10')}
          doneAt={rel(bC, 'p4-10') + 48}
          compactAt={rel(bC, 'p4-12')}
          cardAt={rel(bC, 'p4-13')}
        />
      </Sequence>
      <Sequence {...bD} name="4-D 包工头换项目经理">
        <ForemanToManager swapAt={rel(bD, 'p4-16')} cardsAt={rel(bD, 'p4-15')} />
      </Sequence>
      <Sequence {...bE} name="4-E 官方战例：十六个它写编译器">
        <CompilerCase
          gridAt={rel(bE, 'p4-17')}
          lockAt={rel(bE, 'p4-18')}
          scoreAt={rel(bE, 'p4-19')}
          bootAt={rel(bE, 'p4-20')}
          frostAt={rel(bE, 'p4-21')}
          splitAt={rel(bE, 'p4-23')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
