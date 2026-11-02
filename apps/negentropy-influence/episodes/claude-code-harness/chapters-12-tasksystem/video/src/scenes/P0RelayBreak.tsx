/** P0 嘴上的接力棒（p0-01..p0-08，3 镜）——分镜 0-A / 0-B / 0-C。
 *
 *  叙事链：0-A 冷启动（开篇视听合力 I-039）：大目标叮嘱链气泡逐条落下层叠
 *  （字据小签先写初稿/再配图/然后排版/最后发布——与 P2 走查同构输入值）→
 *  p0-01「一堵墙」词落位深处墙体剪影透出一线紫边微光（只亮轮廓线一角，
 *  悬念不兑现）〔M-005〕→ p0-02「一句没接住」词落位中段一枚气泡脱链坠出、
 *  飘散成灰 → p0-03「换个会话就没了」词落位整列气泡如烟蒸发只余空列一拍 →
 *  0-B 内存清单卡批判：会话窗内清单卡（卡面一行待办「初稿还没交」）→ 两枚
 *  灰色问号（依赖？/归属？）先后弹出钉上卡面 →「排版」活小签想启动被拦无
 *  应答 → p0-06「要的是落盘」词落位窗口关闭、清单随烟蒸发、远处微光一闪 →
 *  0-C 砌墙宣告：规格三签（任务落盘 · 重启不丢 · 先后挡在认领前）钉入（服务
 *  完本拍即撤）＋空任务墙首亮（墙体网格 + 槽位阵列 + 边框微光——主装置首帧，
 *  0-A 一线微光兑现为墙体轮廓）＋四枚半透明卡影 stagger 飞入挂槽（预演态）
 *  ＋「人人可认领」小签贴墙 → p0-08「一块砖」词落位镜头推向 slot0 卡槽位
 *  定格（P1 接棒位）。
 *
 *  空间契约：0-A 对话流单柱居中、脱链气泡有坠落飘散轨迹、署源角标右下恒定
 *    不抢焦、墙在本镜不显形（只亮一线微光）；0-B 清单卡为唯一主体、问号为
 *    唯一灰色新增元素、窗口关闭有蒸发轨迹、远处微光不显形为实体；0-C 规格签
 *    为关键词签非整句、墙仅亮轮廓与空槽（挂实体卡留给 P1）、钉入与飞入次序
 *    =口播次序、本幕零环体。
 *
 *  红线落实：词落位 = wa(id,f)（manifest 已就位——54 句 267.3s、2026-11-01 实测；
 *    ⑧ 轮 manifest 中途就位，已按句内字位复核一轮：词锚=字位比例、全部动画窗
 *    余量盘点通过、无需微调；词级 silencedetect 实测复核留 ⑨ 轮 QA，超前 >0.3s
 *    即调）；y≥56 / bottom≥176；TodoWrite / .tasks/ 只进角标；卡面文字
 *    不成句复述口播；0-B 末帧清单蒸发屏位 = 0-C 首帧规格签钉入屏位（层间
 *    替换语义的 eye-trace 呼应，不 morph——承 ep2 0-C→1-A 判例）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {SLOT_H, SLOT_W, WALL, WALL_SLOTS, WallCard} from '../components/motifs';
import {TaskWall} from '../components/motifs';
import {SpecPin} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，RSI I-080 豁免登记）：右下常驻，一次淡入后恒定不抢焦；
 *  bottom 168 避开字幕条（承 ep1–ep11 SourceCredit 形态） */
