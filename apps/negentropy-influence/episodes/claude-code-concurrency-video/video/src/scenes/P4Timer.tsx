/** P4 没人按的开始（分镜 4-A…4-E）
 *  提线木偶 vs 闹钟自摆 → 五格时间表 → 两道保险 → 四层模型（秒摆→队列→闸→循环）
 *  → 持久化两种与四层独立换件。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  Footnote,
  LoopRing,
  Panel,
  SceneTag,
  useRingDot,
} from '../components/motifs';

/** 4-A 提线木偶（你说一句它动一下）vs 闹钟自摆（自己响） */
const PuppetVsClock: React.FC<{clockAt: number}> = ({clockAt}) => {
  const frame = useCurrentFrame();
  // 木偶：每 22 帧被提一下（生硬地抽动一拍）
  const pull = Math.max(0, Math.sin((frame / 22) * Math.PI)) ** 3;
  // 闹钟摆锤：连续正弦自摆（自然）
  const swing = Math.sin((frame / 16) * Math.PI);
  const clockOn = frame >= clockAt;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Cron Scheduler" tagline="Nobody Presses Start" />
      <div style={{display: 'flex', gap: 120, alignItems: 'center'}}>
        {/* 左：提线木偶 */}
        <div style={{textAlign: 'center'}}>
          <svg width={320} height={380} style={{overflow: 'visible'}}>
            {/* 提线十字架 */}
            <line x1={40} y1={30} x2={280} y2={30} stroke={theme.dim} strokeWidth={3} />
            <line x1={160} y1={30} x2={160} y2={30 + 54 - pull * 12} stroke={theme.dim} strokeWidth={2} />
            <g transform={`translate(160 ${96 - pull * 16})`}>
              {/* 头 + 身，被提时整体上抽 */}
              <circle cx={0} cy={0} r={26} fill={theme.panel} stroke={theme.dim} strokeWidth={3} />
              <line x1={0} y1={26} x2={0} y2={150} stroke={theme.dim} strokeWidth={3} />
              {/* 手臂：被提时抬起（生硬的直角） */}
              <line x1={0} y1={64} x2={-58} y2={64 - pull * 44} stroke={theme.dim} strokeWidth={3} />
              <line x1={0} y1={64} x2={58} y2={64 - pull * 44} stroke={theme.dim} strokeWidth={3} />
              {/* 腿：悬空 */}
              <line x1={0} y1={150} x2={-34} y2={150 + 58 - pull * 10} stroke={theme.dim} strokeWidth={3} />
              <line x1={0} y1={150} x2={34} y2={150 + 58 - pull * 10} stroke={theme.dim} strokeWidth={3} />
              {/* 提线：手腕头顶 */}
              <line x1={0} y1={-26} x2={0} y2={-54 + pull * 16} stroke={theme.dim} strokeWidth={2} />
            </g>
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.dim, marginTop: 6}}>
            {'你说一句，它动一下'}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 4}}>
            {'（提线 · 被动）'}
          </div>
        </div>
        {/* vs 分隔 */}
        <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.dim, opacity: clockOn ? 1 : 0.4}}>
          {'vs'}
        </div>
        {/* 右：闹钟自摆 */}
        <div style={{textAlign: 'center'}}>
          <svg width={320} height={380} style={{overflow: 'visible'}} opacity={clockOn ? 1 : 0.25}>
            {/* 摆锤 */}
            <line x1={160} y1={54} x2={160} y2={54} stroke={theme.panelBorder} />
            <g transform={`translate(160 54) rotate(${swing * 22})`}>
              <line x1={0} y1={0} x2={0} y2={140} stroke={theme.later} strokeWidth={4} />
              <circle cx={0} cy={150} r={20} fill={theme.laterDeep} stroke={theme.later} strokeWidth={4} />
            </g>
            {/* 钟面 */}
            <circle cx={160} cy={250} r={0} />
            <g transform="translate(160 286)">
              <circle cx={0} cy={0} r={62} fill={theme.panel} stroke={theme.core} strokeWidth={5} />
              <line x1={0} y1={0} x2={0} y2={-42} stroke={theme.core} strokeWidth={5} strokeLinecap="round" />
              <line x1={0} y1={0} x2={28} y2={10} stroke={theme.core} strokeWidth={4} strokeLinecap="round" />
              {/* 双铃 */}
              <circle cx={-52} cy={-40} r={16} fill="none" stroke={theme.core} strokeWidth={4} />
              <circle cx={52} cy={-40} r={16} fill="none" stroke={theme.core} strokeWidth={4} />
            </g>
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 25, color: clockOn ? theme.text : theme.dim, marginTop: 6}}>
            {'闹钟不需要你盯着它才会响'}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.later, marginTop: 4}}>
            {'（自摆 · 到点自己响）'}
          </div>
        </div>
      </div>
      <Footnote delay={clockAt}>{'周期性的活，不该每次都等人来推'}</Footnote>
    </AbsoluteFill>
  );
};

