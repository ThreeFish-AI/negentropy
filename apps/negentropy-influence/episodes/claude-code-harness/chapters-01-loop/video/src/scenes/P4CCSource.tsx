/** P4 生产版源码对照（p4-01..p4-14，7 镜）——分镜 4-A..4-G（storyboard v5）。
 *
 *  融合旧 P3CriterionDuel + P4ProductionFuse 词汇（v6 已验收资产重定时）：
 *  4-A 基线标尺双柱（30 vs 1729 真实线性比例 + ≈57× 参考线）+ 柱心同款 mini 环
 *      （内核一致的视觉宣言）+ p4-03「判断上更较真」右柱外缘细刻度亮起。
 *  4-B 字段判据卡单卡亮相（「更直观的写法」：stop_reason 徽章翻色演示——简洁感
 *      先行，此镜零反例红）。
 *  4-C 流式时序 ECU：打字机逐字到达 + 双指针（内容指针随 tool_use 块到位停绿 /
 *      字段指针滞后停灰 + 迟到微签 + 锁链自字段指针垂下——错绑因果是红线）。
 *  4-D 误判重音镜：「判停」章盖下 + 已请求调用块坠落消解 + 整卡 shake（全片唯一
 *      coral 主导帧；恢复暗示归 4-E）。
 *  4-E needsFollowUp 开关：徽章打叉退场（mono 注「流式下不可靠」）+ 流式字符到达
 *      → 调用块一现 → 致动连线 → 拨钮落位「要」（单一致动因素=块出现）。
 *  4-F State 外圈十字段槽（点名代表=gl-notes §3.4 原文名）+ 四条退出路径各带处置。
 *  4-G 保险丝收束：虚线保险丝层 + 真/弹性保险丝对举（断=终态/弹=恢复，X-001）+
 *      双柱拆锚召回 + 描边金线连通定格〔M-003〕。
 *  ★ 幕级 M-001 缩悬环：顶中偏左（560,62）跨七镜不断相；4-D「误判」词窗冻结停转。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, type RingNode} from '../components/motifs';
import {
  DUR,
  clamp01,
  revealCharCount,
  useCount,
  useDim,
  useDraw,
  useEnter,
  useImpulse,
  useProgress,
  useShake,
  useSpring,
  useStagger,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

type Win = {from: number; durationInFrames: number};
const at = (s: Win, frac: number): number => s.from + frac * s.durationInFrames;
const spanF = (s: Win, f0: number, f1: number): number => (f1 - f0) * s.durationInFrames;

const polar = (cx: number, cy: number, r: number, deg: number): {x: number; y: number} => {
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

const LAP_FRAMES = 75;
const useLaps = (span: number, phase = 0): number => {
  const p = useProgress(0, Math.max(1, span), 'linear');
  return (phase + p * (span / LAP_FRAMES)) % 1;
};

const GOLD = '#E6C06A';

/** 幕级缩悬环（五站、关标签） */
const PENT_NODES: RingNode[] = [0, 1, 2, 3, 4].map((i) => ({label: `s${i + 1}`, angle: -90 + i * 72}));
const SCENE_RING = {size: 140, x: 560, y: 62} as const;

// ── 4-A 基线标尺双柱（p4-01..p4-03） ────────────────────────────────────

const A = {baseY: 800, barW: 150, leftX: 485, rightX: 1255, rightH: 560, leftH: 16} as const;

const topRoundedBar = (x: number, baseY: number, w: number, h: number): string => {
  const q = Math.min(8, h / 2);
  const x1 = x + w;
  return `M ${x} ${baseY} L ${x} ${baseY - h + q} Q ${x} ${baseY - h} ${x + q} ${baseY - h} L ${
    x1 - q
  } ${baseY - h} Q ${x1} ${baseY - h} ${x1} ${baseY - h + q} L ${x1} ${baseY} Z`;
};

