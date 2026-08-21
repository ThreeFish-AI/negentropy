/** P1 活挂在哪里：看板（分镜 1-A…1-D）
 *  TaskBoard 母题：任务卡五格 + 依赖箭头 DAG；完成即解锁传导波；
 *  幽灵依赖卡挡请求不炸；文件锁罩；高水位计数器；清单 vs 看板对照。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Counter, Footnote, LoopRing, Panel, phase, qBezier, SceneTag, useRingDot} from '../components/motifs';

/** 任务卡：五格（编号/标题/状态/主人/等谁）；TaskBoard 的成员单元 */
const TaskCard: React.FC<{
  id: string;
  subject: string;
  status: string;
  owner: string;
  blockedBy: string;
  x: number;
  y: number;
  appearAt: number;
  done?: boolean;
  unlocked?: number; // 0..1 解锁辉光
  dim?: boolean;
}> = ({id, subject, status, owner, blockedBy, x, y, appearAt, done = false, unlocked = 0, dim = false}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const e = spring({frame: frame - appearAt, fps, config: {damping: 200}});
  const glow = unlocked > 0 ? `0 0 ${26 * unlocked}px ${theme.mech}` : 'none';
  const border = done ? theme.mech : unlocked > 0.05 ? theme.mech : theme.panelBorder;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 300,
        opacity: e * (dim ? 0.45 : 1),
        transform: `translateY(${(1 - e) * 24}px)`,
      }}
    >
      <Panel
        accent={border}
        style={{
          padding: '12px 14px',
          background: unlocked > 0.05 ? theme.mechDeep : theme.panel,
          boxShadow: glow,
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
          <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{id}</span>
          <span style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 600, color: theme.text}}>
            {subject}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 8,
            fontFamily: theme.mono,
            fontSize: 17,
          }}
        >
          <span
            style={{
              padding: '1px 8px',
              borderRadius: 5,
              border: `1px solid ${done ? theme.mech : theme.panelBorder}`,
              color: done ? theme.mech : theme.dim,
            }}
          >
            {done ? 'completed' : status}
          </span>
          <span style={{color: theme.dim}}>{owner}</span>
        </div>
        <div
          style={{
            marginTop: 8,
            padding: '4px 8px',
            borderRadius: 6,
            background: blockedBy ? `${theme.mech}1f` : 'transparent',
            border: `1px solid ${blockedBy ? theme.mech : theme.panelBorder}`,
            fontFamily: theme.mono,
            fontSize: 17,
            color: blockedBy ? theme.mech : theme.dim,
          }}
        >
          {'等谁完工：'}
          {blockedBy || '—'}
        </div>
      </Panel>
    </div>
  );
};

