/** P0 合体总点验（p0-01..p0-06，3 镜）——分镜 0-A / 0-B / 0-C。
 *
 *  叙事链：0-A 系列片头交棒后冷启动直入（开篇视听合力 I-039）：中央陶土橙
 *  环体〔M-001〕细线四拍微光（呼吸态 @breathe ≤5%——narration 备注指定形态，
 *  环体全程只轻微呼吸不变形），p0-01「合体后的总点验」词落位十八枚机制小卡
 *  （灰调剪影——只取形不取名：闸/钩/清单/底座/垫/墙/轨/钟/箱/牌/板/本/池/铃/
 *  齿/门/梯/管）自四面八方飞入汇向环体外围轨道〔M-005〕、「十八般」词落位
 *  汇流计数带 18/18 走满定格（数字镜：卡数 18 与口径字幕对账，重音镜）、
 *  「芯子还是那四句」词落位环体内芯四拍微光齐闪一拍（芯子在场陈述）〔M-003〕
 *  → 0-B 推入环体内芯特写：p0-02 四词各落位一签——「调模型」签①亮、「看响应」
 *  签②亮、「有就执行」签③亮、「结果回填」签④亮（四拍建锚——全片词窗母题
 *  之根，5-D 同签回扣位；四签形态自此锁定）→ p0-03「一圈转完」词落位节拍器
 *  沿四签走完一圈、「再来一圈」词落位回到签①再走一格（循环语义首演）→
 *  0-C 拉回环体全景：p0-04「外围」「一整圈设施」词落位暗格整圈依次亮轮廓
 *  （stagger 波次）〔M-005〕、「管记性的、管门禁的、管外接的」词落位三枚
 *  代表暗格各闪一拍（只亮形不点名）；p0-05「固定的挂点」词落位环边挂点槽
 *  轮廓初亮、暗格与槽位间对位连线逐条闪现（挂点＝位置预告，重音镜）；
 *  p0-06「走一整圈」词落位环上路径微光自输入位起走一圈、「送回各自的挂点」
 *  词落位一枚设施格示例滑入对应槽位（归位动效首演——合流紫）。
 *
 *  空间契约（安全带实算）：0-A/0-B 环体组 210..710（环体 710+500）底 710 /
 *  小卡轨道圈 ≤ 730 / 计数带底 772+48+10+24=854——恒 ≤ 860；0-C 环体
 *  190..690 底 690 / 暗格圈 r262 底 722 / 挂点槽圈 r318 底 778 / 归位道 ≤ 800
 *  ——恒 ≤ 860；署源角标右下 bottom 176 恒定不抢焦。红线落实：小卡恰 18 枚
 *  灰调剪影零文字（反串线——回闪只用装置形态，禁前集标题/集数文字）、环体
 *  形变或被卡片穿透禁（小卡落位在环外轨道圈）、口径字幕整拍可读、静止纯文字
 *  卡禁、四签 ≤4 字/签、节拍器单向循环、四签一次全亮禁（幻灯片式）、暗格只亮
 *  形零文字、槽位圈暗态细槽（P1 起逐槽点亮）、归位示例仅一格（全量归位留
 *  P1–P4）。词落位 = wa(id,f)。
 *
 *  承接登记：0-C→1-A morph（同一主体＝陶土橙环体＋环外设施暗格圈——恒定蓝
 *  走廊墙体自环体两侧展开成可行走环形走廊；详见 P1BeforeTheCall 头注 morph 段）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BeatTag, CountBand, LoopRing, MechanismSil, RingCore, SlotRail, ease, ringPt} from '../components/motifs';
import {clamp01, progress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，豁免登记于工作区配置 vibe-video.toml）：右下常驻，
 *  一次淡入后恒定不抢焦；bottom 176 避开字幕条（承 ep1–ep19 形态） */
const SourceCredit: React.FC<{lit?: number}> = ({lit = 1}) => (
  <div
    style={{
      position: 'absolute',
      right: 72,
      bottom: 176,
      fontFamily: theme.mono,
      fontSize: 22,
      letterSpacing: 1,
      color: theme.dim,
      opacity: 0.85 * clamp01(lit),
    }}
  >
    Learn Claude Code
  </div>
);