const ShotABaseline: React.FC<{s1: Win; s2: Win; s3: Win}> = ({s1, s2, s3}) => {
  const ruler = useDraw(at(s1, 0.2), DUR.f6);
  const marksO = useProgress(at(s1, 0.55), DUR.f4);
  const leftStart = at(s2, 0.1);
  const leftDur = spanF(s2, 0.1, 0.3);
  const leftP = useProgress(leftStart, leftDur, 'decelerate');
  const leftN = useCount({to: 30, at: leftStart, dur: leftDur});
  const rightStart = at(s2, 0.55);
  const rightDur = spanF(s2, 0.55, 0.92);
  const rightP = useProgress(rightStart, rightDur, 'decelerate');
  const rightN = useCount({to: 1729, at: rightStart, dur: rightDur});
  const land = at(s2, 0.92);
  const glow = useImpulse({at: land, dur: DUR.f6});
  const leftNumO = useProgress(leftStart, DUR.f2);
  const rightNumO = useProgress(rightStart, DUR.f3);
  const ratioO = useProgress(land + DUR.f4, DUR.f4);
  // p4-03：柱心同款 mini 环脉冲（「内核完全一致」）+ 右柱外缘细刻度（「判断上更较真」）
  const heartPulse = useImpulse({at: at(s3, 0.35), dur: DUR.f6});
  const heartO = useProgress(at(s3, 0.2), DUR.f4);
  const ticksO = useProgress(at(s3, 0.72), DUR.f5);
  const leftShown = Math.min(30, Math.round(leftN));
  const rightShown = Math.min(1729, Math.round(rightN));
  const hL = Math.max(2, A.leftH * leftP);
  const hR = A.rightH * rightP;
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <line x1={330} y1={A.baseY} x2={1600} y2={A.baseY} stroke={theme.panelBorder} strokeWidth={3} opacity={0.9} {...ruler} />
        {Array.from({length: 16}, (_, i) => 330 + i * 85).map((x) => (
          <line key={x} x1={x} y1={A.baseY} x2={x} y2={A.baseY + 10} stroke={theme.panelBorder} strokeWidth={2} opacity={0.55 * marksO} />
        ))}
        {[A.leftX, A.leftX + A.barW, A.rightX, A.rightX + A.barW].map((x) => (
          <line key={x} x1={x} y1={A.baseY - 4} x2={x} y2={A.baseY + 14} stroke={theme.dim} strokeWidth={2.5} opacity={marksO} />
        ))}
        <path d={topRoundedBar(A.leftX, A.baseY, A.barW, hL)} fill={theme.dim} opacity={0.85} />
        <path d={topRoundedBar(A.rightX, A.baseY, A.barW, hR)} fill={theme.core} opacity={0.92} />
        <rect x={A.rightX} y={A.baseY - hR - 6} width={A.barW} height={5} fill={theme.text} opacity={0.9 * glow} />
        {/* 右柱外缘细刻度（「判断上更较真」——更严判定的量具感） */}
        <g opacity={ticksO}>
          {Array.from({length: 14}, (_, i) => {
            const y = A.baseY - 30 - i * 38;
            return <line key={i} x1={A.rightX + A.barW + 10} y1={y} x2={A.rightX + A.barW + 10 + (i % 3 === 0 ? 18 : 10)} y2={y} stroke={theme.core} strokeWidth={2.5} opacity={0.75} />;
          })}
        </g>
        <text x={A.leftX + A.barW / 2} y={848} textAnchor="middle" fontFamily={theme.sans} fontSize={28} fill={theme.dim} opacity={marksO}>
          {'教学版'}
        </text>
        <text x={A.rightX + A.barW / 2} y={848} textAnchor="middle" fontFamily={theme.sans} fontSize={28} fontWeight={600} fill={theme.text} opacity={marksO}>
          {'生产版'}
        </text>
      </svg>

      {/* 柱心同款 mini 环：内核一致的视觉宣言（「内核完全一致」词位同拍脉冲） */}
      <div style={{position: 'absolute', left: A.rightX + A.barW / 2 - 62, top: A.baseY - hR / 2 - 62, opacity: heartO}}>
        <svg width={124} height={124} style={{overflow: 'visible'}}>
          <circle cx={62} cy={62} r={44} fill="none" stroke={theme.bg} strokeWidth={16} opacity={0.55} />
          <circle cx={62} cy={62} r={44} fill="none" stroke={theme.core} strokeWidth={5} opacity={0.95} />
          <circle cx={62} cy={62} r={44} fill="none" stroke={theme.text} strokeWidth={2.5} opacity={heartPulse} />
        </svg>
      </div>
      <div style={{position: 'absolute', left: A.leftX + A.barW / 2 - 40, top: A.baseY - 96, opacity: heartO}}>
        <svg width={80} height={80} style={{overflow: 'visible'}}>
          <circle cx={40} cy={40} r={26} fill="none" stroke={theme.dim} strokeWidth={4} />
        </svg>
      </div>

      <div
        style={{
          position: 'absolute',
          left: A.leftX + A.barW / 2 - 150,
          top: A.baseY - A.leftH - 62,
          width: 300,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 42,
          color: theme.dim,
          fontVariantNumeric: 'tabular-nums',
          opacity: leftNumO,
        }}
      >
        {`${leftP >= 1 ? '≈' : ''}${leftShown} 行`}
      </div>
      <div
        style={{
          position: 'absolute',
          left: A.rightX + A.barW / 2 - 150,
          top: A.baseY - A.rightH - 66,
          width: 300,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 46,
          fontWeight: 700,
          color: theme.core,
          fontVariantNumeric: 'tabular-nums',
          opacity: rightNumO,
          textShadow: `0 0 ${20 * glow}px ${theme.core}`,
        }}
      >
        {`${rightShown} 行`}
      </div>

      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line x1={A.leftX + A.barW} y1={A.baseY - A.leftH} x2={A.rightX} y2={A.baseY - A.leftH} stroke={theme.dim} strokeWidth={2} strokeDasharray="6 8" opacity={0.7 * ratioO} />
        <text x={(A.leftX + A.barW + A.rightX) / 2} y={A.baseY - A.leftH - 12} textAnchor="middle" fontFamily={theme.mono} fontSize={24} fill={theme.dim} opacity={ratioO}>
          {'≈57×'}
        </text>
      </svg>
      <Footnote delay={at(s2, 0.7)}>{'源码分析 · query.ts'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-B 字段判据卡单卡亮相（p4-04） ─────────────────────────────────────

const FieldCard: React.FC<{s4: Win}> = ({s4}) => {
  const enter = useEnter('rise', {at: at(s4, 0.28), dur: DUR.f5, springPreset: 'settle', restBottom: 640});
  const lit = useProgress(at(s4, 0.62), DUR.f4);
  const flip = useImpulse({at: at(s4, 0.62), dur: DUR.f5, peak: 0.3});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 660, top: 300, ...enter}}>
        <Panel style={{width: 600, height: 380, boxSizing: 'border-box', position: 'relative'}}>
          <div style={{position: 'absolute', left: 34, top: 30, fontFamily: theme.sans, fontSize: 34, fontWeight: 700, color: theme.text}}>
            {'更直观的写法'}
          </div>
          <div style={{position: 'absolute', right: 34, top: 42, fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>
            {'stop_reason'}
          </div>
          {/* 回答流条 + 末尾徽章 */}
          <div
            style={{
              position: 'absolute',
              left: 32,
              top: 130,
              width: 380,
              height: 66,
              background: theme.bg,
              border: `2px solid ${theme.panelBorder}`,
              borderRadius: 10,
            }}
          >
            {Array.from({length: 7}, (_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 14 + i * 50,
                  top: 15,
                  width: 40,
                  height: 36,
                  borderRadius: 5,
                  background: theme.panelBorder,
                  opacity: 0.55,
                }}
              />
            ))}
          </div>
          {/* 徽章：翻色一拍（tool_use 值闪现——简洁感先行，零反例红） */}
          <div
            style={{
              position: 'absolute',
              left: 404,
              top: 139,
              width: 164,
              height: 48,
              borderRadius: 999,
              background: theme.bg,
              border: `2px solid ${theme.panelBorder}`,
              transform: `scaleX(${1 - flip})`,
            }}
          >
            <div style={{position: 'absolute', inset: -2, borderRadius: 999, border: `2px solid ${theme.core}`, opacity: lit}} />
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                textAlign: 'center',
                fontFamily: theme.mono,
                fontSize: 18,
                color: theme.dim,
                lineHeight: '44px',
              }}
            >
              {'?'}
            </span>
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                textAlign: 'center',
                fontFamily: theme.mono,
                fontSize: 18,
                color: theme.core,
                opacity: lit,
                lineHeight: '44px',
              }}
            >
              {'tool_use'}
            </span>
          </div>
          <div style={{position: 'absolute', left: 34, bottom: 28, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
            {'一句话判断 · 结束与否'}
          </div>
        </Panel>
      </div>
      <Footnote delay={8}>{'stop_reason'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-C 流式时序 ECU：打字机 + 双指针（p4-05..p4-06） ────────────────────

const CELLS = 26;

const StreamDuel: React.FC<{s5: Win; s6: Win; beatDur: number}> = ({s5, s6, beatDur}) => {
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const enter = useEnter('rise', {at: 2, dur: DUR.f5, springPreset: 'settle', restBottom: 700});
  // 打字窗：p4-05「逐字到达」词位起铺满两句约 55%
  const typeStart = at(s5, 0.4);
  const typeWin = Math.max(DUR.f5, Math.round(beatDur * 0.55));
  const cps = CELLS / Math.max(1, typeWin / fps);
  const arrived = revealCharCount(frame - typeStart, fps, cps);
  const segOn = clamp01((arrived - 17) / 2);
  // 内容指针到点（「前半段已经到位」词位）/ 字段指针滞后 + 迟到微签
  const arriveAt = at(s6, 0.32);
  const arrive = useProgress(arriveAt, DUR.f3);
  const lockPulse = useImpulse({at: arriveAt, dur: DUR.f5, peak: 0.6});
  const lateAt = at(s6, 0.58);
  const lateTag = useEnter('pop', {at: lateAt, dur: DUR.f4});
  // 锁链自字段指针垂下（「还停在旧值」句尾；只连字段指针——错绑因果是红线）
  const chainAt = at(s6, 0.85);
  const chain = useSpring('settle', {at: chainAt, dur: DUR.f5});
  const chainO = useProgress(chainAt, DUR.f3);
  // 时间轴双指针几何
  const X0 = 260;
  const STEP = 118;
  const CONTENT_X = X0 + 9 * STEP;
  const FIELD_X = X0 + 7 * STEP;
  const move = useProgress(DUR.f4, 26, 'decelerate');
  const cx = X0 + (CONTENT_X - X0) * Math.min(1, Math.max(0, move));
  const fx = X0 + (FIELD_X - X0) * Math.min(1, Math.max(0, move));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...enter}}>
        {/* 字符流横条（打字机） */}
        <div style={{position: 'absolute', left: 260, top: 300, fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>
          {'回答流'}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 256,
            top: 340,
            width: 1408,
            height: 92,
            background: theme.panel,
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 12,
          }}
        >
          {Array.from({length: CELLS}, (_, i) => {
            const seg = i >= 17 && i < 22;
            const on = i < arrived;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 34 + i * 52,
                  top: 26,
                  width: 44,
                  height: 40,
                  borderRadius: 6,
                  background: seg ? theme.tool : theme.panelBorder,
                  opacity: on ? (seg ? 0.88 : 0.55) : 0,
                }}
              />
            );
          })}
          {arrived < CELLS ? (
            <div
              style={{
                position: 'absolute',
                left: 34 + arrived * 52 - 3,
                top: 26,
                width: 4,
                height: 40,
                background: theme.dim,
                opacity: Math.floor((frame / fps) * 2) % 2 === 0 ? 0.9 : 0.15,
              }}
            />
          ) : null}
          <div
            style={{
              position: 'absolute',
              left: 896,
              top: 18,
              width: 268,
              height: 56,
              borderRadius: 10,
              border: `2px solid ${theme.tool}`,
              opacity: 0.9 * segOn,
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 896,
            width: 268,
            top: 442,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.tool,
            opacity: segOn,
          }}
        >
          {'tool_use'}
        </div>

        {/* 时间轴双指针（内容到点绿 / 字段滞后灰 + 迟到微签 + 锁链） */}
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          <line x1={X0} y1={640} x2={1680} y2={640} stroke={theme.dim} strokeWidth={4} opacity={0.85} />
          {Array.from({length: 11}, (_, i) => (
            <line key={i} x1={X0 + i * STEP} y1={632} x2={X0 + i * STEP} y2={648} stroke={theme.panelBorder} strokeWidth={3} opacity={0.85} />
          ))}
          <line x1={CONTENT_X} y1={628} x2={CONTENT_X} y2={656} stroke={theme.ok} strokeWidth={5} opacity={arrive} />
          <circle cx={CONTENT_X} cy={640} r={7 + lockPulse} fill={theme.ok} opacity={arrive} />
          <circle cx={FIELD_X} cy={640} r={6} fill="none" stroke={theme.dim} strokeWidth={2.5} opacity={arrive} />
          {/* 内容指针 */}
          <g transform={`translate(${cx}, 0)`}>
            <line x1={0} y1={548} x2={0} y2={632} stroke={theme.ok} strokeWidth={4} />
            <text x={0} y={530} textAnchor="middle" fontFamily={theme.sans} fontSize={28} fontWeight={700} fill={theme.ok}>
              {'内容'}
            </text>
          </g>
          {/* 字段指针（滞后一档） */}
          <g transform={`translate(${fx}, 0)`}>
            <line x1={0} y1={548} x2={0} y2={632} stroke={theme.dim} strokeWidth={4} />
            <text x={0} y={530} textAnchor="middle" fontFamily={theme.sans} fontSize={28} fontWeight={700} fill={theme.dim}>
              {'字段'}
            </text>
            {/* 迟到微签（迟≠永不到） */}
            <g opacity={lateTag.opacity} transform={lateTag.transform}>
              <text x={64} y={560} fontFamily={theme.mono} fontSize={20} fill={theme.warn}>
                {'迟到'}
              </text>
            </g>
            {/* 锁链：自字段指针垂下（迟到信号的具象锁定） */}
            <g transform={`translate(0, ${(chain - 1) * -40})`} opacity={chainO}>
              <ellipse cx={0} cy={664} rx={9} ry={12} fill="none" stroke={theme.warn} strokeWidth={3.5} />
              <ellipse cx={0} cy={690} rx={9} ry={12} fill="none" stroke={theme.warn} strokeWidth={3.5} />
              <ellipse cx={0} cy={716} rx={9} ry={12} fill="none" stroke={theme.warn} strokeWidth={3.5} />
            </g>
          </g>
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D 误判重音镜：判停章 + 调用坠落 + shake（p4-07） ──────────────────

