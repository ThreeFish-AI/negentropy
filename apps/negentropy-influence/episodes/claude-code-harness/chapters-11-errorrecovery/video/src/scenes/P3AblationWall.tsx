/** P3 拆掉分类（p3-01..p3-10，4 镜）——分镜 3-A / 3-B / 3-C / 3-D。
 *
 *  叙事链：3-A 破坏实验面板：分类表（三行全亮态承 2-C）被抽取夹具夹住表脊 →
 *  p3-01「拆掉分类」表变灰卷起被整卷抽走离场（全片最大状态事件——抽走有卷起
 *  轨迹）、「一刀切」「统统当成瞬态」四类错误箭头汇入「原样重发」单行道齐挤
 *  闸口 → p3-02 超大超限错误块（承 1-C 溢出窗口同款放大）压上单行道入口 +
 *  @pushIn 推向 3-B 对峙 → 3-B 左红右绿消融同屏（全片张力峰值）：左轨一刀切
 *  重试——请求块节拍器式撞墙弹回、计数逐拍跳至 10/10、十枚撞痕叠满墙面、
 *  175.6s 计时条动态烧尽变灰（全片唯一大 punch）、结局签 ok=False ↔ 右轨分类
 *  路径——压缩一次瞬时回绿、0.0s 恢复钟定格、ok=True，左右计时条同屏对峙
 *  定格 → 3-C 归因三道具：①超大超限块撞固定窗口框卡住（容量错误）②重发箭头
 *  绕圈自转（块体尺寸刻度恒定）+ 每绕一圈时间沙漏烧落一格（圈=时间的因果
 *  绑定）③先减规模（复用压缩收叠同款动效）再重试——减容后同框一次装入通行
 *  → 3-D 教训收束：分类表残影虚线回魂一拍（被点名不复活）、单行道退场、
 *  环体自灰态回半亮、大问号签悬置 → p3-10 @pushIn 负增量拉远交棒 P4。
 *
 *  空间契约：表抽走有卷起轨迹（非瞬间消失）、单行道为唯一警示红通路、四类
 *    箭头并道前可见分路痕迹；红左绿右恒定、左轨计时条带 standalone 工况角标、
 *    两轨结局签同款异值、撞墙有弹回轨迹；绕圈轨道与沙漏烧落帧帧绑定、窗口框
 *    尺寸全镜恒定；残影为虚线非实亮、问号签无整句文字。173.7（selftest 口径）
 *    禁入画面。
 *
 *  红线落实：词落位 = wa(id,f)（manifest 已就位；⑧ 轮已按句内字位复核一轮微调，词级实测复核留 ⑨ 轮 QA）；
 *    y≥56 / bottom≥176；--experiment 5 · MAX_RETRIES=10 · idle 175.6s
 *    （standalone 口径）只进角标。
 *
 *  幕间转场（2-C→3-A，storyboard 登记）：语义断裂走 SceneFade（Main 层）＋
 *  全景重锚不 morph；分类表跨幕存活（三行全亮承 2-C）、环体缩悬转灰态——
 *  幕界前后帧共同元素 = 表＋环体。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, MessageStack, RoutingTable} from '../components/motifs';
import {DUR, clamp01, progress, useCount, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 环体缩悬灰态位（承 2-C 顶角位——消融期灰态；3-D 回半亮） */
const RING_G = {x: 84, y: 76, size: 140} as const;

// ── 3-A 破坏实验面板：表抽走 + 并道 + 超大块压上入口 ──────────────────────

const TABLE_3A = {x: 660, y: 170, w: 600, h: 300} as const;
const LANE_3A = {x: 240, y: 596, w: 1420, h: 64} as const;

