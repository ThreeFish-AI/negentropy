/** P4 挂在循环上，不写进循环里（分镜 4-A…4-H）—— 开源示教素材「Hook Workbench」的概念重建
 *  4-E 刻意「无动效」表达「循环是故意保持无聊的」；4-G 是全片安全主题的收口。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {CodeCard, Counter, Footnote, LoopRing, Panel, SLOT_GAP, SLOT_W, SceneHeader, SlotRing, useRingDot} from '../components/motifs';

const SLOTS = [
  {name: '进入模型之前', when: '你的话交出去，还没进模型', callbacks: ['校验输入 / 补背景']},
  {name: '工具执行之前', when: '要执行，还没执行', callbacks: ['三道闸门', '记日志']},
  {name: '工具执行之后', when: '执行完，还没进下一轮', callbacks: ['自动提交 / 大输出提醒']},
  {name: '循环停机之前', when: '准备退出', callbacks: ['收尾统计 / 说「别停」']},
];

/** 4-A 三条需求扎进环内部，环线被撑粗并出现应力点 */
const NeedsPierce: React.FC<{needAt: number; pierceAt: number}> = ({needAt, pierceAt}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  const needs = ['每次跑命令记一笔日志', '某些操作后自动提交代码', '危险动作往群里发通知'];
  const pierce = interpolate(frame - pierceAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 80}}>
            <div style={{position: 'relative'}}>
        <LoopRing size={400} draw={1} dotProgress={dot} />
        {pierce > 0.4 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 999,
              boxShadow: `0 0 ${26 * pierce}px ${theme.deny}`,
              opacity: pierce - 0.4,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
      <div>
        {needs.map((n, i) => {
          const t = interpolate(frame - needAt - i * 8, [0, 14], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={n}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 22,
                opacity: t,
                transform: `translateX(${(1 - t) * 26 - pierce * 40}px)`,
              }}
            >
              <span style={{fontSize: 32, color: theme.deny, opacity: pierce}}>{'←'}</span>
              <Panel style={{padding: '14px 22px'}}>
                <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{n}</span>
              </Panel>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 4-B 退化的循环：五行杂活把 while 挤出视区 */
const DegradedLoop: React.FC<{quoteAt: number}> = ({quoteAt}) => {
  const frame = useCurrentFrame();
  if (frame >= quoteAt) {
    return <QuoteCard zh="扩展行为 ≠ 修改内核 —— 挂在外面，而不是写进去" accent={theme.deny} />;
  }
  const lines = [
    'def agent_loop(messages):',
    '    while True:',
    '        # ... LLM call ...',
    '        for block in tool_calls:',
    '            log_to_file(block)        # 加一行',
    '            check_permission(block)   # 加一行',
    '            notify_slack(block)       # 又加一行',
    '            output = execute(block)',
    '            auto_git_add(block)       # 再加一行',
    '            # ... 很快循环就认不出来了',
  ];
  const inserted = Math.min(5, Math.max(0, Math.floor((frame - 6) / 14)));
  const shift = inserted * 26;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', overflow: 'hidden'}}>
      <div style={{transform: `translateY(${shift}px)`}}>
        <CodeCard
          lines={lines}
          width={1000}
          framesPerLine={7}
          highlight={[4, 5, 6, 8]}
          showLineNumbers={false}
          accent={inserted >= 4 ? theme.deny : undefined}
        />
      </div>
    </AbsoluteFill>
  );
};

/** 4-C 杂活被拔出循环、变成回调卡，环恢复原线宽 */
const PullOut: React.FC<{tableAt: number; plugAt: number}> = ({tableAt, plugAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dot = useRingDot(2.5);
  const out = interpolate(frame, [0, 26], [0, 1], {extrapolateRight: 'clamp'});
  const plug = spring({frame: frame - plugAt, fps, config: {damping: 12}});
  const flash = frame >= plugAt + 6 && frame < plugAt + 8;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 70}}>
      <div style={{position: 'relative'}}>
        <LoopRing size={380} draw={1} dotProgress={dot} />
        {[0, 1, 2, 3].map((i) => {
          const ang = -60 + i * 40;
          const rad = (ang * Math.PI) / 180;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 190 + 218 * Math.cos(rad) - 11,
                top: 190 + 218 * Math.sin(rad) - 11,
                width: 22,
                height: 22,
                borderRadius: 4,
                border: `3px solid ${theme.mech}`,
                background: i === 0 && flash ? theme.mech : 'transparent',
                opacity: out,
              }}
            />
          );
        })}
      </div>
      <div>
        {frame >= tableAt ? (
          <Panel style={{padding: '18px 22px', width: 560}}>
            <div style={{display: 'flex', fontFamily: theme.sans, fontSize: 22, color: theme.dim, paddingBottom: 10}}>
              <div style={{flex: 1}}>{'时机'}</div>
              <div style={{flex: 1}}>{'要跑的函数'}</div>
            </div>
            {['进模型前', '执行前', '执行后', '停机前'].map((k, i) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  height: 48,
                  alignItems: 'center',
                  fontFamily: theme.mono,
                  fontSize: 24,
                  opacity: interpolate(frame - tableAt - i * 5, [0, 10], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                }}
              >
                <div style={{flex: 1, color: theme.mech}}>{k}</div>
                <div style={{flex: 1, color: theme.dim}}>{'[ … ]'}</div>
              </div>
            ))}
          </Panel>
        ) : null}
        {frame >= plugAt ? (
          <div
            style={{
              marginTop: 20,
              fontFamily: theme.serif,
              fontSize: 32,
              color: theme.mech,
              transform: `translateX(${(1 - plug) * -40}px)`,
            }}
          >
            {'加功能是插一个插头，不是重新布线'}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** 4-D 四个插口逐个亮起；执行前那个把 P3 的闸门收进来 */
const SlotsLightUp: React.FC<{slotAt: number[]; gateMoveAt: number; backflowAt: number}> = ({
  slotAt,
  gateMoveAt,
  backflowAt,
}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  const lit = slotAt.filter((a) => frame >= a).length - 1;
  const gm = interpolate(frame - gateMoveAt, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const back = interpolate(frame - backflowAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 容器尺寸由 SlotRing 的定位契约推导（见该组件 docstring），环居中
  const RING = 400;
  const W = RING + 2 * (SLOT_W + SLOT_GAP);
  const H = RING + 260;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: W, height: H}}>
        <div style={{position: 'absolute', left: (W - RING) / 2, top: (H - RING) / 2}}>
          <LoopRing size={RING} draw={1} dotProgress={dot} activeNode={lit === 3 ? 0 : undefined} />
        </div>
        <SlotRing slots={SLOTS} lit={lit} size={RING} />
        {/* P3 的三道闸门缩小平移进右上角的「工具执行之前」插槽（跨幕视觉呼应） */}
        {gm > 0 ? (
          <svg
            width={220}
            height={90}
            style={{
              position: 'absolute',
              /* 终点对准右上角插槽的左缘与垂直中部：起点在环右侧（P3 闸门的位置），
                 gm=1 时贴到该插槽旁，读作「闸门被搬进这个插口」 */
              left: W / 2 + 60 + gm * (W - SLOT_W - 100 - (W / 2 + 60)),
              top: H / 2 - 45 - gm * (H / 2 - 105),
              opacity: 1 - gm * 0.35,
            }}
          >
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                x={20 + i * 42}
                y={18 * gm}
                width={11 * (1 - gm * 0.4)}
                height={54 * (1 - gm * 0.45)}
                rx={4}
                fill={i === 0 ? theme.deny : 'none'}
                stroke={i === 0 ? theme.deny : theme.mech}
                strokeWidth={3}
                strokeDasharray={i === 2 ? '7 5' : undefined}
              />
            ))}
          </svg>
        ) : null}
        {/* 「别停，接着干」：从左下角插槽回流到环的入口（问模型节点） */}
        {back > 0 ? (
          <svg
            width={W}
            height={H}
            style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}
          >
            <path
              d={`M ${SLOT_W - 20} ${H - 90} C ${SLOT_W + 60} ${H - 60}, ${W / 2 - 130} ${H / 2}, ${W / 2 - 8} ${(H - RING) / 2 + 30}`}
              stroke={theme.core}
              strokeWidth={4}
              fill="none"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - back}
            />
            {back > 0.9 ? (
              <text
                x={SLOT_W + 90}
                y={H / 2 + 70}
                fontFamily={theme.sans}
                fontSize={24}
                fill={theme.core}
              >
                {'别停，接着干'}
              </text>
            ) : null}
          </svg>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** 4-E 四点沿环脉冲一圈；金句期间刻意零动效。
 *  喇叭图标改挂 p4-20 句尾（原 p4-21 已并入 p4-20——四点脉冲走完后喇叭才落位）。 */