const HaltDrop: React.FC<{s7: Win}> = ({s7}) => {
  const enter = useEnter('rise', {at: 2, dur: DUR.f4, restBottom: 660});
  const stampAt = at(s7, 0.38);
  const stamp = useEnter('pop', {at: stampAt, dur: DUR.f4, springPreset: 'snap'});
  const dropAt = at(s7, 0.64);
  const fall = useProgress(dropAt, DUR.f6, 'accelerate');
  const fade = useProgress(dropAt + DUR.f4, DUR.f5);
  const guide = useProgress(dropAt + DUR.f2, DUR.f3);
  const railShake = useShake({at: dropAt, amp: 3.5, freq: 1.6, decay: true, dur: DUR.f6});
  const labelO = useProgress(at(s7, 0.86), DUR.f4);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 560, top: 300, ...enter, transform: `${enter.transform} translateX(${railShake}px)`}}>
        <Panel style={{width: 800, height: 400, boxSizing: 'border-box', position: 'relative'}}>
          <div style={{position: 'absolute', left: 30, top: 26, fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>
            {'等字段再判断'}
          </div>
          <div style={{position: 'absolute', right: 30, top: 34, fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>
            {'stop_reason'}
          </div>
          {/* 回答流 + 两枚已请求的调用块（坠落消解） */}
          <div
            style={{
              position: 'absolute',
              left: 30,
              top: 120,
              width: 640,
              height: 64,
              background: theme.bg,
              border: `2px solid ${theme.panelBorder}`,
              borderRadius: 10,
            }}
          >
            {Array.from({length: 12}, (_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 14 + i * 51,
                  top: 15,
                  width: 42,
                  height: 34,
                  borderRadius: 5,
                  background: theme.panelBorder,
                  opacity: 0.5,
                }}
              />
            ))}
          </div>
          {[560, 606].map((bx, k) => (
            <div key={k}>
              <div
                style={{
                  position: 'absolute',
                  left: bx + 16,
                  top: 178,
                  width: 2,
                  height: 150,
                  backgroundImage: `repeating-linear-gradient(to bottom, ${theme.warn} 0 6px, transparent 6px 12px)`,
                  opacity: 0.75 * guide,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: bx,
                  top: 126 + 160 * fall,
                  width: 38,
                  height: 48,
                  borderRadius: 6,
                  background: theme.tool,
                  opacity: 1 - fade,
                }}
              />
            </div>
          ))}
          <div
            style={{
              position: 'absolute',
              left: 30,
              bottom: 30,
              fontFamily: theme.mono,
              fontSize: 22,
              color: theme.warn,
              opacity: labelO,
            }}
          >
            {'丢弃 ×2'}
          </div>
          {/* 判停章（AAS：抬起 2 帧后拍落） */}
          <div
            style={{
              ...stamp,
              position: 'absolute',
              right: 44,
              top: 150,
              padding: '8px 22px',
              borderRadius: 10,
              border: `3px solid ${theme.warn}`,
              fontFamily: theme.sans,
              fontSize: 34,
              fontWeight: 700,
              color: theme.warn,
              transform: `${stamp.transform} rotate(-8deg)`,
            }}
          >
            {'判停'}
          </div>
        </Panel>
      </div>
      <Footnote delay={stampAt}>{'misjudge → halt'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-E needsFollowUp 开关（p4-08..p4-09） ───────────────────────────────

const B = {panelL: 385, panelT: 235, panelW: 1150, panelH: 560} as const;
const B_CELLS = 26;

const SwitchShot: React.FC<{s8: Win; s9: Win; lapPhase: number}> = ({s8, s9, lapPhase}) => {
  const span = s8.durationInFrames + s9.durationInFrames;
  const laps = useLaps(span, lapPhase);
  const panelIn = useEnter('slideL', {at: at(s8, 0.02), dur: DUR.f5, dist: 90});
  const headO = useProgress(at(s8, 0.08), DUR.f4);
  const sectionMark = useDraw(at(s8, 0.06), DUR.f4);
  // 「不认字段」：徽章先现、打叉一闪、随后压暗退场（+ mono 注「流式下不可靠」）
  const atCross = at(s8, 0.3);
  const badgeO = useProgress(at(s8, 0.14), DUR.f4);
  const crossA = useDraw(atCross, DUR.f4);
  const crossB = useDraw(atCross + 2, DUR.f4);
  const flash = useImpulse({at: atCross, dur: DUR.f5});
  const badgeSettle = useProgress(atCross + DUR.f5, DUR.f4);
  // 「改用一个开关」：开关入画，停在「否」
  const switchO = useProgress(at(s8, 0.68), DUR.f4);
  // p4-09：流式字符到达 → 调用块一现 → 拨钮落位「要」（单一致动因素）
  const streamP = useProgress(at(s9, 0.08), spanF(s9, 0.08, 0.5), 'linear');
  const filled = Math.round(streamP * B_CELLS);
  const streamTagO = useProgress(at(s9, 0.06), DUR.f3);
  const blockAt = at(s9, 0.42);
  const flipAt = blockAt + DUR.f2;
  const knob = useProgress(flipAt, DUR.f5, 'decelerate');
  const blockIn = useEnter('pop', {at: blockAt, dur: DUR.f4});
  const blockGlow = useImpulse({at: blockAt, dur: DUR.f5});
  const on = knob > 0.95;
  const causalLine = useDraw(blockAt, DUR.f4);
  const causalGlow = useImpulse({at: blockAt, dur: DUR.f5});
  const causalDim = 1 - 0.7 * useProgress(flipAt + DUR.f5, DUR.f4);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: B.panelL, top: B.panelT, ...panelIn}}>
        <Panel style={{width: B.panelW, height: B.panelH, boxSizing: 'border-box'}} />
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <g stroke={theme.dim} strokeWidth={3} opacity={0.8}>
          <line x1={B.panelL - 26} y1={B.panelT + 22} x2={B.panelL - 6} y2={B.panelT + 2} {...sectionMark} />
          <line x1={B.panelL - 26} y1={B.panelT + 36} x2={B.panelL - 6} y2={B.panelT + 16} {...sectionMark} />
        </g>
      </svg>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <text x={B.panelL + 30} y={B.panelT + 38} fontFamily={theme.mono} fontSize={22} fill={theme.dim} opacity={headO}>
          {'生产版 · 核心剖面'}
        </text>
        {/* 收尾字段徽章：打叉一闪后压暗退场 */}
        <g opacity={badgeO * (1 - 0.6 * badgeSettle)}>
          <rect x={1180} y={266} width={190} height={62} rx={31} fill={theme.panel} stroke={theme.warn} strokeWidth={2.5} />
          <rect x={1180} y={266} width={190} height={62} rx={31} fill="none" stroke={theme.warn} strokeWidth={5} opacity={flash} />
          <text x={1275} y={294} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.warn}>
            {'收尾字段'}
          </text>
          <text x={1275} y={318} textAnchor="middle" fontFamily={theme.mono} fontSize={15} fill={theme.dim}>
            {'流式下不可靠'}
          </text>
          <line x1={1192} y1={276} x2={1358} y2={318} stroke={theme.warn} strokeWidth={3.5} {...crossA} />
          <line x1={1358} y1={276} x2={1192} y2={318} stroke={theme.warn} strokeWidth={3.5} {...crossB} />
        </g>
        {/* 流式字符格 */}
        <text x={760} y={306} fontFamily={theme.mono} fontSize={18} fill={theme.dim} opacity={streamTagO}>
          {'流式'}
        </text>
        {Array.from({length: B_CELLS}, (_, i) => {
          const col = i % 13;
          const row = Math.floor(i / 13);
          const x = 760 + col * 30;
          const y = 322 + row * 46;
          const shown = i < filled;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={22}
              height={30}
              rx={4}
              fill={shown ? theme.text : 'none'}
              fillOpacity={shown ? 0.72 : 0}
              stroke={theme.panelBorder}
              strokeWidth={1.5}
              opacity={shown ? 1 : 0.5}
            />
          );
        })}
      </svg>
      {/* 工具调用块 */}
      <div style={{position: 'absolute', left: 760, top: 428, width: 360, ...blockIn}}>
        <Panel
          accent={theme.tool}
          style={{
            boxSizing: 'border-box',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            boxShadow: `0 0 ${18 * blockGlow}px ${theme.tool}`,
            background: theme.panel,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.tool}}>{'工具调用'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'tool_use'}</span>
        </Panel>
      </div>
      {/* 块→开关致动连线 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line x1={940} y1={486} x2={940} y2={562} stroke={theme.tool} strokeWidth={2.5} opacity={causalDim * (0.55 + 0.45 * causalGlow)} {...causalLine} />
      </svg>
      {/* 继续运行开关（拨到「要」） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <g opacity={switchO}>
          <text x={760} y={548} fontFamily={theme.sans} fontSize={26} fontWeight={600} fill={theme.text}>
            {'继续运行'}
          </text>
          <rect x={760} y={566} width={180} height={58} rx={29} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2} />
          <text x={742} y={602} textAnchor="end" fontFamily={theme.sans} fontSize={24} fill={theme.dim}>
            {'否'}
          </text>
          <text x={958} y={602} textAnchor="start" fontFamily={theme.sans} fontSize={24} fontWeight={600} fill={on ? theme.ok : theme.dim}>
            {'要'}
          </text>
          <circle cx={783 + 134 * knob} cy={595} r={20} fill={theme.core} />
          <text x={760} y={658} fontFamily={theme.mono} fontSize={19} fill={theme.dim}>
            {'needsFollowUp'}
          </text>
        </g>
      </svg>
      {/* 同款环体内核（M-001） */}
      <div style={{position: 'absolute', left: 450, top: 330, ...panelIn}}>
        <LoopRing size={250} showLabels={false} showExit={false} dotProgress={laps} />
      </div>
      <Footnote delay={at(s9, 0.4)}>{'needsFollowUp = true'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-F State 外圈（p4-10..p4-11） ──────────────────────────────────────

const C = {cx: 960, cy: 555, r: 280} as const;
const SLOT_ANGLE = (k: number): number => -90 + 36 * k;
const C_REPS = [
  {k: 0, label: '压缩', lx: 960, ly: 238, anchor: 'middle' as const},
  {k: 7, label: 'Token 恢复', lx: 690, ly: 649, anchor: 'end' as const},
  {k: 3, label: '轮次', lx: 1256, ly: 649, anchor: 'start' as const},
];
const C_EXITS = [
  {name: '超长', disp: '续跑', ok: true, k: 2, w: 150},
  {name: '报错', disp: '重试', ok: true, k: 8, w: 150},
  {name: '中止', disp: '中止', ok: false, k: 6, w: 140},
  {name: '轮次上限', disp: '中止', ok: false, k: 4, w: 170},
];

const RepSlot: React.FC<{atIn: number; k: number; label: string; lx: number; ly: number; anchor: 'middle' | 'start' | 'end'}> = ({
  atIn,
  k,
  label,
  lx,
  ly,
  anchor,
}) => {
  const p = useProgress(atIn, DUR.f4);
  const pos = polar(C.cx, C.cy, C.r, SLOT_ANGLE(k));
  return (
    <g opacity={p}>
      <rect x={pos.x - 10} y={pos.y - 10} width={20} height={20} rx={5} fill={theme.panel} stroke={theme.text} strokeWidth={3} />
      <text x={lx} y={ly} textAnchor={anchor} fontFamily={theme.sans} fontSize={25} fontWeight={600} fill={theme.text}>
        {label}
      </text>
    </g>
  );
};

const ExitPath: React.FC<{atIn: number; k: number; name: string; disp: string; ok: boolean; w: number}> = ({
  atIn,
  k,
  name,
  disp,
  ok,
  w,
}) => {
  const draw = useDraw(atIn, DUR.f5);
  const signO = useProgress(atIn + DUR.f3, DUR.f4);
  const from = polar(C.cx, C.cy, C.r, SLOT_ANGLE(k));
  const dir = {
    x: Math.cos((SLOT_ANGLE(k) * Math.PI) / 180),
    y: Math.sin((SLOT_ANGLE(k) * Math.PI) / 180),
  };
  const to = {x: C.cx + dir.x * (C.r + 105), y: C.cy + dir.y * (C.r + 105)};
  const sign = {x: to.x + dir.x * 24, y: Math.min(to.y + dir.y * 24, 866)};
  const enter = useEnter('fade', {at: atIn + DUR.f3, dur: DUR.f4});
  return (
    <>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={theme.dim} strokeWidth={2} opacity={0.8} {...draw} />
      </svg>
      <div style={{position: 'absolute', left: sign.x - w / 2, top: sign.y - 36, width: w, ...enter}}>
        <Panel style={{boxSizing: 'border-box', padding: '8px 12px', textAlign: 'center', opacity: signO, background: theme.panel}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{name}</div>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: ok ? theme.ok : theme.warn}}>{`→ ${disp}`}</div>
        </Panel>
      </div>
    </>
  );
};

