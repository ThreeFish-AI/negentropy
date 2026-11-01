/** P4 入口与真实版（p4-01..p4-10，4 镜）——分镜 4-A / 4-B / 4-C / 4-D。
 *
 *  幕间转场（3-D→4-A，头注明示）：三道检查裁决 → 读信入口坑属换层断裂，
 *  走幕界 SceneFade + 全景重锚（非 morph，承 ep2 3-C→4-A / ep15 形态）；
 *  位置呼应：3-D 末帧暗窗收件箱剪影 = 4-A 首帧收件箱特写位；环/表/箱同款
 *  签名跨镜恒常。
 *
 *  叙事链：4-A 开帧编队全局一拍（主环+甲环+收件箱+登记表全局关系）→ 推近
 *  收件箱特写：p4-01「取走就没了」词落位一封信被取走即消失（读即消费承前集
 *  一笔——信位清空闪灰）→ p4-02「各读各的」词落位两条读者箭头（查信工具 /
 *  循环本身）竞速伸向箱口、「先读的拿走回复」词落位工具箭头抱走回复、循环
 *  箭头抓空（扑空红闪）、「账，一笔没销」词落位迷你表行卡「待处理」定格 →
 *  p4-03「永远销不了」「箱子空了」两词落位表行持续定格、箱面计数翻 0 整箱
 *  暗掉（E3 实测退化值，重音镜）→ 4-B 解法揭示（单句镜）：p4-04「读即消费，
 *  单点入口」词落位闸门自箱口收敛成形、「先销账」词落位兰紫段演示（4-A 卡死
 *  的实验单在此对号翻绿闭环）、「交给对话」词落位靛蓝段信流入环、环体「轮末
 *  查信」挂点段点亮（重音镜——P4 记忆点：环与协议的挂接，自此镜起全片锁定）
 *  → 4-C 拉远真实版全景（@pushIn 负增量降压）：p4-05 设问句阵列空网格先立
 *  一拍 → p4-06「协议消息」词落位十五枚卡片 stagger 填格、「一共十五种」词
 *  落位计数角标定格 → p4-07「三向的」词落位时序带点亮（请求 → 批准绿 / 拒绝
 *  红·附理由 → 系统通知 → 清场扫尾）→ 4-D 闸门对照：p4-08「没有执行闸门」
 *  词落位左版两操作无阻直行、「靠自觉」词落位签面轻晃 → p4-09「补了闸」词
 *  落位右版闸门落下（重音镜）、「直接被挡回」词落位未批准操作撞闸弹回、
 *  「旧批文作废」词落位新任务签贴上旧批文签划掉 → p4-10「两边还在争」词落位
 *  争议签横贯底部定格（两锚点不判高下）、「用一条原则收账」词落位收起让位 P5。
 *
 *  空间契约：两条读者箭头同构等大、先到后到次序分明、实验单「待处理」定格
 *  可读、箱内禁残留；闸门两段次序 = 口播次序、兰紫/靛蓝分段与全片语义色一致、
 *  环体高亮段自此镜起全片锁定；阵列 15 枚可数（5×3 网格）、高亮两枚为本集
 *  正源类型、时序带节点不超四个；左右通道同构等高（有无闸门是唯一差异）、
 *  弹回有轨迹、争议签两锚点不判高下（X-001——开放争议）。
 *  红线落实：两箭头禁同时得信（竞态语义）、迷你表行状态禁自行翻转（没人
 *  销账）、信禁跳过销账段直达对话段、环体其余段禁参与高亮、卡片文字禁成句、
 *  阵列计数禁与口播不符、左版禁渲染为崩溃态（教学版是自认无闸非事故）、争议
 *  签禁给出裁决；词落位 = wa(id,f)；y≥56 / bottom≥176。
 *
 *  承接登记：4-D→5-A SceneFade（生产对照→收束定格属语义断裂）；环体以
 *  〔M-001〕同形签名回归（镜间身份恒常，非 morph——承 ep2/ep15 4-D→5-A）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {HookArc, LoopRing, MailboxFile, NumberBadge, RegistryTable, TeammateRing, useRingDot} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 4-A 收件箱特写：读即消费 → 双读者竞速（先到抱走 / 扑空红闪）→ 空箱 ──────

const BOX_4A = {x: 760, y: 280, w: 400, h: 330} as const;
const TOOLCARD_4A = {x: 1500, y: 300} as const;
const MINIROW_4A = {x: 750, y: 720} as const;

/** 读者箭头（自主体侧伸向箱口——`reach` 描线比例；`tone` 主体色；端点信/红闪） */
const ReaderArrow: React.FC<{x1: number; y1: number; x2: number; y2: number; reach: number; tone: string}> = ({x1, y1, x2, y2, reach, tone}) => {
  const hx = x1 + (x2 - x1) * reach;
  const hy = y1 + (y2 - y1) * reach;
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <line x1={x1} y1={y1} x2={hx} y2={hy} stroke={withAlpha(tone, 0.9)} strokeWidth={5} strokeLinecap="round" />
      {reach > 0.9 ? (
        <path d={`M ${hx - 18} ${hy - 12} L ${hx} ${hy} L ${hx - 12} ${hy + 18}`} fill="none" stroke={tone} strokeWidth={5} strokeLinecap="round" />
      ) : null}
    </svg>
  );
};

