/** P1 一张注册表（p1-01..p1-13，4 镜）——分镜 1-A / 1-B / 1-C / 1-D。
 *
 *  叙事链：注册表主视觉首亮（Morph Continuity 0-D→1-A 判替换不 morph：问题
 *  宣告→答案装置是层间替换语义，幕界 SceneFade + 屏位呼应——0-D 末帧字卡
 *  消散位 = 1-A 首帧注册表亮起位、字卡四槽位轮廓与注册表四事件行同位对齐）：
 *  挂点紫双列表居中偏右（左列四事件名白话短签显字、右列回调串空位）、环体
 *  净化态居左（0-B 杂色块已清空、恢复匀转、环上一处事件触发紫点脉冲），
 *  「字典」列间连线成型、「挨个跑」回调小卡入串位预演一拍、「注册表说了算」
 *  触发线（回调蓝）接通、数据流环→表 → 1-B 环体同形放大落位屏中（无 cut
 *  连续）、注册表缩驻右上联动：四紫点沿环 stagger 钉满一圈（等弧距）、「盖满
 *  一个周期」四点间弧段连线点亮整圈闭合，四词（输入提交后/动手之前/动手之后/
 *  退出前）各落位一点一签一行（点/签/行三系同步，次序=口播）→ 1-C 降格迁移：
 *  三道闸门卡（ep3 同形签名——裁决紫 #7C6FF0 三卡串联）自环内拆出、沿迁移轨
 *  飞挂「动手之前」挂点下方与日志卡并排成回调串、注册表该行 +2、计数角标
 *  「4 事件 · 5 回调」亮出（基线标尺）、「挂了两条」双卡同拍脉冲、调用影过
 *  双卡留两道过痕 → 1-D 环体净化定格：具名检查函数名灰签（0-B 字样残留——
 *  1-A 清块未清名）逐一淡出、四紫点齐脉冲、「具名检查 0」徽标定格、「做完了」
 *  文本块飞向出口被第四挂点伸出的紫钩勾住（悬念定格、半拍收暗）。
 *
 *  空间契约：表双列结构与列名恒定、环体净化态（杂色块不复活）、触发线方向恒
 *  环→表；四点沿环等弧距（-90/0/90/180）、次序恒口播序；闸卡与 ep3 同形签名
 *  （迁移中不变形不重绘、缩微走 scale）、计数 4 事件 · 5 回调为钉选字节事实；
 *  灰签淡出有序可见、挂钩自第四挂点（Stop 位 = 环左，出口侧）伸出、文本块被
 *  勾停于出口前不飞出画面。
 *
 *  红线落实：词落位 = 句首 + 句长比例；表不一次全亮（stagger）；回调卡 1-C
 *  才挂满；短签机制细节不展开（事件名英文只进角标）；y≥56 / bottom≥168。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  CallbackCard,
  CheckChip,
  GateTrio,
  HOOK_EVENTS,
  HookGlyph,
  HookPoint,
  HookRegistry,
  LoopRing,
  MigrationTrack,
  SceneTag,
  ringPt,
  useRingDot,
  type RegRowState,
} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFlowDash, useImpulse, useProgress, usePushIn, useSpring} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const Foot1: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 168,
      textAlign: 'center',
      fontFamily: theme.mono,
      fontSize: 22,
      color: theme.dim,
      opacity: 0.85,
    }}
  >
    {children}
  </div>
);

/** 四挂点角位（等弧距——12 点起顺时针：输入前/动手前/动手后/退出前；
 *  退出前 = 180° 环左 = 出口侧，Stop 钩自该位伸出勾住出口前的「做完了」） */
const HOOK_ANGLES = [-90, 0, 90, 180] as const;

/** 1-B 白话短签（事件名 + 语义；与注册表行一一对应） */
const POINT_SIGNS = [
  {zh: '输入前', sub: '注入上下文'},
  {zh: '动手前', sub: '可拦截'},
  {zh: '动手后', sub: '查副作用'},
  {zh: '退出前', sub: '收尾'},
] as const;

/** 教学版五条回调的行分布（钉选字节事实：PreToolUse 挂两条） */
const FULL_BEADS: readonly (readonly string[])[] = [['注入'], ['权限', '日志'], ['查副作用'], ['收尾']];