const ShotStateRim: React.FC<{w10: Win; w11: Win; lapPhase: number}> = ({w10, w11, lapPhase}) => {
  const span = w10.durationInFrames + w11.durationInFrames;
  const laps = useLaps(span, lapPhase);
  const rim = useDraw(at(w10, 0.06), DUR.f6);
  const slots = useStagger(10, {at: at(w10, 0.2), stride: 2, dur: DUR.f2});
  const countO = useProgress(at(w10, 0.58), DUR.f4);
  const repAnchors = [at(w10, 0.58), at(w10, 0.68), at(w10, 0.78)];
  const exitAnchors = [at(w11, 0.28), at(w11, 0.4), at(w11, 0.52), at(w11, 0.66)];
  const teachIn = useEnter('pop', {at: at(w10, 0.08), dur: DUR.f4});
  const teachDim = 1 - 0.6 * useProgress(at(w10, 0.52), DUR.f4);
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <circle cx={C.cx} cy={C.cy} r={C.r} fill="none" stroke={theme.panelBorder} strokeWidth={2.5} {...rim} />
        {slots.map((o, k) => {
          const pos = polar(C.cx, C.cy, C.r, SLOT_ANGLE(k));
          return (
            <rect key={k} x={pos.x - 9} y={pos.y - 9} width={18} height={18} rx={4} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2} opacity={o} />
          );
        })}
        <text x={C.cx} y={872} textAnchor="middle" fontFamily={theme.mono} fontSize={26} fill={theme.dim} opacity={countO}>
          {'State · 10 字段'}
        </text>
      </svg>
      {/* 教学版对照 chip（1 个列表） */}
      <div style={{position: 'absolute', left: 240, top: 250, width: 230, opacity: teachIn.opacity * teachDim, transform: teachIn.transform}}>
        <Panel style={{padding: '10px 14px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'教学版'}</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8}}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  height: 14,
                  borderRadius: 4,
                  border: `1.5px solid ${i === 0 ? theme.core : theme.panelBorder}`,
                  background: i === 0 ? `${theme.core}1F` : 'transparent',
                }}
              />
            ))}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 6}}>{'1 个列表'}</div>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: C.cx - 155, top: C.cy - 155}}>
        <LoopRing size={310} showLabels={false} showExit={false} dotProgress={laps} />
      </div>
      {C_REPS.map((r, i) => (
        <RepSlot key={r.label} atIn={repAnchors[i]} k={r.k} label={r.label} lx={r.lx} ly={r.ly} anchor={r.anchor} />
      ))}
      {C_EXITS.map((e, i) => (
        <ExitPath key={e.name} atIn={exitAnchors[i]} k={e.k} name={e.name} disp={e.disp} ok={e.ok} w={e.w} />
      ))}
    </AbsoluteFill>
  );
};

