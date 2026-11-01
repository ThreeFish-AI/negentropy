/** P0 接工具的老办法（p0-01..p0-08，2 镜）——分镜 0-A / 0-B。
 *
 *  叙事链：0-A 系列片头交棒后冷启动直入（开篇视听合力 I-039）：画面深处一片
 *  工具星海（暗色小点阵背景层），近景一道窄门紧闭居中偏下，p0-01「接一个」
 *  词落位第一张接入申请单拍上窄门〔M-005〕、「重写一套」词落位弹回飘落（弹回
 *  即痛点的第一帧）→ p0-02「手写定义」词落位单上三行小签逐行亮出（定义→参数
 *  格式→调用代码——一整套的清单化）→ p0-03「再写一套」词落位第二张单拍上
 *  弹回、叠落第一张旁 → p0-04「跟着改」词落位已贴单作废翻灰、一枚「追改」
 *  小签补拍上门 → p0-05「养不起千千万」词落位 @pushIn 负增量（星海层整体前压
 *  一拍——门外浩瀚 vs 门内一扇的数量对比即痛点，重音镜）→ 0-B 窄门推近居中：
 *  p0-06「新路」词落位门楣标准徽记亮起〔M-005〕（兰紫描边圆形徽记）、
 *  「切成了两半」词落位门框中缝亮起分割线、门框自中缝向两侧展开成一条双向
 *  通道（两半的具象预告）→ p0-07「模型上下文协议」词落位徽记定格放大一拍、
 *  全称角标淡入（重音镜：标准登场 1–2s punch）→ p0-08「拆开看」词落位
 *  @pushIn 顺展开的通道推入（分镜 G1 修正：动机锚自句「今天拆开看」）、通道
 *  内灯火自近及远点亮、分工线在尽头显形（morph 起势——承接 1-A）。
 *
 *  空间契约（安全带实算）：0-A 门体底 430+310=740 / 申请单落位底 ≤ 740 /
 *  星海点阵 y ≤ 840；0-B 通道带底 660 / 徽记顶 388——全部 ≤ 860、装置
 *  y ≥ 388 ≥ 56。署源角标右下 bottom 176 恒定不抢焦。红线落实：星海为
 *  背景暗层不抢焦（dim 点阵、禁拟人化）、窄门+申请单为唯一前景主体、申请单
 *  弹回有轨迹、门 0-A 不开启（开在 0-B）、静止纯文字卡禁（每拍有状态推进）、
 *  英文全称只进角标不进大字（MCP 徽记三字母为契约允许例外）。词落位 =
 *  wa(id,f)。
 *
 *  承接登记：0-B→1-A morph（同一主体 = 展开的双向通道：门框两翼 + 中缝分割
 *  线；兰紫描边 + 中缝分工线两项身份线索保形；详见 P1TwoHalves 头注 morph 段）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {EmblemBadge} from '../components/motifs';
import {DUR, clamp01, progress} from '../motion';
import {ease} from '../components/motifs';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，豁免登记于工作区配置 vibe-video.toml）：右下常驻，
 *  一次淡入后恒定不抢焦；bottom 176 避开字幕条（承 ep1–ep18 形态） */
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

/** 确定性伪随机（星海点阵——帧驱动无随机数红线） */
const hash = (i: number): number => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** 工具星海（千千万件外部工具微光——背景暗层：dim 小点 + 微闪烁，不抢焦） */
const StarField: React.FC<{press: number; t: number}> = ({press, t}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      transform: `scale(${1 + 0.18 * press})`,
      transformOrigin: '960px 580px',
      opacity: 0.9,
    }}
  >
    {Array.from({length: 150}, (_, i) => {
      const x = 30 + hash(i) * 1860;
      const y = 90 + hash(i + 50) * 740;
      const r = 1.6 + hash(i + 100) * 2.6;
      const tw = 0.5 + 0.5 * Math.sin(t / (18 + hash(i + 150) * 26) + i);
      return (
        <span
          key={`st${i}`}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: r,
            height: r,
            borderRadius: '50%',
            background: theme.dim,
            opacity: (0.14 + 0.3 * tw) * (0.7 + 0.3 * press),
            boxShadow: press > 0.3 && hash(i + 200) > 0.86 ? `0 0 ${6 * press}px ${withAlpha(theme.dim, 0.5)}` : 'none',
          }}
        />
      );
    })}
  </div>
);

