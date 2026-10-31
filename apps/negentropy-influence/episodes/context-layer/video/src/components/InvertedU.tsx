/** 倒 U 曲线装置：窗口填充率横轴、性能纵轴——过半（50%）后性能线下垂（橙区）。
 *  P1 1-I 作 context rot 示意（窗口塞得越多、该找到的越找不准）；P4 4-F 作装配
 *  红线主装置；P7 7-H「按预算装夹」以同一曲线的口头回指为据。
 *  自绘 SVG（非 archify 回放）：轴线→蓝升段→橙垂段→红区分层入场，全部帧驱动。 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {theme, withAlpha} from '../design/theme';
import {useDraw, useProgress} from '../motion';

export const InvertedU: React.FC<{at: number}> = ({at}) => {
  const axes = useProgress(at, 10);
  const tick = useProgress(at + 6, 8);
  const blueDraw = useDraw(at + 8, 24);
  const orangeDraw = useDraw(at + 28, 24);
  const zone = useProgress(at + 44, 14);
  const peak = useProgress(at + 36, 10);
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <svg width={920} height={430} style={{overflow: 'visible'}}>
        {/* 轴系（工程图语言：细实线轴 + 刻度） */}
        <line x1={60} y1={360} x2={862} y2={360} stroke={theme.panelBorder} strokeWidth={2} opacity={axes} />
        <line x1={60} y1={78} x2={60} y2={360} stroke={theme.panelBorder} strokeWidth={2} opacity={axes} />
        {/* 50% 分界：点划中心线（M-004 学科视觉语言） */}
        <line
          x1={455}
          y1={360}
          x2={455}
          y2={92}
          stroke={theme.dim}
          strokeWidth={1.5}
          strokeDasharray="14 5 3 5"
          opacity={tick * 0.8}
        />
        <text x={430} y={388} fill={theme.dim} fontSize={17} fontFamily={theme.mono} opacity={tick}>
          50%
        </text>
        <text x={62} y={388} fill={theme.dim} fontSize={17} fontFamily={theme.mono} opacity={axes}>
          0
        </text>
        <text x={820} y={388} fill={theme.dim} fontSize={17} fontFamily={theme.mono} opacity={axes}>
          100%
        </text>
        <text x={400} y={416} fill={theme.dim} fontSize={18} fontFamily={theme.sans} opacity={axes}>
          窗口填充率
        </text>
        <text x={20} y={92} fill={theme.dim} fontSize={18} fontFamily={theme.sans} opacity={axes}>
          性能
        </text>
        {/* 过半红区（橙）：下垂段与基线围合 */}
        <path
          d="M 455 100 Q 648 112 724 186 Q 806 262 858 330 L 858 358 L 455 358 Z"
          fill={withAlpha(theme.conceptDeep, 0.14)}
          stroke="none"
          opacity={zone}
        />
        {/* 曲线两段：升段钢蓝、下垂段工业橙（描线走 pathLength 归一化） */}
        <path
          d="M 62 336 Q 250 88 455 100"
          fill="none"
          stroke={theme.concept}
          strokeWidth={4.5}
          strokeLinecap="round"
          {...blueDraw}
        />
        <path
          d="M 455 100 Q 648 112 724 186 Q 806 262 858 330"
          fill="none"
          stroke={theme.conceptDeep}
          strokeWidth={4.5}
          strokeLinecap="round"
          {...orangeDraw}
        />
        <circle cx={455} cy={100} r={5.5} fill={theme.concept} opacity={peak} />
        <text x={640} y={140} fill={theme.conceptDeep} fontSize={21} fontFamily={theme.sans} opacity={zone}>
          过半 · 下垂
        </text>
      </svg>
    </AbsoluteFill>
  );
};