/** 1-A 看板立起：框架描线 + 三张示例卡贴上 + 依赖箭头逐条连出 */
const BoardRises: React.FC<{cardsAt: number; arrowsAt: number}> = ({cardsAt, arrowsAt}) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [4, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 三张卡：建表 → 接口 / 文档（DAG：一父二子）
  const cards = [
    {id: 'T-01', subject: '建表', status: 'pending', owner: '—', blockedBy: '', x: 560, y: 60},
    {id: 'T-02', subject: '接口', status: 'pending', owner: '—', blockedBy: 'T-01', x: 250, y: 360},
    {id: 'T-03', subject: '文档', status: 'pending', owner: '—', blockedBy: 'T-01', x: 880, y: 360},
  ];
  // 依赖箭头：从 T-01 底边到 T-02/T-03 顶边（描线动画）
  const arrows = [
    {from: {x: 710, y: 60 + 180}, to: {x: 400, y: 360}},
    {from: {x: 710, y: 60 + 180}, to: {x: 1030, y: 360}},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="s12 · Task System" tagline="Big Goal, Small Files, On a Board" accent={theme.mech} />
      <div style={{position: 'relative', width: 1460, height: 620}}>
        {/* 看板框架描线（pathLength 归一化，红线三） */}
        <svg width={1460} height={620} style={{position: 'absolute', left: 0, top: 0}}>
          <rect
            x={20}
            y={16}
            width={1420}
            height={588}
            rx={18}
            fill="none"
            stroke={theme.mech}
            strokeWidth={5}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - draw}
          />
          <text
            x={64}
            y={72}
            fontFamily={theme.mono}
            fontSize={26}
            fill={theme.mech}
            opacity={draw > 0.6 ? 1 : 0}
          >
            {'.tasks/'}
          </text>
        </svg>
        {/* 卡片 */}
        {cards.map((c, i) => (
          <TaskCard key={c.id} {...c} appearAt={cardsAt + i * 10} />
        ))}
        {/* 依赖箭头 */}
        <svg width={1460} height={620} style={{position: 'absolute', left: 0, top: 0}}>
          {arrows.map((a, i) => {
            const t = interpolate(frame - arrowsAt - i * 12, [0, 18], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            if (t <= 0) return null;
            const mid = {x: (a.from.x + a.to.x) / 2, y: (a.from.y + a.to.y) / 2 + 40};
            const p = qBezier(a.from, mid, a.to, t);
            return (
              <g key={i}>
                <path
                  d={`M${a.from.x} ${a.from.y} Q ${mid.x} ${mid.y}, ${a.to.x} ${a.to.y}`}
                  fill="none"
                  stroke={theme.mech}
                  strokeWidth={4}
                  opacity={0.28}
                />
                <circle cx={p.x} cy={p.y} r={7} fill={theme.mech} />
              </g>
            );
          })}
        </svg>
      </div>
      <Footnote delay={arrowsAt + 20}>
        {'task.json 五字段：id · subject · status · owner · blockedBy'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 1-B ★完成即解锁 + ★幽灵依赖：勾动画 → 传导波沿箭头点亮两卡；幽灵卡把请求挡住不炸 */
const UnlockWave: React.FC<{checkAt: number; waveAt: number; ghostAt: number}> = ({
  checkAt,
  waveAt,
  ghostAt,
}) => {
  const frame = useCurrentFrame();
  const done = frame >= checkAt;
  // 解锁波：光点沿两条箭头飞向下游
  const wave = [
    {from: {x: 710, y: 240}, to: {x: 400, y: 360}},
    {from: {x: 710, y: 240}, to: {x: 1030, y: 360}},
  ].map((a, i) =>
    interpolate(frame - waveAt - i * 8, [0, 20], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const ghost = frame >= ghostAt;
  // 请求卡撞幽灵卡被弹回（deny）：弹回位移
  const bounce = ghost
    ? interpolate(frame - ghostAt - 20, [0, 12], [0, -120], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }) +
      (frame > ghostAt + 32 ? Math.sin((frame - ghostAt - 32) / 8) * 4 : 0)
    : 0;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1460, height: 620}}>
        {/* 左半：DAG 完成即解锁 */}
        <div style={{position: 'absolute', left: 0, top: 0, width: 980, height: 620}}>
          <TaskCard
            id="T-01"
            subject="建表"
            status="in_progress"
            owner="阿珍"
            blockedBy=""
            x={340}
            y={40}
            appearAt={2}
            done={done}
          />
          <TaskCard
            id="T-02"
            subject="接口"
            status="pending"
            owner="—"
            blockedBy="T-01"
            x={60}
            y={360}
            appearAt={2}
            unlocked={wave[0]}
          />
          <TaskCard
            id="T-03"
            subject="文档"
            status="pending"
            owner="—"
            blockedBy="T-01"
            x={620}
            y={360}
            appearAt={2}
            unlocked={wave[1]}
          />
          <svg width={980} height={620} style={{position: 'absolute', left: 0, top: 0}}>
            {wave.map((a, i) => {
              const from = {x: 490, y: 220};
              const to = i === 0 ? {x: 210, y: 360} : {x: 770, y: 360};
              const mid = {x: (from.x + to.x) / 2, y: 300};
              const p = qBezier(from, mid, to, a);
              return (
                <g key={i}>
                  <path
                    d={`M${from.x} ${from.y} Q ${mid.x} ${mid.y}, ${to.x} ${to.y}`}
                    fill="none"
                    stroke={theme.mech}
                    strokeWidth={4}
                    opacity={0.3}
                  />
                  {a > 0 && a < 1 ? <circle cx={p.x} cy={p.y} r={8} fill={theme.mech} /> : null}
                </g>
              );
            })}
            {/* 完成勾：绿→mech 色大勾划过 T-01 */}
            {done ? (
              <path
                d="M420 120 L470 170 L560 70"
                fill="none"
                stroke={theme.mech}
                strokeWidth={10}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - phase(frame, checkAt, 12)}
              />
            ) : null}
          </svg>
          {wave[1] > 0.9 ? (
            <div
              style={{
                position: 'absolute',
                left: 180,
                top: 570,
                fontFamily: theme.sans,
                fontSize: 25,
                color: theme.mech,
                opacity: phase(frame, waveAt + 30, 10),
              }}
            >
              {'排序是图自己算出来的'}
            </div>
          ) : null}
        </div>
        {/* 右半：幽灵依赖（不存在的依赖也算被挡） */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 120,
            width: 440,
            opacity: phase(frame, ghostAt, 10),
          }}
        >
          {/* 幽灵卡：半透明虚线 + 「算被挡」标签 */}
          <div
            style={{
              width: 300,
              padding: '12px 14px',
              border: `2px dashed ${theme.deny}`,
              borderRadius: 14,
              opacity: 0.55,
              background: `${theme.deny}0d`,
            }}
          >
            <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
              <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'T-77'}</span>
              <span style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 600, color: theme.dim}}>
                {'不存在'}
              </span>
            </div>
            <div
              style={{
                marginTop: 8,
                padding: '3px 8px',
                borderRadius: 5,
                border: `1px solid ${theme.deny}`,
                fontFamily: theme.sans,
                fontSize: 17,
                color: theme.deny,
                display: 'inline-block',
              }}
            >
              {'算被挡'}
            </div>
          </div>
          {/* 请求卡：撞上幽灵卡被弹回 */}
          <div
            style={{
              marginTop: 40,
              transform: `translateX(${bounce}px)`,
            }}
          >
            <Panel accent={ghost && bounce < -20 ? theme.deny : theme.panelBorder} style={{width: 300, padding: '12px 14px'}}>
              <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
                <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'T-04'}</span>
                <span style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 600, color: theme.text}}>
                  {'写测试'}
                </span>
              </div>
              <div
                style={{
                  marginTop: 8,
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: `${theme.deny}1f`,
                  border: `1px solid ${theme.deny}`,
                  fontFamily: theme.mono,
                  fontSize: 17,
                  color: theme.deny,
                  display: 'inline-block',
                }}
              >
                {'等谁完工：T-77（笔误）'}
              </div>
            </Panel>
          </div>
          {ghost ? (
            <div
              style={{
                marginTop: 22,
                fontFamily: theme.sans,
                fontSize: 23,
                color: theme.deny,
                opacity: phase(frame, ghostAt + 24, 10),
              }}
            >
              {'不报错 · 不崩溃 · 就是把你挡住'}
            </div>
          ) : null}
        </div>
      </div>
      <Footnote delay={ghostAt + 24}>{'不存在的依赖也算被挡——宁可挡着，不让笔误炸掉看板'}</Footnote>
    </AbsoluteFill>
  );
};

