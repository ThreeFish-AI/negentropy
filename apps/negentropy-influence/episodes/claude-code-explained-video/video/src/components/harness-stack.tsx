/** 系列身份装置：五层 Harness 栈——skills/06「系列身份视觉」规格的落地。
 *
 * 层序/层名/发布态/下集标题一律取 series-layers.json（build_narration 从
 * series.json 派生——硬编码即漂移，规格原话）。注意 P6 下期卡内的**标题主段**
 * 仍是硬编码字符串：check_series 规则 8 以 tsx 文本对账 series.json，数据化会
 * 让那条门失明（两层口径：层短名走数据，标题主段走规则 8 的受检硬编码）。
 *
 * 两个组件：
 *  - HarnessStackP0：开场编排（落板 → 本集层高亮呼吸 → 缩退淡出，末段交叉淡入常驻条）；
 *  - HarnessBadge：P1–P6 的常驻顶边条（横向五 chip，y 12–48）。
 *
 * ⚠️ 形式对规格的一处适配（评审实测）：规格写「缩退左上角纵向角标（宽 ≤300）」，
 * 但纵向角标（300×194）与既有各幕左上内容五处碰撞（P2 CornerRing 同坐标、P3 小抄、
 * P5 标尺、P1 1-E 环、P6 标签）；全片唯一零碰撞的常驻区是**顶边 y<50 横条**——
 * 所有幕的左上内容最早从 y=56 起。故常驻形式取顶边横条（紧贴上缘，不占字幕安全带
 * 也不与 SceneTag 相干）。缩退以交叉淡出衔接，避免纵向→横向的形态跳变。
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {theme} from '../design/theme';
import {DUR, useBreathe, useDim, useProgress, useStagger} from '../motion';
import series from '../series-layers.json';

export type Layer = {index: number; layer: string; title: string; published: boolean};

export const LAYERS = series.layers as Layer[];
export const ACTIVE_INDEX = series.activeIndex as number;
export const NEXT_LAYER = LAYERS[ACTIVE_INDEX] ?? null; // P6 呼吸预告的层

/** 单块层板。mode: full（开场全尺寸）/ chip（常驻顶边条）/ p6（收尾放大）。 */
const Plate: React.FC<{
  layer: Layer;
  active: boolean;
  dim: number;
  glow?: number;
  scale: 'full' | 'chip' | 'p6';
}> = ({layer, active, dim, glow = 0, scale}) => {
  const chip = scale === 'chip';
  const h = chip ? 34 : scale === 'p6' ? 56 : 64;
  const nameSize = chip ? 17 : scale === 'p6' ? 26 : 28;
  const idSize = chip ? 12 : 17;
  return (
    <div
      style={{
        height: h,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: chip ? 8 : 14,
        padding: chip ? '0 12px' : '0 18px',
        background: theme.panel,
        border: `2px solid ${active ? theme.core : theme.panelBorder}`,
        borderRadius: chip ? 8 : 12,
        opacity: dim,
        boxShadow: active
          ? `0 0 ${10 + glow * 22}px ${theme.core}55, inset 0 0 ${glow * 10}px ${theme.core}22`
          : undefined,
      }}
    >
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: idSize,
          color: active ? theme.core : theme.dim,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {String(layer.index).padStart(2, '0')}
      </div>
      <div
        style={{
          fontFamily: theme.sans,
          fontSize: nameSize,
          fontWeight: active ? 600 : 400,
          color: active ? theme.text : theme.dim,
          letterSpacing: 2,
        }}
      >
        {layer.layer}
      </div>
    </div>
  );
};

/** 常驻顶边条：P1–P6（横向五 chip，y 12–48——见文件头形式适配说明）。 */
export const HarnessBadge: React.FC<{style?: React.CSSProperties}> = ({style}) => (
  <div
    style={{
      position: 'absolute',
      left: 64,
      top: 12,
      display: 'flex',
      flexDirection: 'row',
      gap: 8,
      ...style,
    }}
  >
    {LAYERS.map((l) => (
      <Plate key={l.index} layer={l} active={l.index === ACTIVE_INDEX} dim={l.index === ACTIVE_INDEX ? 1 : 0.55} scale="chip" />
    ))}
  </div>
);

