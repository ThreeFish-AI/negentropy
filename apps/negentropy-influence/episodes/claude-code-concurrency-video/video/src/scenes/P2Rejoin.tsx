/** P2 干完怎么接回来（分镜 2-A…2-E）
 *  配对语义（一次调用↔一条结果）→ 两级队列（下一轮/稍后；用户输入永远在前）
 *  → 不插队保护 → 七种后台任务（later 统一、反枚举）→ 取件码回收与天平平衡。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  Footnote,
  LoopRing,
  NumberedCard,
  Panel,
  SceneTag,
  useRingDot,
} from '../components/motifs';

/** 2-A 配对语义：一次调用卡 ↔ 一条结果卡的锁扣「咔」；真结果换装成完成通知入队 */
const PairLock: React.FC<{lockAt: number; swapAt: number; queueAt: number}> = ({lockAt, swapAt, queueAt}) => {
  const frame = useCurrentFrame();
  const lock = spring({frame: frame - lockAt, fps: 30, config: {damping: 200}});
  // 两卡从左右向中间合拢对齐
  const close = interpolate(frame - lockAt + 12, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 换装：结果卡 → 完成通知卡（later 边框 + 新标签）
  const swap = interpolate(frame - swapAt, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 滑入队列：右移落进一个迷你队列槽
  const queue = interpolate(frame - queueAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const gap = 300 - 220 * close;
  const resultShift = queue * 260;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Background Tasks" tagline="Call ⇄ Result, Always Paired" />
      <svg width={1500} height={520} style={{overflow: 'visible'}}>
        {/* 调用卡（左） */}
        <g transform={`translate(${560 - gap} 180)`}>
          <rect x={-170} y={-62} width={340} height={124} rx={14} fill={theme.panel} stroke={theme.core} strokeWidth={3} />
          <text x={0} y={-14} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.dim}>
            {'一次调用'}
          </text>
          <text x={0} y={28} textAnchor="middle" fontFamily={theme.mono} fontSize={27} fill={theme.text}>
            {'toolu_01 · bash'}
          </text>
        </g>
        {/* 结果卡（右）→ 换装成完成通知 */}
        <g transform={`translate(${940 + gap * 0.4 + resultShift} 180)`}>
          <rect
            x={-170}
            y={-62}
            width={340}
            height={124}
            rx={14}
            fill={theme.panel}
            stroke={swap > 0.5 ? theme.later : theme.core}
            strokeWidth={3}
          />
          <text x={0} y={-14} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.dim}>
            {swap > 0.5 ? '完成通知（换装）' : '一条结果'}
          </text>
          <text x={0} y={28} textAnchor="middle" fontFamily={theme.mono} fontSize={27} fill={swap > 0.5 ? theme.later : theme.text}>
            {swap > 0.5 ? 'task_notification' : 'stdout · 退出码 0'}
          </text>
        </g>
        {/* 锁扣：两卡中间的环扣，lock 时「咔」地咬合（缩放脉冲） */}
        <g
          transform={`translate(${750 - gap * 0.7 + resultShift * 0.5} 180) scale(${0.8 + 0.25 * lock})`}
          opacity={Math.max(0.25, lock)}
        >
          <rect x={-20} y={-34} width={40} height={28} rx={7} fill="none" stroke={theme.mech} strokeWidth={5} />
          <rect x={-20} y={8} width={40} height={28} rx={7} fill="none" stroke={theme.mech} strokeWidth={5} />
        </g>
        {/* 迷你队列：右下的三个槽，换装卡滑入第一槽 */}
        <g transform="translate(1300 430)">
          <rect x={-150} y={-44} width={300} height={88} rx={12} fill="none" stroke={theme.panelBorder} strokeWidth={2.5} strokeDasharray="8 8" />
          <text x={0} y={8} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fill={theme.dim}>
            {'通知队列'}
          </text>
        </g>
        <text x={750} y={330} textAnchor="middle" fontFamily={theme.sans} fontSize={25} fill={theme.dim}>
          {'真结果不冒充占位，它换一个身份排队'}
        </text>
      </svg>
      <Footnote delay={swapAt}>{'一次调用永远对一条结果 —— 配对语义'}</Footnote>
    </AbsoluteFill>
  );
};