// ── 0-A 窄门冷启动：星海 + 窄门 + 三张接入申请单拍上弹回 ─────────────────────

/** 0-A 布局（安全带实算：门体 430+310=740 / 门楣 388..440 / 落单底 ≤ 760，恒 ≤ 860） */
const GATE_0A = {x: 830, y: 430, w: 260, h: 310} as const;
const LINTEL_0A = {x: 800, y: 388, w: 320, h: 52} as const;
/** 三张申请单待拍位（门侧左侧纵落；字样三行小签：定义/参数格式/调用代码） */
const SLIPS_0A = [
  {x: 450, y: 470},
  {x: 560, y: 620},
  {x: 660, y: 440},
] as const;
const SLIP_LINES = ['定义', '参数格式', '调用代码'] as const;

/** 申请单（纸片卡——拍上窄门 / 弹回飘落 / 作废翻灰三态） */
const Slip: React.FC<{
  x: number;
  y: number;
  litP: number;
  slapP: number;
  bounceP: number;
  grayP: number;
  linePs: readonly number[];
  chaseP: number;
}> = ({x, y, litP, slapP, bounceP, grayP, linePs, chaseP}) => {
  const lit = clamp01(litP);
  const slap = clamp01(slapP);
  const bounce = clamp01(bounceP);
  const gray = clamp01(grayP);
  const chase = clamp01(chaseP);
  // 拍上轨迹：自待拍位飞向门面（slap 0..1 → 门面吸附位）
  const tx = x + (GATE_0A.x + 30 - x) * slap;
  const ty = y + (GATE_0A.y + 90 - y) * slap;
  // 弹回轨迹：自门面弹开坠落到门脚（有轨迹红线）
  const bx = tx - 70 * bounce;
  const by = ty + (GATE_0A.h - 110) * bounce;
  const grayMix = gray;
  return (
    <div
      style={{
        position: 'absolute',
        left: bx,
        top: by,
        width: 168,
        height: 124,
        opacity: lit,
        transform: `rotate(${(slap - bounce) * 6 + bounce * 10}deg)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 8,
          border: `2.5px solid ${withAlpha(theme.dim, 0.55)}`,
          background: withAlpha(theme.panel, 0.97),
          filter: `grayscale(${grayMix})`,
          opacity: 1 - grayMix * 0.45,
          padding: '10px 14px',
        }}
      >
        {[0, 1, 2].map((r) => {
          const lp = clamp01(linePs[r] ?? 0);
          return (
            <div
              key={`sl${r}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 30,
                opacity: 0.25 + 0.75 * lp,
              }}
            >
              <span style={{width: 9, height: 9, borderRadius: '50%', border: `2px solid ${lp > 0.4 ? theme.dim : withAlpha(theme.dim, 0.4)}`, display: 'inline-block'}} />
              <span style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: lp > 0.4 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>
                {SLIP_LINES[r]}
              </span>
            </div>
          );
        })}
        {/* 「追改」小签（p0-04 补拍上门——服务一升级跟着改） */}
        {chase > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              right: -12,
              top: -18,
              padding: '3px 12px',
              borderRadius: 7,
              border: `2.5px solid ${withAlpha(theme.dim, 0.5 + 0.5 * chase)}`,
              background: withAlpha(theme.panel, 0.98),
              fontFamily: theme.sans,
              fontSize: 15,
              fontWeight: 700,
              color: theme.dim,
              whiteSpace: 'nowrap',
              transform: `rotate(-6deg) translateY(${(1 - chase) * -10}px)`,
              opacity: chase,
            }}
          >
            追改
          </div>
        ) : null}
      </div>
    </div>
  );
};

