/** P4 生产版的目录（p4-01..p4-08，3 镜）——分镜 4-A / 4-B / 4-C。
 *
 *  叙事链：4-A 拉远全景（自 P3 峰值降压重锚，@pushIn 负增量）：生产舞台纵深——
 *  中央一张目录带（生产版，紫）放大驻中；「真实的」舞台空置一拍（拉远落定 ≥15
 *  帧）→「拆解过…源码的同学们」归属签贴上（【三】级归属句视觉锚，承系列审批
 *  口径）、「在册十类」来源计数定格 10（角标 loadSkillsDir / SkillTool）→ 四
 *  代表来源卡（自装/项目/插件/远程）stagger 亮起、「同一张目录」四卡汇流入带
 *  （汇流箭头单向）；其余六类暗态计数（留档不展开）；环体弱在场一拍即隐（G1
 *  修订——非缩悬常驻）→ 4-B 窗口与预算闸特写：「上下文窗口」「上限」容器条
 *  立起、容量面亮出（前置概念先释帧）→「百分之一」1% 切片线切出（目录带在
 *  窗口中只占一线）、「上限八千字符」8000 上限签压定（预算闸落下——「按死」
 *  的具象，重音镜；角标 getSkillListingAttachments ~1% / 8000 chars；归属签
 *  承 4-A 可追）→ 4-C 官方印证与截断尺：「官方文档」印证卡贴上（【二】级归属
 *  措辞锚）、「零成本」全文卡虚位轮廓亮出（在场/不在场对照——承双子装置）
 *  →「一千五百三十六」1536 截断尺压下、目录行超出部分裁落（角标 when_to_use ·
 *  1,536 chars · skillListingMaxDescChars 默认值口径）→「目录自己，就是常驻
 *  内容」收点金句帧淡入定格（压缩短语：目录＝常驻内容）〔M-003〕。
 *
 *  空间契约：来源卡单向汇入、十类计数与四代表分层（4 亮 + 6 暗态计数）、汇流
 *  箭头单向、1% 切片与窗口面积比例可读（大于可读一线即失真）、预算闸双标
 *  （~1% 与 8000）齐全、归属签可见且两镜同款、截断裁切量与 1536 默认口径一致、
 *  截断尺必有裁切效果、金句帧为压缩短语非整句、环体一拍即隐不驻留。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；loadSkillsDir / SkillTool /
 *  getSkillListingAttachments / when_to_use / 1,536 chars / skillListingMaxDescChars
 *  只进角标；计数读数 Math.round(有界值) 直取。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CatalogBand, FullTextCard, LoopRing} from '../components/motifs';
import {DUR, clamp01, progress, useCount, useImpulse, useProgress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 四代表来源卡位（四方汇入——箭头恒指向带） */
const SOURCES = [
  {zh: '自装', en: 'user', x: 240, y: 660},
  {zh: '项目带的', en: 'project', x: 240, y: 830},
  {zh: '插件捎的', en: 'plugin', x: 1500, y: 660},
  {zh: '远程推的', en: 'remote', x: 1500, y: 830},
] as const;

const BAND4 = {x: 460, y: 380, w: 1000, h: 190} as const;

// ── 4-A 拉远全景：十类汇流 + 归属签 + 环体一拍即隐 ──────────────────────