const BoringOnPurpose: React.FC<{hornsAt: number; quoteAt: number}> = ({hornsAt, quoteAt}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  if (frame >= quoteAt) {
    // 金句期间：环继续匀速转，不做任何强调动效——用「无动效」表达「故意保持无聊」
    return (
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
        <div style={{position: 'absolute', opacity: 0.35}}>
          <LoopRing size={420} draw={1} dotProgress={dot} showExit={false} />
        </div>
        <QuoteCard zh="Boring by design —— 内核越无聊，系统越可靠" accent={theme.core} />
      </AbsoluteFill>
    );
  }
  const which = Math.floor(frame / 8) % 4;
  // 四点脉冲一圈（各 8 帧）后喇叭浮出（p4-20 句尾）
  const horns = interpolate(frame - hornsAt, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative'}}>
        <LoopRing size={460} draw={1} dotProgress={dot} activeNode={which} />
        {/* 四个「喊一声」点：绘制喇叭（喇叭口朝外），不用 emoji——
            Apple Color Emoji 可能以全彩字形击穿三色契约（全系列纪律） */}
        <svg
          width={460}
          height={460}
          style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}
        >
          {[0, 1, 2, 3].map((i) => {
            const ang = -90 + i * 90;
            const rad = (ang * Math.PI) / 180;
            const cx = 230 + 184 * Math.cos(rad);
            const cy = 230 + 184 * Math.sin(rad);
            const o = (which === i ? 1 : 0.3) * horns;
            // 喇叭主体朝外旋转（角点指向环外）
            const rot = ang + 90;
            return (
              <g
                key={i}
                transform={`translate(${cx} ${cy}) rotate(${rot})`}
                stroke={theme.mech}
                strokeWidth={3.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={o}
              >
                <path d="M-4 -9 L5 -9 L14 -17 L14 17 L5 9 L-4 9 Z" fill={theme.panel} />
                {which === i
                  ? [0, 1].map((a) => (
                      <path
                        key={a}
                        d={
                          a === 0
                            ? 'M19 -7 A9 9 0 0 1 19 7'
                            : 'M24 -12 A14 14 0 0 1 24 12'
                        }
                        fill="none"
                      />
                    ))
                  : null}
              </g>
            );
          })}
        </svg>
      </div>
      <Footnote delay={10}>{'循环只负责在这四个点上喊一声'}</Footnote>
    </AbsoluteFill>
  );
};

