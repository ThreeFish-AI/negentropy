/** P4 清单与两条保险（p4-01..p4-08b，4 镜）——分镜 4-A / 4-B / 4-C / 4-D。
 *
 *  叙事链：拉远全景重锚（自 P3 峰值降压）——事件清单增长条横贯：左端「4」
 *  骨架段（挂点紫恒亮、四事件名微缩可辨 = 1-A 注册表成年态同形——注册表装置
 *  以挂点紫签名在增长条骨架段中回归）、中段「27」（计数 4→27 动态增长、归属
 *  徽标同步钉上）、右端虚线外延段（渐隐增长沿——趋势化不落具体值；日期角标
 *  钉上外延段）、环体缩悬深处 →「十四栏的表」结果对象卡（回调蓝）自增长条
 *  上方展开、14 栏网格微缩、「阻塞错误」栏高亮、「注入对话」错误消息条流入
 *  消息流示意、「自己纠错」模型侧节点自纠小箭头一拍（一例带过、其余栏压暗）
 *  → 4-B 不变式表决（承 ep3 3-B 同构签名）：「钩子说放行」签（回调蓝）居中
 *  递票被顶部「设置：拒绝 / 询问」双签位弹回（允许票被拒的具象）、「各方
 *  点头」点头签齐亮、「一方摇头」摇头签落下点头全灭、计票器虚影一闪即划
 *  （无计票语义——承 ep3 划除退役判例）、「一票否决」摇头签定格放大（官方
 *  原文进角标） → 4-C 防转圈标志动画：小循环图（注入→重入→再触发三节点）、
 *  「报阻塞错误」阻塞错误条（回调蓝）注入对话、「带着标志重入」标志位翻转
 *  「亮」态、循环带标志再入、「看见标志就不再触发」下一轮越过触发位（虚线
 *  越过、非删除节点）、「无限循环」自旋警告图标被一道红杠掐停（重音镜） →
 *  4-D 保险合亮定格：两枚保险徽记（不变式 / 防转圈——挂点紫）自两侧合拢至
 *  中位同亮、背景增长条与表决/标志装置退为暗层、问号淡入悬顶打光定格（钩向
 *  P5 收束金句、回扣 p2-09「值多少钱」；半拍收暗）。
 *
 *  空间契约：幕间转场（3-C→4-A）语义断裂走 SceneFade + 拉远重锚；增长条三段
 *  次序 4→27→外延、骨架段与 1-A 注册表同形（成年态非新建视觉）；外延段不落
 *  「33」等具体值；14 栏只亮一例；点头/摇头签与 ep3 同构（跨集签名）；摇头
 *  压制方向 = 拒绝 > 允许（X-001：重者在下压）；点头签在摇头落后不复亮；标志
 *  位仅两态（空/亮）、跳过 = 越过触发节点非删除；双徽记等大对称、问号为唯一
 *  新增元素、徽记不显第三枚。
 *
 *  红线落实：词落位 = 句首 + 句长比例；useCount 钳制（4→27 计数永不过冲）；
 *  日期角标不抢焦；y≥56 / bottom≥168。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {FlagBadge, GrowthBar, InsuranceBadge, LoopRing, Panel, SceneTag, VoteBoard, useRingDot} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useImpulse, useProgress, useSpring} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const Foot4: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 168,
      textAlign: 'center',
      fontFamily: theme.mono,
      fontSize: 20,
      color: theme.dim,
      opacity: 0.85,
    }}
  >
    {children}
  </div>
);

// ── 4-A 拉远全景：清单增长条 + 十四栏一例 ───────────────────────────────

const ShotA: React.FC<{atGrow: number; atExt: number; atSeg: number; atCard: number; atInject: number; atFix: number}> = ({
  atGrow,
  atExt,
  atSeg,
  atCard,
  atInject,
  atFix,
}) => {
  // 增长条：4 段起长、「二十七个」27 段亮出（计数 4→27 永不过冲；归属徽标同步钉上）
  const grow = useProgress(atGrow, DUR.f6, 'linear');
  const badgeLit = useProgress(atGrow + DUR.f5, DUR.f4);
  const ringDot = useRingDot(4);
  // 「三十多个」虚线外延段（趋势化——不落具体值）；「骨架还是那四个」恒亮加重一拍
  const extLit = useProgress(atExt, DUR.f4);
  const segPulse = useImpulse({at: atSeg, dur: DUR.f5, peak: 1});
  const dateLit = useProgress(atExt + DUR.f4, DUR.f4);
  // 「十四栏的表」结果对象卡展开（回调蓝）；阻塞错误栏高亮、其余压暗
  const cardIn = useEnter('pop', {at: atCard, dur: DUR.f5, springPreset: 'settle'});
  const COLS = ['输入', '续跑', '阻塞错误', '改写', '裁决', '原因', '系统', '退出码', '超时', '事件', '进度', '标签', '补充', '时间'] as const;
  const hotCol = 2;
  // 「注入对话」错误消息条流入消息流示意；「自己纠错」模型侧自纠小箭头一拍
  const inject = useProgress(atInject, DUR.f5, 'decelerate');
  const fix = useProgress(atFix, DUR.f3);
  const fixArrow = useImpulse({at: atFix, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      <SceneTag chapter="Production" tagline="生产版 · 清单与保险" accent={theme.mech} />
      {/* 增长条（骨架 4 段恒亮〔加重一拍〕→ 27 段 → 外延；徽标/日期钉在读数条） */}
      <div style={{position: 'absolute', left: 180, top: 560}}>
        <GrowthBar
          x={0}
          y={0}
          w={1560}
          segLit={0.7 + 0.3 * segPulse}
          grow={grow}
          extLit={extLit}
          badgeLit={badgeLit}
          dateLit={dateLit}
        />
      </div>
      {/* 环体缩悬深处（M-001 同形暗置——深处一档） */}
      <div style={{position: 'absolute', left: 210, top: 770, opacity: 0.42}}>
        <LoopRing size={130} nodes={[]} showExit={false} dotProgress={ringDot} dimNodes />
      </div>
      {/* 结果对象卡（HookResult——回调蓝；14 栏网格微缩、「阻塞错误」栏高亮） */}
      <div style={{...cardIn, position: 'absolute', left: 380, top: 220}}>
        <Panel accent={theme.hook} style={{width: 1010, padding: '14px 18px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 10}}>
            <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.hook}}>{'HookResult'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>{'十四栏 · 生产版结果对象'}</span>
          </div>
          <div style={{display: 'flex', gap: 6}}>
            {COLS.map((c, i) => {
              const hot = i === hotCol;
              return (
                <div
                  key={c}
                  style={{
                    width: hot ? 108 : 58,
                    height: 118,
                    boxSizing: 'border-box',
                    borderRadius: 7,
                    border: `2.5px solid ${hot ? theme.hook : theme.panelBorder}`,
                    background: hot ? withAlpha(theme.hook, 0.16) : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    opacity: hot ? 1 : 0.32,
                    boxShadow: hot ? `0 0 18px ${withAlpha(theme.hook, 0.55)}` : 'none',
                  }}
                >
                  <span style={{fontFamily: theme.sans, fontSize: hot ? 19 : 14, fontWeight: hot ? 700 : 400, color: hot ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>
                    {c}
                  </span>
                  {hot ? <span style={{fontFamily: theme.mono, fontSize: 11, color: theme.hook}}>{'blocking'}</span> : null}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
      {/* 消息流示意（错误消息条流入——回调蓝） */}
      <div style={{position: 'absolute', left: 1450, top: 300}}>
        <div style={{width: 190, height: 46, borderRadius: 8, border: `2px solid ${theme.panelBorder}`, background: theme.panel, display: 'flex', alignItems: 'center', padding: '0 12px'}}>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'messages'}</span>
        </div>
        <div
          style={{
            width: 220,
            height: 56,
            marginTop: 18,
            borderRadius: 9,
            border: `2.5px solid ${theme.hook}`,
            background: withAlpha(theme.hook, 0.15),
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 14px',
            opacity: inject,
            transform: `translateY(${(1 - inject) * -20}px)`,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.hook}}>{'error'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 16, color: theme.text, whiteSpace: 'nowrap'}}>{'阻塞错误条'}</span>
        </div>
      </div>
      {/* 模型侧节点（收到错误条后自纠小箭头一拍——一例带过） */}
      <div style={{position: 'absolute', left: 1520, top: 480, opacity: clamp01(fix) > 0 || fixArrow > 0.01 ? 1 : 0.55}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <svg width={54} height={46} viewBox="-27 -23 54 46" style={{overflow: 'visible'}}>
            <g stroke={fix > 0.5 ? theme.text : theme.dim} strokeWidth={3} fill="none" strokeLinecap="round">
              <path d="M-17 5 Q-22 -3 -14 -9 Q-13 -16 -4 -17 Q4 -18 8 -12 Q18 -10 18 -3 Q18 4 11 8 Q-3 13 -17 5 Z" />
              <path d="M0 -17 Q-2 -7 0 8" />
            </g>
          </svg>
          <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'模型侧'}</span>
        </div>
        {/* 自纠小箭头（回环一拍——收到错误、绕一圈重试） */}
        {fixArrow > 0.01 ? (
          <svg width={120} height={70} style={{position: 'absolute', left: 60, top: -34, overflow: 'visible'}}>
            <path
              d="M 8 52 Q 40 6, 96 22"
              fill="none"
              stroke={theme.hook}
              strokeWidth={4}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - clamp01(fix)}
              opacity={0.4 + 0.6 * fixArrow}
            />
            {fix > 0.9 ? <path d="M 90 8 L 104 24 L 84 28 Z" fill={theme.hook} /> : null}
          </svg>
        ) : null}
      </div>
      <Foot4>{'hook events 4 → 27 → … · HookResult 14 栏'}</Foot4>
    </AbsoluteFill>
  );
};

// ── 4-B 不变式表决（承 ep3 3-B 同构签名） ───────────────────────────────

const ShotB: React.FC<{atLit: number; atTicket: number; atBounce: number; atNods: number; atPress: number; atGhost: number; atRetire: number; atZoom: number}> = ({
  atLit,
  atTicket,
  atBounce,
  atNods,
  atPress,
  atGhost,
  atRetire,
  atZoom,
}) => {
  const frame = useCurrentFrame();
  const lit = useProgress(atLit, DUR.f4);
  // 递票（「钩子说放行」→ 设置双签位）→「压不过」被弹回（允许票被拒的具象）
  const ticket = useProgress(atTicket, DUR.f4, 'decelerate');
  const bounce = useSpring('settleSoft', {at: atBounce, dur: DUR.f5});
  const bounceFlash = useImpulse({at: atBounce, dur: DUR.f5, peak: 1});
  // 「各方点头」齐亮 →「一方摇头」摇头沉压、点头全灭（点头不复亮）
  const nods = [0, 1, 2, 3, 4].map(() => clamp01(progress(frame, atNods, DUR.f4)));
  const press = useProgress(atPress, DUR.f4, 'accelerate');
  const kill = clamp01(progress(frame, atPress + DUR.f3, DUR.f3));
  // 计票器虚影一闪即划（无计票语义）→「一票否决」摇头签定格放大
  const ghost = useImpulse({at: atGhost, dur: DUR.f5, peak: 1});
  const retire = useProgress(atGhost + DUR.f4, DUR.f3);
  const headZoom = useProgress(atZoom, DUR.f4, 'decelerate');
  const zoomPulse = useImpulse({at: atZoom + DUR.f4, dur: DUR.f6, peak: 1});
  return (
    <AbsoluteFill>
      <SceneTag chapter="Safeguard 1" tagline="不变式 · 一票否决" accent={theme.danger} />
      <VoteBoard
        x={510}
        y={220}
        lit={lit}
        ticket={ticket}
        bounce={clamp01(bounce)}
        nods={nods}
        press={press}
        kill={kill}
        counterGhost={ghost}
        counterRetire={retire}
        headZoom={headZoom}
      />
      {/* 弹回冲击（允许票被拒的一拍） */}
      {bounceFlash > 0.01 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          <circle cx={660} cy={330} r={26 + 60 * bounceFlash} fill="none" stroke={theme.danger} strokeWidth={4} opacity={bounceFlash * 0.8} />
        </svg>
      ) : null}
      {/* 「一票否决」定格注记（官方原文在底部角标——不进卡面） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 850,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          fontWeight: 700,
          color: theme.danger,
          opacity: clamp01(headZoom) * (0.85 + 0.15 * zoomPulse),
        }}
      >
        {'一票否决 · 摇头更重'}
      </div>
      <Foot4>{'deny / ask > hook allow · 官方原文：Deny and ask rules are still evaluated regardless of what the hook returns'}</Foot4>
    </AbsoluteFill>
  );
};

// ── 4-C 防转圈标志（小循环图 + 两态标志 + 掐停） ────────────────────────

const CYC = {cx: 620, cy: 520, r: 150} as const;
const CYC_NODES = [
  {zh: '注入', a: -90},
  {zh: '重入', a: 30},
  {zh: '再触发', a: 150},
] as const;

const ShotC: React.FC<{atErr: number; atFlag: number; atSkip: number; atKill: number}> = ({atErr, atFlag, atSkip, atKill}) => {
  const frame = useCurrentFrame();
  const pt = (deg: number) => ({x: CYC.cx + CYC.r * Math.cos((deg * Math.PI) / 180), y: CYC.cy + CYC.r * Math.sin((deg * Math.PI) / 180)});
  // 「报阻塞错误」：阻塞错误条（回调蓝）注入对话（流入注入节点）
  const err = useProgress(atErr, DUR.f5, 'decelerate');
  // 「带着标志重入」：标志位翻转为「亮」态 + 循环带标志再入（巡游点携带标志点）
  const flag = useProgress(atFlag, DUR.f4);
  const lapAfter = useProgress(atFlag, DUR.f6, 'linear');
  // 「看见标志就不再触发」：下一轮越过触发位（虚线越过弧——非删除节点）
  const skip = useProgress(atSkip, DUR.f5, 'decelerate');
  // 「无限循环」：自旋警告图标被一道红杠掐停（自旋冻结）
  const spin = (frame / 5) % 360;
  const killBar = useProgress(atKill, DUR.f3, 'accelerate');
  const killPulse = useImpulse({at: atKill + DUR.f3, dur: DUR.f5, peak: 1});
  const spinFrozen = clamp01(killBar) > 0.3;
  return (
    <AbsoluteFill>
      <SceneTag chapter="Safeguard 2" tagline="防转圈 · stopHookActive" accent={theme.mech} />
      {/* 小循环图（注入 → 重入 → 再触发；带标志再入的巡游点） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
        <circle cx={CYC.cx} cy={CYC.cy} r={CYC.r} fill="none" stroke={theme.hook} strokeWidth={4} opacity={0.5} />
        {CYC_NODES.map((n, i) => {
          const p = pt(n.a);
          const bypass = i === 2 ? clamp01(skip) : 0;
          return (
            <g key={n.zh} opacity={1 - 0.55 * bypass}>
              <circle cx={p.x} cy={p.y} r={34} fill={theme.bg} stroke={i === 2 ? withAlpha(theme.dim, 0.9) : theme.hook} strokeWidth={4} />
            </g>
          );
        })}
        {/* 越过弧（虚线静态样式 + 透明度揭示——与描线动画分元素，红线三） */}
        {skip > 0.01 ? (
          <path
            d={`M ${pt(150).x - 60} ${pt(150).y + 78} Q ${CYC.cx - CYC.r - 92} ${CYC.cy + 40}, ${pt(-90).x - 74} ${pt(-90).y + 66}`}
            fill="none"
            stroke={theme.dim}
            strokeWidth={3.5}
            strokeDasharray="9 8"
            opacity={0.8 * skip}
          />
        ) : null}
        {/* 巡游点（带标志再入——标志亮后巡游点外挂紫标） */}
        {(() => {
          const a = -90 + lapAfter * 360;
          const p = pt(a);
          return (
            <g>
              <circle cx={p.x} cy={p.y} r={11} fill={theme.hook} />
              {flag > 0.5 ? <circle cx={p.x + 18} cy={p.y - 18} r={8} fill={theme.mech} opacity={clamp01(flag)} /> : null}
            </g>
          );
        })()}
      </svg>
      {CYC_NODES.map((n) => {
        const p = pt(n.a);
        return (
          <div
            key={n.zh}
            style={{
              position: 'absolute',
              left: p.x - 40,
              top: p.y - 13,
              width: 80,
              textAlign: 'center',
              fontFamily: theme.sans,
              fontSize: 21,
              fontWeight: 600,
              color: n.zh === '再触发' ? theme.dim : theme.text,
              whiteSpace: 'nowrap',
            }}
          >
            {n.zh}
          </div>
        );
      })}
      {/* 标志位（两态：空 → 亮；禁第三态） */}
      <FlagBadge x={920} y={330} lit={1} flag={flag} />
      <div style={{position: 'absolute', left: 940, top: 430, fontFamily: theme.sans, fontSize: 18, color: theme.dim, opacity: clamp01(flag)}}>
        {'带着标志重入'}
      </div>
      {/* 阻塞错误条（回调蓝——注入对话：流入注入节点） */}
      <div
        style={{
          position: 'absolute',
          left: 380 + 240 * err,
          top: 220 + 130 * err,
          opacity: err,
        }}
      >
        <div
          style={{
            padding: '9px 18px',
            borderRadius: 9,
            border: `2.5px solid ${theme.hook}`,
            background: withAlpha(theme.hook, 0.15),
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.hook}}>{'blockingError'}</span>
        </div>
      </div>
      {/* 「无限转圈」警告图标（警示红自旋——被一道红杠掐停） */}
      <div style={{position: 'absolute', left: 1130, top: 470}}>
        <svg width={170} height={170} viewBox="-85 -85 170 170" style={{overflow: 'visible'}}>
          <g transform={`rotate(${spinFrozen ? 0 : spin})`}>
            {/* 自旋圆箭头（无限循环的警告形） */}
            <path d="M 56 -34 A 66 66 0 1 1 -34 -58" fill="none" stroke={theme.danger} strokeWidth={9} strokeLinecap="round" />
            <path d="M -52 -76 L -24 -56 L -56 -38 Z" fill={theme.danger} />
          </g>
          {/* 掐停红杠（一道——防转圈具象；真被拦语义） */}
          {killBar > 0.01 ? (
            <line
              x1={-74}
              y1={-74}
              x2={-74 + 148 * clamp01(killBar)}
              y2={-74 + 148 * clamp01(killBar)}
              stroke={theme.danger}
              strokeWidth={13}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - clamp01(killBar)}
            />
          ) : null}
        </svg>
        {killPulse > 0.01 ? (
          <svg width={220} height={220} style={{position: 'absolute', left: -25, top: -25, overflow: 'visible', pointerEvents: 'none'}}>
            <circle cx={110} cy={110} r={70 + 40 * killPulse} fill="none" stroke={theme.danger} strokeWidth={4} opacity={killPulse * 0.8} />
          </svg>
        ) : null}
        <div style={{position: 'absolute', left: -10, top: 180, fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap', opacity: clamp01(killBar)}}>
          {'掐停 · 不再触发'}
        </div>
      </div>
      <Foot4>{'stopHookActive · 标志两态：空 / 亮'}</Foot4>
    </AbsoluteFill>
  );
};

// ── 4-D 保险合亮定格（双徽记 + 问号悬念） ───────────────────────────────

const ShotD: React.FC<{atMerge: number; atGlow: number; atQ: number; atDim: number}> = ({atMerge, atGlow, atQ, atDim}) => {
  const frame = useCurrentFrame();
  // 双徽记自两侧合拢至中位（等大对称）
  const merge = useSpring('settle', {at: atMerge, dur: DUR.f5});
  const m = clamp01(merge);
  const lx = 420 + (770 - 420) * m;
  const rx = 1500 + (1150 - 1500) * m;
  // 同亮辉光（合拢到位后）
  const glow = useProgress(atGlow, DUR.f4);
  // 问号淡入悬顶（打光定格——唯一新增元素）
  const q = useProgress(atQ, DUR.f4);
  const qBreathe = 0.7 + 0.3 * Math.sin(frame / 15);
  const dimAll = useProgress(atDim, DUR.f4);
  // 背景退暗层（增长条暗影 + 表决/标志装置暗影）
  const bgDim = useProgress(atMerge, DUR.f5);
  return (
    <AbsoluteFill>
      {/* 背景装置退为暗层（增长条暗影 + 徽标暗影——P4 预告元素回收为背景） */}
      <div style={{position: 'absolute', left: 200, top: 720, opacity: 0.18 * bgDim, pointerEvents: 'none'}}>
        <div style={{display: 'flex', gap: 8}}>
          {Array.from({length: 27}, (_, i) => (
            <div key={`b${i}`} style={{width: i < 4 ? 46 : 18, height: 54, borderRadius: 5, border: `2px solid ${withAlpha(theme.mech, 0.6)}`}} />
          ))}
          <div style={{width: 24, height: 54, borderRadius: 5, border: `2px dashed ${withAlpha(theme.mech, 0.5)}`}} />
        </div>
      </div>
      {/* 双保险徽记（挂点紫——等大对称、合拢同亮；只两枚） */}
      <InsuranceBadge cx={lx} cy={520} r={118} label={'保险一 · 不变式'} lit={1} glow={glow} />
      <InsuranceBadge cx={rx} cy={520} r={118} label={'保险二 · 防转圈'} lit={1} glow={glow} />
      {/* 问号（悬顶打光——钩向 P5、回扣 p2-09「值多少钱」） */}
      {q > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 150,
            textAlign: 'center',
            fontFamily: theme.serif,
            fontSize: 130,
            fontWeight: 700,
            color: theme.mech,
            opacity: q * qBreathe,
            textShadow: `0 0 ${40 * q}px ${withAlpha(theme.mech, 0.55)}`,
            pointerEvents: 'none',
          }}
        >
          ?
        </div>
      ) : null}
      {/* 半拍收暗（盖场景不盖字幕） */}
      <AbsoluteFill style={{background: '#000', opacity: 0.7 * dimAll, pointerEvents: 'none'}} />
      <Foot4>{'两条保险 · 不变式 + 防转圈'}</Foot4>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P4Safeguards: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p4-01', 'p4-03');
  const bB = w('p4-04', 'p4-06');
  const bC = w('p4-07', 'p4-08');
  const bD = w('p4-08b');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <ShotA
          atGrow={wa('p4-01', 0.78) - bA.from}
          atExt={wa('p4-02', 0.3) - bA.from}
          atSeg={wa('p4-02', 0.7) - bA.from}
          atCard={wa('p4-03', 0.42) - bA.from}
          atInject={wa('p4-03', 0.68) - bA.from}
          atFix={wa('p4-03', 0.88) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <ShotB
          atLit={wa('p4-04', 0.3) - bB.from}
          atTicket={wa('p4-04', 0.48) - bB.from}
          atBounce={wa('p4-04', 0.62) - bB.from}
          atNods={wa('p4-05', 0.35) - bB.from}
          atPress={wa('p4-05', 0.6) - bB.from}
          atGhost={wa('p4-06', 0.3) - bB.from}
          atRetire={wa('p4-06', 0.45) - bB.from}
          atZoom={wa('p4-06', 0.75) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <ShotC
          atErr={wa('p4-07', 0.4) - bC.from}
          atFlag={wa('p4-07', 0.8) - bC.from}
          atSkip={wa('p4-08', 0.25) - bC.from}
          atKill={wa('p4-08', 0.8) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <ShotD
          atMerge={wa('p4-08b', 0.25) - bD.from}
          atGlow={wa('p4-08b', 0.5) - bD.from}
          atQ={wa('p4-08b', 0.72) - bD.from}
          atDim={at('p4-08b') + dur('p4-08b') - Math.min(9, dur('p4-08b') / 4) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4Safeguards;
