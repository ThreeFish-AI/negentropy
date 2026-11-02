/** 贯穿请求卡〔M-001 恒定视觉锚〕：钢蓝描边 2px（与目录条目卡同形同线宽）+
 *  圆角 10 + 标题位，全片多次同形出场、只换周边标签。
 *  默认卡形态：问题标题「上季度 · 华东区 · 重复购买率」+ 提问人 运营专员；
 *  mode='request'：同一主体变形为 ContextRequest JSON 形态（question/asker 字段）——
 *  描边色、圆角、标题位全程不变（身份线索），Morph 连续转场三态可抽检：
 *  卡（H196）→ 收拢窄条（H74）→ JSON 展开（H252）。
 *  passed：卡缘累积「已经过的组件」小签（逐幕由场景传入累积数组）；
 *  stage：标题行当前所处组件段签（如 Resolve）。
 *  at 为所在镜内局部帧；缺省恒稳态（Morph 仅在给 at 且 mode='request' 时播放）。 */
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {theme, withAlpha} from '../design/theme';
import {clamp01, progress, useSpring, useStagger} from '../motion';

const W = 760;
const H_CARD = 196;
const H_STRIP = 74;
const H_REQ = 252;

const QUESTION = '上季度 · 华东区 · 重复购买率';

export const RequestCard: React.FC<{
  at?: number;
  stage?: string;
  passed?: readonly string[];
  mode?: 'card' | 'request';
}> = ({at, stage, passed = [], mode = 'card'}) => {
  const frame = useCurrentFrame();
  const pre = at ?? -1000;
  const morphing = mode === 'request' && at !== undefined;
  // Morph 几何走弹簧（spatial 通道）；文本/透明度走 progress（effects 通道，铁律③）
  const collapse = useSpring('settle', {at: morphing ? pre : -1000, dur: 12});
  const expand = useSpring('settle', {at: morphing ? pre + 12 : -1000, dur: 20});
  const cardBodyO = morphing ? 1 - clamp01(progress(frame, pre, 10)) : 1;
  const jsonO = morphing ? clamp01(progress(frame, pre + 14, 14)) : 0;
  const hNow = morphing
    ? H_STRIP + (H_CARD - H_STRIP) * (1 - collapse) + (H_REQ - H_STRIP) * expand
    : H_CARD;
  // 卡缘「已经过的组件」小签：随挂载错峰入场（缺省锚远负 → 恒稳态）
  const chips = useStagger(passed.length, {stride: 4, at: morphing ? pre + 30 : pre});

  return (
    <div
      style={{
        position: 'relative',
        width: W,
        height: hNow,
        overflow: 'hidden',
        border: `2px solid ${theme.concept}`,
        borderRadius: 10,
        background: theme.panel,
        boxSizing: 'border-box',
        flex: 'none',
      }}
    >
      {/* 标题行（标题位全片不变：mono 段签 + 问题标题 + 提问人） */}
      <div style={{position: 'absolute', left: 18, right: 18, top: 14, display: 'flex', alignItems: 'center', gap: 10}}>
        <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.concept, letterSpacing: 1}}>
          {mode === 'request' ? 'ContextRequest' : 'REQUEST'}
        </span>
        {stage ? (
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 13,
              color: theme.concept,
              border: `1.5px solid ${theme.concept}`,
              borderRadius: 5,
              padding: '1px 8px',
              opacity: jsonO > 0.3 || mode === 'card' ? 1 : cardBodyO,
            }}
          >
            {stage}
          </span>
        ) : null}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 15,
            color: theme.dim,
            border: `1.5px solid ${theme.panelBorder}`,
            borderRadius: 5,
            padding: '1px 10px',
          }}
        >
          提问人 · 运营专员
        </span>
      </div>
      {/* 问题标题（Morph 全程不变的正文） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 56,
          textAlign: 'center',
          fontSize: 32,
          color: theme.text,
          letterSpacing: 1,
        }}
      >
        {QUESTION}
      </div>
      {/* JSON 形态字段（request 档）：question / asker */}
      <div
        style={{
          position: 'absolute',
          left: 26,
          top: 110,
          fontFamily: theme.mono,
          fontSize: 16,
          lineHeight: 1.75,
          color: theme.dim,
          opacity: jsonO,
          whiteSpace: 'pre',
        }}
      >
        <div>{'{'}</div>
        <div>
          {'  '}
          <span style={{color: theme.concept}}>{'"question"'}</span>
          {': '}
          <span style={{color: theme.text}}>{'"上季度华东区的重复购买率是多少？"'}</span>
          {','}
        </div>
        <div>
          {'  '}
          <span style={{color: theme.concept}}>{'"asker"'}</span>
          {': '}
          <span style={{color: theme.text}}>{'"运营专员"'}</span>
        </div>
        <div>{'}'}</div>
      </div>
      {/* 卡缘「已经过的组件」小签（逐幕累积） */}
      <div
        style={{
          position: 'absolute',
          left: 18,
          right: 18,
          top: (mode === 'request' ? H_REQ : H_CARD) - 46,
          display: 'flex',
          gap: 8,
          overflow: 'hidden',
          opacity: mode === 'request' ? Math.max(cardBodyO, jsonO) : 1,
        }}
      >
        {passed.map((p, i) => (
          <span
            key={p}
            style={{
              fontFamily: theme.mono,
              fontSize: 13,
              color: theme.concept,
              border: `1.5px solid ${withAlpha(theme.concept, 0.7)}`,
              borderRadius: 5,
              padding: '2px 8px',
              background: withAlpha(theme.bg, 0.6),
              opacity: chips[i] ?? 0,
              flex: 'none',
            }}
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
};