const ThreeA: React.FC<{atGray: number; atRoll: number; atLane: number; atMerge: number; atBig: number; atPress: number; atPush: number}> = ({atGray, atRoll, atLane, atMerge, atBig, atPress, atPush}) => {
  const frame = useCurrentFrame();
  const gray = clamp01(progress(frame, atGray, DUR.f4));
  const roll = clamp01(progress(frame, atRoll, 44));
  // 单行道显形（警示红——唯一通路）
  const lane = clamp01(progress(frame, atLane, DUR.f5));
  // 四类错误箭头汇入单行道（并道前可见分路痕迹）
  const merge = clamp01(progress(frame, atMerge, 40));
  // 超大超限错误块悬入 + 压上入口（句尾压点）
  const big = clamp01(progress(frame, atBig, DUR.f5));
  const press = clamp01(progress(frame, atPress, DUR.f5));
  const push = usePushIn(atPush, {scale: 0.055, dur: 44});
  const arrowKinds = ['截断', '超限', '限流', '过载'];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '38% 66%'}}>
        {/* 环体缩悬灰态（消融期——非焦点） */}
        <div style={{position: 'absolute', left: RING_G.x, top: RING_G.y, opacity: 0.32}}>
          <LoopRing size={RING_G.size} nodes={[]} showExit={false} />
        </div>
        {/* 实验签（拆掉分类——面板右上） */}
        <div
          style={{
            position: 'absolute',
            left: 1470,
            top: 110,
            padding: '7px 22px',
            borderRadius: 10,
            border: `3px solid ${withAlpha(theme.danger, 0.85)}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 21,
            fontWeight: 700,
            color: theme.danger,
            whiteSpace: 'nowrap',
            opacity: clamp01(progress(frame, atGray, 6)),
          }}
        >
          {'拆掉分类'}
        </div>
        {/* 抽取夹具（抽象夹爪——夹住表脊；表抽走时随表上移） */}
        <svg width={220} height={64} viewBox="0 0 220 64" style={{position: 'absolute', left: TABLE_3A.x + TABLE_3A.w / 2 - 110, top: TABLE_3A.y - 58 - 64 * roll, overflow: 'visible', opacity: clamp01(progress(frame, atGray, 6))}}>
          <path d="M 20 56 L 20 20 L 60 44 M 200 56 L 200 20 L 160 44 M 20 56 L 200 56" fill="none" stroke={theme.dim} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          <line x1={84} y1={56} x2={136} y2={56} stroke={theme.danger} strokeWidth={6} strokeLinecap="round" />
        </svg>
        {/* 分类表（三行全亮 → 变灰 → 卷起抽走——全片最大状态事件） */}
        <RoutingTable x={TABLE_3A.x} y={TABLE_3A.y} w={TABLE_3A.w} h={TABLE_3A.h} litP={1} rowsLit={3} grayP={gray} rollP={roll} />
        {/* 「原样重发」单行道（警示红）+ 重试闸口 */}
        {lane > 0.02 ? (
          <div style={{position: 'absolute', left: LANE_3A.x, top: LANE_3A.y, width: LANE_3A.w, height: LANE_3A.h, opacity: lane}}>
            <div style={{position: 'absolute', inset: 0, borderRadius: 12, border: `3.5px solid ${withAlpha(theme.danger, 0.8)}`, background: withAlpha(theme.danger, 0.07)}} />
            <div style={{position: 'absolute', left: 26, top: 18, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap'}}>{'原样重发'}</div>
            {/* 重试闸口（单行道终点——四箭头齐挤处） */}
            <div style={{position: 'absolute', right: -8, top: -22, width: 26, height: LANE_3A.h + 44, borderRadius: 8, background: withAlpha(theme.danger, 0.24), border: `3px solid ${withAlpha(theme.danger, 0.9)}`}} />
          </div>
        ) : null}
        {/* 四类错误箭头（分四路 → 齐挤同一闸口——并道前可见分路痕迹） */}
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          {arrowKinds.map((k, i) => {
            const p = clamp01(merge * 1.5 - i * 0.12);
            if (p <= 0.02) return null;
            const startX = 330 + i * 130;
            const startY = 420 - i * 6;
            const endX = LANE_3A.x + 120 + i * 40 * (1 - merge);
            const endY = LANE_3A.y - 8;
            const cx = (startX + endX) / 2 + (i - 1.5) * 90 * (1 - merge);
            const cy = (startY + endY) / 2 - 40;
            return (
              <g key={`ar${i}`} opacity={p}>
                <path d={`M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`} fill="none" stroke={withAlpha(theme.danger, 0.7)} strokeWidth={3} strokeDasharray="7 6" />
                <circle cx={endX} cy={endY} r={5} fill={theme.danger} />
                <text x={startX - 16} y={startY - 14} fontFamily={theme.sans} fontSize={16} fontWeight={700} fill={theme.dim}>
                  {k}
                </text>
              </g>
            );
          })}
        </svg>
        {/* 超大超限错误块（承 1-C 溢出窗口同款放大——悬入 + 压上入口） */}
        {big > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: 190,
              top: 340 - 60 * big + 90 * press,
              width: 340,
              height: 200,
              borderRadius: 14,
              border: `4px solid ${withAlpha(theme.danger, 0.9)}`,
              background: withAlpha(theme.panel, 0.95),
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: 20,
              opacity: big,
              transform: `rotate(${(1 - big) * -8}deg) scale(${0.8 + 0.2 * big})`,
              boxShadow: press > 0.5 ? `0 0 ${26 * press}px ${withAlpha(theme.danger, 0.45)}` : 'none',
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 19, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap'}}>{'超限 · 最硬'}</span>
            {[0, 1, 2, 3].map((k) => (
              <span key={`bb${k}`} style={{height: 18, borderRadius: 4, width: `${92 - k * 8}%`, background: withAlpha(theme.dim, 0.32)}} />
            ))}
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'--experiment 5'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 左红右绿消融同屏（全片张力峰值）：撞墙×10 + 175.6s 烧尽 + 对峙 ─────

const WALL = {x: 812, y: 150, w: 26, h: 500} as const;
const BLOCK_3B = {y: 340, w: 180, h: 120} as const;

const ThreeB: React.FC<{atHit: number; atHit2: number; atTen: number; atBurn: number; atFail: number; atCtrl: number; atDuel: number}> = ({atHit, atHit2, atTen, atBurn, atFail, atCtrl, atDuel}) => {
  const frame = useCurrentFrame();
  // 节拍器式重复帧位：前两撞慢拍（词锚），3..10 快拍自 atTen（等拍重复即语义）
  const hitAnchors = [atHit, atHit2];
  const fastStart = atTen;
  const hits = (() => {
    let n = 0;
    for (const a of hitAnchors) if (frame >= a + 8) n += 1;
    if (frame >= fastStart) n = Math.max(n, 2 + Math.min(8, Math.floor((frame - fastStart) / 9) + 1));
    return Math.min(10, n);
  })();
  const lastAnchor = hits <= 2 && frame >= atHit2 ? atHit2 : hits <= 1 && frame >= atHit ? atHit : fastStart + Math.max(0, hits - 3) * 9;
  // 快拍期摆程 9 帧（与撞拍同节奏）；前两撞慢拍 18 帧——词锚节拍
  const swingDur = hits <= 2 ? 18 : 9;
  const swing = clamp01(progress(frame, lastAnchor, swingDur));
  const blockX = 380 + 250 * Math.sin(Math.PI * swing);
  const bounce = 1 - Math.abs(Math.cos(Math.PI * swing));
  // 175.6s 计时条动态烧尽 + 变灰（数据本体禁过冲；烧尽=灰化）
  const burn = clamp01(progress(frame, atBurn, 64));
  const burnNum = useCount({from: 0, to: 175.6, at: atBurn, dur: 64, ease: 'linear'});
  const burned = clamp01(progress(frame, atBurn + 64, DUR.f5));
  // 结局签 ok=False（左）↔ ok=True（右——对照组）
  const fail = clamp01(progress(frame, atFail, DUR.f4));
  // 右轨：压缩一次瞬时回绿 + 0.0s 恢复钟
  const ctrl = clamp01(progress(frame, atCtrl, DUR.f4));
  const greenFlash = Math.sin(Math.PI * clamp01(progress(frame, atCtrl + 3, 24)));
  const duel = clamp01(progress(frame, atDuel, DUR.f5));
  const okFalseColor = theme.danger;
  return (
    <AbsoluteFill>
      {/* 轨道标题（左轨 / 右轨——工况口径随角标） */}
      <div style={{position: 'absolute', left: 130, top: 116, display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{width: 14, height: 14, borderRadius: 4, background: theme.danger}} />
        <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap'}}>{'一刀切重试'}</span>
      </div>
      <div style={{position: 'absolute', left: 1010, top: 116, display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{width: 14, height: 14, borderRadius: 4, background: theme.ok}} />
        <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.ok, whiteSpace: 'nowrap'}}>{'分类路径'}</span>
      </div>
      {/* 左轨墙（同一堵超限墙——十枚撞痕随撞叠满） */}
      <div style={{position: 'absolute', left: WALL.x, top: WALL.y, width: WALL.w, height: WALL.h, borderRadius: 6, background: withAlpha(theme.panelBorder, 0.9), border: `3px solid ${withAlpha(theme.dim, 0.9)}`}} />
      {Array.from({length: 10}, (_, i) => {
        const on = i < hits;
        return (
          <div
            key={`mk${i}`}
            style={{
              position: 'absolute',
              left: WALL.x - 12,
              top: WALL.y + 26 + i * 46,
              width: 24,
              height: 10,
              borderRadius: 3,
              background: theme.danger,
              opacity: on ? 0.85 : 0,
              transform: `rotate(${(i % 2 === 0 ? -1 : 1) * 14}deg)`,
            }}
          />
        );
      })}
      {/* 请求块（节拍器式撞墙弹回——墙体纹丝不动） */}
      <div
        style={{
          position: 'absolute',
          left: blockX,
          top: BLOCK_3B.y - 8 * bounce,
          width: BLOCK_3B.w,
          height: BLOCK_3B.h,
          borderRadius: 10,
          border: `3.5px solid ${withAlpha(theme.danger, 0.85)}`,
          background: withAlpha(theme.panel, 0.95),
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 14,
          transform: `rotate(${4 * bounce}deg)`,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 15, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap'}}>{'超限请求'}</span>
        {[0, 1, 2].map((k) => (
          <span key={`qb${k}`} style={{height: 13, borderRadius: 4, width: `${90 - k * 10}%`, background: withAlpha(theme.dim, 0.3)}} />
        ))}
      </div>
      {/* 重试计数 0/10 → 10/10（逐拍跳） */}
      <div style={{position: 'absolute', left: 380, top: 220, fontFamily: theme.mono, fontSize: 44, fontWeight: 700, color: hits >= 10 ? theme.danger : theme.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>
        {`${hits}/10`}
      </div>
      {/* 175.6s 计时条（自 0 烧尽 → 变灰；左轨张力峰——全片唯一大 punch） */}
      <div style={{position: 'absolute', left: 130, top: 760, width: 660}}>
        <div style={{position: 'relative', height: 38, borderRadius: 7, border: `3px solid ${withAlpha(burned > 0.5 ? theme.dim : theme.danger, 0.75)}`, background: withAlpha(theme.panel, 0.9)}}>
          <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${burn * 100}%`, borderRadius: 4, background: withAlpha(burned > 0.5 ? theme.dim : theme.danger, 0.45)}} />
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: theme.mono, fontSize: 19, color: burned > 0.5 ? theme.dim : theme.text, whiteSpace: 'nowrap'}}>
          <span>{'0s'}</span>
          <span style={{fontWeight: 700, fontVariantNumeric: 'tabular-nums'}}>{`${burnNum.toFixed(1)}s`}</span>
          <span style={{color: theme.dim}}>{'175.6s'}</span>
        </div>
      </div>
      {/* 左轨结局签（ok=False——「以失败告终」） */}
      {fail > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 380,
            top: 668,
            padding: '8px 26px',
            borderRadius: 10,
            border: `3px solid ${okFalseColor}`,
            background: theme.panel,
            fontFamily: theme.mono,
            fontSize: 24,
            fontWeight: 700,
            color: okFalseColor,
            whiteSpace: 'nowrap',
            opacity: fail,
            transform: `translateY(${(1 - fail) * 16}px)`,
            boxShadow: `0 0 ${16 * fail}px ${withAlpha(theme.danger, 0.4)}`,
          }}
        >
          {'ok=False'}
        </div>
      ) : null}
      {/* 右轨：压缩一次（九条收六条同款——瞬时回绿）+ 0.0s 恢复钟 */}
      <MessageStack x={1010} y={190} w={260} h={380} collapseP={ctrl} tailLit={ctrl} litP={1} />
      <div
        style={{
          position: 'absolute',
          left: 1010,
          top: 600,
          padding: '6px 20px',
          borderRadius: 10,
          border: `3px solid ${ctrl > 0.4 ? theme.ok : theme.panelBorder}`,
          background: theme.panel,
          fontFamily: theme.mono,
          fontSize: 26,
          fontWeight: 700,
          color: ctrl > 0.4 ? theme.ok : theme.dim,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          opacity: ctrl,
          boxShadow: greenFlash > 0.05 ? `0 0 ${20 * greenFlash}px ${withAlpha(theme.ok, 0.55)}` : 'none',
        }}
      >
        {'0.0s'}
      </div>
      {/* 右轨结局签（ok=True——同款异值） */}
      {ctrl > 0.5 ? (
        <div
          style={{
            position: 'absolute',
            left: 1310,
            top: 596,
            padding: '8px 26px',
            borderRadius: 10,
            border: `3px solid ${theme.ok}`,
            background: theme.panel,
            fontFamily: theme.mono,
            fontSize: 24,
            fontWeight: 700,
            color: theme.ok,
            whiteSpace: 'nowrap',
            opacity: clamp01(progress(frame, atCtrl + 20, DUR.f4)),
            transform: `translateY(${(1 - clamp01(progress(frame, atCtrl + 20, DUR.f4))) * 16}px)`,
          }}
        >
          {'ok=True'}
        </div>
      ) : null}
      {/* 对峙定格强调（左右同屏——基线锚定） */}
      {duel > 0.02 ? (
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <line x1={960} y1={640} x2={960} y2={860} stroke={withAlpha(theme.dim, 0.5 * duel)} strokeWidth={3} strokeDasharray="8 8" />
          <text x={960} y={896} textAnchor="middle" fontFamily={theme.mono} fontSize={20} fontWeight={700} fill={theme.dim} opacity={0.8 * duel}>
            {'175.6s ↔ 0.0s'}
          </text>
        </svg>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'MAX_RETRIES=10 · idle 175.6s（standalone 口径）'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 归因特写三道具：块撞框 / 绕圈轨道+沙漏 / 减容装入通行 ──────────────

const FRAME_3C = {x: 250, y: 300, w: 250, h: 250} as const;
const ORBIT_3C = {cx: 850, cy: 430, r: 140} as const;
const HOURGLASS_3C = {x: 1330, y: 280, w: 190, h: 320} as const;

const ThreeC: React.FC<{atStuck: number; atOrbit: number; atSand: number; atShrink: number; atPass: number}> = ({atStuck, atOrbit, atSand, atShrink, atPass}) => {
  const frame = useCurrentFrame();
  // ① 超大块撞窗口框（固定尺寸——块比框大一圈装不进）
  const stuck = clamp01(progress(frame, atStuck, 34));
  // ② 绕圈自转轨道（块体尺寸刻度恒定——自转一周+，圈数计）
  const orbit = clamp01(progress(frame, atOrbit, 78));
  const laps = Math.floor(orbit * 2);
  const lapFrac = (orbit * 2) % 1;
  const angle = -90 + lapFrac * 360;
  const rad = (angle * Math.PI) / 180;
  const ox = ORBIT_3C.cx + ORBIT_3C.r * Math.cos(rad);
  const oy = ORBIT_3C.cy + ORBIT_3C.r * Math.sin(rad);
  // ③ 时间沙漏（每绕一圈烧落一格——圈=时间的因果绑定）+ p3-08 减容装入
  const sand = clamp01(progress(frame, atSand, 10));
  const sandCells = Math.max(0, 4 - Math.round(laps * clamp01(sand)));
  const shrink = clamp01(progress(frame, atShrink, 40));
  const pass = clamp01(progress(frame, atPass, 34));
  const passFlash = Math.sin(Math.PI * clamp01(progress(frame, atPass + 22, 18)));
  return (
    <AbsoluteFill>
      {/* ① 超大超限错误块 vs 固定尺寸窗口框（卡在框口装不进 → 减容后装入通行） */}
      <div style={{position: 'absolute', left: FRAME_3C.x, top: FRAME_3C.y, width: FRAME_3C.w, height: FRAME_3C.h, borderRadius: 12, border: `4px dashed ${withAlpha(theme.dim, 0.9)}`}} />
      <div style={{position: 'absolute', left: FRAME_3C.x - 60, top: FRAME_3C.y - 40, width: 360, height: 320, opacity: 1 - pass * 0.85}}>
        {/* 撞（stuck 逼近卡口）→ 减容（shrink 收叠复用 1-C 同款）→ 装入（pass 进框通行） */}
        <MessageStack x={30 + 30 * stuck + 60 * shrink + 60 * pass} y={60 * pass} w={260 - 130 * shrink} h={300 - 180 * shrink} collapseP={shrink} tailLit={shrink} litP={1} scale={1} />
      </div>
      {/* 减容注记（先减规模——复用压缩收叠同款动效） */}
      {shrink > 0.3 && pass < 0.5 ? (
        <div style={{position: 'absolute', left: 180, top: 640, fontFamily: theme.mono, fontSize: 16, color: theme.mech, whiteSpace: 'nowrap', opacity: shrink}}>{'减规模 → 再重试'}</div>
      ) : null}
      {/* 通行闪（减容后一次装入——正确次序的对照演示） */}
      {passFlash > 0.03 ? (
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <rect x={FRAME_3C.x - 8} y={FRAME_3C.y - 8} width={FRAME_3C.w + 16} height={FRAME_3C.h + 16} rx={14} fill="none" stroke={theme.ok} strokeWidth={4} opacity={passFlash * 0.9} />
          <text x={FRAME_3C.x + FRAME_3C.w / 2} y={FRAME_3C.y - 26} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fontWeight={700} fill={theme.ok} opacity={passFlash}>
            {'过'}
          </text>
        </svg>
      ) : null}
      {/* ② 绕圈自转轨道（重发箭头绕行——块体尺寸刻度恒定） */}
      <svg width={420} height={420} viewBox="0 0 420 420" style={{position: 'absolute', left: ORBIT_3C.cx - 210, top: ORBIT_3C.cy - 210, overflow: 'visible'}}>
        <circle cx={210} cy={210} r={ORBIT_3C.r} fill="none" stroke={withAlpha(theme.panelBorder, 0.9)} strokeWidth={2.5} strokeDasharray="6 7" />
        {/* 中心块（尺寸刻度恒定——重发不改规模的读数锚） */}
        <rect x={160} y={178} width={100} height={64} rx={9} fill={withAlpha(theme.panel, 0.96)} stroke={withAlpha(theme.danger, 0.8)} strokeWidth={3.5} />
        <text x={210} y={216} textAnchor="middle" fontFamily={theme.mono} fontSize={14} fontWeight={700} fill={theme.danger}>
          {'尺寸'}
        </text>
        <text x={210} y={270} textAnchor="middle" fontFamily={theme.mono} fontSize={13} fill={theme.dim}>
          {'恒定'}
        </text>
        {/* 绕行箭头（沿轨道行进 + 切向朝向） */}
        {orbit > 0.01 ? (
          <g transform={`translate(${(ox - ORBIT_3C.cx + 210).toFixed(1)} ${(oy - ORBIT_3C.cy + 210).toFixed(1)}) rotate(${angle + 90})`}>
            <path d="M -16 0 L 10 0" stroke={theme.danger} strokeWidth={5} strokeLinecap="round" />
            <path d="M 4 -8 L 16 0 L 4 8" fill="none" stroke={theme.danger} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ) : null}
        <text x={210} y={392} textAnchor="middle" fontFamily={theme.mono} fontSize={15} fill={theme.dim}>
          {`重试绕圈 · ${laps} 圈`}
        </text>
      </svg>
      {/* ③ 时间沙漏（退避紫时间维——烧尽刻度随圈数烧落） */}
      <svg width={HOURGLASS_3C.w} height={HOURGLASS_3C.h} viewBox="0 0 190 320" style={{position: 'absolute', left: HOURGLASS_3C.x, top: HOURGLASS_3C.y}}>
        <path d="M 30 20 L 160 20 L 160 66 L 108 160 L 160 254 L 160 300 L 30 300 L 30 254 L 82 160 L 30 66 Z" fill={withAlpha(theme.panel, 0.95)} stroke={withAlpha(theme.backoff, 0.85)} strokeWidth={4} strokeLinejoin="round" />
        {/* 上腔沙位（4 格——每绕一圈烧落一格） */}
        {[0, 1, 2, 3].map((k) => {
          const on = k < sandCells;
          return (
            <rect
              key={`sn${k}`}
              x={52 - k * 4}
              y={44 + k * 18}
              width={86 + k * 8}
              height={14}
              rx={4}
              fill={theme.backoff}
              opacity={on ? 0.75 : 0.08}
            />
          );
        })}
        {/* 下腔落沙堆（烧落的格数堆积——圈=时间的因果绑定可视） */}
        {[0, 1, 2, 3].map((k) => {
          const on = k >= sandCells;
          return (
            <rect
              key={`sd${k}`}
              x={95 - (k + 1) * 9}
              y={284 - k * 12}
              width={(k + 1) * 18}
              height={10}
              rx={4}
              fill={theme.backoff}
              opacity={on ? 0.6 : 0.08}
            />
          );
        })}
        <text x={95} y={346} textAnchor="middle" fontFamily={theme.mono} fontSize={15} fill={theme.backoff}>
          {'时间'}
        </text>
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'容量错误 · 重试不减规模 · 时间烧光'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-D 教训收束：残影回魂 + 环体回半亮 + 问号悬念 → 拉远交棒 ───────────────

const GHOST_3D = {x: 240, y: 240, w: 520, h: 280} as const;
const RING_3D = {x: 900, y: 280, size: 240} as const;

const ThreeD: React.FC<{atGhost: number; atHalf: number; atPush: number}> = ({atGhost, atHalf, atPush}) => {
  const frame = useCurrentFrame();
  const ghost = Math.sin(Math.PI * clamp01(progress(frame, atGhost, 60))) * 0.65 + 0.35 * clamp01(progress(frame, atGhost, DUR.f4));
  const half = clamp01(progress(frame, atHalf, DUR.f5));
  const push = usePushIn(atPush, {scale: -0.06, dur: 44});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '60% 40%'}}>
        {/* 单行道退场（残迹淡出——破坏实验收摊） */}
        <div style={{position: 'absolute', left: 240, top: 660, width: 1420, height: 54, borderRadius: 12, border: `3px solid ${withAlpha(theme.danger, 0.5)}`, background: withAlpha(theme.danger, 0.04), opacity: 1 - clamp01(progress(frame, 6, DUR.f5))}} />
        {/* 分类表残影（虚线回魂一拍——被点名不复活） */}
        <RoutingTable x={GHOST_3D.x} y={GHOST_3D.y} w={GHOST_3D.w} h={GHOST_3D.h} litP={1} rowsLit={0} ghostP={clamp01(ghost)} />
        <div style={{position: 'absolute', left: GHOST_3D.x, top: GHOST_3D.y - 42, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: withAlpha(theme.mech, 0.8), whiteSpace: 'nowrap', opacity: clamp01(ghost)}}>{'存亡线'}</div>
        {/* 环体（灰态 → 半亮——循环本体还在） */}
        <div style={{position: 'absolute', left: RING_3D.x, top: RING_3D.y, opacity: 0.32 + 0.36 * half}}>
          <LoopRing size={RING_3D.size} nodes={[]} showExit={false} dotProgress={0.35} />
        </div>
        {/* 大问号签（悬念不写字成句） */}
        <div
          style={{
            position: 'absolute',
            left: RING_3D.x + RING_3D.size / 2 - 22,
            top: 150,
            fontFamily: theme.serif,
            fontSize: 88,
            fontWeight: 700,
            color: theme.text,
            opacity: clamp01(progress(frame, atGhost + 16, DUR.f5)),
            textShadow: `0 0 26px ${withAlpha(theme.mech, 0.4)}`,
          }}
        >
          {'？'}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'分类 · 循环的存亡线'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P3AblationWall: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p3-01', 'p3-02');
  const bB = w('p3-03', 'p3-05');
  const bC = w('p3-06', 'p3-08');
  const bD = w('p3-09', 'p3-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ThreeA
          atGray={wa('p3-01', 0.2) - bA.from}
          atRoll={wa('p3-01', 0.32) - bA.from}
          atLane={wa('p3-01', 0.5) - bA.from}
          atMerge={wa('p3-01', 0.64) - bA.from}
          atBig={wa('p3-02', 0.18) - bA.from}
          atPress={wa('p3-02', 0.55) - bA.from}
          atPush={wa('p3-02', 0.3) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ThreeB
          atHit={wa('p3-03', 0.16) - bB.from}
          atHit2={wa('p3-03', 0.42) - bB.from}
          atTen={wa('p3-03', 0.62) - bB.from}
          atBurn={wa('p3-04', 0.15) - bB.from}
          atFail={wa('p3-04', 0.72) - bB.from}
          atCtrl={wa('p3-05', 0.34) - bB.from}
          atDuel={wa('p3-05', 0.66) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ThreeC
          atStuck={wa('p3-06', 0.44) - bC.from}
          atOrbit={wa('p3-07', 0.2) - bC.from}
          atSand={wa('p3-07', 0.55) - bC.from}
          atShrink={wa('p3-08', 0.3) - bC.from}
          atPass={wa('p3-08', 0.55) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="3-D">
        <ThreeD atGhost={wa('p3-09', 0.58) - bD.from} atHalf={wa('p3-09', 0.85) - bD.from} atPush={wa('p3-10', 0.44) - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3AblationWall;
