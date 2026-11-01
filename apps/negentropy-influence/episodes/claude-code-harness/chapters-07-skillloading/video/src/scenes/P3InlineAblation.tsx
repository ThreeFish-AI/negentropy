/** P3 常驻的代价（p3-01..p3-10，4 镜）——分镜 3-A / 3-B / 3-C / 3-D（全片张力峰值幕）。
 *
 *  叙事链：3-A 开帧走查舞台一拍重锚（全景坐标锚：三件套+计数器）→ 推向开场白带：
 *  破坏实验——「全量拼进」四张全文卡 stagger 拖入带内（蓝卡入紫带——反例态起；
 *  角标 experiment 3 · inline_all）→「八千三百七十」带子爆涨定格、标尺从 281 轴
 *  翻至 8370 轴（与 0-B 爆涨同形回魂——病灶态复现，警示红描边）→ 3-B 总账裁决
 *  特写：「两万五千三百二十三」计数器重跑跳定格（2-C 同款计数器——同器不同值）
 *  →「两万两千多」增量条 22264 长出（基线锚定：25323−3059）、「八点三倍」8.3×
 *  增长条冲顶 + 数字放大脉冲（全片张力峰值重音镜；终值不过冲）→ 3-C 左红右绿
 *  消融同屏：双轨并置（每轨一条开场白带 + 三轮格 + 总账位）——右轨「两级在位」
 *  确认绿（带内四行目录·281 口径、总输入 3059）；左轨「全量内联」警示红（带内
 *  四卡全量·8370 口径、总输入 25323、8.3× 增长条 + 轮数外推虚线）；「轮数越多，
 *  倍数越大」左轨外推虚线向右上扬 →「常驻内容，按每轮计费」机理签居中落下
 *  （双轨共用机理锚）→「每轮都收一遍钱」左轨计费帧回场——带子逐轮复制、账格
 *  逐轮 +8370（0-B 计费帧同款回魂）→「必须小」右轨目录带小格绿灯亮、「配得上
 *  大」右轨全文大卡按需门开（小/大与常驻/按需配位定格）→ 3-D 教训金句卡特写：
 *  紫目录带（小、常驻绿灯）与蓝全文卡（大、按需门）并置小图；「挂个名」目录带
 *  尾挂名牌轻晃、「不进全文」印章盖落（红印泥一拍，教训定格）→「真实产品」钩签
 *  浮起（转 P4）。
 *
 *  空间契约：四卡与 2-A 目录四行一一对应、标尺双轴翻转换轴可见、爆涨后带内不显
 *  目录形态、增量=两总账之差（25323−3059=22264）、8.3× 由比值可验（25323/3059）、
 *  增长条不越真实终值、红左绿右恒定、两轨轮次同为三轮（轮次不退·总账现形）、
 *  系统字符与总输入双口径各自对齐（281↔8370 / 3059↔25323）、左轨计费帧复制数
 *  =轮数、右轨无任何退化、金句卡为压缩短语非整句复述、印章为唯一红印元素。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；experiment 3 · inline_all ·
 *  system 8370 · total 25323 · 8.3x 只进角标；计数读数 Math.round(有界值) 直取、
 *  不经 clamp01；数值元素禁过冲（8.3× 脉冲只作用 scale、读数恒定）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CatalogBand, FullTextCard, RoundCounter} from '../components/motifs';
import {DUR, clamp01, progress, useCount, useImpulse, useProgress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 目录四行（承 P1/P2 同签同色——四卡与四行一一对应） */
const CATALOG_ROWS = [
  {name: '界面规范', sub: 'react-style · 组件写法约定'},
  {name: '数据库指南', sub: 'sql-style · 表与迁移规范'},
  {name: '接口文档', sub: 'api-design · REST 设计约定'},
  {name: '文档处理', sub: 'pdf · 文档处理规则'},
] as const;

// ── 3-A 破坏实验：开帧重锚 → 四卡拼入 → 爆涨换轴 ────────────────────────