const SourceCredit: React.FC<{lit?: number}> = ({lit = 1}) => (
  <div
    style={{
      position: 'absolute',
      right: 72,
      bottom: 168,
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

// ── 0-A 冷启动：叮嘱链气泡逐条落下 → 脱链坠出 → 如烟蒸发 ──────────────────

/** 对话流单柱（x 730..1190 居中）；叮嘱小签与 P2 走查同构（内容工厂四步 + 检查） */
const CHAT = {x: 730, w: 460, y0: 168, bh: 66, gap: 22} as const;
const CHAT_ITEMS = ['先写初稿', '再配图', '然后排版', '最后发布', '检查一遍'] as const;

const ZeroA: React.FC<{
  atDrop: number;
  atGlow: number;
  atBreak: number;
  atEvaporate: number;
}> = ({atDrop, atGlow, atBreak, atEvaporate}) => {
  const frame = useCurrentFrame();
  // 气泡逐条落下层叠（列顶往下传——大目标的叮嘱链）
  const drops = CHAT_ITEMS.map((_, i) => clamp01(progress(frame, atDrop + i * 9, DUR.f4)));
  // p0-02「一句没接住」：中段（第三枚）气泡脱链坠出、飘散成灰
  const broke = clamp01(progress(frame, atBreak, 34));
  const breakIdx = 2;
  // p0-03「换个会话就没了」：整列如烟蒸发只余空列一拍
  const evap = clamp01(progress(frame, atEvaporate, 30));
  // 深处墙体剪影的一线紫边微光（悬念不兑现——只亮右上边角一段轮廓线）
  const glow = clamp01(progress(frame, atGlow, DUR.f5));
  return (
    <AbsoluteFill>
      {/* 大目标源头签（列顶——叮嘱的出发点） */}
      <div
        style={{
          position: 'absolute',
          left: CHAT.x + CHAT.w / 2 - 74,
          top: 96,
          width: 148,
          padding: '6px 0',
          borderRadius: 9,
          border: `2.5px solid ${withAlpha(theme.core, 0.8)}`,
          background: theme.panel,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 20,
          fontWeight: 700,
          color: theme.core,
          whiteSpace: 'nowrap',
          opacity: clamp01(progress(frame, atDrop - 6, DUR.f4)),
        }}
      >
        大目标
      </div>
      {/* 叮嘱气泡列（逐条落下层叠） */}
      {CHAT_ITEMS.map((t, i) => {
        const p = drops[i];
        const isBroke = i === breakIdx;
        // 脱链坠出：抛物线坠向右下 + 灰化飘散
        const bx = isBroke ? Math.sin(Math.PI * broke) * 150 + broke * 260 : 0;
        const by = isBroke ? broke * broke * 260 : 0;
        const grayOut = isBroke ? clamp01(progress(frame, atBreak + 14, DUR.f4)) : 0;
        // 蒸发：上飘 + 淡出（如烟）
        const evY = evap * -34 - (i % 2) * 8;
        return (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: CHAT.x + bx,
              top: CHAT.y0 + i * (CHAT.bh + CHAT.gap) - (1 - p) * 40 + by + evY,
              width: CHAT.w,
              height: CHAT.bh,
              borderRadius: 12,
              border: `2.5px solid ${grayOut > 0.4 ? withAlpha(theme.dim, 0.5) : withAlpha(theme.panelBorder, 0.95)}`,
              background: withAlpha(theme.panel, grayOut > 0.4 ? 0.4 : 0.92),
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '0 20px',
              opacity: p * (isBroke ? 1 - 0.75 * grayOut : 1) * (1 - evap),
            }}
          >
            <span style={{width: 12, height: 12, borderRadius: 3, background: grayOut > 0.4 ? withAlpha(theme.dim, 0.4) : withAlpha(theme.core, 0.55), flexShrink: 0}} />
            <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: grayOut > 0.4 ? theme.dim : theme.text, whiteSpace: 'nowrap'}}>{t}</span>
            <span style={{flex: 1}} />
            <span style={{fontFamily: theme.mono, fontSize: 14, color: withAlpha(theme.dim, 0.6), whiteSpace: 'nowrap'}}>{`m${i + 1}`}</span>
          </div>
        );
      })}
      {/* 空列残框（蒸发后只余一拍——列曾在的证据） */}
      {evap > 0.5 ? (
        <div
          style={{
            position: 'absolute',
            left: CHAT.x - 10,
            top: CHAT.y0 - 10,
            width: CHAT.w + 20,
            height: CHAT_ITEMS.length * (CHAT.bh + CHAT.gap),
            borderRadius: 14,
            border: `2px dashed ${withAlpha(theme.dim, 0.4)}`,
            opacity: clamp01(evap) * 0.8,
          }}
        />
      ) : null}
      {/* 深处墙体剪影：一线紫边微光（0-C 兑现前的悬念态——暗轮廓 + 右上边角
          一段 mech 微光线，不显形整墙） */}
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <rect
          x={WALL.x}
          y={WALL.y}
          width={WALL.w}
          height={WALL.h}
          rx={16}
          fill="none"
          stroke={withAlpha(theme.mech, 0.05 + 0.04 * glow)}
          strokeWidth={2}
        />
        <line x1={WALL.x + WALL.w - 320} y1={WALL.y} x2={WALL.x + WALL.w - 40} y2={WALL.y} stroke={theme.mech} strokeWidth={2.6} opacity={0.5 * glow} />
        <line x1={WALL.x + WALL.w} y1={WALL.y + 20} x2={WALL.x + WALL.w} y2={WALL.y + 150} stroke={theme.mech} strokeWidth={2.6} opacity={0.4 * glow} />
      </svg>
      <SourceCredit lit={clamp01(progress(frame, 4, DUR.f5))} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'对话内存 · 会话即焚'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 清单卡批判：会话窗 + 问号钉上 + 活小签被拦 + 蒸发 ──────────────────

const WIN = {x: 560, y: 170, w: 800, h: 480} as const;
const LISTCARD = {x: 760, y: 296, w: 400, h: 200} as const;

const ZeroB: React.FC<{atQ1: number; atQ2: number; atTry: number; atBlocked: number; atClose: number; atFar: number}> = ({atQ1, atQ2, atTry, atBlocked, atClose, atFar}) => {
  const frame = useCurrentFrame();
  // 两枚灰色问号先后弹出钉上卡面（依赖？/归属？——无解是本幕前提）
  const q1 = clamp01(progress(frame, atQ1, DUR.f4));
  const q2 = clamp01(progress(frame, atQ2, DUR.f4));
  // 「排版」活小签想启动 → 被两枚问号拦在卡前无应答
  const tryIn = clamp01(progress(frame, atTry, 26));
  const blocked = clamp01(progress(frame, atBlocked, DUR.f4));
  const blockPulse = Math.sin(Math.PI * clamp01(progress(frame, atBlocked, 16)));
  // 窗口关闭：清单随烟蒸发（碎成灰烬粒上飘）；远处微光一闪
  const close = clamp01(progress(frame, atClose, 30));
  const far = Math.sin(Math.PI * clamp01(progress(frame, atFar, 24)));
  // 灰烬粒子（10 枚确定性上飘）
  const ashAt = atClose + 6;
  return (
    <AbsoluteFill>
      {/* 会话窗口（清单的宿主——窗口一关、清单就没） */}
      <div
        style={{
          position: 'absolute',
          left: WIN.x,
          top: WIN.y + close * 14,
          width: WIN.w,
          height: WIN.h,
          borderRadius: 14,
          border: `3px solid ${withAlpha(theme.tool, 0.55)}`,
          background: withAlpha(theme.panel, 0.55),
          opacity: 1 - 0.25 * close,
        }}
      >
        {/* 窗口标题栏（三点 + 会话名——工况件） */}
        <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: `2px solid ${withAlpha(theme.panelBorder, 0.8)}`}}>
          {[0, 1, 2].map((d) => (
            <span key={`dot${d}`} style={{width: 11, height: 11, borderRadius: '50%', background: withAlpha(theme.dim, 0.5)}} />
          ))}
          <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginLeft: 8, whiteSpace: 'nowrap'}}>{'会话'}</span>
        </div>
      </div>
      {/* 内存清单卡（唯一主体——卡面一行待办） */}
      <div
        style={{
          position: 'absolute',
          left: LISTCARD.x,
          top: LISTCARD.y,
          width: LISTCARD.w,
          height: LISTCARD.h,
          borderRadius: 12,
          border: `3px solid ${withAlpha(theme.dim, 0.85)}`,
          background: withAlpha(theme.panel, 0.97),
          opacity: 1 - close,
        }}
      >
        <div style={{padding: '18px 24px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, letterSpacing: 2, whiteSpace: 'nowrap'}}>{'清单'}</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 16}}>
            <span style={{width: 15, height: 15, borderRadius: 4, border: `2.5px solid ${theme.dim}`, flexShrink: 0}} />
            <span style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>{'初稿还没交'}</span>
          </div>
          {/* 依赖/归属两枚灰色问号弹出钉上卡面（先后——词锚随口播） */}
          {[
            {t: '依赖？', p: q1, x: 24},
            {t: '归属？', p: q2, x: 232},
          ].map((q) =>
            q.p > 0.02 ? (
              <div
                key={q.t}
                style={{
                  position: 'absolute',
                  left: q.x,
                  top: -34 - (q.p > 0.5 ? blockPulse * 6 : 0),
                  padding: '6px 18px',
                  borderRadius: 9,
                  border: `2.5px solid ${withAlpha(theme.dim, 0.9)}`,
                  background: theme.panel,
                  fontFamily: theme.serif,
                  fontSize: 23,
                  fontWeight: 700,
                  color: theme.dim,
                  whiteSpace: 'nowrap',
                  opacity: q.p,
                  transform: `translateY(${(1 - q.p) * -20}px) rotate(${(q.p > 0.5 ? blockPulse : 0) * (q.t === '依赖？' ? -2.4 : 2.4)}deg)`,
                  boxShadow: q.p > 0.6 ? `0 0 ${10 + 8 * blockPulse}px ${withAlpha(theme.dim, 0.4)}` : 'none',
                }}
              >
                {q.t}
              </div>
            ) : null,
          )}
        </div>
      </div>
      {/* 「排版」活小签（想启动——自下而上奔向卡面，被拦停在卡前） */}
      {tryIn > 0.02 && close < 0.4 ? (
        <div
          style={{
            position: 'absolute',
            left: 920,
            top: 556 - tryIn * 44,
            padding: '6px 20px',
            borderRadius: 9,
            border: `2.5px solid ${blocked > 0.4 ? withAlpha(theme.dim, 0.6) : withAlpha(theme.mech, 0.75)}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 20,
            fontWeight: 700,
            color: blocked > 0.4 ? theme.dim : theme.mech,
            whiteSpace: 'nowrap',
            opacity: tryIn * (1 - close),
          }}
        >
          {'排版'}
          {/* 应答气泡（空——没人答得上） */}
          <span style={{position: 'absolute', right: -34, top: 6, fontFamily: theme.serif, fontSize: 20, color: withAlpha(theme.dim, 0.75), opacity: blocked}}>？</span>
        </div>
      ) : null}
      {/* 灰烬粒子（清单随烟蒸发——10 枚确定性上飘，禁随机） */}
      {close > 0.1
        ? Array.from({length: 10}, (_, i) => {
            const ashP = clamp01(progress(frame, ashAt + i * 1.6, 26));
            const ax = LISTCARD.x + 40 + ((i * 83) % 320);
            const ay = LISTCARD.y + 60 + ((i * 47) % 140) - ashP * 190;
            return (
              <span
                key={`ash${i}`}
                style={{
                  position: 'absolute',
                  left: ax,
                  top: ay,
                  width: 9,
                  height: 6,
                  borderRadius: 2,
                  background: withAlpha(theme.dim, 0.55 * (1 - ashP)),
                  transform: `rotate(${i * 41 + ashP * 60}deg)`,
                }}
              />
            );
          })
        : null}
      {/* 蒸发残迹收束 + 远处微光一闪（诉求可视，不显形新主体——指向画外远处） */}
      {far > 0.03 ? (
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <line x1={1720} y1={262} x2={1836} y2={240} stroke={theme.mech} strokeWidth={3} strokeLinecap="round" opacity={far * 0.85} />
          <circle cx={1836} cy={240} r={7 + 8 * far} fill={theme.mech} opacity={far * 0.6} />
        </svg>
      ) : null}
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'TodoWrite · 记内存'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-C 砌墙宣告：规格签钉入 + 空墙首亮 + 卡影预演挂槽 + 推向卡槽 ───────────

const ZeroC: React.FC<{atWall: number; atPins: number; atFly: number; atClaim: number; atOut: number; atPush: number}> = ({atWall, atPins, atFly, atClaim, atOut, atPush}) => {
  const frame = useCurrentFrame();
  // 空墙首亮小推近（@pushIn 幕内真调用——主装置亮起的镜头语言，与镜尾大急推
  //  分层：小推近作用在墙亮起拍、大急推是显式 zoom 的槽位特写）
  const wallPush = usePushIn(atWall, {scale: 0.04, dur: DUR.f6});
  // 空墙亮起（轮廓描边显形 → 槽位阵列 → 边框微光）
  const wallLit = clamp01(progress(frame, atWall, 20));
  const slots = clamp01(progress(frame, atWall + 10, 26));
  const glowP = clamp01(progress(frame, atWall + 18, DUR.f5));
  // 规格三签随墙亮起同拍逐枚钉入（服务完本拍即撤——墙接管叙事）
  const pins = clamp01(progress(frame, atPins, DUR.f4)) * 3;
  const pinOut = clamp01(progress(frame, atOut, DUR.f4));
  // 四枚卡影 stagger 飞入挂槽（半透明预演态——次序=口播：初稿/配图/排版/发布）
  const flyOrder = [0, 3, 1, 2];
  const TITLE_BY_SLOT = ['写初稿', '排版', '发布', '配图', '', '']; // ⑨ QA W1：slot1 补「排版」——与 1-A SHADOW_TITLES 及口播次序对齐
  const flys = flyOrder.map((s, i) => clamp01(progress(frame, atFly + i * 6, 20)));
  // 「人人可认领」小签贴墙
  const claim = clamp01(progress(frame, atClaim, DUR.f4));
  // 镜尾推向 slot0 卡槽位（P1 接棒位）——zoom 公式：o=槽心固定映向 c、z 随 p
  const pushP = clamp01(progress(frame, atPush, 30));
  const o = {x: WALL_SLOTS[0].x + SLOT_W / 2, y: WALL_SLOTS[0].y + SLOT_H / 2};
  // ⑨ QA W2：c.y 520→470 + z 1.75→1.6（组合）——单改任一项按实测 y932-1000 逆推
  //   仍侵 920 字幕安全带 ~30px；组合后 slot3「配图」标题带 ≈846..908，净空 ≥11px
  const c = {x: 820, y: 470};
  const z = 1 + (1.6 - 1) * pushP;
  const zoomTf = `translate(${(c.x - o.x) * pushP}px, ${(c.y - o.y) * pushP}px) scale(${z})`;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: wallPush, transformOrigin: '50% 44%'}}>
        <div style={{position: 'absolute', inset: 0, transform: zoomTf, transformOrigin: `${o.x}px ${o.y}px`}}>
        {/* 空任务墙首亮（主装置首帧——0-A 一线微光兑现为墙体轮廓） */}
        <TaskWall litP={wallLit} slotsP={slots} glowP={glowP} />
        {/* 四枚卡影（半透明预演态挂槽——不显字段细节，留给 1-A） */}
        {flyOrder.map((s, i) => (
          <WallCard
            key={`ghost${s}`}
            x={WALL_SLOTS[s].x}
            y={WALL_SLOTS[s].y - (1 - flys[i]) * 130}
            title={TITLE_BY_SLOT[s]}
            id={`task_00${s === 0 ? 1 : s === 3 ? 2 : s === 1 ? 3 : 4}`}
            litP={flys[i]}
            solidP={0.35}
          />
        ))}
        {/* 「人人可认领」小签（贴墙右上） */}
        {claim > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: WALL.x + WALL.w - 218,
              top: WALL.y - 18,
              padding: '6px 20px',
              borderRadius: 9,
              border: `2.5px solid ${withAlpha(theme.mech, 0.85)}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 19,
              fontWeight: 700,
              color: theme.mech,
              whiteSpace: 'nowrap',
              opacity: claim,
              transform: `translateY(${(1 - claim) * -12}px)`,
            }}
          >
            {'人人可认领'}
          </div>
        ) : null}
        </div>
      </div>
      {/* 规格三签（钉入 → 服务完本拍即撤；屏位居中——0-B 末帧蒸发屏位的呼应） */}
      <SpecPin pins={['任务落盘', '重启不丢', '先后挡在认领前']} pinP={pins} outP={pinOut} y={196} />
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'.tasks/ · JSON'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0RelayBreak: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-06');
  const bC = w('p0-07', 'p0-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A">
        <ZeroA
          atDrop={4}
          atGlow={wa('p0-01', 0.12) - bA.from}
          atBreak={wa('p0-02', 0.48) - bA.from}
          atEvaporate={wa('p0-03', 0.6) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atQ1={wa('p0-04', 0.14) - bB.from}
          atQ2={wa('p0-04', 0.58) - bB.from}
          atTry={wa('p0-05', 0.5) - bB.from}
          atBlocked={wa('p0-05', 0.72) - bB.from}
          atClose={wa('p0-06', 0.16) - bB.from}
          atFar={wa('p0-06', 0.42) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atWall={wa('p0-07', 0.04) - bC.from}
          atPins={wa('p0-07', 0.1) - bC.from}
          atFly={wa('p0-07', 0.42) - bC.from}
          atClaim={wa('p0-07', 0.72) - bC.from}
          atOut={wa('p0-08', 0.06) - bC.from}
          atPush={wa('p0-08', 0.16) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0RelayBreak;
