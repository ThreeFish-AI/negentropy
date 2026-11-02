/** RankFusion：名次融合（RRF）装置（5-E2 主件；P7 7-G 融合段可复用同一形）。
 *
 *  三段各锚一句：
 *   at（p5-15b）——两路名次表并排入列（各路自己的排序）+「score = Σ 1/rank」
 *       公式 + 合成名次列（相对条只表次序、不写常数）；
 *   swapAt（p5-15c）——构造例两卡换位：「两路第一」升到「一路第一」之上
 *       （几何位移走弹簧、重音走 @impulse，不涉融合常数）；
 *   enginesAt / entryAt（p5-15d/e）——「本仓现状」面板：三处引擎实心点逐亮
 *       （规划器种子融合 / 记忆混合检索 / 知识库检索），统一入口灰框
 *       （权限门＋意图路由 · 简化实现）压暗收尾。
 *  自绘 DOM（非 archify 回放）；时点全部由调用方按句边界推导（禁写死帧数）。
 *  数据元素（合成条）不过冲：几何量用 settle（ζ≈10 无过冲）弹簧。
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {theme, withAlpha} from '../design/theme';
import {useEnter, useImpulse, useProgress, useSpring, useStagger} from '../motion';

/** 两路名次表（构造数据：每路只含「名次 → 条目」，不携带分数）。 */
const ROUTE_A: ReadonlyArray<readonly [number, string]> = [
  [1, 'A'],
  [2, 'B'],
  [3, 'C'],
  [4, 'D'],
];
const ROUTE_B: ReadonlyArray<readonly [number, string]> = [
  [1, 'A'],
  [2, 'C'],
  [3, 'D'],
  [4, 'B'],
];
/** 合成序（Σ 1/rank：A 1+1 · C ½+⅓ · B ½+¼ · D ¼+⅓，无并列）；条宽按相对值。 */
const FUSED: ReadonlyArray<readonly [string, number]> = [
  ['A', 1],
  ['C', 0.42],
  ['B', 0.37],
  ['D', 0.29],
];

const RANK_CHIP: React.CSSProperties = {
  width: 40,
  height: 30,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  border: `1.5px solid ${theme.panelBorder}`,
  fontSize: 16,
  fontFamily: theme.mono,
  color: theme.dim,
};

