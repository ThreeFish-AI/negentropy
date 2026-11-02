/** P0 三个症状一个病根（p0-01..p0-16，16 句；storyboard「P0 三个症状一个病根」节）。
 *
 *  8 镜 / 13 条 archify cue（12 章，一章锚一句）：
 *   0-A 对峙（装置：金/紫双数缓入对峙 + 中缝裂缝光呼吸〔M-003〕）
 *   0-B three-dashboards@p0-02（p0-03 同章 hold 接力）· dashed 徽顶带
 *   0-C 数字坍缩空卡座 + 问句浮标（p0-04 空窗演装置）+ twenty-algorithms@p0-05
 *   0-D blind-wrong@p0-06 + baseline-two@p0-07（与 0-C 尾背靠背 → lead=false）· 双 dashed 徽
 *   0-E 密码列打字机 + 释义卡底部顶开（p0-08 空窗）+ whole-key@p0-09
 *   0-F badge-question@p0-10 + master-key@p0-11（背靠背 → false）+ encircle-pierce@p0-12
 *       （跨图接力同窗背靠背，第二实例亦 false）· 钥匙贯穿脉冲顶带装置
 *   0-G cause-chain@p0-13（背靠背 → false）
 *   0-H answer-ledger@p0-14 + engine-cast@p0-15 + downgraded-lane@p0-16（背靠背 → false）
 *       · 片名卡三色划入（p0-16 后半，叠加于图尾 hold 终态之上）
 *
 *  顶带角标（y 62..138，画框上缘 y150 之外，不与 1298×730 全屏独占画框重叠）：
 *  0-B/0-D 证据徽、0-F 钥匙脉冲。本幕证据徽的锚句整窗被图框覆盖、无 E2
 *  「前移空窗句」可用，故落位顶带（画框契约①的 SceneTag 纵向避让带右半区）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useBreathe, useEnter, useImpulse, useReveal, useSpring} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {DefinitionCard} from '../components/devices';

/** #RRGGBB → rgba（devices.tsx 同形本地替身；纯函数）。 */
const withA = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export const P0Symptoms: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bB = w('p0-02', 'p0-03');
  const bC = w('p0-04', 'p0-05');
  const bD = w('p0-06', 'p0-07');
  const bE = w('p0-08', 'p0-09');
  const bF = w('p0-10', 'p0-12');
  const bG = w('p0-13');
  const bH = w('p0-14', 'p0-16');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P0" tagline="三个症状一个病根" accent={theme.concept} />

      {/* 0-A 对峙：金/紫双数缓入 + 裂缝光呼吸 */}
      <Sequence {...w('p0-01')} name="0-A">
        <NumDuel at1={at('p0-01')} />
      </Sequence>

      {/* 0-B 两个数：archify 全屏独占（同章逐句 hold）；证据徽顶带（角标句 p0-03） */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="0-B">
        <div style={{position: 'absolute', top: 66, right: 84}}>
          <EvidenceBadge level="dashed" at={at('p0-03') - bB.from} note="Snowflake 公告博客" />
        </div>
        <ArchifyRecap slug="caliber-clash" caption="口径打架" cues={[
              {chapterId: 'three-dashboards', at: at('p0-02') - bB.from, durationInFrames: dur('p0-02')},
              {chapterId: 'three-dashboards', at: at('p0-03') - bB.from, durationInFrames: dur('p0-03'), fit: 'hold'},
            ]} />
      </Sequence>

      {/* 0-C 归因：数字坍缩为空卡座（p0-04），twenty-algorithms@p0-05 全屏接管 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="0-C">
        <CollapseSeat at4={at('p0-04') - bC.from} qAt={at('p0-04') - bC.from + 44} />
        <ArchifyRecap slug="caliber-clash" caption="口径打架" cues={[
              {chapterId: 'twenty-algorithms', at: at('p0-05') - bC.from, durationInFrames: dur('p0-05')},
            ]} />
      </Sequence>

      {/* 0-D 裸问：两章分句接力（与 0-C 尾背靠背 → false）；双 dashed 徽顶带 */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="0-D">
        <div style={{position: 'absolute', top: 66, right: 84, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end'}}>
          <EvidenceBadge level="dashed" at={at('p0-07') - bD.from} note="Snowflake 内测 ~25%" />
          <EvidenceBadge level="dashed" at={at('p0-07') - bD.from} note="Anthropic 转述 ~21%" />
        </div>
        <ArchifyRecap slug="bare-key-baseline" caption="裸库基准" cues={[
              {chapterId: 'blind-wrong', at: at('p0-06') - bD.from, durationInFrames: dur('p0-06')},
              {chapterId: 'baseline-two', at: at('p0-07') - bD.from, durationInFrames: dur('p0-07')},
            ]} lead={false} />
      </Sequence>

      {/* 0-E 密码列：打字机 + 释义卡（p0-08 空窗先播完再被遮），whole-key@p0-09 */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="0-E">
        <CipherColumn
          at8={at('p0-08') - bE.from}
          glossAt={at('p0-08') - bE.from + Math.round(dur('p0-08') * 0.52)}
        />
        <ArchifyRecap slug="bare-key-baseline" caption="裸库基准" cues={[
              {chapterId: 'whole-key', at: at('p0-09') - bE.from, durationInFrames: dur('p0-09')},
            ]} />
      </Sequence>

      {/* 0-F 穿透：三章接力（前两章同图背靠背 → false；跨图接力同窗背靠背 → 亦 false）；钥匙脉冲顶带 */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="0-F">
        <KeyPulse at12={at('p0-12') - bF.from} />
        <ArchifyRecap slug="injection-threat" caption="门禁穿透" cues={[
              {chapterId: 'badge-question', at: at('p0-10') - bF.from, durationInFrames: dur('p0-10')},
              {chapterId: 'master-key', at: at('p0-11') - bF.from, durationInFrames: dur('p0-11')},
            ]} lead={false} />
        <ArchifyRecap slug="problem-to-mechanisms" caption="病根对位" cues={[
              {chapterId: 'encircle-pierce', at: at('p0-12') - bF.from, durationInFrames: dur('p0-12')},
            ]} lead={false} />
      </Sequence>

      {/* 0-G 病历：因果链逐节亮（纯图回放） */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="0-G">
        <ArchifyRecap slug="problem-to-mechanisms" caption="病根对位" cues={[
              {chapterId: 'cause-chain', at: at('p0-13') - bG.from, durationInFrames: dur('p0-13')},
            ]} lead={false} />
      </Sequence>

      {/* 0-H 定位：三章接力 + 片名卡三色划入（p0-16 后半叠加于图尾 hold 之上） */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="0-H">
        <ArchifyRecap slug="problem-to-mechanisms" caption="病根对位" cues={[
              {chapterId: 'answer-ledger', at: at('p0-14') - bH.from, durationInFrames: dur('p0-14')},
              {chapterId: 'engine-cast', at: at('p0-15') - bH.from, durationInFrames: dur('p0-15')},
              {chapterId: 'downgraded-lane', at: at('p0-16') - bH.from, durationInFrames: dur('p0-16')},
            ]} lead={false} />
        <TitleCard at16={at('p0-16') - bH.from + Math.round(dur('p0-16') * 0.5)} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 0-A 对峙

/** 金/紫双数缓入对峙（@enter:rise）；中缝裂缝光呼吸——同一份数据的两种读数之间的裂缝。 */
const NumDuel: React.FC<{at1: number}> = ({at1}) => {
  const left = useEnter('rise', {at: at1, dur: DUR.f6, dist: 60, restBottom: 632});
  const right = useEnter('rise', {at: at1 + 9, dur: DUR.f6, dist: 60, restBottom: 632});
  const glow = useBreathe({period: 96, base: 0.42, amp: 0.58});
  // AbsoluteFill 自带 flexDirection:column——横向对峙必须显式 row（E2 同型翻车）；
  // row 居中后数字底缘 y≈632，与 useEnter rise 钳制的 restBottom:632 精确互证
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 224}}>
      <div style={{...left}}>
        <div
          style={{
            fontFamily: theme.sans,
            fontSize: 168,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: theme.concept,
            lineHeight: 1.1,
          }}
        >
          {'1420万'}
        </div>
      </div>
      <CrackSeam glow={glow} />
      <div style={{...right}}>
        <div
          style={{
            fontFamily: theme.sans,
            fontSize: 168,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: theme.conceptDeep,
            lineHeight: 1.1,
          }}
        >
          {'1280万'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 中缝裂缝光：确定性折线 + 呼吸辉光（〔M-003〕持续态——落位后仅裂缝微光起伏）。 */
const CrackSeam: React.FC<{glow: number}> = ({glow}) => (
  <svg width={96} height={560} viewBox="0 0 96 560">
    <path
      d="M48 8 L60 96 L38 184 L62 272 L40 360 L64 448 L50 552"
      fill="none"
      stroke={theme.text}
      strokeWidth={2.5}
      strokeLinejoin="round"
      opacity={0.3 + 0.5 * glow}
      style={{filter: `drop-shadow(0 0 ${8 + 16 * glow}px ${withA(theme.text, 0.7)})`}}
    />
  </svg>
);

// ─────────────────────────────────────────────── 0-C 归因（数字坍缩空卡座）

/** 双数向心收缩湮灭 → 空卡座（定义卡母题首现：卡不在场，座上积灰光）→ 问句浮标。
 *  问句为口播 p0-05 引语的关键词锚点（归一化 6 字 < DUP_MIN_CHARS，非整句复述）。 */
const CollapseSeat: React.FC<{at4: number; qAt: number}> = ({at4, qAt}) => {
  const frame = useCurrentFrame();
  const s = useSpring('settleSoft', {at: at4 + 2, dur: 34});
  const fade = progress(frame, at4, 8) * (1 - progress(frame, at4 + 20, 14));
  const q = progress(frame, qAt, DUR.f4);
  const bob = Math.sin((frame - qAt) / 26) * 6;
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      {[-1, 1].map((side) => (
        <div
          key={side}
          style={{
            position: 'absolute',
            left: 960 + side * 430 - 190,
            top: 200,
            width: 380,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 64,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: side < 0 ? theme.concept : theme.conceptDeep,
            opacity: fade,
            transform: `translate(${-side * 300 * s}px, ${240 * s}px) scale(${1 - 0.72 * s})`,
          }}
        >
          {side < 0 ? '1420万' : '1280万'}
        </div>
      ))}
      <DefinitionCard at={at4 + 26} empty enter="rise" />
      <div
        style={{
          position: 'absolute',
          top: 212,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: q,
          transform: `translateY(${(1 - q) * -14 + bob * q}px)`,
        }}
      >
        <span
          style={{
            fontFamily: theme.serif,
            fontSize: 38,
            color: theme.concept,
            padding: '10px 26px',
            borderRadius: 999,
            border: `1.5px dashed ${withA(theme.concept, 0.55)}`,
            background: withA(theme.panel, 0.72),
          }}
        >
          {'「收入该怎么算？」'}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 0-E 密码列

/** 密码列：幽灵字符流上涌 + 主列名打字机揭示（@reveal）+ 释义卡底部顶开（@enter:pop）。 */
const CipherColumn: React.FC<{at8: number; glossAt: number}> = ({at8, glossAt}) => {
  const frame = useCurrentFrame();
  const typed = useReveal('amt_ttl_pre_dsc', {at: at8 + 4, framesPerChar: 3});
  const gloss = useEnter('pop', {at: glossAt, dur: DUR.f5});
  const push = progress(frame, glossAt, DUR.f5);
  const chips = [
    {k: 'AMT', zh: '金额'},
    {k: 'TTL', zh: '合计'},
    {k: 'PRE_DSC', zh: '折扣前'},
  ];
  return (
    <AbsoluteFill
      style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 96}}
    >
      {/* 幽灵字符流：同一列名低透明度确定性上涌（瀑布质感） */}
      <div style={{position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none'}}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              textAlign: 'center',
              top: 110 + i * 210 - ((frame * 0.9 + i * 53) % 210),
              fontFamily: theme.mono,
              fontSize: 64,
              letterSpacing: 6,
              color: withA(theme.text, 0.05),
              whiteSpace: 'nowrap',
            }}
          >
            {'amt_ttl_pre_dsc'}
          </div>
        ))}
      </div>
      {/* 主列名：逐字符滚过 + 光标闪烁 */}
      <div style={{fontFamily: theme.mono, fontSize: 92, letterSpacing: 6, color: theme.text, minHeight: 116}}>
        {typed}
        <span style={{opacity: frame % 18 < 9 ? 1 : 0, color: theme.concept}}>{'▍'}</span>
      </div>
      {/* 释义卡：外层 rise 推挤（「从底部顶开」）+ 内层 pop 落位 */}
      <div style={{marginTop: 60, transform: `translateY(${(1 - push) * 46}px)`}}>
        <div
          style={{
            ...gloss,
            background: theme.panel,
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 14,
            padding: '26px 34px',
            minWidth: 720,
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
            <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim}}>{'amt_ttl_pre_dsc'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.concept}}>{'→'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 44, fontWeight: 700, color: theme.concept}}>
              {'折前总金额'}
            </span>
          </div>
          <div style={{marginTop: 16, display: 'flex', gap: 12}}>
            {chips.map((c, i) => {
              const p = progress(frame, glossAt + 8 + i * 5, DUR.f3);
              return (
                <span
                  key={c.k}
                  style={{
                    opacity: p,
                    fontFamily: theme.mono,
                    fontSize: 19,
                    color: theme.dim,
                    border: `1.5px solid ${withA(theme.panelBorder, 0.9)}`,
                    borderRadius: 7,
                    padding: '4px 12px',
                  }}
                >
                  {`${c.k} · ${c.zh}`}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 0-F 钥匙贯穿脉冲

/** 钥匙贯穿脉冲（@impulse）：顶带小装置——钥匙下落穿闸，贯穿处一次性辉光脉冲。
 *  画框上缘（y150）之外的角标件，不与全屏独占画框重叠。 */
const KeyPulse: React.FC<{at12: number}> = ({at12}) => {
  const frame = useCurrentFrame();
  const drop = progress(frame, at12 + 4, 24);
  const pierce = useImpulse({at: at12 + 21, dur: 18, peak: 1});
  const labelO = progress(frame, at12 + 26, DUR.f3);
  const keyY = 2 + drop * 40;
  return (
    <div style={{position: 'absolute', top: 62, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
      <svg width={320} height={78} viewBox="0 0 320 78">
        {/* 闸门横杆：中段留缝 */}
        <line x1={8} y1={38} x2={132} y2={38} stroke={theme.dim} strokeWidth={3} opacity={0.8} />
        <line x1={188} y1={38} x2={312} y2={38} stroke={theme.dim} strokeWidth={3} opacity={0.8} />
        {/* 贯穿闪光：缝隙桥接 + 两端一次性脉冲扩散 */}
        {pierce > 0 ? (
          <>
            <line x1={132} y1={38} x2={188} y2={38} stroke={theme.conceptDeep} strokeWidth={3} opacity={0.85 * pierce} />
            <circle cx={132} cy={38} r={4 + 10 * pierce} fill="none" stroke={theme.conceptDeep} strokeWidth={2} opacity={0.8 * pierce} />
            <circle cx={188} cy={38} r={4 + 10 * pierce} fill="none" stroke={theme.conceptDeep} strokeWidth={2} opacity={0.8 * pierce} />
          </>
        ) : null}
        {/* 钥匙：环头 + 杆 + 齿，下落穿缝 */}
        <g
          transform={`translate(160 ${keyY})`}
          opacity={0.96}
          style={{filter: pierce > 0 ? `drop-shadow(0 0 ${16 * pierce}px ${withA(theme.conceptDeep, 0.8)})` : 'none'}}
        >
          <circle cx={0} cy={-8} r={9} fill="none" stroke={theme.conceptDeep} strokeWidth={3.5} />
          <line x1={0} y1={1} x2={0} y2={26} stroke={theme.conceptDeep} strokeWidth={3.5} strokeLinecap="round" />
          <line x1={0} y1={18} x2={9} y2={18} stroke={theme.conceptDeep} strokeWidth={3.5} strokeLinecap="round" />
          <line x1={0} y1={25} x2={7} y2={25} stroke={theme.conceptDeep} strokeWidth={3.5} strokeLinecap="round" />
        </g>
        <text x={160} y={72} textAnchor="middle" fontFamily={theme.mono} fontSize={15} fill={theme.dim} opacity={labelO}>
          {'Agent · 穿透'}
        </text>
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────── 0-H 片名卡

/** 片名卡：金/紫/青三色描边定契约 + 划入（@enter:slide）。caption-dup-ok: 片名卡
 *  为 storyboard 逐字指定的标题（narration 无同句，字幕带不同屏）。 */
const TitleCard: React.FC<{at16: number}> = ({at16}) => {
  const frame = useCurrentFrame();
  const enter = useEnter('slideL', {at: at16, dur: DUR.f6, dist: 70});
  const scrim = progress(frame, at16 - 6, DUR.f5);
  const bars = [
    {c: theme.concept, zh: '口径'},
    {c: theme.conceptDeep, zh: '治理'},
    {c: theme.verify, zh: '验证'},
  ];
  return (
    <AbsoluteFill style={{background: withA(theme.bg, 0.93 * scrim), justifyContent: 'center'}}>
      {/* 垂直居中（AbsoluteFill 默认 flex-start 会整块贴顶、下半空屏）；水平居中由 textAlign 承担 */}
      <div style={{...enter, textAlign: 'center'}}>
        <div style={{display: 'flex', gap: 30, justifyContent: 'center', marginBottom: 46}}>
          {bars.map((b, i) => {
            const p = progress(frame, at16 + 6 + i * 7, DUR.f4);
            return (
              <div key={b.zh} style={{display: 'flex', alignItems: 'center', gap: 10, opacity: p}}>
                <div
                  style={{
                    width: 148,
                    height: 4,
                    background: b.c,
                    transform: `scaleX(${p})`,
                    transformOrigin: 'left center',
                  }}
                />
                <span style={{fontFamily: theme.mono, fontSize: 18, color: b.c}}>{b.zh}</span>
              </div>
            );
          })}
        </div>
        <div style={{fontFamily: theme.serif, fontSize: 84, fontWeight: 700, color: theme.text, lineHeight: 1.3}}>
          {'拆解 Horizon Context'}
        </div>
        <div style={{marginTop: 18, fontFamily: theme.serif, fontSize: 38, color: theme.dim}}>
          {'含义怎么治理 · 答案怎么可信'}
        </div>
      </div>
    </AbsoluteFill>
  );
};
