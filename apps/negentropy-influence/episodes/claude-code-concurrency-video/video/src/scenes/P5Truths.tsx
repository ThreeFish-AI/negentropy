/** P5 时间表的真话（分镜 5-A…5-E）
 *  ★踩踏帧（一排表全指 9:00 齐射）→ ★确定性抖动（固定偏移错峰 / 随机漂移对照）
 *  → 七天退休章 → 诚实边界（进程灯灭秒摆停）→ 上限 50/低优先级/金句。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Footnote, Panel, SceneTag} from '../components/motifs';

/** 迷你钟面：时针/分针可指定角度，可选表盘描边色 */
const MiniClock: React.FC<{
  cx: number;
  cy: number;
  hourAng: number;
  minAng: number;
  stroke?: string;
  dim?: boolean;
  size?: number;
}> = ({cx, cy, hourAng, minAng, stroke, dim = false, size = 1}) => {
  const r = 46 * size;
  const c = stroke ?? theme.later;
  const hr = ((hourAng - 90) * Math.PI) / 180;
  const mr = ((minAng - 90) * Math.PI) / 180;
  return (
    <g opacity={dim ? 0.45 : 1}>
      <circle cx={cx} cy={cy} r={r} fill={theme.panel} stroke={c} strokeWidth={3.5} />
      <line x1={cx} y1={cy} x2={cx + r * 0.5 * Math.cos(hr)} y2={cy + r * 0.5 * Math.sin(hr)} stroke={theme.text} strokeWidth={4} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={cx + r * 0.78 * Math.cos(mr)} y2={cy + r * 0.78 * Math.sin(mr)} stroke={c} strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={3.5} fill={c} />
    </g>
  );
};

