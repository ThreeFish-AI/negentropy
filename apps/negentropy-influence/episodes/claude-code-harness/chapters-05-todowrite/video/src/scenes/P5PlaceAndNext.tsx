/** P5 收束与下期（p5-01..p5-07，3 镜）——分镜 5-A / 5-B / 5-C。
 *
 *  ★ 5-A 环体定格收束 + 金句卡（衬线体）「别考验记忆，考验摆放」：环体居中
 *    同形回归〔M-001〕（描边色/线宽承全片锚定），规划蓝清单卡驻位环侧尾段亮
 *    带内、紫色计数器归零静息；延展心智示意 1 拍（类比 A#8——计划小条自模型
 *    脑图标外置到环侧清单位、再自环境读回脑图标；外置/读回双箭头连成环外小
 *    回路，认知科学命名一拍示意即收〔A#8 失配边界：工程版更朴素〕）；金句卡
 *    两「考验」各压一拍重读排版（caption-dup-ok: 金句卡刻意复述——收束定格
 *    仪式，承系列 5-A 豁免先例）。
 *  ★ 5-B 下期问题卡（视觉层，只点问题不预告机制）：对话池中景——消息条越堆
 *    越满、池壁刻度上浮，文件签雨点式落入（stagger）、理清后没用的过程条
 *    （灰）显式标灰仍占位、池水色调浑浊化一档（视觉层暗示）、目标条被挤到
 *    池缘挂起（不消失）；下期卡浮起定格（越堆越满的对话池剪影）+「下期」签。
 *  ★ 5-C 片尾署源卡（尾部署源位，RSI I-080 豁免；署源句 = p5-06）：主行
 *    Learn Claude Code / 次行仓库地址 / 角注 MIT（卡面 ≤3 行）；p5-07 漂移
 *    警示由口播承载、卡面零复述；全片在此卡收束（黑场前最后画面）。
 *  ★ 尾幕渐黑（红线四）：窗取末 beat 总时长（p5-06..p5-07 之和）——终点即
 *    本幕终点，勿改用末句单句窗。收尾版式不挂 SceneTag（承 ep1–ep4 先例）。
 *
 *  空间契约：金句卡衬线体、环体同形回归、清单卡驻尾段亮带（摆回眼前的收束
 *    语义）、延展示意 ≤1 拍不常驻；无用过程条只灰化不消失（占位是痛点语义）、
 *    下期卡只含池剪影（不预告新机制图形）、池内元素避让字幕带与顶部安全带；
 *    署源卡为最后画面、卡面 ≤3 行信息、字号不低于可读阈值。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；「延展心智」英文命名只
 *    进角标 extended mind。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BrainGlyph, ContextPool, LoopRing, NagCounter, Panel} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFadeOut, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 金句强调词：色钉常量（QA-14——本集主题色 = 规划蓝 mech；color 恒常量，
 *  辉光只改强度不改色相） */
const KeyWord: React.FC<{at: number; children: React.ReactNode}> = ({at, children}) => {
  const pop = useImpulse({at, dur: DUR.f6, peak: 0.06});
  const glow = useProgress(at, DUR.f5);
  return (
    <span
      style={{
        fontSize: 60,
        fontWeight: 700,
        color: theme.mech,
        display: 'inline-block',
        transform: `scale(${1 + pop})`,
        textShadow: glow > 0.01 ? `0 0 ${24 * glow}px ${withAlpha(theme.mech, 0.5)}` : 'none',
      }}
    >
      {children}
    </span>
  );
};

// ── 5-A 环体定格收束 + 延展心智一拍 + 金句卡 ────────────────────────────

