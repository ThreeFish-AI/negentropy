/** P1/P2 共用装置件（收台四步 / 指针换空间两幕的镜头母题）。
 *
 *  ★ BenchTop 台面母题＝本集恒定视觉锚〔M-001〕的实现载体：
 *    描边恒 theme.core、线宽恒 BENCH_STROKE 绝对像素（不随 size 缩放），
 *    全片同形出场只换周边标签——任何调用点不得覆写这两个值，只许改宽与位置。
 *    空间契约：台面恒居画面左中锚位；会丢侧动效自上缘压入、向下腾位。
 *  ★ ClaimTag 取货条：搬仓库留在台面上的包裹标签（磁盘地址＋预览，mech），
 *    flat 0→1 交叉淡化到「无地址通用提示」薄条（dim）——压条子的破坏性替换形态。
 *
 *  共用件不带定位：两者都只返回自身尺寸的 <svg>，由调用点给坐标。
 */
import React from 'react';
import {theme} from '../design/theme';
import {clamp01} from '../motion';

/** 台面母题线宽（绝对像素，全片恒定，勿随宽度缩放——M-001） */
export const BENCH_STROKE = 6;
/** 台面台板厚度 / 腿高（构成不变量：同形出场） */
export const BENCH_TOP_H = 30;
export const BENCH_LEG_H = 170;
export const BENCH_TOTAL_H = BENCH_TOP_H + BENCH_LEG_H;
const LEG_INSET = 64;

/** hex + 确定性透明度（帧驱动的底色渐显；无随机） */
export const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 台面（工作台）：台板 + 两腿。items 由调用方在台板上方另行绘制（无彩 data 色）。 */
export const BenchTop: React.FC<{width?: number}> = ({width = 720}) => (
  <svg width={width} height={BENCH_TOTAL_H} style={{display: 'block', overflow: 'visible'}}>
    {/* 腿：同描边同线宽，母题的一部分 */}
    <line x1={LEG_INSET} y1={BENCH_TOP_H} x2={LEG_INSET} y2={BENCH_TOTAL_H} stroke={theme.core} strokeWidth={BENCH_STROKE} strokeLinecap="round" />
    <line x1={width - LEG_INSET} y1={BENCH_TOP_H} x2={width - LEG_INSET} y2={BENCH_TOTAL_H} stroke={theme.core} strokeWidth={BENCH_STROKE} strokeLinecap="round" />
    {/* 台板：core 恒定描边，内面 coreDeep 低透明（「压扁条的内面」语义） */}
    <rect x={0} y={0} width={width} height={BENCH_TOP_H} rx={9} fill={withAlpha(theme.coreDeep, 0.34)} stroke={theme.core} strokeWidth={BENCH_STROKE} />
  </svg>
);

/** 取货条 → 压扁后的无地址通用提示。
 *  flat 0 = 取货条（mech：挂孔 + 磁盘地址 + 预览两行）；flat 1 = 薄条（dim，无地址）。
 *  两态交叉淡化（mech→dim 的读法即在此），压扁行程由调用方以弹簧注入 flat。 */
export const ClaimTag: React.FC<{flat?: number; w?: number}> = ({flat = 0, w = 170}) => {
  const f = clamp01(flat);
  return (
    <svg width={w} height={54} style={{display: 'block', overflow: 'visible'}}>
      <g opacity={1 - f}>
        <rect x={12} y={2} width={w - 12} height={44} rx={8} fill={theme.panel} stroke={theme.mech} strokeWidth={3} />
        <circle cx={25} cy={14} r={4} fill="none" stroke={theme.mech} strokeWidth={2.5} />
        <text x={40} y={22} fontFamily={theme.mono} fontSize={15} fill={theme.mech}>
          {'disk · 0x7f3a'}
        </text>
        <text x={40} y={40} fontFamily={theme.mono} fontSize={12} fill={theme.dim}>
          {'preview 2000'}
        </text>
      </g>
      <g opacity={f}>
        <rect x={0} y={38} width={w} height={16} rx={4} fill={theme.panel} stroke={theme.dim} strokeWidth={2.5} />
        <text x={10} y={50} fontFamily={theme.mono} fontSize={12} fill={theme.dim}>
          {'compacted · re-run'}
        </text>
      </g>
    </svg>
  );
};
