/** P3 写入要过门（p3-01..p3-12，4 镜）——分镜 3-A / 3-B / 3-C / 3-D。
 *
 *  叙事链：3-A 环体全景坐标锚〔M-001〕：环体居中（陶土橙恒定描边/线宽）、环上
 *  「回合结束」挂点位高亮（本集挂点语义——提取触发位）、「散在对话里」环内三枚
 *  偏好小签逐枚闪示、「没有工具调用」末条为纯文本条（调用块空缺——承系列语汇）、
 *  「告一段落」提取臂自挂点伸出待命 → 3-B 五道门特写：候选卡（缩进 · 制表符——
 *  承 2-B 同一输入值）自提取臂交至门前、「五道检查」五门暗态轮廓 stagger 显形
 *  （编号 1..5）→ 门①亮·候选放行过门①·「临时限制」小卡入闸被弹回 → 门②③
 *  连亮·字段槽逐格校验打勾（确认绿）→ 门④亮·「暂时」小卡入闸红杠压字拦下
 *  （一拍收）→ 门⑤亮·比对扫描线扫过库内既有行·无重复放行 → 3-C 左红右绿消融
 *  同屏（全片张力峰值）：左轨拆掉门控——嘱咐卡（引号句卡）浮现→没门落库→新会话
 *  小窗收到此条→「永久」红章盖下→「两轮提取」轮次格同步逐格点亮、「三条涨到五
 *  条」左轨 3→5 跳涨（数字定格 punch）、右轨稳在 3 且临时卡被弹回一拍→「混进去
 *  的」涨出条目翻转露出嘱咐卡面、「多存一份」同文并列 +1 标记 → 3-D 金句卡
 *  （衬线体）压底「记忆不怕多，怕脏」＋关键词重读压拍定格、「跟着错」脏条目向
 *  后续会话小窗泛错误涟漪一拍即收、镜尾「旧账」悬念签（问号 + 库体剪影）。
 *
 *  空间契约：环体居中唯一主体、挂点高亮为唯一橙增强位、末条调用块空缺可辨、
 *    五门等距一列、通关次序 = 口播讲授序（①→⑤）、候选卡同一输入值可追、被拦
 *    卡片不落库、红左绿右恒定、轮次/条数双口径与口播数字一致（两轮 · 3→5 ↔
 *    3 持平）、重复卡与原卡同文并列、金句卡为唯一主体（衬线体）、涟漪不扩散到
 *    右轨。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥176；extract_memories ·
 *  should_store_memory · scope: persistent 只进角标；五门一次全亮禁；左轨计数
 *  有轮次轨迹（非直跳 5）；章面文字不成句（「永久」仅二字章）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ChatWindow, CountRuler, GateArch, IndexPage, LoopRing, MemoryFileCard, MemoryVault, ringPt} from '../components/motifs';
import {DUR, clamp01, progress, useBreathe, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 3-A 环体全景：挂点高亮 + 环内偏好散布 + 提取臂待命 ────────────────────

/** 环体全景位（M-001 坐标锚）与挂点角（「回合结束」提取触发位） */
const RING_3A = {size: 480, cx: 960, cy: 560, hookAngle: -30} as const;