const FourA: React.FC<{atPull: number; atCredit: number; atTen: number; atSrc: number; atFlow: number; atRing: number}> = ({
  atPull,
  atCredit,
  atTen,
  atSrc,
  atFlow,
  atRing,
}) => {
  const frame = useCurrentFrame();
  // @pushIn 负增量（设问起自 P3 峰值拉远降压、重锚生产全景）
  const pull = usePushIn(atPull, {scale: -0.06, dur: DUR.f6 + DUR.f4});
  // 「真实的」舞台空置一拍（拉远落定 ≥15 帧——带独驻中即「空置」语义）
  const settle = useProgress(atPull + DUR.f4, DUR.f5);
  // 归属签贴上（【三】级归属句视觉锚——4-B/4-C 同款可追）
  const credit = useProgress(atCredit, DUR.f4);
  // 「在册十类」来源计数定格 10（数据本体：count-up 到位即止）
  const ten = useCount({to: 10, at: atTen, dur: DUR.f5});
  // 四代表来源卡 stagger 亮起（次序=口播）
  const srcLit = [0, 1, 2, 3].map((i) => clamp01(progress(frame, atSrc + i * 7, DUR.f4)));
  // 「同一张目录」四卡汇流入带（卡片向带位移 + 单向箭头）
  const flow = clamp01(progress(frame, atFlow, DUR.f6));
  // 环体弱在场一拍即隐（G1 修订③——非缩悬常驻：淡入一拍、随即淡出归零）
  const ringIn = useProgress(atRing, DUR.f4);
  const ringOut = useProgress(atRing + DUR.f5 + DUR.f4, DUR.f5);
  const ringO = ringIn * (1 - ringOut);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: pull, transformOrigin: '50% 50%'}}>
        {/* 环体（弱在场一拍即隐——深处淡显淡退） */}
        {ringO > 0.02 ? (
          <div style={{position: 'absolute', left: 140, top: 120, opacity: 0.5 * ringO}}>
            <LoopRing size={120} nodes={[]} showExit={false} dotProgress={(frame / 75) % 1} />
          </div>
        ) : null}
        {/* 中央目录带（生产版·紫——放大驻中；拉远落定） */}
        <div style={{position: 'absolute', left: BAND4.x, top: BAND4.y, opacity: 0.35 + 0.65 * settle}}>
          <CatalogBand x={0} y={0} w={BAND4.w} h={BAND4.h} headLabel={'技能目录 · 生产版'} rowsLit={0} />
        </div>
        {/* 归属签（拆解过源码的同学们——【三】级归属锚） */}
        <div
          style={{
            position: 'absolute',
            left: BAND4.x,
            top: 250,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '7px 18px',
            borderRadius: 9,
            border: `2.5px solid ${withAlpha(theme.text, 0.8)}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 19,
            fontWeight: 600,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: credit,
          }}
        >
          {'拆解过 CC 源码的同学们'}
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'source-audit'}</span>
        </div>
        {/* 在册十类计数（4 亮 + 6 暗态计数——分层不展开） */}
        <div style={{position: 'absolute', left: BAND4.x + BAND4.w - 250, top: 252, textAlign: 'right', opacity: clamp01(ten / 10)}}>
          <span style={{fontFamily: theme.mono, fontSize: 40, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums'}}>
            {String(Math.round(ten))}
          </span>
          <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginLeft: 10}}>{'类来源在册'}</span>
          <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 2}}>{'loadSkillsDir / SkillTool'}</div>
          {/* 六类暗态计数（留档不展开——暗点阵） */}
          <div style={{display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8}}>
            {Array.from({length: 6}, (_, i) => (
              <div key={i} style={{width: 18, height: 18, borderRadius: 4, border: `2px solid ${withAlpha(theme.dim, 0.5)}`, opacity: 0.55}} />
            ))}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, marginTop: 4}}>{'其余六类 · 留档'}</div>
        </div>
        {/* 四代表来源卡（四方汇入——位移向带 + 单向箭头） */}
        {SOURCES.map((s, i) => {
          const lit = srcLit[i];
          const towardX = (BAND4.x + BAND4.w / 2 - s.x) * 0.24 * flow;
          const towardY = (BAND4.y + BAND4.h / 2 - s.y) * 0.2 * flow;
          return (
            <div key={s.en} style={{position: 'absolute', left: s.x + towardX, top: s.y + towardY, opacity: lit}}>
              <div
                style={{
                  padding: '10px 18px',
                  borderRadius: 9,
                  border: `2.5px solid ${lit > 0.5 ? theme.mech : theme.panelBorder}`,
                  background: lit > 0.5 ? withAlpha(theme.mech, 0.1) : theme.panel,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 600, color: lit > 0.5 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{s.zh}</span>
                <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{s.en}</span>
              </div>
              {/* 汇流箭头（单向指向带——流场点亮后显形） */}
              <svg width={150} height={40} viewBox="0 0 150 40" style={{position: 'absolute', overflow: 'visible', opacity: flow * lit, left: i < 2 ? 190 : -190, top: 6}}>
                <line
                  x1={i < 2 ? 0 : 150}
                  y1={20}
                  x2={i < 2 ? 118 : 32}
                  y2={20}
                  stroke={withAlpha(theme.mech, 0.8)}
                  strokeWidth={3.5}
                  strokeDasharray="8 7"
                />
                <path
                  d={i < 2 ? 'M 112 12 L 128 20 L 112 28' : 'M 38 12 L 22 20 L 38 28'}
                  fill="none"
                  stroke={withAlpha(theme.mech, 0.9)}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75 * settle}}>
        {'生产舞台 · 十类汇一张目录'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 窗口与预算闸：容器立起 + 1% 切片 + 8000 压定 ─────────────────────

const WIN = {x: 320, y: 210, w: 1280, h: 560} as const;

const FourB: React.FC<{atWin: number; atSlice: number; atGate: number}> = ({atWin, atSlice, atGate}) => {
  const frame = useCurrentFrame();
  // 「上下文窗口」容器条立起 +「上限」容量面亮出（前置概念先释帧）
  const win = useProgress(atWin, DUR.f6, 'decelerate');
  // 「百分之一」1% 切片线切出（目录带在窗口中只占一线）
  const slice = useProgress(atSlice, DUR.f5);
  // 「上限八千字符」预算闸落下（「按死」的具象——重音镜；8000 上限签压定）
  const gate = useProgress(atGate, DUR.f5, 'accelerate');
  const gateFlash = useImpulse({at: atGate + DUR.f4, dur: DUR.f6, peak: 1});
  // 目录切片宽（一线——占窗 ~3% 可读一线、角标口径 ~1%）
  const sliceW = 44 * slice;
  return (
    <AbsoluteFill>
      {/* 上下文窗口容器（承 5-C 同形——窗口上限线的母形） */}
      <div style={{position: 'absolute', left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h * win, opacity: clamp01(win * 2)}}>
        <div
          style={{
            width: '100%',
            height: WIN.h,
            boxSizing: 'border-box',
            borderRadius: 16,
            border: `3.5px solid ${withAlpha(theme.dim, 0.85)}`,
            background: withAlpha(theme.panel, 0.55),
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 容量面（文本上限——容量感的可读面） */}
          <div style={{position: 'absolute', inset: 10, borderRadius: 10, border: `2px dashed ${withAlpha(theme.dim, 0.35)}`, background: withAlpha(theme.dim, 0.04)}} />
          <div style={{position: 'absolute', left: 26, top: 20, fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{'上下文窗口 · 单轮装得下的文本上限'}</div>
          {/* 目录切片（紫——只占一线；切片线 = 右缘标线） */}
          {slice > 0.02 ? (
            <div
              style={{
                position: 'absolute',
                left: 16,
                top: 66,
                width: sliceW,
                height: WIN.h - 96,
                boxSizing: 'border-box',
                borderRadius: 7,
                border: `2.5px solid ${theme.mech}`,
                background: withAlpha(theme.mech, 0.18),
                opacity: slice,
              }}
            >
              <div style={{position: 'absolute', left: 0, right: 0, top: 8, textAlign: 'center', fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.text, writingMode: 'vertical-rl', letterSpacing: 4}}>
                {'目录'}
              </div>
            </div>
          ) : null}
          {/* 1% 切片线（切片右缘——切出的一线） */}
          {slice > 0.02 ? (
            <div style={{position: 'absolute', left: 16 + sliceW + 8, top: 66, bottom: 30, width: 0, borderTop: 0, borderLeft: `3px dashed ${withAlpha(theme.text, 0.7)}`}} />
          ) : null}
          <div style={{position: 'absolute', left: 16 + sliceW + 18, top: 78, fontFamily: theme.mono, fontSize: 16, color: theme.text, whiteSpace: 'nowrap', opacity: slice}}>
            {'~1% · 一线'}
          </div>
          {/* 预算闸（横闸压顶——自上而下压到切片上沿；8000 上限签） */}
          {gate > 0.02 ? (
            <div style={{position: 'absolute', left: -10, top: 60 - 44 * (1 - gate), width: WIN.w + 20, opacity: clamp01(gate * 1.6)}}>
              <div
                style={{
                  width: '100%',
                  height: 26,
                  boxSizing: 'border-box',
                  borderRadius: 8,
                  background: withAlpha(theme.text, 0.9),
                  boxShadow: gateFlash > 0.05 ? `0 0 ${30 * gateFlash}px ${withAlpha(theme.text, 0.5)}` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                }}
              >
                <span style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.bg}}>{'预算闸 · 上限 8000 字符'}</span>
                <span style={{fontFamily: theme.mono, fontSize: 12, color: withAlpha(theme.bg, 0.8)}}>{'skillListingMaxChars'}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {/* 角标（getSkillListingAttachments ~1% / 8000 chars）+ 归属签承 4-A */}
      <div style={{position: 'absolute', left: WIN.x, top: WIN.y + WIN.h + 24, fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap', opacity: slice}}>
        {'getSkillListingAttachments · ~1% / 8000 chars'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: WIN.x + WIN.w - 300,
          top: WIN.y + WIN.h + 24,
          padding: '3px 12px',
          borderRadius: 7,
          border: `2px solid ${withAlpha(theme.text, 0.6)}`,
          fontFamily: theme.sans,
          fontSize: 14,
          color: theme.dim,
          whiteSpace: 'nowrap',
          opacity: 0.9,
        }}
      >
        {'归属 · 拆解过 CC 源码的同学们'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75 * win}}>
        {'预算按死 · 窗口的一线'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 官方印证与截断尺：虚位轮廓 + 1536 裁切 + 收点金句 ─────────────────

const FourC: React.FC<{atProof: number; atGhost: number; atCut: number; atQuote: number}> = ({atProof, atGhost, atCut, atQuote}) => {
  const frame = useCurrentFrame();
  // 「官方文档」印证卡贴上（【二】级归属措辞锚）
  const proof = useProgress(atProof, DUR.f4);
  // 「零成本」全文卡虚位轮廓亮出（在场/不在场对照——承双子装置）
  const ghost = useProgress(atGhost, DUR.f5);
  // 「一千五百三十六」截断尺压下 + 目录行超出部分裁落（裁切量与默认口径一致）
  const cut = useProgress(atCut, DUR.f5, 'accelerate');
  const cutFlash = useImpulse({at: atCut + DUR.f4, dur: DUR.f5, peak: 1});
  // 超出段裁落位移（裁下的尾巴掉落一拍——帧驱动）
  const dropT = clamp01(progress(frame, atCut + DUR.f4, DUR.f5));
  // 「目录自己，就是常驻内容」收点金句帧（压缩短语——淡入定格）
  const quote = useProgress(atQuote, DUR.f6);
  const kGlow = useImpulse({at: atQuote + DUR.f5, dur: DUR.f6, peak: 0.06});
  return (
    <AbsoluteFill>
      {/* 印证卡（官方文档——【二】级归属锚） */}
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 130,
          padding: '10px 20px',
          borderRadius: 10,
          border: `2.5px solid ${withAlpha(theme.tool, 0.85)}`,
          background: withAlpha(theme.tool, 0.07),
          opacity: proof,
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
          <span style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.text}}>{'官方文档印证'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'skills · docs'}</span>
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim, marginTop: 6, whiteSpace: 'nowrap'}}>{'只在使用时加载 · 用到之前几乎零成本'}</div>
      </div>
      {/* 目录行卡（描述 + 使用时机双字段——1536 截断尺压住） */}
      <div style={{position: 'absolute', left: 150, top: 320, width: 900}}>
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginBottom: 8}}>{'目录行 · description + when_to_use'}</div>
        <div style={{position: 'relative', width: 900, height: 250}}>
          {/* 目录行本体（双字段合计——超出 1536 处以裁切线为界） */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              boxSizing: 'border-box',
              borderRadius: 12,
              border: `3px solid ${theme.mech}`,
              background: withAlpha(theme.panel, 0.95),
              padding: '18px 22px',
              overflow: 'hidden',
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.text}}>{'界面规范'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 10, lineHeight: 1.7}}>
              {'组件写法约定 · 命名 · 目录结构 · 状态管理 · 样式规范 · 可访问性 · 测试约定 · ……（描述字段）'}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 8, lineHeight: 1.7}}>
              {'何时用：新建或改组件时（使用时机字段）……'}
            </div>
          </div>
          {/* 截断尺（横尺压下——1536 处的界线；裁下的尾巴掉落） */}
          {cut > 0.02 ? (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 96 - 90 * (1 - cut),
                  width: 900,
                  height: 16,
                  boxSizing: 'border-box',
                  borderRadius: 5,
                  background: withAlpha(theme.text, 0.92),
                  boxShadow: cutFlash > 0.05 ? `0 0 ${26 * cutFlash}px ${withAlpha(theme.text, 0.5)}` : 'none',
                  opacity: clamp01(cut * 2),
                }}
              />
              <div style={{position: 'absolute', left: 8, top: 96 - 90 * (1 - cut) - 30, fontFamily: theme.mono, fontSize: 15, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', opacity: clamp01(cut * 2)}}>
                {'1,536 chars · 截断'}
              </div>
              {/* 被裁落段（超出部分——掉落变暗；「管着」的裁切效果） */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 112 + 60 * dropT,
                  width: 900,
                  height: 130,
                  borderRadius: 10,
                  border: `2.5px dashed ${withAlpha(theme.dim, 0.6)}`,
                  opacity: 0.5 * (1 - dropT * 0.7),
                  filter: 'saturate(0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.mono,
                  fontSize: 14,
                  color: theme.dim,
                  whiteSpace: 'nowrap',
                }}
              >
                {'超出默认上限 · 裁落'}
              </div>
            </>
          ) : null}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 10, whiteSpace: 'nowrap', opacity: cut}}>
          {'when_to_use · skillListingMaxDescChars 默认 1,536'}
        </div>
      </div>
      {/* 全文卡虚位轮廓（用到之前不在场——在场/不在场对照） */}
      <div style={{position: 'absolute', left: 1370, top: 300, opacity: ghost}}>
        <FullTextCard x={0} y={0} w={330} h={440} rowsLit={0} dashMode={ghost} title={'全文 · 用到才来'} tag={''} />
      </div>
      {/* 收点金句帧（压缩短语——淡入定格） */}
      {quote > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 330,
            top: 740,
            opacity: quote,
            transform: `translateY(${(1 - quote) * 16}px)`,
          }}
        >
          <div
            style={{
              padding: '16px 40px',
              borderRadius: 12,
              border: `3px solid ${withAlpha(theme.mech, 0.85)}`,
              background: theme.panel,
              fontFamily: theme.serif,
              fontSize: 40,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              textShadow: kGlow > 0.01 ? `0 0 ${22 * kGlow}px ${withAlpha(theme.mech, 0.5)}` : 'none',
            }}
          >
            {'目录＝常驻内容'}
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'清单截断 · 目录要短'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P4ProductionCatalog: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p4-01', 'p4-03');
  const bB = w('p4-04', 'p4-05');
  const bC = w('p4-06', 'p4-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <FourA
          atPull={0}
          atCredit={wa('p4-02', 0.24) - bA.from}
          atTen={wa('p4-02', 0.68) - bA.from}
          atSrc={wa('p4-03', 0.2) - bA.from}
          atFlow={wa('p4-03', 0.72) - bA.from}
          atRing={wa('p4-01', 0.1) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FourB atWin={wa('p4-04', 0.24) - bB.from} atSlice={wa('p4-05', 0.24) - bB.from} atGate={wa('p4-05', 0.62) - bB.from} />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <FourC
          atProof={wa('p4-06', 0.2) - bC.from}
          atGhost={wa('p4-06', 0.62) - bC.from}
          atCut={wa('p4-07', 0.42) - bC.from}
          atQuote={wa('p4-08', 0.36) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4ProductionCatalog;