/** 环体全局位（0-A/0-B 共用——镜间身份恒常）：环心 (960,460)、size 500。 */
const RING0 = {x: 710, y: 210, size: 500} as const;
const C0 = {cx: 960, cy: 460, r: 204} as const;
/** 小卡轨道圈 / 0-C 暗格圈 / 挂点槽圈半径 */
const ORBIT_R = 262;
const SLOT_R = 318;

/** 确定性飞入起点（帧驱动无随机——自四面八方） */
const flyFrom = (i: number): {fx: number; fy: number} => {
  const a = (i * 137.5) * (Math.PI / 180);
  const d = 900 + (i % 5) * 210;
  return {fx: Math.cos(a) * d, fy: Math.sin(a) * d * 0.72};
};

// ── 0-A 合体总点验冷启动：环体呼吸 + 十八剪影汇流 + 计数带 18/18 ─────────────

const ZeroA: React.FC<{atFly: number; atCount: number; atCore: number; atCap: number}> = ({
  atFly,
  atCount,
  atCore,
  atCap,
}) => {
  const frame = useCurrentFrame();
  // 小卡自四面八方飞入汇向外围轨道（stagger 波次——总点验的合流叙事）
  const fly = Array.from({length: 18}, (_, i) =>
    ease(clamp01(progress(frame, atFly + (i % 6) * 5, 34))),
  );
  // 「芯子还是那四句」——内芯四拍微光齐闪一拍（impulse 显式锁存：sin 包络起 0 归 0）
  const coreBeat = Math.sin(Math.PI * clamp01(progress(frame, atCore, 18)));
  // 汇流计数：离散走满定格（18/18——Math.round 先行，禁连续插值上屏）
  const countP = ease(clamp01(progress(frame, atCount, 26)));
  const n = Math.min(18, Math.round(countP * 18));
  return (
    <AbsoluteFill>
      {/* 陶土橙环体（居中唯一恒定主体——呼吸态 ≤5%，环体不变形） */}
      <RingCore x={RING0.x} y={RING0.y} size={RING0.size} t={frame} dotProgress={(frame / 96) % 1} coreBeatP={coreBeat} />
      {/* 十八枚机制剪影（灰调零文字——落位环外轨道圈，恰 18 枚） */}
      {Array.from({length: 18}, (_, i) => {
        const p = ringPt(C0.cx, C0.cy, ORBIT_R, -90 + (i * 360) / 18);
        const {fx, fy} = flyFrom(i);
        return <MechanismSil key={`sil${i}`} x={p.x} y={p.y} i={i} size={54} flyP={fly[i]} fromX={fx} fromY={fy} />;
      })}
      {/* 汇流计数带（18/18 走满定格 + 口径字幕条 20−18 对账） */}
      <CountBand y={756} n={n} capP={clamp01(progress(frame, atCap, 14))} />
      <SourceCredit lit={clamp01(progress(frame, 4, 12))} />
    </AbsoluteFill>
  );
};

// ── 0-B 内芯特写：四拍建锚（四签逐亮）+ 节拍器走格一圈 ────────────────────────

/** 四签位（芯内四象限——0-B 建锚 / 5-D 回扣同签同形同序） */
const BEAT_LABELS = ['调模型', '看响应', '有就执行', '结果回填'] as const;