/** 5-A ★踩踏帧：一排表全指 9:00 → 任务箭头齐射 → 拥挤碰撞（deny 混乱） */
const Stampede: React.FC<{fireAt: number; crashAt: number}> = ({fireAt, crashAt}) => {
  const frame = useCurrentFrame();
  const N = 7;
  const fire = interpolate(frame - fireAt, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const crash = interpolate(frame - crashAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 混乱抖动（确定性 sin 叠加，帧驱动）
  const jit = (i: number) => Math.sin((frame / 3.1) + i * 2.4) * 7 * crash;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Cron Scheduler" tagline="Everyone Fires at 9:00" />
      <svg width={1600} height={560} style={{overflow: 'visible'}}>
        {/* 一排表：全部指 9:00（时针 270°、分针 270°） */}
        {Array.from({length: N}, (_, i) => (
          <g key={i} transform={`translate(${180 + i * 210} 160)`}>
            <MiniClock cx={0} cy={0} hourAng={270} minAng={270} stroke={fire >= 1 ? theme.deny : theme.later} />
            <text x={0} y={78} textAnchor="middle" fontFamily={theme.mono} fontSize={19} fill={theme.dim}>
              {`9:00 · 任务 ${i + 1}`}
            </text>
          </g>
        ))}
        {/* 齐射箭头：同时从各表射向同一服务入口 */}
        {Array.from({length: N}, (_, i) => {
          const x0 = 180 + i * 210;
          const y0 = 260;
          const tx = 800;
          const ty = 470;
          // 箭头推进 + 碰撞点散开
          const t = fire;
          const crashX = tx + jit(i);
          const crashY = ty + Math.cos((frame / 2.7) + i * 1.9) * 6 * crash;
          const px = x0 + (crashX - x0) * t;
          const py = y0 + (crashY - y0) * t;
          return (
            <g key={`a-${i}`}>
              <line x1={x0} y1={y0} x2={px} y2={py} stroke={theme.deny} strokeWidth={3} opacity={0.75} />
              <circle cx={px} cy={py} r={8} fill={theme.deny} opacity={0.9} />
            </g>
          );
        })}
        {/* 服务入口：被自己人踩踏 */}
        <g transform="translate(800 470)">
          <rect
            x={-130}
            y={-40 - crash * 6}
            width={260}
            height={80}
            rx={14}
            fill={theme.panel}
            stroke={crash > 0.3 ? theme.deny : theme.panelBorder}
            strokeWidth={crash > 0.3 ? 4 : 3}
            transform={`rotate(${Math.sin(frame / 3) * 3 * crash})`}
          />
          <text x={0} y={-4} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={crash > 0.3 ? theme.deny : theme.dim}>
            {'服务'}
          </text>
          <text x={0} y={26} textAnchor="middle" fontFamily={theme.sans} fontSize={20} fill={theme.deny} opacity={crash}>
            {'同一秒 · 自我踩踏'}
          </text>
        </g>
      </svg>
      <Footnote delay={crashAt}>{'全世界的定时器都卡整点 —— 第三方的源码分析'}</Footnote>
    </AbsoluteFill>
  );
};

/** 5-B ★确定性抖动：各表固定偏移错峰落下；随机漂移虚线对照；整点提前 90 秒逆行箭头 */
const DeterministicJitter: React.FC<{staggerAt: number; randomAt: number; earlyAt: number}> = ({
  staggerAt,
  randomAt,
  earlyAt,
}) => {
  const frame = useCurrentFrame();
  const N = 6;
  // 每张表一个固定偏移（算出来的，同一任务每次一样）：0/18/36/54/72/90 帧
  const offsets = Array.from({length: N}, (_, i) => i * 18);
  const fallen = (i: number) => frame >= staggerAt + offsets[i];
  // 「落下」= 分针从 12 点跳到错开的位置（各自固定角度差）
  const dropAng = (i: number) => {
    const t = interpolate(frame - staggerAt - offsets[i], [0, 8], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    // 落点角度：9 点 + 各自固定偏移（i*26°，绕开拥挤点）
    return 270 + t * (26 + i * 4);
  };
  // 随机漂移对照：轨迹线每次不一样（这里用确定性 sin 合成「漂移感」，但轨迹画成虚线 deny）
  const driftOn = frame >= randomAt;
  const early = interpolate(frame - earlyAt, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Cron Scheduler" tagline="Computed, Not Random" />
      <svg width={1700} height={620} style={{overflow: 'visible'}}>
        {/* 错峰一排表：各按固定偏移「落下」 */}
        {Array.from({length: N}, (_, i) => (
          <g key={i} transform={`translate(${150 + i * 220} 150)`}>
            <MiniClock
              cx={0}
              cy={0}
              hourAng={270}
              minAng={fallen(i) ? dropAng(i) : 270}
              stroke={fallen(i) ? theme.later : theme.panelBorder}
              dim={!fallen(i)}
            />
            <text x={0} y={82} textAnchor="middle" fontFamily={theme.mono} fontSize={19} fill={theme.dim}>
              {`+${(i * 3 + 3) % 17 || 3}s`}
            </text>
            <text x={0} y={106} textAnchor="middle" fontFamily={theme.sans} fontSize={17} fill={theme.later} opacity={fallen(i) ? 1 : 0.3}>
              {'固定偏移'}
            </text>
          </g>
        ))}
        {/* 对照：确定性 vs 随机（两条时间线） */}
        <g transform="translate(150 400)">
          <text x={0} y={-14} fontFamily={theme.sans} fontSize={22} fill={theme.later}>
            {'确定性偏移：每次迟到一样多，错峰又可预测'}
          </text>
          <line x1={0} y1={26} x2={1100} y2={26} stroke={theme.later} strokeWidth={4} />
          {[60, 320, 520, 760, 1000].map((x, i) => (
            <g key={i}>
              <line x1={x} y1={26} x2={x} y2={-8} stroke={theme.later} strokeWidth={3} />
              <circle cx={x} cy={26} r={7} fill={theme.later} />
            </g>
          ))}
        </g>
        {driftOn ? (
          <g transform="translate(150 500)">
            <text x={0} y={-14} fontFamily={theme.sans} fontSize={22} fill={theme.deny}>
              {'随机：会漂 —— 这次三秒下次十秒，说不准几点响'}
            </text>
            {/* 漂移虚线：脉冲点每次位置不同（deny 虚线轨迹） */}
            <line x1={0} y1={26} x2={1100} y2={26} stroke={theme.deny} strokeWidth={3} strokeDasharray="7 9" />
            {[140, 380, 660, 940].map((x, i) => {
              const wob = Math.sin(frame / 5 + i * 2.2) * 16;
              return (
                <circle key={i} cx={x + wob} cy={26} r={7} fill={theme.deny} opacity={0.8} />
              );
            })}
          </g>
        ) : null}
        {/* 整点提前 90 秒：逆行小箭头 */}
        {early > 0 ? (
          <g transform="translate(1370 120)" opacity={early}>
            <MiniClock cx={0} cy={0} hourAng={270} minAng={288} stroke={theme.mech} />
            <g transform="rotate(180 0 96)">
              <line x1={0} y1={70} x2={0} y2={96 + 40 * early} stroke={theme.mech} strokeWidth={4} />
              <path d={`M0 ${140 * early + 96} l-9 -14 h18 Z`} fill={theme.mech} />
            </g>
            <text x={0} y={182} textAnchor="middle" fontFamily={theme.sans} fontSize={20} fill={theme.mech}>
              {'整点活最多提前一分半'}
            </text>
            <text x={0} y={206} textAnchor="middle" fontFamily={theme.sans} fontSize={18} fill={theme.dim}>
              {'跟人流反着走'}
            </text>
          </g>
        ) : null}
      </svg>
      <Footnote delay={randomAt}>{'偏移按任务编号的确定性哈希算出 —— 同任务每次一样'}</Footnote>
    </AbsoluteFill>
  );
};

/** 5-C 七天退休：日历翻七天 → 退休章 → 最后一次脉冲 */
const RetireStamp: React.FC<{flipAt: number; stampAt: number}> = ({flipAt, stampAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 日历快翻：每 10 帧翻一页，共 7 页
  const page = Math.min(7, Math.floor(Math.max(0, frame - flipAt) / 10));
  const stamp = spring({frame: frame - stampAt, fps, config: {damping: 200}});
  const stampOn = frame >= stampAt;
  // 最后一次触发的小脉冲（章落下后闪一下）
  const pulse = stampOn ? interpolate(frame - stampAt - 8, [0, 6, 18], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) : 0;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Cron Scheduler" tagline="Retire After Seven Silent Days" />
      <div style={{display: 'flex', alignItems: 'center', gap: 100}}>
        {/* 日历：翻页计数 */}
        <div style={{position: 'relative', textAlign: 'center'}}>
          <svg width={300} height={330}>
            {/* 日历底座 */}
            <rect x={30} y={40} width={240} height={250} rx={16} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={3} />
            {/* 顶部翻页环 */}
            <line x1={110} y1={40} x2={110} y2={16} stroke={theme.dim} strokeWidth={4} />
            <line x1={190} y1={40} x2={190} y2={16} stroke={theme.dim} strokeWidth={4} />
            {/* 天数：翻到第 N 天 */}
            <text x={150} y={150} textAnchor="middle" fontFamily={theme.mono} fontSize={84} fill={theme.text}>
              {`${page}`}
            </text>
            <text x={150} y={200} textAnchor="middle" fontFamily={theme.sans} fontSize={26} fill={theme.dim}>
              {'天没动静'}
            </text>
            {/* 日历页角：翻页的动势（每页翻动时一角掀起） */}
            <path
              d={`M250 285 q${20 + (page % 2) * 8} -18 ${6 + (page % 3) * 5} -44 Z`}
              fill={theme.panelBorder}
              opacity={0.5}
            />
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 6}}>
            {'连续七天 · 周期任务'}
          </div>
        </div>
        {/* 退休章 */}
        <div style={{position: 'relative'}}>
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 58,
              fontWeight: 700,
              color: theme.deny,
              border: `5px solid ${theme.deny}`,
              borderRadius: 18,
              padding: '14px 30px',
              opacity: stampOn ? 0.92 * stamp : 0,
              transform: `rotate(${(-12 + 12 * stamp) * stamp}deg) scale(${0.6 + 0.4 * stamp})`,
              textAlign: 'center',
            }}
          >
            {'退休'}
            <div style={{fontSize: 22, fontWeight: 400, marginTop: 8, color: theme.dim}}>
              {'删前最后跑一次'}
            </div>
          </div>
          {/* 最后一次触发的小脉冲 */}
          {pulse > 0 ? (
            <div
              style={{
                position: 'absolute',
                right: -80,
                top: 10,
                width: 26,
                height: 26,
                borderRadius: 999,
                background: theme.later,
                boxShadow: `0 0 ${26 * pulse}px ${theme.later}`,
                opacity: pulse,
              }}
            />
          ) : null}
        </div>
      </div>
      <Footnote delay={stampAt}>{'忘了设的闹钟，不该响一辈子 —— 七天自动退休'}</Footnote>
    </AbsoluteFill>
  );
};