/** 4-B 五格时间表大特写 + 三个实例逐个点亮（读法演示） */
const FiveFieldTable: React.FC<{frameAt: number; ex1At: number; ex2At: number; ex3At: number}> = ({
  frameAt,
  ex1At,
  ex2At,
  ex3At,
}) => {
  const frame = useCurrentFrame();
  const cols = ['分钟', '小时', '日', '月', '星期'];
  const frameT = interpolate(frame - frameAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const examples = [
    {at: ex1At, cells: ['0', '9', '*', '*', '*'], read: '每天早上九点 · 九点格填九，其余全星号'},
    {at: ex2At, cells: ['*/5', '*', '*', '*', '*'], read: '每五分钟 · 第一格写「星杠五」'},
    {at: ex3At, cells: ['0', '9', '*', '*', '1-5'], read: '工作日早上九点 · 再加一格一到五'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Cron Scheduler" tagline="Five Fields, Fifty Years" />
      {/* 五格框架 */}
      <div style={{display: 'flex', gap: 16, opacity: frameT}}>
        {cols.map((c, i) => (
          <div key={c} style={{width: 190, textAlign: 'center'}}>
            <div
              style={{
                fontFamily: theme.sans,
                fontSize: 24,
                color: theme.dim,
                paddingBottom: 10,
                borderBottom: `2px solid ${theme.panelBorder}`,
              }}
            >
              {c}
            </div>
            <div style={{position: 'relative', height: 96, marginTop: 14}}>
              {/* 底格（星号占位） */}
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 40,
                  color: theme.panelBorder,
                  lineHeight: '96px',
                }}
              >
                {'*'}
              </div>
              {/* 实例格覆盖层：三个实例上下堆叠显示 */}
              {examples.map((ex, k) => {
                const on = frame >= ex.at;
                const e = spring({frame: frame - ex.at, fps: 30, config: {damping: 200}});
                if (!on) return null;
                return (
                  <div
                    key={k}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 26 + k * 30,
                      fontFamily: theme.mono,
                      fontSize: 26,
                      color: ex.cells[i] === '*' ? theme.dim : theme.mech,
                      opacity: e * (k === 2 ? 1 : 0.8),
                      fontWeight: ex.cells[i] === '*' ? 400 : 700,
                    }}
                  >
                    {ex.cells[i]}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* 三个实例的读法逐行亮 */}
      <div style={{marginTop: 44, width: 1080}}>
        {examples.map((ex, k) => {
          const on = frame >= ex.at;
          return (
            <div
              key={k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 12,
                opacity: on ? 1 : 0.18,
              }}
            >
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 24,
                  color: on ? theme.mech : theme.dim,
                  width: 240,
                  whiteSpace: 'pre',
                }}
              >
                {ex.cells.join(' ')}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.text}}>{ex.read}</div>
            </div>
          );
        })}
      </div>
      <Footnote delay={ex3At}>{'Unix 用了五十年的五格写法 · 桌面 cron'}</Footnote>
    </AbsoluteFill>
  );
};