const QuoteShot: React.FC<{atGlow: number; atOut: number; atBack: number; atLoop: number; atCard: number; atK1: number; atK2: number}> = ({
  atGlow,
  atOut,
  atBack,
  atLoop,
  atCard,
  atK1,
  atK2,
}) => {
  const frame = useCurrentFrame();
  // 「状态外置」：清单卡在尾段亮带内定格辉光一次
  const glow = useImpulse({at: atGlow, dur: DUR.f6, peak: 1});
  const settle = useProgress(atGlow - DUR.f4, DUR.f5, 'decelerate');
  // 延展心智示意 1 拍：外置（计划小条自脑图标 → 环侧清单位）→ 读回（环境 → 脑图标）
  const outP = useProgress(atOut, DUR.f5, 'decelerate');
  const backP = useProgress(atBack, DUR.f5, 'decelerate');
  // 双箭头连成环外小回路（认知科学命名一拍示意即收——A#8 失配边界）
  const loop = useProgress(atLoop, DUR.f4);
  const loopFade = 1 - useProgress(atLoop + DUR.f6, DUR.f4);
  // 金句卡淡入定格、两「考验」各压一拍
  const card = useProgress(atCard, DUR.f6);
  // 环体几何（居中同形回归——M-001 描边/线宽承全片锚定）
  const RING = {cx: 620, cy: 620, size: 430} as const;
  const bandTop = RING.cy + 40; // 环侧尾段亮带位（右侧）
  const brainC = {cx: 1560, cy: 380} as const;
  return (
    <AbsoluteFill>
      {/* 金句卡（唯一主体，衬线体） */}
      <div
        style={{
          position: 'absolute',
          left: 900,
          right: 60,
          top: 250,
          opacity: card,
          transform: `translateY(${(1 - card) * 24}px)`,
        }}
      >
        <Panel accent={theme.mech} style={{padding: '44px 64px', display: 'inline-block'}}>
          <div style={{fontFamily: theme.serif, fontSize: 56, color: theme.text, lineHeight: 1.32, whiteSpace: 'nowrap'}}>
            <KeyWord at={atK1}>{'别考验记忆'}</KeyWord>
            {'，'}
            <KeyWord at={atK2}>{'考验摆放'}</KeyWord>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 16}}>{'状态外置 · externalize'}</div>
        </Panel>
      </div>
      {/* 环体（M-001 同形回归——静止收束态：巡游停、计数器归零静息） */}
      <div style={{position: 'absolute', left: RING.cx - RING.size / 2, top: RING.cy - RING.size / 2, opacity: settle * 0.95}}>
        <LoopRing size={RING.size} nodes={[]} showExit={false} />
      </div>
      {/* 环侧尾段亮带（收束语义：摆回眼前——窗内亮带） */}
      <div
        style={{
          position: 'absolute',
          left: RING.cx + 120,
          top: bandTop,
          width: 300,
          height: 92,
          boxSizing: 'border-box',
          borderTop: `3px solid ${withAlpha(theme.text, 0.85)}`,
          borderBottom: `3px solid ${withAlpha(theme.text, 0.85)}`,
          background: withAlpha(theme.text, 0.05),
          opacity: settle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: glow > 0.01 ? `0 0 ${26 * glow}px ${withAlpha(theme.mech, 0.4)}` : 'none',
        }}
      >
        {/* 清单卡驻位（规划蓝缩微——摆在眼前的计划收束态） */}
        <div
          style={{
            width: 240,
            borderRadius: 8,
            border: `2.5px solid ${theme.mech}`,
            background: withAlpha(theme.mech, 0.14),
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            padding: '8px 12px',
          }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <svg width={14} height={14} viewBox="0 0 14 14">
                {i < 2 ? (
                  <path d="M 2 7 L 6 11 L 12 3" fill="none" stroke={theme.ok} strokeWidth={2.5} strokeLinecap="round" />
                ) : (
                  <circle cx={7} cy={7} r={5} fill={theme.mech} />
                )}
              </svg>
              <div style={{height: 4, width: 150, borderRadius: 2, background: withAlpha(theme.mech, 0.5)}} />
            </div>
          ))}
        </div>
      </div>
      {/* 计数器（归零静息——后一半的收束态） */}
      <div style={{position: 'absolute', left: RING.cx + 120, top: RING.cy + 160, opacity: settle}}>
        <NagCounter x={0} y={0} w={300} count={0} lit={settle} scale={0.72} />
      </div>
      {/* ── 延展心智示意 1 拍（外置 → 读回；一拍走完即收） ── */}
      <BrainGlyph cx={brainC.cx} cy={brainC.cy} size={150} lit={loop * 0.9} />
      {/* 计划小条（自脑图标外置到环侧清单位、再读回——沿轨迹往返） */}
      {loop > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: brainC.cx - 60 + (RING.cx + 260 - brainC.cx) * Math.max(outP, backP),
            top: brainC.cy + (bandTop + 40 - brainC.cy) * Math.max(outP, backP),
            opacity: loopFade,
          }}
        >
          <div
            style={{
              width: 120,
              height: 40,
              borderRadius: 8,
              border: `2.5px solid ${theme.mech}`,
              background: withAlpha(theme.mech, 0.16),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 17,
              fontWeight: 600,
              color: theme.text,
            }}
          >
            {'计划'}
          </div>
        </div>
      ) : null}
      {/* 外置/读回双箭头 → 连成环外小回路（一拍示意即收） */}
      {loop > 0.01 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: loopFade}}>
          {/* 外置（脑 → 环侧） */}
          <path
            d={`M ${brainC.cx - 80} ${brainC.cy + 70} Q ${RING.cx + 430} ${bandTop - 60}, ${RING.cx + 300} ${bandTop - 6}`}
            fill="none"
            stroke={withAlpha(theme.mech, 0.75)}
            strokeWidth={3.5}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - outP}
          />
          {/* 读回（环侧 → 脑） */}
          <path
            d={`M ${RING.cx + 300} ${bandTop + 110} Q ${RING.cx + 480} ${bandTop + 220}, ${brainC.cx - 70} ${brainC.cy + 90}`}
            fill="none"
            stroke={withAlpha(theme.tool, 0.75)}
            strokeWidth={3.5}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - backP}
          />
          <text x={(brainC.cx + RING.cx) / 2 + 40} y={bandTop - 90} fontFamily={theme.mono} fontSize={16} fill={theme.dim} opacity={loopFade}>
            {'extended mind'}
          </text>
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};

