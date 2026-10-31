/** P5 收束与下期（p5-01..p5-07，4 镜）——分镜 5-A / 5-B / 5-C / 5-D。
 *
 *  ★ 5-A 环体定格收束 + 金句卡（衬线体）「安全靠机制 · 不靠自觉」——0-C
 *    预亮空卡在此落字（立场卡生命周期闭合）；环体居中同形回归〔M-001〕（描边
 *    色/线宽承全片锚定），闸卡驻位执行段前微光确认（主装置收束态）；背景
 *    生产面板元素整体退为暗层。「一行没改」环体整环静止一拍（静止即陈述）。
 *    caption-dup-ok: 金句卡刻意复述（收束定格仪式，承 ep1/ep2 5-A 豁免先例）
 *  ★ 5-B 闸门给胆帧（单句重音镜）：危险动作卡（警示红）照旧自模型侧冲出——
 *    0-A 同款代码之手（陶土橙描边）再次按下停闸、卡在落地前刹停（首尾同款
 *    拦截面，危机在此转为安心）；手边一枚「胆」字小签。
 *  ★ 5-C 下期钩子：检查签（裁决紫小签）一行行钉进环体内、越钉越密（写死在
 *    循环里的空间陈述）；环体描边局部锈蚀斑漫开（腐化帧，视觉层）；下期卡
 *    浮起（缠结的环体剪影——检查签缠成一团，只点问题不预告机制）+「下期」签。
 *  ★ 5-D 片尾署源卡（尾部署源位，RSI I-080 豁免）：主行 Learn Claude Code /
 *    次行仓库地址 / 角注 MIT（卡面 ≤3 行）；p5-07 漂移警示由口播承载、卡面
 *    零复述；全片在此卡收束（黑场前最后画面）。
 *  ★ 尾幕渐黑（红线四）：窗取末 beat 总时长（p5-06..p5-07 之和）——终点即本幕
 *    终点，勿改用末句单句窗。收尾版式不挂 SceneTag（承 ep1/ep2 先例）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BrainGlyph, CodeHand, GateCard, LoopRing, Panel} from '../components/motifs';
import {DUR, clamp01, progress, useBreathe, useEnter, useFadeOut, useImpulse, useProgress} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 金句关键词：重读排版（字重/字号差）+ 词落位各压一拍（一次性脉冲 + 常驻辉光）。
 *  ⑨ QA RISKY-2：强调字色钉裁决紫 theme.mech（#7C6FF0），依据 = storyboard 头部
 *  视觉契约「裁决链/三道闸门 = 裁决紫（本集主题色）」——收束金句强调词「机制」
 *  即闸门机制的收束指称；color 为常量、不随词窗相位变化（draft 帧实测的陶土橙
 *  为旧 theme 布线的陈旧渲，非现行代码态），辉光只改强度不改色相。 */
const KeyWord: React.FC<{at: number; children: React.ReactNode}> = ({at, children}) => {
  const pop = useImpulse({at, dur: DUR.f6, peak: 0.07});
  const glow = useProgress(at, DUR.f5);
  return (
    <span
      style={{
        fontSize: 68,
        fontWeight: 700,
        color: theme.mech,
        display: 'inline-block',
        transform: `scale(${1 + pop})`,
        textShadow: glow > 0.01 ? `0 0 ${22 * glow}px ${withAlpha(theme.mech, 0.5)}` : 'none',
      }}
    >
      {children}
    </span>
  );
};

// ── 5-A 环体定格收束 + 金句卡落字 ───────────────────────────────────────

const QUOTE_A = {cx: 960, cy: 530, size: 600} as const;