/** 4-C 两道保险：写表验格式（错表 deny 弹回）+ 磁盘恢复跳过坏条 */
const TwoGuards: React.FC<{rejectAt: number; skipAt: number}> = ({rejectAt, skipAt}) => {
  const frame = useCurrentFrame();
  const reject = spring({frame: frame - rejectAt, fps: 30, config: {damping: 200}});
  const skip = interpolate(frame - skipAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rows = [
    {expr: '0 9 * * *', bad: false},
    {expr: '99 9 * * *', bad: true},
    {expr: '*/5 * * * *', bad: false},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Cron Scheduler" tagline="Two Safety Nets" />
      <div style={{display: 'flex', gap: 90}}>
        {/* 保险一：写表验格式 */}
        <div style={{position: 'relative'}}>
          <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.dim, marginBottom: 16, textAlign: 'center'}}>
            {'保险一 · 写表先验格式'}
          </div>
          <div style={{position: 'relative'}}>
            <Panel accent={theme.panelBorder} style={{width: 520, padding: '20px 24px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 30, color: theme.text}}>{'0 9 * * *'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.mech, marginTop: 10}}>
                {'✓ 收下（进门）'}
              </div>
            </Panel>
            <div
              style={{
                marginTop: 18,
                transform: `translateX(${(1 - reject) * 90}px) rotate(${(1 - reject) * 8}deg)`,
                opacity: reject,
              }}
            >
              <Panel accent={theme.deny} style={{width: 520, padding: '20px 24px'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
                  <div style={{fontFamily: theme.mono, fontSize: 30, color: theme.deny}}>{'99 9 * * *'}</div>
                  <div
                    style={{
                      fontFamily: theme.sans,
                      fontSize: 22,
                      fontWeight: 700,
                      color: theme.bg,
                      background: theme.deny,
                      borderRadius: 8,
                      padding: '4px 12px',
                    }}
                  >
                    {'弹回'}
                  </div>
                </div>
                <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 10}}>
                  {'分钟格没有 99 · 进不了门'}
                </div>
              </Panel>
            </div>
          </div>
        </div>
        {/* 保险二：磁盘恢复逐条检查，坏条滑过不停 */}
        <div>
          <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.dim, marginBottom: 16, textAlign: 'center'}}>
            {'保险二 · 恢复时逐条检查'}
          </div>
          <Panel style={{width: 560, padding: '20px 24px', position: 'relative', overflow: 'hidden'}}>
            {rows.map((r, i) => {
              const t = interpolate(frame - skipAt + 12 - i * 12, [0, 16], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const passed = skip > 0.4;
              return (
                <div
                  key={r.expr}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    height: 64,
                    marginBottom: 10,
                    opacity: t,
                    transform: `translateX(${r.bad ? Math.sin(t * Math.PI) * 46 : 0}px)`,
                    borderRadius: 8,
                    background: r.bad ? theme.denyDeep : 'transparent',
                    border: `2px solid ${r.bad ? theme.deny : theme.panelBorder}`,
                  }}
                >
                  <div style={{fontFamily: theme.mono, fontSize: 26, color: r.bad ? theme.deny : theme.text, paddingLeft: 12}}>
                    {r.expr}
                  </div>
                  {r.bad && passed ? (
                    <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.deny}}>{'坏条 · 跳过不停'}</div>
                  ) : null}
                  {!r.bad && passed ? (
                    <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.mech}}>{'恢复'}</div>
                  ) : null}
                </div>
              );
            })}
          </Panel>
        </div>
      </div>
      <Footnote delay={skipAt}>{'校验先于注册 · 坏条不连累其余'}</Footnote>
    </AbsoluteFill>
  );
};