/** 5-D 官方新答案：后台会话由独立管家进程托管（Harness Engineering 改造版）
 *  六状态记账、行摘要小模型、状态落盘穿重启、接回从停点续跑。 */
const SupervisorFrame: React.FC<{supAt: number; statesAt: number; persistAt: number; resumeAt: number}> = ({
  supAt,
  statesAt,
  persistAt,
  resumeAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sup = spring({frame: frame - supAt, fps, config: {damping: 200}});
  const states = ['排队', '跑着', '等审批', '被拦', '收尾', '完事'];
  const persist = interpolate(frame - persistAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const resume = interpolate(frame - resumeAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1500, height: 640}}>
        {/* 管家进程：不眠的眼睛 */}
        <div
          style={{
            position: 'absolute',
            left: 660,
            top: 0,
            textAlign: 'center',
            opacity: sup,
            transform: `translateY(${(1 - sup) * -30}px)`,
          }}
        >
          <svg width={180} height={110}>
            <circle cx={90} cy={44} r={36} fill="none" stroke={theme.later} strokeWidth={5} />
            <circle cx={74} cy={44} r={7} fill={theme.later} />
            <circle cx={106} cy={44} r={7} fill={theme.later} />
            <path d="M90 96 L90 110" stroke={theme.later} strokeWidth={5} />
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.text, marginTop: 4}}>
            {'管家进程（独立常驻）'}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
            {'不需要任何终端活着'}
          </div>
        </div>
        {/* 六状态小环 */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 250, display: 'flex', justifyContent: 'center', gap: 20}}>
          {states.map((s, i) => {
            const e = interpolate(frame - statesAt - i * 6, [0, 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div
                key={s}
                style={{
                  border: `2px solid ${theme.later}`,
                  borderRadius: 999,
                  padding: '8px 20px',
                  fontFamily: theme.sans,
                  fontSize: 21,
                  color: theme.text,
                  background: theme.panel,
                  opacity: e,
                }}
              >
                {s}
              </div>
            );
          })}
        </div>
        {/* 状态落盘 + 穿重启 */}
        {persist > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 180,
              bottom: 120,
              width: 500,
              opacity: persist,
              transform: `translateY(${(1 - persist) * 16}px)`,
            }}
          >
            <Panel accent={theme.later} style={{padding: '16px 22px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.text}}>
                {'状态落盘 · 穿过自动更新与重启'}
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 6}}>
                {'sleep → wake 自动重连'}
              </div>
            </Panel>
          </div>
        ) : null}
        {/* 接回续跑 */}
        {resume > 0 ? (
          <div
            style={{
              position: 'absolute',
              right: 180,
              bottom: 120,
              width: 500,
              opacity: resume,
              transform: `translateY(${(1 - resume) * 16}px)`,
            }}
          >
            <Panel accent={theme.later} style={{padding: '16px 22px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.text}}>
                {'进程退出 ≠ 任务没了'}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 6}}>
                {'接回后，从停的地方继续'}
              </div>
            </Panel>
          </div>
        ) : null}
      </div>
      <Footnote delay={supAt}>
        {'agent view：后台会话托管 —— 官方文档 agent-view'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 5-E 上限 50/50 + 低优先级标记排队尾 + 金句卡 */
const CapAndQuote: React.FC<{lowAt: number; quoteAt: number}> = ({lowAt, quoteAt}) => {
  const frame = useCurrentFrame();
  if (frame >= quoteAt) {
    return (
      <QuoteCard
        zh="定时这件事，想象很浪漫，工程都在打补丁。"
        accent={theme.later}
      />
    );
  }
  const low = interpolate(frame - lowAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 90}}>
        {/* 满座计数器 */}
        <div style={{textAlign: 'center'}}>
          <Panel accent={theme.deny} style={{width: 340, padding: '26px 30px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'任务表容量'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 76, fontWeight: 700, color: theme.deny, marginTop: 6}}>
              {'50/50'}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginTop: 6}}>
              {'满了要先取消一条'}
            </div>
          </Panel>
          <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginTop: 14}}>
            {'闹钟太多的人，该想想是不是真需要'}
          </div>
        </div>
        {/* 低优先级：带「低」字标记的请求卡排到队尾 */}
        <div style={{position: 'relative', width: 620}}>
          <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim, marginBottom: 14}}>
            {'服务一忙，先紧着人的事'}
          </div>
          {/* 人的请求卡（前） */}
          <Panel accent={theme.core} style={{width: 460, padding: '14px 20px', marginBottom: 12}}>
            <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.text}}>{'你的话 · 正常优先级'}</span>
          </Panel>
          {/* 定时请求卡（后）：带「低」标记 */}
          <div style={{display: 'flex', alignItems: 'center', gap: 12, transform: `translateX(${low * 60}px)`, opacity: low > 0 ? 1 : 0.4}}>
            <Panel accent={theme.later} style={{width: 460, padding: '14px 20px'}}>
              <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.text}}>{'定时触发的活'}</span>
            </Panel>
            <div
              style={{
                fontFamily: theme.serif,
                fontSize: 30,
                fontWeight: 700,
                color: theme.later,
                border: `3px solid ${theme.later}`,
                borderRadius: 10,
                padding: '2px 14px',
                opacity: low,
              }}
            >
              {'低'}
            </div>
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.later, marginTop: 12, opacity: low}}>
            {'闹钟的事，往后稍稍'}
          </div>
        </div>
      </div>
      <Footnote delay={lowAt}>{'上限与低优先级标记 —— 第三方的源码分析'}</Footnote>
    </AbsoluteFill>
  );
};

