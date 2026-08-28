/** P1 一个循环，就是全部（分镜 1-A…1-F）—— 开源示教素材「Agent While-Loop」可视化的概念重建
 *  ★ 本幕建立全片视觉锚：LoopRing 的色与线宽从此不再改变。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {CodeCard, Counter, Footnote, LoopRing, Panel, SceneHeader, SceneTag, useRingDot} from '../components/motifs';

/** 1-A 环形循环成形 + 两个信号分支（原 p1-07 已删：「传送带转不转」的语义收在 p1-06 的定格收镜上） */
const RingBirth: React.FC<{yesAt: number; noAt: number}> = ({yesAt, noAt}) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [4, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const dot = useRingDot(2.5, 40);
  // 讲到「没有」时光点滑出到停机出口并定格收镜
  const pull = interpolate(frame - noAt, [8, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const active = frame >= yesAt && frame < noAt ? 2 : undefined;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Agent Loop" tagline="One Loop Is All You Need" />
      <LoopRing size={520} draw={draw} dotProgress={draw > 0.98 ? dot : undefined} activeNode={active} exitPull={pull} />
      <Footnote delay={yesAt}>
        {'有 tool_use → 继续　·　没有 → 退出'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 1-B 五步逐句点亮 + messages[] 面板逐轮长高 */
const FiveSteps: React.FC<{stepAt: number[]}> = ({stepAt}) => {
  const frame = useCurrentFrame();
  const steps = [
    '把你的问题放进消息列表',
    '连同工具清单一起发给模型',
    '追加回答，挑出所有工具调用',
    '一个都没有 → 返回；有 → 逐个执行',
    '结果打包成新消息，回到第二步',
  ];
  const lit = stepAt.filter((s) => frame >= s).length;
  const blocks: {color: string; label: string}[] = [];
  if (lit >= 1) blocks.push({color: theme.dim, label: 'user'});
  if (lit >= 3) blocks.push({color: theme.core, label: 'assistant'});
  if (lit >= 4) blocks.push({color: theme.mech, label: 'tool_result'});
  if (lit >= 5) blocks.push({color: theme.core, label: 'assistant'});
  const loopBack = interpolate(frame - stepAt[4], [6, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{flexDirection: 'row', alignItems: 'center', padding: '0 96px', gap: 60}}>
      <div style={{width: 380, display: 'flex', justifyContent: 'center'}}>
        <LoopRing size={340} draw={1} dotProgress={useRingDot(2.5)} />
      </div>
      <div style={{flex: 1}}>
        {steps.map((s, i) => {
          const on = frame >= stepAt[i];
          const e = interpolate(frame - stepAt[i], [0, 12], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={s}
              style={{
                display: 'flex',
                gap: 18,
                alignItems: 'center',
                marginBottom: 16,
                opacity: on ? 1 : 0.2,
                transform: `translateY(${(1 - e) * 12}px)`,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: `2px solid ${on ? theme.core : theme.panelBorder}`,
                  color: on ? theme.core : theme.dim,
                  fontFamily: theme.mono,
                  fontSize: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>{s}</div>
            </div>
          );
        })}
      </div>
      <Panel style={{width: 300, padding: 18, alignSelf: 'flex-start', marginTop: 40}}>
        <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginBottom: 12}}>
          {'messages[]'}
        </div>
        {blocks.map((b, i) => (
          <div
            key={i}
            style={{
              height: 38,
              marginBottom: 8,
              borderRadius: 6,
              background: b.color,
              opacity: 0.85,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 12,
              fontFamily: theme.mono,
              fontSize: 19,
              color: theme.bg,
              fontWeight: 700,
            }}
          >
            {b.label}
          </div>
        ))}
        {blocks.length === 0 ? (
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.panelBorder}}>
            {'[ empty ]'}
          </div>
        ) : null}
        {loopBack > 0 ? (
          <div
            style={{
              marginTop: 10,
              fontFamily: theme.mono,
              fontSize: 20,
              color: theme.core,
              opacity: loopBack,
            }}
          >
            {'↺ 回到第二步'}
          </div>
        ) : null}
      </Panel>
    </AbsoluteFill>
  );
};

/** 1-C 二十三行代码卡 + 来源标签条 + 延伸列 + 分工左右分屏。
 *  p1-12a 卡眉滑入来源标签条（「开源最小实现 · 照着同一套机制搭的」，无具名信息——
 *  示例锚，先交代这份代码是谁、再开始读）；p1-12b 右侧浮出「边读边说：实际实现」
 *  半亮列；随后代码逐行渲染 → 二十三行计数 → 左右分屏。 */
const TwentyThreeLines: React.FC<{
  tagAt: number;
  compareAt: number;
  countAt: number;
  splitAt: number;
}> = ({tagAt, compareAt, countAt, splitAt}) => {
  const frame = useCurrentFrame();
  const lines = [
    'while True:',
    '    response = client.messages.create(',
    '        model=MODEL, system=SYSTEM,',
    '        messages=messages, tools=TOOLS)',
    '    messages.append({"role": "assistant",',
    '                     "content": response.content})',
    '    tool_calls = [b for b in response.content',
    '                  if b.type == "tool_use"]',
    '    if not tool_calls:',
    '        return',
    '    results = []',
    '    for block in tool_calls:',
    '        output = run_bash(block.input["command"])',
    '        results.append({"type": "tool_result",',
    '            "tool_use_id": block.id, "content": output})',
    '    messages.append({"role": "user", "content": results})',
  ];
  // 标签条自卡眉滑入（mech 描边）
  const tag = interpolate(frame - tagAt, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 右侧「对照对象」半亮列
  const compare = interpolate(frame - compareAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const split = interpolate(frame - splitAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 代码逐行渲染让位给前置动画：标签条（~14 帧）+ 对照列（~16 帧）先占画布
  const codeStart = compareAt + 18;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: 1 - split * 0.75, transform: `scale(${1 - split * 0.08})`}}>
        {/* 来源标签条：卡眉上方滑入（mech 描边，无具名信息） */}
        <div
          style={{
            width: 1060,
            marginBottom: 10,
            display: 'flex',
            justifyContent: 'center',
            opacity: tag,
            transform: `translateY(${(1 - tag) * -12}px)`,
          }}
        >
          <div
            style={{
              border: `2px solid ${theme.mech}`,
              borderRadius: 999,
              padding: '7px 22px',
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 21,
              color: theme.mech,
            }}
          >
            {'开源最小实现 · 照着同一套机制搭的'}
          </div>
        </div>
        <CodeCard lines={lines} width={1060} glowLineNumbersAt={countAt} startAt={codeStart} />
      </div>
      {/* 延伸半亮列（p1-12b）：读最简实现时，右边始终立着实际实现的落点 */}
      {compare > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 1280,
            top: 300,
            width: 240,
            opacity: compare * (1 - split),
          }}
        >
          <div
            style={{
              border: `2px dashed ${theme.panelBorder}`,
              borderRadius: 12,
              padding: '14px 16px',
              fontFamily: theme.sans,
              fontSize: 20,
              color: theme.dim,
              textAlign: 'center',
            }}
          >
            {'边读边说'}
            <div style={{fontFamily: theme.serif, fontSize: 26, color: theme.dim, marginTop: 6}}>
              {'实际实现'}
            </div>
          </div>
        </div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          right: 150,
          top: 150,
          fontFamily: theme.sans,
          fontSize: 30,
          color: theme.core,
        }}
      >
        <Counter from={0} to={23} start={countAt} style={{fontSize: 78, fontWeight: 700}} />
        <span style={{fontSize: 28, marginLeft: 10, color: theme.dim}}>{'行'}</span>
      </div>
      {split > 0 ? (
        <AbsoluteFill style={{flexDirection: 'row', alignItems: 'center', opacity: split}}>
          {[
            {t: '模型', s: '决定要不要用工具、用哪一个', c: theme.mech},
            {t: '脚手架', s: '真的去跑，把结果搬回来', c: theme.core},
          ].map((side, i) => (
            <div
              key={side.t}
              style={{
                flex: 1,
                textAlign: 'center',
                borderRight: i === 0 ? `2px solid ${theme.panelBorder}` : 'none',
                transform: `translateX(${(1 - split) * (i === 0 ? -40 : 40)}px)`,
              }}
            >
              <div style={{fontFamily: theme.serif, fontSize: 58, fontWeight: 700, color: side.c}}>
                {side.t}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim, marginTop: 14}}>
                {side.s}
              </div>
            </div>
          ))}
        </AbsoluteFill>
      ) : null}
      <Footnote delay={countAt}>{'实测 agent_loop 非空非注释 23 行 @ pinned commit'}</Footnote>
    </AbsoluteFill>
  );
};