const ThreeA: React.FC<{atSigns: number; atHook: number; atNoTool: number; atArm: number}> = ({atSigns, atHook, atNoTool, atArm}) => {
  const frame = useCurrentFrame();
  const r = RING_3A.size / 2 - 46;
  const hook = ringPt(RING_3A.cx, RING_3A.cy, r, RING_3A.hookAngle);
  // 「散在对话里」三枚偏好小签逐枚闪示（环内消息条间）
  const signs = [0, 1, 2].map((i) => clamp01(progress(frame, atSigns + i * 8, DUR.f4)));
  // 「回合结束」挂点位脉冲高亮（唯一橙增强位）
  const hookOn = useProgress(atHook, DUR.f4);
  const hookPulse = useBreathe({period: 44, amp: 0.4, base: 0.6});
  // 「没有工具调用」末条纯文本条（调用块空缺——空缺即无调用）
  const noTool = useProgress(atNoTool, DUR.f4);
  // 「告一段落」提取臂自挂点伸出待命（不伸入库体）
  const arm = useProgress(atArm, 26, 'decelerate');
  const armX = hook.x + 150 * arm;
  const armY = hook.y - 110 * arm;
  const dot = ((frame / 80) % 1 + 1) % 1;
  // 环内缩微消息条（对话流——末条为纯文本 + 空调用块）
  const miniRows: readonly {y: number; w: number; last?: boolean}[] = [
    {y: -120, w: 300},
    {y: -70, w: 260},
    {y: -20, w: 320},
    {y: 30, w: 240},
    {y: 80, w: 280, last: true},
  ];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: RING_3A.cx - RING_3A.size / 2, top: RING_3A.cy - RING_3A.size / 2}}>
        <LoopRing size={RING_3A.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {/* 挂点位（回合结束——提取触发位；唯一橙增强） */}
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        <circle cx={hook.x} cy={hook.y} r={17 + 6 * hookPulse} fill={theme.core} opacity={hookOn * (0.75 + 0.25 * hookPulse)} />
        <circle cx={hook.x} cy={hook.y} r={30 + 10 * hookPulse} fill="none" stroke={theme.core} strokeWidth={3} opacity={hookOn * 0.5 * hookPulse} />
        {/* 提取臂（自挂点伸出——mech 折臂 + 端爪，待命态） */}
        <path
          d={`M ${hook.x} ${hook.y} L ${hook.x + 66 * arm} ${hook.y - 48 * arm} L ${armX} ${armY}`}
          fill="none"
          stroke={theme.mech}
          strokeWidth={6}
          strokeLinecap="round"
          opacity={arm}
        />
        {arm > 0.05 ? (
          <g opacity={arm} transform={`translate(${armX}, ${armY})`}>
            <path d="M -14 -4 L 0 -12 L 14 -4 L 0 4 Z" fill={theme.mech} />
            <path d={`M 0 4 L 0 ${14 + 6 * hookPulse}`} stroke={theme.mech} strokeWidth={4} strokeLinecap="round" />
          </g>
        ) : null}
      </svg>
      {/* 挂点签（回合结束——mech 点名的橙位注） */}
      {hookOn > 0.3 ? (
        <div style={{position: 'absolute', left: hook.x - 44, top: hook.y + 34, padding: '3px 12px', borderRadius: 7, border: `2.5px solid ${theme.core}`, background: theme.panel, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap', opacity: hookOn}}>
          {'回合结束'}
        </div>
      ) : null}
      {/* 环内对话流缩微（消息条若干 + 偏好小签散布） */}
      {miniRows.map((mr, i) => (
        <div
          key={`mr${i}`}
          style={{
            position: 'absolute',
            left: RING_3A.cx - mr.w / 2,
            top: RING_3A.cy + mr.y,
            width: mr.w,
            height: 36,
            borderRadius: 8,
            border: `2.5px solid ${mr.last && noTool > 0.3 ? withAlpha(theme.text, 0.6) : withAlpha(theme.panelBorder, 0.95)}`,
            background: withAlpha(theme.bg, 0.6),
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 10,
            gap: 8,
            opacity: 0.9,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 11, color: theme.dim}}>{mr.last ? '纯文本' : '消息'}</span>
          {/* 末条调用块空缺（承系列语汇——空缺即无调用） */}
          {mr.last ? (
            <span
              style={{
                marginLeft: 'auto',
                marginRight: 10,
                width: 74,
                height: 22,
                borderRadius: 5,
                border: `2px dashed ${noTool > 0.3 ? withAlpha(theme.dim, 0.85) : withAlpha(theme.panelBorder, 0.8)}`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 10,
                color: theme.dim,
                opacity: noTool,
              }}
            >
              {'调用块 空'}
            </span>
          ) : null}
        </div>
      ))}
      {/* 三枚偏好小签（散布消息条间——逐枚闪示；贴行右端落位，环内不越环） */}
      {['偏好', '教训', '来龙去脉'].map((t, i) => {
        const p = signs[i];
        if (p <= 0.02) {
          return null;
        }
        return (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: RING_3A.cx + (i === 2 ? 6 : 20),
              top: RING_3A.cy - 128 + i * 100,
              padding: '4px 13px',
              borderRadius: 8,
              border: `2.5px solid ${withAlpha(theme.mech, 0.5 + 0.4 * p)}`,
              background: withAlpha(theme.panel, 0.95),
              fontFamily: theme.sans,
              fontSize: 16,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: p,
            }}
          >
            {t}
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'extract_memories · 回合结束 · 无工具调用才提取'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 五道门逐关（候选位 → 门列 → 库门；通关次序 = 口播讲授序） ──────────

/** 门列几何（五门等距一列——候选自左入、库门在右；卡行程 160→1590） */
const GATE_ROW = {x0: 400, stride: 250, w: 190, h: 300, y: 400} as const;
const CAND_Y = 500;

const ThreeB: React.FC<{
  atCand: number;
  atGates: number;
  atG1: number;
  atPass1: number;
  atBounce1: number;
  atG23: number;
  atCheck: number;
  atG4: number;
  atTemp: number;
  atBlock: number;
  atG5: number;
  atScan: number;
}> = ({atCand, atGates, atG1, atPass1, atBounce1, atG23, atCheck, atG4, atTemp, atBlock, atG5, atScan}) => {
  const frame = useCurrentFrame();
  // 五门暗态轮廓 stagger 显形（编号 1..5——落位暗态先于门亮）
  const outlines = [0, 1, 2, 3, 4].map((i) => clamp01(progress(frame, atGates + i * 4, DUR.f4)));
  // 门亮（逐关点名）
  const g1 = useProgress(atG1, DUR.f4);
  const g23 = [clamp01(progress(frame, atG23, DUR.f4)), clamp01(progress(frame, atG23 + 5, DUR.f4))];
  const g4 = useProgress(atG4, DUR.f4);
  const g5 = useProgress(atG5, DUR.f4);
  // 候选卡行程：交至门前 → 过门① → ②③ → ⑤ → 库门（分段推进——同一输入值可追）
  const walk0 = clamp01(progress(frame, atCand, 24));
  const pass1 = clamp01(progress(frame, atPass1, 26));
  const pass23 = clamp01(progress(frame, atCheck + 6, 26));
  const pass5 = clamp01(progress(frame, atScan + 8, 30));
  const candX = 160 + walk0 * 120 + pass1 * 250 + pass23 * 500 + pass5 * 480;
  // 字段槽逐格校验打勾（确认绿——门②③查格式）
  const checks = [0, 1, 2].map((i) => clamp01(progress(frame, atCheck + i * 6, DUR.f4)));
  // 「临时限制」小卡入闸被弹回（轨迹：趋近门①口 → 弹回左）
  const bounce1 = clamp01(progress(frame, atBounce1, 26));
  const bounceX = 300 + Math.sin(Math.PI * bounce1) * 190;
  // 「暂时」小卡入闸 → 红杠压字拦下（一拍收）
  const tempIn = clamp01(progress(frame, atTemp, DUR.f5));
  const blockP = clamp01(progress(frame, atBlock, DUR.f4));
  const tempOut = clamp01(progress(frame, atBlock + 18, DUR.f4));
  // 门⑤比对扫描线（扫过库内既有行——无重复放行）
  const scan = clamp01(progress(frame, atScan, 24));
  const gateX = (i: number) => GATE_ROW.x0 + i * GATE_ROW.stride;
  return (
    <AbsoluteFill>
      {/* 提取臂残位（左缘——候选自提取臂交至门前的来路锚） */}
      <svg width={120} height={80} viewBox="0 0 120 80" style={{position: 'absolute', left: 60, top: 420, overflow: 'visible', opacity: 0.7}}>
        <path d="M 10 70 L 46 44 L 96 20" fill="none" stroke={theme.mech} strokeWidth={5} strokeLinecap="round" />
        <path d="M -14 -4 L 0 -12 L 14 -4 L 0 4 Z" fill={theme.mech} transform="translate(96,20)" />
      </svg>
      {/* 五道门（等距一列——暗态轮廓 → 逐关点亮） */}
      {[0, 1, 2, 3, 4].map((i) => (
        <GateArch
          key={`gate${i}`}
          x={gateX(i)}
          y={GATE_ROW.y}
          w={GATE_ROW.w}
          h={GATE_ROW.h}
          i={i}
          outlineP={outlines[i]}
          litP={i === 0 ? g1 : i === 1 ? g23[0] : i === 2 ? g23[1] : i === 3 ? g4 : g5}
          passP={i === 0 ? Math.sin(Math.PI * pass1) : i === 1 || i === 2 ? Math.sin(Math.PI * pass23) : i === 4 ? Math.sin(Math.PI * pass5) : 0}
          bounceP={i === 0 ? Math.sin(Math.PI * bounce1) : 0}
          blockP={i === 3 ? blockP * (1 - tempOut) : 0}
        />
      ))}
      {/* 库门（右端——MemoryVault 缩微 + 内里既有行） */}
      <div style={{position: 'absolute', left: 1660, top: 420}}>
        <MemoryVault x={0} y={0} w={220} h={170} scale={1} doorP={0.4} ghostP={1} slotsLit={3} label={'.memory/'} />
        {/* 比对扫描线（门⑤——扫过库内既有行） */}
        {scan > 0.02 && scan < 0.98 ? (
          <div style={{position: 'absolute', left: 6, top: 20 + scan * 130, width: 208, height: 8, background: withAlpha(theme.mech, 0.55), borderRadius: 4}} />
        ) : null}
      </div>
      {/* 候选卡（缩进 · 制表符——承 2-B 同一输入值；字段槽逐格打勾） */}
      <div style={{position: 'absolute', left: candX, top: CAND_Y, opacity: clamp01(walk0 * 2)}}>
        <div style={{position: 'relative'}}>
          <MemoryFileCard x={0} y={0} w={190} h={150} sign={'缩进 · 制表符'} signLit={1} fieldsLit={3} scale={0.9} />
          {/* 三槽校验勾（确认绿——门②③） */}
          {checks.map((c, i) => {
            if (c <= 0.05) {
              return null;
            }
            return (
              <svg key={`ck${i}`} width={22} height={22} viewBox="0 0 22 22" style={{position: 'absolute', right: -26, top: 44 + i * 34, overflow: 'visible', opacity: c}}>
                <path d="M 4 12 L 9 17 L 18 5" fill="none" stroke={theme.ok} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            );
          })}
        </div>
      </div>
      {/* 「临时限制」小卡（入闸被弹回——轨迹左出） */}
      {bounce1 > 0.02 && bounce1 < 0.98 ? (
        <div
          style={{
            position: 'absolute',
            left: bounceX,
            top: CAND_Y + 190,
            padding: '5px 14px',
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(theme.danger, 0.85)}`,
            background: withAlpha(theme.panel, 0.95),
            fontFamily: theme.sans,
            fontSize: 15,
            fontWeight: 700,
            color: theme.danger,
            whiteSpace: 'nowrap',
            opacity: Math.sin(Math.PI * bounce1),
          }}
        >
          {'临时限制'}
        </div>
      ) : null}
      {/* 「暂时」小卡（入闸 → 红杠压字拦下 → 一拍收） */}
      {tempIn > 0.02 && tempOut < 0.98 ? (
        <div
          style={{
            position: 'relative',
            left: gateX(3) + 20,
            top: CAND_Y + 190,
            padding: '5px 14px',
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(theme.mech, 0.8)}`,
            background: withAlpha(theme.panel, 0.95),
            fontFamily: theme.sans,
            fontSize: 15,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: clamp01(tempIn) * (1 - tempOut),
          }}
        >
          {'「暂时」字眼'}
          {blockP > 0.05 ? (
            <div style={{position: 'absolute', left: -6, right: -6, top: '50%', height: 5, background: theme.danger, borderRadius: 3, opacity: blockP}} />
          ) : null}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'should_store_memory · scope: persistent · ①范围 ②类型 ③字段 ④临时话 ⑤比对'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 左红右绿消融（全片张力峰值——双口径计数带对齐） ────────────────────

/** 消融双轨几何（红左绿右等高） */
const AB = {ly: 170, lx: 90, rx: 970, w: 860, h: 660} as const;

const ThreeC: React.FC<{
  atCard: number;
  atNoGate: number;
  atDrop: number;
  atNextWin: number;
  atSeal: number;
  atRounds: number;
  atJump: number;
  atMixed: number;
  atDup: number;
}> = ({atCard, atNoGate, atDrop, atNextWin, atSeal, atRounds, atJump, atMixed, atDup}) => {
  const frame = useCurrentFrame();
  // 嘱咐卡（引号句卡——左轨唯一浮起物）
  const cardP = useProgress(atCard, DUR.f5);
  // 「没门」门位空框打叉
  const noGate = useProgress(atNoGate, DUR.f4);
  // 「落库」嘱咐卡长驱直入（自浮起位飞入库装置）
  const drop = useProgress(atDrop, 24, 'accelerate');
  // 「下个会话」新会话小窗开启收到此条
  const nextWin = useProgress(atNextWin, DUR.f4);
  // 「永久规矩」红章盖下（句末收拍——章面仅「永久」二字）
  const seal = useProgress(atSeal, DUR.f4, 'accelerate');
  const sealFlash = useImpulse({at: atSeal + DUR.f3, dur: DUR.f5, peak: 1});
  // 「两轮提取」轮次格同步逐格点亮（左右同两轮）
  const rounds = [clamp01(progress(frame, atRounds, DUR.f4)), clamp01(progress(frame, atRounds + 16, DUR.f4))];
  const roundsLit = rounds[0] + rounds[1];
  // 「三条涨到五条」左轨计数 3→4→5（轮次轨迹两跳——非直跳 5；数字定格 punch）
  const jump1 = clamp01(progress(frame, atRounds + 10, DUR.f4));
  const jump2 = clamp01(progress(frame, atJump, DUR.f4));
  const leftCount = 3 + jump1 + jump2;
  const punch = useImpulse({at: atJump, dur: DUR.f6, peak: 1});
  // 右轨同窗：计数稳在 3 + 临时卡被弹回一拍
  const bounceR = Math.sin(Math.PI * clamp01(progress(frame, atJump, 24)));
  // 「混进去的」涨出条目翻转露出嘱咐卡面（盖永久章者）
  const mixed = useProgress(atMixed, DUR.f5);
  // 「多存一份」同文并列 +1 标记
  const dupP = useProgress(atDup, DUR.f4);
  // 库内行阵（左轨——涨出条翻转 + 同文并列；右轨稳态 3 条）
  const leftRows = 5;
  return (
    <AbsoluteFill>
      {/* ── 左轨·拆掉门控（警示红） ── */}
      <div style={{position: 'absolute', left: AB.lx, top: AB.ly, width: AB.w, height: AB.h, boxSizing: 'border-box', borderRadius: 16, border: `3.5px solid ${withAlpha(theme.danger, 0.55)}`, background: withAlpha(theme.panel, 0.92), padding: '14px 18px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.danger}}>{'拆掉门控'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'没门 · 全收'}</span>
        </div>
        {/* 门位空框打叉（三枚空框——门不在位） */}
        <div style={{display: 'flex', gap: 14, marginTop: 10, opacity: noGate}}>
          {[0, 1, 2].map((k) => (
            <svg key={`ng${k}`} width={74} height={70} viewBox="0 0 74 70">
              <path d="M 14 66 L 14 30 A 23 22 0 0 1 60 30 L 60 66" fill="none" stroke={withAlpha(theme.danger, 0.55)} strokeWidth={3.5} strokeDasharray="5 5" />
              <line x1={16} y1={10} x2={58} y2={60} stroke={theme.danger} strokeWidth={4} strokeLinecap="round" />
            </svg>
          ))}
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.danger, marginLeft: 8, alignSelf: 'center'}}>{'门 ✗'}</span>
        </div>
        {/* 库装置 + 索引页缩微（渲染顺序在面板之后——不被面板底色盖住） */}
        <div style={{position: 'relative', height: 250, marginTop: 6}}>
          <MemoryVault x={30} y={10} w={330} h={180} scale={0.92} ghostP={1} slotsLit={leftRows} doorP={0.55} label={'.memory/'} />
          <IndexPage x={390} y={6} w={330} h={190} scale={0.92} rowsLit={6} dim={0.25} />
          {/* 落库中的嘱咐卡（索引页下方浮起 → 左移入库口；落定后常驻库内） */}
          {cardP > 0.02 ? (
            <div
              style={{
                position: 'absolute',
                left: 390 - 270 * drop,
                top: 380 - 170 * cardP - 60 * drop,
                padding: '7px 16px',
                borderRadius: 9,
                border: `3px solid ${theme.danger}`,
                background: theme.panel,
                fontFamily: theme.serif,
                fontSize: 17,
                fontWeight: 700,
                color: theme.text,
                whiteSpace: 'nowrap',
                opacity: clamp01(cardP * 2),
                boxShadow: `0 0 ${16 * sealFlash}px ${withAlpha(theme.danger, 0.5)}`,
              }}
            >
              {'「这次先别建新文件。」'}
              {/* 「永久」红章（盖下——仅二字章面） */}
              {seal > 0.02 ? (
                <span
                  style={{
                    position: 'absolute',
                    right: -30,
                    top: -26,
                    padding: '2px 10px',
                    borderRadius: 7,
                    border: `3px solid ${theme.danger}`,
                    background: withAlpha(theme.danger, 0.12),
                    fontFamily: theme.serif,
                    fontSize: 19,
                    fontWeight: 700,
                    color: theme.danger,
                    letterSpacing: 3,
                    whiteSpace: 'nowrap',
                    opacity: seal,
                    transform: `rotate(-10deg) scale(${0.7 + 0.3 * seal})`,
                  }}
                >
                  {'永久'}
                </span>
              ) : null}
            </div>
          ) : null}
          {/* 涨出条目翻转（p3-10——露出嘱咐卡面：盖永久章者；半程翻面 scaleX） */}
          {mixed > 0.02 ? (
            <div style={{position: 'absolute', left: 60, top: 34, opacity: mixed, transform: `scaleX(${Math.max(0.06, Math.abs(1 - 2 * Math.min(mixed * 2, 1)))})`, transformOrigin: 'left center'}}>
              <div style={{padding: '4px 12px', borderRadius: 7, border: `2.5px solid ${withAlpha(theme.danger, 0.8)}`, background: theme.panel, fontFamily: theme.sans, fontSize: 13, color: theme.danger, whiteSpace: 'nowrap'}}>
                {'嘱咐 · 已成条目'}
              </div>
            </div>
          ) : null}
          {/* 同文并列 +1（重复的具象——同一句偏好多存一份） */}
          {dupP > 0.02 ? (
            <div style={{position: 'absolute', left: 250, top: 96, opacity: dupP, transform: `translateX(${(1 - dupP) * -22}px)`}}>
              <div style={{padding: '4px 12px', borderRadius: 7, border: `2.5px solid ${withAlpha(theme.danger, 0.8)}`, background: theme.panel, fontFamily: theme.sans, fontSize: 13, color: theme.danger, whiteSpace: 'nowrap', position: 'relative'}}>
                {'缩进 · 制表符'}
                <span style={{position: 'absolute', right: -34, top: -14, fontFamily: theme.mono, fontSize: 15, fontWeight: 700, color: theme.danger}}>{'+1'}</span>
              </div>
              <div style={{padding: '4px 12px', borderRadius: 7, border: `2.5px dashed ${withAlpha(theme.dim, 0.7)}`, marginTop: 6, fontFamily: theme.sans, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>
                {'缩进 · 制表符（既有）'}
              </div>
            </div>
          ) : null}
        </div>
        {/* 新会话小窗（开启收到此条——永久规矩进了下个会话） */}
        {nextWin > 0.02 ? (
          <div style={{position: 'absolute', left: 560, top: 250, opacity: nextWin, transform: `translateY(${(1 - nextWin) * 18}px)`}}>
            <ChatWindow x={0} y={0} w={260} h={190} scale={0.9} rows={['…', '嘱咐生效']} rowsLit={2} header={'下个会话'} />
          </div>
        ) : null}
        {/* 双口径计数带（左轨：轮次 ×2 + 条数 3→5 跳涨；数字定格 punch） */}
        <CountRuler
          x={20}
          y={494}
          w={520}
          cells={8}
          cellsLit={leftCount}
          rounds={2}
          roundsLit={roundsLit}
          readout={`${leftCount.toFixed(0)} 条`}
          readoutLit={1}
          readoutFlash={punch}
          label={'两轮提取 · 库从三条涨到五条'}
          accent={theme.danger}
        />
      </div>
      {/* ── 右轨·门控在位（确认绿） ── */}
      <div style={{position: 'absolute', left: AB.rx, top: AB.ly, width: AB.w, height: AB.h, boxSizing: 'border-box', borderRadius: 16, border: `3.5px solid ${withAlpha(theme.ok, 0.55)}`, background: withAlpha(theme.panel, 0.92), padding: '14px 18px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.ok}}>{'门控在位'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'五门 · 拦下临时'}</span>
        </div>
        {/* 五门缩微在位（等距实线——门在位） */}
        <div style={{display: 'flex', gap: 10, marginTop: 12}}>
          {[0, 1, 2, 3, 4].map((i) => (
            <GateArch key={`rg${i}`} x={i * 150} y={0} w={132} h={170} i={i} outlineP={1} litP={1} scale={1} />
          ))}
        </div>
        {/* 临时卡弹回一拍（被门④拦下——右轨的胜点） */}
        {bounceR > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: 430 - 180 * bounceR,
              top: 214,
              padding: '4px 13px',
              borderRadius: 8,
              border: `2.5px solid ${withAlpha(theme.danger, 0.8)}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 14,
              color: theme.danger,
              whiteSpace: 'nowrap',
              opacity: bounceR,
            }}
          >
            {'临时卡 · 弹回'}
          </div>
        ) : null}
        {/* 库 + 索引缩微（拒收不闪——同窗对照） */}
        <div style={{position: 'relative', height: 220, marginTop: 14}}>
          <MemoryVault x={40} y={6} w={330} h={180} scale={0.92} ghostP={1} slotsLit={3} doorP={0.5} label={'.memory/'} />
          <IndexPage x={420} y={6} w={330} h={190} scale={0.92} rowsLit={6} dim={0.25} />
        </div>
        {/* 双口径计数带（右轨：轮次同 2 · 条数稳在 3） */}
        <CountRuler x={20} y={494} w={520} cells={8} cellsLit={3} rounds={2} roundsLit={roundsLit} readout={'3 条'} readoutLit={1} label={'同两轮 · 条数稳在 3（临时被拦）'} accent={theme.ok} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'should_store_memory · 两轮 · 3→5 ↔ 3 持平'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-D 金句卡压底 + 脏条目涟漪 + 旧账悬念签 ──────────────────────────────

const ThreeD: React.FC<{atCard: number; atK1: number; atK2: number; atRipple: number; atQ: number}> = ({atCard, atK1, atK2, atRipple, atQ}) => {
  const frame = useCurrentFrame();
  // 金句卡淡入（衬线体卡先入）
  const card = useProgress(atCard, DUR.f6);
  // 「不怕多」多·重读压拍 /「怕脏」脏·重读压拍＋定格
  const k1 = useImpulse({at: atK1, dur: DUR.f6, peak: 0.06});
  const k2 = useImpulse({at: atK2, dur: DUR.f6, peak: 0.06});
  const k1Glow = useProgress(atK1, DUR.f5);
  const k2Glow = useProgress(atK2, DUR.f5);
  // 「跟着错」脏条目向后续会话小窗泛错误涟漪（一拍即收——不扩散到右轨）
  const ripple = clamp01(progress(frame, atRipple, 30));
  // 「旧账」悬念签（问号 + 库体剪影）
  const q = useProgress(atQ, DUR.f5);
  const dirtyGlow = useBreathe({period: 50, amp: 0.35, base: 0.5});
  return (
    <AbsoluteFill>
      {/* 背景消融双轨退为暗层（左轨脏条目微光示警） */}
      <div style={{position: 'absolute', left: 240, top: 620, opacity: 0.32}}>
        <div style={{display: 'flex', gap: 60}}>
          <div style={{position: 'relative'}}>
            <div style={{fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.danger, marginBottom: 6}}>{'左轨 · 脏条目'}</div>
            <div style={{width: 300, height: 64, borderRadius: 9, border: `2.5px solid ${withAlpha(theme.danger, 0.5)}`, background: theme.panel, boxShadow: `0 0 ${14 * dirtyGlow}px ${withAlpha(theme.danger, 0.4 * dirtyGlow)}`}} />
            {/* 错误涟漪（向一排后续会话小窗——sin 包络一拍即收） */}
            {ripple > 0.02 && ripple < 0.98 ? (
              [0, 1, 2].map((k) => {
                const w = clamp01(ripple * 3 - k);
                return (
                  <svg key={`rp${k}`} width={120} height={60} viewBox="0 0 120 60" style={{position: 'absolute', left: 300 + k * 130, top: 10, overflow: 'visible', opacity: Math.sin(Math.PI * w) * 0.8}}>
                    <path d="M 4 30 C 40 8, 80 52, 116 30" fill="none" stroke={theme.danger} strokeWidth={3} strokeDasharray="7 6" />
                  </svg>
                );
              })
            ) : null}
            {/* 后续会话小窗一排（跟着错的对象） */}
            {[0, 1, 2].map((k) => (
              <div key={`sw${k}`} style={{position: 'absolute', left: 430 + k * 130, top: 22, width: 96, height: 60, borderRadius: 8, border: `2px solid ${withAlpha(theme.danger, 0.45)}`, opacity: 0.55}} />
            ))}
          </div>
          <div>
            <div style={{fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.ok, marginBottom: 6}}>{'右轨 · 无错'}</div>
            <div style={{width: 300, height: 64, borderRadius: 9, border: `2.5px solid ${withAlpha(theme.ok, 0.4)}`, background: theme.panel}} />
          </div>
        </div>
      </div>
      {/* 金句卡（衬线体——caption-dup-ok: 金句卡刻意复述（收束定格仪式，承 ep1/ep2 5-A 豁免先例）） */}
      <div
        style={{
          position: 'absolute',
          left: 460,
          top: 300,
          opacity: clamp01(card),
          transform: `translateY(${(1 - clamp01(card)) * 26}px)`,
          zIndex: 3,
        }}
      >
        <div style={{padding: '40px 76px', borderRadius: 18, border: `3.5px solid ${withAlpha(theme.mech, 0.75)}`, background: withAlpha(theme.panel, 0.98), boxShadow: `0 0 ${40 * clamp01(card)}px ${withAlpha(theme.mech, 0.25)}`}}>
          <div style={{fontFamily: theme.serif, fontSize: 72, fontWeight: 700, color: theme.text, letterSpacing: 6, whiteSpace: 'nowrap'}}>
            <span>{'记忆不怕'}</span>
            <span style={{display: 'inline-block', transform: `scale(${1 + k1})`, color: theme.mech, textShadow: k1Glow > 0.01 ? `0 0 ${26 * k1Glow}px ${withAlpha(theme.mech, 0.6)}` : 'none'}}>{'多'}</span>
            <span>{'，怕'}</span>
            <span style={{display: 'inline-block', transform: `scale(${1 + k2})`, color: theme.danger, textShadow: k2Glow > 0.01 ? `0 0 ${26 * k2Glow}px ${withAlpha(theme.danger, 0.6)}` : 'none'}}>{'脏'}</span>
          </div>
        </div>
      </div>
      {/* 旧账悬念签（问号 + 库体剪影——升起；作答落在 P4） */}
      {q > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 880,
            top: 560 - 60 * q,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            opacity: q,
            transform: `translateY(${(1 - q) * 24}px)`,
          }}
        >
          <span style={{fontFamily: theme.serif, fontSize: 58, fontWeight: 700, color: theme.mech}}>{'？'}</span>
          {/* 库体剪影（暗态轮廓——旧账住址） */}
          <svg width={120} height={80} viewBox="0 0 120 80">
            <rect x={10} y={14} width={84} height={58} rx={7} fill="none" stroke={withAlpha(theme.mech, 0.75)} strokeWidth={3.5} />
            <polygon points="10,14 26,4 110,4 94,14" fill="none" stroke={withAlpha(theme.mech, 0.6)} strokeWidth={3} />
            <line x1={52} y1={14} x2={52} y2={72} stroke={withAlpha(theme.mech, 0.6)} strokeWidth={2.5} />
          </svg>
          <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'旧账'}</span>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'脏一条 · 往后每个会话跟着错'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P3WriteGates: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p3-01', 'p3-02');
  const bB = w('p3-03', 'p3-06');
  const bC = w('p3-07', 'p3-10');
  const bD = w('p3-11', 'p3-12');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ThreeA
          atSigns={wa('p3-01', 0.32) - bA.from}
          atHook={wa('p3-02', 0.14) - bA.from}
          atNoTool={wa('p3-02', 0.42) - bA.from}
          atArm={wa('p3-02', 0.74) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ThreeB
          atCand={wa('p3-03', 0.12) - bB.from}
          atGates={wa('p3-03', 0.48) - bB.from}
          atG1={wa('p3-04', 0.12) - bB.from}
          atPass1={wa('p3-04', 0.42) - bB.from}
          atBounce1={wa('p3-04', 0.76) - bB.from}
          atG23={wa('p3-05', 0.28) - bB.from}
          atCheck={wa('p3-05', 0.58) - bB.from}
          atG4={wa('p3-06', 0.1) - bB.from}
          atTemp={wa('p3-06', 0.3) - bB.from}
          atBlock={wa('p3-06', 0.46) - bB.from}
          atG5={wa('p3-06', 0.62) - bB.from}
          atScan={wa('p3-06', 0.8) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ThreeC
          atCard={wa('p3-07', 0.56) - bC.from}
          atNoGate={wa('p3-08', 0.14) - bC.from}
          atDrop={wa('p3-08', 0.4) - bC.from}
          atNextWin={wa('p3-08', 0.62) - bC.from}
          atSeal={wa('p3-08', 0.88) - bC.from}
          atRounds={wa('p3-09', 0.2) - bC.from}
          atJump={wa('p3-09', 0.56) - bC.from}
          atMixed={wa('p3-10', 0.22) - bC.from}
          atDup={wa('p3-10', 0.6) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="3-D">
        <ThreeD
          atCard={wa('p3-11', 0.1) - bD.from}
          atK1={wa('p3-11', 0.36) - bD.from}
          atK2={wa('p3-11', 0.6) - bD.from}
          atRipple={wa('p3-11', 0.85) - bD.from}
          atQ={wa('p3-12', 0.4) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3WriteGates;
