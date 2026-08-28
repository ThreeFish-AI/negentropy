/** P0 钩子与命名帧（分镜 0-A…0-C）
 *  三句内完成：搬运工痛点 → 官方命名「Harness」→ 四件套辐条图。
 *  改造（2026-08 Harness Engineering）：10 句压缩为 7 句，命名帧是全系列的开场锚；
 *  评审改造（B 方案）：0-B 增官方赌注卡（p0-03a..c，SWE-bench 同模型换脚手架 22%→49%）、
 *  外框合拢改锚 p0-04；0-C 五辐条改四件套（循环/工具/上下文管理/护栏，与 5-A 标尺同清单）。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneHeader, Terminal} from '../components/motifs';

/** 0-A 终端打字 → 命令凝住 → 复制粘贴弧线加速塞满（两句内完成旧版六句的信息量） */
const StallAndCarry: React.FC<{carryAt: number}> = ({carryAt}) => {
  const frame = useCurrentFrame();
  const W = 1560;
  const H = 400;
  const frozen = frame >= carryAt - 6;
  // 三轮搬运轨迹（加速：每轮 9 帧，旧版是 15 帧——钩子提速）
  const roundGap = [0, 9, 18];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: W, height: H}}>
        <Terminal
          width={1300}
          height={330}
          freezeCursorAt={carryAt - 6}
          lines={[
            {prompt: '›', text: '看看项目里有哪些文件，再跑一下其中一个脚本', delay: 4},
            {text: 'find . -name "*.py" -maxdepth 2', color: theme.core, delay: 38},
          ]}
        />
        {/* 搬运弧线：命令→终端、输出→对话框，三轮残影累积 */}
        <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
          {roundGap.map((gap, i) => {
            const base = carryAt + gap;
            const legs = [
              {a: W - 300, b: 300, y: 90 + i * 22, dir: -1},
              {a: 300, b: W - 300, y: 240 + i * 22, dir: 1},
            ];
            return legs.map((lg, k) => {
              const t = interpolate(frame - base - k * 6, [0, 9], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              if (t <= 0) return null;
              const x = lg.a + (lg.b - lg.a) * t;
              return (
                <g key={`${i}-${k}`}>
                  <line x1={lg.a} y1={lg.y} x2={x} y2={lg.y} stroke={theme.dim} strokeWidth={3} opacity={0.32} />
                  <circle cx={x} cy={lg.y} r={7} fill={theme.dim} opacity={0.85} />
                </g>
              );
            });
          })}
        </svg>
        {frozen ? (
          <div
            style={{
              position: 'absolute',
              right: -96,
              top: 10,
              fontFamily: theme.sans,
              fontSize: 24,
              color: theme.deny,
              writingMode: 'vertical-rl',
              letterSpacing: 5,
              opacity: interpolate(frame, [carryAt - 6, carryAt + 6], [0, 0.9], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
            }}
          >
            {'每一轮的搬运工，是你'}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** 0-B 命名帧：搬运残影收束成外框，包住「模型」内核——外框即 Harness。
 *  p0-03a..c 底部浮出官方赌注卡（SWE-bench 同模型换脚手架 22%→49%）；
 *  外框合拢改锚 p0-04（「名字就叫」句才落框，消除头空转）；p0-05 官方引文条压上。 */
const NamingFrame: React.FC<{
  betAt: number;
  barsAt: number;
  settleAt: number;
  frameAt: number;
  officialAt: number;
}> = ({betAt, barsAt, settleAt, frameAt, officialAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 赌注卡自底浮出（p0-03a，FadeUp 语义）
  const bet = interpolate(frame - betAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 两条 core 分数条在 320px 轨道上增长（p0-03b：0→22% / 0→49%）
  const bars = interpolate(frame - barsAt, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 分数条定格并压「你的力气 = 它的分数」（p0-03c）
  const settle = interpolate(frame - settleAt, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 外框四面合拢改锚 p0-04（「名字就叫」句才落框——此前锚 beat 首帧，头两句空转）
  const close = spring({frame: frame - frameAt, fps, config: {damping: 180}});
  const CX = 960;
  const CY = 460;
  const full = 420;
  const wHalf = full / 2 + (1 - close) * 620;
  const hHalf = full / 2 + (1 - close) * 380;
  const label = interpolate(frame - frameAt - 22, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const quote = interpolate(frame - officialAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 呼吸辉光（命名帧的「仪式感」）
  const breathe = 0.5 + 0.5 * Math.sin(frame / 26);
  return (
    <AbsoluteFill>
      {/* 四面合拢的残影 → 外框 */}
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <rect
          x={CX - wHalf}
          y={CY - hHalf}
          width={wHalf * 2}
          height={hHalf * 2}
          rx={26}
          fill="none"
          stroke={theme.mech}
          strokeWidth={5}
          style={{filter: `drop-shadow(0 0 ${10 + breathe * 16}px ${theme.mech}66)`}}
        />
        {/* 四角的旧搬运残影淡出（收束感） */}
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sy], i) => {
          const o = interpolate(frame, [0, 18], [0.35, 0], {extrapolateRight: 'clamp'});
          return (
            <line
              key={i}
              x1={CX + sx * (wHalf - 120)}
              y1={CY + sy * (hHalf - 60)}
              x2={CX + sx * (wHalf + 40)}
              y2={CY + sy * (hHalf + 40)}
              stroke={theme.dim}
              strokeWidth={4}
              opacity={o}
            />
          );
        })}
      </svg>
      {/* 内核：模型 */}
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: CY,
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          opacity: interpolate(close, [0.3, 1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
        }}
      >
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 40,
            color: theme.text,
            border: `3px solid ${theme.panelBorder}`,
            borderRadius: 14,
            padding: '16px 34px',
            background: theme.panel,
          }}
        >
          {'模型 Claude'}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim, marginTop: 14}}>
          {'判断力在里面'}
        </div>
      </div>
      {/* 「Harness」落框 */}
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: CY - hHalf - 86,
          transform: `translate(-50%, 0) scale(${0.7 + 0.3 * label})`,
          opacity: label,
          fontFamily: theme.serif,
          fontSize: 58,
          fontWeight: 700,
          color: theme.core,
          letterSpacing: 2,
        }}
      >
        {'Harness'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: CY + hHalf + 40,
          transform: 'translate(-50%, 0)',
          opacity: label,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
        }}
      >
        {'把动力源，套进一个可控的结构里'}
      </div>
      {/* 官方赌注卡（p0-03a..c）：bottom:210 避让字幕带；p0-05 引文条压上时让位淡出 */}
      {bet > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: CX,
            bottom: 210,
            transform: `translate(-50%, ${(1 - bet) * 30}px)`,
            opacity: bet * (1 - quote * 0.9),
          }}
        >
          <Panel accent={theme.core} style={{padding: '18px 30px', width: 780}}>
            <div style={{fontFamily: theme.serif, fontSize: 23, color: theme.text}}>
              {'“同一个底层模型，换一套脚手架，成绩能差出一大截。”'}
            </div>
            {/* 双分数条：320px 轨道 interpolate 增长（0→22% / 0→49%） */}
            <div style={{marginTop: 14, display: 'flex', flexDirection: 'column', gap: 11}}>
              {[
                {label: '旧脚手架', v: 0.22},
                {label: '新脚手架', v: 0.49},
              ].map((b) => (
                <div key={b.label} style={{display: 'flex', alignItems: 'center', gap: 14}}>
                  <span style={{width: 104, fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
                    {b.label}
                  </span>
                  <div
                    style={{
                      width: 320,
                      height: 15,
                      borderRadius: 8,
                      background: theme.panelBorder,
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{width: `${b.v * bars * 100}%`, height: '100%', background: theme.core}} />
                  </div>
                  <span
                    style={{
                      fontFamily: theme.mono,
                      fontSize: 22,
                      fontWeight: 700,
                      color: theme.core,
                      opacity: bars > 0.99 ? 1 : 0.35,
                    }}
                  >
                    {`${Math.round(b.v * Math.min(1, bars) * 100)}%`}
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 11,
                fontFamily: theme.mono,
                fontSize: 17,
                color: theme.dim,
                opacity: bars > 0.99 ? 1 : 0,
              }}
            >
              {'SWE-bench Verified 500 题 · 同脚手架代际 22%→49% · 官方自报 2025-01-06'}
            </div>
            {/* p0-03c：分数条定格 + 结论句压上 */}
            <div
              style={{
                marginTop: 9,
                fontFamily: theme.serif,
                fontSize: 23,
                fontWeight: 700,
                color: theme.core,
                opacity: settle,
              }}
            >
              {'你的力气 = 它的分数'}
            </div>
          </Panel>
        </div>
      ) : null}
      {/* 官方引文条（p0-05 句锚） */}
      {quote > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: CX,
            bottom: 200,
            transform: `translate(-50%, ${(1 - quote) * 14}px)`,
            opacity: quote,
            textAlign: 'center',
          }}
        >
          <Panel style={{padding: '18px 34px', maxWidth: 1200}}>
            {/* 中英并列（分镜 0-B 承诺）：中文口播句 + 英文原句 */}
            <div style={{fontFamily: theme.serif, fontSize: 27, color: theme.text}}>
              {'“Claude Code 是 Harness，Claude 是里面的模型。”'}
            </div>
            <div
              style={{
                fontFamily: theme.serif,
                fontSize: 21,
                color: theme.dim,
                marginTop: 7,
                fontStyle: 'italic',
              }}
            >
              {'“Claude Code is the harness, Claude is the model.”'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 8}}>
              {'— 官方文档 how-claude-code-works（code.claude.com，取数2026年8月）'}
            </div>
          </Panel>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 0-C 四件套辐条图：外框上长出四根辐条（循环 / 工具 / 上下文管理 / 护栏），
 *  内侧连着模型内核（与 p5-05 官方四件套标尺同一张清单——5-A 回指此处）。
 *  「上下文管理」那根先灰（与 5-A 标尺空格、p5-06「后面拆」承诺同构）。 */
