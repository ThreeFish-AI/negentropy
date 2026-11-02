/** P5 收束与下期（p5-01..p5-07，3 镜）——分镜 5-A / 5-B / 5-C。
 *
 *  ★ 5-A 会议室群定格收束（EWS）：主会场居中始终清爽（钢蓝，消息列高度恒定
 *    ——新结论卡飞入即压缩归档为短条、列高不增长），四周多间紫色会议室开合、
 *    结论卡持续飞入主会场（绿闪）/ 过程条在紫室内淡出的循环往复（机制终态的
 *    自解说）；金句卡（衬线体）随后覆上层：「可见性即影响力 · 干净是被管理
 *    出来的」两关键词各压一拍重读排版（caption-dup-ok：金句卡刻意复述——
 *    收束定格仪式，承 ep1/ep2 5-A 豁免先例）。
 *  ★ 5-B 知识钩（CU）：知识文档堆剪影（承 4-F 压来位）长成主景——文档卡层层
 *    叠高、行数计数疯涨（几千行）、堆顶溢出画框上缘一拍（exaggeration 只作用
 *    于概念层）、堆底费用小卡同步变厚（养不起）；下期卡浮起定格（只点问题
 *    不预告机制——卡面无机制图形、无机制名）。
 *  ★ 5-C 片尾署源卡（尾部署源位，RSI I-080 豁免；署源句 = p5-06）：主行
 *    Learn Claude Code / 次行仓库地址 / 角注 MIT（卡面 ≤3 行）；p5-07 期间
 *    卡片静持（漂移警示由口播承载、卡面零复述）；全片在此卡收束。
 *  ★ 尾幕渐黑（红线四）：窗取末 beat 总时长（p5-06..p5-07 之和）——终点即
 *    本幕终点。收尾版式不挂 SceneTag（承 ep1–ep5 先例）。
 *
 *  空间契约：主会场消息列高度恒定（清爽的可核对判据）、紫室开合不越主会场
 *    边界、文档堆不与结论卡混流（5-B 无主会场——没进场语义）、下期卡无机制
 *    细节、署源卡为最后画面、卡面 ≤3 行信息。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；「下期」顺序无关收尾语。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ConclusionCard, DocStack, LoopRing, Panel, RoomGlyph, useRingDot} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFadeOut, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 5-A 会议室群定格收束 + 金句卡 ───────────────────────────────────────

/** 群像几何（EWS——主会场居中 + 四周紫室） */
const HALL = {cx: 960, cy: 590, w: 620, h: 470} as const;
const ROOMS = [
  {cx: 350, cy: 350},
  {cx: 1570, cy: 350},
  {cx: 350, cy: 760},
  {cx: 1570, cy: 760},
] as const;