const ZeroB: React.FC<{atT1: number; atT2: number; atT3: number; atT4: number; atLap: number; atAgain: number}> = ({
  atT1,
  atT2,
  atT3,
  atT4,
  atLap,
  atAgain,
}) => {
  const frame = useCurrentFrame();
  const lits = [
    clamp01(progress(frame, atT1, 12)),
    clamp01(progress(frame, atT2, 12)),
    clamp01(progress(frame, atT3, 12)),
    clamp01(progress(frame, atT4, 12)),
  ];
  // 节拍器沿芯内环走格：一圈转完（atLap 起 40 帧走完 360°）→ 回到签①再走一格
  const lap = ease(clamp01(progress(frame, atLap, 40)));
  const again = ease(clamp01(progress(frame, atAgain, 12)));
  const metroA = -90 + lap * 360 + again * 90;
  const mp = ringPt(C0.cx, C0.cy, 86, metroA);
  // 外围轨道剪影退为暗层（CU 焦点让位芯子——跨镜小件随焦点转暗）
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'scale(1.32)',
          transformOrigin: '960px 460px',
        }}
      >
        <RingCore x={RING0.x} y={RING0.y} size={RING0.size} t={frame} dotProgress={(frame / 96) % 1} />
        {/* 芯内节拍轨道（走格轨道沿芯内环） */}
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
          <circle cx={C0.cx} cy={C0.cy} r={86} fill="none" stroke={withAlpha(theme.dim, 0.5)} strokeWidth={2.5} strokeDasharray="6 7" />
          {/* 节拍器光点（单向循环——走完一圈回到签①再走一格） */}
          <circle cx={mp.x} cy={mp.y} r={10} fill={theme.core} />
          <line x1={C0.cx} y1={C0.cy} x2={mp.x} y2={mp.y} stroke={withAlpha(theme.core, 0.4)} strokeWidth={2.5} />
        </svg>
        {/* 四枚节拍签（四象限——逐签落位，四拍建锚） */}
        {BEAT_LABELS.map((label, k) => {
          const pos = [
            {x: C0.cx, y: C0.cy - 132},
            {x: C0.cx + 148, y: C0.cy},
            {x: C0.cx, y: C0.cy + 132},
            {x: C0.cx - 148, y: C0.cy},
          ][k];
          return <BeatTag key={`bt${k}`} x={pos.x} y={pos.y} label={label} litP={lits[k]} w={150} />;
        })}
        {/* 外围剪影暗层（恒在但退暗——合流在场的余像） */}
        {Array.from({length: 18}, (_, i) => {
          const p = ringPt(C0.cx, C0.cy, ORBIT_R, -90 + (i * 360) / 18);
          return <MechanismSil key={`sd${i}`} x={p.x} y={p.y} i={i} size={44} flyP={1} dimP={0.6} />;
        })}
      </div>
      <SourceCredit />
    </AbsoluteFill>
  );
};

// ── 0-C 环体全景：设施暗格圈 + 挂点槽轮廓 + 对位连线 + 归位示例 ───────────────

/** 三枚代表暗格（形状示意不点名——记忆形=本 / 门禁形=闸 / 外接形=管） */
const REP_IDS = [11, 0, 17];

