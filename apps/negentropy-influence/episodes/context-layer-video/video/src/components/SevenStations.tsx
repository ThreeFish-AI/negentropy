/** 读管线七段横轨（device 层公共件）：Resolve / Plan / Retrieve / Fuse / Guard /
 *  Compose / Emit 真名标签（与纳管/读管线两线命名 SSOT research/component-glossary.md
 *  同口径）；请求对象（钢蓝小方＝贯穿请求〔M-001〕的横轨化身）滑到当前段，此前段
 *  已完成（绿章 ✓），当前段在 at+38 落章（场景把 at 锚在「该段点名句」上）。
 *  Guard 段（⑤）带治理橙分流道进 dropped 盒（盒口「只进不改」——X-001：盒内记录
 *  只进不改，条目动画由场景叠加、几何用 SEVEN_STATIONS_GEOM.dropped 对位）。
 *  固定几何：条带占 left 70 / top 610 / 1780×290（底边 900，避让字幕安全带）。 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {theme, withAlpha} from '../design/theme';
import {clamp01, useDraw, useFlowDash, useSpring, useStagger} from '../motion';

export const SEVEN_LABELS = ['Resolve', 'Plan', 'Retrieve', 'Fuse', 'Guard', 'Compose', 'Emit'] as const;

/** 场景对位用几何（画布绝对坐标）：段盒中心、基线、dropped 盒。 */
export const SEVEN_STATIONS_GEOM = {
  left: 70,
  top: 610,
  boxW: 200,
  boxH: 106,
  boxY: 626,
  centers: [196, 448, 700, 952, 1204, 1456, 1708],
  baselineY: 798,
  dropped: {x: 1230, y: 824, w: 240, h: 58},
} as const;

const REQ_SIZE = 44;

export const SevenStations: React.FC<{at: number; station: 1 | 2 | 3 | 4 | 5 | 6 | 7}> = ({at, station}) => {
  const ins = useStagger(7, {stride: 3, at});
  const slide = useSpring('settle', {at: at + 10, dur: 24});
  const stamp = useSpring('snap', {at: at + 38, dur: 14});
  const branchDraw = useDraw(at + 16, 20);
  const branchFlow = useFlowDash({dash: 8, gap: 11, period: 26});
  const idx = station - 1;
  const fromX = station > 1 ? SEVEN_STATIONS_GEOM.centers[idx - 1] : SEVEN_STATIONS_GEOM.left - 60;
  const toX = SEVEN_STATIONS_GEOM.centers[idx];
  const cardX = fromX + (toX - fromX) * Math.min(slide, 1);
  const guardOn = station >= 5;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: SEVEN_STATIONS_GEOM.left, top: SEVEN_STATIONS_GEOM.top, width: 1780, height: 290}}>
        {/* Guard 橙色分流道：⑤盒底 → dropped 盒（station≥5 常驻；=5 时行进虚线活动） */}
        {guardOn ? (
          <svg width={1780} height={290} style={{position: 'absolute', inset: 0}}>
            <path
              d="M 1134 128 C 1134 176, 1150 196, 1206 222"
              fill="none"
              stroke={theme.conceptDeep}
              strokeWidth={3}
              {...branchDraw}
            />
            {station === 5 ? (
              <path
                d="M 1134 128 C 1134 176, 1150 196, 1206 222"
                fill="none"
                stroke={withAlpha(theme.conceptDeep, 0.7)}
                strokeWidth={3}
                {...branchFlow}
              />
            ) : null}
          </svg>
        ) : null}
        {SEVEN_LABELS.map((name, i) => {
          const done = i < idx;
          const active = i === idx;
          const k = ins[i];
          const guard = i === 4;
          return (
            <div
              key={name}
              style={{
                position: 'absolute',
                left: 26 + i * 252,
                top: 16,
                width: SEVEN_STATIONS_GEOM.boxW,
                height: SEVEN_STATIONS_GEOM.boxH,
                borderRadius: 10,
                border: active
                  ? `2.5px solid ${guard ? theme.conceptDeep : theme.concept}`
                  : `1.5px solid ${theme.panelBorder}`,
                background: active
                  ? withAlpha(guard ? theme.conceptDeep : theme.concept, 0.1)
                  : theme.panel,
                opacity: (done || active ? 1 : 0.55) * k,
                transform: `translateY(${(1 - k) * 12}px)`,
                padding: '10px 14px',
                boxSizing: 'border-box',
              }}
            >
              <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 21,
                  marginTop: 4,
                  color: active ? (guard ? theme.conceptDeep : theme.concept) : theme.text,
                }}
              >
                {name}
              </div>
              {/* 已完成章：绿 ✓ 印（稳态）；当前段章在 stamp 弹窗内落下 */}
              <div style={{position: 'absolute', right: 10, top: 10}}>
                {done ? (
                  <StampGlyph s={1} o={1} />
                ) : active ? (
                  <StampGlyph s={Math.max(0, stamp)} o={clamp01(stamp)} />
                ) : null}
              </div>
            </div>
          );
        })}
        {/* 请求对象：钢蓝小方（贯穿请求〔M-001〕的横轨化身），滑到当前段 */}
        <div
          style={{
            position: 'absolute',
            left: cardX - REQ_SIZE / 2,
            top: 188 - REQ_SIZE - 6,
            width: REQ_SIZE,
            height: REQ_SIZE,
            borderRadius: 8,
            border: `2px solid ${theme.concept}`,
            background: withAlpha(theme.concept, 0.14),
          }}
        />
        {/* dropped 盒：只进不改 */}
        {guardOn ? (
          <div
            style={{
              position: 'absolute',
              left: 1160,
              top: 214,
              width: 240,
              height: 58,
              borderRadius: 8,
              border: `2px dashed ${theme.conceptDeep}`,
              background: withAlpha(theme.conceptDeep, 0.08),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              opacity: ins[4],
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.conceptDeep}}>dropped</span>
            <span style={{fontSize: 15, color: theme.dim}}>· 只进不改</span>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** 章印：旋转绿章（数据本体语义——钳 seat=1 不过冲，snap 的过冲只吃缩放的出生感）。 */
const StampGlyph: React.FC<{s: number; o: number}> = ({s, o}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 34,
      height: 34,
      borderRadius: 8,
      border: `2.5px solid ${theme.ok}`,
      color: theme.ok,
      fontSize: 18,
      transform: `rotate(-8deg) scale(${s})`,
      opacity: o,
      background: withAlpha(theme.ok, 0.12),
    }}
  >
    ✓
  </span>
);
