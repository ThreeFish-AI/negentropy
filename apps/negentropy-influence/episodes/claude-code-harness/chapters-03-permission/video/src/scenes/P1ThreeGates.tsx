/** P1 三道闸门（p1-01..p1-09，4 镜）——分镜 1-A / 1-B / 1-C / 1-D。
 *
 *  叙事链：环体全景建锚（承 0-C morph）——「一行不改」环体整环静止一拍
 *  〔M-003〕（静止即陈述）、插卡位高亮闪、闸卡插入落位（角标
 *  check_permission）→「三道门」单卡分裂为三卡列队展开（一分为三在闸卡
 *  到位后发生）、「硬拒绝/规则/问人」三词各点火一卡〔M-005〕→ 1-B 第一道
 *  门特写：黑名单表七行展开、七条计数跳 7、口播白话逐词点亮对应行（stagger
 *  波次）、命中卡撞表被弹开（弹开轨迹绕过远处问人门）→ 1-C 第二道门特写：
 *  规则卡双通道（文件工具越界检测框+越出签撞框弹回 / bash 三关键词标签）、
 *  三标签逐个点亮、命中卡打标流转交第三道 → 1-D 第三道门+默认通路中景：
 *  问人终端窗展开（警示逐行落定+光标呼吸悬停）、三卡列队缩驻上方、确认绿
 *  直通路绕三卡直通执行段（默认放行）、第一道门卡短促加重一闪（P2 伏笔）。
 *
 *  空间契约：Morph Continuity（0-C→1-A）同一主体=闸门卡：起止态 0-C 末帧
 *  单枚暗态闸卡立于模型侧通道口（后缘已裂出三门轮廓）→ 1-A 首帧该闸卡
 *  点亮、位移落位环体执行段之前，三门轮廓展开为三枚闸卡列队；中间态位移+
 *  点亮过程中闸卡轮廓、描边色逐帧不变，仅位置/亮度/数量变化（一分为三在
 *  闸卡到位后发生）；身份线索=裁决紫描边+闸卡轮廓（保两项）。环体居中为
 *  唯一主体、插卡位唯一（执行段之前）、三卡列队次序=口播次序。
 *
 *  红线落实：词落位 = 句首 + 句长比例；扫描/点亮次序 = 口播白话次序；
 *  命中卡弹开轨迹绕开问人门；越出签永不入框内；绿直通路为 1-D 唯一确认绿
 *  元素；y≥56 / bottom≥168。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  AskTerminal,
  BrainGlyph,
  CallCard,
  DenyListTable,
  GateCard,
  GateChain,
  LoopRing,
  RuleLane,
  SceneTag,
  execArcPath,
} from '../components/motifs';
import {DUR, clamp01, progress, useCount, useEnter, useImpulse, useProgress, usePushIn, useSpring} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 环上坐标（-90 = 12 点；r 与 LoopRing 内圈同式 = size/2 - 46） */
const ringPt = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

/** 执行段高亮弧（青碧 = 执行面/结果回喂语义——本集环上唯一变动高亮） */
const ExecArc: React.FC<{cx: number; cy: number; r: number; p: number; opacity?: number}> = ({cx, cy, r, p, opacity = 0.95}) => (
  <svg
    width={r * 2 + 40}
    height={r * 2 + 40}
    viewBox={`${-r - 20} ${-r - 20} ${r * 2 + 40} ${r * 2 + 40}`}
    style={{position: 'absolute', left: cx - r - 20, top: cy - r - 20, overflow: 'visible', pointerEvents: 'none', opacity}}
  >
    <path
      d={execArcPath(0, 0, r)}
      fill="none"
      stroke={theme.tool}
      strokeWidth={9}
      strokeLinecap="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - clamp01(p)}
    />
  </svg>
);

/** 环体全景几何（1-A：居中主体） */
const RING = {cx: 960, cy: 580, size: 540} as const;

// ── 1-A 环体全景建锚 + 闸卡插入 + 三门列队（morph 0-C→1-A） ────────────

