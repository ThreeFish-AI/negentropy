/** 纳管管线五段横轨（device 层公共件）：Ingest 登记 / Normalize 归一 / Classify 分类 /
 *  Tier 分级 / Tag·Index 打标索引（真名标签 + 中文作用角签，与纳管/读管线两线命名
 *  SSOT research/component-glossary.md 同口径）。station 前的段已完成态（绿章 ✓），
 *  当前段活动中（钢蓝描边 + 呼吸辉光 + 作用角签），资产对象（如「重复购买率」指标
 *  说明文档）沿传送线滑到当前段停下。
 *  固定几何：条带占 left 210 / top 148 / 1500×200，场景细节装置放 y ≥ 380 区。
 *  at = 所在镜内「第 N 段」句的局部帧（段错峰入场 + 对象行进都由它推导）。 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {theme, withAlpha} from '../design/theme';
import {useBreathe, useFlowDash, useSpring, useStagger, clamp01, progress} from '../motion';

const STATIONS = ['Ingest', 'Normalize', 'Classify', 'Tier', 'Tag·Index'] as const;
const TAGS = ['登记', '归一', '分类', '分级', '打标索引'] as const;

/** 条带内相对几何：段盒 264×106，五盒等距；传送基线 y=168。 */
const BOX = {w: 264, h: 106, y: 24, stride: 306, x0: 30} as const;
const BASELINE_Y = 168;
const boxX = (i: number) => BOX.x0 + i * BOX.stride;
const boxCx = (i: number) => boxX(i) + BOX.w / 2;

export const IntakeLine: React.FC<{station: 1 | 2 | 3 | 4 | 5; at: number}> = ({station, at}) => {
  const ins = useStagger(5, {stride: 4, at});
  const move = useSpring('settle', {at: at + 8, dur: 30});
  const frame = useCurrentFrame();
  const flow = useFlowDash({dash: 9, gap: 13, period: 34});
  const glow = useBreathe({period: 90, amp: 0.18, base: 0.82});
  // 资产对象卡：自条带左外滑到当前段中心（局部帧弹簧，钳行程防过冲穿出段盒）
  const target = boxCx(station - 1);
  const tokenX = -56 + (target + 56) * Math.min(move, 1);
  const arrived = clamp01(progress(frame, at + 34, 8));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 210, top: 148, width: 1500, height: 200}}>
        {/* 传送基线：行进虚线表达管线行进感（匀速 dash 合法形态） */}
        <svg width={1500} height={200} style={{position: 'absolute', inset: 0}}>
          <line x1={16} y1={BASELINE_Y} x2={boxX(station - 1) + BOX.w / 2} y2={BASELINE_Y}
            stroke={theme.panelBorder} strokeWidth={3} opacity={0.9} />
          <line x1={16} y1={BASELINE_Y} x2={boxX(station - 1) + BOX.w / 2} y2={BASELINE_Y}
            stroke={theme.concept} strokeWidth={3} opacity={0.5} {...flow} />
        </svg>
        {STATIONS.map((name, i) => {
          const done = i + 1 < station;
          const active = i + 1 === station;
          const k = ins[i];
          return (
            <div
              key={name}
              style={{
                position: 'absolute',
                left: boxX(i),
                top: BOX.y,
                width: BOX.w,
                height: BOX.h,
                borderRadius: 10,
                border: active
                  ? `2.5px solid ${theme.concept}`
                  : `1.5px solid ${theme.panelBorder}`,
                background: active ? withAlpha(theme.concept, 0.1) : theme.panel,
                opacity: (done || active ? 1 : 0.55) * k,
                transform: `translateY(${(1 - k) * 14}px)`,
                boxShadow: active ? `0 0 ${18 * glow}px ${withAlpha(theme.concept, 0.35)}` : 'none',
                padding: '12px 16px',
                boxSizing: 'border-box',
              }}
            >
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
                <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {done ? (
                  <span style={{fontSize: 17, color: theme.ok, border: `1.5px solid ${theme.ok}`, borderRadius: 6, padding: '0 8px'}}>
                    ✓
                  </span>
                ) : null}
              </div>
              <div style={{fontSize: 23, color: active ? theme.concept : theme.text, marginTop: 6}}>{name}</div>
              <div style={{marginTop: 6, height: 24}}>
                {active ? (
                  <span style={{fontSize: 16, color: theme.concept, border: `1.5px solid ${theme.concept}`, borderRadius: 6, padding: '2px 10px', opacity: arrived}}>
                    {TAGS[i]}
                  </span>
                ) : done ? (
                  <span style={{fontSize: 15, color: theme.dim, opacity: 0.8}}>{TAGS[i]} ✓</span>
                ) : null}
              </div>
            </div>
          );
        })}
        {/* 资产对象卡（受治理对象 · 钢蓝主色） */}
        <div
          style={{
            position: 'absolute',
            left: tokenX - 20,
            top: BASELINE_Y - 34,
            width: 40,
            height: 32,
            borderRadius: 5,
            border: `2px solid ${theme.concept}`,
            background: withAlpha(theme.concept, 0.16),
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
