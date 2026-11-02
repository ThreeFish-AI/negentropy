/** P5 收束与终章（p5-01..p5-07，4 镜）——分镜 5-A / 5-B / 5-C / 5-D。
 *
 *  幕间转场（4-C→5-A，头注明示）：语义断裂（生产对照→收束定格）走 SceneFade；
 *  环体以同形签名回归（镜间身份恒常，非 morph，承 ep2/ep18 判例）。
 *
 *  叙事链：5-A 环体定格收束（EWS）：p5-01「能力不靠改代码」词落位金句卡淡入、
 *  前半句压拍重读排版〔M-005〕、「发现、命名、组装」词落位后半句三词各闪一拍
 *  （三步回扣）→ p5-02「池每轮重拼」词落位池内卡片微涌一拍（活池终态）、
 *  「还是那个循环」词落位环体整环缓转一圈（循环母题回归；调模型段高亮收光
 *  归一——本集只讲这一拍）〔M-003〕→ 5-B 机制环体阵列远景（视觉层）：
 *  p5-03「单件都好」词落位各环剪影各自转起（单件在转）、「不等于整机就转」
 *  词落位整机轮廓虚位保持空转虚线（整体未动）→ p5-04「合体之后」词落位各环
 *  向轮廓内缓缓靠拢（聚拢待咬合）、「还转得动吗」词落位虚位齿轮停在将咬未咬
 *  一拍（悬念定格——只点问题不预告机制）→ 5-C 下期卡（视觉层）：p5-05
 *  「下期」词落位下期签点亮〔M-005〕、「终章」词落位大环剪影停驻定格 →
 *  5-D 片尾署源卡：p5-06 卡随口播同拍淡入、两行先后落定（署源专名口播例外
 *  随行）；p5-07 期间卡片静持（漂移警示由口播承载，卡面零复述），全片在此卡
 *  收束（黑场前最后画面）。
 *
 *  空间契约（安全带实算）：5-A 环体底 130+500=630 / 池底 260+220=480 / 金句卡
 *  底 660+150=810；5-B 环阵底 470+140=610（靠拢 -80 后 ≈ 530）/ 整机轮廓底
 *  430；5-C 大环底 255+430=685 / 文字底 ≈ 810；5-D 署源卡居中——全部 ≤ 860。
 *  红线落实：环体居中同形（描边色/线宽承全片锚定）、池嵌环位与 3-A 挂环位
 *  同位（主装置终态呼应——内外同池同色）、环体多段高亮禁（收光归一）、金句
 *  卡为唯一衬线体主体（caption-dup-ok 登记——storyboard 5-A 行）、环阵为剪影
 *  不显各集机制细节（反串线纪律——零他集标题/序号）、整机轮廓为虚线虚位、
 *  虚位齿轮不转起来（答案留终章）、下期+终章为唯一文字（≤4 字）、署源卡为
 *  最后画面且卡面 ≤3 行信息。词落位 = wa(id,f)；尾幕渐黑窗 = 末镜总时长。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, Panel, ToolPool} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFadeOut, useProgress} from '../motion';
import {ease} from '../components/motifs';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 5-A 环体定格收束 + 池嵌环终态 + 金句卡 ─────────────────────────────────────

/** 5-A 布局（安全带实算见头注；环中心 (950,380)、池嵌调模型段前置位右翼） */
const EA = {
  ring: {x: 700, y: 130, size: 500},
  pool: {x: 1210, y: 260, w: 400, h: 220},
  quote: {x: 330, y: 660, w: 900, h: 150},
} as const;