export const P5Truths: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p5-01', 'p5-04');
  const bB = w('p5-05', 'p5-08');
  const bC = w('p5-09', 'p5-10');
  const bD = w('p5-11', 'p5-18');
  const bE = w('p5-19', 'p5-23b');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A 踩踏帧">
        <Stampede fireAt={at('p5-03') - bA.from} crashAt={at('p5-04') - bA.from} />
      </Sequence>
      <Sequence {...bB} name="5-B 确定性抖动">
        {/* 提前 90 秒的口播落在下一镜（p5-09），但分镜 5-B 动效列要求逆行箭头——
            锚在本镜末句尾段，先给视觉再由下镜口播收口 */}
        <DeterministicJitter
          staggerAt={at('p5-05') - bB.from}
          randomAt={at('p5-07') - bB.from}
          earlyAt={at('p5-08') - bB.from + 40}
        />
      </Sequence>
      <Sequence {...bC} name="5-C 七天退休">
        <RetireStamp flipAt={0} stampAt={at('p5-10') - bC.from} />
      </Sequence>
      <Sequence {...bD} name="5-D 诚实边界">
        {/* p5-15 讲「持久化保存的是定义」但属下一镜句区间——抽屉锚在本镜末句尾段展示，
            p5-15 口播接续解释（镜内画面与镜间口播的刻意交叠） */}
        <SupervisorFrame supAt={at('p5-14') - bD.from} statesAt={at('p5-16') - bD.from} persistAt={at('p5-15') - bD.from} resumeAt={at('p5-18') - bD.from} />
      </Sequence>
      <Sequence {...bE} name="5-E 上限与低优先级">
        <CapAndQuote lowAt={at('p5-19') - bE.from} quoteAt={at('p5-23') - bE.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
