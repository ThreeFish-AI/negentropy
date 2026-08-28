/** P3 怎么谈判：握手（分镜 3-A…3-D）
 *  HandshakeRail 母题：请求卡带编号出发停「等回话」；状态表 pending 亮起；
 *  同号应答对号合拢锁扣「咔」；错类型回执被弹开。计划审批同轨反向 + 门闸。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, NamePlate, Panel, SceneHeader, SceneTag, phase, useRingDot} from '../components/motifs';

/** 握手轨：横向轨道 + 请求卡 / 应答卡对开。双方端点 + 中央「等回话」位。 */
const HandshakeRail: React.FC<{
  /** 请求侧（左）标签，如 '领队' / '阿珍' */
  leftName: string;
  leftTone?: 'core' | 'peer';
  /** 回复侧（右）标签 */
  rightName: string;
  rightTone?: 'core' | 'peer';
  /** 请求卡滑出进度 0..1（到中央等回话位） */
  reqGo: number;
  /** 状态表 pending 行是否点亮 */
  pendingOn: boolean;
  /** 应答卡归来进度 0..1（从右到中央） */
  ackGo: number;
  /** 同号合拢锁扣「咔」的完成度 */
  lockT: number;
  /** 编号铭牌（双方一致才合拢） */
  reqId: string;
  /** 请求类型文案（如 '关机请求' / '计划审批'） */
  reqKind: string;
  ackKind?: string;
  /** 错类型回执弹开：0..1 弹开进度（deny）；与 ackGo 互斥使用 */
  bounceT?: number;
  wrongKind?: string;
}> = ({
  leftName,
  leftTone = 'core',
  rightName,
  rightTone = 'peer',
  reqGo,
  pendingOn,
  ackGo,
  lockT,
  reqId,
  reqKind,
  ackKind,
  bounceT = 0,
  wrongKind,
}) => {
  const lc = leftTone === 'peer' ? theme.peer : theme.core;
  const rc = rightTone === 'peer' ? theme.peer : theme.core;
  // 轨道几何（px 居中：组件本身 1460 宽，容器负责居中）
  const W = 1460;
  const RAIL_Y = 250;
  const LEFT_X = 130;
  const RIGHT_X = W - 130;
  const MID_X = W / 2;
  const reqX = LEFT_X + (MID_X - 96 - LEFT_X) * reqGo;
  const ackX = RIGHT_X - (RIGHT_X - MID_X) * ackGo;
  // 锁扣「咔」：合拢瞬间的一次性冲击闪光
  const clack = lockT > 0.9 && lockT < 1 ? 1 - Math.abs(lockT - 0.95) / 0.05 : 0;
  return (
    <div style={{position: 'relative', width: W, height: 560}}>
      {/* 双方端点：名字铭牌 + 小环标记 */}
      <div style={{position: 'absolute', left: LEFT_X - 90, top: RAIL_Y - 96, textAlign: 'center'}}>
        <LoopRing size={120} draw={1} dotProgress={useRingDot(2.5)} tone={leftTone} showLabels={false} />
        <div style={{marginTop: 4}}>
          <NamePlate name={leftName} tone={leftTone} />
        </div>
      </div>
      <div style={{position: 'absolute', left: RIGHT_X - 90, top: RAIL_Y - 96, textAlign: 'center'}}>
        <LoopRing size={120} draw={1} dotProgress={useRingDot(2.5)} tone={rightTone} showLabels={false} />
        <div style={{marginTop: 4}}>
          <NamePlate name={rightName} tone={rightTone} />
        </div>
      </div>
      {/* 轨道主线 + 中央「等回话」站台 */}
      <svg width={W} height={560} style={{position: 'absolute', left: 0, top: 0}}>
        <line x1={LEFT_X} y1={RAIL_Y} x2={RIGHT_X} y2={RAIL_Y} stroke={theme.panelBorder} strokeWidth={5} />
        {/* 等回话站台 */}
        <rect
          x={MID_X - 104}
          y={RAIL_Y - 44}
          width={208}
          height={88}
          rx={12}
          fill={`${theme.mech}12`}
          stroke={theme.mech}
          strokeWidth={2.5}
          strokeDasharray="8 7"
          opacity={reqGo > 0.9 ? 1 : 0.35}
        />
        <text
          x={MID_X}
          y={RAIL_Y + 76}
          textAnchor="middle"
          fontFamily={theme.sans}
          fontSize={21}
          fill={theme.mech}
          opacity={reqGo > 0.9 ? 1 : 0.4}
        >
          {'等回话'}
        </text>
        {/* 锁扣：合拢后中央的锁形扣（「咔」） */}
        {lockT > 0 ? (
          <g>
            <path
              d={`M${MID_X - 26} ${RAIL_Y - 12} V${RAIL_Y - 26} A26 26 0 0 1 ${MID_X + 26} ${RAIL_Y - 26} V${RAIL_Y - 12}`}
              fill="none"
              stroke={theme.mech}
              strokeWidth={8}
              strokeLinecap="round"
              transform={`translate(0 ${(1 - lockT) * 40}) scale(${1})`}
              opacity={lockT}
            />
            <rect
              x={MID_X - 34}
              y={RAIL_Y - 14}
              width={68}
              height={44}
              rx={8}
              fill={theme.mechDeep}
              stroke={theme.mech}
              strokeWidth={5}
              transform={`translate(0 ${(1 - lockT) * 40})`}
              opacity={lockT}
            />
            {clack > 0 ? (
              <>
                {[0, 1].map((k) => (
                  <circle
                    key={k}
                    cx={MID_X}
                    cy={RAIL_Y + 8}
                    r={30 + clack * (70 + k * 36)}
                    fill="none"
                    stroke={theme.mech}
                    strokeWidth={4 - k * 1.5}
                    opacity={(1 - clack) * (1 - k * 0.4)}
                  />
                ))}
                <text
                  x={MID_X}
                  y={RAIL_Y + 128}
                  textAnchor="middle"
                  fontFamily={theme.serif}
                  fontSize={30}
                  fontWeight={700}
                  fill={theme.mech}
                  opacity={clack}
                >
                  {'咔'}
                </text>
              </>
            ) : null}
          </g>
        ) : null}
      </svg>
      {/* 请求卡：从左滑出，停在等回话位 */}
      <div
        style={{
          position: 'absolute',
          left: reqX - 96,
          top: RAIL_Y - 58,
          opacity: reqGo > 0 ? 1 : 0,
          zIndex: 2,
        }}
      >
        <Panel accent={lc} style={{width: 192, padding: '8px 12px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: lc}}>{reqId}</div>
          <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.text, marginTop: 2}}>{reqKind}</div>
        </Panel>
      </div>
      {/* 同号应答卡：从右归来合拢（已合拢的常态——错类型卡是另一次尝试，不顶掉它） */}
      <div
        style={{
          position: 'absolute',
          left: ackX - 96,
          top: RAIL_Y - 22,
          opacity: ackGo > 0 && bounceT <= 0 ? 1 : bounceT > 0 ? 1 : 0,
          zIndex: 2,
        }}
      >
        <Panel accent={rc} style={{width: 192, padding: '8px 12px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: rc}}>{reqId}</div>
          <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.text, marginTop: 2}}>
            {ackKind ?? '同意'}
          </div>
        </Panel>
      </div>
      {/* 错类型回执：撞上合拢位后被弹开（deny，从中央弹回右侧） */}
      {bounceT > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: MID_X - 96 + bounceT * 240,
            top: RAIL_Y - 118 - bounceT * 40,
            zIndex: 3,
            transform: `rotate(${bounceT * 18}deg)`,
          }}
        >
          <Panel accent={theme.deny} style={{width: 192, padding: '8px 12px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.deny}}>{reqId}</div>
            <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.deny, marginTop: 2}}>
              {wrongKind ?? '错类型'}
            </div>
          </Panel>
        </div>
      ) : null}
      {/* 状态表：pending → approved/rejected（右下） */}
      <div style={{position: 'absolute', left: W / 2 - 260, top: 388}}>
        <Panel style={{width: 520, padding: '12px 18px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'状态表'}</div>
          {[
            {id: reqId, st: pendingOn ? 'pending' : '—', on: pendingOn, done: lockT > 0.9},
          ].map((r) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                gap: 20,
                alignItems: 'center',
                height: 44,
                fontFamily: theme.mono,
                fontSize: 20,
                background: r.done ? theme.mechDeep : r.on ? `${theme.mech}1a` : 'transparent',
                boxShadow: r.on && !r.done ? `inset 0 0 0 2px ${theme.mech}` : 'none',
                borderRadius: 7,
                paddingLeft: 8,
                marginTop: 6,
              }}
            >
              <span style={{color: theme.dim, width: 90}}>{r.id}</span>
              <span style={{color: r.done ? theme.mech : r.on ? theme.mech : theme.panelBorder}}>
                {r.done ? 'approved' : r.st}
              </span>
            </div>
          ))}
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: RAIL_Y + 200, textAlign: 'center'}}>
        <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, opacity: pendingOn ? 1 : 0.4}}>
          {'同一个编号 · 隔着信箱与轮次，编号就是暗号'}
        </span>
      </div>
    </div>
  );
};

