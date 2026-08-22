/** P6 落点与信源（分镜 6-A…6-C）
 *  三种开始三段位置图（位置编码，不用三色）+ 共享小环匀速贯穿 → 一句话合同金句卡
 *  → 信源卡 + 身份卡 + 渐黑（末 beat 总时长推导，skills/06 红线四）。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, SceneTag, useRingDot} from '../components/motifs';

/** 三段位置图的一段：人（或表）与环的位置关系——「谁按的开始」用位置编码 */
const StartPanel: React.FC<{
  mode: 'onRing' | 'offRing' | 'noOne';
  title: string;
  sub: string;
  active: boolean;
}> = ({mode, title, sub, active}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dot = useRingDot(2.5);
  // 右上角共享小环：匀速转（贯穿三段，回收题眼）
  const cx = 130;
  const cy = 120;
  const r = 74;
  const rad = ((-90 + dot * 360) * Math.PI) / 180;
  const stroke = active ? theme.core : theme.panelBorder;
  return (
    <Panel accent={active ? theme.panelBorder : theme.panelBorder} style={{width: 420, padding: '20px 22px', opacity: active ? 1 : 0.42}}>
      <div style={{position: 'relative'}}>
        <svg width={260} height={250} style={{overflow: 'visible'}}>
          {/* 小环：右上角恒转 */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={5} />
          <circle cx={cx + r * Math.cos(rad)} cy={cy + r * Math.sin(rad)} r={9} fill={stroke} />
          {/* 位置主体（左下区） */}
          {mode === 'onRing' ? (
            <g opacity={active ? 1 : 0.6}>
              {/* 人站在环上（跟着转的人在等） */}
              <g transform={`translate(${cx + r * Math.cos(rad)} ${cy + r * Math.sin(rad)}) rotate(${dot * 360 + 90})`}>
                <circle cx={0} cy={-40} r={13} fill={theme.text} />
                <path d="M0 -26 v34 M0 -16 l-15 12 M0 -16 l15 12" stroke={theme.text} strokeWidth={6} strokeLinecap="round" fill="none" />
              </g>
              <text x={30} y={230} fontFamily={theme.sans} fontSize={21} fill={theme.dim}>
                {'人陪着转 —— 它和你一起等'}
              </text>
            </g>
          ) : null}
          {mode === 'offRing' ? (
            <g opacity={active ? 1 : 0.6}>
              {/* 人站在环外，风筝绳拴着后台块 */}
              <g transform={`translate(36 ${cy + 40})`}>
                <circle cx={0} cy={-38} r={12} fill={theme.text} />
                <path d="M0 -24 v30 M0 -14 l-13 11 M0 -14 l13 11 M0 6 l-9 15 M0 6 l9 15" stroke={theme.text} strokeWidth={5.5} strokeLinecap="round" fill="none" />
              </g>
              <path
                d={`M44 ${cy + 16} C 80 ${cy + 40}, ${cx - 40} ${cy - 30}, ${cx + r * 0.7} ${cy - r * 0.7}`}
                stroke={theme.later}
                strokeWidth={2.5}
                fill="none"
                strokeDasharray="5 7"
              />
              <text x={30} y={230} fontFamily={theme.sans} fontSize={21} fill={theme.dim}>
                {'人在环外 —— 绳在循环手里'}
              </text>
            </g>
          ) : null}
          {mode === 'noOne' ? (
            <g opacity={active ? 1 : 0.6}>
              {/* 没有人：只有表盘，时间按开始 */}
              <g transform={`translate(56 ${cy + 30})`}>
                <circle cx={0} cy={0} r={34} fill={theme.panel} stroke={theme.later} strokeWidth={3.5} />
                <line x1={0} y1={0} x2={0} y2={-22} stroke={theme.later} strokeWidth={4} strokeLinecap="round" />
                <line x1={0} y1={0} x2={14} y2={8} stroke={theme.later} strokeWidth={3} strokeLinecap="round" />
              </g>
              {/* 表 → 环的触发线（虚线：时间替人按） */}
              <path
                d={`M92 ${cy + 30} C ${cx - 50} ${cy + 40}, ${cx - 60} ${cy}, ${cx - r} ${cy}`}
                stroke={theme.later}
                strokeWidth={2.5}
                fill="none"
                strokeDasharray="5 7"
              />
              <text x={30} y={230} fontFamily={theme.sans} fontSize={21} fill={theme.dim}>
                {'没有人 —— 时间自己按'}
              </text>
            </g>
          ) : null}
        </svg>
        {/* 段标题：位置陈述，不带色相 */}
        <div style={{marginTop: 4}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{title}</div>
        </div>
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 22, color: active ? theme.text : theme.dim, marginTop: 10}}>
        {sub}
      </div>
    </Panel>
  );
};