const QuoteShot: React.FC<{atRing: number; atQuote: number; atMechW: number; atSelf: number; atStill: number; atGate: number}> = ({
  atRing,
  atQuote,
  atMechW,
  atSelf,
  atStill,
  atGate,
}) => {
  const ringO = useProgress(atRing, DUR.f5);
  const card = useEnter('pop', {at: atQuote + 6, dur: DUR.f6});
  // 「一行没改」：环体整环静止一拍（定格 + 辉光一次不过冲）
  const stillGlow = useImpulse({at: atStill, dur: DUR.f6});
  // 「多了一道裁决」：闸卡微光确认一次（收束态——驻位执行段前）
  const gateGlow = useImpulse({at: atGate, dur: DUR.f5, peak: 1});
  const r = QUOTE_A.size / 2 - 46;
  const gatePt = {x: QUOTE_A.cx + r * Math.cos((86 * Math.PI) / 180), y: QUOTE_A.cy + r * Math.sin((86 * Math.PI) / 180)};
  return (
    <AbsoluteFill>
      {/* 背景生产面板元素退为暗层（4 幕四格残影——收束水印） */}
      <div style={{position: 'absolute', inset: 0, opacity: 0.14}}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 360 + i * 250,
              top: 300,
              width: 218,
              height: 168,
              borderRadius: 14,
              border: `2px dashed ${theme.panelBorder}`,
            }}
          />
        ))}
      </div>
      {/* 环体居中同形回归（M-001：恒 core 描边 + RING_STROKE；定格不转） */}
      <div style={{position: 'absolute', left: QUOTE_A.cx - QUOTE_A.size / 2, top: QUOTE_A.cy - QUOTE_A.size / 2, opacity: ringO * 0.55}}>
        <LoopRing size={QUOTE_A.size} nodes={[0, 1, 2, 3, 4].map((i) => ({label: `s${i}`, angle: -90 + i * 72}))} showLabels={false} showExit={false} dimNodes />
      </div>
      {stillGlow > 0.01 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          <circle cx={QUOTE_A.cx} cy={QUOTE_A.cy} r={r} fill="none" stroke={theme.core} strokeWidth={10} opacity={0.6 * stillGlow} />
        </svg>
      ) : null}
      {/* 闸卡驻位执行段前（主装置收束态——微光确认一次，本镜无状态变化） */}
      <div style={{position: 'absolute', left: gatePt.x - 70, top: gatePt.y - 66, opacity: ringO * 0.92}}>
        <GateCard x={0} y={0} w={140} h={130} kind="deny" lit={0.9} showName={false} />
        {gateGlow > 0.01 ? (
          <div
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: 14,
              border: `3px solid ${theme.mech}`,
              boxShadow: `0 0 ${24 * gateGlow}px ${withAlpha(theme.mech, 0.75)}`,
              opacity: gateGlow,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
      {/* 金句卡（唯一主体，衬线体；caption-dup-ok: 收束定格仪式，承 ep1/ep2 5-A 豁免先例） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: card.opacity,
          transform: card.transform,
        }}
      >
        <Panel accent={theme.mech} style={{padding: '54px 76px'}}>
          <div style={{fontFamily: theme.serif, fontSize: 54, color: theme.text, lineHeight: 1.25, whiteSpace: 'nowrap'}}>
            {'安全靠'}
            <KeyWord at={atMechW}>{'机制'}</KeyWord>
            {' · 不靠'}
            <KeyWord at={atSelf}>{'自觉'}</KeyWord>
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 闸门给胆：危险卡照旧冲出，代码之手再按停闸 ──────────────────────

const GiveNerveShot: React.FC<{atDash: number; atHand: number; atSign: number}> = ({atDash, atHand, atSign}) => {
  // 危险动作卡：照旧自模型侧冲出（危险不消失——模型照旧会试）
  const dash = useProgress(atDash, DUR.f5, 'accelerate');
  const stopX = 1080;
  const cardX = 430 + (stopX - 430) * dash;
  // 0-A 同款代码之手再次按下停闸（拦它的是代码——与 0-A 同构首尾拦截面）
  const handIn = useProgress(0, DUR.f4);
  const press = useProgress(atHand, DUR.f3);
  const brake = useImpulse({at: atHand + DUR.f2, dur: DUR.f3, peak: 0.1});
  // 手边「胆」字小签
  const sign = useEnter('pop', {at: atSign, dur: DUR.f4, springPreset: 'settle'});
  return (
    <AbsoluteFill>
      {/* 模型侧（危险照旧来自模型——模型照旧会试） */}
      <div style={{position: 'absolute', left: 210, top: 370, display: 'flex', alignItems: 'center', gap: 18, opacity: handIn}}>
        <BrainGlyph color={theme.text} />
        <div>
          <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>{'模型'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'照旧会试'}</div>
        </div>
      </div>
      {/* 危险动作卡（警示红——照旧冲出；落地前刹停） */}
      <div style={{position: 'absolute', left: cardX - 120 * brake, top: 400}}>
        <div
          style={{
            padding: '12px 24px',
            borderRadius: 10,
            border: `2.5px solid ${theme.danger}`,
            background: theme.panel,
            boxShadow: `0 0 ${20 * dash}px ${withAlpha(theme.danger, 0.55 * dash)}`,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.danger, whiteSpace: 'nowrap'}}>{'rm -rf /'}</span>
        </div>
      </div>
      {/* 磁盘（0-A 同构目标位） */}
      <svg width={176} height={184} viewBox="-110 -115 220 230" style={{position: 'absolute', left: 1390 - 88, top: 400 - 92, overflow: 'visible'}}>
        <g stroke={theme.dim} strokeWidth={4} fill="none">
          <path d="M-84 -46 L-84 62 Q-84 96, 0 96 Q84 96, 84 62 L84 -46" fill={theme.panel} />
          <ellipse cx={0} cy={-46} rx={84} ry={34} fill={theme.panel} />
          <path d="M-84 12 Q-84 40, 0 40 Q84 40, 84 12" opacity={0.5} />
        </g>
        <text x={0} y={-40} textAnchor="middle" fontFamily={theme.mono} fontSize={18} fill={theme.dim}>
          disk
        </text>
      </svg>
      {/* 代码之手（0-A 同款陶土橙描边——拍下停闸） */}
      <CodeHand cx={980} cy={520 - 20 * handIn} press={press} opacity={handIn} scale={0.82} />
      {/* 「胆」字小签（手边——闸门给你的，是胆） */}
      <div style={{position: 'absolute', left: 1080, top: 660, ...sign}}>
        <Panel accent={theme.mech} style={{padding: '10px 22px'}}>
          <span style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.mech}}>{'胆'}</span>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 下期钩子：检查签钉满环体 + 锈蚀斑 + 下期卡 ──────────────────────