const ThreeA: React.FC<{atPush: number; atDrag: number; atBurst: number}> = ({atPush, atDrag, atBurst}) => {
  const frame = useCurrentFrame();
  // 开帧走查舞台一拍重锚（@pushIn 轻推——三件套缩小态开场）→ 推向开场白带
  const push = usePushIn(atPush, {scale: 0.07, dur: DUR.f6});
  // 「全量拼进」四张全文卡 stagger 拖入带内（蓝卡入紫带——反例态起）
  const drag = clamp01(progress(frame, atDrag, DUR.f6 + DUR.f3));
  const inlineCards = 4 * drag;
  // 「八千三百七十」带子爆涨定格 + 标尺换轴 281→8370（数据本体：终值到位即止）
  const burst = clamp01(progress(frame, atBurst, DUR.f6));
  const bandH = 200 + 200 * burst;
  const axis = clamp01(progress(frame, atBurst, DUR.f5));
  const axisVal = Math.round(281 + (8370 - 281) * axis);
  const burstFlash = useImpulse({at: atBurst + DUR.f5, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '42% 50%'}}>
        {/* 走查三件套缩微（开帧重锚一拍——同舞台同方位同形重入；⑪ 半分辨率可见性：scale 0.7） */}
        <div style={{position: 'absolute', left: 1130, top: 120, opacity: 0.6}}>
          <RoundCounter x={0} y={0} scale={0.7} bigValue={3059} label={'total · 基线'} cellsLit={3} activeCell={-1} />
        </div>
        <div style={{position: 'absolute', left: 1490, top: 300, opacity: 0.6}}>
          <FullTextCard x={0} y={0} w={200} h={330} rowsLit={12} scale={0.9} dim={0.3} />
        </div>
        {/* 开场白带（反例态——四卡拼入 + 爆涨 + 警示红描边；左缘换轴标尺） */}
        <div style={{position: 'absolute', left: 300, top: 240}}>
          <CatalogBand
            x={0}
            y={0}
            w={820}
            h={bandH}
            rows={CATALOG_ROWS}
            rowsLit={0}
            redMode={burst}
            inlineCards={inlineCards}
            inlineFlash={burstFlash}
            charText={`${axisVal}`}
            charLit={axis}
            headLabel={'开场白 · inline_all'}
            swell={burst}
          />
          {/* 281→8370 换轴标尺（左缘竖尺——双轴翻转换轴可见） */}
          <div style={{position: 'absolute', left: -66, top: 10, bottom: 10, width: 50}}>
            <div style={{position: 'relative', width: '100%', height: '100%'}}>
              <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: withAlpha(burst > 0.4 ? theme.danger : theme.dim, 0.6)}} />
              {[0, 1, 2, 3].map((k) => (
                <div key={k} style={{position: 'absolute', left: 0, top: `${25 * k}%`, width: 14, height: 2, background: withAlpha(theme.dim, 0.55)}} />
              ))}
              <div
                style={{
                  position: 'absolute',
                  left: 8,
                  top: 4,
                  fontFamily: theme.mono,
                  fontSize: 15,
                  fontWeight: 700,
                  color: burst > 0.4 ? theme.danger : theme.dim,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {`${axisVal}`}
              </div>
              <div style={{position: 'absolute', left: 8, top: 26, fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap'}}>{'system'}</div>
            </div>
          </div>
          {/* 实验角标（experiment 3 · inline_all——破坏实验口径） */}
          <div style={{position: 'absolute', left: 0, top: -34, fontFamily: theme.mono, fontSize: 15, color: theme.danger, whiteSpace: 'nowrap', opacity: drag}}>
            {'experiment 3 · inline_all · 全量拼进'}
          </div>
        </div>
        {/* 消息队列位（右下缩微——三轮格位恒在，轮次不退） */}
        <div style={{position: 'absolute', left: 1210, top: 700, display: 'flex', gap: 8, opacity: 0.7}}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 84,
                height: 44,
                boxSizing: 'border-box',
                borderRadius: 7,
                border: `2px solid ${withAlpha(theme.load, 0.5)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 13,
                color: theme.dim,
              }}
            >
              {`轮 ${i}`}
            </div>
          ))}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'破坏实验 · 四卡全量拼进带身'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 总账裁决特写：重跑 25323 + 增量 22264 + 8.3× 冲顶 ────────────────

const ThreeB: React.FC<{atRerun: number; atIncr: number; atX83: number}> = ({atRerun, atIncr, atX83}) => {
  const frame = useCurrentFrame();
  // 计数器重跑跳定格（2-C 同款计数器——同器不同值；终值不过冲）
  const rerun = useCount({to: 25323, at: atRerun, dur: DUR.f6 + DUR.f4});
  const cellsJoin = useProgress(atRerun + DUR.f5, DUR.f5);
  // 增量条 22264 长出（基线锚定：25323−3059——从 3059 基线位长到 25323 顶）
  const incr = clamp01(progress(frame, atIncr, DUR.f6));
  // 8.3× 增长条冲顶 + 数字放大脉冲（数据本体红线：脉冲只作用 scale、读数恒定）
  const x83 = useProgress(atX83, DUR.f5);
  const x83Pop = useImpulse({at: atX83, dur: DUR.f6, peak: 0.16});
  const BAR = {x: 1180, y: 200, h: 560, w: 120} as const;
  const baseFrac = 3059 / 25323;
  return (
    <AbsoluteFill>
      {/* 计数器（同器——重跑口径 total 25323） */}
      <div style={{position: 'absolute', left: 240, top: 190}}>
        <RoundCounter
          x={0}
          y={0}
          scale={1.2}
          bigValue={rerun}
          label={'total · 三轮总输入（重跑）'}
          cellsLit={3}
          activeCell={-1}
          flash={cellsJoin}
        />
      </div>
      {/* 总账竖条（0→25323；基线位 3059 刻度 + 增量段 22264） */}
      <div style={{position: 'absolute', left: BAR.x, top: BAR.y, width: BAR.w, height: BAR.h}}>
        <div style={{position: 'relative', width: '100%', height: '100%'}}>
          {/* 全条底（25323 满高——警示红描边） */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              boxSizing: 'border-box',
              borderRadius: 10,
              border: `3px solid ${withAlpha(theme.danger, 0.8)}`,
              background: withAlpha(theme.danger, 0.05),
            }}
          />
          {/* 增量段（3059 基线之上——红实、不越真实终值） */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: `${baseFrac * 100}%`,
              height: `${(1 - baseFrac) * 100 * incr}%`,
              boxSizing: 'border-box',
              borderRadius: '10px 10px 0 0',
              background: withAlpha(theme.danger, 0.3),
              opacity: 0.4 + 0.6 * incr,
            }}
          />
          {/* 基线刻度（3059——P2 总账回显，恒常驻） */}
          <div style={{position: 'absolute', left: -170, top: `${(1 - baseFrac) * 100}%`, display: 'flex', alignItems: 'center', gap: 10}}>
            <div style={{width: 150, height: 0, borderTop: `3px solid ${theme.ok}`}} />
            <span style={{fontFamily: theme.mono, fontSize: 18, fontWeight: 700, color: theme.ok, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>{'3059 基线'}</span>
          </div>
          {/* 增量读数（22264——两总账之差） */}
          <div style={{position: 'absolute', left: -230, top: `${(1 - baseFrac) * 100 - 14}%`, fontFamily: theme.mono, fontSize: 22, fontWeight: 700, color: theme.danger, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', opacity: incr}}>
            {`+${Math.round(22264 * incr)}`}
          </div>
          {/* 满标读数（25323） */}
          <div style={{position: 'absolute', left: -140, top: -34, fontFamily: theme.mono, fontSize: 20, fontWeight: 700, color: theme.danger, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>
            {'25323'}
          </div>
        </div>
      </div>
      {/* 8.3× 大数字（冲顶 + 数字放大脉冲——读数恒定 8.3） */}
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 560,
          width: 460,
          textAlign: 'center',
          opacity: x83,
          transform: `translateY(${(1 - x83) * 40}px) scale(${1 + x83Pop})`,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 120, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1, textShadow: `0 0 ${40 * x83}px ${withAlpha(theme.danger, 0.45)}`}}>
          {'8.3×'}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 12, fontVariantNumeric: 'tabular-nums'}}>{'25323 ÷ 3059'}</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'常驻按每轮计费 · 账单冲顶'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 左红右绿消融同屏（全片张力峰值） ─────────────────────────────────

/** 单轨（开场白带 + 三轮格 + 总账位——除带内容与总账外全同构） */
const Track: React.FC<{
  x: number;
  tag: string;
  sub: string;
  accent: string;
  bandMode: 'inline' | 'catalog';
  sysChars: number;
  total: number;
  valP: number;
  copies: number;
  cellsLit: number;
  growth: number;
  extrapol: number;
  greenLight: number;
  gateOpen: number;
  panelFlash: number;
}> = ({x, tag, sub, accent, bandMode, sysChars, total, valP, copies, cellsLit, growth, extrapol, greenLight, gateOpen, panelFlash}) => (
  <div style={{position: 'absolute', left: x, top: 160, width: 830}}>
    <div
      style={{
        width: 830,
        height: 700,
        boxSizing: 'border-box',
        borderRadius: 16,
        border: `3.5px solid ${accent}`,
        background: withAlpha(theme.panel, 0.92),
        position: 'relative',
        boxShadow: panelFlash > 0.05 ? `0 0 ${26 * panelFlash}px ${withAlpha(accent, 0.5)}` : 'none',
      }}
    >
      {/* 头行：轨名 + 工况角标 */}
      <div style={{display: 'flex', alignItems: 'baseline', gap: 14, padding: '16px 22px 0'}}>
        <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: accent}}>{tag}</span>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 13,
            color: theme.dim,
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 6,
            padding: '1px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          {sub}
        </span>
      </div>
      {/* 开场白带（轨内主件——inline: 四卡全量·红描边 + 逐轮复制叠印 / catalog: 四行目录·紫） */}
      <div style={{position: 'absolute', left: 22, top: 66}}>
        {bandMode === 'inline' ? (
          <>
            {/* 逐轮复制叠印（计费帧回场——ghost 带右下错位，复制数=轮数） */}
            {Array.from({length: 3}, (_, i) => {
              const on = clamp01(copies - i);
              return (
                <div
                  key={`cp${i}`}
                  style={{
                    position: 'absolute',
                    left: (i + 1) * 16,
                    top: (i + 1) * 8,
                    width: 760,
                    height: 110,
                    boxSizing: 'border-box',
                    borderRadius: 14,
                    border: `2.5px solid ${withAlpha(theme.danger, 0.28 + 0.18 * on)}`,
                    background: withAlpha(theme.danger, 0.03 * on),
                    opacity: 0.22 + 0.5 * on,
                    pointerEvents: 'none',
                  }}
                />
              );
            })}
            <CatalogBand
              x={0}
              y={0}
              w={780}
              h={110}
              rows={CATALOG_ROWS}
              rowsLit={0}
              redMode={1}
              inlineCards={4}
              charText={`${sysChars}`}
              charLit={1}
              headLabel={'开场白 · inline_all'}
            />
          </>
        ) : (
          <div style={{position: 'relative'}}>
            <CatalogBand x={0} y={0} w={780} h={110} rows={CATALOG_ROWS} rowsLit={4} charText={`${sysChars}`} charLit={1} headLabel={'开场白 · 目录'} />
            {/* 小格绿灯（必须小——目录带侧的常驻绿灯） */}
            <div
              style={{
                position: 'absolute',
                right: -8,
                top: -22,
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: `3px solid ${greenLight > 0.4 ? theme.ok : theme.panelBorder}`,
                background: withAlpha(theme.ok, 0.15 * greenLight),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 16,
                fontWeight: 700,
                color: theme.ok,
                opacity: greenLight,
              }}
            >
              {'小'}
            </div>
          </div>
        )}
      </div>
      {/* 三轮格（轮次不退·总账现形——两轨同为三轮；左轨即账格：逐轮 +8370；
          ⑨ QA N1：亮格提亮 ≥200/255——底 0.22 + 辉光） */}
      <div style={{position: 'absolute', left: 22, top: 214, display: 'flex', gap: 10}}>
        {[1, 2, 3].map((i) => {
          const on = bandMode === 'inline' ? clamp01(cellsLit - (i - 1)) : 1;
          return (
            <div
              key={i}
              style={{
                width: 236,
                height: 52,
                boxSizing: 'border-box',
                borderRadius: 8,
                border: `3px solid ${bandMode === 'inline' ? (on > 0.5 ? theme.danger : theme.panelBorder) : withAlpha(accent, 0.6)}`,
                background: bandMode === 'inline' && on > 0.5 ? withAlpha(theme.danger, 0.22) : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 15,
                color: bandMode === 'inline' && on > 0.5 ? theme.danger : theme.dim,
                fontWeight: 700,
                opacity: bandMode === 'inline' ? 0.5 + 0.5 * on : 1,
                boxShadow: bandMode === 'inline' && on > 0.5 ? `0 0 ${12 * on}px ${withAlpha(theme.danger, 0.55)}` : 'none',
              }}
            >
              {bandMode === 'inline' ? (on > 0.5 ? '+8370' : `轮 ${i}`) : `轮 ${i}`}
            </div>
          );
        })}
      </div>
      {/* 总账位（双口径对齐：281↔8370 / 3059↔25323） */}
      <div style={{position: 'absolute', left: 22, top: 296, display: 'flex', alignItems: 'baseline', gap: 14}}>
        <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap'}}>{'三轮总输入'}</span>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 44,
            fontWeight: 700,
            color: theme.text,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            opacity: clamp01(valP),
          }}
        >
          {String(total)}
        </span>
      </div>
      {/* 左轨专属：8.3× 增长条 + 轮数外推虚线（向右上扬） */}
      {bandMode === 'inline' ? (
        <div style={{position: 'absolute', left: 22, top: 372, width: 780, height: 220}}>
          {/* 增长条（8.3× 冲顶回显——同 3-B 终值） */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: 18,
              width: 250 * growth + 40,
              height: 54,
              boxSizing: 'border-box',
              borderRadius: 9,
              border: `3px solid ${theme.danger}`,
              background: withAlpha(theme.danger, 0.16),
              opacity: growth,
            }}
          />
          <div style={{position: 'absolute', left: 48, bottom: 82, fontFamily: theme.mono, fontSize: 26, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', opacity: growth}}>
            {'8.3×'}
          </div>
          {/* 轮数外推虚线（轮数→∞ 倍数放大——向右上扬） */}
          <svg width={760} height={200} viewBox="0 0 760 200" style={{position: 'absolute', inset: 0, overflow: 'visible', opacity: extrapol}}>
            <line x1={20} y1={186} x2={620} y2={64} stroke={withAlpha(theme.danger, 0.8)} strokeWidth={3.5} strokeDasharray="10 10" />
            <path d="M 604 52 L 626 60 L 612 80" fill="none" stroke={withAlpha(theme.danger, 0.9)} strokeWidth={3.5} strokeLinecap="round" />
            <text x={640} y={56} fontFamily={theme.sans} fontSize={16} fill={theme.danger}>
              {'轮数越多 · 倍数越大'}
            </text>
            <text x={20} y={198} fontFamily={theme.mono} fontSize={13} fill={theme.dim}>
              {'轮数 →'}
            </text>
          </svg>
        </div>
      ) : (
        /* 右轨专属：全文大卡按需门（配得上大——门开定格） */
        <div style={{position: 'absolute', left: 30, top: 380, opacity: clamp01(gateOpen)}}>
          <FullTextCard x={0} y={0} w={300} h={280} rowsLit={12} scale={0.94} />
          {/* 按需门（门开——两扇门板向两侧让开） */}
          <svg width={330} height={300} viewBox="0 0 330 300" style={{position: 'absolute', left: -12, top: -10, overflow: 'visible', pointerEvents: 'none'}}>
            <line x1={165 - 140 * gateOpen} y1={8} x2={165 - 140 * gateOpen} y2={292} stroke={withAlpha(theme.load, 0.85)} strokeWidth={5} strokeLinecap="round" />
            <line x1={165 + 140 * gateOpen} y1={8} x2={165 + 140 * gateOpen} y2={292} stroke={withAlpha(theme.load, 0.85)} strokeWidth={5} strokeLinecap="round" />
          </svg>
          <div style={{position: 'absolute', left: 330, top: 120, fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.load, whiteSpace: 'nowrap', opacity: clamp01(gateOpen)}}>
            {'按需门 · 开'}
          </div>
        </div>
      )}
    </div>
  </div>
);

const ThreeC: React.FC<{atExtra: number; atMech: number; atBilling: number; atSmall: number; atGate: number}> = ({
  atExtra,
  atMech,
  atBilling,
  atSmall,
  atGate,
}) => {
  const frame = useCurrentFrame();
  // 「轮数越多，倍数越大」外推虚线上扬
  const extra = useProgress(atExtra, DUR.f5);
  // 「常驻内容，按每轮计费」机理签居中落下（双轨共用机理锚）
  const mech = useProgress(atMech, DUR.f5);
  // 「每轮都收一遍钱」左轨计费帧回场（带子逐轮复制、账格逐轮 +8370——复制数=轮数）
  const billing = clamp01(progress(frame, atBilling, DUR.f6 + DUR.f4));
  // 「必须小」右轨目录带小格绿灯亮；「配得上大」右轨全文大卡按需门开
  const small = useProgress(atSmall, DUR.f4);
  const gate = useProgress(atGate, DUR.f5);
  const gateFlash = useImpulse({at: atGate + DUR.f4, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      {/* 左轨（红——全量内联） */}
      <Track
        x={90}
        tag={'全量内联'}
        sub={'inline_all'}
        accent={theme.danger}
        bandMode="inline"
        sysChars={8370}
        total={25323}
        valP={1}
        copies={billing}
        cellsLit={billing}
        growth={1}
        extrapol={extra}
        greenLight={0}
        gateOpen={0}
        panelFlash={0}
      />
      {/* 右轨（绿——两级在位） */}
      <Track
        x={1000}
        tag={'两级在位'}
        sub={'tiered'}
        accent={theme.ok}
        bandMode="catalog"
        sysChars={281}
        total={3059}
        valP={1}
        copies={0}
        cellsLit={0}
        growth={0}
        extrapol={0}
        greenLight={small}
        gateOpen={gate}
        panelFlash={gateFlash}
      />
      {/* 机理签（居中落下——双轨共用机理锚） */}
      <div
        style={{
          position: 'absolute',
          left: 660,
          top: 92,
          padding: '10px 26px',
          borderRadius: 10,
          border: `3px solid ${withAlpha(theme.text, 0.85)}`,
          background: theme.panel,
          fontFamily: theme.sans,
          fontSize: 24,
          fontWeight: 700,
          color: theme.text,
          whiteSpace: 'nowrap',
          opacity: mech,
          transform: `translateY(${(1 - mech) * -26}px)`,
          zIndex: 3,
        }}
      >
        {'常驻内容 · 按每轮计费'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'消融对照 · 轮次不退 · 总账现形'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-D 教训金句卡特写：小带 + 大卡并置 + 印章 ───────────────────────────

const ThreeD: React.FC<{atPlate: number; atSeal: number; atHook: number}> = ({atPlate, atSeal, atHook}) => {
  const frame = useCurrentFrame();
  // 「挂个名」目录带尾挂名牌轻晃（sin 衰减晃动——帧驱动）
  const plate = useProgress(atPlate, DUR.f4);
  const wobble = plate > 0.02 ? Math.sin((frame - atPlate) / 2.6) * 5 * Math.exp(-Math.max(0, frame - atPlate - 10) / 14) : 0;
  // 「不进全文」印章盖落（红印泥一拍——教训定格；印章为唯一红印元素）
  const seal = clamp01(progress(frame, atSeal, DUR.f4));
  const sealPulse = useImpulse({at: atSeal + DUR.f3, dur: DUR.f5, peak: 0.1});
  // 「真实产品」钩签浮起（转 P4）
  const hook = useProgress(atHook, DUR.f5);
  return (
    <AbsoluteFill>
      {/* 紫目录带（小、常驻绿灯） */}
      <div style={{position: 'absolute', left: 170, top: 430}}>
        <CatalogBand x={0} y={0} w={540} h={150} rows={CATALOG_ROWS} rowsLit={4} scale={0.94} charText={'281'} charLit={1} />
        {/* 常驻绿灯（必须小——右轨绿灯同款承续） */}
        <div
          style={{
            position: 'absolute',
            right: -16,
            top: -20,
            padding: '3px 12px',
            borderRadius: 8,
            border: `2.5px solid ${theme.ok}`,
            background: withAlpha(theme.ok, 0.12),
            fontFamily: theme.sans,
            fontSize: 15,
            fontWeight: 700,
            color: theme.ok,
            whiteSpace: 'nowrap',
          }}
        >
          {'常驻 · 小'}
        </div>
        {/* 挂名牌（带尾挂名——轻晃） */}
        <div
          style={{
            position: 'absolute',
            right: -104,
            bottom: 8,
            padding: '5px 14px',
            borderRadius: 8,
            border: `2.5px solid ${theme.mech}`,
            background: withAlpha(theme.mech, 0.12),
            fontFamily: theme.sans,
            fontSize: 17,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: plate,
            transform: `rotate(${wobble}deg)`,
            transformOrigin: 'left top',
          }}
        >
          {'挂名'}
        </div>
      </div>
      {/* 蓝全文卡（大、按需门） */}
      <div style={{position: 'absolute', left: 1290, top: 260}}>
        <FullTextCard x={0} y={0} w={330} h={470} rowsLit={12} />
        <div style={{position: 'absolute', left: 344, top: 210, fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.load, whiteSpace: 'nowrap'}}>
          {'按需 · 大'}
        </div>
      </div>
      {/* 印章（盖落——红印泥一拍；压缩短语教训） */}
      {seal > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 770,
            top: 300 - 260 * (1 - seal),
            width: 380,
            height: 150,
            boxSizing: 'border-box',
            borderRadius: 14,
            border: `5px solid ${theme.danger}`,
            background: withAlpha(theme.danger, 0.1),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: clamp01(seal * 2),
            transform: `rotate(-7deg) scale(${1 + sealPulse})`,
            boxShadow: `0 0 ${30 * seal}px ${withAlpha(theme.danger, 0.4)}`,
          }}
        >
          <span style={{fontFamily: theme.serif, fontSize: 42, fontWeight: 700, color: theme.danger, letterSpacing: 4}}>{'挂名 · 不进全文'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'listing only'}</span>
        </div>
      ) : null}
      {/* 钩签（真实产品——转 P4） */}
      {hook > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 820,
            top: 700,
            padding: '10px 26px',
            borderRadius: 10,
            border: `2.5px solid ${withAlpha(theme.text, 0.8)}`,
            background: theme.panel,
            fontFamily: theme.serif,
            fontSize: 30,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: hook,
            transform: `translateY(${(1 - hook) * 18}px)`,
          }}
        >
          {'真实产品里呢？'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'教训 · 小与大配位'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P3InlineAblation: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p3-01', 'p3-02');
  const bB = w('p3-03', 'p3-04');
  const bC = w('p3-05', 'p3-08');
  const bD = w('p3-09', 'p3-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ThreeA atPush={0} atDrag={wa('p3-01', 0.5) - bA.from} atBurst={wa('p3-02', 0.42) - bA.from} />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ThreeB atRerun={wa('p3-03', 0.3) - bB.from} atIncr={wa('p3-04', 0.18) - bB.from} atX83={wa('p3-04', 0.58) - bB.from} />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ThreeC
          atExtra={wa('p3-05', 0.42) - bC.from}
          atMech={wa('p3-06', 0.36) - bC.from}
          atBilling={wa('p3-07', 0.4) - bC.from}
          atSmall={wa('p3-08', 0.5) - bC.from}
          atGate={wa('p3-08', 0.76) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="3-D">
        <ThreeD atPlate={wa('p3-09', 0.48) - bD.from} atSeal={wa('p3-09', 0.74) - bD.from} atHook={wa('p3-10', 0.42) - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3InlineAblation;
