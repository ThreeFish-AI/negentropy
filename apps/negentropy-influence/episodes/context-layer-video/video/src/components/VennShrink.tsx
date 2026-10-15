/** 韦恩交集收缩 + 工牌碎裂（P3·3-D 权限回收装置，v2 销账项实装）。
 *
 *  三拍：双圆求交（at）→ 权限回收：任务圆右移、交集收窄（shrinkAt）→
 *  旧工牌裂纹扩展碎裂（crackAt，红叉禁例「上次办的工牌还能用」）。
 *  交集高亮用 clipPath 实现：用户圆裁任务圆，任务圆一移交集自动收窄。
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {theme, withAlpha} from '../design/theme';
import {useDraw, useEnter, useProgress, useSpring} from '../motion';

const R = 132;
const USER_CX = 268;

const Crack: React.FC<{at: number}> = ({at}) => {
  // 两道裂纹共享同一起点帧：主缝先长，支缝稍后（at+4 次级拍点）
  const main = useDraw(at, 14);
  const branch = useDraw(at + 4, 12);
  return (
    <g>
      <polyline
        points="-92,-34 -46,-12 -18,-30 8,-6 40,-22"
        fill="none"
        stroke={theme.danger}
        strokeWidth={2}
        {...main}
      />
      <polyline
        points="-18,-30 -10,10 -34,34"
        fill="none"
        stroke={theme.danger}
        strokeWidth={2}
        {...branch}
      />
    </g>
  );
};

export const VennShrink: React.FC<{
  /** 双圆入场帧 */
  at: number;
  /** 任务圆收缩（权限回收）帧 */
  shrinkAt: number;
  /** 工牌碎裂帧 */
  crackAt: number;
}> = ({at, shrinkAt, crackAt}) => {
  const enter = useEnter('pop', {at, dur: 24});
  const shrink = useSpring('settle', {at: shrinkAt, dur: 34});
  const crack = useProgress(crackAt, 22);
  // 任务圆右移 108px：重叠区从宽交叠收窄到月牙
  const taskCx = 404 + shrink * 108;
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <svg width={780} height={400} style={enter}>
        <defs>
          <clipPath id="vs-user-clip">
            <circle cx={USER_CX} cy={186} r={R} />
          </clipPath>
        </defs>
        {/* 交集高亮：用户圆裁任务圆的绿色副本——任务圆右移即自动收窄 */}
        <g clipPath="url(#vs-user-clip)">
          <circle cx={taskCx} cy={186} r={R} fill={withAlpha(theme.ok, 0.34)} />
        </g>
        <circle cx={USER_CX} cy={186} r={R} fill="none" stroke={theme.concept} strokeWidth={2.5} />
        <circle cx={taskCx} cy={186} r={R} fill="none" stroke={theme.conceptDeep} strokeWidth={2.5} />
        <text x={USER_CX - R - 8} y={64} textAnchor="end" fill={theme.concept} fontSize={22}>
          用户有的
        </text>
        <text x={taskCx + R + 8} y={64} textAnchor="start" fill={theme.conceptDeep} fontSize={22}>
          任务允许的
        </text>
        <text
          x={(USER_CX + taskCx) / 2}
          y={194}
          textAnchor="middle"
          fill={theme.ok}
          fontSize={24}
          fontWeight={700}
          opacity={1 - shrink * 0.9}
        >
          交集
        </text>
        <text x={330} y={372} textAnchor="middle" fill={theme.dim} fontSize={20}>
          缺一不可 · 只减不增 · 实时求值
        </text>
        {/* 旧工牌：裂纹 → 碎裂分离（红叉禁例） */}
        <g transform={`translate(560, 292)`}>
          <g transform={`rotate(${crack * 7})`} opacity={1 - crack * 0.25}>
            <rect x={-96} y={-36} width={192} height={72} rx={8} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={1.5} />
            <text x={0} y={-6} textAnchor="middle" fill={theme.dim} fontSize={17}>
              上次办的工牌
            </text>
            <text x={0} y={22} textAnchor="middle" fill={theme.text} fontSize={19}>
              TEMP-0412
            </text>
            <Crack at={crackAt} />
          </g>
          {crack > 0.4 ? (
            <text x={0} y={-50} textAnchor="middle" fill={theme.danger} fontSize={28} fontWeight={700}>
              ✕
            </text>
          ) : null}
          {/* 碎裂后两半分离的暗示块 */}
          <g opacity={Math.min(1, crack * 1.4)}>
            <rect x={-124 - crack * 12} y={-36} width={22} height={72} rx={4} fill={withAlpha(theme.panelBorder, 0.55)} transform={`rotate(${-crack * 10} -102 0)`} />
            <rect x={102 + crack * 12} y={-36} width={22} height={72} rx={4} fill={withAlpha(theme.panelBorder, 0.55)} transform={`rotate(${crack * 10} 102 0)`} />
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
