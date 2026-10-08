/** 本集创作性装置（复制适配口径：不进模板、不跨集 import）。
 *
 *  五件共享装置：CatalogCard（目录索引卡〔M-001〕恒定母题）/ GoldenCard（衬线金句卡）/
 *  AblationPanel（左右消融框，红绿契约色）/ BalanceBars（基线锚定双柱标尺）/
 *  WalkTerm（终端走查打字机）。运动一律走 src/motion 词汇；色只经 accent prop
 *  或 theme 概念色注入。
 */
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {DUR, progress, useBreathe} from '../motion';

/** 居中舞台：全幕内容的唯一落位容器——垂直水平居中、顶部章节条（y<56）与
 *  底部字幕带（药丸底缘 y≈1026）双避让。所有流式装置必须经它落位，防塌顶。 */
export const Stage: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      paddingTop: 40,
      paddingBottom: 150,
    }}
  >
    {children}
  </div>
);

/** 〔M-001〕目录索引卡：全片恒定视觉锚——金描边、圆角卡，卡面恒两行
 *  （name 行 + description 行），跨幕同形出场只换周边标签。 */
export const CatalogCard: React.FC<{
  enter?: {opacity: number; transform: string};
  breathe?: boolean;
  nameText?: string;
  descText?: string;
  nameDim?: boolean;
  scale?: number;
  width?: number;
}> = ({
  enter = {opacity: 1, transform: 'none'},
  breathe = false,
  nameText = 'pdf-report',
  descText = '解析复杂财务报表与资产负债表',
  nameDim = false,
  scale = 1,
  width = 560,
}) => {
  const glow = useBreathe({period: 90, amp: 0.18, base: 0.82});
  const line = breathe ? Math.min(1, glow + 0.18) : 1;
  return (
    <div
      style={{
        width: width * scale,
        opacity: enter.opacity,
        transform: `${enter.transform} scale(${scale})`,
        background: theme.panel,
        border: `${2 * line}px solid ${theme.ledger}`,
        borderRadius: 14,
        padding: '26px 30px',
        boxShadow: `0 0 ${breathe ? 26 : 0}px ${theme.ledger}33`,
      }}
    >
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: 24,
          color: nameDim ? theme.dim : theme.ledger,
          marginBottom: 12,
        }}
      >
        {nameText}
      </div>
      <div style={{fontSize: 19, color: theme.text, opacity: 0.92}}>{descText}</div>
    </div>
  );
};

/** 衬线金句卡：左上/对角金句位，衬线体 + 概念色描边；文字为关键词形态（≤12 字），
 *  禁逐字复述口播（RSI-007 由 check_script 执法）。 */
export const GoldenCard: React.FC<{
  lines: string[];
  color?: string;
  enter?: {opacity: number; transform: string};
  width?: number;
}> = ({lines, color = theme.ledger, enter = {opacity: 1, transform: 'none'}, width = 430}) => (
  <div
    style={{
      width,
      opacity: enter.opacity,
      transform: enter.transform,
      border: `1.5px solid ${color}66`,
      borderLeft: `4px solid ${color}`,
      borderRadius: 10,
      background: theme.panel,
      padding: '20px 26px',
    }}
  >
    {lines.map((l, i) => (
      <div
        key={i}
        style={{
          fontFamily: theme.serif,
          fontSize: i === 0 ? 27 : 21,
          fontWeight: 600,
          color: i === 0 ? color : theme.text,
          lineHeight: 1.45,
        }}
      >
        {l}
      </div>
    ))}
  </div>
);

/** 左右消融框（Counterfactual Ablation Contrast）：左红＝拆掉后/退化侧，
 *  右绿＝机制在位/拦截侧；标题条 + 内容插槽。 */