const ShotA: React.FC<{atSlot: number; atInsert: number; atSpread: number; atDeny: number; atRule: number; atAsk: number; atStill: number}> = ({
  atSlot,
  atInsert,
  atSpread,
  atDeny,
  atRule,
  atAsk,
  atStill,
}) => {
  const frame = useCurrentFrame();
  // @pushIn：p1-01 急推闸卡插入点——本集装置立轴
  const push = usePushIn(DUR.f3, {scale: 0.06, dur: DUR.f6});
  // morph 段1：单卡自 0-C 末帧位（闸卡中心 1185,550）spring 到插卡位中心（执行段
  // 入口之前）；描边色/轮廓逐帧不变，仅位移+点亮。
  // ⑨ QA RISKY-1（场景侧三处）：① morph 弹簧窗拉长至「插卡→列队展开」整段
  // （atInsert → atSpread+f5）——原 12 帧 settle 完成后到 atSpread 之间有 ~0.5s
  // 位移静止空窗、随后队列骤现；单窗连续后位移与分裂交叠进行，符合分镜中间态
  // 「仅位置/亮度/数量变化」。② gateLit 起步 0.9（原 0.3 起步把位移期主体压到
  // 近隐——与 motifs 侧撤聚拢压暗配套，位移期 lit≥0.9）。③ 展开仍锚「三道门」
  // 词位（atSpread），三卡点火语义不动。
  const spreadDur = Math.max(DUR.f5, atSpread + DUR.f5 - atInsert);
  const morph = useSpring('settle', {at: atInsert, dur: spreadDur});
  const gateLit = 0.9 + 0.1 * useProgress(DUR.f2, DUR.f4);
  // morph 段2：位移收尾中一分为三——三卡自插卡位向上展开成列队（spread 与上移同窗）
  const spread = useProgress(atSpread, DUR.f5);
  const chainCx = 975;
  const chainSpacing = 232;
  const cardW = 170;
  const chainW = chainSpacing * 2 + cardW;
  // 聚拢态中心沿 morph 移动；展开态队列整体上移（插卡位 → 列队位 y 330）
  const cx = 1185 + (chainCx - 1185) * morph;
  const cy = 550 + (635 - 550) * morph - 305 * spread;
  const gx = cx - cardW / 2 - chainSpacing * spread;
  // 三词各点火一卡（列队次序 = 口播次序：硬拒绝→规则→问人）。
  // ⑨ QA RISKY-1② 回炉：lit 交接不回零——原 `spread<0.5 ? [gateLit×3] : [点火×3]`
  // 在展开完成(f~1908)与首卡点火 atDeny(f~1926)之间切换到 [0,0,0]，GateCard
  // lit=0 时描边 dashoffset=1/名牌/衬底全关，造成 22 帧三卡全隐真空。改为：
  // 展开完成后整队缓降（5 帧）到待点火底线亮度 0.45（描边 45% 在场、名牌降
  // 透明不撤），每卡 lit = max(底线, 点火进度)——f1697–2014 全窗任何时刻三卡
  // 至少暗态可见，点火时自底线跃升 1（点亮跃迁语义保留）
  const LIT_FLOOR = 0.45;
  // 基线自 gateLit（位移期 0.9→1 渐亮）连续降档到底线——无任何二态跳变
  const dimGate = gateLit - (gateLit - LIT_FLOOR) * useProgress(atSpread + DUR.f5, DUR.f3);
  const lit = [
    Math.max(dimGate, clamp01(progress(frame, atDeny, DUR.f3))),
    Math.max(dimGate, clamp01(progress(frame, atRule, DUR.f3))),
    Math.max(dimGate, clamp01(progress(frame, atAsk, DUR.f3))),
  ];
  // 环体整环静止一拍（静止即陈述；定格 dot + 辉光一次不过冲）
  const still = frame >= atStill;
  const stillGlow = useImpulse({at: atStill, dur: DUR.f6});
  // 插卡位高亮闪（执行段之前——mech 标记 + impulse）
  const slotFlash = useImpulse({at: atSlot, dur: DUR.f4, peak: 1});
  const r = RING.size / 2 - 46;
  const slotPt = ringPt(RING.cx, RING.cy, r, 74);
  const arcP = useProgress(DUR.f2, DUR.f5);
  return (
    <AbsoluteFill style={{transform: push}}>
      <SceneTag chapter="Permission" tagline="三道闸门" accent={theme.mech} />
      {/* 消息列表 + 模型脑缩置环侧（进消息→调模型 站位示意，暗层不抢焦） */}
      <div style={{position: 'absolute', left: 150, top: 330, opacity: 0.6}}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{width: 150 - i * 26, height: 30, borderRadius: 7, border: `2px solid ${theme.panelBorder}`, marginBottom: 14}} />
        ))}
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'messages'}</div>
      </div>
      <div style={{position: 'absolute', left: 150, top: 620, opacity: 0.75}}>
        <BrainGlyph color={theme.dim} s={0.9} />
      </div>
      {/* 环体全景居中（M-001：恒 core 描边；执行段前插入位高亮） */}
      <div style={{position: 'absolute', left: RING.cx - RING.size / 2, top: RING.cy - RING.size / 2}}>
        <LoopRing
          size={RING.size}
          nodes={[0, 1, 2, 3, 4].map((i) => ({label: `s${i}`, angle: -90 + i * 72}))}
          showLabels={false}
          showExit={false}
          dotProgress={still ? 0.36 : 0.3 + 0.06 * ((frame % 60) / 60)}
        />
      </div>
      {/* 执行段高亮弧（青碧——环上唯一变动高亮；执行面语义） */}
      <ExecArc cx={RING.cx} cy={RING.cy} r={r} p={arcP} />
      <div
        style={{
          position: 'absolute',
          left: ringPt(RING.cx, RING.cy, r, 126).x - 26,
          top: ringPt(RING.cx, RING.cy, r, 126).y + 30,
          fontFamily: theme.sans,
          fontSize: 24,
          fontWeight: 600,
          color: theme.tool,
        }}
      >
        {'执行'}
      </div>
      {/* 插卡位高亮闪（执行段之前——裁决位标记；闸卡尚未到） */}
      {slotFlash > 0.01 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          <circle cx={slotPt.x} cy={slotPt.y} r={16 + 22 * slotFlash} fill="none" stroke={theme.mech} strokeWidth={4} opacity={slotFlash} />
        </svg>
      ) : null}
      {/* 闸门链（morph 主体：0-C 单枚暗态 → 点亮位移落位 → 一分为三列队展开） */}
      <GateChain
        x={gx}
        y={cy - 80}
        cardW={cardW}
        cardH={160}
        spacing={chainSpacing}
        spread={spread}
        connect={spread}
        lit={lit}
      />
      {/* 「一行不改」静止辉光（环体整环静止一拍） */}
      {stillGlow > 0.01 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          <circle cx={RING.cx} cy={RING.cy} r={r} fill="none" stroke={theme.core} strokeWidth={10} opacity={0.6 * stillGlow} />
        </svg>
      ) : null}
      {/* morph 说明角标（插卡位语义——check_permission） */}
      <div
        style={{
          position: 'absolute',
          left: slotPt.x - 70,
          top: slotPt.y + 44,
          fontFamily: theme.mono,
          fontSize: 17,
          color: theme.mech,
          opacity: clamp01(morph) * (1 - spread * 0.8),
        }}
      >
        check_permission
      </div>
      <Foot1>{'一行不改 · 执行之前插一行裁决'}</Foot1>
    </AbsoluteFill>
  );
};

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