/** 1-C ★文件锁罩：认领两步在罩内一步完成；罩外之手被挡；高水位计数器只增 */
const FileLock: React.FC<{lockAt: number; handAt: number; countAt: number}> = ({
  lockAt,
  handAt,
  countAt,
}) => {
  const frame = useCurrentFrame();
  const lock = phase(frame, lockAt, 20);
  // 罩外之手：伸手 → 触壁 → 被挡回（deny 辉光 + 弹回）
  const handReach = interpolate(frame - handAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const handBlocked = frame >= handAt + 16;
  const handBack = handBlocked
    ? interpolate(frame - handAt - 16, [0, 12], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;
  // 手尖从画外伸到锁体右缘（x≈450）恰好被挡：-260 → -28 随 handReach，被挡后原路缩回
  const handX = -260 + handReach * 232 - handBack * 232;
  // 高水位计数器：只增不减（序号 41 → 42 → 43 每次跳变后不回落）
  const steps = [
    {at: countAt, v: 41},
    {at: countAt + 24, v: 42},
    {at: countAt + 48, v: 43},
  ];
  const cur = steps.filter((s) => frame >= s.at).length - 1;
  const dial = spring({frame: frame - lockAt, fps: 30, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 90}}>
        {/* 左：锁形罩子——「查看+落笔」两步包在罩内一步完成 */}
        <div style={{position: 'relative', width: 640, height: 470}}>
          {/* 锁罩：合拢动画（上半落下 + 下半升起 → 合为锁形） */}
          <svg width={640} height={470} style={{position: 'absolute', left: 0, top: 0}}>
            {/* 锁梁（上半）：从上方落下 */}
            <path
              d={`M${230} ${210 - (1 - lock) * 190} A90 90 0 0 1 ${410} ${210 - (1 - lock) * 190}`}
              fill="none"
              stroke={theme.mech}
              strokeWidth={14}
              strokeLinecap="round"
            />
            {/* 锁体（下半）：从下方升起 */}
            <rect
              x={200}
              y={210 + (1 - lock) * 230}
              width={240}
              height={180}
              rx={18}
              fill={`${theme.mech}14`}
              stroke={theme.mech}
              strokeWidth={6}
            />
            <text
              x={320}
              y={292 + (1 - lock) * 230}
              textAnchor="middle"
              fontFamily={theme.sans}
              fontSize={26}
              fontWeight={600}
              fill={theme.mech}
            >
              {'查看 + 落笔'}
            </text>
            <text
              x={320}
              y={330 + (1 - lock) * 230}
              textAnchor="middle"
              fontFamily={theme.sans}
              fontSize={21}
              fill={theme.dim}
            >
              {'两步并成一步'}
            </text>
          </svg>
          {/* 罩内：owner 格被一步写入（认领完成的落点） */}
          <div
            style={{
              position: 'absolute',
              left: 218,
              top: 252 + (1 - lock) * 200,
              opacity: lock > 0.9 ? phase(frame, lockAt + 22, 10) : 0,
              fontFamily: theme.mono,
              fontSize: 22,
              color: theme.mech,
            }}
          >
            {'owner: 阿珍'}
          </div>
          {/* 罩外之手：从右侧伸向锁体，被挡回（手尖 x = 478 + handX：-260→-28 推进） */}
          {frame >= handAt ? (
            <svg
              width={640}
              height={470}
              style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}
            >
              <g transform={`translate(${handX} 0)`}>
                {/* 手：剪影（drawn SVG），腕部从画外伸入 */}
                <path
                  d="M640 322 L500 322 L478 300 L486 272 L474 262 L494 250 L482 236 L502 232 L500 218 L520 228 L516 300 L640 300 Z"
                  fill={theme.dim}
                  opacity={0.8}
                />
              </g>
              {/* 被挡：锁体右缘的 deny 挡墙 + 冲击波纹（手尖推进终点 450 恰在墙外侧） */}
              {handBlocked ? (
                <>
                  <line
                    x1={450}
                    y1={210}
                    x2={450}
                    y2={390}
                    stroke={theme.deny}
                    strokeWidth={6}
                    strokeLinecap="round"
                  />
                  {[0, 1].map((k) => {
                    const w = interpolate(frame - handAt - 16, [0, 18], [0, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    });
                    return (
                      <circle
                        key={k}
                        cx={450}
                        cy={300}
                        r={16 + w * (60 + k * 30)}
                        fill="none"
                        stroke={theme.deny}
                        strokeWidth={4 - k * 1.5}
                        opacity={(1 - w) * (1 - k * 0.4)}
                      />
                    );
                  })}
                </>
              ) : null}
            </svg>
          ) : null}
          {handBlocked ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 436,
                textAlign: 'center',
                fontFamily: theme.sans,
                fontSize: 22,
                color: theme.deny,
                opacity: phase(frame, handAt + 30, 10),
              }}
            >
              {'第二只手插不进'}
            </div>
          ) : null}
        </div>
        {/* 右：高水位计数器（只增不减） */}
        <div style={{width: 420}}>
          <Panel accent={theme.mech} style={{padding: '26px 30px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
              {'任务编号 · 高水位'}
            </div>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 96,
                fontWeight: 700,
                color: theme.mech,
                marginTop: 8,
                fontVariantNumeric: 'tabular-nums',
                transform: `scale(${1 + (dial - 1) * 0.04})`,
              }}
            >
              {cur < 0 ? '——' : steps[cur].v}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 4}}>
              {'只增不减——编号永不复用'}
            </div>
            {/* 刻度尺：走过的格永远亮着（只上不下） */}
            <svg width={340} height={30} style={{marginTop: 14}}>
              {Array.from({length: 16}, (_, i) => {
                const lit = cur >= 0 && i <= steps[cur].v - 28;
                return (
                  <rect
                    key={i}
                    x={i * 21}
                    y={8}
                    width={14}
                    height={14}
                    rx={3}
                    fill={lit ? theme.mech : 'transparent'}
                    stroke={lit ? theme.mech : theme.panelBorder}
                    strokeWidth={2}
                  />
                );
              })}
            </svg>
          </Panel>
        </div>
      </div>
      <Footnote delay={lockAt + 4}>
        {'认领包进文件锁 · 高水位编号——课程作者的源码分析'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 1-D 清单 vs 看板对照：左小卡（给自己看）右大板（给所有人看）+ 可见光束 */
const ListVsBoard: React.FC<{beamAt: number}> = ({beamAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beam = phase(frame, beamAt, 22);
  const left = spring({frame: frame - 4, fps, config: {damping: 200}});
  const right = spring({frame: frame - 12, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1520, height: 620}}>
        {/* 左：清单小卡（给自己看——我今天干哪几步） */}
        <div
          style={{
            position: 'absolute',
            left: 40,
            top: 130,
            width: 380,
            opacity: left,
            transform: `translateY(${(1 - left) * 24}px)`,
          }}
        >
          <Panel style={{padding: '20px 24px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'清单'}</div>
            <div style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.text, marginTop: 6}}>
              {'给自己看'}
            </div>
            {['先改配置', '再跑迁移', '补两行测试'].map((s, i) => (
              <div key={s} style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginTop: 10}}>
                {`${i + 1}. ${s}`}
              </div>
            ))}
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 14}}>
              {'管执行的顺序 · 在脑子里'}
            </div>
          </Panel>
        </div>
        {/* 右：看板大板（给所有人看——这摊活到哪了） + 四方光束 */}
        <div
          style={{
            position: 'absolute',
            right: 40,
            top: 60,
            width: 640,
            opacity: right,
            transform: `translateY(${(1 - right) * 24}px)`,
          }}
        >
          <Panel accent={theme.mech} style={{padding: '20px 24px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.mech}}>{'看板 .tasks/'}</div>
            <div style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.text, marginTop: 6}}>
              {'给所有人看'}
            </div>
            {[
              ['T-01', '建表', 'completed'],
              ['T-02', '接口', 'in_progress'],
              ['T-03', '文档', 'pending'],
            ].map(([id, s, st]) => (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  marginTop: 10,
                  fontFamily: theme.mono,
                  fontSize: 21,
                }}
              >
                <span style={{color: theme.dim, width: 56}}>{id}</span>
                <span style={{color: theme.text, flex: 1}}>{s}</span>
                <span
                  style={{
                    color: st === 'completed' ? theme.mech : theme.dim,
                    border: `1px solid ${st === 'completed' ? theme.mech : theme.panelBorder}`,
                    borderRadius: 5,
                    padding: '0 8px',
                    fontSize: 17,
                  }}
                >
                  {st}
                </span>
              </div>
            ))}
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 14}}>
              {'管协作的进度 · 在硬盘上'}
            </div>
          </Panel>
        </div>
        {/* 光束：看板向四方投出「人人可见」的可视线（描线动画） */}
        <svg width={1520} height={620} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          {[
            {x2: 1160, y2: 60, cx: 1460, cy: -40},
            {x2: 1560, y2: 130, cx: 1660, cy: 40},
            {x2: 1560, y2: 560, cx: 1660, cy: 660},
            {x2: 1160, y2: 600, cx: 1300, cy: 720},
          ].map((b, i) => {
            const t = phase(frame, beamAt + i * 5, 16);
            if (t <= 0) return null;
            const p = qBezier({x: 1150, y: 330}, {x: b.cx, y: b.cy}, {x: b.x2, y: b.y2}, t);
            return (
              <g key={i}>
                <path
                  d={`M1150 330 Q ${b.cx} ${b.cy}, ${b.x2} ${b.y2}`}
                  fill="none"
                  stroke={theme.core}
                  strokeWidth={4}
                  opacity={0.35}
                />
                <circle cx={p.x} cy={p.y} r={7} fill={theme.core} opacity={0.9} />
              </g>
            );
          })}
        </svg>
        {beam > 0.8 ? (
          <div
            style={{
              position: 'absolute',
              right: 120,
              bottom: 20,
              fontFamily: theme.sans,
              fontSize: 26,
              color: theme.core,
              opacity: phase(frame, beamAt + 22, 10),
            }}
          >
            {'硬盘上的东西，人人可见'}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const P1Board: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p1-01', 'p1-06');
  const bB = w('p1-07', 'p1-10');
  const bC = w('p1-11', 'p1-15');
  const bD = w('p1-16', 'p1-21');
  const rel = (b: {from: number}, id: string) => at(id) - b.from;
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A 看板立起">
        <BoardRises cardsAt={rel(bA, 'p1-03')} arrowsAt={rel(bA, 'p1-05')} />
      </Sequence>
      <Sequence {...bB} name="1-B 完成即解锁与幽灵依赖">
        <UnlockWave checkAt={rel(bB, 'p1-08')} waveAt={rel(bB, 'p1-08') + 14} ghostAt={rel(bB, 'p1-09')} />
      </Sequence>
      <Sequence {...bC} name="1-C 文件锁与高水位">
        <FileLock lockAt={rel(bC, 'p1-14')} handAt={rel(bC, 'p1-14') + 24} countAt={rel(bC, 'p1-15')} />
      </Sequence>
      <Sequence {...bD} name="1-D 清单与看板">
        <ListVsBoard beamAt={rel(bD, 'p1-21')} />
      </Sequence>
    </AbsoluteFill>
  );
};