// ── 4-G 保险丝收束（p4-12..p4-14） ──────────────────────────────────────

const D = {cx: 960, cy: 520, rFuse: 200} as const;

const FuseReal: React.FC<{atIn: number; atBreak: number}> = ({atIn, atBreak}) => {
  const enter = useEnter('pop', {at: atIn, dur: DUR.f4});
  const gap = 18 * useProgress(atBreak, DUR.f4, 'decelerate');
  const spark = useImpulse({at: atBreak, dur: DUR.f4});
  const settle = useProgress(atBreak + DUR.f5, DUR.f4);
  const capO = useProgress(atBreak, DUR.f4);
  const mid = 600;
  const glyphStyle: React.CSSProperties = {...enter, opacity: enter.opacity * (1 - 0.35 * settle)};
  return (
    <g style={glyphStyle}>
      <rect x={535} y={497} width={130} height={46} rx={10} fill={theme.panel} stroke={theme.dim} strokeWidth={2.5} />
      <line x1={545} y1={520} x2={mid - gap / 2} y2={520} stroke={theme.text} strokeWidth={3} />
      <line x1={mid + gap / 2} y1={520} x2={655} y2={520} stroke={theme.text} strokeWidth={3} />
      <g opacity={spark} stroke={theme.warn} strokeWidth={3}>
        <line x1={592} y1={512} x2={580} y2={500} />
        <line x1={608} y1={512} x2={620} y2={500} />
        <line x1={592} y1={528} x2={580} y2={540} />
        <line x1={608} y1={528} x2={620} y2={540} />
      </g>
      <text x={600} y={596} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.dim} opacity={capO}>
        {'真保险丝 · '}
        <tspan fill={theme.warn}>{'永久断路'}</tspan>
      </text>
    </g>
  );
};

