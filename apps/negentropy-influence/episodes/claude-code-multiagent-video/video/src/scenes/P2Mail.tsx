/** P2 话从哪里走：信箱（分镜 2-A…2-E）
 *  Mailboxes 母题 + 权限冒泡 + 不许孵队友。★RingHerd 反枚举考验：
 *  所有队友环一律 peer 同色同宽同节点，只有铭牌与位置不同。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  Footnote,
  LoopRing,
  NamePlate,
  NumberedCard,
  Panel,
  phase,
  qBezier,
  SceneTag,
  useRingDot,
} from '../components/motifs';

/** 0-A 临时工 vs 队友：左剪影淡出、右 peer 小环落位打铭牌 */
const TempVsTeammate: React.FC<{fadeAt: number; seatAt: number}> = ({fadeAt, seatAt}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  const fade = phase(frame, fadeAt, 20);
  const seat = phase(frame, seatAt, 16);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="s15 · Agent Teams" tagline="Teammates Are Not Temps" accent={theme.peer} />
      <div style={{display: 'flex', alignItems: 'center', gap: 120}}>
        {/* 左：临时工剪影（干完即走）——淡出 */}
        <div style={{width: 380, textAlign: 'center', opacity: 1 - fade}}>
          <svg width={300} height={330} style={{overflow: 'visible'}}>
            <g opacity={0.7}>
              <circle cx={150} cy={70} r={42} fill={theme.dim} />
              <path
                d="M150 118 L150 220 M150 146 L92 186 M150 146 L208 186 M150 220 L104 300 M150 220 L196 300"
                stroke={theme.dim}
                strokeWidth={16}
                strokeLinecap="round"
                fill="none"
              />
            </g>
            {/* 「走人」步态残影 */}
            {fade > 0.3
              ? [0, 1, 2].map((k) => (
                  <path
                    key={k}
                    d={`M${196 + k * 26} 300 l16 -8`}
                    stroke={theme.dim}
                    strokeWidth={5}
                    strokeLinecap="round"
                    opacity={(fade - 0.3) * (1 - k * 0.3)}
                  />
                ))
              : null}
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim, marginTop: 12}}>
            {'临时工'}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 6}}>
            {'一条回话的路 · 交完总结就走'}
          </div>
        </div>
        {/* 中缝分隔 */}
        <div style={{width: 3, height: 320, background: theme.panelBorder, opacity: 0.6}} />
        {/* 右：队友小环（peer）落位 + 铭牌——长期驻场 */}
        <div style={{width: 460, textAlign: 'center'}}>
          <div
            style={{
              transform: `translateY(${(1 - seat) * 30}px)`,
              opacity: seat,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <LoopRing size={250} draw={1} dotProgress={dot} tone="peer" showLabels={false} />
          </div>
          <div style={{marginTop: 14, display: 'flex', justifyContent: 'center', gap: 14}}>
            <NamePlate name="阿珍" />
            <NamePlate name="阿强" />
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 14, opacity: seat}}>
            {'自己的名字 · 自己的活 · 自己的节奏'}
          </div>
        </div>
      </div>
      {/* 对比定格章：三条「队友不是」 */}
      <div
        style={{
          position: 'absolute',
          bottom: 200,
          display: 'flex',
          gap: 26,
          opacity: phase(frame, fadeAt + 20, 12),
        }}
      >
        {['有名字', '有活', '驻场不散'].map((s, i) => (
          <NumberedCard key={s} index={i + 1} label={s} width={170} delay={fadeAt + 22 + i * 5} accent={theme.peer} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 信箱文件：面板 + 若干消息行（可划掉）。Mailboxes 母题的成员单元 */
const MailFile: React.FC<{
  name: string;
  x: number;
  y: number;
  lines: {text: string; at: number; struckAt?: number}[];
  flashAt?: number;
}> = ({name, x, y, lines, flashAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const e = spring({frame, fps, config: {damping: 200}});
  const flash = flashAt !== undefined ? phase(frame, flashAt, 12) : 0;
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: e}}>
      <Panel
        accent={flash > 0.2 ? theme.mech : theme.panelBorder}
        style={{width: 420, padding: '12px 16px', minHeight: 220}}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
          <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.peer}}>{name}</span>
          <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>
            {'mailbox.jsonl'}
          </span>
          {/* 小锁标：写文件带锁（p2-15 角标） */}
          <svg width={18} height={18} style={{marginLeft: 'auto', opacity: 0.7}}>
            <rect x={3} y={8} width={12} height={8} rx={2} fill="none" stroke={theme.mech} strokeWidth={2} />
            <path d="M6 8 V5 A3 3 0 0 1 12 5 V8" fill="none" stroke={theme.mech} strokeWidth={2} />
          </svg>
        </div>
        <div style={{marginTop: 10}}>
          {lines.map((ln) => {
            const on = frame >= ln.at;
            const struck = ln.struckAt !== undefined && frame >= ln.struckAt;
            const strikeT = struck && ln.struckAt !== undefined ? phase(frame, ln.struckAt, 8) : 0;
            return (
              <div
                key={ln.text}
                style={{
                  position: 'relative',
                  fontFamily: theme.mono,
                  fontSize: 19,
                  color: struck ? theme.dim : theme.text,
                  marginTop: 6,
                  opacity: on ? 1 : 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {struck && strikeT > 0 ? (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      height: 2,
                      width: `${100 * strikeT}%`,
                      background: theme.deny,
                    }}
                  />
                ) : null}
                <span style={{textDecoration: struck ? 'line-through' : 'none'}}>{ln.text}</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
};

/** 2-B ★信箱行：消息行沿弧线飞入对方文件；读取即划掉（一行淡出） */
const MailboxRow: React.FC<{sendAt: number; readAt: number}> = ({sendAt, readAt}) => {
  const frame = useCurrentFrame();
  // 弧线飞行：阿强的汇报 → 领队信箱；领队的分派 → 阿珍信箱（方向即语义）
  const flights = [
    {
      from: {x: 220, y: 360},
      to: {x: 700, y: 420},
      at: sendAt,
      kind: 'report',
    },
    {
      from: {x: 700, y: 420},
      to: {x: 1180, y: 440},
      at: sendAt + 26,
      kind: 'assign',
    },
  ];
  const read = frame >= readAt;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1620, height: 640}}>
        {/* 领队环（core）居中上方 */}
        <div style={{position: 'absolute', left: 700 - 100, top: 30}}>
          <LoopRing size={200} draw={1} dotProgress={useRingDot(2.5)} showLabels={false} />
          <div style={{textAlign: 'center', marginTop: 6}}>
            <NamePlate name="领队" tone="core" />
          </div>
        </div>
        {/* 阿强 / 阿珍的 peer 环 + 信箱文件 */}
        {[
          {name: '阿强', x: 60},
          {name: '阿珍', x: 1080},
        ].map((m) => (
          <div key={m.name} style={{position: 'absolute', left: m.x, top: 90}}>
            <LoopRing size={160} draw={1} dotProgress={useRingDot(2.5)} tone="peer" showLabels={false} />
            <div style={{textAlign: 'center', marginTop: 6}}>
              <NamePlate name={m.name} />
            </div>
            <div style={{marginTop: 18}}>
              <MailFile
                name={m.name}
                x={0}
                y={0}
                lines={
                  m.name === '阿强'
                    ? [{text: 'report: 接口改完', at: sendAt + 22}]
                    : [
                        {text: 'assign: 补齐文档', at: sendAt + 48},
                        {text: 'ack: 收到', at: sendAt + 70},
                      ]
                }
              />
            </div>
          </div>
        ))}
        {/* 领队信箱 */}
        <div style={{position: 'absolute', left: 700 - 210, top: 330}}>
          <MailFile
            name="领队"
            x={0}
            y={0}
            lines={[
              {text: 'report: 接口改完', at: sendAt + 20, struckAt: readAt},
              {text: 'report: 文档写好', at: sendAt + 40, struckAt: readAt + 14},
            ]}
            flashAt={readAt}
          />
        </div>
        {/* 消息行飞行弧线 */}
        <svg width={1620} height={640} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          {flights.map((f, i) => {
            const t = interpolate(frame - f.at, [0, 22], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            if (t <= 0 || t >= 1) return null;
            const c = {x: (f.from.x + f.to.x) / 2, y: Math.min(f.from.y, f.to.y) - 110};
            const p = qBezier(f.from, c, f.to, t);
            return (
              <g key={i}>
                <path
                  d={`M${f.from.x} ${f.from.y} Q ${c.x} ${c.y}, ${f.to.x} ${f.to.y}`}
                  fill="none"
                  stroke={theme.peer}
                  strokeWidth={3}
                  opacity={0.3}
                />
                <rect
                  x={p.x - 110}
                  y={p.y - 20}
                  width={220}
                  height={38}
                  rx={7}
                  fill={theme.panel}
                  stroke={theme.peer}
                  strokeWidth={2}
                  opacity={0.95}
                />
                <text
                  x={p.x}
                  y={p.y + 5}
                  textAnchor="middle"
                  fontFamily={theme.mono}
                  fontSize={17}
                  fill={theme.text}
                >
                  {`{"type": "${f.kind}"}`}
                </text>
              </g>
            );
          })}
        </svg>
        {read ? (
          <div
            style={{
              position: 'absolute',
              left: 700 - 210,
              top: 600,
              width: 420,
              textAlign: 'center',
              fontFamily: theme.sans,
              fontSize: 24,
              color: theme.mech,
              opacity: phase(frame, readAt + 6, 10),
            }}
          >
            {'读一条，划掉一条'}
          </div>
        ) : null}
      </div>
      <Footnote delay={readAt}>{'写文件带锁，防两个队友投信写串行——课程作者的源码分析'}</Footnote>
    </AbsoluteFill>
  );
};

/** 2-C 十五种消息类型墙（反枚举：统一 panel 底编号）缩成一行字 */
const FifteenTypes: React.FC<{wallAt: number; shrinkAt: number}> = ({wallAt, shrinkAt}) => {
  const frame = useCurrentFrame();
  const names = [
    '普通消息', '空闲通知', '权限请求', '权限回复', '计划审批',
    '审批回复', '关机请求', '关机同意', '关机拒绝', '任务分派',
    '权限广播', '模式修改', '沙箱权限', '移除通知', '广播通知',
  ];
  const shrink = phase(frame, shrinkAt, 20);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 类型墙：5×3 编号卡（反枚举：无 N 色，激活时才 mech 染色） */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 250px)',
          gap: 16,
          transform: `scale(${1 - shrink * 0.55}) translateY(${shrink * -60}px)`,
          opacity: 1 - shrink,
        }}
      >
        {names.map((n, i) => (
          <NumberedCard
            key={n}
            index={i + 1}
            label={n}
            width={250}
            delay={wallAt + i * 2}
            active
            accent={theme.mech}
          />
        ))}
      </div>
      {/* 收束句：全部缩成一行字 */}
      <div
        style={{
          position: 'absolute',
          fontFamily: theme.serif,
          fontSize: 52,
          fontWeight: 700,
          color: theme.mech,
          opacity: shrink,
          transform: `translateY(${(1 - shrink) * 30}px)`,
        }}
      >
        {'往文件里加一行带类型的字'}
      </div>
      {shrink < 0.5 ? (
        <Footnote delay={wallAt + 10}>{'消息类型 15 种——课程作者的源码分析'}</Footnote>
      ) : null}
    </AbsoluteFill>
  );
};