const Row: React.FC<{rank: number; item: string; on: number; bar?: number}> = ({rank, item, on, bar}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 12, opacity: 0.25 + on * 0.75, transform: `translateX(${(1 - on) * -14}px)`}}>
    <span style={RANK_CHIP}>{`#${rank}`}</span>
    <span
      style={{
        width: 52,
        height: 34,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 7,
        border: `2px solid ${theme.concept}`,
        background: withAlpha(theme.concept, 0.14),
        fontSize: 20,
        fontFamily: theme.mono,
        color: theme.text,
      }}
    >
      {item}
    </span>
    {bar !== undefined ? (
      <span style={{position: 'relative', flex: 1, height: 12, borderRadius: 6, background: withAlpha(theme.panelBorder, 0.5)}}>
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${bar * 100}%`,
            borderRadius: 6,
            background: item === 'A' ? theme.ok : withAlpha(theme.concept, 0.75),
          }}
        />
      </span>
    ) : null}
  </div>
);

export const RankFusion: React.FC<{
  /** 两路名次表入列（p5-15b） */
  at: number;
  /** 构造例两卡换位（p5-15c） */
  swapAt: number;
  /** 本仓三处引擎实心点逐亮（p5-15d） */
  enginesAt: number;
  /** 统一入口灰框（p5-15e） */
  entryAt: number;
}> = ({at, swapAt, enginesAt, entryAt}) => {
  const enter = useProgress(at, 10);
  const rowsA = useStagger(ROUTE_A.length, {stride: 7, at: at + 6});
  const rowsB = useStagger(ROUTE_B.length, {stride: 7, at: at + 12});
  const formula = useEnter('fade', {at: at + 26, dur: 14});
  const fused = useStagger(FUSED.length, {stride: 8, at: at + 34});
  // 构造例：先落位、再换位（同句内完成——位移弹簧 + 一次性重音）
  const example = useEnter('rise', {at: swapAt, dur: 16});
  const swap = useSpring('settle', {at: swapAt + 44, dur: 28});
  const flash = useImpulse({at: swapAt + 50, dur: 24, peak: 1});
  const engines = useStagger(3, {stride: 10, at: enginesAt});
  const entry = useEnter('rise', {at: entryAt, dur: 16});
  const panelO = useProgress(enginesAt, 10);

  const colHead: React.CSSProperties = {fontSize: 19, color: theme.concept, marginBottom: 14};

  return (
    <AbsoluteFill style={{opacity: enter}}>
      {/* 公式条（RRF · 按排名合成） */}
      <div
        style={{
          ...formula,
          position: 'absolute',
          top: 128,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 24,
          alignItems: 'center',
        }}
      >
        <span style={{padding: '7px 22px', border: `2px solid ${theme.concept}`, borderRadius: 999, fontSize: 21, fontFamily: theme.mono, color: theme.concept}}>
          RRF · score = Σ 1/rank
        </span>
        <span style={{fontSize: 17, color: theme.dim, fontFamily: theme.mono}}>名次越靠前 · 权重越大</span>
      </div>

      {/* 两路名次表 + 合成名次列 */}
      <div style={{position: 'absolute', top: 214, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 56}}>
        <div style={{width: 300}}>
          <div style={colHead}>路 1 · 语义召回</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            {ROUTE_A.map(([r, it], i) => (
              <Row key={it} rank={r} item={it} on={rowsA[i]} />
            ))}
          </div>
        </div>
        <div style={{width: 300}}>
          <div style={colHead}>路 2 · 关键词</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            {ROUTE_B.map(([r, it], i) => (
              <Row key={it} rank={r} item={it} on={rowsB[i]} />
            ))}
          </div>
        </div>
        <div style={{width: 380}}>
          <div style={{...colHead, color: theme.ok}}>合成名次</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            {FUSED.map(([it, bar], i) => (
              <Row key={it} rank={i + 1} item={it} on={fused[i]} bar={bar * fused[i]} />
            ))}
          </div>
        </div>
      </div>

      {/* 构造例：两卡换位（只演示相对次序，不写常数） */}
      <div
        style={{
          ...example,
          position: 'absolute',
          left: 260,
          top: 600,
          width: 520,
          padding: '16px 22px',
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 12,
          background: withAlpha(theme.bg, 0.9),
        }}
      >
        <span style={{fontSize: 16, fontFamily: theme.mono, color: theme.dim}}>构造例</span>
        <div style={{position: 'relative', height: 172, marginTop: 10}}>
          {[
            {item: 'X', chips: ['#1', '#1'], tag: '两路第一', top: (1 - swap) * 86},
            {item: 'Y', chips: ['#1', '#4'], tag: '一路第一', top: swap * 86},
          ].map((c) => (
            <div
              key={c.item}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: c.top,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '10px 16px',
                borderRadius: 10,
                border: `2px solid ${c.item === 'X' ? withAlpha(theme.ok, 0.5 + flash * 0.5) : theme.panelBorder}`,
                background: theme.panel,
              }}
            >
              <span style={{width: 44, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: `2px solid ${theme.concept}`, fontSize: 20, fontFamily: theme.mono, color: theme.text}}>
                {c.item}
              </span>
              {c.chips.map((k, i) => (
                <span key={i} style={RANK_CHIP}>{k}</span>
              ))}
              <span style={{fontSize: 18, color: c.item === 'X' ? theme.ok : theme.dim, marginLeft: 'auto'}}>{c.tag}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 本仓现状：三处引擎实心点 + 统一入口灰框 */}
      <div
        style={{
          position: 'absolute',
          right: 260,
          top: 600,
          width: 560,
          padding: '16px 22px',
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 12,
          background: withAlpha(theme.bg, 0.9),
          opacity: panelO,
        }}
      >
        <span style={{fontSize: 16, fontFamily: theme.mono, color: theme.dim}}>本仓现状</span>
        <div style={{display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10}}>
          {['规划器种子融合', '记忆混合检索', '知识库检索'].map((t, i) => (
            <div key={t} style={{display: 'flex', alignItems: 'center', gap: 12, opacity: 0.25 + engines[i] * 0.75}}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: theme.ok,
                  transform: `scale(${0.5 + engines[i] * 0.5})`,
                  boxShadow: engines[i] > 0.8 ? `0 0 10px ${withAlpha(theme.ok, 0.5)}` : 'none',
                }}
              />
              <span style={{fontSize: 20, color: theme.text}}>{t}</span>
            </div>
          ))}
          <div
            style={{
              ...entry,
              marginTop: 6,
              padding: '10px 16px',
              border: `1.5px dashed ${theme.panelBorder}`,
              borderRadius: 10,
              fontSize: 18,
              fontFamily: theme.mono,
              color: theme.dim,
            }}
          >
            统一入口 · 权限门＋意图路由 · 简化实现
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