/** 4-D 四层模型：秒摆（每秒一跳）→ 队列 → 闲时闸 → 循环消费；分钟防重第二枪被挡 */
const FourLayerModel: React.FC<{dropAt: number; gateAt: number; dupAt: number}> = ({
  dropAt,
  gateAt,
  dupAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dot = useRingDot(2.5);
  // 秒摆：每秒一跳（later 节拍灯）
  const sec = Math.floor(frame / fps);
  const tickT = (frame % fps) / fps;
  const tick = tickT < 0.25 ? 1 - tickT / 0.25 : 0;
  // 命中分钟：一张卡落入队列（周期性演示：每 4 秒一次命中）
  const cycle = Math.floor(frame / (fps * 4));
  const hitInCycle = (frame % (fps * 4)) / (fps * 4);
  const hit = hitInCycle < 0.25;
  // 闸：队列有活且闲时才开（用 hit 后的一段时间演示开闸）
  const gateOpen = frame >= gateAt && hitInCycle >= 0.3 && hitInCycle < 0.7;
  // 防重：同分钟第二枪被挡（deny × + 弹开）
  const dup = spring({frame: frame - dupAt, fps, config: {damping: 200}});
  const dupOn = frame >= dupAt;
  // 卡片落入队列的动画位置
  const dropT = interpolate(frame - dropAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill>
      <SceneTag chapter="Cron Scheduler" tagline="Tick, Queue, Gate, Loop" />
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {/* 层 1：秒摆线程（每秒一跳） */}
        <g transform="translate(240 300)">
          <circle cx={0} cy={0} r={74} fill={theme.panel} stroke={theme.later} strokeWidth={5} />
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={-58 + tick * 10}
            stroke={theme.later}
            strokeWidth={6}
            strokeLinecap="round"
          />
          {tick > 0 ? <circle cx={0} cy={0} r={74 + tick * 10} fill="none" stroke={theme.later} strokeWidth={2} opacity={tick * 0.7} /> : null}
          <text x={0} y={120} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.text}>
            {'看表线程'}
          </text>
          <text x={0} y={150} textAnchor="middle" fontFamily={theme.mono} fontSize={19} fill={theme.dim}>
            {`每秒一跳 · 第 ${sec} 秒`}
          </text>
        </g>
        {/* 命中分钟：卡片塞进队列（dropT 落下） */}
        {dropT > 0 ? (
          <g transform={`translate(${300 + dropT * 300} ${320 + dropT * 60})`} opacity={Math.min(1, dropT * 2)}>
            <rect x={-92} y={-26} width={184} height={52} rx={9} fill={theme.laterDeep} stroke={theme.later} strokeWidth={2.5} />
            <text x={0} y={8} textAnchor="middle" fontFamily={theme.mono} fontSize={21} fill={theme.text}>
              {'0 9 * * *'}
            </text>
            {hit ? <circle cx={92} cy={0} r={9} fill={theme.later} /> : null}
          </g>
        ) : null}
        {/* 层 2：队列 */}
        <g transform="translate(700 380)">
          <rect x={0} y={-40} width={300} height={80} rx={12} fill="none" stroke={theme.later} strokeWidth={4} strokeDasharray="10 8" />
          <text x={150} y={6} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.later}>
            {'队列'}
          </text>
          <text x={150} y={52} textAnchor="middle" fontFamily={theme.mono} fontSize={19} fill={theme.dim}>
            {hit ? '到点 · 塞进一张' : '等待'}
          </text>
        </g>
        {/* 层 3：闸（闲时才开） */}
        <g transform="translate(1120 380)">
          {gateOpen ? (
            <rect x={-12} y={-96} width={24} height={54} rx={6} fill={theme.mech} transform="rotate(-52)" />
          ) : (
            <rect x={-12} y={-96} width={24} height={72} rx={6} fill={theme.mech} />
          )}
          <line x1={-60} y1={0} x2={60} y2={0} stroke={theme.panelBorder} strokeWidth={4} />
          <text x={0} y={52} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.mech}>
            {'闸 · 闲时才开'}
          </text>
          <text x={0} y={80} textAnchor="middle" fontFamily={theme.mono} fontSize={19} fill={theme.dim}>
            {gateOpen ? '队列有活 + 它闲着' : '合着'}
          </text>
        </g>
        {/* 层 4：循环消费（小环恒转） */}
        <g transform="translate(1400 250)">
          <LoopRing size={260} draw={1} dotProgress={dot} showLabels={false} />
          <text x={130} y={300} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.text}>
            {'循环 · 消费'}
          </text>
        </g>
        {/* 分钟标记防重：同分钟第二枪被挡 */}
        {dupOn ? (
          <g transform="translate(700 640)">
            <text x={0} y={-60} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.dim}>
              {'分钟标记 · 同一分钟只放一枪'}
            </text>
            {/* 第一枪：过 */}
            <g transform={`translate(${-120 - (1 - dup) * 40} 0)`} opacity={dup}>
              <rect x={-64} y={-26} width={128} height={52} rx={9} fill={theme.laterDeep} stroke={theme.later} strokeWidth={2.5} />
              <text x={0} y={8} textAnchor="middle" fontFamily={theme.mono} fontSize={20} fill={theme.text}>
                {'第 1 枪 ✓'}
              </text>
            </g>
            {/* 第二枪：被挡（弹开） */}
            <g transform={`translate(${60 + dup * 54} ${-dup * 8})`} opacity={dup}>
              <rect x={-64} y={-26} width={128} height={52} rx={9} fill={theme.denyDeep} stroke={theme.deny} strokeWidth={2.5} transform={`rotate(${dup * -14})`} />
              <text x={0} y={8} textAnchor="middle" fontFamily={theme.mono} fontSize={20} fill={theme.deny}>
                {'第 2 枪 ✗'}
              </text>
              <text x={0} y={48} textAnchor="middle" fontFamily={theme.sans} fontSize={19} fill={theme.deny}>
                {'已记「这一分钟发过了」'}
              </text>
            </g>
          </g>
        ) : null}
      </svg>
      <Footnote delay={gateAt}>{'到点的活在门口排队，等它把手头的说完'}</Footnote>
    </AbsoluteFill>
  );
};

