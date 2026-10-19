/** 窗口 token 预算条（P4·4-A 建立；4-H 与 InvertedU 倒 U 联动；P7 Compose 可复用）。
 *
 *  三件套：满宽刻度轨道 + 过半预算线（虚线 + 「过半效果降」签）+ 四档位格
 *  （常驻/渐进披露/按需加载/仅引用，各挂机会成本小字）。
 *  fillAt：主填充自零位涨到预算线（钢蓝）——「按计划预算装窗」的复用形态；
 *  overfillAt：越过预算线的橙区续填——倒 U「填充过半效果常常不升反降」的联动形态。
 *  未传入 fill/overfill 时对应通道恒零（锚到远未来帧，spring/progress 自然钳 0）。
 *  装置为自绘 DOM（非 archify 回放）；全部时点由调用方以句边界推导（禁写死帧数）。
 */
import React from 'react';
import {theme, withAlpha} from '../design/theme';
import {useProgress, useSpring, useStagger} from '../motion';

/** 关闭态锚：远未来帧 ⇒ 进度恒 0（hooks 不可条件调用，用锚值代替开关）。 */
const OFF = 1e12;

/** 四档位与机会成本小字（宽度按进窗成本占比示意，非精确刻度）。 */
const TIERS: ReadonlyArray<{label: string; cost: string; w: number}> = [
  {label: '常驻', cost: '每轮都在 · 持续占用', w: 0.3},
  {label: '渐进披露', cost: '目录占位 · 展开才计', w: 0.26},
  {label: '按需加载', cost: '用时入窗 · 一次成本', w: 0.26},
  {label: '仅引用', cost: '只留地址 · 近零成本', w: 0.18},
];

const BUDGET = 0.5;
const OVER_CAP = 0.86;

export const TokenBudget: React.FC<{
  /** 轨道入场（描画+刻度落位）帧 */
  at?: number;
  /** 档位格依次点亮帧；缺省随入场错峰点亮 */
  tiersAt?: number;
  /** 主填充帧：自零位涨到预算线（钢蓝） */
  fillAt?: number;
  /** 越线续填帧：预算线 → OVER_CAP 橙区（倒 U 联动） */
  overfillAt?: number;
  /** 预算线点亮帧；缺省随入场 */
  budgetLineAt?: number;
  /** 顶部角标文案 */
  caption?: string;
  /** 轨道宽（缺省 1400） */
  width?: number;
}> = ({
  at = 0,
  tiersAt,
  fillAt,
  overfillAt,
  budgetLineAt,
  caption = 'token＝模型按字数计的计量单位 · 进窗每个都有机会成本',
  width = 1400,
}) => {
  const frame = useSpring('settle', {at, dur: 20});
  const tiers = useStagger(TIERS.length, {stride: 8, at: tiersAt ?? at + 10, dur: 6});
  const line = useProgress(budgetLineAt ?? at + 16, 10);
  // 填充是几何量：空间通道吃弹簧；越线段是持续态，走时长+缓动
  const fill = useSpring('settle', {at: fillAt ?? OFF, dur: 40});
  const over = useProgress(overfillAt ?? OFF, 34);
  const fillW = Math.min(1, Math.max(0, fill)) * BUDGET * 100;
  const overW = (Math.min(OVER_CAP, BUDGET + Math.max(0, over) * (OVER_CAP - BUDGET)) - BUDGET) * 100;

  return (
    <div
      style={{
        width,
        opacity: frame,
        transform: `translateY(${(1 - frame) * 18}px)`,
      }}
    >
      <div style={{fontSize: 19, color: theme.dim, marginBottom: 12, fontFamily: theme.mono}}>
        {caption}
      </div>
      {/* 刻度轨道 */}
      <div
        style={{
          position: 'relative',
          height: 58,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 10,
          background: theme.panel,
          overflow: 'hidden',
        }}
      >
        {Array.from({length: 9}, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${(i + 1) * 10}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: withAlpha(theme.panelBorder, 0.9),
            }}
          />
        ))}
        {/* 预算线内主填充（钢蓝） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${fillW}%`,
            background: withAlpha(theme.concept, 0.55),
          }}
        />
        {/* 越线续填（橙区） */}
        <div
          style={{
            position: 'absolute',
            left: `${BUDGET * 100}%`,
            top: 0,
            bottom: 0,
            width: `${overW}%`,
            background: withAlpha(theme.conceptDeep, 0.5),
          }}
        />
        {/* 过半预算线 */}
        <div
          style={{
            position: 'absolute',
            left: `${BUDGET * 100}%`,
            top: 0,
            bottom: 0,
            borderLeft: `2.5px dashed ${line > 0.05 ? theme.conceptDeep : theme.panelBorder}`,
            opacity: 0.35 + 0.65 * line,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `calc(${BUDGET * 100}% + 10px)`,
            top: 6,
            fontSize: 15,
            fontFamily: theme.mono,
            color: theme.conceptDeep,
            opacity: line,
          }}
        >
          预算线 · 过半效果降
        </div>
      </div>
      {/* 档位格：机会成本小字 */}
      <div style={{display: 'flex', marginTop: 12}}>
        {TIERS.map((t, i) => (
          <div
            key={t.label}
            style={{width: `${t.w * 100}%`, opacity: tiers[i], borderLeft: `2px solid ${theme.concept}`, paddingLeft: 12}}
          >
            <div style={{fontSize: 22, color: theme.text}}>{t.label}</div>
            <div style={{fontSize: 16, color: theme.dim, fontFamily: theme.mono, marginTop: 3}}>{t.cost}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
