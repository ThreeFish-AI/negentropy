/** P0 你在当那个中间人（分镜 0-A…0-D）
 *  痛点：模型写出命令就停住，人在做复制粘贴的中间层。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, Terminal} from '../components/motifs';

/** 0-A 终端打字 → 模型吐出一条命令后画面凝住；右侧走秒芯片在凝住点停死 */
const AskAndStall: React.FC<{freezeAt: number}> = ({freezeAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const frozen = frame >= freezeAt;
  // 「想了想」的计时：打字期间正常走秒，凝住瞬间停死——把 p0-02 的「停在那儿了」量化成画面
  const elapsed = frozen ? freezeAt : frame;
  const secs = Math.floor((elapsed / fps) * 2) / 2; // 0.5s 步进，减少帧内数字抖动
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative'}}>
        <Terminal
          width={1320}
          height={330}
          freezeCursorAt={freezeAt}
          lines={[
            {prompt: '›', text: '看看项目里有哪些文件，再跑一下其中一个脚本', delay: 6},
            {text: '好的，先列出目录下的 Python 文件：', color: theme.dim, delay: 46},
            {text: 'find . -name "*.py" -maxdepth 2', color: theme.core, delay: 90},
          ]}
        />
        <div
          style={{
            position: 'absolute',
            right: -108,
            top: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: interpolate(frame, [8, 20], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: 30,
              fontVariantNumeric: 'tabular-nums',
              color: frozen ? theme.dim : theme.mech,
              border: `2px solid ${frozen ? theme.panelBorder : theme.mech}`,
              borderRadius: 10,
              padding: '10px 14px',
              background: theme.panel,
            }}
          >
            {`${secs.toFixed(1)}s`}
          </div>
          <div
            style={{
              fontFamily: theme.sans,
              fontSize: 21,
              color: frozen ? theme.deny : theme.dim,
              marginTop: 10,
              writingMode: 'vertical-rl',
              letterSpacing: 4,
            }}
          >
            {frozen ? '计时停了' : '它还在想'}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 0-B 复制粘贴往复三轮：灰色搬运痕迹累积不消失 + 轮次钢印 + 剪贴板逐轮老化 */
const CopyPasteLoop: React.FC<{roundStarts: number[]}> = ({roundStarts}) => {
  const frame = useCurrentFrame();
  const W = 1560;
  const H = 430;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: W, height: H}}>
        <Panel style={{position: 'absolute', left: 0, top: 40, width: 640, height: 300, padding: 20}}>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>终端</div>
        </Panel>
        <Panel style={{position: 'absolute', left: W - 640, top: 40, width: 640, height: 300, padding: 20}}>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>对话框</div>
        </Panel>
        <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
          {roundStarts.map((s, i) => {
            // 一轮 = 命令右→左（贴进终端） + 输出左→右（贴回对话框）
            const legs = [
              {a: W - 640, b: 300, y: 120 + i * 26, dir: -1},
              {a: 300, b: W - 640, y: 250 + i * 26, dir: 1},
            ];
            return legs.map((lg, k) => {
              const t = interpolate(frame - s - k * 15, [0, 15], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              if (t <= 0) return null;
              const x = lg.a + (lg.b - lg.a) * t;
              return (
                <g key={`${i}-${k}`}>
                  {/* 残影：已走过的轨迹留下不消失的灰痕 */}
                  <line
                    x1={lg.a}
                    y1={lg.y}
                    x2={x}
                    y2={lg.y}
                    stroke={theme.dim}
                    strokeWidth={3}
                    opacity={0.3}
                  />
                  <circle cx={x} cy={lg.y} r={8} fill={theme.dim} opacity={0.8} />
                </g>
              );
            });
          })}
        </svg>
        {/* 轮次钢印：每开始一轮，右上角落下一枚 01/02/03——「你」的劳动被计数 */}
        {roundStarts.map((s, i) => {
          const drop = spring({
            frame: frame - s,
            fps: 30,
            config: {damping: 200},
          });
          if (frame < s) return null;
          return (
            <div
              key={s}
              style={{
                position: 'absolute',
                right: 8 + (roundStarts.length - 1 - i) * 74,
                top: -34,
                fontFamily: theme.mono,
                fontSize: 34,
                fontWeight: 700,
                color: theme.dim,
                border: `3px solid ${theme.dim}`,
                borderRadius: 8,
                padding: '2px 12px',
                opacity: 0.55 * drop,
                transform: `rotate(${(-8 + i * 9) * drop}deg) scale(${0.6 + 0.4 * drop})`,
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </div>
          );
        })}
        {/* 剪贴板：板身恒定，板上的搬运痕迹随轮次变淡（见下方 line 的 0.3 - i*0.06）
            ——搬运这件事件件在耗损你 */}
        <svg width={64} height={84} style={{position: 'absolute', left: W / 2 - 32, top: -58}}>
          <rect
            x={6}
            y={14}
            width={52}
            height={64}
            rx={6}
            fill={theme.panel}
            stroke={theme.dim}
            strokeWidth={3}
            opacity={0.9}
          />
          <rect x={22} y={8} width={20} height={12} rx={3} fill="none" stroke={theme.dim} strokeWidth={3} />
          {roundStarts.map((s, i) =>
            frame > s + 20 ? (
              <line
                key={s}
                x1={16}
                y1={30 + i * 14}
                x2={48}
                y2={30 + i * 14}
                stroke={theme.dim}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.3 - i * 0.06}
              />
            ) : null,
          )}
        </svg>
      </div>
      <Footnote delay={20}>{'你 = 模型与终端之间的搬运层'}</Footnote>
    </AbsoluteFill>
  );
};

/** 0-C 人形剪影被两侧箭头夹住并微微下沉 + 主线问题浮现 */
const YouInTheMiddle: React.FC<{questionAt: number}> = ({questionAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const sink = interpolate(frame, [10, 44], [0, 14], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const qo = interpolate(frame - questionAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          position: 'relative',
          transform: `translateY(${(1 - enter) * 30 + sink}px)`,
          opacity: enter,
        }}
      >
        <svg width={560} height={230} style={{overflow: 'visible'}}>
          <g transform="translate(140 0)">
            <circle cx={140} cy={54} r={34} fill={theme.dim} opacity={0.75} />
            <path d="M140 96 L140 168 M140 118 L86 152 M140 118 L194 152 M140 168 L104 220 M140 168 L176 220"
              stroke={theme.dim} strokeWidth={13} strokeLinecap="round" fill="none" opacity={0.75} />
            {/* 载荷：左来的命令芯片（右向）与右来的输出块（左向）都压在你手上——
                「搬运」在第一眼就成立，不靠字幕解释 */}
            {[
              {dir: -1, label: '命令', y: 96},
              {dir: 1, label: '输出', y: 168},
            ].map((p) => {
              const o = interpolate(frame - 14, [0, 12], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const x = 140 + p.dir * 128;
              return (
                <g key={p.label} opacity={o}>
                  <line
                    x1={x}
                    y1={p.y}
                    x2={140 + p.dir * 84}
                    y2={p.y}
                    stroke={theme.dim}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />
                  <path
                    d={
                      p.dir === -1
                        ? `M${140 - 84} ${p.y} l-14 -8 v16 Z`
                        : `M${140 + 84} ${p.y} l14 -8 v16 Z`
                    }
                    fill={theme.dim}
                  />
                  <text
                    x={x + p.dir * 6}
                    y={p.y - 18}
                    textAnchor={p.dir === -1 ? 'end' : 'start'}
                    fontFamily={theme.mono}
                    fontSize={22}
                    fill={theme.dim}
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div
        style={{
          marginTop: 40,
          opacity: qo,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 46,
          lineHeight: 1.55,
          color: theme.text,
          maxWidth: 1280,
        }}
      >
        {'从「能写出这条命令」，'}
        <br />
        {'到「它真的在你电脑上跑起来」——'}
      </div>
    </AbsoluteFill>
  );
};

/** 0-D 标题卡 */
const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 6, fps, config: {damping: 200}});
  const line = interpolate(frame, [18, 48], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{textAlign: 'center', opacity: enter, transform: `translateY(${(1 - enter) * 22}px)`}}>
        <div style={{fontFamily: theme.serif, fontSize: 84, fontWeight: 700, color: theme.core}}>
          {'执行层：一个循环，就是全部'}
        </div>
        <div
          style={{
            marginTop: 26,
            fontFamily: theme.sans,
            fontSize: 38,
            color: theme.text,
            letterSpacing: 2,
          }}
        >
          {'让 AI 动手的四层机制'}
        </div>
        <div
          style={{
            margin: '34px auto 0',
            height: 3,
            width: 520 * line,
            background: theme.core,
          }}
        />
        <div style={{marginTop: 22, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
          {'工具与执行 · 四章'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P0Hook: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（只取某句的起始帧，不是分镜 beat 窗口）。刻意不叫 w()——
  // check_script --check-scenes 只把 w() 视为分镜窗口，混用会让时点锚刷「分镜陈旧」假 WARN。
  const at = (id: string) => w(id).from;
  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-06');
  const relB = (id: string) => at(id) - bB.from;
  const bC = w('p0-07', 'p0-08');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 终端打字与凝住">
        {/* 凝住点落在 p0-03「它不会自己去跑」——光标停闪变灰 */}
        <AskAndStall freezeAt={at('p0-03') - bA.from} />
      </Sequence>
      <Sequence {...bB} name="0-B 复制粘贴往复">
        <CopyPasteLoop roundStarts={[0, relB('p0-05'), relB('p0-06')]} />
      </Sequence>
      <Sequence {...bC} name="0-C 中间搬东西的是你">
        <YouInTheMiddle questionAt={at('p0-08') - bC.from} />
      </Sequence>
      <Sequence {...w('p0-09', 'p0-10')} name="0-D 标题卡">
        <TitleCard />
      </Sequence>
    </AbsoluteFill>
  );
};