const NextShot: React.FC<{atPins: number; atDense: number; atRust: number; atCard: number}> = ({atPins, atDense, atRust, atCard}) => {
  const frame = useCurrentFrame();
  // 检查签逐行钉入环体内（stagger；「每加一道检查」新签再钉一枚）
  const pins = [0, 1, 2, 3, 4, 5].map((i) => clamp01(progress(frame, atPins + i * 7, DUR.f4)));
  const extraPin = clamp01(progress(frame, atPins + 6 * 7 + 6, DUR.f4));
  // 「越挂越多」签阵过密（后钉的签更密更小——密度视觉化）
  const dense = useProgress(atDense, DUR.f4);
  // 锈蚀斑漫开一拍（腐化帧——环描边局部 danger 低饱和弧段）
  const rust = useProgress(atRust, DUR.f5, 'decelerate');
  // 下期卡浮起定格 +「下期」签
  const cardRise = useProgress(atCard, DUR.f5, 'decelerate');
  const signO = useProgress(atCard + DUR.f3, DUR.f3);
  const breathe = useBreathe({period: 120, amp: 0.3, base: 0.6, offset: atCard});
  const cx = 760;
  const cy = 520;
  const size = 520;
  const r = size / 2 - 46;
  return (
    <AbsoluteFill>
      {/* 环体中景（M-001 同形——描边恒定；被钉入检查签） */}
      <div style={{position: 'absolute', left: cx - size / 2, top: cy - size / 2}}>
        <LoopRing size={size} nodes={[0, 1, 2, 3, 4].map((i) => ({label: `s${i}`, angle: -90 + i * 72}))} showLabels={false} showExit={false} dimNodes />
      </div>
      {/* 锈蚀斑（环描边局部 danger 弧段——「烂一分」的腐化帧） */}
      {rust > 0.01 ? (
        <svg width={size + 60} height={size + 60} viewBox={`${-size / 2 - 30} ${-size / 2 - 30} ${size + 60} ${size + 60}`} style={{position: 'absolute', left: cx - size / 2 - 30, top: cy - size / 2 - 30, overflow: 'visible'}}>
          <path
            d={`M ${r * Math.cos((-0.35 * Math.PI))} ${r * Math.sin(-0.35 * Math.PI)} A ${r} ${r} 0 0 1 ${r * Math.cos(0.18 * Math.PI * rust)} ${r * Math.sin(0.18 * Math.PI * rust)}`}
            fill="none"
            stroke={withAlpha(theme.danger, 0.55)}
            strokeWidth={10}
            strokeLinecap="round"
            opacity={clamp01(rust)}
          />
        </svg>
      ) : null}
      {/* 检查签（裁决紫小签——一行行钉进环体内，写死在循环里的空间陈述） */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const on = pins[i];
        const rowY = cy - 150 + i * 62;
        const denseW = 240 - i * 18 - 26 * dense;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: cx - denseW / 2,
              top: rowY,
              width: denseW,
              height: 40,
              boxSizing: 'border-box',
              borderRadius: 7,
              border: `2px solid ${on > 0.4 ? theme.mech : theme.panelBorder}`,
              background: on > 0.4 ? withAlpha(theme.mech, 0.16) : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: 0.4 + 0.6 * on,
              transform: `translateY(${(1 - on) * -12}px)`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.mech}}>✓</span>
            <span style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>{'检查'}</span>
          </div>
        );
      })}
      {/* 新签再钉一枚（「每加一道检查」——第六签更密） */}
      <div
        style={{
          position: 'absolute',
          left: cx - 90,
          top: cy - 168,
          width: 180,
          height: 34,
          borderRadius: 7,
          border: `2px solid ${extraPin > 0.4 ? theme.mech : theme.panelBorder}`,
          background: extraPin > 0.4 ? withAlpha(theme.mech, 0.2) : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: extraPin,
          transform: `translateY(${(1 - extraPin) * -12}px) rotate(-3deg)`,
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim}}>{'再检查'}</span>
      </div>
      {/* 下期卡（缠结的环体剪影——检查签缠成一团；只点问题不预告机制） */}
      <div style={{position: 'absolute', left: 1330, top: 300 + (1 - cardRise) * 110, opacity: cardRise}}>
        <Panel accent={theme.core} style={{width: 430, height: 380, boxSizing: 'border-box', position: 'relative'}}>
          <svg width={380} height={280} viewBox="0 0 380 280" style={{position: 'absolute', left: 12, top: 40}}>
            {/* 缠结剪影：小环 + 缠签乱线团（无 hook/机制图形） */}
            <circle cx={190} cy={130} r={86} fill="none" stroke={theme.dim} strokeWidth={5} opacity={0.85} />
            {[0, 1, 2, 3, 4].map((i) => {
              const a0 = (i * 137) % 360;
              const a1 = a0 + 150 + (i % 3) * 60;
              const rad0 = (a0 * Math.PI) / 180;
              const rad1 = (a1 * Math.PI) / 180;
              const rr = 86 + (i % 2) * 22;
              return (
                <path
                  key={i}
                  d={`M ${190 + rr * Math.cos(rad0)} ${130 + rr * Math.sin(rad0)} Q ${190 + 40 * Math.cos(rad0 + 1.2)} ${130 + 90 * Math.sin(rad0)}, ${190 + rr * Math.cos(rad1)} ${130 + rr * Math.sin(rad1)}`}
                  fill="none"
                  stroke={withAlpha(theme.mech, 0.75)}
                  strokeWidth={3.5}
                  strokeDasharray="10 7"
                />
              );
            })}
          </svg>
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center', fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
            {'检查缠成一团'}
          </div>
        </Panel>
        {/* 「下期」签（呼吸——问题的钩子） */}
        <div style={{position: 'absolute', right: -60, top: 150, opacity: signO * breathe}}>
          <Panel accent={theme.core} style={{padding: '12px 26px'}}>
            <span style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.text, letterSpacing: 10, paddingLeft: 10}}>{'下期'}</span>
          </Panel>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-D 片尾署源卡（尾部署源位，RSI I-080 豁免） ────────────────────────

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

export const P5GateAndNext: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p5-01', 'p5-02');
  const bB = w('p5-03');
  const bC = w('p5-04', 'p5-05');
  const bD = w('p5-06', 'p5-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <QuoteShot
          atRing={wa('p5-01', 0.05) - bA.from}
          atQuote={wa('p5-01', 0.1) - bA.from}
          atMechW={wa('p5-01', 0.42) - bA.from}
          atSelf={wa('p5-01', 0.72) - bA.from}
          atStill={wa('p5-02', 0.3) - bA.from}
          atGate={wa('p5-02', 0.78) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <GiveNerveShot
          atDash={wa('p5-03', 0.25) - bB.from}
          atHand={wa('p5-03', 0.62) - bB.from}
          atSign={wa('p5-03', 0.82) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <NextShot
          atPins={wa('p5-04', 0.3) - bC.from}
          atDense={wa('p5-05', 0.2) - bC.from}
          atRust={wa('p5-05', 0.5) - bC.from}
          atCard={wa('p5-05', 0.75) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="5-D">
        <CreditCard atCard={at('p5-06') - bD.from} durCard={dur('p5-06')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bD.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5GateAndNext;