// ── 1-A 注册表首亮（WS：环左 + 表右 + 触发线接通） ──────────────────────

const RING_A = {cx: 400, cy: 560, size: 430} as const;

const ShotA: React.FC<{atPush: number; atTable: number; atRows: number; atDemo: number; atPulse: number; atLink: number}> = ({
  atPush,
  atTable,
  atRows,
  atDemo,
  atPulse,
  atLink,
}) => {
  const frame = useCurrentFrame();
  // @pushIn：p1-01 摆答案起压向本集主角注册表
  const push = usePushIn(atPush, {scale: 0.05, dur: DUR.f6});
  // 注册表自 0-D 字卡消散位亮起（rise——屏位呼应承接）
  const tableIn = useEnter('rise', {at: atTable, dur: DUR.f6, dist: 30, springPreset: 'settle'});
  // 左列四行 stagger 显名（schedule fit 钳制总时长——不一次全亮）
  const rowsLit = [0, 1, 2, 3].map((i) => clamp01(progress(frame, atRows + i * 6, DUR.f4)));
  const rows: RegRowState[] = rowsLit.map((lit) => ({lit}));
  // 「挨个跑」：右列一枚回调蓝小卡入串位排队预演一拍（≤2s 插曲——退场锚=入场点）
  const demoIn = useProgress(atDemo, DUR.f4);
  const demoOut = useProgress(atDemo + DUR.f5 + DUR.f4, DUR.f4);
  const demoPulse = useImpulse({at: atDemo + DUR.f3, dur: DUR.f5, peak: 1});
  // 环上事件触发紫点（首亮——仅此一处）+ 「事件触发这一种语句」脉冲放大一拍
  const ptLit = useProgress(atTable + DUR.f4, DUR.f4);
  const ptPulse = useImpulse({at: atPulse, dur: DUR.f5, peak: 1});
  // 触发线（回调蓝）环→表接通 + 数据流（方向恒环→表：环问表答）
  const link = useProgress(atLink, DUR.f5, 'decelerate');
  const flow = useFlowDash({dash: 9, gap: 12, period: 26});
  const dot = useRingDot(3.4);
  const linkStart = ringPt(RING_A.cx, RING_A.cy, RING_A.size / 2 - 46, 20);
  return (
    <AbsoluteFill style={{transform: push}}>
      <SceneTag chapter="Hooks" tagline="一张注册表" accent={theme.mech} />
      {/* 环体净化态居左（M-001：杂色块已清空、恢复匀转） */}
      <div style={{position: 'absolute', left: RING_A.cx - RING_A.size / 2, top: RING_A.cy - RING_A.size / 2}}>
        <LoopRing size={RING_A.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {/* 环上事件触发标记（紫点脉冲——循环里唯一留下的语句） */}
      <HookPoint cx={linkStart.x} cy={linkStart.y} lit={ptLit} pulse={ptPulse} />
      <div
        style={{
          position: 'absolute',
          left: linkStart.x + 22,
          top: linkStart.y - 46,
          fontFamily: theme.mono,
          fontSize: 15,
          color: theme.mech,
          opacity: ptLit,
          whiteSpace: 'nowrap',
        }}
      >
        {'trigger_hooks()'}
      </div>
      {/* 注册表（双列表主装置——自 0-D 字卡消散位亮起） */}
      <div style={{...tableIn, position: 'absolute', left: 880, top: 250}}>
        <HookRegistry x={0} y={0} w={470} lit={1} rows={rows} />
      </div>
      {/* 「挨个跑」预演回调卡（串位排队一拍——插曲层退场） */}
      <div style={{position: 'absolute', left: 1362, top: 560, opacity: demoIn * (1 - demoOut)}}>
        <div style={{transform: `translateY(${(1 - demoIn) * 14}px) scale(${1 + 0.06 * demoPulse})`}}>
          <CallbackCard x={0} y={0} w={150} h={52} label={'回调'} flash={demoPulse} lit={demoIn} />
        </div>
        <div style={{position: 'absolute', left: 4, top: 56, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>
          {'排队预演'}
        </div>
      </div>
      {/* 触发线（回调蓝）环→表 + 行进虚线数据流（方向恒环→表） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
        <path
          d={`M ${linkStart.x} ${linkStart.y} Q ${(linkStart.x + 880) / 2 + 40} ${linkStart.y - 120}, 880 470`}
          fill="none"
          stroke={theme.hook}
          strokeWidth={4}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - clamp01(link)}
        />
        {link > 0.99 ? (
          <path
            d={`M ${linkStart.x} ${linkStart.y} Q ${(linkStart.x + 880) / 2 + 40} ${linkStart.y - 120}, 880 470`}
            fill="none"
            stroke={theme.hook}
            strokeWidth={4}
            opacity={0.75}
            {...flow}
          />
        ) : null}
        {link > 0.99 ? <path d="M 866 458 L 886 470 L 864 478 Z" fill={theme.hook} /> : null}
      </svg>
      <Foot1>{'HOOKS · 事件名 → 回调串'}</Foot1>
    </AbsoluteFill>
  );
};

// ── 1-B 四事件钉环（MS：环放大居中 + 表缩驻右上联动） ───────────────────

const RING_B = {cx: 960, cy: 560, size: 560} as const;

const ShotB: React.FC<{atZoom: number; atPins: number; atArcs: number; atSyncs: readonly number[]}> = ({atZoom, atPins, atArcs, atSyncs}) => {
  const frame = useCurrentFrame();
  // 环体自 1-A 位同形放大落位屏中（无 cut 连续——位置+尺度连续插值，形状不变）
  const zoom = useProgress(atZoom, DUR.f6, 'decelerate');
  const cx = RING_A.cx + (RING_B.cx - RING_A.cx) * zoom;
  const cy = RING_A.cy + (RING_B.cy - RING_A.cy) * zoom;
  const size = RING_A.size + (RING_B.size - RING_A.size) * zoom;
  const r = size / 2 - 46;
  // 注册表缩驻右上联动位（同形缩置；dim 0.35 档保身份——QA-3）
  const regLit = [0, 1, 2, 3].map((i) => clamp01(progress(frame, atSyncs[i], DUR.f3)));
  const rows: RegRowState[] = regLit.map((lit) => ({lit}));
  // 四紫点 stagger 钉位（schedule fit 钳制）
  const pins = [0, 1, 2, 3].map((i) => clamp01(progress(frame, atPins + i * 6, DUR.f4)));
  // 「盖满一个周期」：四点间弧段连线点亮、一整圈闭合（周期具象）
  const arcs = [0, 1, 2, 3].map((i) => clamp01(progress(frame, atArcs + i * 5, DUR.f4)));
  // 四词各落位一点一签一行（点/签/行三系同步——G1 note6 统一措辞）
  const syncs = atSyncs.map((a) => clamp01(progress(frame, a, DUR.f4)));
  const dot = useRingDot(3.4);
  return (
    <AbsoluteFill>
      {/* 环体（同形放大居中——M-001 描边/线宽恒定；匀转） */}
      <div style={{position: 'absolute', left: cx - size / 2, top: cy - size / 2}}>
        <LoopRing size={size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {/* 四点间弧段连线（挂点紫细弧——周期闭合；等弧距四段） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
        {HOOK_ANGLES.map((a0, i) => {
          const a1 = HOOK_ANGLES[(i + 1) % 4];
          const p0 = ringPt(cx, cy, r + 18, a0 + 8);
          const p1 = ringPt(cx, cy, r + 18, a1 - 8);
          return (
            <path
              key={`arc${i}`}
              d={`M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${(r + 18).toFixed(1)} ${(r + 18).toFixed(1)} 0 0 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`}
              fill="none"
              stroke={theme.mech}
              strokeWidth={4}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - arcs[i]}
            />
          );
        })}
      </svg>
      {/* 四紫点钉位 + 白话短签 + 注册表行（三系同步，次序=口播） */}
      {HOOK_ANGLES.map((a, i) => {
        const p = ringPt(cx, cy, r, a);
        const lit = pins[i];
        const sync = syncs[i];
        // 短签贴位（点外侧——随点位展开；size ≥ 260 才显签）
        const signX = a === -90 ? p.x - 96 : a === 0 ? p.x + 34 : a === 90 ? p.x - 96 : p.x - 226;
        const signY = a === -90 ? p.y - 108 : a === 0 ? p.y - 34 : a === 90 ? p.y + 40 : p.y - 34;
        return (
          <React.Fragment key={`pt${i}`}>
            <HookPoint cx={p.x} cy={p.y} lit={lit} pulse={sync > 0.2 && sync < 0.8 ? Math.sin(Math.PI * sync) : 0} />
            <div
              style={{
                position: 'absolute',
                left: signX,
                top: signY,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 16px',
                borderRadius: 9,
                border: `2.5px solid ${withAlpha(theme.mech, 0.4 + 0.6 * sync)}`,
                background: withAlpha(theme.mech, 0.1 * sync),
                opacity: sync,
                transform: `translateY(${(1 - sync) * -10}px)`,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text}}>{POINT_SIGNS[i].zh}</span>
              <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim}}>{'· ' + POINT_SIGNS[i].sub}</span>
              <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{HOOK_EVENTS[i].en}</span>
            </div>
          </React.Fragment>
        );
      })}
      {/* 注册表缩驻右上联动位（四行随点同步点亮；scale 缩置不重绘） */}
      <div style={{position: 'absolute', left: 1340, top: 72, opacity: 0.9}}>
        <HookRegistry x={0} y={0} w={470} lit={1} rows={rows} dim={0.3} scale={0.52} />
      </div>
      <Foot1>{'UserPromptSubmit · PreToolUse · PostToolUse · Stop'}</Foot1>
    </AbsoluteFill>
  );
};

// ── 1-C 降格迁移（CU：闸卡拆出飞挂 + 计数 5 + 双签齐动） ────────────────

const ShotC: React.FC<{atPull: number; atLand: number; atCount: number; atDuo: number; atRun: number; atTrace: number}> = ({
  atPull,
  atLand,
  atCount,
  atDuo,
  atRun,
  atTrace,
}) => {
  const frame = useCurrentFrame();
  const cx = RING_B.cx;
  const cy = RING_B.cy;
  const r = RING_B.size / 2 - 46;
  const dot = useRingDot(3.4);
  // 三闸卡自环内拆出（spring 沿迁移轨飞挂）→ 与日志卡并排成串（缩微走 scale，不重绘）
  const mig = useSpring('settle', {at: atPull, dur: Math.max(DUR.f6, atLand + DUR.f5 - atPull)});
  const migP = clamp01(mig);
  const trioScale = 1 - 0.62 * migP;
  const trioX = cx - 150 + (1005 - (cx - 150)) * migP;
  const trioY = cy - 170 + (700 - (cy - 170)) * migP;
  // 迁移轨描线（拆解轨迹可见——从写死到挂上的空间叙事）
  const trackP = useProgress(atPull, Math.max(DUR.f5, atLand - atPull), 'decelerate');
  // 落位成串：日志卡在挂点下候位；trio 落位 = 权限（三闸降格成一条普通回调）
  const land = useProgress(atLand, DUR.f4);
  // 「五条回调」：全景回调串计数 2→5 逐颗点亮 + 计数角标（基线标尺）。
  // 各行珠入列锚：row1（权限+日志）随落位、其余三行随「五条回调」词窗 stagger
  const beadAt = (ri: number, bi: number) => (ri === 1 ? atLand + DUR.f4 + bi * 4 : atCount + [1, 0, 2, 3][ri] * 5);
  const counterLit = useProgress(atCount + DUR.f5, DUR.f4);
  const countPulse = useImpulse({at: atCount + DUR.f6, dur: DUR.f5, peak: 1});
  // 「挂了两条」：PreToolUse 串上两颗高亮（权限+日志双签）
  const duo = useProgress(atDuo, DUR.f3);
  // 「一起跑」：两卡同时脉冲一次（同挂点齐动）
  const duoPulse = useImpulse({at: atRun, dur: DUR.f5, peak: 1});
  // 「先过这两条」：调用影过双卡留两道过痕
  const trace = useProgress(atTrace, DUR.f5, 'linear');
  const traceX = 1010 + 340 * trace;
  // 注册表右上联动位：PreToolUse 行 +2（行生长——珠串入列即颗数增长）
  const rows: RegRowState[] = FULL_BEADS.map((set, ri) => ({
    lit: 1,
    beads: set.filter((_, bi) => frame >= beadAt(ri, bi)),
    active: ri === 1 ? duo : 0,
    beadPulse: ri === 1 ? duoPulse : 0,
  }));
  return (
    <AbsoluteFill>
      {/* 环体（承 1-B 末态——四紫点在位、匀转） */}
      <div style={{position: 'absolute', left: cx - RING_B.size / 2, top: cy - RING_B.size / 2}}>
        <LoopRing size={RING_B.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {HOOK_ANGLES.map((a, i) => {
        const p = ringPt(cx, cy, r, a);
        return <HookPoint key={`pt${i}`} cx={p.x} cy={p.y} lit={1} pulse={i === 1 ? duoPulse : 0} />;
      })}
      {/* 迁移轨（环内 → 动手前挂点下方） */}
      <MigrationTrack x1={cx} y1={cy - 110} qx={cx + 250} qy={cy + 30} x2={1005} y2={690} p={trackP} />
      {/* 三闸卡（ep3 同形签名 #7C6FF0——自环内拆出、沿轨飞挂、缩微不重绘） */}
      <div style={{position: 'absolute', left: trioX, top: trioY, transform: `scale(${trioScale})`, transformOrigin: 'left top'}}>
        <GateTrio x={0} y={0} cardW={120} cardH={112} spacing={150} spread={0.6 + 0.4 * migP} lit={1} connect={migP} />
        {/* 降格签（飞行中钉上——三闸门整个降格成一条普通回调） */}
        <div
          style={{
            position: 'absolute',
            left: 34,
            top: 120,
            fontFamily: theme.sans,
            fontSize: 19,
            fontWeight: 700,
            color: theme.mech,
            opacity: clamp01(migP * 1.2 - 0.2),
            whiteSpace: 'nowrap',
          }}
        >
          {'权限 · 一条回调'}
        </div>
      </div>
      {/* 挂点下回调串（并排成串：权限〔三闸降格〕+ 日志） */}
      <div style={{position: 'absolute', left: 1215, top: 700, opacity: land}}>
        <div style={{transform: `scale(${1 + 0.05 * duoPulse})`}}>
          <CallbackCard x={0} y={0} w={168} h={56} label={'日志'} sub={'log'} flash={duoPulse} lit={land} />
        </div>
      </div>
      {/* 调用影过双卡（I-032 微走查——一枚影过、留两道过痕） */}
      {trace > 0.02 && trace < 1 ? (
        <div style={{position: 'absolute', left: traceX, top: 728, transform: 'translate(-50%,-50%)'}}>
          <div style={{width: 18, height: 18, borderRadius: 999, background: theme.core, opacity: 0.85}} />
        </div>
      ) : null}
      {trace > 0.55 ? (
        <>
          <div style={{position: 'absolute', left: 1022, top: 764, width: 40, height: 5, borderRadius: 3, background: theme.ok, opacity: clamp01((trace - 0.55) * 3)}} />
          <div style={{position: 'absolute', left: 1300, top: 764, width: 40, height: 5, borderRadius: 3, background: theme.ok, opacity: clamp01((trace - 0.75) * 3)}} />
        </>
      ) : null}
      {/* 注册表右上联动位（PreToolUse 行 +2；计数角标亮出） */}
      <div style={{position: 'absolute', left: 1340, top: 72, opacity: 0.92}}>
        <HookRegistry x={0} y={0} w={470} lit={1} rows={rows} counterLit={counterLit} dim={0.28} scale={0.52} />
      </div>
      {/* 计数角标脉冲注记（基线标尺读法锚） */}
      <div
        style={{
          position: 'absolute',
          left: 1370,
          top: 330,
          fontFamily: theme.mono,
          fontSize: 17,
          color: theme.text,
          opacity: counterLit * (0.7 + 0.3 * countPulse),
          whiteSpace: 'nowrap',
        }}
      >
        {'教学版 · 钉选字节事实'}
      </div>
      <Foot1>{'register_hook · 降格迁移 · 4 事件 5 回调'}</Foot1>
    </AbsoluteFill>
  );
};

// ── 1-D 环体净化 + 悬念定格（MS：灰签淡出 + 紫钩勾住「做完了」） ────────

const RING_D = {cx: 960, cy: 540, size: 620} as const;

const ShotD: React.FC<{atFade: number; atQuad: number; atBadge: number; atFly: number; atHook: number; atDim: number}> = ({
  atFade,
  atQuad,
  atBadge,
  atFly,
  atHook,
  atDim,
}) => {
  const frame = useCurrentFrame();
  const cx = RING_D.cx;
  const cy = RING_D.cy;
  const r = RING_D.size / 2 - 46;
  // 具名检查函数名灰签（0-B 字样残留——同款形态）逐一淡出
  const residues = ['log', 'check', 'notify'] as const;
  const fades = residues.map((_, i) => clamp01(progress(frame, atFade + i * 6, DUR.f4)));
  // 四紫点齐脉冲一次（「四处事件触发」）
  const quadPulse = useImpulse({at: atQuad, dur: DUR.f6, peak: 1});
  // 「具名检查 0」徽标（重音镜——亮出定格）
  const badge = useProgress(atBadge, DUR.f4);
  const badgePulse = useImpulse({at: atBadge + DUR.f3, dur: DUR.f6, peak: 1});
  // 「做完了」文本块（回调蓝）自环内飞向出口（左）——被紫钩勾停于出口前
  const fly = useProgress(atFly, DUR.f5, 'decelerate');
  const blockO = useProgress(atFly - DUR.f3, DUR.f3);
  const hookExt = useProgress(atHook, DUR.f4);
  const hookPulse = useImpulse({at: atHook + DUR.f4, dur: DUR.f5, peak: 1});
  const blockX = cx - 60 + (600 - (cx - 60)) * fly;
  const blockY = cy - 10 + (585 - (cy - 10)) * fly;
  // 半拍收暗（悬念交给下一幕）
  const dimAll = useProgress(atDim, DUR.f4);
  const stopPt = ringPt(cx, cy, r, 180);
  const dot = useRingDot(3.4);
  // 注册表缩悬右下联动位
  const rows: RegRowState[] = FULL_BEADS.map((set) => ({lit: 1, beads: set}));
  return (
    <AbsoluteFill>
      {/* 环体满幅居中（M-001 净化态：陶土橙环 + 四紫点；匀转渐止） */}
      <div style={{position: 'absolute', left: cx - RING_D.size / 2, top: cy - RING_D.size / 2}}>
        <LoopRing size={RING_D.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {/* 四紫点（齐脉冲一次） */}
      {HOOK_ANGLES.map((a, i) => (
        <HookPoint key={`pt${i}`} cx={ringPt(cx, cy, r, a).x} cy={ringPt(cx, cy, r, a).y} lit={1} pulse={quadPulse} />
      ))}
      {/* 具名检查函数名灰签（0-B 字样残留——同款 CheckChip 形态）逐一淡出 */}
      {residues.map((lb, i) => (
        <CheckChip key={lb} x={cx - 170 + i * 130} y={cy + 130} w={116} label={lb} lit={1 - fades[i]} ghost={fades[i]} />
      ))}
      {/* 一句事件触发语句高亮（循环里唯一留下的语句——环心） */}
      <div style={{position: 'absolute', left: cx - 150, top: cy - 96}}>
        <div
          style={{
            width: 300,
            height: 58,
            boxSizing: 'border-box',
            borderRadius: 10,
            border: `2.5px solid ${theme.core}`,
            background: withAlpha(theme.core, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 21,
            color: theme.text,
          }}
        >
          {'trigger_hooks()'}
        </div>
      </div>
      {/* 「具名检查 0」徽标（重音镜定格） */}
      <div style={{position: 'absolute', left: cx - 130, top: cy - 14, opacity: badge}}>
        <div
          style={{
            padding: '12px 26px',
            borderRadius: 10,
            border: `3px solid ${theme.ok}`,
            background: theme.bg,
            transform: `scale(${1 + 0.05 * badgePulse})`,
            boxShadow: badgePulse > 0.01 ? `0 0 ${26 * badgePulse}px ${withAlpha(theme.ok, 0.6)}` : 'none',
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.text}}>{'具名检查'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 34, fontWeight: 700, color: theme.ok, fontVariantNumeric: 'tabular-nums'}}>{'0'}</span>
        </div>
      </div>
      {/* 出口（环左——Stop 挂点侧；淡框在场，与 2-A 门同位——morph 前置） */}
      <svg width={220} height={240} viewBox="0 0 220 240" style={{position: 'absolute', left: 560, top: 415, overflow: 'visible', opacity: 0.35}}>
        <path d="M10 230 L10 66 Q10 10, 110 10 Q210 10, 210 66 L210 230" fill="none" stroke={theme.core} strokeWidth={5} />
      </svg>
      {/* 第四挂点伸出的紫钩（Stop 位——勾住「做完了」；本拍前不可见） */}
      <div style={{opacity: hookExt > 0.01 ? 1 : 0}}>
        <HookGlyph cx={stopPt.x + 26} cy={stopPt.y - 34} s={1.15} extend={hookExt} />
      </div>
      {/* 「做完了」文本块（回调蓝——起飞、被勾停于出口前） */}
      <div style={{position: 'absolute', left: blockX, top: blockY, opacity: blockO}}>
        <div
          style={{
            padding: '10px 22px',
            borderRadius: 10,
            border: `2.5px solid ${theme.hook}`,
            background: withAlpha(theme.hook, 0.16),
            boxShadow: hookPulse > 0.01 ? `0 0 ${24 * hookPulse}px ${withAlpha(theme.mech, 0.75)}` : `0 0 14px ${withAlpha(theme.hook, 0.45)}`,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{'做完了'}</span>
        </div>
      </div>
      {/* 注册表缩悬右下联动位（满串态收在本幕） */}
      <div style={{position: 'absolute', left: 1430, top: 640, opacity: 0.85}}>
        <HookRegistry x={0} y={0} w={470} lit={1} rows={rows} counterLit={1} dim={0.3} scale={0.42} />
      </div>
      {/* 半拍收暗（盖场景不盖字幕） */}
      <AbsoluteFill style={{background: '#000', opacity: 0.7 * dimAll, pointerEvents: 'none'}} />
      <Foot1>{'trigger_hooks · 具名检查 0'}</Foot1>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P1HookRegistry: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p1-01', 'p1-03');
  const bB = w('p1-04', 'p1-08');
  const bC = w('p1-09', 'p1-11');
  const bD = w('p1-12', 'p1-13');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <ShotA
          atPush={wa('p1-01', 0.05) - bA.from}
          atTable={wa('p1-01', 0.32) - bA.from}
          atRows={wa('p1-01', 0.68) - bA.from}
          atDemo={wa('p1-02', 0.82) - bA.from}
          atPulse={wa('p1-03', 0.28) - bA.from}
          atLink={wa('p1-03', 0.78) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <ShotB
          atZoom={0}
          atPins={wa('p1-04', 0.1) - bB.from}
          atArcs={wa('p1-04', 0.55) - bB.from}
          atSyncs={[
            wa('p1-05', 0.18) - bB.from,
            wa('p1-06', 0.22) - bB.from,
            wa('p1-07', 0.2) - bB.from,
            wa('p1-08', 0.24) - bB.from,
          ]}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <ShotC
          atPull={wa('p1-09', 0.42) - bC.from}
          atLand={wa('p1-09', 0.8) - bC.from}
          atCount={wa('p1-10', 0.4) - bC.from}
          atDuo={wa('p1-11', 0.28) - bC.from}
          atRun={wa('p1-11', 0.62) - bC.from}
          atTrace={wa('p1-11', 0.86) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="1-D">
        <ShotD
          atFade={wa('p1-12', 0.22) - bD.from}
          atQuad={wa('p1-12', 0.55) - bD.from}
          atBadge={wa('p1-12', 0.82) - bD.from}
          atFly={wa('p1-13', 0.42) - bD.from}
          atHook={wa('p1-13', 0.85) - bD.from}
          atDim={at('p1-13') + dur('p1-13') - Math.min(10, dur('p1-13') / 4) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1HookRegistry;