/** 3-A 杀线程之祸（裂口文件闪烁）→ 握手四步走位 */
const KillVsHandshake: React.FC<{crackAt: number; stepsAt: number}> = ({crackAt, stepsAt}) => {
  const frame = useCurrentFrame();
  const crack = frame >= crackAt;
  const steps = frame >= stepsAt;
  // 裂口闪烁
  const flicker = crack && !steps ? 0.4 + 0.6 * Math.abs(Math.sin(frame / 4)) : crack ? 0.5 : 0;
  // 四步走位：请求卡出发 → 队友收拾（文件补全）→ 回执 → 退出
  const stepLabels = ['发关机请求', '收干净手头', '回一张同意', '自行退出'];
  const cur = steps ? Math.min(3, Math.floor((frame - stepsAt) / 18)) : -1;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Team Protocols" tagline="Handshake, Not Kill" accent={theme.mech} />
      {!steps ? (
        <div style={{display: 'flex', alignItems: 'center', gap: 110}}>
          {/* 掐线程的手：从上方掐住虚线线程 */}
          <div style={{position: 'relative', width: 420, height: 480}}>
            <svg width={420} height={480}>
              {/* 线程：一条垂线，被掐断处打 deny 裂口 */}
              <line x1={210} y1={40} x2={210} y2={430} stroke={theme.dim} strokeWidth={8} strokeDasharray="16 10" />
              {crack ? (
                <>
                  <line x1={210} y1={40} x2={210} y2={196} stroke={theme.dim} strokeWidth={8} strokeDasharray="16 10" />
                  <line x1={210} y1={244} x2={210} y2={430} stroke={theme.dim} strokeWidth={8} strokeDasharray="16 10" />
                  {/* 裂口锯齿 */}
                  <path
                    d="M196 196 L224 210 L196 226 L224 244"
                    fill="none"
                    stroke={theme.deny}
                    strokeWidth={7}
                    strokeLinecap="round"
                    opacity={flicker}
                  />
                </>
              ) : null}
              {/* 掐的手：从上方压下的剪影 */}
              <path
                d={`M150 0 L150 ${crack ? 130 : 60} L182 ${crack ? 176 : 92} L238 ${crack ? 176 : 92} L270 ${crack ? 130 : 60} L270 0 Z`}
                fill={theme.dim}
                opacity={0.75}
              />
            </svg>
            <div style={{position: 'absolute', left: 0, right: 0, bottom: -10, textAlign: 'center'}}>
              <span style={{fontFamily: theme.sans, fontSize: 24, color: crack ? theme.deny : theme.dim}}>
                {crack ? '直接掐线程' : '线程跑着'}
              </span>
            </div>
          </div>
          {/* 写一半的文件：断在半空（裂口） */}
          <div style={{position: 'relative'}}>
            <Panel accent={crack ? theme.deny : theme.panelBorder} style={{width: 460, padding: '16px 22px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'config.py'}</div>
              {['AUTH_TTL = 900', 'REFRESH_WINDOW = 120', 'TOKEN_ISSUER = "v2"…'].map((ln, i) => (
                <div
                  key={ln}
                  style={{
                    fontFamily: theme.mono,
                    fontSize: 21,
                    color: i === 2 ? (crack ? theme.deny : theme.dim) : theme.text,
                    marginTop: 8,
                    opacity: i === 2 && crack ? 0.55 + 0.45 * flicker : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ln}
                  {i === 2 && crack ? (
                    <span style={{color: theme.deny, marginLeft: 8}}>{'▌断在这里'}</span>
                  ) : null}
                </div>
              ))}
            </Panel>
            {crack ? (
              <div
                style={{
                  marginTop: 16,
                  fontFamily: theme.sans,
                  fontSize: 24,
                  color: theme.deny,
                  textAlign: 'center',
                  opacity: 0.9,
                }}
              >
                {'半拉子文件 · 说不清算谁的'}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        /* 四步走位：横向步进 */
        <div style={{display: 'flex', gap: 34, alignItems: 'center'}}>
          {stepLabels.map((s, i) => {
            const on = i <= cur;
            const e = spring({frame: frame - stepsAt - i * 18, fps: 30, config: {damping: 200}});
            return (
              <React.Fragment key={s}>
                <div style={{width: 230, opacity: e, transform: `translateY(${(1 - e) * 20}px)`}}>
                  <Panel
                    accent={on ? theme.mech : theme.panelBorder}
                    style={{padding: '16px 18px', background: on ? theme.mechDeep : theme.panel}}
                  >
                    <div style={{fontFamily: theme.mono, fontSize: 19, color: on ? theme.mech : theme.dim}}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div
                      style={{
                        fontFamily: theme.sans,
                        fontSize: 26,
                        fontWeight: 600,
                        color: theme.text,
                        marginTop: 6,
                      }}
                    >
                      {s}
                    </div>
                  </Panel>
                </div>
                {i < 3 ? (
                  <svg width={54} height={20}>
                    <line
                      x1={0}
                      y1={10}
                      x2={38}
                      y2={10}
                      stroke={i < cur ? theme.mech : theme.panelBorder}
                      strokeWidth={4}
                      strokeLinecap="round"
                    />
                    <path
                      d="M38 10 L48 4 L48 16 Z"
                      fill={i < cur ? theme.mech : theme.panelBorder}
                    />
                  </svg>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      )}
      {!steps ? (
        <Footnote delay={crackAt}>{'告别也要握手——先收干净，再退出'}</Footnote>
      ) : (
        <Footnote delay={stepsAt}>{'领队发请求 → 队友收尾 → 回「同意」 → 退出'}</Footnote>
      )}
    </AbsoluteFill>
  );
};

/** 3-B ★握手轨全流程：请求 req_0042 滑出停等回话 → pending 亮 → 同号应答合拢咔 → 错类型弹开 */
const RailFull: React.FC<{reqAt: number; pendAt: number; ackAt: number; lockAt: number; wrongAt: number}> = ({
  reqAt,
  pendAt,
  ackAt,
  lockAt,
  wrongAt,
}) => {
  const frame = useCurrentFrame();
  const reqGo = interpolate(frame - reqAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pendingOn = frame >= pendAt;
  const ackGo = interpolate(frame - ackAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lockT = phase(frame, lockAt, 14);
  // 错类型回执：滑近 → 撞上合拢位被弹开（deny）。同号应答在此前已完成合拢。
  const wrongNear = interpolate(frame - wrongAt, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wrongBounce =
    frame >= wrongAt + 14
      ? interpolate(frame - wrongAt - 14, [0, 12], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0;
  const bounceT = wrongNear >= 1 ? wrongBounce : 0;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <HandshakeRail
        leftName="领队"
        rightName="阿强"
        reqGo={reqGo}
        pendingOn={pendingOn}
        ackGo={frame >= wrongAt ? 1 : ackGo}
        lockT={lockT}
        reqId="req_0042"
        reqKind="关机请求"
        ackKind="同意"
        bounceT={bounceT}
        wrongKind="计划的回执"
      />
      {/* 类型校验注记：三重对号 */}
      <div
        style={{
          position: 'absolute',
          bottom: 206,
          display: 'flex',
          gap: 22,
          opacity: phase(frame, pendAt + 10, 12),
        }}
      >
        {['编号对得上', '类型对得上', '这事还没办过'].map((s, i) => (
          <span
            key={s}
            style={{
              fontFamily: theme.sans,
              fontSize: 23,
              padding: '6px 16px',
              borderRadius: 999,
              border: `2px solid ${i === 1 && bounceT > 0.3 ? theme.deny : theme.mech}`,
              color: i === 1 && bounceT > 0.3 ? theme.deny : theme.mech,
              opacity: phase(frame, pendAt + 10 + i * 4, 10),
            }}
          >
            {s}
          </span>
        ))}
      </div>
      {bounceT > 0.5 ? (
        <Footnote delay={wrongAt + 16}>{'类型错一个字，直接弹开'}</Footnote>
      ) : (
        <Footnote delay={reqAt + 4}>{'request_id 贯穿全链：pending → approved'}</Footnote>
      )}
    </AbsoluteFill>
  );
};

/** 3-C 计划审批同轨反向：阿珍交计划等批；批了才动手门闸 */
const PlanApproval: React.FC<{planAt: number; backAt: number; gateAt: number}> = ({
  planAt,
  backAt,
  gateAt,
}) => {
  const frame = useCurrentFrame();
  const reqGo = interpolate(frame - planAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ackGo = interpolate(frame - backAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lockT = phase(frame, backAt + 22, 14);
  // 门闸：批文没到不开；批了才开（闸门升起）
  const gateOpen = phase(frame, gateAt, 16);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <HandshakeRail
        leftName="阿珍"
        leftTone="peer"
        rightName="领队"
        rightTone="core"
        reqGo={reqGo}
        pendingOn={reqGo > 0.9}
        ackGo={ackGo}
        lockT={lockT}
        reqId="req_0057"
        reqKind="计划等批"
        ackKind="批文 req_0057"
      />
      {/* 批了才动手：门闸（下方） */}
      <div
        style={{
          position: 'absolute',
          bottom: 196,
          display: 'flex',
          alignItems: 'center',
          gap: 30,
        }}
      >
        <svg width={220} height={130}>
          {/* 工具出口的门闸：闸板从落下到升起 */}
          <rect x={20} y={26} width={180} height={78} rx={10} fill="none" stroke={theme.panelBorder} strokeWidth={4} />
          <text
            x={110}
            y={72}
            textAnchor="middle"
            fontFamily={theme.sans}
            fontSize={21}
            fill={theme.dim}
          >
            {'工具出口'}
          </text>
          <rect
            x={26}
            y={30 + gateOpen * 62}
            width={168}
            height={70 - gateOpen * 62}
            rx={6}
            fill={gateOpen > 0.5 ? 'transparent' : `${theme.deny}2e`}
            stroke={gateOpen > 0.5 ? 'transparent' : theme.deny}
            strokeWidth={4}
          />
          <line
            x1={110}
            y1={104}
            x2={110}
            y2={104 - gateOpen * 66}
            stroke={theme.mech}
            strokeWidth={5}
            strokeLinecap="round"
          />
          <circle cx={110} cy={36} r={6} fill={theme.mech} opacity={gateOpen} />
        </svg>
        <div style={{width: 560}}>
          <div style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: gateOpen > 0.5 ? theme.mech : theme.text}}>
            {'批了才动手'}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 8}}>
            {gateOpen > 0.5 ? '批文到了，闸门开' : '高风险的活，等批文中'}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 3-D 【三】三向关机：请求 → 同意/拒绝（可附理由） → 系统广播 + 收拾；诚实角标 */
const ThreeWay: React.FC<{askAt: number; replyAt: number; castAt: number; settleAt: number}> = ({
  askAt,
  replyAt,
  castAt,
  settleAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 三向消息流：三枚消息卡先后横穿
  const msgs = [
    {t: '请求', from: '领队', at: askAt, c: theme.core},
    {t: '同意（拒绝可附理由）', from: '阿强', at: replyAt, c: theme.peer},
    {t: '系统广播：已离场', from: '系统', at: castAt, c: theme.mech},
  ];
  // 收拾：窗格收起、名册划名
  const settle = phase(frame, settleAt, 20);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1500, height: 700}}>
        {/* 领队与队友 */}
        <div style={{position: 'absolute', left: 90, top: 60, textAlign: 'center'}}>
          <LoopRing size={200} draw={1} dotProgress={useRingDot(2.5)} />
          <div style={{marginTop: 6}}>
            <NamePlate name="领队" tone="core" />
          </div>
        </div>
        <div style={{position: 'absolute', left: 1210, top: 60, textAlign: 'center', opacity: 1 - settle * 0.75}}>
          <LoopRing size={200} draw={1} dotProgress={useRingDot(2.5)} tone="peer" showLabels={false} />
          <div style={{marginTop: 6}}>
            <NamePlate name="阿强" />
          </div>
        </div>
        {/* 三向消息卡：依次沿中线飞行并停驻 */}
        {msgs.map((m, i) => {
          const t = interpolate(frame - m.at, [0, 24], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          if (t <= 0) return null;
          const y = 190 + i * 96;
          const stopX = i === 0 ? 1180 : i === 1 ? 320 : 750;
          const fromX = i % 2 === 0 ? 320 : 1180;
          const x = fromX + (stopX - fromX) * t;
          const e = spring({frame: frame - m.at, fps, config: {damping: 200}});
          return (
            <div
              key={m.t}
              style={{
                position: 'absolute',
                left: x - 170,
                top: y,
                width: 340,
                opacity: e,
              }}
            >
              <Panel accent={m.c} style={{padding: '10px 16px'}}>
                <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
                  <span style={{fontFamily: theme.mono, fontSize: 17, color: m.c}}>{m.from}</span>
                  <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>{m.t}</span>
                </div>
              </Panel>
            </div>
          );
        })}
        {/* 收拾：窗格收起 + 任务名册划名 */}
        <div style={{position: 'absolute', left: 470, top: 470, display: 'flex', gap: 40}}>
          {/* 窗格收起：分屏窗格一块块淡出 */}
          <Panel style={{width: 300, padding: '12px 16px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'分屏窗格'}</div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10}}>
              {['终端', '终端', '阿强', '空'].map((c, i) => (
                <div
                  key={i}
                  style={{
                    height: 44,
                    borderRadius: 6,
                    border: `2px solid ${i === 2 ? theme.peer : theme.panelBorder}`,
                    color: i === 2 ? theme.peer : theme.dim,
                    fontFamily: theme.mono,
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: i === 2 ? 1 - settle : 1,
                  }}
                >
                  {i === 2 ? '阿强' : c}
                </div>
              ))}
            </div>
          </Panel>
          {/* 任务名册：划名（T-02 划掉，归属解除） */}
          <Panel style={{width: 320, padding: '12px 16px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'任务名册'}</div>
            {[
              {id: 'T-02', s: '接口', owner: '阿强'},
              {id: 'T-03', s: '文档', owner: '—'},
            ].map((r) => (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  fontFamily: theme.mono,
                  fontSize: 19,
                  marginTop: 10,
                  color: r.owner === '阿强' ? (settle > 0.5 ? theme.dim : theme.peer) : theme.dim,
                }}
              >
                <span style={{width: 50}}>{r.id}</span>
                <span style={{width: 60}}>{r.s}</span>
                <span style={{textDecoration: r.owner === '阿强' && settle > 0.5 ? 'line-through' : 'none'}}>
                  {r.owner === '阿强' ? '阿强' : '待领'}
                </span>
              </div>
            ))}
          </Panel>
        </div>
        {settle > 0.8 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 12,
              textAlign: 'center',
              fontFamily: theme.serif,
              fontSize: 34,
              fontWeight: 700,
              color: theme.text,
              opacity: phase(frame, settleAt + 16, 12),
            }}
          >
            {'协议没有玄机：一张状态表、一个编号、几条对得上号的规矩'}
          </div>
        ) : null}
      </div>
      <Footnote delay={castAt}>
        {'三向关机 · 拒绝可附理由——第三方的源码分析；教学版未做执行门控（诚实标注）'}
      </Footnote>
    </AbsoluteFill>
  );
};

export const P3Handshake: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p3-01', 'p3-05');
  const bB = w('p3-06', 'p3-09');
  const bC = w('p3-10', 'p3-11');
  const bD = w('p3-12', 'p3-16');
  const rel = (b: {from: number}, id: string) => at(id) - b.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P3" title="怎么谈判：握手" meta="request_id · 3-way shutdown" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="3-A 杀线程之祸与四步">
        <KillVsHandshake crackAt={rel(bA, 'p3-03')} stepsAt={rel(bA, 'p3-05')} />
      </Sequence>
      <Sequence {...bB} name="3-B 握手轨与三重对号">
        <RailFull
          reqAt={rel(bB, 'p3-06')}
          pendAt={rel(bB, 'p3-07')}
          ackAt={rel(bB, 'p3-07') + 30}
          lockAt={rel(bB, 'p3-08')}
          wrongAt={rel(bB, 'p3-09')}
        />
      </Sequence>
      <Sequence {...bC} name="3-C 计划审批同轨">
        <PlanApproval
          planAt={rel(bC, 'p3-10')}
          backAt={rel(bC, 'p3-11')}
          gateAt={rel(bC, 'p3-11') + 30}
        />
      </Sequence>
      <Sequence {...bD} name="3-D 三向关机">
        <ThreeWay
          askAt={rel(bD, 'p3-13')}
          replyAt={rel(bD, 'p3-13') + 26}
          castAt={rel(bD, 'p3-14')}
          settleAt={rel(bD, 'p3-14') + 26}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