const ZeroC: React.FC<{
  atCells: number;
  atRep: number;
  atSlots: number;
  atLinks: number;
  atLap: number;
  atHome: number;
}> = ({atCells, atRep, atSlots, atLinks, atLap, atHome}) => {
  const frame = useCurrentFrame();
  // 暗格整圈依次亮轮廓（stagger 波次）
  const cellLits = Array.from({length: 18}, (_, i) => clamp01(progress(frame, atCells + i * 2, 10)));
  // 三枚代表暗格各闪一拍（只亮形不点名——闪后回落轮廓态）
  const reps = REP_IDS.map((_, k) => Math.sin(Math.PI * clamp01(progress(frame, atRep + k * 9, 12))));
  // 挂点槽轮廓初亮 + 暗格与槽位间对位连线逐条闪现
  const slotOutline = clamp01(progress(frame, atSlots, 14));
  const linkP = ease(clamp01(progress(frame, atLinks, 22)));
  // 环上路径微光自输入位（12 点）起走一圈
  const lap = ease(clamp01(progress(frame, atLap, 44)));
  const lapPt = ringPt(C0.cx, C0.cy, ORBIT_R + 28, -90 + lap * 360);
  // 归位示例：一枚设施格（池形）沿径向滑入对应槽位（合流紫）
  const home = ease(clamp01(progress(frame, atHome, 26)));
  const homeIdx = 12;
  const homeFrom = ringPt(C0.cx, C0.cy, ORBIT_R, -90 + (homeIdx * 360) / 18);
  const homeTo = ringPt(C0.cx, C0.cy, SLOT_R, -90 + (homeIdx * 360) / 18);
  return (
    <AbsoluteFill>
      <RingCore x={RING0.x} y={RING0.y} size={RING0.size} t={frame} dotProgress={(frame / 96) % 1} />
      {/* 一圈设施暗格（小卡化作暗格——轮廓态，只亮形零文字） */}
      {Array.from({length: 18}, (_, i) => {
        const p = ringPt(C0.cx, C0.cy, ORBIT_R, -90 + (i * 360) / 18);
        const rp = REP_IDS.indexOf(i);
        const flash = rp >= 0 ? reps[rp] : 0;
        return (
          <div
            key={`cell${i}`}
            style={{
              position: 'absolute',
              left: p.x - 19,
              top: p.y - 19,
              width: 38,
              height: 38,
              borderRadius: 9,
              border: `2.5px solid ${flash > 0.15 ? theme.text : withAlpha(theme.dim, 0.35 + 0.45 * cellLits[i])}`,
              background: flash > 0.15 ? withAlpha(theme.text, 0.12 * flash) : withAlphaMCell(cellLits[i]),
              opacity: Math.max(0.22, cellLits[i]),
              transform: `scale(${1 + 0.14 * flash})`,
            }}
          />
        );
      })}
      {/* 环边挂点槽轮廓（暗态细槽圈——P1 起逐槽点亮） */}
      <SlotRail cx={C0.cx} cy={C0.cy} r={SLOT_R} n={18} outlineP={slotOutline} />
      {/* 对位连线（暗格→槽位逐条闪现——挂点＝位置预告） */}
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {Array.from({length: 18}, (_, i) => {
          const a = -90 + (i * 360) / 18;
          const p1 = ringPt(C0.cx, C0.cy, ORBIT_R + 22, a);
          const p2 = ringPt(C0.cx, C0.cy, SLOT_R - 20, a);
          const seg = clamp01(progress(frame, atLinks + i * 1.2, 8));
          return (
            <line
              key={`lk${i}`}
              x1={p1.x}
              y1={p1.y}
              x2={p1.x + (p2.x - p1.x) * seg}
              y2={p1.y + (p2.y - p1.y) * seg}
              stroke={withAlpha(theme.merge, 0.65)}
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={linkP * (1 - 0.35 * linkP)}
            />
          );
        })}
        {/* 环上路径微光（自输入位 12 点起走一圈） */}
        {lap > 0.01 && lap < 0.999 ? (
          <>
            <circle cx={lapPt.x} cy={lapPt.y} r={12} fill={theme.core} />
            <circle cx={lapPt.x} cy={lapPt.y} r={22} fill="none" stroke={withAlpha(theme.core, 0.4)} strokeWidth={2.5} />
          </>
        ) : null}
      </svg>
      {/* 归位示例（一枚设施格滑入对应槽位——合流紫，全量归位留 P1–P4） */}
      {home > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: homeFrom.x + (homeTo.x - homeFrom.x) * home - 19,
            top: homeFrom.y + (homeTo.y - homeFrom.y) * home - 19,
            width: 38,
            height: 38,
            borderRadius: 9,
            border: `3px solid ${theme.merge}`,
            background: withAlpha(theme.merge, 0.3),
            boxShadow: `0 0 ${16 * (1 - Math.abs(home * 2 - 1))}px ${withAlpha(theme.merge, 0.6)}`,
          }}
        />
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'外围一整圈 · 每件一个固定的挂点'}
      </div>
      <SourceCredit />
    </AbsoluteFill>
  );
};

/** 暗格底色（cellLit 驱动——合流紫极淡填充，暗格态不抢环体） */
const withAlphaMCell = (p: number): string => withAlpha(theme.merge, 0.06 * p);

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0RollCall: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01');
  const bB = w('p0-02', 'p0-03');
  const bC = w('p0-04', 'p0-06');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A">
        <ZeroA
          atFly={wa('p0-01', 0.1) - bA.from}
          atCount={wa('p0-01', 0.52) - bA.from}
          atCore={wa('p0-01', 0.8) - bA.from}
          atCap={wa('p0-01', 0.6) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atT1={wa('p0-02', 0.14) - bB.from}
          atT2={wa('p0-02', 0.3) - bB.from}
          atT3={wa('p0-02', 0.46) - bB.from}
          atT4={wa('p0-02', 0.62) - bB.from}
          atLap={wa('p0-03', 0.18) - bB.from}
          atAgain={wa('p0-03', 0.62) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atCells={wa('p0-04', 0.3) - bC.from}
          atRep={wa('p0-04', 0.66) - bC.from}
          atSlots={wa('p0-05', 0.32) - bC.from}
          atLinks={wa('p0-05', 0.58) - bC.from}
          atLap={wa('p0-06', 0.28) - bC.from}
          atHome={wa('p0-06', 0.68) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0RollCall;