/** 4-E 持久化两种（磁盘绕回重启箭头 / 内存淡出）+ 四层独立换件 */
/** 4-E 官方三档调度（Harness Engineering 改造版）：云端例程（关机也跑·不碰本地文件）/
 *  桌面定时（本机跨会话）/ 会话内循环（散场清空·只恢复没过期的）——
 *  老答案「系统定时表落盘」降为三档里的一档（虚影）；解耦四层换件收尾。 */
const ThreeTiers: React.FC<{tier1At: number; tier2At: number; tier3At: number; oldAt: number; swapAt: number}> = ({
  tier1At,
  tier2At,
  tier3At,
  oldAt,
  swapAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tiers = [
    {
      t: '云端例程',
      s: '关机也跑 · 不碰本地文件',
      icon: 'cloud',
      at: tier1At,
      strong: true,
    },
    {t: '桌面定时', s: '本机 · 跨会话', icon: 'house', at: tier2At},
    {t: '会话内循环', s: '新对话清空 · 只恢复没过期的', icon: 'chat', at: tier3At},
  ];
  const oldFade = interpolate(frame - oldAt, [0, 18], [1, 0.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const swap = interpolate(frame - swapAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const layers = [
    {t: '表', c: theme.mech, change: '换格式 ✓'},
    {t: '队列', c: theme.later, change: '换实现 ✓'},
    {t: '闸', c: theme.mech, change: '可调 ✓'},
    {t: '循环', c: theme.core, change: '一无所知'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Cron Scheduler" tagline="Three Tiers, One Loop" />
      {/* 三档卡片自上而下（自左而右）点亮 */}
      <div style={{display: 'flex', gap: 30, marginBottom: 44, alignItems: 'stretch'}}>
        {tiers.map((tr, i) => {
          const e = spring({frame: frame - tr.at, fps, config: {damping: 200}});
          if (e <= 0) return <div key={tr.t} style={{width: 340}} />;
          return (
            <div key={tr.t} style={{width: 340, opacity: e, transform: `translateY(${(1 - e) * 22}px)`}}>
              <Panel
                accent={tr.strong ? theme.later : theme.panelBorder}
                style={{
                  padding: '18px 20px',
                  textAlign: 'center',
                  background: tr.strong ? theme.laterDeep : theme.panel,
                }}
              >
                <svg width={300} height={96} style={{display: 'block', margin: '0 auto'}}>
                  {tr.icon === 'cloud' ? (
                    <>
                      <path
                        d="M96 74 a24 24 0 0 1 6 -47 a32 32 0 0 1 60 8 a22 22 0 0 1 -2 39 Z"
                        fill="none"
                        stroke={theme.later}
                        strokeWidth={4}
                      />
                      {/* 关机也跑：电源符嵌在云心 */}
                      <line x1={150} y1={44} x2={150} y2={60} stroke={theme.later} strokeWidth={4} strokeLinecap="round" />
                      <path d="M142 48 a11 11 0 1 0 16 0" fill="none" stroke={theme.later} strokeWidth={4} strokeLinecap="round" />
                    </>
                  ) : tr.icon === 'house' ? (
                    <>
                      <path d="M110 78 L110 46 L150 20 L190 46 L190 78 Z" fill="none" stroke={theme.dim} strokeWidth={4} />
                      <rect x={136} y={56} width={28} height={22} fill="none" stroke={theme.dim} strokeWidth={4} />
                      {/* 桌面即本机：小钟挂在屋顶 */}
                      <circle cx={150} cy={10} r={7} fill="none" stroke={theme.dim} strokeWidth={3} />
                    </>
                  ) : (
                    <>
                      <rect x={104} y={26} width={92} height={56} rx={12} fill="none" stroke={theme.dim} strokeWidth={4} />
                      <path d="M104 40 h92" stroke={theme.dim} strokeWidth={4} />
                      {/* 散场即清空：气泡里一只擦除斜线 */}
                      <line x1={130} y1={48} x2={170} y2={72} stroke={theme.dim} strokeWidth={3.5} strokeLinecap="round" />
                    </>
                  )}
                </svg>
                <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{tr.t}</div>
                <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 6}}>{tr.s}</div>
              </Panel>
            </div>
          );
        })}
      </div>
      {/* 老答案降级：系统定时表落盘 → 虚影（现在只是三档里的一档） */}
      <div
        style={{
          opacity: oldFade,
          filter: 'saturate(0.4)',
          marginBottom: 34,
          transform: 'translateY(0)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            border: `2px dashed ${theme.panelBorder}`,
            borderRadius: 10,
            padding: '10px 22px',
            fontFamily: theme.sans,
            fontSize: 21,
            color: theme.dim,
          }}
        >
          {'老答案：系统定时表落盘 —— 现在只是三档里的一档'}
        </div>
      </div>
      {/* 四层独立换件 */}
      <div style={{display: 'flex', gap: 20, opacity: swap > 0 ? 1 : 0.2, alignItems: 'center'}}>
        {layers.map((l, i) => (
          <div key={l.t} style={{transform: `translateY(${swap * (i === 3 ? 0 : -8)}px)`}}>
            <Panel
              accent={l.c}
              style={{
                width: 196,
                padding: '14px 16px',
                textAlign: 'center',
                background: swap > 0 && i < 3 ? `${l.c}18` : theme.panel,
              }}
            >
              <div style={{fontFamily: theme.serif, fontSize: 30, fontWeight: 700, color: l.c}}>{l.t}</div>
              <div style={{fontFamily: theme.mono, fontSize: 19, color: swap > 0 ? l.c : theme.dim, marginTop: 6}}>
                {swap > 0 ? l.change : '…'}
              </div>
            </Panel>
          </div>
        ))}
      </div>
      <Footnote delay={tier1At}>
        {'三档调度（云端例程 / 桌面定时 / 会话内）—— 官方文档 scheduled-tasks'}
      </Footnote>
    </AbsoluteFill>
  );
};

export const P4Timer: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p4-01', 'p4-04');
  const bB = w('p4-05', 'p4-08');
  const bC = w('p4-09', 'p4-10');
  const bD = w('p4-11', 'p4-18');
  const bE = w('p4-19', 'p4-27');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 木偶与闹钟">
        <PuppetVsClock clockAt={at('p4-04') - bA.from} />
      </Sequence>
      <Sequence {...bB} name="4-B 五格时间表">
        <FiveFieldTable
          frameAt={0}
          ex1At={at('p4-06') - bB.from}
          ex2At={at('p4-07') - bB.from}
          ex3At={at('p4-07') - bB.from + 60}
        />
      </Sequence>
      <Sequence {...bC} name="4-C 两道保险">
        <TwoGuards rejectAt={at('p4-09') - bC.from} skipAt={at('p4-10') - bC.from} />
      </Sequence>
      <Sequence {...bD} name="4-D 四层模型">
        <FourLayerModel
          dropAt={at('p4-11') - bD.from}
          gateAt={at('p4-15') - bD.from}
          dupAt={at('p4-12') - bD.from}
        />
      </Sequence>
      <Sequence {...bE} name="4-E 三档调度与换件">
        {/* p4-19 云端例程；p4-20 桌面定时+会话内；p4-21 老答案降级；p4-24 解耦收尾 */}
        <ThreeTiers
          tier1At={at('p4-19') - bE.from}
          tier2At={at('p4-20') - bE.from}
          tier3At={at('p4-20') - bE.from + 14}
          oldAt={at('p4-21') - bE.from}
          swapAt={at('p4-24') - bE.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