/** 2-D ★权限冒泡：审批卡沿虚线上浮领队屏 → 点头 → 回执下落 */
const BubbleUp: React.FC<{riseAt: number; nodAt: number; downAt: number}> = ({riseAt, nodAt, downAt}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 上浮 → 点头 → 回执下落：三段
  const rise = interpolate(frame - riseAt, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const nod = phase(frame, nodAt, 10);
  const down = interpolate(frame - downAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 冒泡涟漪：卡片上浮时逐圈扩散
  const ripple = interpolate((frame - riseAt) % 40, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1400, height: 700}}>
        {/* 底部：队友（阿珍）环 + 名字 */}
        <div style={{position: 'absolute', left: 600, top: 470, textAlign: 'center'}}>
          <LoopRing size={180} draw={1} dotProgress={dot} tone="peer" showLabels={false} />
          <div style={{marginTop: 8}}>
            <NamePlate name="阿珍" />
          </div>
        </div>
        {/* 顶部：领队屏幕（面板 + 环） */}
        <div
          style={{
            position: 'absolute',
            left: 500,
            top: 30,
            width: 400,
            textAlign: 'center',
          }}
        >
          <Panel accent={theme.core} style={{padding: '16px 20px'}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14}}>
              <LoopRing size={110} draw={1} dotProgress={dot} showLabels={false} />
              <div style={{textAlign: 'left'}}>
                <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.core}}>{'你的屏幕'}</div>
                <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'领队 · 审批队列'}</div>
              </div>
            </div>
          </Panel>
        </div>
        {/* 虚线通道：队友 → 领队屏（常驻） */}
        <svg width={1400} height={700} style={{position: 'absolute', left: 0, top: 0}}>
          <line
            x1={700}
            y1={470}
            x2={700}
            y2={190}
            stroke={theme.mech}
            strokeWidth={3}
            strokeDasharray="10 10"
            opacity={0.5}
          />
          {/* 上浮涟漪 */}
          {rise > 0 && rise < 1
            ? [0, 1].map((k) => (
                <circle
                  key={k}
                  cx={700}
                  cy={470 - rise * 280}
                  r={26 + ripple * (70 + k * 34)}
                  fill="none"
                  stroke={theme.mech}
                  strokeWidth={3 - k}
                  opacity={(1 - ripple) * (0.6 - k * 0.25)}
                />
              ))
            : null}
          {/* 点头光标 */}
          {nod > 0 ? (
            <g>
              {/* 箭头形光标 */}
              <path
                d="M760 226 L760 262 L770 252 L778 268 L784 265 L776 250 L790 250 Z"
                fill={theme.text}
                opacity={0.9}
                transform={`translate(0 ${nod > 0.6 ? 8 : 0})`}
              />
            </g>
          ) : null}
        </svg>
        {/* 审批卡：从队友处上浮（带队友名字与颜色——peer） */}
        <div
          style={{
            position: 'absolute',
            left: 700 - 200,
            top: 470 - rise * 280 + down * 280,
            opacity: rise > 0 ? 1 : 0,
          }}
        >
          <Panel accent={theme.peer} style={{width: 400, padding: '14px 18px'}}>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
              <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.peer}}>{'阿珍'}</span>
              <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{'permission_request'}</span>
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text, marginTop: 6}}>
              {'跑一条安装依赖的命令'}
            </div>
            <div style={{display: 'flex', gap: 12, marginTop: 10}}>
              <span
                style={{
                  padding: '3px 16px',
                  borderRadius: 7,
                  border: `2px solid ${nod > 0 ? theme.mech : theme.panelBorder}`,
                  color: nod > 0 ? theme.mech : theme.dim,
                  fontFamily: theme.sans,
                  fontSize: 20,
                }}
              >
                {'同意'}
              </span>
              <span
                style={{
                  padding: '3px 16px',
                  borderRadius: 7,
                  border: `2px solid ${theme.panelBorder}`,
                  color: theme.dim,
                  fontFamily: theme.sans,
                  fontSize: 20,
                }}
              >
                {'拒绝'}
              </span>
            </div>
          </Panel>
        </div>
        {/* 回执：点头后下落回队友信箱 */}
        {down > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 700 - 170,
              top: 190 + down * 280,
              opacity: Math.min(1, down * 3),
            }}
          >
            <Panel accent={theme.mech} style={{width: 340, padding: '10px 16px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.mech}}>
                {'approved → 阿珍的信箱'}
              </div>
            </Panel>
          </div>
        ) : null}
        {nod > 0 && down < 0.3 ? (
          <div
            style={{
              position: 'absolute',
              left: 820,
              top: 140,
              fontFamily: theme.sans,
              fontSize: 24,
              color: theme.text,
              opacity: phase(frame, nodAt + 4, 8) * (1 - down),
            }}
          >
            {'点头'}
          </div>
        ) : null}
      </div>
      <Footnote delay={riseAt}>{'组了队，权限的签字栏还在你手里'}</Footnote>
    </AbsoluteFill>
  );
};