/** 2-B ★两级队列：环入口两条道（下一轮/稍后）；用户输入卡永远插在稍后队首 */
const TwoTierQueue: React.FC<{dropAt: number; userAt: number}> = ({dropAt, userAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dot = useRingDot(2.5);
  // 通知卡落到「稍后」道
  const notice = spring({frame: frame - dropAt, fps, config: {damping: 200}});
  // 用户输入卡随后落下，排到通知卡前面
  const user = spring({frame: frame - userAt, fps, config: {damping: 200}});
  return (
    <AbsoluteFill>
      <SceneTag chapter="Background Tasks" tagline="Next Round First, Later Second" />
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <g transform="translate(280 250)">
          <LoopRing size={380} draw={1} dotProgress={dot} showLabels={false} />
        </g>
        <text x={470} y={700} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.dim}>
          {'循环入口'}
        </text>
        {/* 「下一轮」道（上）：直接进环的道 */}
        <line x1={560} y1={330} x2={1460} y2={330} stroke={theme.mech} strokeWidth={4} />
        <text x={640} y={300} fontFamily={theme.sans} fontSize={26} fill={theme.mech}>
          {'下一轮 · next'}
        </text>
        {/* 「稍后」道（下）：默认道 */}
        <line x1={560} y1={470} x2={1460} y2={470} stroke={theme.later} strokeWidth={4} />
        <text x={640} y={440} fontFamily={theme.sans} fontSize={26} fill={theme.later}>
          {'稍后 · later'}
        </text>
        {/* 完成通知卡：落到「稍后」道尾 */}
        <g transform={`translate(${1180 - (1 - notice) * 200} 470)`} opacity={notice}>
          <rect x={-120} y={-32} width={240} height={64} rx={10} fill={theme.laterDeep} stroke={theme.later} strokeWidth={2.5} />
          <text x={0} y={9} textAnchor="middle" fontFamily={theme.mono} fontSize={22} fill={theme.text}>
            {'bg_0001 完成'}
          </text>
        </g>
        {/* 用户输入卡：随后落下，永远排它前面（x 更靠环口） */}
        <g transform={`translate(${900 - (1 - user) * 240} 470)`} opacity={user}>
          <rect x={-120} y={-32} width={240} height={64} rx={10} fill={theme.panel} stroke={theme.core} strokeWidth={3} />
          <text x={0} y={9} textAnchor="middle" fontFamily={theme.mono} fontSize={22} fill={theme.core}>
            {'你新输入的一句话'}
          </text>
        </g>
        {user > 0.9 ? (
          <text x={1040} y={550} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.core}>
            {'你的话永远排在它前面 —— 不插队'}
          </text>
        ) : null}
        {/* 信箱比喻角标 */}
        <g opacity={interpolate(frame - userAt - 20, [0, 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}>
          <rect x={1240} y={210} width={420} height={64} rx={12} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2.5} />
          <text x={1450} y={250} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.dim}>
            {'门口信箱：投得进，开箱看主人'}
          </text>
        </g>
      </svg>
      <Footnote delay={userAt}>{'队列两级：下一轮 ＞ 稍后 —— 第三方的源码分析'}</Footnote>
    </AbsoluteFill>
  );
};

/** 2-C 不插队保护：✗ 硬插气泡被截 vs ✓ 排队对照 */
const NoCutIn: React.FC<{badAt: number; goodAt: number}> = ({badAt, goodAt}) => {
  const frame = useCurrentFrame();
  const badOn = frame >= badAt;
  const goodOn = frame >= goodAt;
  const cut = interpolate(frame - badAt - 8, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const denyFlash = badOn && !goodOn ? (Math.floor(frame / 4) % 2 === 0 ? 1 : 0.45) : 0.85;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 60}}>
        {/* ✗ 帧：气泡被截断 */}
        <div style={{position: 'relative'}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: badOn ? theme.deny : theme.dim, marginBottom: 14, textAlign: 'center'}}>
            {'✗ 硬插（演示）'}
          </div>
          <Panel
            accent={badOn ? theme.deny : theme.panelBorder}
            style={{width: 560, padding: '22px 26px', opacity: badOn ? denyFlash : 0.35}}
          >
            <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginBottom: 10}}>
              {'你正问它一个正经问题'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 25, color: theme.text, whiteSpace: 'pre'}}>
              {'这一句还没说完就被拦腰'}
              <span style={{opacity: 1 - cut, color: cut > 0.5 ? theme.dim : theme.text}}>{'截断——'}</span>
            </div>
            {badOn ? (
              <div
                style={{
                  marginTop: 12,
                  fontFamily: theme.mono,
                  fontSize: 23,
                  color: theme.later,
                  opacity: cut,
                }}
              >
                {'[bg_0001 完成 · 闯入]'}
              </div>
            ) : null}
          </Panel>
        </div>
        {/* ✓ 帧：气泡完整说完再取信 */}
        <div>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: goodOn ? theme.mech : theme.dim, marginBottom: 14, textAlign: 'center'}}>
            {'✓ 排队（现实）'}
          </div>
          <Panel
            accent={goodOn ? theme.mech : theme.panelBorder}
            style={{width: 560, padding: '22px 26px', opacity: goodOn ? 1 : 0.35}}
          >
            <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginBottom: 10}}>
              {'你正问它一个正经问题'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 25, color: theme.text}}>
              {'这一句完整说完，思路不断——'}
            </div>
            {goodOn ? (
              <div style={{marginTop: 12, display: 'flex', alignItems: 'center', gap: 12}}>
                <div style={{fontFamily: theme.mono, fontSize: 23, color: theme.later}}>{'[bg_0001 完成]'}</div>
                <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'排队中，稍后取信'}</div>
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
      <Footnote delay={goodAt}>{'排队，保护的是对话的完整性'}</Footnote>
    </AbsoluteFill>
  );
};