/** 4-F 31 事件 × 三节奏三层嵌套（Harness Engineering 改造版，官方文档口径）
 *  三层嵌套：外层 = 会话（一次）、中层 = 回合（每轮一次）、内层 = 工具调用（每次前后）。
 *  计数徽章滚到 31；右栏异步事件（不入嵌套的独立时机）。 */
const HookNesting: React.FC<{outerAt: number; midAt: number; innerAt: number; countAt: number; asyncAt: number}> = ({
  outerAt,
  midAt,
  innerAt,
  countAt,
  asyncAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 三层依次成形的进度
  const o = interpolate(frame - outerAt, [0, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const m = interpolate(frame - midAt, [0, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const i = interpolate(frame - innerAt, [0, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // 内层光点沿「工具前→执行→工具后→整批落定」跑一圈
  const lap = ((frame - innerAt) % 80) / 80;
  const lapOn = frame >= innerAt + 16;
  const asyncEvents = ['会话开始', '会话结束', '配置变更', '目录切换', '文件被改', '通知'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1500, height: 640}}>
        {/* 外层：会话框 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 460,
            bottom: 0,
            border: `3px solid ${o < 1 ? theme.mech : theme.panelBorder}`,
            borderRadius: 18,
            opacity: o,
            padding: '18px 26px',
            background: o < 1 ? `${theme.mech}10` : 'transparent',
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>
            {'会话 Session'}
            <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginLeft: 14}}>
              {'一次'}
            </span>
          </div>
          {/* 中层：回合框（×N 视觉重复） */}
          <div
            style={{
              margin: '22px 6px 0',
              border: `2px solid ${m < 1 ? theme.mech : theme.panelBorder}`,
              borderRadius: 14,
              opacity: m,
              padding: '14px 20px',
              position: 'relative',
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.text}}>
              {'回合 Turn'}
              <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginLeft: 10}}>{'×N'}</span>
              <span style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginLeft: 12}}>{'每轮一次'}</span>
            </div>
            {/* 内层：工具调用链 */}
            <div
              style={{
                margin: '18px 4px 0',
                border: `2px dashed ${i < 1 ? theme.mech : theme.panelBorder}`,
                borderRadius: 12,
                opacity: i,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 22,
              }}
            >
              {['工具前', '执行', '工具后', '整批落定'].map((s, k) => {
                const active = lapOn && lap > k / 4 && lap < (k + 1) / 4;
                return (
                  <React.Fragment key={s}>
                    {k > 0 ? (
                      <svg width={54} height={20}>
                        <line x1={0} y1={10} x2={44} y2={10} stroke={theme.dim} strokeWidth={2.5} />
                        <polygon points="44,10 36,5 36,15" fill={theme.dim} />
                      </svg>
                    ) : null}
                    <span
                      style={{
                        fontFamily: theme.sans,
                        fontSize: 21,
                        color: active ? theme.mech : theme.dim,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
        {/* 右栏：异步事件 */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 10,
            width: 420,
            opacity: interpolate(frame - asyncAt, [0, 16], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginBottom: 12}}>
            {'另有独立的时机（异步）'}
          </div>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
            {asyncEvents.map((e, k) => (
              <div
                key={e}
                style={{
                  border: `1px solid ${theme.panelBorder}`,
                  borderRadius: 8,
                  padding: '9px 12px',
                  fontFamily: theme.sans,
                  fontSize: 19,
                  color: theme.dim,
                  background: theme.panel,
                  opacity: interpolate(frame - asyncAt - k * 3, [0, 8], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                }}
              >
                {e}
              </div>
            ))}
          </div>
        </div>
        {/* 计数徽章 */}
        <div
          style={{
            position: 'absolute',
            right: 30,
            bottom: 24,
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          <Counter from={0} to={31} start={countAt} frames={50} style={{fontSize: 70, color: theme.mech, fontWeight: 700}} />
          <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'个时机'}</span>
        </div>
      </div>
      <Footnote delay={asyncAt}>
        {'31 个 hook 事件 × 三种节奏 —— 官方文档 hooks reference（事件表逐行计数，取数2026年8月）'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 4-G 印章对撞：hook 的 allow 顶不过配置里的 deny/ask */
const StampClash: React.FC<{
  pushAt: number;
  blockAt: number;
  arrowAt: number;
  gapAt: number;
  quoteAt: number;
}> = ({pushAt, blockAt, arrowAt, gapAt, quoteAt}) => {
  const frame = useCurrentFrame();
  if (frame >= quoteAt) {
    return <QuoteCard zh="限制只能叠加，不能削减 —— 单向棘轮" accent={theme.core} />;
  }
  const push = interpolate(frame - pushAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const blocked = frame >= blockAt;
  /* 「顶住」不能是一次性瞬间事件：旁白「配置里的禁止和询问仍然要再走一遍」有 4 秒多，
     若冲击波 16 帧就衰减完，画面在这句的大部分时间里是静止的、读不出对撞。
     故弹回后保持一个持续的抵抗抖动（幅度小、周期慢），直到本 beat 结束。 */
  const bounce = blocked
    ? interpolate(frame - blockAt, [0, 10, 24], [0, -34, -22], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }) + (frame - blockAt > 24 ? Math.sin((frame - blockAt) / 7) * 3.5 : 0)
    : 0;
  // 冲击波每 34 帧复发一次（持续施压 → 持续被顶回）
  const shock = blocked
    ? interpolate((frame - blockAt) % 34, [0, 16], [0, 1], {extrapolateRight: 'clamp'})
    : 0;
  const arrow = interpolate(frame - arrowAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const gap = frame >= gapAt;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1560, height: 660}}>
        {/* 上层：hook 说「我批了」——向下推进，被下层顶回 */}
        <div
          style={{
            position: 'absolute',
            left: 300,
            top: 20 + push * 150 + bounce,
            width: 640,
          }}
        >
          <Panel accent={theme.core} style={{padding: '30px 40px', background: theme.coreDeep}}>
            <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.dim}}>
              {'插口上的脚本返回'}
            </div>
            <div style={{fontFamily: theme.serif, fontSize: 62, color: theme.core, fontWeight: 700}}>
              {'这个我批了'}
            </div>
          </Panel>
        </div>
        {/* 下层：配置里的禁止/询问，升起顶住 */}
        <div style={{position: 'absolute', left: 300, top: 396, display: 'flex', gap: 26}}>
          {[
            {t: '禁止', c: theme.deny},
            {t: '询问', c: theme.mech},
          ].map((s) => (
            <Panel key={s.t} accent={s.c} style={{padding: '26px 52px', width: 307}}>
              <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
                {'配置文件里的'}
              </div>
              <div style={{fontFamily: theme.serif, fontSize: 54, color: s.c, fontWeight: 700}}>
                {s.t}
              </div>
            </Panel>
          ))}
        </div>
        {shock > 0 ? (
          <svg width={1560} height={660} style={{position: 'absolute', left: 0, top: 0}}>
            {[0, 1].map((k) => (
              <circle
                key={k}
                cx={620}
                cy={382}
                r={30 + shock * (120 + k * 60)}
                fill="none"
                stroke={theme.deny}
                strokeWidth={5 - k * 2}
                opacity={(1 - shock) * (1 - k * 0.4)}
              />
            ))}
          </svg>
        ) : null}
        {arrow > 0 ? (
          <div style={{position: 'absolute', left: 1010, top: 150, width: 500, opacity: arrow}}>
            <Panel accent={theme.mech} style={{padding: '20px 26px', marginBottom: 20}}>
              <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.mech}}>
                {'加限制　↑　可以'}
              </div>
            </Panel>
            <Panel accent={theme.deny} style={{padding: '20px 26px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.deny}}>
                {'解除限制　↓　不行'}
              </div>
            </Panel>
            <div
              style={{
                marginTop: 18,
                fontFamily: theme.serif,
                fontSize: 26,
                color: theme.dim,
                lineHeight: 1.5,
              }}
            >
              {'方向是单向的'}
            </div>
          </div>
        ) : null}
        {gap ? (
          <div
            style={{
              position: 'absolute',
              left: 300,
              top: 552,
              width: 640,
              border: `3px dashed ${theme.deny}`,
              borderRadius: 10,
              padding: '14px 18px',
              fontFamily: theme.sans,
              fontSize: 26,
              color: theme.deny,
              textAlign: 'center',
            }}
          >
            {'最简实现缺这一层 → 生产环境的安全漏洞'}
          </div>
        ) : null}
      </div>
      <Footnote delay={arrowAt}>
        {'hook allow 不能绕过 settings 的 deny/ask —— 第三方的源码分析'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 4-G' 六道闸门流水线（官方 SDK 权限判定图）：同一轨道跑三枚球做对照——
 *  球 A「沉默」（p4-28，hook 站无扰动通过，沉默≠批准照走流程）、
 *  球 B「我拦了」（p4-28a/b，全速穿六站直达 Execute，到达瞬间标签翻「静默失效」）、
 *  球 C「我批了」（p4-29/30，deny 站被截入 Blocked）+ p4-31 全放行模式重跑仍被截。
 *  官方把权限判定画成六站；本片高潮句「扩展点能加限制，不能解除限制」的官方背书。 */
const SixGatePipeline: React.FC<{
  railAt: number;
  silentAt: number;
  fakeAt: number;
  exitNoteAt: number;
  runAt: number;
  yoloAt: number;
}> = ({railAt, silentAt, fakeAt, exitNoteAt, runAt, yoloAt}) => {
  const frame = useCurrentFrame();
  const stations = [
    {t: 'hook', sub: '扩展点'},
    {t: 'deny', sub: '拒绝'},
    {t: 'ask', sub: '询问'},
    {t: 'settings', sub: '配置'},
    {t: 'mode', sub: '模式'},
    {t: '默认', sub: '兜底问你'},
  ];
  const rail = interpolate(frame - railAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 球 A（p4-28）：从 hook 站无扰动通过、继续走 deny/ask 站——沉默≠批准，照走正常流程
  const travelA = interpolate(frame - silentAt, [0, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 球 B（p4-28a/b）：全速穿过全部六站直达 Execute；到达瞬间标签翻「静默失效」
  const travelB = interpolate(frame - fakeAt, [0, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 球 C（p4-29/30）：行至 deny 站被截入 Blocked
  const travelC = interpolate(frame - runAt, [0, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const yolo = frame >= yoloAt;
  // 球 C 在 deny 站（第 2 站，轨道 1/6~2/6 段中点）被截
  const cutAt = 1 / 6 + 0.5 / 6;
  const stopped = travelC > cutAt;
  const PX = 160;
  const GAP = 260;
  const RAIL_END = PX + GAP * 5;
  const ballAX = PX + (GAP * 5) * travelA;
  const ballBX = PX + (GAP * 5) * Math.min(travelB, 1);
  const ballCX = PX + (GAP * 5) * Math.min(travelC, cutAt);
  const bDone = travelB >= 1;
  // 球 A 停在 ask 站后淡出（把注意力让给 B/C 两球）
  const aFade = interpolate(frame - silentAt - 56, [0, 14], [1, 0.25], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // exit 码角标（p4-28c）
  const exitNote = interpolate(frame - exitNoteAt, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const label = (x: number, y: number, text: string, color: string, strike = false) => (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontFamily={theme.sans}
      fontSize={21}
      fill={color}
      textDecoration={strike ? 'line-through' : 'none'}
    >
      {text}
    </text>
  );
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1660, height: 480}}>
        <svg width={1660} height={480} style={{position: 'absolute'}}>
          <line x1={PX} y1={250} x2={PX + GAP * 5 + 60} y2={250} stroke={theme.panelBorder} strokeWidth={5} opacity={rail} />
          {/* 两端终点：Execute / Blocked */}
          {rail > 0.8 ? (
            <>
              <circle cx={PX + GAP * 5 + 110} cy={250} r={40} fill="none" stroke={theme.core} strokeWidth={4} opacity={0.9} />
              <text x={PX + GAP * 5 + 110} y={258} textAnchor="middle" fontFamily={theme.mono} fontSize={17} fill={theme.core}>
                Execute
              </text>
              <circle cx={PX + GAP * 0.5} cy={330} r={36} fill="none" stroke={theme.deny} strokeWidth={4} />
              <text x={PX + GAP * 0.5} y={338} textAnchor="middle" fontFamily={theme.mono} fontSize={16} fill={theme.deny}>
                Blocked
              </text>
            </>
          ) : null}
          {/* 球 A（沉默，dim）：hook 站无扰动通过——hook 沉默≠批准，照走 deny/ask */}
          {rail > 0.8 && travelA > 0 ? (
            <>
              <line x1={PX} y1={250} x2={ballAX} y2={250} stroke={theme.dim} strokeWidth={3} opacity={0.45 * aFade} />
              <circle cx={ballAX} cy={250} r={12} fill={theme.dim} opacity={aFade} />
              {label(ballAX, 218, '沉默', theme.dim)}
            </>
          ) : null}
          {/* 球 B（我拦了，deny）：全速直达 Execute；到达瞬间标签翻「静默失效」 */}
          {rail > 0.8 && travelB > 0 ? (
            <>
              <line x1={PX} y1={250} x2={ballBX} y2={250} stroke={theme.deny} strokeWidth={3} opacity={0.5} />
              <circle
                cx={ballBX}
                cy={250}
                r={12}
                fill={theme.deny}
                style={bDone ? {filter: `drop-shadow(0 0 14px ${theme.deny})`} : undefined}
              />
              {bDone
                ? label(ballBX, 218, '静默失效', theme.deny)
                : label(ballBX, 218, '我拦了', theme.deny)}
            </>
          ) : null}
          {/* 球 C（我批了，core）：deny 站被截入 Blocked（deny 辉光） */}
          {rail > 0.8 && travelC > 0 ? (
            <>
              <circle
                cx={ballCX}
                cy={stopped ? 292 : 250}
                r={13}
                fill={stopped ? theme.deny : theme.core}
                style={stopped ? {filter: `drop-shadow(0 0 16px ${theme.deny})`} : undefined}
              />
              {!stopped ? (
                <line x1={PX} y1={250} x2={ballCX} y2={250} stroke={theme.core} strokeWidth={3} opacity={0.5} />
              ) : (
                <line x1={ballCX} y1={250} x2={PX + GAP * 0.5} y2={330} stroke={theme.deny} strokeWidth={3} strokeDasharray="6 5" />
              )}
              {stopped
                ? label(ballCX, 270, '出局', theme.deny)
                : label(ballCX, 218, '我批了', theme.core)}
            </>
          ) : null}
        </svg>
        {/* 六站 */}
        {stations.map((st, i) => {
          const at = railAt + 6 + i * 4;
          const e = interpolate(frame - at, [0, 10], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const isDeny = st.t === 'deny';
          const bypassed = yolo && (st.t === 'mode');
          return (
            <div
              key={st.t}
              style={{
                position: 'absolute',
                left: PX + GAP * i - 90,
                top: 108,
                width: 180,
                textAlign: 'center',
                opacity: e * (bypassed ? 0.35 : 1),
              }}
            >
              <svg width={60} height={64} style={{display: 'block', margin: '0 auto 6px'}}>
                <line x1={30} y1={64} x2={30} y2={26} stroke={isDeny ? theme.deny : theme.mech} strokeWidth={6} />
                <circle cx={30} cy={16} r={9} fill={isDeny ? theme.deny : theme.mech} />
              </svg>
              <div style={{fontFamily: theme.mono, fontSize: 22, color: isDeny ? theme.deny : theme.text}}>{st.t}</div>
              <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 2}}>{st.sub}</div>
            </div>
          );
        })}
        {/* exit 码角标（p4-28c）：唯一硬信号 */}
        {exitNote > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 64,
              textAlign: 'center',
              fontFamily: theme.mono,
              fontSize: 21,
              color: theme.dim,
              opacity: exitNote,
            }}
          >
            {'唯一凭退出码单独阻断的是 exit 2；exit 1 = 非阻断错误，动作照跑'}
          </div>
        ) : null}
        {yolo ? (
          <div
            style={{
              position: 'absolute',
              right: 30,
              bottom: 20,
              fontFamily: theme.sans,
              fontSize: 23,
              color: theme.deny,
              opacity: interpolate(frame - yoloAt, [0, 12], [0, 1], {extrapolateRight: 'clamp'}),
            }}
          >
            {'全放行模式也一样：拒绝压得住'}
          </div>
        ) : null}
      </div>
      <Footnote delay={railAt}>
        {'六道闸门判定顺序 —— 官方 Agent SDK permissions 文档'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 4-H 自激小闭环，被一枚标记截断 */
const SelfLoopBreak: React.FC<{spinAt: number; markAt: number}> = ({spinAt, markAt}) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - spinAt);
  const durs = [34, 26, 20];
  let acc = 0;
  let lap = 0;
  let within = 0;
  for (let i = 0; i < durs.length; i++) {
    if (t < acc + durs[i]) {
      lap = i;
      within = (t - acc) / durs[i];
      break;
    }
    acc += durs[i];
    lap = i + 1;
    within = 0;
  }
  const marked = frame >= markAt;
  // 第四圈行进到标记处被截断
  const angle = marked ? -30 : -90 + within * 360;
  const cx = 260;
  const cy = 220;
  const r = 128;
  const rad = (angle * Math.PI) / 180;
  const heat = Math.min(1, lap / 2.5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 80}}>
        <svg width={520} height={440}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={heat > 0.5 ? theme.deny : theme.mech}
            strokeWidth={5}
            opacity={0.5 + heat * 0.5}
          />
          {!marked ? (
            <circle cx={cx + r * Math.cos(rad)} cy={cy + r * Math.sin(rad)} r={12} fill={theme.deny} />
          ) : null}
          <text x={cx} y={cy - r - 22} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.dim}>
            {'插口说「别停」'}
          </text>
          <text x={cx} y={cy + r + 40} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.dim}>
            {'模型干完又要停'}
          </text>
          {marked ? (
            <rect
              x={cx + r * Math.cos((-30 * Math.PI) / 180) - 16}
              y={cy + r * Math.sin((-30 * Math.PI) / 180) - 16}
              width={32}
              height={32}
              rx={5}
              fill={theme.core}
            />
          ) : null}
        </svg>
        <div style={{width: 420}}>
          <div style={{fontFamily: theme.serif, fontSize: 38, color: marked ? theme.core : theme.dim}}>
            {marked ? '一个字段，堵住一个死循环' : '转不出来了'}
          </div>
          {marked ? (
            <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim, marginTop: 16}}>
              {'stopHookActive = true'}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P4Hooks: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const rel = (b: {from: number}, id: string) => w(id).from - b.from;
  /** 句尾锚（全局帧）：分镜「pX-YY 句尾」的机械化落点 */
  const endAt = (id: string) => w(id).from + w(id).durationInFrames;
  const bA = w('p4-01', 'p4-04');
  const bB = w('p4-05', 'p4-07');
  const bC = w('p4-08', 'p4-12');
  const bD = w('p4-13', 'p4-19');
  const bE = w('p4-20', 'p4-22');
  const bF = w('p4-23', 'p4-25');
  const bG1 = w('p4-27', 'p4-31');
  const bG2 = w('p4-32', 'p4-34');
  const bH = w('p4-35', 'p4-37');
  return (
    <AbsoluteFill>
      <SceneHeader index="P4" title="挂在循环上，不写进循环里" meta="Hooks · 31 events × 3 rhythms" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="4-A 需求扎进循环">
        <NeedsPierce needAt={rel(bA, 'p4-03')} pierceAt={rel(bA, 'p4-04')} />
      </Sequence>
      <Sequence {...bB} name="4-B 退化的循环">
        <DegradedLoop quoteAt={rel(bB, 'p4-07')} />
      </Sequence>
      <Sequence {...bC} name="4-C 杂活拔出循环">
        <PullOut tableAt={rel(bC, 'p4-09')} plugAt={rel(bC, 'p4-11')} />
      </Sequence>
      <Sequence {...bD} name="4-D 四个插口">
        <SlotsLightUp
          slotAt={[rel(bD, 'p4-14'), rel(bD, 'p4-15'), rel(bD, 'p4-17'), rel(bD, 'p4-18')]}
          gateMoveAt={rel(bD, 'p4-15')}
          backflowAt={rel(bD, 'p4-19')}
        />
      </Sequence>
      <Sequence {...bE} name="4-E 故意保持无聊">
        {/* p4-20 句尾喇叭浮出（原 p4-21 并入 p4-20）；p4-22 金句（期间零强调动效） */}
        <BoringOnPurpose hornsAt={endAt('p4-20') - bE.from} quoteAt={rel(bE, 'p4-22')} />
      </Sequence>
      <Sequence {...bF} name="4-F 31 事件三层嵌套">
        <HookNesting outerAt={rel(bF, 'p4-23')} midAt={rel(bF, 'p4-24')} innerAt={rel(bF, 'p4-24') + 30} countAt={rel(bF, 'p4-24') + 10} asyncAt={rel(bF, 'p4-25')} />
      </Sequence>
      <Sequence {...bG1} name="4-G1 六闸流水线">
        {/* p4-27 起 +6 帧轨道描出（消除头空转）；p4-28 球 A；p4-28a/b 球 B；p4-28c 角标；
            p4-29/30 球 C 被截；p4-31 全放行重跑仍被截 */}
        <SixGatePipeline
          railAt={rel(bG1, 'p4-27') + 6}
          silentAt={rel(bG1, 'p4-28')}
          fakeAt={rel(bG1, 'p4-28a')}
          exitNoteAt={rel(bG1, 'p4-28c')}
          runAt={rel(bG1, 'p4-29')}
          yoloAt={rel(bG1, 'p4-31')}
        />
      </Sequence>
      <Sequence {...bG2} name="4-G2 印章对撞">
        <StampClash
          pushAt={4}
          blockAt={26}
          arrowAt={rel(bG2, 'p4-32')}
          gapAt={rel(bG2, 'p4-33')}
          quoteAt={rel(bG2, 'p4-34')}
        />
      </Sequence>
      <Sequence {...bH} name="4-H 自激闭环被截断">
        <SelfLoopBreak spinAt={rel(bH, 'p4-36')} markAt={rel(bH, 'p4-37')} />
      </Sequence>
    </AbsoluteFill>
  );
};