const FourA: React.FC<{atTake: number; atRace: number; atGrab: number; atMiss: number; atStuck: number; atZero: number}> = ({
  atTake,
  atRace,
  atGrab,
  atMiss,
  atStuck,
  atZero,
}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 开帧编队全局一拍（主环左缩 + 甲环右缩 + 表微——推近前 12 帧退暗让位）
  const wide = 1 - clamp01(progress(frame, 12, 14));
  // 一封信被取走即消失（p4-01「取走就没了」——信位清空闪灰）
  const take = clamp01(progress(frame, atTake, 14));
  const takeFlash = Math.sin(Math.PI * clamp01(progress(frame, atTake, 22)));
  // 两箭头竞速（p4-02「各读各的」——工具箭头先到、循环箭头慢一步；次序分明）
  const toolReach = clamp01(progress(frame, atRace, 20));
  const loopReach = clamp01(progress(frame, atRace + 4, 30));
  // 先到的工具箭头抱走回复（p4-02「先读的拿走回复」——信随箭头退回）
  const grab = clamp01(progress(frame, atGrab, 18));
  // 慢一步的循环箭头抓空（扑空红闪 ≤0.5s）
  const miss = Math.sin(Math.PI * clamp01(progress(frame, atMiss, 16)));
  // 迷你表行卡「待处理」定格（E3 实验单——没人销账）
  const stuck = clamp01(progress(frame, atStuck, DUR.f4));
  // 箱面计数翻 0、整箱暗掉（p4-03「箱子空了」——重音镜）
  const zero = clamp01(progress(frame, atZero, 16));
  const zeroSink = Math.sin(Math.PI * clamp01(progress(frame, atZero, 30)));
  const boxTop = BOX_4A.y + 20;
  const boxCx = BOX_4A.x + BOX_4A.w / 2;
  return (
    <AbsoluteFill>
      {/* 开帧编队全局一拍（缩微——主环/甲环/表全局关系；推近即退暗） */}
      <div style={{position: 'absolute', left: 300, top: 120, opacity: wide * 0.7}}>
        <LoopRing size={190} nodes={[]} showExit={false} showLabels={false} dotProgress={dot} />
      </div>
      <div style={{position: 'absolute', left: 1430, top: 120, opacity: wide * 0.7}}>
        <TeammateRing size={190} dotProgress={(dot + 0.4) % 1} />
      </div>
      <div style={{position: 'absolute', left: 740, top: 130, opacity: wide * 0.8}}>
        <RegistryTable x={0} y={0} w={440} micro rows={[{key: 'e3', badge: undefined, type: '关机', to: '队友甲', state: 'pending'}]} />
      </div>
      {/* 主环（循环本身——左侧读者起点） */}
      <div style={{position: 'absolute', left: 200, top: 360, opacity: 1 - wide * 0.3}}>
        <LoopRing size={300} nodes={[]} showExit={false} dotProgress={dot} />
        <div style={{position: 'absolute', left: 44, top: 306, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap'}}>
          循环本身
        </div>
      </div>
      {/* 查信工具卡（右侧读者起点） */}
      <div
        style={{
          position: 'absolute',
          left: TOOLCARD_4A.x,
          top: TOOLCARD_4A.y,
          width: 300,
          borderRadius: 12,
          border: `3px solid ${withAlpha(theme.tool, 0.8)}`,
          background: withAlpha(theme.panel, 0.97),
          padding: '14px 20px',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.text}}>查信工具</span>
        <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.tool, marginLeft: 10}}>{'check_inbox'}</span>
      </div>
      {/* 收件箱特写（箱口一只信位——被取走即消失；E3 末整箱暗掉） */}
      <div style={{position: 'absolute', left: BOX_4A.x, top: BOX_4A.y, opacity: 1 - 0.6 * zero}}>
        <MailboxFile x={0} y={0} w={BOX_4A.w} h={BOX_4A.h} name="teammate-a.jsonl" litP={1} rows={take > 0.5 ? 0 : 1} count={zero > 0.5 || take > 0.5 ? 0 : 1} glowP={takeFlash * 0.6} />
        {/* 箱口信（取走前在场——take 起被取走离箱淡出） */}
        {take > 0.02 && take < 0.9 ? (
          <div
            style={{
              position: 'absolute',
              left: BOX_4A.w / 2 - 46,
              top: -58 - take * 90,
              width: 92,
              height: 58,
              borderRadius: 8,
              border: `3px solid ${withAlpha(theme.inbox, 0.9)}`,
              background: withAlpha(theme.panel, 0.98),
              opacity: 1 - take,
            }}
          >
            <svg width={92} height={58} viewBox="0 0 92 58">
              <path d="M8 12 L46 34 L84 12" fill="none" stroke={theme.inbox} strokeWidth={2.5} />
            </svg>
          </div>
        ) : null}
        {/* 空箱读出（E3 退化——翻 0 红读数 + 整箱暗掉的重音拍） */}
        {zero > 0.4 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: BOX_4A.h / 2 - 18,
              textAlign: 'center',
              fontFamily: theme.mono,
              fontSize: 26,
              fontWeight: 700,
              color: theme.danger,
              whiteSpace: 'nowrap',
              opacity: zero * (0.7 + 0.3 * zeroSink),
            }}
          >
            0 条 · 空
          </div>
        ) : null}
      </div>
      {/* 两条读者箭头（同构等大——先到=查信工具，后到=循环本身） */}
      <ReaderArrow x1={TOOLCARD_4A.x - 10} y1={TOOLCARD_4A.y + 60} x2={BOX_4A.x + BOX_4A.w + 16} y2={boxTop + 60} reach={toolReach} tone={theme.tool} />
      <ReaderArrow x1={508} y1={500} x2={BOX_4A.x - 16} y2={boxTop + 120} reach={loopReach} tone={theme.core} />
      {/* 先到者抱走的回复（随工具箭头退回——被读走有轨迹） */}
      {grab > 0.1 && grab < 0.95 ? (
        <div
          style={{
            position: 'absolute',
            left: BOX_4A.x + BOX_4A.w - 40 + grab * 260,
            top: boxTop + 20 - grab * 40,
            width: 84,
            height: 52,
            borderRadius: 7,
            border: `2.5px solid ${withAlpha(theme.tool, 0.9)}`,
            background: withAlpha(theme.panel, 0.98),
            opacity: 1 - Math.max(0, grab - 0.75) * 4,
          }}
        >
          <svg width={84} height={52} viewBox="0 0 84 52">
            <path d="M7 11 L42 30 L77 11" fill="none" stroke={theme.tool} strokeWidth={2.5} />
          </svg>
        </div>
      ) : null}
      {/* 慢一步的循环箭头端点：抓空红闪（扑空——空握位红闪一拍） */}
      {miss > 0.05 ? (
        <div
          style={{
            position: 'absolute',
            left: BOX_4A.x - 40,
            top: boxTop + 96,
            width: 52,
            height: 52,
            borderRadius: '50%',
            border: `3px solid ${withAlpha(theme.danger, 0.9)}`,
            boxShadow: `0 0 ${26 * miss}px ${withAlpha(theme.danger, 0.7 * miss)}`,
            opacity: miss,
            fontFamily: theme.sans,
            fontSize: 15,
            fontWeight: 700,
            color: theme.danger,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          抓空
        </div>
      ) : null}
      {/* 迷你表行（E3 实验单——关机·待处理，号签不显字；卡死定格可读） */}
      <div style={{position: 'absolute', left: MINIROW_4A.x, top: MINIROW_4A.y, opacity: stuck}}>
        <RegistryTable x={0} y={0} w={420} micro rows={[{key: 'e3', badge: undefined, type: '关机', to: '队友甲', state: 'pending', hotP: 0.25}]} />
        <div style={{position: 'absolute', left: 14, top: -34, fontFamily: theme.mono, fontSize: 15, color: theme.danger, whiteSpace: 'nowrap'}}>
          E3 · 没人销账 → 卡死
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'读即消费 · 谁先读，信归谁'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 解法揭示（单句镜）：单点入口闸门两段 + 环体「轮末查信」挂点点亮 ────────

const GATE_4B = {x: 880, w: 200, y: 320} as const;
const RING_4B = {x: 170, y: 250, size: 440} as const;

const FourB: React.FC<{atGate: number; atSettle: number; atHand: number}> = ({atGate, atSettle, atHand}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dot = ((frame / (fps * 2.5)) % 1 + 1) % 1;
  // 闸门自箱口收敛成形（p4-04「读即消费，单点入口」——两段竖闸合拢）
  const gate = clamp01(progress(frame, atGate, 18));
  // 第一段兰紫「先销账」（4-A 卡死的实验单在此对号翻绿闭环——号徽章对位重合）
  const settle = clamp01(progress(frame, atSettle, 22));
  const settleGlow = Math.sin(Math.PI * clamp01(progress(frame, atSettle + 12, 26)));
  // 第二段靛蓝「再交对话」（信化作消息条流入主环对话位）
  const hand = clamp01(progress(frame, atHand, 20));
  // 环体自缩悬位放大合围（右上缩悬 → 放大居左承接近拍）
  const grow = clamp01(progress(frame, atGate, 26));
  const ringSize = 170 + (RING_4B.size - 170) * grow;
  const ringX = 1660 + (RING_4B.x - 1660) * grow;
  const ringY = 60 + (RING_4B.y - 60) * grow;
  // 「轮末查信」挂点段点亮（陶土橙高亮段——本集环体高亮首亮，自此镜起锁定）
  const hookLit = clamp01(progress(frame, atHand + 10, 14));
  const hookFlash = Math.sin(Math.PI * clamp01(progress(frame, atHand + 10, 28)));
  // 消息条飞行（闸门 → 环内对话位）
  const msgFly = clamp01(progress(frame, atHand + 8, 18));
  return (
    <AbsoluteFill>
      {/* 环体〔M-001〕（缩悬放大合围 + 挂点段点亮——高亮段自此镜起全片锁定） */}
      <div style={{position: 'absolute', left: ringX, top: ringY, width: ringSize, height: ringSize}}>
        <LoopRing size={ringSize} nodes={[]} showExit={false} dotProgress={dot} />
        <HookArc size={ringSize} litP={hookLit} />
        {hookFlash > 0.03 ? (
          <div
            style={{
              position: 'absolute',
              inset: -12,
              borderRadius: '50%',
              boxShadow: `0 0 ${40 * hookFlash}px ${withAlpha(theme.core, 0.5 * hookFlash)}`,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
      {/* 单点入口闸门（两段竖闸：上段兰紫「先销账」/ 下段靛蓝「再交对话」——
          次序 = 口播次序） */}
      <div style={{position: 'absolute', left: GATE_4B.x, top: GATE_4B.y, width: GATE_4B.w, opacity: gate, transform: `translateX(${(1 - gate) * 60}px)`}}>
        <div
          style={{
            height: 130,
            borderRadius: '12px 12px 4px 4px',
            border: `3.5px solid ${withAlpha(theme.receipt, 0.9)}`,
            background: withAlpha(theme.panel, 0.97),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            opacity: 0.55 + 0.45 * clamp01(settle),
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text}}>① 先销账</span>
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.receipt}}>{'match & settle'}</span>
        </div>
        <div
          style={{
            height: 130,
            marginTop: 8,
            borderRadius: '4px 4px 12px 12px',
            border: `3.5px solid ${withAlpha(theme.req, 0.9)}`,
            background: withAlpha(theme.panel, 0.97),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            opacity: 0.55 + 0.45 * clamp01(hand),
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text}}>② 再交对话</span>
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.req}}>{'to dialogue'}</span>
        </div>
        {/* 闸门顶签（单点入口——收敛成形的读出） */}
        <div
          style={{
            position: 'absolute',
            left: -80,
            top: -56,
            width: 360,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 22,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: gate,
          }}
        >
          读即消费 · 单点入口
        </div>
      </div>
      {/* 第一段演示：号徽章与表行对位重合 → 实验单翻绿闭环（4-A 卡死在此兑现） */}
      <div style={{position: 'absolute', left: 1180, top: 380, opacity: gate}}>
        <RegistryTable
          x={0}
          y={0}
          w={440}
          micro
          rows={[{key: 'e3', badge: undefined, type: '关机', to: '队友甲', state: 'approved', stateP: settle, hotP: Math.max(0.2, settleGlow)}]}
        />
        {/* 对号飞入的号徽章（对位重合——兰紫对签） */}
        {settle > 0.05 && settle < 0.95 ? (
          <div style={{position: 'absolute', left: -120 + settle * 126, top: 60 + settle * -30, opacity: 1 - Math.max(0, settle - 0.8) * 5}}>
            <NumberBadge label="№" size={34} tone={theme.receipt} glow={settleGlow} />
          </div>
        ) : null}
        <div style={{position: 'absolute', left: 14, top: -34, fontFamily: theme.mono, fontSize: 15, color: settle > 0.8 ? theme.ok : theme.dim, whiteSpace: 'nowrap'}}>
          {settle > 0.8 ? '对上号 → 已批准 ✓' : '先销账 → 对号'}
        </div>
      </div>
      {/* 第二段演示：信化作消息条流入主环对话位（靛蓝——沿飞行带） */}
      {msgFly > 0.05 && msgFly < 0.95 ? (
        <div
          style={{
            position: 'absolute',
            left: GATE_4B.x + 40 + msgFly * (RING_4B.x + RING_4B.size / 2 - GATE_4B.x - 60),
            top: GATE_4B.y + 240 - msgFly * 60,
            width: 130,
            height: 22,
            borderRadius: 6,
            background: withAlpha(theme.req, 0.4),
            border: `2.5px solid ${withAlpha(theme.req, 0.85)}`,
            opacity: 1 - Math.max(0, msgFly - 0.8) * 5,
          }}
        />
      ) : null}
      {/* 环内对话位（消息条终点——注入后的落格） */}
      <div style={{position: 'absolute', left: RING_4B.x + RING_4B.size / 2 - 76, top: RING_4B.y + 150, width: 152}}>
        {[0, 1].map((i) => (
          <div
            key={`im${i}`}
            style={{
              height: 24,
              marginTop: 10,
              borderRadius: 6,
              background: i === 0 && msgFly > 0.9 ? withAlpha(theme.req, 0.4) : 'transparent',
              border: `2px ${i === 0 && msgFly > 0.9 ? 'solid' : 'dashed'} ${i === 0 && msgFly > 0.9 ? withAlpha(theme.req, 0.85) : withAlpha(theme.panelBorder, 0.85)}`,
            }}
          />
        ))}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'consume_lead_inbox · 统一消费入口挂在循环上'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 真实版全景：十五枚消息卡阵列 + 三向关机时序带 ────────────────────────

const GRID_4C = {x: 478, y: 140, cols: 5, rows: 3, cellW: 180, cellH: 104, gap: 16} as const;
/** 时序带顶 y——安全带红线：带区底边 = 620 + 230 = 850 恒 ≤ 860（字幕带上方
 *  160px 带之上）；往下加内容须同步核此常量（ep15 底环 990 侵入返工教训）。 */
const SEQ_4C = {y: 620} as const;

const FourC: React.FC<{atGhost: number; atFill: number[]; atCount: number; atSeq: number}> = ({atGhost, atFill, atCount, atSeq}) => {
  const frame = useCurrentFrame();
  // 拉远降压（@pushIn 负增量——自坑口特写拉回全景重锚）
  const pull = usePushIn(2, {scale: -0.05, dur: DUR.f6});
  // 空网格先立一拍（暗态虚格——设问句期）
  const ghost = clamp01(progress(frame, atGhost, 16));
  // 十五枚 stagger 填格（波次入场——5 列×3 行波次）
  const fills = atFill.map((a) => clamp01(progress(frame, a, DUR.f4)));
  // 计数角标定格（「一共十五种」——数字镜：计数角标+漂移警示小签，卡面零复述）
  const count = clamp01(progress(frame, atCount, DUR.f4));
  // 时序带点亮（三向关机：请求 → 批准|拒绝·附理由 → 系统通知 → 清场）
  const seq = clamp01(progress(frame, atSeq, 40));
  // 高亮两枚（本集正源卡：关机请求 / 关机回复——第 6、7 格位）
  const HOT = [5, 6];
  return (
    <AbsoluteFill style={{transform: pull, transformOrigin: '50% 40%'}}>
      {/* 十五枚消息类型卡阵列（5×3 网格——靛蓝描边；波次 stagger 填格） */}
      {Array.from({length: GRID_4C.rows * GRID_4C.cols}, (_, i) => {
        const col = i % GRID_4C.cols;
        const row = Math.floor(i / GRID_4C.cols);
        const x = GRID_4C.x + col * (GRID_4C.cellW + GRID_4C.gap);
        const y = GRID_4C.y + row * (GRID_4C.cellH + GRID_4C.gap);
        const fill = fills[i] ?? 0;
        const hot = HOT.includes(i);
        return (
          <div
            key={`gc${i}`}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: GRID_4C.cellW,
              height: GRID_4C.cellH,
              borderRadius: 11,
              border: fill > 0.3
                ? `3px solid ${hot ? theme.req : withAlpha(theme.req, 0.45)}`
                : `2px dashed ${withAlpha(theme.panelBorder, 0.9)}`,
              background: fill > 0.3 ? (hot ? withAlpha(theme.req, 0.14) : withAlpha(theme.panel, 0.96)) : 'transparent',
              opacity: fill > 0.3 ? 1 : ghost * 0.55,
              transform: `translateY(${(1 - fill) * 12}px)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              boxShadow: hot && fill > 0.8 ? `0 0 ${16 * (fill - 0.8) * 5}px ${withAlpha(theme.req, 0.5)}` : 'none',
            }}
          >
            {hot ? (
              <>
                <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
                  {i === 5 ? '关机请求' : '关机回复'}
                </span>
                <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.req, whiteSpace: 'nowrap'}}>
                  {i === 5 ? 'shutdown_request' : 'shutdown_response'}
                </span>
              </>
            ) : fill > 0.3 ? (
              <>
                <span style={{width: 84, height: 10, borderRadius: 3, background: withAlpha(theme.dim, 0.4)}} />
                <span style={{width: 56, height: 8, borderRadius: 3, background: withAlpha(theme.dim, 0.25)}} />
              </>
            ) : null}
          </div>
        );
      })}
      {/* 阵列计数角标（「15 种」+ 漂移警示小签——【三】级归属由片尾署源句兜底） */}
      <div style={{position: 'absolute', right: 130, top: 118, textAlign: 'right', opacity: count}}>
        <span style={{fontFamily: theme.mono, fontSize: 40, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: theme.text}}>{'15 种'}</span>
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 2, whiteSpace: 'nowrap'}}>{'协议消息 · 计数会漂移（见片尾）'}</div>
      </div>
      {/* 三向关机时序带（请求 → 分叉〔批准绿/拒绝红·附理由〕→ 系统通知 → 清场） */}
      <div style={{position: 'absolute', left: 150, top: SEQ_4C.y, width: 1620, height: 230}}>
        <svg width={1620} height={230} style={{overflow: 'visible'}}>
          {/* 请求节点 → 分叉 → 系统通知 → 清场：主线描线（seq 驱动） */}
          <line x1={60} y1={70} x2={470} y2={70} stroke={withAlpha(theme.req, 0.9)} strokeWidth={4.5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(seq / 0.3)} />
          {/* 分叉两支（批准绿上 / 拒绝红下——各带附理由小签） */}
          <path d="M 470 70 C 560 70 590 34 690 34" fill="none" stroke={theme.ok} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01((seq - 0.3) / 0.25)} />
          <path d="M 470 70 C 560 70 590 106 690 106" fill="none" stroke={theme.danger} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01((seq - 0.35) / 0.25)} />
          {/* 合流 → 系统通知 → 清场 */}
          <path d="M 950 34 C 1050 34 1050 70 1150 70" fill="none" stroke={withAlpha(theme.dim, 0.8)} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01((seq - 0.6) / 0.2)} />
          <path d="M 950 106 C 1050 106 1050 70 1150 70" fill="none" stroke={withAlpha(theme.dim, 0.8)} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01((seq - 0.65) / 0.2)} />
          <line x1={1150} y1={70} x2={1360} y2={70} stroke={withAlpha(theme.dim, 0.8)} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01((seq - 0.8) / 0.15)} />
        </svg>
        {/* 时序节点签（四节点——请求/批准·拒绝/系统通知/清场） */}
        {[
          {x: 0, y: 34, t: '请求', c: theme.req},
          {x: 690, y: -2, t: '批准 · 附理由', c: theme.ok},
          {x: 690, y: 122, t: '拒绝 · 附理由', c: theme.danger},
          {x: 1150, y: 34, t: '系统通知', c: theme.dim},
        ].map((n, i) => (
          <div
            key={`sn${i}`}
            style={{
              position: 'absolute',
              left: n.x,
              top: n.y,
              padding: '6px 18px',
              borderRadius: 9,
              border: `2.5px solid ${withAlpha(n.c, 0.9)}`,
              background: withAlpha(theme.panel, 0.97),
              fontFamily: theme.sans,
              fontSize: 19,
              fontWeight: 700,
              color: n.c,
              whiteSpace: 'nowrap',
              opacity: clamp01(seq * 2 - i * 0.25),
            }}
          >
            {n.t}
          </div>
        ))}
        {/* 清场扫尾（扫尾动画——seq 末拍扫过带面） */}
        <div
          style={{
            position: 'absolute',
            left: 1360,
            top: 52,
            fontFamily: theme.sans,
            fontSize: 19,
            fontWeight: 700,
            color: theme.dim,
            whiteSpace: 'nowrap',
            opacity: clamp01((seq - 0.9) * 10),
          }}
        >
          清场
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'Zod schema · 格式不对就拒收 · shutdown_approved / shutdown_rejected / teammate_terminated'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D 闸门对照：教学版无闸直行 vs 新版闸门落下弹回 + 争议签 ─────────────────

const LANE_4D = {
  left: {x: 130, y: 200, w: 780},
  right: {x: 1010, y: 200, w: 780},
  h: 420,
} as const;
const DISPUTE_4D = {y: 776} as const;

/** 对照通道（左右同构等高——有无闸门是唯一差异） */
const Channel: React.FC<{x: number; title: string; sub: string; opsRun: number; gateP: number; bounceP: number; wasteP: number; wobble: number}> = ({
  x,
  title,
  sub,
  opsRun,
  gateP,
  bounceP,
  wasteP,
  wobble,
}) => (
  <div style={{position: 'absolute', left: x, top: LANE_4D.left.y, width: LANE_4D.left.w}}>
    <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
      <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{title}</span>
      <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap'}}>{sub}</span>
    </div>
    {/* 通道体（横贯——两操作穿过） */}
    <div
      style={{
        position: 'relative',
        marginTop: 26,
        height: LANE_4D.h,
        borderRadius: 14,
        border: `3px solid ${withAlpha(theme.panelBorder, 0.95)}`,
        background: withAlpha(theme.panel, 0.94),
        overflow: 'hidden',
      }}
    >
      {/* 中段闸位（左右同位——右版闸门落下、左版空位） */}
      <div style={{position: 'absolute', left: LANE_4D.left.w / 2 - 45, top: 60, width: 90}}>
        {gateP > 0.02 ? (
          <div
            style={{
              height: LANE_4D.h - 60,
              borderRadius: 10,
              border: `4px solid ${withAlpha(theme.ok, 0.9)}`,
              background: withAlpha(theme.ok, 0.12),
              transformOrigin: '50% 0%',
              transform: `scaleY(${clamp01(gateP)})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{writingMode: 'vertical-rl', fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.ok, letterSpacing: 6, whiteSpace: 'nowrap'}}>闸门</span>
          </div>
        ) : (
          <div style={{height: LANE_4D.h - 60, border: `2px dashed ${withAlpha(theme.panelBorder, 0.8)}`, borderRadius: 10}} />
        )}
      </div>
      {/* 两操作（跑命令 / 写文件——左版直行穿过；右版撞闸弹回） */}
      {['跑命令', '写文件'].map((op, i) => {
        const run = clamp01(opsRun);
        const bnc = clamp01(bounceP);
        const y = 96 + i * 150;
        const passX = 60 + run * (LANE_4D.left.w - 260);
        const bounced = bnc > 0.3;
        const bx = bounced ? LANE_4D.left.w / 2 - 60 - (bnc - 0.3) * 420 : passX;
        return (
          <div
            key={`op${i}`}
            style={{
              position: 'absolute',
              left: bx,
              top: y,
              padding: '10px 24px',
              borderRadius: 10,
              border: `3px solid ${withAlpha(theme.text, 0.75)}`,
              background: withAlpha(theme.panel, 0.98),
              fontFamily: theme.sans,
              fontSize: 20,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: run > 0.02 ? 1 : 0,
              transform: bounced ? `rotate(${-(bnc - 0.3) * 14}deg)` : 'none',
            }}
          >
            {op}
          </div>
        );
      })}
      {/* 「无执行闸门 · 靠自觉」签（左版旁挂——wobble 轻晃两下） */}
      {wobble > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: LANE_4D.left.w / 2 - 130,
            top: LANE_4D.h - 74,
            padding: '8px 22px',
            borderRadius: 10,
            border: `2.5px dashed ${withAlpha(theme.dim, 0.85)}`,
            background: withAlpha(theme.panel, 0.97),
            fontFamily: theme.sans,
            fontSize: 19,
            fontWeight: 700,
            color: theme.dim,
            whiteSpace: 'nowrap',
            transform: `rotate(${Math.sin(wobble * Math.PI * 4) * 3}deg)`,
          }}
        >
          无执行闸门 · 靠自觉
        </div>
      ) : null}
      {/* 「旧批文作废」小签位（右版——新任务签贴上、旧批文签划掉） */}
      {wasteP > 0.02 ? (
        <div style={{position: 'absolute', left: LANE_4D.left.w / 2 + 80, top: LANE_4D.h - 84, display: 'flex', gap: 14, alignItems: 'center'}}>
          <div
            style={{
              padding: '6px 16px',
              borderRadius: 9,
              border: `2.5px solid ${withAlpha(theme.ok, 0.9)}`,
              background: withAlpha(theme.ok, 0.12),
              fontFamily: theme.sans,
              fontSize: 17,
              fontWeight: 700,
              color: theme.ok,
              whiteSpace: 'nowrap',
              opacity: clamp01(wasteP),
              transform: `translateY(${(1 - clamp01(wasteP)) * 10}px)`,
            }}
          >
            新任务
          </div>
          <div style={{position: 'relative', opacity: 0.85}}>
            <span style={{padding: '6px 16px', borderRadius: 9, border: `2.5px solid ${withAlpha(theme.dim, 0.7)}`, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
              旧批文
            </span>
            {/* 划掉线（wasteP 驱动——一道横杠划过） */}
            <span
              style={{
                position: 'absolute',
                left: -4,
                top: '50%',
                width: clamp01(wasteP) * 96,
                height: 3,
                background: theme.danger,
                transform: 'rotate(-6deg)',
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  </div>
);

const FourD: React.FC<{atRunL: number; atWobble: number; atGate: number; atBounce: number; atWaste: number; atDispute: number; atYield: number}> = ({
  atRunL,
  atWobble,
  atGate,
  atBounce,
  atWaste,
  atDispute,
  atYield,
}) => {
  const frame = useCurrentFrame();
  // 左版两操作无阻直行（p4-08「没有执行闸门」——教学版是自认无闸，非事故态）
  const runL = clamp01(progress(frame, atRunL, 30));
  // 「靠自觉」签面轻晃两下（p4-08 句尾）
  const wobble = clamp01(progress(frame, atWobble, 26));
  // 右版闸门落下（p4-09「补了闸」——重音镜 1–2s punch）
  const gate = clamp01(progress(frame, atGate, 14));
  const gateFlash = Math.sin(Math.PI * clamp01(progress(frame, atGate, 30)));
  // 未批准操作撞闸弹回（p4-09「直接被挡回」——弹回有轨迹）
  const bounce = clamp01(progress(frame, atBounce, 24));
  // 新任务签贴上 + 旧批文签划掉（p4-09「旧批文作废」）
  const waste = clamp01(progress(frame, atWaste, 18));
  // 争议签横贯底部定格（p4-10「两边还在争」——两锚点不判高下 + 中置问号）
  const dispute = clamp01(progress(frame, atDispute, DUR.f5));
  // 争议签收起让位 P5（p4-10「用一条原则收账」——幕尾钩）
  const yieldP = clamp01(progress(frame, atYield, 16));
  return (
    <AbsoluteFill>
      {/* 左：教学版（无闸通道——两操作直行穿过） */}
      <Channel x={LANE_4D.left.x} title="教学版" sub="无闸 · 自认" opsRun={runL} gateP={0} bounceP={0} wasteP={0} wobble={wobble} />
      {/* 右：同一门课的新版（中段闸门落下——未批准操作被弹回） */}
      <Channel x={LANE_4D.right.x} title="同一门课的新版" sub="补闸 · _run_teammate_tool" opsRun={gate > 0.5 ? bounce * 0.4 : 0} gateP={gate} bounceP={bounce} wasteP={waste} wobble={0} />
      {/* 闸门落下重音辉光（右版中段——p4-09 punch） */}
      {gateFlash > 0.03 ? (
        <div
          style={{
            position: 'absolute',
            left: LANE_4D.right.x + LANE_4D.left.w / 2 - 60,
            top: LANE_4D.left.y + 70,
            width: 120,
            height: LANE_4D.h - 70,
            boxShadow: `0 0 ${36 * gateFlash}px ${withAlpha(theme.ok, 0.45 * gateFlash)}`,
            borderRadius: 12,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {/* 争议签（横贯底部——协议层·灵活 ↔ 执行层·兜底 两锚点 + 中置问号；不判高下） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: DISPUTE_4D.y,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 26,
          opacity: dispute * (1 - yieldP * 0.9),
          transform: `translateY(${(1 - dispute) * 20}px)`,
        }}
      >
        <div
          style={{
            padding: '12px 30px',
            borderRadius: 11,
            border: `3px solid ${withAlpha(theme.dim, 0.85)}`,
            background: withAlpha(theme.panel, 0.98),
            fontFamily: theme.sans,
            fontSize: 23,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
          }}
        >
          协议层 · 要灵活
        </div>
        <div style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.text}}>？</div>
        <div
          style={{
            padding: '12px 30px',
            borderRadius: 11,
            border: `3px solid ${withAlpha(theme.dim, 0.85)}`,
            background: withAlpha(theme.panel, 0.98),
            fontFamily: theme.sans,
            fontSize: 23,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
          }}
        >
          执行层 · 要兜底
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'拦到哪层？两边还在争——往下用一条原则收账'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P4EntryAndReal: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p4-01', 'p4-03');
  const bB = w('p4-04', 'p4-04');
  const bC = w('p4-05', 'p4-07');
  const bD = w('p4-08', 'p4-10');

  // 十五格波次锚（p4-06「协议消息」词后 stagger：逐格 2 帧错峰）
  const fillAnchors = Array.from({length: 15}, (_, i) => wa('p4-06', 0.45) + i * 2);

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <FourA
          atTake={wa('p4-01', 0.6) - bA.from}
          atRace={wa('p4-02', 0.26) - bA.from}
          atGrab={wa('p4-02', 0.45) - bA.from}
          atMiss={wa('p4-02', 0.52) - bA.from}
          atStuck={wa('p4-02', 0.62) - bA.from}
          atZero={wa('p4-03', 0.72) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FourB atGate={wa('p4-04', 0.28) - bB.from} atSettle={wa('p4-04', 0.55) - bB.from} atHand={wa('p4-04', 0.78) - bB.from} />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <FourC
          atGhost={wa('p4-05', 0.3) - bC.from}
          atFill={fillAnchors.map((v) => v - bC.from)}
          atCount={wa('p4-06', 0.85) - bC.from}
          atSeq={wa('p4-07', 0.2) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <FourD
          atRunL={wa('p4-08', 0.38) - bD.from}
          atWobble={wa('p4-08', 0.68) - bD.from}
          atGate={wa('p4-09', 0.24) - bD.from}
          atBounce={wa('p4-09', 0.55) - bD.from}
          atWaste={wa('p4-09', 0.83) - bD.from}
          atDispute={wa('p4-10', 0.38) - bD.from}
          atYield={wa('p4-10', 0.75) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4EntryAndReal;