/** 2-D 七种后台任务图标一排（统一 later，反枚举）+ 30 字标签卡 */
const SevenTasks: React.FC<{lightAt: number; labelAt: number}> = ({lightAt, labelAt}) => {
  const frame = useCurrentFrame();
  const tasks = [
    {t: '跑命令', m: 'bash'},
    {t: '本地分身', m: 'subagent'},
    {t: '远程分身', m: 'remote'},
    {t: '进程内队友', m: 'teammate'},
    {t: '工作流', m: 'workflow'},
    {t: '监控外接', m: 'watch'},
    {t: '做梦', m: 'memory'},
  ];
  // 30 字标签：像一条提交说明的短句，快速打出
  const label = 'install deps & verify build passes';
  const shown = Math.max(0, Math.min(label.length, Math.floor((frame - labelAt) / 1.2)));
  const labelOn = frame >= labelAt;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 18}}>
        {tasks.map((task, i) => (
          <NumberedCard
            key={task.t}
            index={i + 1}
            label={task.t}
            sub={task.m}
            active
            delay={lightAt + i * 4}
            width={186}
            accent={theme.later}
          />
        ))}
      </div>
      {labelOn ? (
        <div style={{marginTop: 52}}>
          <Panel accent={theme.later} style={{width: 900, padding: '20px 26px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginBottom: 8}}>
              {'小模型顺手贴的标签 · 约 30 字'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 28, color: theme.text, whiteSpace: 'pre'}}>
              {label.slice(0, shown)}
              <span style={{opacity: shown >= label.length ? 0.4 : 1, color: theme.later}}>▍</span>
            </div>
          </Panel>
        </div>
      ) : null}
      <Footnote delay={lightAt}>{'七种 —— 有人数过 · 跑命令只是其一'}</Footnote>
    </AbsoluteFill>
  );
};

