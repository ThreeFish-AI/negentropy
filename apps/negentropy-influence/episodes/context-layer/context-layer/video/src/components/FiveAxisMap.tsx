/** 五轴导航图〔Map-First 主锚〕——全片结构面的常驻坐标装置。
 *  五轴真名节点（资产 / 权威 / 装配 / 检索 / 沉淀）+ 各轴真实构件名标注
 *  （definitions 注册表 · Core Block / 执法点分层 · 权限上界 / 时序四档 · token 预算 /
 *  150→20 · RRF / 回路三件 · 人工裁决，与 research/component-glossary.md 同口径），
 *  节点间导航轨（行进箭头）+ 右上「已过 N/5」计数（passedCount，已过轴节点打 ✓）。
 *  built=false：建立面生长（P1 1-G 首建——节点自导航轨逐座升起）；
 *  built=true：常驻态（P2–P6 幕首重锚），highlight 轴自 at 起 1–1.5s 聚光
 *  （其余轴压暗后回松，聚光包络同 M-001 锚件的「主锚常驻可读」口径）。
 *  场景对位用 FIVE_AXIS_GEOM（节点画布绝对坐标，P1 拔轴消融叠放用）。 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {theme, withAlpha} from '../design/theme';
import {useBreathe, useProgress, useStagger} from '../motion';

export type FiveAxisKey = 'asset' | 'authority' | 'assembly' | 'retrieval' | 'consolidation';

const NODE_W = 300;
const NODE_H = 150;
const NODE_Y = 224;
const GAP = 44;
const X0 = Math.round((1920 - (5 * NODE_W + 4 * GAP)) / 2);
const RAIL_Y = NODE_Y + NODE_H / 2;

type AxisDef = {key: FiveAxisKey; name: string; parts: string; x: number};

const AXES: AxisDef[] = [
  {key: 'asset', name: '资产轴', parts: 'definitions 注册表 · Core Block · 纳管管线', x: X0},
  {key: 'authority', name: '权威轴', parts: '执法点分层 · 会话权限上界', x: X0 + NODE_W + GAP},
  {key: 'assembly', name: '装配轴', parts: '时序四档 · token 预算 · 缓存分段', x: X0 + 2 * (NODE_W + GAP)},
  {key: 'retrieval', name: '检索轴', parts: '150→20 · RRF · resolve 契约', x: X0 + 3 * (NODE_W + GAP)},
  {key: 'consolidation', name: '沉淀轴', parts: '回路三件 · 人工裁决', x: X0 + 4 * (NODE_W + GAP)},
];

/** 场景对位用几何（画布绝对坐标）：五轴节点与右上计数位。 */
export const FIVE_AXIS_GEOM = {
  nodes: AXES.map((a) => ({key: a.key, x: a.x})) as {key: FiveAxisKey; x: number}[],
  node: {y: NODE_Y, w: NODE_W, h: NODE_H},
  railY: RAIL_Y,
  counter: {right: X0, y: 158},
} as const;

export const FiveAxisMap: React.FC<{
  highlight?: FiveAxisKey | null;
  built?: boolean;
  passedCount?: number;
  at?: number;
}> = ({highlight = null, built = true, passedCount = 0, at = 0}) => {
  // built=false：建立面生长（节点逐座升起）；built=true（常驻/逐句重挂）：
  // -20 预锚让静态件 0 帧即满——避免逐句高亮镜间软闪（同 M-001 锚件口径）
  const rises = useStagger(5, {stride: built ? 2 : 7, at: built ? at - 100 : at});
  const frameIn = useProgress(built ? at - 20 : at, 8);
  const glow = useBreathe({period: 110, amp: 0.2, base: 0.8});
  // highlight 聚光包络：at 起 1.5s 内其余轴压暗到 ~0.45，之后回松到 ~0.72
  const focusIn = useProgress(at, 10);
  const relax = useProgress(at + 45, 24);
  const dimOthers = highlight ? 1 - 0.55 * focusIn * (1 - 0.55 * relax) : 1;
  const chrome = built ? frameIn : rises[0];
  const passed = Math.max(0, Math.min(5, Math.round(passedCount)));

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 标题 + 已过轴计数（导航图图签） */}
      <div
        style={{
          position: 'absolute',
          left: X0,
          top: 150,
          fontSize: 18,
          color: theme.dim,
          letterSpacing: 2,
          opacity: chrome,
        }}
      >
        结构面 · 五轴导航
      </div>
      <div
        style={{
          position: 'absolute',
          right: FIVE_AXIS_GEOM.counter.right,
          top: 148,
          fontFamily: theme.mono,
          fontSize: 17,
          color: theme.concept,
          border: `1.5px solid ${theme.concept}`,
          borderRadius: 7,
          padding: '3px 12px',
          background: theme.panel,
          opacity: chrome,
        }}
      >
        已过 {passed}/5
      </div>
      {/* 导航轨：节点间行进箭头（导航方向 资产→沉淀） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: chrome}}>
        {AXES.slice(0, -1).map((a, i) => {
          const x1 = a.x + NODE_W + 8;
          const x2 = AXES[i + 1].x - 8;
          const cx = (x1 + x2) / 2;
          return (
            <g key={a.key}>
              <line x1={x1} y1={RAIL_Y} x2={cx - 6} y2={RAIL_Y} stroke={theme.panelBorder} strokeWidth={2.5} />
              <path d={`M ${cx - 6} ${RAIL_Y - 7} L ${cx + 6} ${RAIL_Y} L ${cx - 6} ${RAIL_Y + 7} Z`} fill={theme.dim} />
              <line x1={cx + 6} y1={RAIL_Y} x2={x2} y2={RAIL_Y} stroke={theme.panelBorder} strokeWidth={2.5} />
            </g>
          );
        })}
      </svg>
      {AXES.map((ax, i) => {
        const hot = highlight === ax.key;
        const k = built ? 1 : rises[i];
        const dim = hot ? 1 : dimOthers;
        const isPassed = i < passed;
        return (
          <div
            key={ax.key}
            style={{
              position: 'absolute',
              left: ax.x,
              top: NODE_Y + (1 - k) * 44,
              width: NODE_W,
              height: NODE_H,
              borderRadius: 10,
              border: hot ? `2.5px solid ${theme.concept}` : `1.5px solid ${theme.panelBorder}`,
              background: hot ? withAlpha(theme.concept, 0.1) : theme.panel,
              boxShadow: hot ? `0 0 ${22 * glow}px ${withAlpha(theme.concept, 0.4)}` : 'none',
              opacity: k * dim,
              padding: '12px 16px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {isPassed ? (
                <span
                  style={{
                    fontSize: 13,
                    color: theme.ok,
                    border: `1.5px solid ${theme.ok}`,
                    borderRadius: 5,
                    padding: '0 6px',
                  }}
                >
                  ✓
                </span>
              ) : null}
            </div>
            <div style={{fontSize: 28, color: hot ? theme.concept : theme.text, marginTop: 2}}>{ax.name}</div>
            <div style={{fontSize: 13, color: theme.dim, marginTop: 8, lineHeight: 1.5}}>{ax.parts}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