const SupplySpokes: React.FC<{titleAt: number}> = ({titleAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const CX = 960;
  const CY = 440;
  const R = 300;
  const spokes = [
    {label: '循环', zh: '问模型·执行·填回'},
    {label: '工具', zh: '查表分发'},
    {label: '上下文管理', zh: '后面单独拆', later: true},
    {label: '护栏', zh: '闸门·沙箱·插口'},
  ];
  const title = spring({frame: frame - titleAt, fps, config: {damping: 200}});
    const line = interpolate(frame - titleAt, [4, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ring = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        {/* 外框（Harness 轮廓，缩小型持续在场） */}
        <rect
          x={CX - 380 * ring}
          y={CY - 250 * ring}
          width={760 * ring}
          height={500 * ring}
          rx={22}
          fill="none"
          stroke={theme.mech}
          strokeWidth={4}
          opacity={0.85}
        />
        <text x={CX} y={CY + 6} textAnchor="middle" fontFamily={theme.mono} fontSize={34} fill={theme.text}>
          {'模型 Claude'}
        </text>
        {/* 四辐条：自外框上沿四点连向内核（辐点均布 fx = CX − 225 + i*150） */}
        {spokes.map((sp, i) => {
          const t = interpolate(frame - 6 - i * 8, [0, 12], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          if (t <= 0) return null;
          const fx = CX - 225 + i * 150;
          const fy = CY - 250;
          const ix = CX + (fx - CX) * 0.24;
          const iy = CY - 40;
          const glow = sp.later ? 0 : 0.5 + 0.5 * Math.sin((frame - i * 8) / 9);
          return (
            <g key={sp.label} opacity={t * (sp.later ? 0.35 : 1)}>
              <line
                x1={fx}
                y1={fy}
                x2={fx + (ix - fx) * t}
                y2={fy + (iy - fy) * t}
                stroke={sp.later ? theme.dim : theme.mech}
                strokeWidth={5}
                style={sp.later ? undefined : {filter: `drop-shadow(0 0 ${4 + glow * 8}px ${theme.mech}88)`}}
              />
              <circle cx={fx} cy={fy - 46} r={34 * t} fill={theme.panel} stroke={sp.later ? theme.dim : theme.mech} strokeWidth={3} />
              <text x={fx} y={fy - 92} textAnchor="middle" fontFamily={theme.sans} fontSize={sp.later ? 21 : 26} fill={sp.later ? theme.dim : theme.text}>
                {sp.label}
              </text>
              <text x={fx} y={fy + 26} textAnchor="middle" fontFamily={theme.sans} fontSize={19} fill={theme.dim}>
                {sp.zh}
              </text>
            </g>
          );
        })}
      </svg>
      {/* 标题卡（p0-07 收尾压入） */}
      {title > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 210,
            textAlign: 'center',
            opacity: title,
            transform: `translateY(${(1 - title) * 18}px)`,
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 58, fontWeight: 700, color: theme.core}}>
            {'执行层：一个循环，就是全部'}
          </div>
          <div
            style={{
              margin: '22px auto 0',
              height: 3,
              width: 560 * line,
              background: theme.core,
            }}
          />
          <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>
            {'Claude Code Harness Engineering · 执行层'}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const P0Hook: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p0-01', 'p0-02');
  const bB = w('p0-03', 'p0-05');
  const bC = w('p0-06', 'p0-07');
  return (
    <AbsoluteFill>
      <SceneHeader index="P0" title="你在当那个中间人" meta="the missing layer" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="0-A 停住与搬运">
        <StallAndCarry carryAt={at('p0-02') - bA.from} />
      </Sequence>
      <Sequence {...bB} name="0-B 命名帧：Harness">
        {/* p0-03a 赌注卡浮出；p0-03b 双分数条增长；p0-03c 定格+结论；p0-04 外框合拢；p0-05 引文条 */}
        <NamingFrame
          betAt={at('p0-03a') - bB.from}
          barsAt={at('p0-03b') - bB.from}
          settleAt={at('p0-03c') - bB.from}
          frameAt={at('p0-04') - bB.from}
          officialAt={at('p0-05') - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C 四辐条与标题">
        <SupplySpokes titleAt={at('p0-07') - bC.from + 24} />
      </Sequence>
    </AbsoluteFill>
  );
};