/** 2-E 不许孵队友（deny 栏杆）+ 转包混乱链碎裂 + 「扁平是保险丝」横幅 */
const NoSubteams: React.FC<{barAt: number; chaosAt: number; bannerAt: number}> = ({
  barAt,
  chaosAt,
  bannerAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dot = useRingDot(2.5);
  // 栏杆落下
  const bar = phase(frame, barAt, 12);
  // 招人手伸出 → 被 deny 栏杆挡住
  const reach = interpolate(frame - 8, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 混乱链：队伍生队伍、审批卡冒十层泡——一闪即碎
  const chaos = phase(frame, chaosAt, 8);
  const shatter = interpolate(frame - chaosAt - 24, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 横幅：保险丝形状（mech）
  const banner = phase(frame, bannerAt, 18);
  const bannerSpring = spring({frame: frame - bannerAt, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 主画面：领队 + 队友；队友伸「招人」手被栏杆挡 */}
      <div style={{position: 'relative', width: 1400, height: 560, opacity: 1 - banner * 0.86}}>
        {/* 领队环 */}
        <div style={{position: 'absolute', left: 180, top: 170, textAlign: 'center'}}>
          <LoopRing size={220} draw={1} dotProgress={dot} />
          <div style={{marginTop: 8}}>
            <NamePlate name="领队" tone="core" />
          </div>
        </div>
        {/* 队友环（peer） */}
        <div style={{position: 'absolute', left: 900, top: 190, textAlign: 'center'}}>
          <LoopRing size={180} draw={1} dotProgress={dot} tone="peer" showLabels={false} />
          <div style={{marginTop: 8}}>
            <NamePlate name="阿强" />
          </div>
          {/* 「招人」手：从队友环左侧伸出（reach 推进 → 手尖 x = -250+reach*150，至 -100） */}
          <svg width={340} height={120} style={{position: 'absolute', left: -340, top: 30, overflow: 'visible'}}>
            <g transform={`translate(${reach * 150} 0)`}>
              <path
                d="M64 62 L24 62 L10 54 L10 36 L22 32 L14 22 L28 20 L26 8 L40 14 L46 38 L64 38 Z"
                fill={theme.peer}
                opacity={0.85}
              />
              <text x={70} y={46} fontFamily={theme.sans} fontSize={21} fill={theme.peer}>
                {'想再招一个'}
              </text>
            </g>
          </svg>
          {/* deny 栏杆：从上落下，竖立在「招人」方向的路径上（手尖推进终点 -100 的左侧） */}
          <div style={{position: 'absolute', left: -160, top: -120, opacity: bar}}>
            <svg width={150} height={300} style={{overflow: 'visible'}}>
              {[0, 1, 2].map((i) => (
                <line
                  key={i}
                  x1={30 + i * 45}
                  y1={(1 - bar) * -320}
                  x2={30 + i * 45}
                  y2={280}
                  stroke={theme.deny}
                  strokeWidth={9}
                  strokeLinecap="round"
                />
              ))}
              <line
                x1={12}
                y1={48 + (1 - bar) * -320}
                x2={138}
                y2={48 + (1 - bar) * -320}
                stroke={theme.deny}
                strokeWidth={7}
                strokeLinecap="round"
              />
              <line x1={12} y1={230} x2={138} y2={230} stroke={theme.deny} strokeWidth={7} strokeLinecap="round" />
            </svg>
          </div>
        </div>
        {/* 一层就是一层：主结构注记 */}
        <div
          style={{
            position: 'absolute',
            left: 470,
            top: 90,
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.dim,
            opacity: phase(frame, barAt + 8, 10),
          }}
        >
          {'一层队伍就是一层'}
        </div>
      </div>
      {/* 转包混乱链：队伍生队伍审批卡冒十层泡（一闪即碎） */}
      {chaos > 0 && shatter < 1 ? (
        <div
          style={{
            position: 'absolute',
            opacity: chaos * (1 - shatter),
            transform: `scale(${1 + shatter * 0.2})`,
          }}
        >
          <svg width={900} height={420}>
            {/* 子子孙孙树：每层一张审批卡，层层上浮的小泡 */}
            {Array.from({length: 10}, (_, i) => {
              const depth = Math.floor(i / 3);
              const x = 150 + ((i % 3) + 1) * (170 + depth * 34);
              const y = 330 - depth * 86;
              const wob = Math.sin((frame + i * 7) / 5) * 5;
              return (
                <g key={i} transform={`translate(0 ${wob})`}>
                  <rect
                    x={x}
                    y={y}
                    width={110}
                    height={54}
                    rx={8}
                    fill={theme.panel}
                    stroke={i % 4 === 3 ? theme.deny : theme.peer}
                    strokeWidth={2.5}
                    opacity={0.9}
                  />
                  <text
                    x={x + 55}
                    y={y + 34}
                    textAnchor="middle"
                    fontFamily={theme.mono}
                    fontSize={17}
                    fill={theme.dim}
                  >
                    {`审批 ${i + 1}`}
                  </text>
                  {/* 冒泡的小圈 */}
                  <circle cx={x + 55} cy={y - 14 - ((frame / 2 + i * 9) % 20)} r={5} fill={theme.peer} opacity={0.5} />
                </g>
              );
            })}
            {/* 混乱连线 */}
            {Array.from({length: 8}, (_, i) => (
              <line
                key={i}
                x1={120 + (i % 4) * 190}
                y1={330 - Math.floor(i / 4) * 86}
                x2={200 + (i % 3) * 190}
                y2={244 - Math.floor(i / 3) * 86}
                stroke={theme.panelBorder}
                strokeWidth={2}
                opacity={0.7}
              />
            ))}
            <text x={30} y={390} fontFamily={theme.sans} fontSize={24} fill={theme.deny}>
              {'一张审批卡要冒十层泡 · 找不到责任人'}
            </text>
          </svg>
        </div>
      ) : null}
      {/* 碎裂闪光：混乱链碎裂瞬间的径向裂线 */}
      {shatter > 0 && shatter < 1 ? (
        <svg width={1000} height={500} style={{position: 'absolute', pointerEvents: 'none'}}>
          {Array.from({length: 10}, (_, i) => {
            const ang = (i / 10) * Math.PI * 2;
            const r0 = 60 + shatter * 120;
            const r1 = r0 + 90 * (1 - shatter);
            return (
              <line
                key={i}
                x1={500 + r0 * Math.cos(ang)}
                y1={250 + r0 * Math.sin(ang)}
                x2={500 + r1 * Math.cos(ang)}
                y2={250 + r1 * Math.sin(ang)}
                stroke={theme.deny}
                strokeWidth={4}
                opacity={1 - shatter}
              />
            );
          })}
        </svg>
      ) : null}
      {/* 「扁平是保险丝」横幅：保险丝形状（mech）——两头端子 + 中段细丝 */}
      {banner > 0 ? (
        <div
          style={{
            position: 'absolute',
            textAlign: 'center',
            opacity: banner,
            transform: `translateY(${(1 - bannerSpring) * 40}px)`,
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 58, fontWeight: 700, color: theme.mech}}>
            {'扁平，是协作的保险丝'}
          </div>
          {/* 保险丝图形：端子—细丝—端子（过载即断的隐喻） */}
          <svg width={700} height={60} style={{marginTop: 18}}>
            <rect x={20} y={18} width={60} height={24} rx={5} fill="none" stroke={theme.mech} strokeWidth={4} />
            <line x1={80} y1={30} x2={330} y2={30} stroke={theme.mech} strokeWidth={4} />
            <path d="M330 30 L355 14 L380 44 L405 12 L430 40 L455 22 L470 30" fill="none" stroke={theme.mech} strokeWidth={4} />
            <line x1={470} y1={30} x2={620} y2={30} stroke={theme.mech} strokeWidth={4} />
            <rect x={620} y={18} width={60} height={24} rx={5} fill="none" stroke={theme.mech} strokeWidth={4} />
          </svg>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const P2Mail: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p2-01', 'p2-05');
  const bB = w('p2-06', 'p2-11');
  const bC = w('p2-12', 'p2-14');
  const bD = w('p2-15', 'p2-17');
  const bE = w('p2-18', 'p2-24');
  const rel = (b: {from: number}, id: string) => at(id) - b.from;
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 临时工与队友">
        <TempVsTeammate fadeAt={rel(bA, 'p2-04')} seatAt={rel(bA, 'p2-03')} />
      </Sequence>
      <Sequence {...bB} name="2-B 信箱行">
        <MailboxRow sendAt={rel(bB, 'p2-06')} readAt={rel(bB, 'p2-07')} />
      </Sequence>
      <Sequence {...bC} name="2-C 十五种消息类型">
        <FifteenTypes wallAt={6} shrinkAt={rel(bC, 'p2-14')} />
      </Sequence>
      <Sequence {...bD} name="2-D 权限冒泡">
        <BubbleUp riseAt={rel(bD, 'p2-19')} nodAt={rel(bD, 'p2-19') + 30} downAt={rel(bD, 'p2-19') + 44} />
      </Sequence>
      <Sequence {...bE} name="2-E 不许孵队友">
        <NoSubteams
          barAt={rel(bE, 'p2-21')}
          chaosAt={rel(bE, 'p2-22')}
          bannerAt={rel(bE, 'p2-24')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