/** 6-A 三段位置图依次亮起 + 机制外挪一层箭头 + 共享小环匀速贯穿 */
const ThreePositions: React.FC<{l1: number; l2: number; l3: number; layerAt: number; ringAt: number}> = ({
  l1,
  l2,
  l3,
  layerAt,
  ringAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const e1 = spring({frame: frame - l1, fps, config: {damping: 200}});
  const e2 = spring({frame: frame - l2, fps, config: {damping: 200}});
  const e3 = spring({frame: frame - l3, fps, config: {damping: 200}});
  const layer = interpolate(frame - layerAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ringO = interpolate(frame - ringAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill>
      <SceneTag chapter="None" tagline="Who Presses Start" />
      <div style={{position: 'absolute', left: 0, right: 0, top: 190, display: 'flex', justifyContent: 'center', gap: 36}}>
        <div style={{opacity: e1}}>
          <StartPanel mode="onRing" title="01 · 有人按并等着" sub="最笨也最常见" active={frame >= l1} />
        </div>
        <div style={{opacity: e2}}>
          <StartPanel mode="offRing" title="02 · 有人按不等" sub="活丢后台，通知排队，还有狗看着" active={frame >= l2} />
        </div>
        <div style={{opacity: e3}}>
          <StartPanel mode="noOne" title="03 · 没人按" sub="时间自己按，错峰响，七天不响就退休" active={frame >= l3} />
        </div>
      </div>
      {/* 机制外挪：每多一种开始，往外挪一层 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 246,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 34,
          color: theme.text,
          opacity: layer,
        }}
      >
        {'活挪出这一轮，触发挪出这个人'}
      </div>
      {/* 题眼回收：环一秒不停 */}
      <div
        style={{
          position: 'absolute',
          right: 150,
          top: 96,
          opacity: ringO,
        }}
      >
        <LoopRing size={230} draw={1} dotProgress={useRingDot(2.5)} showLabels={false} />
        <div style={{textAlign: 'center', fontFamily: theme.sans, fontSize: 21, color: theme.core, marginTop: 6}}>
          {'从头到尾 · 一秒没停'}
        </div>
      </div>
      <Footnote delay={ringAt}>{'按下的不一定是它，等的一定不是你'}</Footnote>
    </AbsoluteFill>
  );
};

/** 6-B 一句话合同金句卡（core）+ 边界两句小字跟随 */
const ContractQuote: React.FC<{boundAt: number}> = ({boundAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 4, fps, config: {damping: 200}});
  const bound = interpolate(frame - boundAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 160px'}}>
      <div style={{textAlign: 'center', opacity: enter, transform: `translateY(${(1 - enter) * 26}px)`}}>
        <div style={{fontFamily: theme.serif, fontSize: 70, fontWeight: 700, color: theme.core, lineHeight: 1.4}}>
          {'按下的不一定是它，'}
          <br />
          {'等的一定不是你。'}
        </div>
        <div
          style={{
            marginTop: 54,
            fontFamily: theme.serif,
            fontSize: 30,
            color: theme.text,
            opacity: bound,
            lineHeight: 1.8,
          }}
        >
          {'有人在等它，但它从不等你；它也开始学着不等任何东西。'}
          <br />
          <span style={{color: theme.dim, fontSize: 27}}>{'时钟装在它的身体里，不在墙上 —— 守时的自主'}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * 6-C 信源卡 + 身份卡 + 渐黑。
 * `beatDurationInFrames` 是**本 beat 的总时长**，渐黑窗口据此反推（红线四：
 * 不写死帧数、不用末句时长——末句短于 beat 时会提前收尾）。
 */
const SourceAndFade: React.FC<{beatDurationInFrames: number; seriesAt: number}> = ({
  beatDurationInFrames,
  seriesAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 4, fps, config: {damping: 200}});
  const rows = [
    ['官方文档', 'code.claude.com/docs · 取数 2026-08'],
    ['工程博客', 'anthropic.com/engineering'],
    ['源码分析', '第三方逆向分析 · 片中逐处标注'],
    ['源码分析', '第三方逆向分析 · 片中逐处标注'],
    ['访问日期', '2026-08-22'],
    ['许可', 'MIT'],
  ];
  const seriesT = interpolate(frame - seriesAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 渐黑：末 1.2 秒线性压暗到全黑，窗口从 beat 总时长反推
  const fadeFrames = Math.round(1.2 * fps);
  const fadeStart = beatDurationInFrames - fadeFrames;
  const dark = interpolate(frame, [fadeStart, beatDurationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: enter * (1 - seriesT * 0.85), transform: `translateY(${(1 - enter) * 20}px)`}}>
        <Panel style={{padding: '30px 40px', width: 920}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.later, marginBottom: 18}}>
            {'信源'}
          </div>
          {rows.map(([k, v], i) => (
            <div
              key={k}
              style={{
                display: 'flex',
                marginBottom: 10,
                opacity: interpolate(frame - 8 - i * 4, [0, 10], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              <div style={{width: 160, fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>
                {k}
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 23, color: theme.text}}>{v}</div>
            </div>
          ))}
          {/* 诚实行：产品内部断言均为第三方的源码分析（【三】归属句的公开落点） */}
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: `1px solid ${theme.panelBorder}`,
              fontFamily: theme.sans,
              fontSize: 20,
              color: theme.dim,
              opacity: interpolate(frame - 8 - rows.length * 4, [0, 10], [0, 0.9], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {'涉及产品内部的部分，均为第三方的源码分析，片中已逐处标注；取证字节已随片归档'}
          </div>
        </Panel>
      </div>
      {seriesT > 0 ? (
        <div
          style={{
            position: 'absolute',
            textAlign: 'center',
            opacity: seriesT,
            transform: `translateY(${(1 - seriesT) * 18}px)`,
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.dim, letterSpacing: 3}}>
            {'Claude Code Harness Engineering'}
          </div>
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 62,
              fontWeight: 700,
              color: theme.core,
              marginTop: 18,
            }}
          >
            {'时机层：谁来按下开始'}
          </div>
          {/* 下期预告卡：标题只在画面（反串线纪律） */}
          <div
            style={{
              marginTop: 26,
              padding: '13px 28px',
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 12,
              background: theme.panel,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, letterSpacing: 2}}>
              {'下期 · 协作层'}
            </div>
            <div style={{fontFamily: theme.serif, fontSize: 31, color: theme.text, marginTop: 5}}>
              {'从一个到一群'}
            </div>
          </div>
        </div>
      ) : null}
      {/* 渐黑遮罩 */}
      <AbsoluteFill style={{background: '#000', opacity: dark, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

export const P6Ending: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p6-01', 'p6-06');
  const bB = w('p6-07', 'p6-12');
  const bC = w('p6-13', 'p6-15');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="6-A 三种开始的位置">
        <ThreePositions
          l1={at('p6-02') - bA.from}
          l2={at('p6-03') - bA.from}
          l3={at('p6-04') - bA.from}
          layerAt={at('p6-05') - bA.from}
          ringAt={at('p6-06') - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="6-B 一句话合同">
        <ContractQuote boundAt={at('p6-09') - bB.from} />
      </Sequence>
      <Sequence {...bC} name="6-C 信源卡与渐黑">
        {/* 渐黑窗口从**本 beat 总时长**推导，不是末句时长（红线四） */}
        <SourceAndFade
          beatDurationInFrames={bC.durationInFrames}
          seriesAt={at('p6-14') - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