/** 1-D 停止标记滞后：字符流已吐出工具调用，标记牌还写着「进行中」 */
const UnreliableFlag: React.FC<{crossAt: number; quoteAt: number}> = ({crossAt, quoteAt}) => {
  const frame = useCurrentFrame();
  const chars = '我来看一下这个目录…… [tool_use: bash] ';
  const shown = Math.max(0, Math.min(chars.length, Math.floor(frame / 2)));
  const toolIdx = chars.indexOf('[tool_use');
  // 工具调用已流出的帧（每 2 帧 1 字）；标记牌刻意再滞后 25 帧才翻转 —— 这就是「不可靠」
  const toolOutAt = toolIdx * 2;
  const flipped = frame >= toolOutAt + 25;
  const cross = interpolate(frame - crossAt, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (frame >= quoteAt) {
    return (
      <QuoteCard zh="流式到达 ≠ 状态更新 —— 观察输出，不观察承诺" accent={theme.core} />
    );
  }
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', gap: 56}}>
      <Panel style={{width: 1180, padding: '26px 30px'}}>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginBottom: 12}}>
          {'模型的回答（流式，一个字一个字出来）'}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 30, minHeight: 44, whiteSpace: 'pre'}}>
          <span style={{color: theme.text}}>{chars.slice(0, Math.min(shown, toolIdx))}</span>
          <span style={{color: theme.mech, fontWeight: 700}}>
            {shown > toolIdx ? chars.slice(toolIdx, shown) : ''}
          </span>
          <span style={{color: theme.core}}>▍</span>
        </div>
      </Panel>
      <div style={{position: 'relative'}}>
        <Panel
          accent={cross > 0.2 ? theme.deny : flipped ? theme.mech : theme.panelBorder}
          style={{width: 520, padding: '22px 26px', textAlign: 'center'}}
        >
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
            {'「我为什么停下来」标记'}
          </div>
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: 36,
              fontWeight: 700,
              marginTop: 8,
              /* 打叉后标记文字压暗：斜叉压在亮字上会互相干扰可读性 */
              color: cross > 0.2 ? theme.dim : flipped ? theme.mech : theme.dim,
              opacity: cross > 0.2 ? 0.55 : 1,
            }}
          >
            {flipped ? 'tool_use' : '进行中…'}
          </div>
        </Panel>
        {cross > 0 ? (
          <svg
            width={560}
            height={130}
            style={{position: 'absolute', left: -20, top: -4, pointerEvents: 'none'}}
          >
            {/* 描边+主线两层：让斜叉在文字上仍清晰可辨 */}
            <line
              x1={44}
              y1={16}
              x2={44 + 470 * cross}
              y2={16 + 96 * cross}
              stroke={theme.bg}
              strokeWidth={13}
              strokeLinecap="round"
              opacity={0.85}
            />
            <line
              x1={44}
              y1={16}
              x2={44 + 470 * cross}
              y2={16 + 96 * cross}
              stroke={theme.deny}
              strokeWidth={7}
              strokeLinecap="round"
            />
          </svg>
        ) : null}
      </div>
      <Footnote delay={crossAt}>
        {'stop_reason is unreliable —— 第三方的源码分析 · 开源最简实现仍按停止标记判定，官方实现已改为查内容块'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 1-E 三相环 + 人的打断针 + State 十格抽屉墙（Harness Engineering 改造版）
 *  官方三相：收集上下文 / 采取行动 / 验证结果——交融旋转，不是硬阶段；
 *  手图标随时落向环上节点（人可打断）；右侧十格抽屉墙以角标清单形式一闪。 */
const ThreePhaseRing: React.FC<{phaseAt: number; handAt: number; drawersAt: number; recedeAt: number}> = ({
  phaseAt,
  handAt,
  drawersAt,
  recedeAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dot = useRingDot(2.5);
  const phases = [
    {label: '收集上下文', zh: '读文件 · 搜代码', ang: -90},
    {label: '采取行动', zh: '改文件 · 跑命令', ang: 30},
    {label: '验证结果', zh: '看输出 · 再补一刀', ang: 150},
  ];
  const recede = interpolate(frame - recedeAt, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hand = spring({frame: frame - handAt, fps, config: {damping: 170}});
  const drawerOn = interpolate(frame - drawersAt, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const CX = 560;
  const CY = 500;
  const R = 250;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: CX - 420,
          top: CY - 340,
          transform: `scale(${1 - recede * 0.12})`,
          opacity: 1 - recede * 0.5,
        }}
      >
        <LoopRing size={340} draw={1} dotProgress={dot} showExit={false} />
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        {/* 三个相位标签：沿环依次点亮并保持同时可见（交融感） */}
        {phases.map((ph, i) => {
          const on = interpolate(frame - phaseAt - i * 10, [0, 12], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const rad = (ph.ang * Math.PI) / 180;
          const lx = CX + Math.cos(rad) * (R + 96);
          const ly = CY + Math.sin(rad) * (R + 96);
          const nodeX = CX + Math.cos(rad) * R;
          const nodeY = CY + Math.sin(rad) * R;
          return (
            <g key={ph.label} opacity={on}>
              <line x1={nodeX} y1={nodeY} x2={lx} y2={ly} stroke={theme.mech} strokeWidth={3} opacity={0.55} />
              <circle cx={nodeX} cy={nodeY} r={11} fill={theme.mech} opacity={0.9} />
              <text x={lx} y={ly - 10} textAnchor="middle" fontFamily={theme.sans} fontSize={30} fill={theme.text}>
                {ph.label}
              </text>
              <text x={lx} y={ly + 26} textAnchor="middle" fontFamily={theme.sans} fontSize={21} fill={theme.dim}>
                {ph.zh}
              </text>
            </g>
          );
        })}
        {/* 「交融」标注：三段弧互相咬合（非硬阶段） */}
        {frame > phaseAt + 34 ? (
          <text x={CX} y={CY - R - 148} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.dim}>
            {'三相互相交融——不是硬阶段'}
          </text>
        ) : null}
        {/* 人的手：落向「行动」节点，环上光点被拨偏一档 */}
        {hand > 0 ? (
          <g opacity={hand} transform={`translate(0 ${(1 - hand) * -60})`}>
            <path
              d={`M${CX + R + 210} ${CY - 250} l-52 88`}
              stroke={theme.core}
              strokeWidth={9}
              strokeLinecap="round"
            />
            <circle cx={CX + R + 216} cy={CY - 262} r={26} fill="none" stroke={theme.core} strokeWidth={7} />
            <text
              x={CX + R + 210}
              y={CY - 300}
              textAnchor="middle"
              fontFamily={theme.sans}
              fontSize={25}
              fill={theme.core}
            >
              {'你，随时插入'}
            </text>
          </g>
        ) : null}
      </svg>
      {/* 右侧十格抽屉墙（State 字段，角标清单形式） */}
      <div
        style={{
          position: 'absolute',
          right: 170,
          top: 320,
          width: 460,
          opacity: drawerOn * (1 - recede * 0.35),
          transform: `translateX(${(1 - drawerOn) * 30}px)`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginBottom: 12}}>
          {'实际实现随身带的状态（十样）'}
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10}}>
          {[
            '消息列表',
            '工具与权限上下文',
            '压缩状态追踪',
            '输出补救次数',
            '本轮是否压缩过',
            '输出上限覆盖',
            '后台摘要',
            '钩子拦过停机',
            '轮数计数',
            '上次继续原因',
          ].map((label, i) => {
            const e = interpolate(frame - drawersAt - i * 2, [0, 8], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div
                key={label}
                style={{
                  border: `1px solid ${theme.panelBorder}`,
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontFamily: theme.sans,
                  fontSize: 19,
                  color: theme.dim,
                  background: theme.panel,
                  opacity: e,
                }}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>
      <Footnote delay={drawersAt}>{'三相与打断 —— 官方文档 how-claude-code-works · State 字段为第三方的源码分析'}</Footnote>
    </AbsoluteFill>
  );
};

/** 1-F 退出路径五条支线，随后降亮，主环不变 */
const ExitPaths: React.FC<{branchAt: number; dimAt: number}> = ({branchAt, dimAt}) => {
  const frame = useCurrentFrame();
  const names = ['报错', '中断', '钩子叫停', '轮数到顶', '预算烧完'];
  const dim = interpolate(frame - dimAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1300, height: 520}}>
        <div style={{position: 'absolute', left: 120, top: 40}}>
          <LoopRing size={420} draw={1} dotProgress={useRingDot(2.5)} />
        </div>
        <svg width={1300} height={520} style={{position: 'absolute', left: 0, top: 0}}>
          {names.map((n, i) => {
            const t = interpolate(frame - branchAt - i * 6, [0, 16], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const y0 = 240;
            const y1 = 96 + i * 76;
            const x0 = 618;
            const x1 = 900;
            return (
              <g key={n} opacity={(1 - dim * 0.7) * (t > 0 ? 1 : 0)}>
                <path
                  d={`M${x0} ${y0} C ${x0 + 90} ${y0}, ${x1 - 90} ${y1}, ${x0 + (x1 - x0) * t} ${y0 + (y1 - y0) * t}`}
                  stroke={theme.core}
                  strokeWidth={3}
                  fill="none"
                  opacity={0.75}
                />
                {t > 0.9 ? (
                  <text
                    x={x1 + 16}
                    y={y1 + 8}
                    fontFamily={theme.sans}
                    fontSize={26}
                    fill={dim > 0.5 ? theme.dim : theme.text}
                  >
                    {n}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <Footnote delay={dimAt}>{'它们是保护装置，不是骨架'}</Footnote>
    </AbsoluteFill>
  );
};

export const P1Loop: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const bA = w('p1-01', 'p1-06');
  const rA = (id: string) => w(id).from - bA.from;
  const bB = w('p1-08', 'p1-12');
  const rB = (id: string) => w(id).from - bB.from;
  const bC = w('p1-12a', 'p1-16');
  const rC = (id: string) => w(id).from - bC.from;
  const bD = w('p1-17', 'p1-24');
  const rD = (id: string) => w(id).from - bD.from;
  const bE = w('p1-25', 'p1-29');
  const rE = (id: string) => w(id).from - bE.from;
  const bF = w('p1-30', 'p1-32');
  const rF = (id: string) => w(id).from - bF.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P1" title="一个循环，就是全部" meta="Agent Loop · gather / act / verify" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="1-A 环形循环成形">
        <RingBirth yesAt={rA('p1-04')} noAt={rA('p1-06')} />
      </Sequence>
      <Sequence {...bB} name="1-B 五步与 messages 面板">
        <FiveSteps stepAt={[rB('p1-09'), rB('p1-09') + 20, rB('p1-10'), rB('p1-11'), rB('p1-12')]} />
      </Sequence>
      <Sequence {...bC} name="1-C 二十三行与分工">
        {/* p1-12a 来源标签条滑入 → p1-12b 对照列浮出 → 代码逐行 → p1-14 计数 → p1-15 分屏 */}
        <TwentyThreeLines
          tagAt={rC('p1-12a')}
          compareAt={rC('p1-12b')}
          countAt={rC('p1-14')}
          splitAt={rC('p1-15')}
        />
      </Sequence>
      <Sequence {...bD} name="1-D 停止标记不可靠">
        <UnreliableFlag crossAt={rD('p1-22')} quoteAt={rD('p1-24')} />
      </Sequence>
      <Sequence {...bE} name="1-E 三相环与打断">
        <ThreePhaseRing phaseAt={rE('p1-25')} handAt={rE('p1-27')} drawersAt={rE('p1-28')} recedeAt={rE('p1-29')} />
      </Sequence>
      <Sequence {...bF} name="1-F 退出路径">
        <ExitPaths branchAt={rF('p1-30')} dimAt={rF('p1-32')} />
      </Sequence>
    </AbsoluteFill>
  );
};