/** P0 开场编排：自底向上落板（6 帧一层）→ 本集层高亮呼吸两次 → 其余压暗 55% →
 *  缩退淡出（向左上收小；末 8 帧与常驻顶边条交叉淡入——衔接 P1 起的 HarnessBadge）。 */
export const HarnessStackP0: React.FC<{recedeAt: number}> = ({recedeAt}) => {
  const drops = useStagger(LAYERS.length, {at: 2, dur: DUR.f4, stride: 6, easing: 'decelerate'});
  const hiAt = 2 + (LAYERS.length - 1) * 6 + DUR.f4 + 2;
  const glowBreathe = useBreathe({period: 15, amp: 0.5, base: 0.5});
  // 呼吸两次（30f）后收敛到 0.7 的持续高亮
  const breathePhase = useProgress(hiAt + 30, DUR.f6);
  const glow = 0.5 + 0.5 * glowBreathe * (1 - breathePhase) + breathePhase * 0.7;
  const dim = useDim({at: hiAt, to: 0.55, dur: DUR.f5});
  const rec = useProgress(recedeAt, DUR.f6);
  // 缩退：向左上收小 + 尾段淡出；常驻条同步交叉淡入（换形式不跳变）
  const crossAt = recedeAt + DUR.f6 - 8;
  const out = useProgress(crossAt, 8);
  const fullX = 730;
  const fullY = 300;
  const tx = fullX + (64 - fullX) * rec;
  const ty = fullY + (12 - fullY) * rec;
  const s = 1 - 0.55 * rec;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <HarnessBadge style={{opacity: out}} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 460,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          transform: `translate(${tx}px, ${ty}px) scale(${s})`,
          transformOrigin: '0 0',
          opacity: 1 - out,
        }}
      >
        {LAYERS.slice()
          .reverse()
          .map((l) => {
            // 自底向上落板：index 1（执行层，最底）最先动
            const p = drops[l.index - 1];
            const isHi = l.index === ACTIVE_INDEX;
            return (
              <div
                key={l.index}
                style={{
                  opacity: p,
                  transform: `translateY(${(1 - p) * 26}px)`,
                }}
              >
                <Plate
                  layer={l}
                  active={isHi}
                  dim={isHi ? 1 : dim}
                  glow={isHi ? glow : 0}
                  scale="full"
                />
              </div>
            );
          })}
      </div>
    </AbsoluteFill>
  );
};

/** P6 收尾：栈重新放大居中；已发布层保持点亮（EP1 时即本集层）；下期层呼吸预告。 */
export const HarnessStackP6: React.FC<{at: number; nextBreathAt: number}> = ({at, nextBreathAt}) => {
  const enter = useStagger(LAYERS.length, {at, dur: DUR.f4, stride: 4, easing: 'decelerate'});
  const breath = useBreathe({period: 40, amp: 0.5, base: 0.5});
  const nextOn = useProgress(nextBreathAt, DUR.f5);
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 8, width: 420}}>
      {LAYERS.slice()
        .reverse()
        .map((l) => {
          const p = enter[l.index - 1];
          const isNext = NEXT_LAYER !== null && l.index === NEXT_LAYER.index;
          const lit = l.published || l.index === ACTIVE_INDEX;
          const glow = isNext ? nextOn * breath : 0;
          return (
            <div key={l.index} style={{opacity: p, transform: `translateY(${(1 - p) * 18}px)`}}>
              <Plate
                layer={l}
                active={lit || (isNext && nextOn > 0.5)}
                dim={lit || (isNext && nextOn > 0.5) ? 1 : 0.55}
                glow={glow}
                scale="p6"
              />
            </div>
          );
        })}
    </div>
  );
};