/** 2-E 取件码回巢 + 账目天平 + 第一层全景盖章 */
const ClaimCheckScale: React.FC<{matchAt: number; scaleAt: number; stampAt: number}> = ({
  matchAt,
  scaleAt,
  stampAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dot = useRingDot(2.5);
  // 编号对号：完成通知带同号飞回占位条位置，对上号闪一下
  const fly = interpolate(frame - matchAt, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const matched = frame >= matchAt + 24;
  const from = {x: 1180, y: 250};
  const to = {x: 640, y: 430};
  const x = from.x + (to.x - from.x) * fly;
  const y = from.y + (to.y - from.y) * fly - Math.sin(fly * Math.PI) * 70;
  // 天平：两端各落一卡保持水平
  const balance = interpolate(frame - scaleAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const tilt = (1 - easeOut(balance)) * 10; // 先倾斜再回到水平
  // 盖章
  const stamp = spring({frame: frame - stampAt, fps, config: {damping: 200}});
  const stampOn = frame >= stampAt;
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {/* 占位条（左）：等结果的位置 */}
        <g transform="translate(640 430)">
          <rect x={-100} y={-28} width={200} height={56} rx={10} fill={theme.panel} stroke={matched ? theme.mech : theme.later} strokeWidth={3} />
          <text x={0} y={9} textAnchor="middle" fontFamily={theme.mono} fontSize={24} fill={matched ? theme.mech : theme.later}>
            {'bg_0001'}
          </text>
          <text x={0} y={-48} textAnchor="middle" fontFamily={theme.sans} fontSize={21} fill={theme.dim}>
            {'占位条 · 取件码'}
          </text>
        </g>
        {/* 完成通知（右上）：带同号飞回 */}
        {fly > 0 && fly < 1 ? (
          <g transform={`translate(${x} ${y})`}>
            <rect x={-110} y={-26} width={220} height={52} rx={10} fill={theme.laterDeep} stroke={theme.later} strokeWidth={2.5} />
            <text x={0} y={8} textAnchor="middle" fontFamily={theme.mono} fontSize={22} fill={theme.text}>
              {'bg_0001 完成'}
            </text>
          </g>
        ) : null}
        {matched ? (
          <text x={640} y={510} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.mech}>
            {'对上号 —— 该补哪句话，它知道'}
          </text>
        ) : null}
        {/* 天平（下半） */}
        <g transform={`translate(960 830)`} opacity={frame >= scaleAt ? 1 : 0.25}>
          <line x1={-30} y1={-140} x2={-30} y2={20} stroke={theme.panelBorder} strokeWidth={6} />
          <g transform={`rotate(${tilt})`}>
            <line x1={-220} y1={-140} x2={220} y2={-140} stroke={theme.dim} strokeWidth={6} strokeLinecap="round" />
            {/* 左盘：当场给结果 */}
            <g>
              <line x1={-220} y1={-140} x2={-220} y2={-84} stroke={theme.dim} strokeWidth={3} />
              <rect x={-300} y={-84} width={160} height={56} rx={9} fill={theme.coreDeep} stroke={theme.core} strokeWidth={2.5} />
              <text x={-220} y={-48} textAnchor="middle" fontFamily={theme.sans} fontSize={20} fill={theme.text}>
                {'当场给结果'}
              </text>
            </g>
            {/* 右盘：占位 + 补通知 */}
            <g>
              <line x1={220} y1={-140} x2={220} y2={-84} stroke={theme.dim} strokeWidth={3} />
              <rect x={140} y={-84} width={160} height={56} rx={9} fill={theme.laterDeep} stroke={theme.later} strokeWidth={2.5} />
              <text x={220} y={-48} textAnchor="middle" fontFamily={theme.sans} fontSize={20} fill={theme.text}>
                {'占位再补通知'}
              </text>
            </g>
          </g>
          <text x={0} y={64} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.dim}>
            {'每一次调用都有着落 —— 账目永远平'}
          </text>
        </g>
      </svg>
      {/* 右上小环 + 盖章「按下就走开 ✓」 */}
      <div style={{position: 'absolute', left: 200, top: 180}}>
        <LoopRing size={210} draw={1} dotProgress={dot} showLabels={false} />
      </div>
      {stampOn ? (
        <div
          style={{
            position: 'absolute',
            right: 210,
            bottom: 300,
            fontFamily: theme.serif,
            fontSize: 44,
            fontWeight: 700,
            color: theme.core,
            border: `4px solid ${theme.core}`,
            borderRadius: 14,
            padding: '10px 26px',
            opacity: 0.9 * stamp,
            transform: `rotate(${(-10 + 10 * stamp) * stamp}deg) scale(${0.7 + 0.3 * stamp})`,
          }}
        >
          {'第一层 · 按下就走开 ✓'}
        </div>
      ) : null}
      <Footnote delay={scaleAt}>{'编号，就是后台世界里的取件码'}</Footnote>
    </AbsoluteFill>
  );
};

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

export const P2Rejoin: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p2-01', 'p2-05');
  const bB = w('p2-06', 'p2-09');
  const bC = w('p2-10', 'p2-12');
  const bD = w('p2-13', 'p2-19');
  const bE = w('p2-20', 'p2-27');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 配对锁扣">
        <PairLock lockAt={at('p2-03') - bA.from} swapAt={at('p2-04') - bA.from} queueAt={at('p2-05') - bA.from} />
      </Sequence>
      <Sequence {...bB} name="2-B 两级队列">
        <TwoTierQueue dropAt={at('p2-07') - bB.from} userAt={at('p2-08') - bB.from} />
      </Sequence>
      <Sequence {...bC} name="2-C 不插队保护">
        <NoCutIn badAt={at('p2-11') - bC.from} goodAt={at('p2-12') - bC.from} />
      </Sequence>
      <Sequence {...bD} name="2-D 七种后台任务">
        <SevenTasks lightAt={at('p2-14') - bD.from} labelAt={at('p2-16') - bD.from} />
      </Sequence>
      <Sequence {...bE} name="2-E 取件码与天平">
        <ClaimCheckScale matchAt={at('p2-21') - bE.from} scaleAt={at('p2-23') - bE.from} stampAt={at('p2-26') - bE.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