const FiveA: React.FC<{atQuote: number; atK1: number; atKw: number; atSurge: number; atTurn: number; durA: number}> = ({
  atQuote,
  atK1,
  atKw,
  atSurge,
  atTurn,
  durA,
}) => {
  const frame = useCurrentFrame();
  // 金句卡淡入 + 前半句压拍重读 + 后半句三词各闪一拍
  const quote = clamp01(progress(frame, atQuote, 14));
  const k1 = Math.sin(Math.PI * clamp01(progress(frame, atK1, 16)));
  const kw = [0, 1, 2].map((k) => Math.sin(Math.PI * clamp01(progress(frame, atKw + k * 8, 12))));
  // 池内卡片微涌一拍（活池终态）
  const surge = clamp01(progress(frame, atSurge, 20));
  const surgeLift = Math.sin(Math.PI * surge) * -7;
  // 环体整环缓转一圈（循环母题回归）+ 调模型段高亮收光归一
  const turn = ease(clamp01(progress(frame, atTurn, Math.max(30, durA - atTurn - 6))));
  const arcFade = 1 - turn * 0.75;
  return (
    <AbsoluteFill>
      {/* 陶土橙环体（居中同形回归——整环缓转一圈） */}
      <div
        style={{
          position: 'absolute',
          left: EA.ring.x,
          top: EA.ring.y,
          transform: `rotate(${turn * 360}deg)`,
          transformOrigin: `${EA.ring.size / 2}px ${EA.ring.size / 2}px`,
        }}
      >
        <LoopRing size={EA.ring.size} nodes={[]} showExit={false} dotProgress={(frame / 90) % 1} />
      </div>
      {/* 调模型段高亮（收光归一——本集只讲这一拍；随环转前淡出） */}
      <div style={{position: 'absolute', left: EA.ring.x, top: EA.ring.y, opacity: arcFade}}>
        <svg width={EA.ring.size} height={EA.ring.size} style={{overflow: 'visible'}}>
          <path
            d={`M ${(EA.ring.size / 2 + (EA.ring.size / 2 - 46) * Math.cos((-54 * Math.PI) / 180)).toFixed(2)} ${(EA.ring.size / 2 + (EA.ring.size / 2 - 46) * Math.sin((-54 * Math.PI) / 180)).toFixed(2)} A ${EA.ring.size / 2 - 46} ${EA.ring.size / 2 - 46} 0 0 1 ${(EA.ring.size / 2 + (EA.ring.size / 2 - 46) * Math.cos((18 * Math.PI) / 180)).toFixed(2)} ${(EA.ring.size / 2 + (EA.ring.size / 2 - 46) * Math.sin((18 * Math.PI) / 180)).toFixed(2)}`}
            fill="none"
            stroke={theme.core}
            strokeWidth={10}
            strokeLinecap="round"
          />
          <path
            d={`M ${(EA.ring.size / 2 + (EA.ring.size / 2 - 46) * Math.cos((-54 * Math.PI) / 180)).toFixed(2)} ${(EA.ring.size / 2 + (EA.ring.size / 2 - 46) * Math.sin((-54 * Math.PI) / 180)).toFixed(2)} A ${EA.ring.size / 2 - 46} ${EA.ring.size / 2 - 46} 0 0 1 ${(EA.ring.size / 2 + (EA.ring.size / 2 - 46) * Math.cos((18 * Math.PI) / 180)).toFixed(2)} ${(EA.ring.size / 2 + (EA.ring.size / 2 - 46) * Math.sin((18 * Math.PI) / 180)).toFixed(2)}`}
            fill="none"
            stroke={theme.core}
            strokeWidth={22}
            strokeLinecap="round"
            opacity={0.22}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: EA.ring.size / 2 + 176,
            top: EA.ring.size / 2 - 110,
            padding: '3px 12px',
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(theme.core, 0.7)}`,
            fontFamily: theme.sans,
            fontSize: 16,
            fontWeight: 700,
            color: theme.core,
            whiteSpace: 'nowrap',
          }}
        >
          调模型
        </div>
      </div>
      {/* 深空蓝工具池（嵌进环体调模型段前置位——主装置终态：内外同池同色） */}
      <ToolPool
        x={EA.pool.x}
        y={EA.pool.y}
        w={EA.pool.w}
        h={EA.pool.h}
        litP={1}
        fillP={1}
        labelP={1}
        capTag="内外同池"
        capP={1}
        cards={[
          {name: '内置 ×5', litP: 1},
          {name: '查状态', litP: 1},
          {name: '触发部署', litP: 1},
          {name: '搜文档', litP: 1},
        ]}
      />
      {/* 池内微涌的可视（surgeLift 由卡片 bob 承载——此处给池体一拍辉光） */}
      {surge > 0.05 && surge < 0.95 ? (
        <div
          style={{
            position: 'absolute',
            left: EA.pool.x - 6,
            top: EA.pool.y - 6,
            width: EA.pool.w + 12,
            height: EA.pool.h + 12,
            borderRadius: 28,
            border: `3px solid ${withAlpha(theme.pool, 0.5 * Math.sin(Math.PI * surge))}`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {/* 金句卡（衬线体唯一主体——caption-dup-ok: 金句卡复述收束句（收束定格仪式，承 ep1/ep2/ep18 5-A 豁免先例——storyboard 5-A 行登记） */}
      {quote > 0.02 ? (
        <div style={{position: 'absolute', left: EA.quote.x, top: EA.quote.y, width: EA.quote.w, opacity: quote, transform: `translateY(${(1 - quote) * 18}px)`, zIndex: 3}}>
          <Panel accent={withAlpha(theme.core, 0.55)} style={{padding: '26px 46px', textAlign: 'center'}}>
            <div style={{fontFamily: theme.serif, fontSize: 38, color: theme.text, whiteSpace: 'nowrap'}}>
              <span style={{fontWeight: 700, color: theme.core, display: 'inline-block', transform: `scale(${1 + 0.05 * k1})`}}>能力不靠改代码</span>
              <span>{' · '}</span>
              <span style={{fontWeight: 700, color: theme.pool, display: 'inline-block', transform: `scale(${1 + 0.04 * kw[0]})`}}>发现</span>
              <span>{'、'}</span>
              <span style={{fontWeight: 700, color: theme.svc, display: 'inline-block', transform: `scale(${1 + 0.04 * kw[1]})`}}>命名</span>
              <span>{'、'}</span>
              <span style={{fontWeight: 700, color: theme.pool, display: 'inline-block', transform: `scale(${1 + 0.04 * kw[2]})`}}>组装</span>
            </div>
          </Panel>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'能力接进来 · 池每轮重拼 · 循环还是那个循环'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 机制环体阵列远景：环阵剪影自转 + 整机轮廓虚位 + 聚拢待咬合 ──────────────

/** 5-B 布局（安全带实算见头注；环阵剪影——反串线纪律：不显各集机制细节） */
const EB = {
  outline: {x: 510, y: 120, w: 900, h: 310},
  rings: [260, 470, 680, 890, 1100, 1310],
  ours: {x: 1560, y: 450, size: 170},
} as const;

const FiveB: React.FC<{atSelf: number; atVoid: number; atConverge: number; atHold: number}> = ({atSelf, atVoid, atConverge, atHold}) => {
  const frame = useCurrentFrame();
  // 各环剪影各自转起（单件在转）
  const selfTurn = clamp01(progress(frame, atSelf, 16));
  // 整机轮廓虚位保持空转虚线（整体未动——单件 vs 整机的对照）
  const voidHold = clamp01(progress(frame, atVoid, 14));
  // 各环向轮廓内缓缓靠拢（聚拢待咬合）
  const converge = ease(clamp01(progress(frame, atConverge, 24)));
  // 虚位齿轮停在将咬未咬一拍（悬念定格）
  const hold = clamp01(progress(frame, atHold, 14));
  return (
    <AbsoluteFill>
      {/* 整机轮廓（虚线大轮廓 + 内部齿轮虚位——未合体是悬念语义） */}
      <div style={{position: 'absolute', left: EB.outline.x, top: EB.outline.y, width: EB.outline.w, height: EB.outline.h, opacity: 0.4 + 0.35 * voidHold}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 26,
            border: `4px dashed ${withAlpha(theme.dim, 0.55)}`,
          }}
        />
        {/* 齿轮虚位（两枚 dashed 齿圆——将咬未咬，不转起来） */}
        {[{cx: 350, cy: 150, r: 92}, {cx: 560, cy: 190, r: 66}].map((g, i) => (
          <svg key={`gr${i}`} width={EB.outline.w} height={EB.outline.h} style={{position: 'absolute', inset: 0}}>
            <circle cx={g.cx} cy={g.cy} r={g.r} fill="none" stroke={theme.dim} strokeWidth={3.5} strokeDasharray="10 9" opacity={0.6 + 0.3 * hold} />
            <circle cx={g.cx} cy={g.cy} r={g.r * 0.32} fill="none" stroke={withAlpha(theme.dim, 0.5)} strokeWidth={3} />
            {/* 将咬未咬的咬合标记（停在齿切点——不动） */}
            <circle cx={g.cx + g.r * (i === 0 ? 0.72 : -0.72)} cy={g.cy - g.r * 0.6} r={7} fill={theme.dim} opacity={hold} />
          </svg>
        ))}
        <div style={{position: 'absolute', left: 24, top: 18, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
          整机 · 虚位
        </div>
      </div>
      {/* 环阵剪影（各自缓转——暗调剪影不点名任何机制；靠拢上移） */}
      {EB.rings.map((rx, i) => (
        <div
          key={`rr${i}`}
          style={{
            position: 'absolute',
            left: rx + converge * (EB.outline.x + EB.outline.w / 2 - rx - 420 + i * 130) * 0.16,
            top: 470 - converge * (80 - i * 8),
            opacity: 0.55,
          }}
        >
          <svg width={140} height={140} viewBox="0 0 140 140" style={{transform: `rotate(${selfTurn * (i % 2 === 0 ? 180 : -180)}deg)`}}>
            <circle cx={70} cy={70} r={52} fill="none" stroke={theme.dim} strokeWidth={5} opacity={0.7} />
            <circle cx={70} cy={70} r={52} fill="none" stroke={withAlpha(theme.dim, 0.35)} strokeWidth={12} strokeDasharray="6 18" />
          </svg>
        </div>
      ))}
      {/* 本集环体（含嵌池——驻阵列末位，同形签名） */}
      <div style={{position: 'absolute', left: EB.ours.x - converge * 40, top: EB.ours.y - converge * 30}}>
        <LoopRing size={EB.ours.size} nodes={[]} showExit={false} dotProgress={(frame / 110) % 1} />
        <div style={{position: 'absolute', left: EB.ours.size / 2 + 68, top: EB.ours.size / 2 - 30, width: 88, height: 56, borderRadius: 10, border: `3px solid ${theme.pool}`, background: withAlpha(theme.pool, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.sans, fontSize: 14, fontWeight: 700, color: theme.pool, whiteSpace: 'nowrap'}}>
          池
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'单件都好 · 整机还转得动吗'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 下期卡：大环剪影汇聚浮起 + 「下期」签 + 「终章」 ─────────────────────────

/** 5-C 布局（安全带实算：大环 255..685 / 签 ≤ 320 / 文字底 ≈ 810，恒 ≤ 860） */
const EC = {ring: {x: 745, y: 255, size: 430}} as const;

const FiveC: React.FC<{atNext: number; atFinal: number}> = ({atNext, atFinal}) => {
  const frame = useCurrentFrame();
  // 下期签点亮
  const next = clamp01(progress(frame, atNext, 10));
  // 大环剪影自下浮起 → 终章字样随签点亮 → 停驻定格
  const rise = ease(clamp01(progress(frame, atNext, 24)));
  const finalP = clamp01(progress(frame, atFinal, 12));
  return (
    <AbsoluteFill>
      {/* 大环剪影（众环汇聚成一枚——自下浮起；不显机制细节） */}
      <div style={{position: 'absolute', left: EC.ring.x, top: EC.ring.y + (1 - rise) * 240, opacity: rise}}>
        <svg width={EC.ring.size} height={EC.ring.size} viewBox={`0 0 ${EC.ring.size} ${EC.ring.size}`} style={{overflow: 'visible'}}>
          <circle cx={EC.ring.size / 2} cy={EC.ring.size / 2} r={EC.ring.size / 2 - 60} fill="none" stroke={theme.dim} strokeWidth={7} opacity={0.75} />
          <circle cx={EC.ring.size / 2} cy={EC.ring.size / 2} r={EC.ring.size / 2 - 60} fill="none" stroke={withAlpha(theme.dim, 0.3)} strokeWidth={18} strokeDasharray="8 26" />
          {/* 咬合虚位（承 5-B 齿轮——合体预告的剪影态，停在将咬未咬） */}
          {[0, 1, 2].map((k) => {
            const a = (-90 + k * 120) * (Math.PI / 180);
            const cx = EC.ring.size / 2 + (EC.ring.size / 2 - 60) * Math.cos(a);
            const cy = EC.ring.size / 2 + (EC.ring.size / 2 - 60) * Math.sin(a);
            return <circle key={`cg${k}`} cx={cx} cy={cy} r={16} fill="none" stroke={theme.dim} strokeWidth={4} strokeDasharray="6 6" opacity={finalP} />;
          })}
        </svg>
      </div>
      {/* 「下期」签（点亮——唯一文字之一） */}
      {next > 0.02 ? (
        <div style={{position: 'absolute', left: 1190, top: 262, opacity: next}}>
          <div
            style={{
              padding: '10px 30px',
              borderRadius: 12,
              border: `3px solid ${withAlpha(theme.text, 0.5 + 0.5 * next)}`,
              background: withAlpha(theme.panel, 0.97),
              fontFamily: theme.serif,
              fontSize: 30,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              letterSpacing: 6,
            }}
          >
            下期
          </div>
        </div>
      ) : null}
      {/* 「终章」字样（随签点亮——≤4 字红线） */}
      {finalP > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 738,
            textAlign: 'center',
            fontFamily: theme.serif,
            fontSize: 44,
            fontWeight: 700,
            color: theme.text,
            letterSpacing: 14,
            opacity: finalP,
          }}
        >
          终章
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ── 5-D 片尾署源卡（尾部署源位——豁免登记于工作区配置） ────────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-06 口播同拍淡入；两行先后落定（署源专名口播例外随行）
  const card = useEnter('rise', {at: atCard + 2, dur: DUR.f6, dist: 24, restBottom: 560});
  const l1At = atCard + Math.round(durCard * 0.3);
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
      <Panel accent={withAlpha(theme.svc, 0.4)} style={{position: 'relative', padding: '46px 64px', textAlign: 'center'}}>
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

/** 幕末渐黑（红线四）：窗 = 末镜总时长（p5-06..p5-07 之和），终点即本幕终点 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P5PoolIntoRing: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p5-01', 'p5-02');
  const bB = w('p5-03', 'p5-04');
  const bC = w('p5-05');
  const bD = w('p5-06', 'p5-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <FiveA
          atQuote={wa('p5-01', 0.3) - bA.from}
          atK1={wa('p5-01', 0.36) - bA.from}
          atKw={wa('p5-01', 0.6) - bA.from}
          atSurge={wa('p5-02', 0.06) - bA.from}
          atTurn={wa('p5-02', 0.68) - bA.from}
          durA={bA.durationInFrames}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <FiveB
          atSelf={wa('p5-03', 0.4) - bB.from}
          atVoid={wa('p5-03', 0.66) - bB.from}
          atConverge={wa('p5-04', 0.15) - bB.from}
          atHold={wa('p5-04', 0.7) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <FiveC atNext={wa('p5-05', 0.15) - bC.from} atFinal={wa('p5-05', 0.62) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="5-D">
        <CreditCard atCard={at('p5-06') - bD.from} durCard={span('p5-06')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bD.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5PoolIntoRing;