// ── 1-B 第一道门：黑名单七行 + 命中弹回 ─────────────────────────────────

/** 命中卡撞表弹回（与 2-E sudo 弹回同款轨迹——机制复现；进逼 accelerate /
 *  弹回 settleSoft；弹开轨迹沿下半区弧线退场，绕过远处问人门） */
const HitBounceCard: React.FC<{atHit: number; flash: number}> = ({atHit, flash}) => {
  const inbound = useProgress(atHit, DUR.f4, 'accelerate');
  const rebound = useSpring('settleSoft', {at: atHit + DUR.f4, dur: DUR.f5});
  const dropOut = useProgress(atHit + DUR.f5 + DUR.f3, DUR.f5, 'accelerate');
  // 段1：右下 → 表右缘（触表即弹）；段2：原路弹回 + 坠出下缘（y 800→1150）
  const x = 1560 + (950 - 1560) * inbound + 340 * rebound;
  const y = 720 + (612 - 720) * inbound + (150 + 330 * dropOut) * rebound;
  const o = useProgress(atHit - DUR.f3, DUR.f3) * (1 - dropOut * 0.9);
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: o, transform: 'translate(-50%,-50%)'}}>
      <div
        style={{
          padding: '8px 18px',
          borderRadius: 9,
          border: `2.5px solid ${theme.danger}`,
          background: theme.panel,
          boxShadow: `0 0 ${26 * flash}px ${withAlpha(theme.danger, 0.8)}`,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.danger, whiteSpace: 'nowrap'}}>{'sudo rm -rf /'}</span>
      </div>
    </div>
  );
};