const QuoteShot: React.FC<{atGroup: number; atLoop: number; atCard: number; atK1: number; atK2: number}> = ({
  atGroup,
  atLoop,
  atCard,
  atK1,
  atK2,
}) => {
  const frame = useCurrentFrame();
  // 群像定格收束（EWS 承 4-F 同形签名回归）
  const group = useProgress(atGroup, DUR.f6, 'decelerate');
  // 循环往复：紫室开合（呼吸周期错相）+ 结论卡飞入 + 过程条淡出
  const loop = clamp01(progress(frame, atLoop, DUR.f5));
  const cycle = (period: number, offset: number) => (((frame + offset) % period) + period) % period / period;
  const dot = useRingDot(2.5);
  // 金句卡淡入 + 两关键词各压一拍重读
  const card = useProgress(atCard, DUR.f6);
  const k1 = useImpulse({at: atK1, dur: DUR.f6, peak: 0.06});
  const k2 = useImpulse({at: atK2, dur: DUR.f6, peak: 0.06});
  const k1Glow = useProgress(atK1, DUR.f5);
  const k2Glow = useProgress(atK2, DUR.f5);
  return (
    <AbsoluteFill>
      {/* 主会场（居中——消息列高度恒定：新结论飞入即压缩归档为短条、列高不增长） */}
      <RoomGlyph cx={HALL.cx} cy={HALL.cy} w={HALL.w} h={HALL.h} accent={theme.steel} label={'主会场 · 主对话'} lit={group} open={1} />
      <div style={{position: 'absolute', left: HALL.cx - HALL.w / 2 + 30, top: HALL.cy - HALL.h / 2 + 70, width: HALL.w - 60, height: 300}}>
        {/* 恒定五短条（清爽——高度恒定的可核对判据） */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: i * 52,
              width: '100%',
              height: 40,
              boxSizing: 'border-box',
              borderRadius: 7,
              border: `2px solid ${withAlpha(theme.steel, 0.5)}`,
              background: withAlpha(theme.steel, 0.06),
              opacity: group * (0.55 + 0.09 * i),
            }}
          />
        ))}
        {/* 飞入压缩归档（最新结论落列顶即变短条——列高不增长） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: 40,
            boxSizing: 'border-box',
            borderRadius: 7,
            border: `2.5px solid ${theme.steel}`,
            background: withAlpha(theme.steel, 0.16),
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 12,
            fontFamily: theme.sans,
            fontSize: 15,
            fontWeight: 600,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: group * loop,
            boxShadow: `0 0 ${12 * loop}px ${withAlpha(theme.ok, 0.5)}`,
          }}
        >
          {'结论 · 归档'}
        </div>
      </div>
      {/* 环体常驻（主会场内——会议室群中的心跳） */}
      <div style={{position: 'absolute', left: HALL.cx - 70, top: HALL.cy + 90, opacity: group * 0.85}}>
        <LoopRing size={140} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {/* 四周紫室（开合呼吸——不越主会场边界；过程条在室内淡出） */}
      {ROOMS.map((r, i) => {
        const open = 0.5 + 0.5 * Math.sin((frame / 64) * Math.PI * 2 + i * 1.7);
        const procFade = 0.35 + 0.4 * Math.sin((frame / 48) * Math.PI * 2 + i * 2.3);
        return (
          <div key={i}>
            <RoomGlyph cx={r.cx} cy={r.cy} w={340} h={240} accent={theme.mech} label={`子代理 ${i + 1}`} lit={group} open={open} />
            {/* 过程条（室内淡出循环——过程退场） */}
            <div style={{position: 'absolute', left: r.cx - 140, top: r.cy - 60, width: 280, height: 170, opacity: group * procFade * 0.5}}>
              {[0, 1, 2].map((k) => (
                <div
                  key={k}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 20 + k * 44,
                    width: 240 - k * 40,
                    height: 26,
                    borderRadius: 6,
                    border: `2px solid ${withAlpha(theme.dim, 0.45)}`,
                  }}
                />
              ))}
            </div>
            {/* 结论卡（持续飞入主会场——绿闪循环） */}
            {group > 0.5 ? (
              <div
                style={{
                  position: 'absolute',
                  left: r.cx + (HALL.cx - r.cx) * Math.min(1, cycle(96, i * 24)),
                  top: r.cy + (HALL.cy - r.cy) * Math.min(1, cycle(96, i * 24)) - 26,
                  opacity: clamp01(cycle(96, i * 24)) * (1 - clamp01(cycle(96, i * 24) - 0.85) * 6),
                }}
              >
                <ConclusionCard x={0} y={0} w={190} h={44} lit={1} text={'结论'} tag={''} flash={Math.max(0, 1 - cycle(96, i * 24) * 8)} />
              </div>
            ) : null}
          </div>
        );
      })}
      {/* 金句卡（衬线体——覆上层） */}
      <div
        style={{
          position: 'absolute',
          left: 330,
          top: 96,
          opacity: card,
          transform: `translateY(${(1 - card) * 22}px)`,
        }}
      >
        <Panel accent={theme.steel} style={{padding: '30px 54px', display: 'inline-block'}}>
          <div style={{fontFamily: theme.serif, fontSize: 50, color: theme.text, lineHeight: 1.3, whiteSpace: 'nowrap'}}>
            {/* caption-dup-ok: 金句卡刻意复述（收束定格仪式，承 ep1 5-A / ep2 5-A 豁免先例） */}
            <span style={{fontWeight: 700, color: theme.steel, display: 'inline-block', transform: `scale(${1 + k1})`, textShadow: k1Glow > 0.01 ? `0 0 ${22 * k1Glow}px ${withAlpha(theme.steel, 0.5)}` : 'none'}}>
              {'可见性即影响力'}
            </span>
            <span style={{color: theme.dim}}>{' · '}</span>
            <span style={{fontWeight: 700, color: theme.steel, display: 'inline-block', transform: `scale(${1 + k2})`, textShadow: k2Glow > 0.01 ? `0 0 ${22 * k2Glow}px ${withAlpha(theme.steel, 0.5)}` : 'none'}}>
              {'干净是被管理出来的'}
            </span>
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7 * group}}>
        {'结论进场 · 过程退场'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 知识钩：文档堆长成主景 + 下期卡 ─────────────────────────────────

const NextShot: React.FC<{atPress: number; atRows: number; atOverflow: number; atCost: number; atCard: number; atDim: number}> = ({
  atPress,
  atRows,
  atOverflow,
  atCost,
  atCard,
  atDim,
}) => {
  const frame = useCurrentFrame();
  // 文档堆自边缘压入主景（承 4-F 压来位——没进场语义：不与结论卡混流）
  const press = useProgress(atPress, DUR.f6, 'decelerate');
  // 「几千行」行数计数疯涨（读数疯涨、概念层夸张）
  const rows = 3800 * clamp01(progress(frame, atRows, DUR.f6 + DUR.f4));
  // 「装不下」堆顶溢出画框上缘一拍（exaggeration 只作用于概念层）
  const overflow = useImpulse({at: atOverflow, dur: DUR.f5, peak: 1});
  // 「养不起」堆底费用小卡同步变厚
  const cost = useProgress(atCost, DUR.f5);
  // 「下期」下期卡浮起定格（只点问题不预告机制——卡面无机制图形）
  const card = useProgress(atCard, DUR.f5);
  const dimAll = useProgress(atDim, DUR.f4);
  return (
    <AbsoluteFill>
      <DocStack x={480} y={300} w={680} lit={1} press={press} grow={0.5 + 0.5 * overflow} rows={rows} overflow={overflow} cost={cost} />
      {/* 行数计数（疯涨读数——旁侧大数） */}
      <div style={{position: 'absolute', left: 1210, top: 340, opacity: press}}>
        <div style={{fontFamily: theme.mono, fontSize: 60, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1}}>
          {Math.round(rows).toLocaleString('en-US')}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 8}}>{'行 · 全前置'}</div>
      </div>
      {/* 下期卡（浮起定格——问题剪影 + 「下期」签；无机制名） */}
      <div style={{position: 'absolute', left: 1330, top: 560, opacity: card, transform: `translateY(${(1 - card) * 26}px)`}}>
        <Panel accent={theme.core} style={{padding: '26px 32px', position: 'relative'}}>
          <svg width={220} height={130} viewBox="0 0 220 130">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line
                key={i}
                x1={18}
                y1={16 + i * 18}
                x2={202 - ((i * 43) % 70)}
                y2={16 + i * 18}
                stroke={withAlpha(theme.dim, 0.55)}
                strokeWidth={5}
                strokeLinecap="round"
              />
            ))}
            <line x1={14} y1={8} x2={206} y2={8} stroke={withAlpha(theme.danger, 0.55)} strokeWidth={3} strokeDasharray="7 7" />
          </svg>
          <div style={{textAlign: 'center', fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.text, letterSpacing: 10, paddingLeft: 10, marginTop: 10}}>
            {'下期'}
          </div>
        </Panel>
      </div>
      <AbsoluteFill style={{background: '#000', opacity: 0.62 * dimAll, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

// ── 5-C 片尾署源卡（尾部署源位，RSI I-080 豁免） ─────────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-06 口播同拍淡入；两行先后落定（署源专名约 0.6 处被念到，次行隔拍跟落）
  const card = useEnter('rise', {at: atCard + 2, dur: DUR.f6, dist: 24, restBottom: 560});
  const l1At = atCard + Math.round(durCard * 0.6);
  const l1 = useProgress(l1At, DUR.f5);
  const l2At = l1At + DUR.f6;
  const l2 = useProgress(l2At, DUR.f5);
  const mit = useProgress(l2At + 8, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: 316,
        opacity: card.opacity,
        transform: card.transform,
      }}
    >
      <Panel accent={withAlpha(theme.mech, 0.4)} style={{position: 'relative', padding: '46px 64px', textAlign: 'center'}}>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 56,
            fontWeight: 700,
            color: theme.text,
            letterSpacing: 2,
            whiteSpace: 'nowrap',
            opacity: l1,
            transform: `translateY(${(1 - l1) * 12}px)`,
          }}
        >
          {'Learn Claude Code'}
        </div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 28,
            color: theme.dim,
            marginTop: 20,
            whiteSpace: 'nowrap',
            opacity: l2,
            transform: `translateY(${(1 - l2) * 10}px)`,
          }}
        >
          {'github.com/shareAI-lab/learn-claude-code'}
        </div>
        {/* 角注（卡面第 3 行信息，≤3 行封顶） */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 20,
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.dim,
            letterSpacing: 1,
            opacity: mit * 0.9,
          }}
        >
          {'MIT'}
        </div>
      </Panel>
    </div>
  );
};

/** 幕末渐黑（红线四）：窗 = 末 beat 总时长（p5-06..p5-07 之和），终点即本幕终点 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P5RoomsAndNext: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p5-01', 'p5-02');
  const bB = w('p5-03', 'p5-05');
  const bC = w('p5-06', 'p5-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <QuoteShot
          atGroup={0}
          atLoop={wa('p5-02', 0.08) - bA.from}
          atCard={wa('p5-01', 0.26) - bA.from}
          atK1={wa('p5-01', 0.5) - bA.from}
          atK2={wa('p5-01', 0.82) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <NextShot
          atPress={wa('p5-03', 0.44) - bB.from}
          atRows={wa('p5-04', 0.24) - bB.from}
          atOverflow={wa('p5-04', 0.56) - bB.from}
          atCost={wa('p5-04', 0.8) - bB.from}
          atCard={wa('p5-05', 0.24) - bB.from}
          atDim={at('p5-05') + span('p5-05') - Math.min(10, span('p5-05') / 4) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <CreditCard atCard={at('p5-06') - bC.from} durCard={span('p5-06')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bC.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5RoomsAndNext;