const FuseRetry: React.FC<{atIn: number; atBounce: number; atBounce2: number}> = ({atIn, atBounce, atBounce2}) => {
  const enter = useEnter('pop', {at: atIn, dur: DUR.f4});
  const b1 = useImpulse({at: atBounce, dur: DUR.f5});
  const b2 = useImpulse({at: atBounce2, dur: DUR.f5});
  const bend = 26 * (b1 + b2);
  const cap1O = useProgress(atBounce, DUR.f4);
  const cap2O = useProgress(atBounce2, DUR.f4);
  const x0 = 1255;
  const x1 = 1385;
  const mid = (x0 + x1) / 2;
  return (
    <g style={enter}>
      <rect x={x0} y={497} width={130} height={46} rx={10} fill={theme.panel} stroke={theme.dim} strokeWidth={2.5} />
      <path d={`M ${x0 + 10} 520 Q ${mid} ${520 + 2 * bend} ${x1 - 10} 520`} fill="none" stroke={theme.text} strokeWidth={3} />
      <text x={mid} y={596} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.dim}>
        <tspan fill={theme.ok} opacity={cap1O}>
          {'可重试'}
        </tspan>
        {' · '}
        <tspan fill={theme.ok} opacity={cap2O}>
          {'可续跑'}
        </tspan>
      </text>
    </g>
  );
};