export const AblationPanel: React.FC<{
  leftTitle: string;
  rightTitle: string;
  children: React.ReactNode[];
  width?: number;
  height?: number;
}> = ({leftTitle, rightTitle, children, width = 780, height = 420}) => {
  const half = {width: width / 2 - 14, height, borderRadius: 12, padding: '18px 20px'};
  return (
    <div style={{display: 'flex', gap: 28}}>
      <div style={{...half, background: theme.panel, border: `1.5px solid ${theme.danger}55`}}>
        <div style={{fontSize: 15, color: theme.danger, letterSpacing: 2, marginBottom: 12}}>
          ✗ {leftTitle}
        </div>
        {children[0]}
      </div>
      <div style={{...half, background: theme.panel, border: `1.5px solid ${theme.ok}55`}}>
        <div style={{fontSize: 15, color: theme.ok, letterSpacing: 2, marginBottom: 12}}>
          ✓ {rightTitle}
        </div>
        {children[1]}
      </div>
    </div>
  );
};

/** 基线锚定双柱标尺（Baseline-Anchored Bar）：左灰柱 vs 右金柱竞速爬升，
 *  底部基线虚线恒常驻；数值由调用方 useCount 驱动传入。 */
export const BalanceBars: React.FC<{
  leftValue: number;
  rightValue: number;
  leftMax: number;
  leftLabel: string;
  rightLabel: string;
  multiplier?: number;
  multiplierVisible?: boolean;
  baseY?: number;
}> = ({
  leftValue,
  rightValue,
  leftMax,
  leftLabel,
  rightLabel,
  multiplier,
  multiplierVisible = false,
  baseY = 300,
}) => {
  const barW = 200;
  const lh = Math.max(8, (leftValue / leftMax) * baseY);
  const rh = Math.max(8, (rightValue / leftMax) * baseY);
  const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'flex-end', gap: 150, height: baseY + 90}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
          <div style={{fontFamily: theme.mono, fontSize: 34, color: theme.dim}}>{fmt(leftValue)}</div>
          <div
            style={{
              width: barW,
              height: lh,
              background: `${theme.dim}44`,
              borderRadius: '8px 8px 0 0',
            }}
          />
          <div style={{fontSize: 16, color: theme.dim}}>{leftLabel}</div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
          {multiplierVisible ? (
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 40,
                fontWeight: 700,
                color: theme.ledger,
              }}
            >
              {multiplier}×
            </div>
          ) : (
            <div style={{height: 48}} />
          )}
          <div
            style={{
              width: barW,
              height: rh,
              background: theme.ledger,
              borderRadius: '8px 8px 0 0',
            }}
          />
          <div style={{fontSize: 16, color: theme.ledger}}>{rightLabel}</div>
        </div>
      </div>
      <div
        style={{
          width: barW * 2 + 150 + 60,
          borderTop: `1.5px dashed ${theme.panelBorder}`,
          marginTop: 2,
        }}
      />
    </div>
  );
};

/** 终端走查（Animated Worked Example 骨架）：标题条 + 逐行打字机；
 *  每行 reveal 进度由调用方传 at（相对本镜帧）。 */
export const WalkTerm: React.FC<{
  rows: {text: string; at: number; color?: string}[];
  width?: number;
}> = ({rows, width = 760}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        width,
        background: '#0B0E13',
        border: `1.5px solid ${theme.panelBorder}`,
        borderRadius: 12,
        padding: '0 0 20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.panelBorder}`,
        }}
      >
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
          <div key={c} style={{width: 12, height: 12, borderRadius: 6, background: c}} />
        ))}
        <div style={{marginLeft: 10, fontSize: 13, color: theme.dim, fontFamily: theme.mono}}>
          terminal — skill setup
        </div>
      </div>
      <div style={{padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10}}>
        {rows.map((r, i) => (
          <TermRow key={i} text={r.text} at={r.at} color={r.color ?? theme.text} frame={frame} />
        ))}
      </div>
    </div>
  );
};

const TermRow: React.FC<{text: string; at: number; color: string; frame: number}> = ({
  text,
  at,
  color,
  frame,
}) => {
  const p = progress(frame, at, DUR.f5);
  const n = Math.round(p * text.length);
  return (
    <div style={{fontFamily: theme.mono, fontSize: 17, color, minHeight: 24}}>
      {text.slice(0, n)}
      {p > 0 && p < 1 ? <span style={{opacity: 0.6}}>|</span> : null}
    </div>
  );
};