const ShotB: React.FC<{atTable: number; atCount: number; atRows: number; atHit: number; atFlash: number}> = ({
  atTable,
  atCount,
  atRows,
  atHit,
  atFlash,
}) => {
  const frame = useCurrentFrame();
  // 表自闸卡 1 下方展开（rise）；计数角标 0→7（数据钳制不过冲）
  const tableIn = useEnter('rise', {at: atTable, dur: DUR.f5, dist: 26, springPreset: 'settle'});
  const count = useCount({to: 7, at: atCount, dur: DUR.f5});
  // 七行点亮：口播白话次序 stagger（p1-04 七词，行序=白话次序）
  const litRows = DENY_LIT.map((_, i) => clamp01(progress(frame, atRows + i * 7, DUR.f4)));
  // 命中撞表：表 hitFlash + 命中卡弹回（绕过远处问人门——轨迹恒在下半区）
  const flash = useImpulse({at: atHit + DUR.f4, dur: DUR.f5, peak: 1});
  const tableShake = useImpulse({at: atHit + DUR.f4, dur: DUR.f3, peak: 0.03});
  return (
    <AbsoluteFill>
      {/* 第一道闸卡（deny——1-A 同形放大驻位，硬拒绝门特写主角） */}
      <div style={{position: 'absolute', left: 300, top: 170}}>
        <GateCard x={0} y={0} w={220} h={200} kind="deny" lit={1} hitFlash={flash} />
      </div>
      {/* 黑名单表（自闸卡下方展开；七行 = 命令字面 + 白话对位小签） */}
      <div style={{...tableIn, position: 'absolute', left: 300, top: 400, transform: `${tableIn.transform} scale(${1 + tableShake})`, transformOrigin: '600px 100px'}}>
        <DenyListTable x={0} y={0} width={680} litRows={litRows} count={Math.min(7, Math.round(count))} hitFlash={flash} />
      </div>
      {/* 远处问人门图标（微缩暗置在位——弹开轨迹绕过它：不经过第三道） */}
      <div style={{position: 'absolute', left: 1580, top: 300, opacity: 0.55}}>
        <GateCard x={0} y={0} w={120} h={112} kind="ask" lit={0.5} ghost={0.3} showName={false} />
        <div style={{position: 'absolute', left: 10, top: 120, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>第三道 · 远</div>
      </div>
      {/* 命中命令卡：撞表被弹开（连被问的资格都没有——绕过问人门退场） */}
      <HitBounceCard atHit={atHit} flash={flash} />
      <Foot1>{'DENY_LIST · 命中即拦，谁都不问'}</Foot1>
    </AbsoluteFill>
  );
};

const DENY_LIT = [0, 1, 2, 3, 4, 5, 6] as const;

// ── 1-C 第二道门：规则双通道 + 命中流转 ─────────────────────────────────

const ShotC: React.FC<{atLane: number; atBox: number; atBounce: number; atTags: number; atTagLit: number; atFlow: number}> = ({
  atLane,
  atBox,
  atBounce,
  atTags,
  atTagLit,
  atFlow,
}) => {
  const frame = useCurrentFrame();
  const laneIn = useEnter('rise', {at: atLane, dur: DUR.f5, dist: 24, springPreset: 'settle'});
  const boxLit = useProgress(atBox, DUR.f5);
  const greenEdge = useProgress(atBox + DUR.f3, DUR.f3);
  const bounce = clamp01(progress(frame, atBounce, DUR.f5 + DUR.f4));
  const tagsShow = useProgress(atTags, DUR.f4);
  const tagLit = [0, 1, 2].map((i) => clamp01(progress(frame, atTagLit + i * 7, DUR.f3)));
  const flow = useProgress(atFlow, DUR.f5, 'decelerate');
  return (
    <AbsoluteFill>
      {/* 第二道闸卡（rule 边界蓝衬底——规则门特写主角） */}
      <div style={{position: 'absolute', left: 330, top: 150}}>
        <GateCard x={0} y={0} w={220} h={200} kind="rule" lit={1} />
      </div>
      {/* 规则双通道（上：文件工具路径越界检测；下：bash 关键词三标签） */}
      <div style={{...laneIn, position: 'absolute', left: 330, top: 390}}>
        <RuleLane x={0} y={0} w={920} lit={1} boxLit={boxLit} greenEdge={greenEdge} bounce={bounce} tagsShow={tagsShow} tagLit={tagLit} flow={flow} />
      </div>
      {/* 第三道门图标（流转线目的地——右侧在位） */}
      <div style={{position: 'absolute', left: 1450, top: 560}}>
        <GateCard x={0} y={0} w={150} h={140} kind="ask" lit={flow > 0.5 ? 1 : 0.5} showName={false} />
      </div>
      {/* 命中卡：打上标记沿流转线滑向第三道门 */}
      {flow > 0.02 && flow < 1 ? (
        <div style={{position: 'absolute', left: 900 + 480 * flow, top: 845 - 235 * flow, opacity: flow > 0.05 ? 1 : 0}}>
          <CallCard x={0} y={0} en="rm old-notes.txt" w={300} h={72} stampMark={Math.min(1, flow * 3)} />
        </div>
      ) : null}
      <Foot1>{'PERMISSION_RULES · 命中交第三道'}</Foot1>
    </AbsoluteFill>
  );
};

// ── 1-D 第三道门：问人终端 + 默认绿通路 ─────────────────────────────────

const ShotD: React.FC<{atTerm: number; atKeys: number; atPass: number; atGreen: number; atFlash: number}> = ({
  atTerm,
  atKeys,
  atPass,
  atGreen,
  atFlash,
}) => {
  const frame = useCurrentFrame();
  // 三闸卡列队缩驻上方（承 1-A 末态缩置——GateChain 同装置 0.5 档；dim≥0.35 保身份）
  const chainO = useProgress(0, DUR.f4);
  // 终端窗展开 + 警示逐行落定 + 光标呼吸悬停
  const termIn = useEnter('pop', {at: atTerm, dur: DUR.f5, springPreset: 'settle'});
  const printP = useProgress(atTerm + DUR.f3, DUR.f6);
  // 「是，或否」双键虚影各闪一次（先「是」后「否」——待击态，无回车）
  const keysLit = [
    clamp01(progress(frame, atKeys, DUR.f3)),
    clamp01(progress(frame, atKeys + 4, DUR.f3)),
  ];
  // 普通调用卡沿绿直通路绕三卡直行（参数化贝塞尔 u）
  const passU = useProgress(atPass, DUR.f6, 'linear');
  const greenO = useProgress(atGreen, DUR.f4);
  const greenPulse = useImpulse({at: atGreen, dur: DUR.f5, peak: 1});
  // 「极少数不商量」：第一道门卡（deny 位）短促加重一闪（P2 伏笔）
  const foreshadow = useImpulse({at: atFlash, dur: DUR.f4, peak: 1});
  const PATH = {
    p0: {x: 260, y: 840},
    c: {x: 960, y: 960},
    p2: {x: 1520, y: 760},
  };
  const bez = (u: number) => {
    const iu = 1 - u;
    return {
      x: iu * iu * PATH.p0.x + 2 * iu * u * PATH.c.x + u * u * PATH.p2.x,
      y: iu * iu * PATH.p0.y + 2 * iu * u * PATH.c.y + u * u * PATH.p2.y,
    };
  };
  return (
    <AbsoluteFill>
      {/* 三闸卡列队缩驻上方（1-A 末态同形缩置；问人卡点亮=终端所在） */}
      <div style={{opacity: chainO * 0.85}}>
        <GateChain
          x={620}
          y={120}
          cardW={150}
          cardH={140}
          spacing={210}
          lit={[0.9, 0.9, 1]}
          hit={[foreshadow, 0, 0]}
          dim={0.15}
          showNames
        />
      </div>
      {/* 问人终端窗（裁决紫描边——警示落定 + 光标呼吸等输入） */}
      <div style={{...termIn, position: 'absolute', left: 580, top: 330}}>
        <AskTerminal x={0} y={0} w={780} h={360} printP={printP} keysLit={keysLit} />
      </div>
      {/* 环体缩至侧后保持同形（M-001；执行段微光在位） */}
      <div style={{position: 'absolute', left: 1660, top: 620, opacity: 0.5}}>
        <LoopRing size={170} nodes={[0, 1, 2, 3, 4].map((i) => ({label: `s${i}`, angle: -90 + i * 72}))} showLabels={false} showExit={false} dimNodes />
      </div>
      {/* 确认绿直通路（1-D 唯一确认绿元素：三卡列队下方绕行直通执行段） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none', opacity: greenO}}>
        <path
          d={`M ${PATH.p0.x} ${PATH.p0.y} Q ${PATH.c.x} ${PATH.c.y}, ${PATH.p2.x} ${PATH.p2.y}`}
          fill="none"
          stroke={theme.ok}
          strokeWidth={4.5}
          strokeDasharray="13 11"
        />
        <path d={`M ${PATH.p2.x - 20} ${PATH.p2.y + 16} L ${PATH.p2.x + 4} ${PATH.p2.y - 6} L ${PATH.p2.x - 28} ${PATH.p2.y - 8} Z`} fill={theme.ok} />
        {/* 直通路绿灯（默认放行——末端 ok 圆点 + 脉冲） */}
        <circle cx={PATH.p2.x + 34} cy={PATH.p2.y - 26} r={13 + 10 * greenPulse} fill={theme.ok} opacity={0.9} />
        <circle cx={PATH.p2.x + 34} cy={PATH.p2.y - 26} r={26} fill="none" stroke={theme.ok} strokeWidth={3} opacity={0.5 * greenPulse} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: PATH.p2.x + 4,
          top: PATH.p2.y - 86,
          fontFamily: theme.sans,
          fontSize: 23,
          fontWeight: 600,
          color: theme.ok,
          opacity: greenO,
        }}
      >
        {'执行'}
      </div>
      {/* 普通调用卡（三道都没命中——走上绿直通路绕三卡直行） */}
      {passU > 0.02 && passU < 1 ? (
        <div style={{position: 'absolute', left: 0, top: 0}}>
          {(() => {
            const p = bez(passU);
            return (
              <div style={{position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)'}}>
                <CallCard x={0} y={0} en="ls ./docs" w={250} h={64} />
              </div>
            );
          })()}
        </div>
      ) : null}
      <Foot1>{'默认放行 · 例外才问 · 极少数不商量'}</Foot1>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P1ThreeGates: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p1-01', 'p1-02');
  const bB = w('p1-03', 'p1-05');
  const bC = w('p1-06', 'p1-07');
  const bD = w('p1-08', 'p1-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <ShotA
          atSlot={wa('p1-01', 0.48) - bA.from}
          atInsert={wa('p1-01', 0.72) - bA.from}
          atSpread={wa('p1-02', 0.18) - bA.from}
          atDeny={wa('p1-02', 0.34) - bA.from}
          atRule={wa('p1-02', 0.56) - bA.from}
          atAsk={wa('p1-02', 0.78) - bA.from}
          atStill={wa('p1-01', 0.2) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <ShotB
          atTable={wa('p1-03', 0.28) - bB.from}
          atCount={wa('p1-03', 0.62) - bB.from}
          atRows={wa('p1-04', 0.12) - bB.from}
          atHit={wa('p1-05', 0.3) - bB.from}
          atFlash={wa('p1-05', 0.3) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <ShotC
          atLane={wa('p1-06', 0.3) - bC.from}
          atBox={wa('p1-06', 0.55) - bC.from}
          atBounce={wa('p1-06', 0.78) - bC.from}
          atTags={wa('p1-06', 0.9) - bC.from}
          atTagLit={wa('p1-07', 0.3) - bC.from}
          atFlow={wa('p1-07', 0.72) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="1-D">
        <ShotD
          atTerm={wa('p1-08', 0.3) - bD.from}
          atKeys={wa('p1-08', 0.85) - bD.from}
          atPass={wa('p1-09', 0.25) - bD.from}
          atGreen={wa('p1-09', 0.6) - bD.from}
          atFlash={wa('p1-09', 0.9) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1ThreeGates;