// ── 5-B 下期问题卡：对话池越堆越满 ──────────────────────────────────────

const NextShot: React.FC<{atPool: number; atDense: number; atFiles: number; atGray: number; atLevel: number; atMuddy: number; atSqueeze: number; atCard: number; atDim: number}> = ({
  atPool,
  atDense,
  atFiles,
  atGray,
  atLevel,
  atMuddy,
  atSqueeze,
  atCard,
  atDim,
}) => {
  const frame = useCurrentFrame();
  // 池亮起 + 密度陡增一档（大任务）
  const pool = useProgress(atPool, DUR.f5);
  const dense = useProgress(atDense, DUR.f4);
  // 文件签雨点式落入（stagger——确定性黄金角落点）
  const files = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => clamp01(progress(frame, atFiles + i * 4, DUR.f4)));
  // 灰色过程条显式标灰仍占位（理清之后就没用——只灰化不消失）
  const gray = useProgress(atGray, DUR.f5);
  // 池壁刻度逼近上限（一直占着位置）
  const level = useProgress(atLevel, DUR.f5);
  // 池水浑浊化一档（视觉层暗示——叠浑浊罩）
  const muddy = useProgress(atMuddy, DUR.f5);
  // 目标条挤至池缘挂起（没地方摆——不消失）
  const squeeze = useProgress(atSqueeze, DUR.f5, 'decelerate');
  // 下期卡浮起定格（含池剪影）+ 半拍收暗
  const card = useProgress(atCard, DUR.f5);
  const dimAll = useProgress(atDim, DUR.f4);
  const POOL = {x: 320, y: 200, w: 900, h: 560} as const;
  // 池内条目（确定性：过程条灰 + 工具条 + 文件签——布点黄金角散布）。
  // QA-15 边界判据：全部元素角点须落在池壁框内（fx+签宽 ≤ 900、fy+签高 ≤ 560），
  // 且池底 y ≤ 760 避开字幕带——下方布点公式 fx∈[140,800] / fy∈[280,430] 均在界。
  const PROCESS = [
    {x: 40, y: 300 - 200, w: 380},
    {x: 60, y: 390 - 200, w: 420},
    {x: 90, y: 480 - 200, w: 350},
  ];
  return (
    <AbsoluteFill>
      {/* 对话池（池壁 + 刻度——水位逼近上限） */}
      <ContextPool x={POOL.x} y={POOL.y} w={POOL.w} h={POOL.h} lit={pool} level={level} />
      {/* 池内剪裁窗（条目避让字幕带与顶部安全带） */}
      <div style={{position: 'absolute', left: POOL.x, top: POOL.y, width: POOL.w, height: POOL.h, overflow: 'hidden'}}>
        {/* 灰色过程条（理清后没用的过程——恒占位） */}
        {PROCESS.map((b, i) => (
          <div key={i} style={{position: 'absolute', left: b.x, top: b.y + 200 - 0, opacity: pool * (0.5 + 0.3 * gray)}}>
            <div
              style={{
                width: b.w,
                height: 40,
                borderRadius: 7,
                border: `2px solid ${gray > 0.5 ? withAlpha(theme.dim, 0.45) : withAlpha(theme.dim, 0.75)}`,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 12,
                fontFamily: theme.sans,
                fontSize: 16,
                color: theme.dim,
                boxSizing: 'border-box',
                filter: `saturate(${1 - 0.6 * gray})`,
              }}
            >
              {'过程记录 · 没用了'}
            </div>
          </div>
        ))}
        {/* 消息条越堆越满（密度陡增一档：第二批条目亮起） */}
        {[0, 1, 2].map((i) => (
          <div key={`m${i}`} style={{position: 'absolute', left: 340, top: 250 - 200 + i * 54, opacity: pool * (i < 2 ? 1 : dense)}}>
            <div
              style={{
                width: 420,
                height: 38,
                borderRadius: 7,
                border: `2px solid ${withAlpha(theme.tool, 0.5)}`,
                background: withAlpha(theme.tool, 0.05),
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 12,
                fontFamily: theme.sans,
                fontSize: 16,
                color: theme.dim,
                boxSizing: 'border-box',
              }}
            >
              {`工具结果 ${i + 1}`}
            </div>
          </div>
        ))}
        {/* 文件签雨点式落入（stagger——几十个文件的具象样本） */}
        {files.map((p, i) => {
          const fx = 140 + ((i * 271) % 660);
          const fy = 480 - 200 + ((i * 137) % 150);
          return (
            <div
              key={`f${i}`}
              style={{
                position: 'absolute',
                left: fx,
                top: fy - 60 * (1 - p),
                opacity: p,
              }}
            >
              <div
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: `2px solid ${withAlpha(theme.dim, 0.6)}`,
                  fontFamily: theme.mono,
                  fontSize: 14,
                  color: theme.dim,
                  whiteSpace: 'nowrap',
                }}
              >
                {`file_${i + 1}.ts`}
              </div>
            </div>
          );
        })}
        {/* 目标条（被挤到池缘挂起——不消失） */}
        <div style={{position: 'absolute', left: 60 + 640 * squeeze, top: 210 - 200 - 60 * squeeze, opacity: pool}}>
          <div
            style={{
              width: 280,
              height: 48,
              borderRadius: 9,
              border: `2.5px solid ${theme.mech}`,
              background: withAlpha(theme.mech, 0.12),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 19,
              fontWeight: 600,
              color: theme.text,
              boxShadow: `0 0 ${14 * squeeze}px ${withAlpha(theme.mech, 0.4)}`,
            }}
          >
            {'目标 · 没地方摆'}
          </div>
        </div>
      </div>
      {/* 池水浑浊罩（视觉层暗示——一档即止） */}
      <div
        style={{
          position: 'absolute',
          left: POOL.x,
          top: POOL.y,
          width: POOL.w,
          height: POOL.h,
          background: withAlpha(theme.dim, 0.14 * muddy),
          pointerEvents: 'none',
        }}
      />
      {/* 下期卡（浮起定格——只含对话池剪影 + 「下期」签；不预告新机制图形） */}
      <div style={{position: 'absolute', left: 1320, top: 300, opacity: card}}>
        <Panel accent={theme.core} style={{padding: '30px 36px', position: 'relative'}}>
          {/* 池剪影（越堆越满的对话池——下期问题意象） */}
          <svg width={240} height={180} viewBox="0 0 240 180">
            <path d="M 20 10 L 20 170 L 220 170 L 220 10" fill="none" stroke={withAlpha(theme.dim, 0.8)} strokeWidth={4} strokeLinecap="round" />
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <line
                key={i}
                x1={36 + (i % 2) * 40}
                y1={28 + i * 18}
                x2={204 - ((i * 37) % 60)}
                y2={28 + i * 18}
                stroke={withAlpha(theme.dim, 0.55)}
                strokeWidth={5}
                strokeLinecap="round"
              />
            ))}
            <line x1={20} y1={16} x2={220} y2={16} stroke={withAlpha(theme.danger, 0.6)} strokeWidth={3} strokeDasharray="7 7" />
          </svg>
          <div style={{textAlign: 'center', fontFamily: theme.serif, fontSize: 42, fontWeight: 700, color: theme.text, letterSpacing: 10, paddingLeft: 10, marginTop: 12}}>
            {'下期'}
          </div>
        </Panel>
      </div>
      <AbsoluteFill style={{background: '#000', opacity: 0.68 * dimAll, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

// ── 5-C 片尾署源卡（尾部署源位，RSI I-080 豁免） ────────────────────────

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

export const P5PlaceAndNext: React.FC<{scene: SceneRange}> = ({scene}) => {
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
          atGlow={wa('p5-01', 0.14) - bA.from}
          atOut={wa('p5-01', 0.56) - bA.from}
          atBack={wa('p5-01', 0.8) - bA.from}
          atLoop={wa('p5-02', 0.1) - bA.from}
          atCard={wa('p5-02', 0.52) - bA.from}
          atK1={wa('p5-02', 0.72) - bA.from}
          atK2={wa('p5-02', 0.92) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <NextShot
          atPool={wa('p5-03', 0.24) - bB.from}
          atDense={wa('p5-03', 0.66) - bB.from}
          atFiles={wa('p5-04', 0.1) - bB.from}
          atGray={wa('p5-04', 0.5) - bB.from}
          atLevel={wa('p5-04', 0.8) - bB.from}
          atMuddy={wa('p5-05', 0.1) - bB.from}
          atSqueeze={wa('p5-05', 0.44) - bB.from}
          atCard={wa('p5-05', 0.78) - bB.from}
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

export default P5PlaceAndNext;