const ShotFuse: React.FC<{w12: Win; w13: Win; w14: Win; lapPhase: number}> = ({w12, w13, w14, lapPhase}) => {
  const span = w12.durationInFrames + w13.durationInFrames + w14.durationInFrames;
  const laps = useLaps(span, lapPhase);
  const fuseO = useProgress(at(w12, 0.74), DUR.f5);
  const atBreak = at(w13, 0.28);
  const atBounce = at(w13, 0.6);
  const atBounce2 = at(w13, 0.82);
  const glyphL = at(w12, 0.8);
  const glyphR = at(w12, 0.88);
  const fuseDim = useDim({at: w14.from + 2, to: 0.55, dur: DUR.f5});
  const barsL = useProgress(at(w14, 0.06), DUR.f4);
  const barsR = useProgress(at(w14, 0.24), DUR.f5);
  const goldDraw = useDraw(at(w14, 0.44), spanF(w14, 0.44, 0.84));
  const dotsO = useProgress(at(w14, 0.84), DUR.f3);
  const guardPulse = useImpulse({at: at(w14, 0.8), dur: DUR.f5});
  const GOLD_PATH = 'M 300 717 C 520 420, 760 268, 960 268 C 1160 268, 1400 430, 1580 550';
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: D.cx - 130, top: D.cy - 130}}>
        <LoopRing size={260} showLabels={false} showExit={false} dotProgress={laps} />
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <g opacity={fuseO * fuseDim}>
          <circle cx={D.cx} cy={D.cy} r={D.rFuse} fill="none" stroke={theme.dim} strokeWidth={2.5} strokeDasharray="10 12" opacity={0.75} />
          {Array.from({length: 10}, (_, k) => {
            const p = polar(D.cx, D.cy, D.rFuse, SLOT_ANGLE(k));
            return <circle key={k} cx={p.x} cy={p.y} r={2.5} fill={theme.dim} opacity={0.9} />;
          })}
          <text x={790} y={712} textAnchor="end" fontFamily={theme.mono} fontSize={21} fill={theme.dim}>
            {'保险丝层'}
          </text>
        </g>
        <g opacity={fuseDim}>
          <FuseReal atIn={glyphL} atBreak={atBreak} />
          <FuseRetry atIn={glyphR} atBounce={atBounce} atBounce2={atBounce2} />
        </g>
        <g style={{opacity: barsL, transform: `translateY(${(1 - barsL) * 14}px)`}}>
          <rect x={272} y={717} width={56} height={3} fill="none" stroke={theme.dim} strokeWidth={2} />
          <text x={300} y={700} textAnchor="middle" fontFamily={theme.mono} fontSize={22} fill={theme.dim}>
            {'骨架 ≈30'}
          </text>
        </g>
        <g style={{opacity: barsR, transform: `translateY(${(1 - barsR) * 14}px)`}}>
          <rect x={1552} y={550} width={56} height={170} fill={theme.core} fillOpacity={0.12} stroke={theme.core} strokeWidth={2.5} />
          <text x={1580} y={528} textAnchor="middle" fontFamily={theme.mono} fontSize={22} fill={theme.core}>
            {'核心 1729'}
          </text>
        </g>
        <path d={GOLD_PATH} fill="none" stroke={GOLD} strokeWidth={9} opacity={0.22} {...goldDraw} />
        <path d={GOLD_PATH} fill="none" stroke={GOLD} strokeWidth={4} {...goldDraw} />
        <circle cx={D.cx} cy={D.cy} r={D.rFuse} fill="none" stroke={theme.ok} strokeWidth={3} opacity={0.8 * guardPulse * fuseDim} />
        <circle cx={300} cy={717} r={5.5} fill={GOLD} opacity={dotsO} />
        <circle cx={1580} cy={550} r={5.5} fill={GOLD} opacity={dotsO} />
      </svg>
      <Footnote delay={at(w12, 0.74)}>{'fuse layer'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P4CCSource: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const rel =
    (beat: {from: number}) =>
    (id: string): Win => {
      const g = w(id);
      return {from: g.from - beat.from, durationInFrames: g.durationInFrames};
    };

  const bA = w('p4-01', 'p4-03');
  const bB = w('p4-04');
  const bC = w('p4-05', 'p4-06');
  const bD = w('p4-07');
  const bE = w('p4-08', 'p4-09');
  const bF = w('p4-10', 'p4-11');
  const bG = w('p4-12', 'p4-14');
  const rA = rel(bA);
  const rB = rel(bB);
  const rC = rel(bC);
  const rD = rel(bD);
  const rE = rel(bE);
  const rF = rel(bF);
  const rG = rel(bG);

  // 幕级缩悬环：4-D「误判为已经结束」词窗冻结（环停=误判退出的空间对偶）
  const frame = useCurrentFrame();
  const ringO = useProgress(2, DUR.f5);
  const freezeAt = w('p4-07').from + Math.round(w('p4-07').durationInFrames * 0.5);
  const ringDot = ((Math.min(frame, freezeAt) / LAP_FRAMES) % 1 + 1) % 1;

  // 环体巡游相位接续（镜间身份恒常）
  const phaseE = bB.durationInFrames % LAP_FRAMES;
  const phaseF = (bB.durationInFrames + bC.durationInFrames + bD.durationInFrames + bE.durationInFrames) % LAP_FRAMES;
  const phaseG =
    (bB.durationInFrames + bC.durationInFrames + bD.durationInFrames + bE.durationInFrames + bF.durationInFrames) % LAP_FRAMES;

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: SCENE_RING.x, top: SCENE_RING.y, opacity: 0.9 * ringO}}>
        <LoopRing size={SCENE_RING.size} nodes={PENT_NODES} showLabels={false} showExit={false} dotProgress={ringDot} />
      </div>

      <Sequence {...bA} name="4-A">
        <ShotABaseline s1={rA('p4-01')} s2={rA('p4-02')} s3={rA('p4-03')} />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FieldCard s4={rB('p4-04')} />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <StreamDuel s5={rC('p4-05')} s6={rC('p4-06')} beatDur={bC.durationInFrames} />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <HaltDrop s7={rD('p4-07')} />
      </Sequence>
      <Sequence {...bE} name="4-E">
        <SwitchShot s8={rE('p4-08')} s9={rE('p4-09')} lapPhase={phaseE / LAP_FRAMES} />
      </Sequence>
      <Sequence {...bF} name="4-F">
        <ShotStateRim w10={rF('p4-10')} w11={rF('p4-11')} lapPhase={phaseF / LAP_FRAMES} />
      </Sequence>
      <Sequence {...bG} name="4-G">
        <ShotFuse w12={rG('p4-12')} w13={rG('p4-13')} w14={rG('p4-14')} lapPhase={phaseG / LAP_FRAMES} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4CCSource;
