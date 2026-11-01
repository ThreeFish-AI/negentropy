/** P3 不存在的编号（p3-01..p3-10，5 镜）——分镜 3-A / 3-B / 3-C / 3-D / 3-E。
 *
 *  叙事链：3-A 开帧墙全局位一拍（四绿卡 + 墙角灰卡位高亮——2-F 灰卡屏位的
 *  eye-trace 呼应）→ 急推灰卡特写：依赖列表里不存在的编号（虚线问号 task_999）
 *  高亮框闪烁 → 基线态：关卡红挡压卡、「保持待领」标签钉住（终态静持）→
 *  3-B 开关拆解：规则条竖排——首条「不存在 ⇒ 被挡」被墨迹改写为「不存在 ⇒
 *  忽略」（单变量：变元高亮、常元灰置、其余三条置灰不动）→ 认领箭头穿过
 *  抬起的小半个闸门、灰卡被签名——幽灵任务上了岗（签名半透明＋警示红描边
 *  闪——全片张力峰值 punch 1–2s）→ 3-C 左红右绿消融同屏（G1 修订④：右轨
 *  基线＝拦截红挡在位＋确认绿框守护环**双层语义**——基线被挡=机制在位=绿）
 *  ＋两轨日志条实测值（左 Claimed: ghost / 右 Blocked by: task_999）＋中央
 *  概念对比签（未完成=活没干完 ↔ 不存在=编号写错）＋镜尾金句短签（衬线体）
 *  「挡住＝晚开工 · 放行＝错上加错」横贯定夺 → 3-D 同卡之争：一张卡复制成
 *  两张同款并列（同编号、两人各抢一签、冲突闪红一拍）＋金句卡「看见 ≠ 抢到」
 *  定格＋「一把锁」（G1 修订⑥词窗）锁形剪影一闪悬置（P4 兑现钩）→ 3-E 拉远
 *  收幕：教学版墙全貌入框＋远处地平线重墙轮廓渐显（九槽位暗影——真实版
 *  预告意象，降压转场）。
 *
 *  空间契约：基线态=被挡+保持待领（终态静持）、日志值与实验记录逐字一致；
 *    只有一条规则被改（其余灰置条数前后一致）、幽灵签名半透明可辨真假；
 *    红左绿右恒定、右轨零退化、左轨不呈现为成功态；两卡同编号、锁为剪影
 *    不显内部结构；重墙为轮廓剪影不显字段。
 *
 *  红线落实：词落位 = wa(id,f)（manifest 已就位——⑧ 轮按句内字位复核一轮通过，
 *    词级实测复核留 ⑨ 轮 QA；登记口径见 P0 头注）；y≥56 / bottom≥176；E1 · fail-closed ·
 *    Blocked by: task_999 · Claimed: ghost 只进角标（与 B.2 实测日志逐字一致）。
 *
 *  承接登记：2-F→3-A SceneFade＋灰卡同形签名回归（镜间身份恒常，位置呼应
 *    承接）；3-E→4-A morph（storyboard 登记）——重墙轮廓剪影渐显体量、描边
 *    色渐入，屏位（远处同位）不变，4-A 首帧轮廓兑现为真墙全景。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  GateArm,
  SLOT_H,
  SLOT_W,
  TaskWall,
  WALL,
  WALL_SLOTS,
  WallCard,
} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const slotPos = (slot: number) => WALL_SLOTS[slot];
const slotCenter = (slot: number) => ({x: slotPos(slot).x + SLOT_W / 2, y: slotPos(slot).y + SLOT_H / 2});
const GREEN_CARDS = [
  {slot: 0, title: '写初稿', id: 'task_001', signer: '写手 · 甲'},
  {slot: 1, title: '排版', id: 'task_003', signer: '写手 · 乙'},
  {slot: 2, title: '发布', id: 'task_004', signer: '写手 · 甲'},
  {slot: 3, title: '配图', id: 'task_002', signer: '写手 · 乙'},
] as const;

// ── 3-A 陷阱卡登场：全局位一拍 → 急推灰卡 → task_999 高亮 → 基线态定格 ────

const ThreeA: React.FC<{atZoom: number; atHighlight: number; atBar: number; atPin: number}> = ({atZoom, atHighlight, atBar, atPin}) => {
  const frame = useCurrentFrame();
  // 急推（显式帧数 26f：自墙全景压向陷阱卡主角——@pushIn 词锚动机）
  const zoomP = clamp01(progress(frame, atZoom, 26));
  const o = slotCenter(5);
  const c = {x: 920, y: 540};
  const z = 1 + (2.1 - 1) * zoomP;
  const zoomTf = `translate(${(c.x - o.x) * zoomP}px, ${(c.y - o.y) * zoomP}px) scale(${z})`;
  // 灰卡位高亮（开帧全局位一拍中：2-F 灰卡屏位的呼应锚）
  const ghostHi = clamp01(progress(frame, 2, DUR.f4)) * (1 - zoomP);
  // 不存在的编号高亮框闪烁（两下）
  const hiT = clamp01(progress(frame, atHighlight, 26));
  const blink = hiT < 0.33 ? 1 : hiT < 0.5 ? 0.2 : hiT < 0.8 ? 1 : 0.35;
  // 基线态：红挡压下（右挡=不存在型）+「保持待领」标签钉住（终态静持）
  const bar = clamp01(progress(frame, atBar, DUR.f4));
  const pin = clamp01(progress(frame, atPin, DUR.f4));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: zoomTf, transformOrigin: `${o.x}px ${o.y}px`}}>
        <TaskWall litP={1} slotsP={1} glowP={0.3} />
        {GREEN_CARDS.map((cd) => (
          <WallCard key={cd.id} x={slotPos(cd.slot).x} y={slotPos(cd.slot).y} title={cd.title} id={cd.id} state="done" greenP={1} signP={1} signer={cd.signer} deps={cd.slot === 1 ? [{id: 'task_001', doneP: 1}, {id: 'task_002', doneP: 1}] : cd.slot === 2 ? [{id: 'task_003', doneP: 1}] : undefined} depsP={1} />
        ))}
        {/* 灰卡（低饱和紫 + 病态语义）＋依赖列表里的 task_999 虚线问号签 */}
        <WallCard x={slotPos(5).x} y={slotPos(5).y} title="?" id="task_005" grayP={1} deps={[{id: 'task_999', ghostP: 1}]} depsP={1} />
        {/* 灰卡位高亮框（全局位一拍期的呼应锚） */}
        {ghostHi > 0.03 ? (
          <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
            <rect x={slotPos(5).x - 10} y={slotPos(5).y - 10} width={SLOT_W + 20} height={SLOT_H + 20} rx={14} fill="none" stroke={theme.danger} strokeWidth={3} strokeDasharray="10 8" opacity={ghostHi * 0.85} />
          </svg>
        ) : null}
        {/* task_999 高亮框（闪烁两下——zoom 后显著） */}
        {blink > 0.03 && hiT > 0 ? (
          <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
            <rect x={slotPos(5).x + SLOT_W - 178} y={slotPos(5).y + SLOT_H - 102} width={168} height={58} rx={10} fill="none" stroke={theme.danger} strokeWidth={4} opacity={blink * 0.95} />
          </svg>
        ) : null}
        {/* 关卡红挡（压卡——右挡「依赖不存在」型） */}
        <GateArm x={slotPos(5).x - 130} y={slotPos(5).y + SLOT_H / 2 - 46} w={200} dropP={1} bar="right" barP={bar} />
        {/* 「保持待领」标签（钉在卡角——基线态定格） */}
        {pin > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: slotPos(5).x + SLOT_W - 150,
              top: slotPos(5).y - 20,
              padding: '6px 20px',
              borderRadius: 9,
              border: `3px solid ${withAlpha(theme.dim, 0.9)}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 20,
              fontWeight: 700,
              color: theme.dim,
              whiteSpace: 'nowrap',
              opacity: pin,
              transform: `translateY(${(1 - pin) * -12}px)`,
            }}
          >
            {'保持待领'}
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'E1 · fail-closed · Blocked by: task_999'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 开关拆解：规则条墨迹改写（单变量）+ 幽灵上岗（张力峰值） ────────────

const RULES = [
  {t: '不存在 ⇒ 被挡', varRule: true},
  {t: '未完成 ⇒ 被挡', varRule: false},
  {t: '非待领 ⇒ 不可认领', varRule: false},
  {t: '已归属 ⇒ 不可抢', varRule: false},
] as const;

const ThreeB: React.FC<{atFocus: number; atRewrite: number; atGrayOut: number; atArrow: number; atGhostSign: number}> = ({atFocus, atRewrite, atGrayOut, atArrow, atGhostSign}) => {
  const frame = useCurrentFrame();
  // 规则条聚焦（首条=变元）
  const focus = clamp01(progress(frame, atFocus, DUR.f4));
  // 墨迹改写：「被挡」划掉 +「忽略」写上（同条内替换——只有一条规则被改）
  const rewrite = clamp01(progress(frame, atRewrite, 24));
  // 其余三条同步置灰（单变量消融：常元灰置、条数前后一致）
  const grayOut = clamp01(progress(frame, atGrayOut, DUR.f4));
  // 认领箭头再次推进（穿过抬起的小半个闸门）
  const arrow = clamp01(progress(frame, atArrow, 26));
  // 幽灵签名（半透明＋警示红描边闪——punch 1–2s）
  const ghostSign = clamp01(progress(frame, atGhostSign, 18));
  const ghostFlash = Math.sin(Math.PI * clamp01(progress(frame, atGhostSign + 6, 36)));
  return (
    <AbsoluteFill>
      {/* 规则条列表（竖排——首条变元高亮、其余常元） */}
      <div style={{position: 'absolute', left: 200, top: 176, width: 600, display: 'flex', flexDirection: 'column', gap: 20}}>
        {RULES.map((r, i) => {
          const isVar = r.varRule;
          const op = isVar ? focus : (1 - grayOut * 0.65) * focus;
          const strike = isVar ? rewrite : 0;
          return (
            <div
              key={r.t}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 22px',
                borderRadius: 11,
                border: `3px ${isVar ? 'solid' : 'solid'} ${isVar ? withAlpha(theme.mech, 0.85) : withAlpha(theme.panelBorder, 0.85)}`,
                background: isVar ? withAlpha(theme.mech, 0.12) : withAlpha(theme.panel, 0.8),
                opacity: 0.4 + 0.6 * clamp01(op),
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 16, color: isVar ? theme.mech : theme.dim, whiteSpace: 'nowrap'}}>{`R${i + 1}`}</span>
              <span style={{position: 'relative', fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: isVar ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>
                {/* 墨迹改写：「被挡」划掉 →「忽略」浮现（同位替换——单变量） */}
                <span style={{textDecoration: strike > 0.4 ? 'line-through' : 'none', textDecorationColor: theme.danger, textDecorationThickness: 3.5}}>{'不存在 ⇒ '}</span>
                <span style={{textDecoration: strike > 0.4 ? 'line-through' : 'none', textDecorationColor: theme.danger, textDecorationThickness: 3.5, opacity: 1 - 0.55 * strike}}>{'被挡'}</span>
                {strike > 0.35 ? (
                  <span style={{color: theme.danger, opacity: clamp01(rewrite * 2 - 0.7), marginLeft: 12}}>{'忽略'}</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
      {/* 灰卡（右——被改写后的错误放行现场） */}
      <div style={{position: 'absolute', left: 960, top: 210}}>
        {/* 小半个闸门（抬起一半——改写生效后的残缺关卡） */}
        <GateArm x={-180} y={110} w={170} dropP={1} halfP={rewrite} />
        <WallCard x={0} y={0} w={520} h={300} title="?" id="task_005" grayP={1} ghostP={ghostSign} signP={ghostSign} signer="幽灵 · 假" deps={[{id: 'task_999', ghostP: 1}]} depsP={1} />
        {/* 认领箭头（穿过抬起的小半个闸门——推进到卡面） */}
        <svg width={360} height={54} viewBox="0 0 360 54" style={{position: 'absolute', left: -360 + arrow * 330, top: 136, overflow: 'visible', opacity: clamp01(arrow * 2)}}>
          <line x1={0} y1={27} x2={280} y2={27} stroke={withAlpha(theme.danger, 0.8)} strokeWidth={5} strokeLinecap="round" />
          <path d="M 272 12 L 306 27 L 272 42" fill="none" stroke={theme.danger} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          <text x={4} y={50} fontFamily={theme.sans} fontSize={15} fontWeight={700} fill={theme.danger}>
            {'认领'}
          </text>
        </svg>
      </div>
      {/* 张力峰值 punch（红描边辉光一拍——幽灵上岗的视觉冲击） */}
      {ghostFlash > 0.03 ? (
        <div style={{position: 'absolute', inset: 0, boxShadow: `inset 0 0 ${130 * ghostFlash}px ${withAlpha(theme.danger, 0.2 * ghostFlash)}`, pointerEvents: 'none'}} />
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'Claimed: ghost（E1 实测）'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 左红右绿消融同屏：双轨对照 + 日志条 + 中央对比签 + 金句定夺 ──────────

const ThreeC: React.FC<{atTracks: number; atCmp: number; atL1: number; atL2: number; atQuote: number}> = ({atTracks, atCmp, atL1, atL2, atQuote}) => {
  const frame = useCurrentFrame();
  // 双轨对照整屏立起（等高裁决）
  const tracks = clamp01(progress(frame, atTracks, DUR.f5));
  // 中央概念对比签（未完成=活没干完 ↔ 不存在=编号写错——两半先后点亮）
  const cmp = clamp01(progress(frame, atCmp, DUR.f4));
  const l1 = clamp01(progress(frame, atL1, DUR.f4));
  const l2 = clamp01(progress(frame, atL2, DUR.f4));
  // 金句短签（衬线体——压缩签非整句）
  const quote = clamp01(progress(frame, atQuote, DUR.f5));
  const quoteGlow = Math.sin(Math.PI * clamp01(progress(frame, atQuote + 6, 30)));
  return (
    <AbsoluteFill>
      {/* 轨道标题（红左绿右恒定） */}
      <div style={{position: 'absolute', left: 250, top: 138, display: 'flex', alignItems: 'center', gap: 12, opacity: tracks}}>
        <span style={{width: 14, height: 14, borderRadius: 4, background: theme.danger}} />
        <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap'}}>{'拆掉规则后'}</span>
      </div>
      <div style={{position: 'absolute', left: 1210, top: 138, display: 'flex', alignItems: 'center', gap: 12, opacity: tracks}}>
        <span style={{width: 14, height: 14, borderRadius: 4, background: theme.ok}} />
        <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.ok, whiteSpace: 'nowrap'}}>{'基线'}</span>
      </div>
      {/* 左轨：半透明幽灵卡被认领签名（警示红描边——翻车就是翻车，不呈现成功态） */}
      <div style={{position: 'absolute', left: 250, top: 200, opacity: tracks}}>
        <WallCard x={0} y={0} w={480} h={300} title="?" id="task_005" grayP={1} ghostP={1} signP={1} signer="幽灵 · 假" deps={[{id: 'task_999', ghostP: 1}]} depsP={1} />
        {/* 左轨日志条（实测值——与 B.2 逐字一致） */}
        <div style={{marginTop: 26, padding: '8px 24px', borderRadius: 9, border: `3px solid ${withAlpha(theme.danger, 0.8)}`, background: theme.panel, fontFamily: theme.mono, fontSize: 22, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap', opacity: clamp01(tracks * 1.5 - 0.4)}}>
          {'Claimed: ghost'}
        </div>
      </div>
      {/* 右轨：基线陷阱卡被挡、保持待领（G1 修订④双层：拦截红挡在位＋确认绿框
          守护环——基线被挡=机制在位=绿，与 3-A 单纯拦截红区分） */}
      <div style={{position: 'absolute', left: 1210, top: 200, opacity: tracks}}>
        <div style={{position: 'relative'}}>
          {/* 守护环（确认绿外框——机制在位的守护语义层） */}
          <svg width={480} height={300} viewBox="0 0 480 300" style={{position: 'absolute', inset: -12, pointerEvents: 'none'}}>
            <rect x={-8} y={-8} width={496} height={316} rx={18} fill="none" stroke={theme.ok} strokeWidth={3.5} strokeDasharray="14 9" opacity={clamp01(tracks * 1.2 - 0.2) * 0.85} />
          </svg>
          <WallCard x={0} y={0} w={480} h={300} title="?" id="task_005" grayP={1} deps={[{id: 'task_999', ghostP: 1}]} depsP={1} />
          {/* 拦截红挡（在位——与守护环双层并列） */}
          <GateArm x={-150} y={128} w={170} dropP={1} bar="right" barP={1} />
          {/* 「保持待领」标签 */}
          <div style={{position: 'absolute', left: 330, top: -22, padding: '5px 18px', borderRadius: 9, border: `2.5px solid ${withAlpha(theme.dim, 0.9)}`, background: theme.panel, fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
            {'保持待领'}
          </div>
        </div>
        {/* 右轨日志条（实测值） */}
        <div style={{marginTop: 26, padding: '8px 24px', borderRadius: 9, border: `3px solid ${withAlpha(theme.ok, 0.8)}`, background: theme.panel, fontFamily: theme.mono, fontSize: 22, fontWeight: 700, color: theme.ok, whiteSpace: 'nowrap', opacity: clamp01(tracks * 1.5 - 0.4)}}>
          {'Blocked by: task_999'}
        </div>
      </div>
      {/* 中央概念对比签（两半先后点亮——词锚随口播两词窗） */}
      {cmp > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 96,
            display: 'flex',
            justifyContent: 'center',
            gap: 26,
            opacity: cmp,
            transform: `translateY(${(1 - cmp) * -14}px)`,
          }}
        >
          <span style={{padding: '8px 26px', borderRadius: 10, border: `2.5px solid ${l1 > 0.4 ? withAlpha(theme.text, 0.8) : withAlpha(theme.panelBorder, 0.8)}`, background: theme.panel, fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: l1 > 0.4 ? theme.text : theme.dim, whiteSpace: 'nowrap', opacity: 0.45 + 0.55 * l1}}>
            {'未完成＝活没干完'}
          </span>
          <span style={{fontFamily: theme.mono, fontSize: 23, color: theme.dim, alignSelf: 'center'}}>↔</span>
          <span style={{padding: '8px 26px', borderRadius: 10, border: `2.5px solid ${l2 > 0.4 ? withAlpha(theme.text, 0.8) : withAlpha(theme.panelBorder, 0.8)}`, background: theme.panel, fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: l2 > 0.4 ? theme.text : theme.dim, whiteSpace: 'nowrap', opacity: 0.45 + 0.55 * l2}}>
            {'不存在＝编号写错'}
          </span>
        </div>
      ) : null}
      {/* 金句短签（衬线体——挡住＝晚开工 · 放行＝错上加错；压缩签非整句） */}
      {quote > 0.02 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 660, display: 'flex', justifyContent: 'center', opacity: quote, transform: `translateY(${(1 - quote) * 18}px)`}}>
          <div
            style={{
              padding: '16px 52px',
              borderRadius: 12,
              border: `3px solid ${withAlpha(theme.ok, 0.75)}`,
              background: withAlpha(theme.panel, 0.97),
              fontFamily: theme.serif,
              fontSize: 40,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              letterSpacing: 2,
              boxShadow: quoteGlow > 0.03 ? `0 0 ${26 * quoteGlow}px ${withAlpha(theme.ok, 0.4)}` : 'none',
            }}
          >
            {'挡住＝晚开工 · 放行＝错上加错'}
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'E1 · 单变量消融'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-D 同卡之争：同编号分裂双签 + 金句卡 + 锁形剪影悬置 ───────────────────

const LockSilhouette: React.FC<{opacity: number; x: number; y: number}> = ({opacity, x, y}) => (
  <svg width={190} height={210} viewBox="0 0 190 210" style={{position: 'absolute', left: x, top: y, opacity, overflow: 'visible'}}>
    {/* 锁形剪影（与 4-B 实体锁同形——剪影不显内部结构/锁孔） */}
    <path d="M 45 92 L 45 58 A 50 50 0 0 1 145 58 L 145 92" fill="none" stroke={theme.dim} strokeWidth={13} strokeLinecap="round" />
    <rect x={26} y={90} width={138} height={94} rx={16} fill={withAlpha(theme.panel, 0.55)} stroke={theme.dim} strokeWidth={6} />
  </svg>
);

const ThreeD: React.FC<{atSplit: number; atSignA: number; atSignB: number; atClash: number; atQuote: number; atLock: number}> = ({atSplit, atSignA, atSignB, atClash, atQuote, atLock}) => {
  const frame = useCurrentFrame();
  // 一张卡复制成两张同款并列（同编号——同一张卡的语义）
  const split = clamp01(progress(frame, atSplit, 22));
  // 两个签名先后落（甲→乙——两人各抢一签）
  const sA = clamp01(progress(frame, atSignA, 14));
  const sB = clamp01(progress(frame, atSignB, 14));
  // 两签名冲突闪红一拍
  const clash = Math.sin(Math.PI * clamp01(progress(frame, atClash, 20)));
  // 金句卡（衬线体——唯一衬线体元素）
  const quote = clamp01(progress(frame, atQuote, DUR.f5));
  // 「一把锁」（G1 修订⑥词窗）锁形剪影一闪悬置（半透明、不落定）
  const lock = Math.sin(Math.PI * clamp01(progress(frame, atLock, 46))) * 0.55 + 0.2 * clamp01(progress(frame, atLock, 30));
  const cardY = 200;
  const cardW = 420;
  const cardH = 280;
  // 分裂位移：0 = 合体居中；1 = 两卡分开并列
  const gapX = split * 330;
  return (
    <AbsoluteFill>
      {/* 同卡分裂双签（左卡甲签 / 右卡乙签——同编号 task_004） */}
      {[
        {dx: -gapX, sign: sA, signer: '写手 · 甲'},
        {dx: gapX, sign: sB, signer: '写手 · 乙'},
      ].map((side, i) => (
        <WallCard
          key={`duel${i}`}
          x={960 - cardW / 2 + side.dx}
          y={cardY}
          w={cardW}
          h={cardH}
          title="发布"
          id="task_004"
          state="claimed"
          signP={side.sign}
          signer={side.signer}
          ghostP={clash * 0.3}
        />
      ))}
      {/* 冲突闪红（两签名重叠位——中缝闪电纹 + 双卡红边脉冲） */}
      {clash > 0.03 ? (
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <path d={`M 960 ${cardY + 40} L 944 ${cardY + 130} L 968 ${cardY + 140} L 950 ${cardY + 240}`} fill="none" stroke={theme.danger} strokeWidth={5} strokeLinecap="round" opacity={clash} />
          <rect x={960 - cardW / 2 - gapX - 5} y={cardY - 5} width={cardW + 10} height={cardH + 10} rx={14} fill="none" stroke={theme.danger} strokeWidth={3.5} opacity={clash * 0.8} />
          <rect x={960 - cardW / 2 + gapX - 5} y={cardY - 5} width={cardW + 10} height={cardH + 10} rx={14} fill="none" stroke={theme.danger} strokeWidth={3.5} opacity={clash * 0.8} />
        </svg>
      ) : null}
      {/* 金句卡（看见 ≠ 抢到——定格一拍；非逐字压缩签） */}
      {quote > 0.02 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 580, display: 'flex', justifyContent: 'center', opacity: quote, transform: `translateY(${(1 - quote) * 16}px)`}}>
          <div
            style={{
              padding: '14px 48px',
              borderRadius: 12,
              border: `3px solid ${withAlpha(theme.text, 0.7)}`,
              background: withAlpha(theme.panel, 0.97),
              fontFamily: theme.serif,
              fontSize: 42,
              fontWeight: 700,
              color: theme.text,
              letterSpacing: 3,
              whiteSpace: 'nowrap',
            }}
          >
            {'看见 ≠ 抢到'}
          </div>
        </div>
      ) : null}
      {/* 锁形剪影（两卡上方一闪而过、悬置——半透明不落定，P4 兑现钩） */}
      {lock > 0.03 ? <LockSilhouette opacity={Math.min(0.75, lock)} x={875} y={64} /> : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'同一张卡 · 两个认领'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-E 拉远收幕：教学版墙全貌入框 + 远处重墙轮廓渐显 ──────────────────────

const ThreeE: React.FC<{atPull: number; atHeavy: number}> = ({atPull, atHeavy}) => {
  const frame = useCurrentFrame();
  // @pushIn 负增量拉远（降压转场——自幽灵特写位的教学版全貌重锚）
  const pull = usePushIn(atPull, {scale: -0.05, dur: 40});
  // 教学版墙缩小入框（屏左——四绿卡 + 灰卡全貌）
  const frameIn = clamp01(progress(frame, 2, DUR.f5));
  // 远处重墙轮廓渐显（深灰体量、九槽位暗影——真实版预告意象）
  const heavy = clamp01(progress(frame, atHeavy, DUR.f6));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: pull, transformOrigin: '42% 40%'}}>
        {/* 教学版墙（缩小入框 0.62——全片同形收束；淡入 + 拉远动势） */}
        <div style={{position: 'absolute', left: 96, top: 210, transform: 'scale(0.62)', transformOrigin: '0 0', opacity: frameIn}}>
          <TaskWall litP={1} slotsP={1} glowP={0.25} />
          {GREEN_CARDS.map((cd) => (
            <WallCard key={cd.id} x={WALL_SLOTS[cd.slot].x} y={WALL_SLOTS[cd.slot].y} title={cd.title} id={cd.id} state="done" greenP={1} signP={1} signer={cd.signer} deps={cd.slot === 1 ? [{id: 'task_001', doneP: 1}, {id: 'task_002', doneP: 1}] : cd.slot === 2 ? [{id: 'task_003', doneP: 1}] : undefined} depsP={1} />
          ))}
          <WallCard x={WALL_SLOTS[5].x} y={WALL_SLOTS[5].y} title="?" id="task_005" grayP={1} deps={[{id: 'task_999', ghostP: 1}]} depsP={1} />
          <div style={{position: 'absolute', left: 0, top: WALL.h + 18, fontFamily: theme.mono, fontSize: 26, color: theme.dim, whiteSpace: 'nowrap'}}>{'教学版'}</div>
        </div>
        {/* 远处重墙轮廓（右远——渐显一拍；heavy 形态 = 描边加重 + 3×3 九槽暗影，
            轮廓剪影不显字段（P4 揭示）） */}
        <div style={{position: 'absolute', left: 1160, top: 470, transform: 'scale(0.56)', transformOrigin: '0 0', opacity: heavy * 0.55}}>
          <TaskWall litP={heavy} slotsP={heavy} glowP={heavy * 0.4} heavy />
        </div>
        {heavy > 0.05 ? (
          <div style={{position: 'absolute', left: 1214, top: 878, fontFamily: theme.mono, fontSize: 22, color: theme.dim, whiteSpace: 'nowrap', opacity: heavy}}>{'真实版 · 重得多'}</div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'教学版 → 真实版'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P3GhostCard: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p3-01', 'p3-02');
  const bB = w('p3-03', 'p3-04');
  const bC = w('p3-05', 'p3-07');
  const bD = w('p3-08', 'p3-09');
  const bE = w('p3-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ThreeA atZoom={wa('p3-01', 0.1) - bA.from} atHighlight={wa('p3-01', 0.56) - bA.from} atBar={wa('p3-02', 0.3) - bA.from} atPin={wa('p3-02', 0.68) - bA.from} />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ThreeB atFocus={wa('p3-03', 0.1) - bB.from} atRewrite={wa('p3-03', 0.55) - bB.from} atGrayOut={wa('p3-03', 0.66) - bB.from} atArrow={wa('p3-04', 0.12) - bB.from} atGhostSign={wa('p3-04', 0.5) - bB.from} />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ThreeC atTracks={wa('p3-05', 0.2) - bC.from} atCmp={wa('p3-05', 0.74) - bC.from} atL1={wa('p3-06', 0.26) - bC.from} atL2={wa('p3-06', 0.72) - bC.from} atQuote={wa('p3-07', 0.55) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="3-D">
        <ThreeD atSplit={wa('p3-08', 0.3) - bD.from} atSignA={wa('p3-08', 0.44) - bD.from} atSignB={wa('p3-08', 0.6) - bD.from} atClash={wa('p3-08', 0.74) - bD.from} atQuote={wa('p3-09', 0.1) - bD.from} atLock={wa('p3-09', 0.5) - bD.from} />
      </Sequence>
      <Sequence {...bE} name="3-E">
        <ThreeE atPull={0} atHeavy={wa('p3-10', 0.5) - bE.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3GhostCard;