const ZeroA: React.FC<{
  atSlap1: number;
  atBounce1: number;
  atLines: number;
  atSlap2: number;
  atBounce2: number;
  atGray: number;
  atChase: number;
  atPress: number;
}> = ({atSlap1, atBounce1, atLines, atSlap2, atBounce2, atGray, atChase, atPress}) => {
  const frame = useCurrentFrame();
  // 星海整体前压（@pushIn 负增量——门外浩瀚压向窄门，重音镜）
  const press = ease(clamp01(progress(frame, atPress, 20)));
  // 单一：拍上 → 弹回（p0-01）
  const s1 = clamp01(progress(frame, atSlap1, 12));
  const b1 = clamp01(progress(frame, atBounce1, 18));
  // 单上三行小签逐行亮出（p0-02——一整套的清单化）
  const l1 = [0, 1, 2].map((r) => clamp01(progress(frame, atLines + r * 8, 9)));
  // 单二：拍上弹回落单旁（p0-03）
  const s2 = clamp01(progress(frame, atSlap2, 12));
  const b2 = clamp01(progress(frame, atBounce2, 18));
  // 已贴单作废翻灰 + 追改小签（p0-04）
  const gray = clamp01(progress(frame, atGray, 14));
  const chase = clamp01(progress(frame, atChase, 10));
  return (
    <AbsoluteFill>
      <StarField press={press} t={frame} />
      {/* 窄门（居中偏下——深灰描边、门楣空位；0-A 不开启） */}
      <div style={{position: 'absolute', left: GATE_0A.x - 26, top: GATE_0A.y - 26, width: GATE_0A.w + 52, height: GATE_0A.h + 52, borderRadius: 18, border: `5px solid ${withAlpha(theme.panelBorder, 0.98)}`, background: withAlpha(theme.panel, 0.9), boxShadow: `0 14px 40px ${withAlpha('#000000', 0.45)}`}}>
        {/* 门体（紧闭——两扇门板 + 门缝暗线） */}
        <div style={{position: 'absolute', left: 26, top: 26, width: GATE_0A.w, height: GATE_0A.h, borderRadius: '12px 12px 0 0', border: `4px solid ${withAlpha(theme.dim, 0.6)}`, background: withAlpha(theme.panel, 0.98), display: 'flex'}}>
          <div style={{flex: 1, borderRight: `3px solid ${withAlpha(theme.panelBorder, 0.9)}`}} />
          <div style={{flex: 1}} />
        </div>
        {/* 门楣（空位——dashed 槽，0-B 徽记位） */}
        <div style={{position: 'absolute', left: 0, top: -54, width: GATE_0A.w + 52, height: LINTEL_0A.h - 2, borderRadius: 10, border: `3px dashed ${withAlpha(theme.dim, 0.5)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.sans, fontSize: 16, color: withAlpha(theme.dim, 0.7), whiteSpace: 'nowrap'}}>
          标准徽记 · 待亮
        </div>
      </div>
      {/* 三张接入申请单（拍上 / 弹回 / 翻灰三态——第一二张实拍，第三张待拍位） */}
      <Slip x={SLIPS_0A[0].x} y={SLIPS_0A[0].y} litP={1} slapP={s1} bounceP={b1} grayP={gray} linePs={l1} chaseP={chase} />
      <Slip x={SLIPS_0A[1].x} y={SLIPS_0A[1].y} litP={0.4 + 0.6 * clamp01(progress(frame, atSlap2 - 30, 16))} slapP={s2} bounceP={b2} grayP={gray * 0.6} linePs={[0.3, 0.3, 0.3]} chaseP={0} />
      <Slip x={SLIPS_0A[2].x} y={SLIPS_0A[2].y} litP={0.35} slapP={0} bounceP={0} grayP={0} linePs={[0, 0, 0]} chaseP={0} />
      <SourceCredit lit={clamp01(progress(frame, 4, DUR.f5))} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'门外千千万 · 门内一扇 · 接一个，重写一套'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 窄门展开：徽记亮起 + 中缝分割 + 双向通道 + 顺通道推入 ──────────────────

/** 0-B 布局（安全带实算：门组 470..800 底 800 / 徽记 430..510 / 通道带
 *  545..675 底 675，恒 ≤ 860；推入 transform-origin 远端纵深处） */
const GATE_0B = {x: 850, y: 470, w: 220, h: 260} as const;
const CHANNEL_0B = {y: 545, h: 130} as const;

const ZeroB: React.FC<{atBadge: number; atSeam: number; atOpen: number; atPunch: number; atCaption: number; atPush: number}> = ({
  atBadge,
  atSeam,
  atOpen,
  atPunch,
  atCaption,
  atPush,
}) => {
  const frame = useCurrentFrame();
  // 徽记自门楣亮起（兰紫描边圆形徽记——「新路」）
  const badge = clamp01(progress(frame, atBadge, 12));
  // 中缝分割线亮起（「切成了两半」——分割线先亮）
  const seam = clamp01(progress(frame, atSeam, 10));
  // 门框自中缝向两侧展开成双向通道（open：门板外张 + 通道带显形）
  const open = ease(clamp01(progress(frame, atOpen, 22)));
  // 徽记定格放大一拍（重音镜：标准登场 punch）
  const punch = Math.sin(Math.PI * clamp01(progress(frame, atPunch, 22)));
  // 全称角标淡入
  const caption = clamp01(progress(frame, atCaption, 14));
  // 顺通道推入（@pushIn——灯火自近及远点亮、镜头沿通道推进；分工线尽头显形）
  const push = ease(clamp01(progress(frame, atPush, 30)));
  const wing = 130 * open; // 门板外张位移
  return (
    <AbsoluteFill>
      {/* 深处星海压暗（推入时退为纵深背景） */}
      <StarField press={0.5 + 0.5 * push} t={frame} />
      {/* 推入镜头组（transform-origin 通道远端——纵深推进感） */}
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1 + 0.22 * push})`, transformOrigin: '960px 610px'}}>
        {/* 双向通道（左右两股车道微光——兰紫渐进；两半的具象预告） */}
        <div
          style={{
            position: 'absolute',
            left: 120,
            right: 120,
            top: CHANNEL_0B.y - open * 0,
            height: CHANNEL_0B.h,
            opacity: open,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 20,
              border: `4px solid ${withAlpha(theme.svc, 0.4 + 0.4 * open)}`,
              background: `linear-gradient(90deg, ${withAlpha(theme.svc, 0.18)}, ${withAlpha(theme.svc, 0.05)})`,
              overflow: 'hidden',
            }}
          >
            {/* 双向车道（上下两股——行进方向相反的流光） */}
            <svg width={1680} height={CHANNEL_0B.h} viewBox={`0 0 1680 ${CHANNEL_0B.h}`} style={{position: 'absolute', inset: 0}}>
              <line x1={0} y1={CHANNEL_0B.h / 2} x2={1680} y2={CHANNEL_0B.h / 2} stroke={withAlpha(theme.svc, 0.75)} strokeWidth={3.5} strokeDasharray="16 14" strokeDashoffset={-frame * 0.9} opacity={open} />
              <line x1={0} y1={34} x2={1680} y2={34} stroke={withAlpha(theme.svc, 0.5)} strokeWidth={2.5} strokeDasharray="10 18" strokeDashoffset={frame * 0.7} opacity={open * 0.8} />
              <line x1={0} y1={CHANNEL_0B.h - 34} x2={1680} y2={CHANNEL_0B.h - 34} stroke={withAlpha(theme.svc, 0.5)} strokeWidth={2.5} strokeDasharray="10 18" strokeDashoffset={-frame * 0.7} opacity={open * 0.8} />
              {/* 通道内灯火（自近及远点亮——推入时逐盏亮起） */}
              {Array.from({length: 9}, (_, i) => {
                const lx = 120 + i * 180;
                const on = clamp01(progress(frame, atPush + i * 2, 8));
                return <circle key={`lp${i}`} cx={lx} cy={CHANNEL_0B.h / 2 - 46} r={6 + (i % 3) * 2} fill={theme.svc} opacity={(0.25 + 0.55 * on) * open} />;
              })}
            </svg>
          </div>
        </div>
        {/* 门框（两翼——自中缝向两侧展开；中缝分割线亮起） */}
        <div style={{position: 'absolute', left: 0, top: 0}}>
          {[-1, 1].map((side) => (
            <div
              key={`wing${side}`}
              style={{
                position: 'absolute',
                left: GATE_0B.x + GATE_0B.w / 2 + (side === -1 ? -GATE_0B.w / 2 : 0) + side * wing,
                top: GATE_0B.y,
                width: GATE_0B.w / 2,
                height: GATE_0B.h,
                borderRadius: side === -1 ? '14px 0 0 14px' : '0 14px 14px 0',
                border: `4.5px solid ${withAlpha(theme.panelBorder, 0.98)}`,
                background: withAlpha(theme.panel, 0.95),
                transform: `rotate(${side * open * 8}deg)`,
                transformOrigin: side === -1 ? '100% 50%' : '0% 50%',
              }}
            >
              <div style={{position: 'absolute', inset: 12, borderRadius: 8, border: `2.5px dashed ${withAlpha(theme.dim, 0.35)}`, opacity: 1 - open * 0.5}} />
            </div>
          ))}
          {/* 中缝分割线（两半之界——亮起后常驻，morph 身份线索之一） */}
          <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
            <line
              x1={960}
              y1={GATE_0B.y - 46}
              x2={960}
              y2={GATE_0B.y + GATE_0B.h + 30}
              stroke={theme.svc}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray="12 9"
              opacity={0.3 + 0.7 * seam}
            />
          </svg>
        </div>
        {/* 标准徽记（门楣位——亮起 + 定格放大一拍；全称只进角标） */}
        <div
          style={{
            position: 'absolute',
            left: 898,
            top: 428 - open * 0,
            transform: `scale(${1 + 0.16 * punch})`,
            transformOrigin: '50% 50%',
          }}
        >
          <EmblemBadge x={0} y={0} size={124} litP={badge} captionP={caption} />
        </div>
        {/* 分工线雏形（通道尽头暗态——P1 承接位，推入时显形） */}
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <line
            x1={1560}
            y1={CHANNEL_0B.y - 70}
            x2={1560}
            y2={CHANNEL_0B.y + CHANNEL_0B.h + 70}
            stroke={theme.dim}
            strokeWidth={4}
            strokeDasharray="10 10"
            opacity={push * 0.55}
          />
        </svg>
      </div>
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'MCP · Model Context Protocol'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0NarrowGate: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-05');
  const bB = w('p0-06', 'p0-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A">
        <ZeroA
          atSlap1={wa('p0-01', 0.7) - bA.from}
          atBounce1={wa('p0-01', 0.86) - bA.from}
          atLines={wa('p0-02', 0.3) - bA.from}
          atSlap2={wa('p0-03', 0.62) - bA.from}
          atBounce2={wa('p0-03', 0.78) - bA.from}
          atGray={wa('p0-04', 0.6) - bA.from}
          atChase={wa('p0-04', 0.75) - bA.from}
          atPress={wa('p0-05', 0.66) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atBadge={wa('p0-06', 0.26) - bB.from}
          atSeam={wa('p0-06', 0.68) - bB.from}
          atOpen={wa('p0-06', 0.78) - bB.from}
          atPunch={wa('p0-07', 0.45) - bB.from}
          atCaption={wa('p0-07', 0.6) - bB.from}
          atPush={wa('p0-08', 0.8) - bB.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0NarrowGate;
