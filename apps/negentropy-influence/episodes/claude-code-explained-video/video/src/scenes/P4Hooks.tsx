/** P4 挂在循环上，不写进循环里（分镜 4-A…4-H）—— 开源教学素材「Hook Workbench」的概念重建
 *  4-E 刻意「无动效」表达「循环是故意保持无聊的」；4-G 是全片安全主题的收口。
 *  重制（2026-09 运动层）：动效收敛到 motion 模型；冲击波/回流描线等 bespoke 项见各处 deferred 注记。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {
  CodeCard,
  Counter,
  Footnote,
  LoopRing,
  Panel,
  SceneTag,
  SLOT_GAP,
  SLOT_W,
  SlotRing,
  useRingDot,
} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {LottieEmphasis} from '../components/LottieEmphasis';
import {DUR, useAccelTravel, useProgress, useSpring, useStagger} from '../motion';

const SLOTS = [
  {name: '进入模型之前', when: '你的话交出去，还没进模型', callbacks: ['校验输入 / 补背景']},
  {name: '工具执行之前', when: '要执行，还没执行', callbacks: ['三道闸门', '记日志']},
  {name: '工具执行之后', when: '执行完，还没进下一轮', callbacks: ['自动提交 / 大输出提醒']},
  {name: '循环停机之前', when: '准备退出', callbacks: ['收尾统计 / 说「别停」']},
];

/** 4-A 三条需求扎进环内部，环线被撑粗并出现应力点 */
const NeedsPierce: React.FC<{needAt: number; pierceAt: number}> = ({needAt, pierceAt}) => {
  const dot = useRingDot(2.5);
  const needs = ['每次跑命令记一笔日志', '某些操作后自动提交代码', '危险动作往群里发通知'];
  // 环线应力撑开：20f → f6（13-21 档）
  const pierce = useProgress(pierceAt, DUR.f6);
  // 三张需求卡错峰滑入（stride 8、单项 14f → f6）
  const needP = useStagger(needs.length, {at: needAt, stride: 8, dur: DUR.f6});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 80}}>
      <SceneTag chapter="Hooks" tagline="Hang on the Loop, Don't Write into It" />
      <div style={{position: 'relative'}}>
        <LoopRing size={400} draw={1} dotProgress={dot} />
        {/* 应力辉光：原布尔门改常渲染，透明度自 0.4 起亮（负值钳 0） */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            boxShadow: `0 0 ${26 * pierce}px ${theme.deny}`,
            opacity: Math.max(0, pierce - 0.4),
            pointerEvents: 'none',
          }}
        />
      </div>
      <div>
        {needs.map((n, i) => {
          const t = needP[i];
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
    return <QuoteCard zh="你想扩展的是它的行为，你改的却是循环本身。" accent={theme.deny} />;
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
  // 逐条插入的量化节拍（14f 一档）：阶梯式挤出视区是刻意的量化舞台，不模型化
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
  const dot = useRingDot(2.5);
  // 拔出收束：26f 属 beat 级大位移（≥22，保留显式时长）
  const out = useProgress(0, 26);
  // 插头咬合的过冲：damping 12 即 snap 预设的锚定来源
  const plug = useSpring('snap', {at: plugAt});
  // 咬合瞬间强调由 LottieEmphasis 承载（2026-09 C 轨改造，替换原 2 帧布尔闪；
  // 资产为手工占位，见 public/lottie/README.md——#64C4C0 硬编码于 JSON，theme 改色需人工核对）
  const seatAt = plugAt + 6;
  // 表格与插头句：原布尔瞬现门 → 常渲染 + f3 淡入
  const tableOp = useProgress(tableAt, DUR.f3);
  const plugOp = useProgress(plugAt, DUR.f3);
  // 四行时机错峰浮现（stride 5、单项 10f → f5）
  const rowP = useStagger(4, {at: tableAt, stride: 5, dur: DUR.f5});
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
                background: 'transparent',
                opacity: out,
              }}
            />
          );
        })}
        {frame >= seatAt ? (
          // 锚定节点 1（ang=-20°，环右上「工具执行之前」插口）：中心 (394.9, 115.4)
          // = 190+218·cos(-20°) / 190+218·sin(-20°)，96×96 画布减半居中。
          // 不用节点 0（ang=-60°，中心 y≈1.2）——脉冲圈会溢出容器上沿。
          <LottieEmphasis
            src="lottie/plug-pulse.json"
            at={seatAt}
            duration={24}
            style={{position: 'absolute', left: 347, top: 67, width: 96, height: 96}}
          />
        ) : null}
      </div>
      {/* 两元素均为常规流子节点：布局门保留（常驻会把 Panel 顶高 ~80px），门内淡入 */}
      <div>
        {frame >= tableAt ? (
        <Panel style={{padding: '18px 22px', width: 560, opacity: tableOp}}>
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
                opacity: rowP[i],
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
            opacity: plugOp,
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
  // P3 闸门搬入插槽：24f 属 beat 级（≥22，保留显式时长）
  const gm = useProgress(gateMoveAt, 24);
  // 回流描线：22f 属 beat 级（≥22，保留显式时长）
  const back = useProgress(backflowAt, 22);
  // 闸门组原布尔瞬现门 → 常渲染 + f3 淡入（再叠加 gm 的压暗）
  const gateOp = useProgress(gateMoveAt, DUR.f3);
  // 容器尺寸由 SlotRing 的定位契约推导（见该组件 docstring），环居中
  const RING = 400;
  const W = RING + 2 * (SLOT_W + SLOT_GAP);
  const H = RING + 260;
  // 回流路径单点声明：描线由 @remotion/paths evolvePath 按真实路径长度插值
  const BACK_PATH = `M ${SLOT_W - 20} ${H - 90} C ${SLOT_W + 60} ${H - 60}, ${W / 2 - 130} ${H / 2}, ${W / 2 - 8} ${(H - RING) / 2 + 30}`;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: W, height: H}}>
        <div style={{position: 'absolute', left: (W - RING) / 2, top: (H - RING) / 2}}>
          <LoopRing size={RING} draw={1} dotProgress={dot} activeNode={lit === 3 ? 0 : undefined} />
        </div>
        <SlotRing slots={SLOTS} lit={lit} size={RING} />
        {/* P3 的三道闸门缩小平移进右上角的「工具执行之前」插槽（跨幕视觉呼应） */}
        <svg
          width={220}
          height={90}
          style={{
            position: 'absolute',
            /* 终点对准右上角插槽的左缘与垂直中部：起点在环右侧（P3 闸门的位置），
               gm=1 时贴到该插槽旁，读作「闸门被搬进这个插口」 */
            left: W / 2 + 60 + gm * (W - SLOT_W - 100 - (W / 2 + 60)),
            top: H / 2 - 45 - gm * (H / 2 - 105),
            opacity: gateOp * (1 - gm * 0.35),
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
        {/* 「别停，接着干」：从左下角插槽回流到环的入口（问模型节点） */}
        {back > 0 ? (
          <svg
            width={W}
            height={H}
            style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}
          >
            <path
              d={BACK_PATH}
              stroke={theme.core}
              strokeWidth={4}
              fill="none"
              {...evolvePath(back, BACK_PATH)}
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

/** 4-E 四点沿环脉冲一圈；金句期间刻意零动效 */
const BoringOnPurpose: React.FC<{quoteAt: number}> = ({quoteAt}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  if (frame >= quoteAt) {
    // 金句期间：环继续匀速转，不做任何强调动效——用「无动效」表达「故意保持无聊」
    return (
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
        <div style={{position: 'absolute', opacity: 0.35}}>
          <LoopRing size={420} draw={1} dotProgress={dot} showExit={false} />
        </div>
        <QuoteCard zh="这个循环是故意保持无聊的。" accent={theme.core} />
      </AbsoluteFill>
    );
  }
  const which = Math.floor(frame / 8) % 4;
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
            const o = which === i ? 1 : 0.3;
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
  // 三层依次成形的进度（单项 16f → f6）
  const o = useProgress(outerAt, DUR.f6);
  const m = useProgress(midAt, DUR.f6);
  const i = useProgress(innerAt, DUR.f6);
  // 内层光点沿「工具前→执行→工具后→整批落定」跑一圈：80f 周期模除驱动 bespoke 位置
  // 高亮（非环形巡游，useTravel 不适用），保留内联（deferred）
  const lap = ((frame - innerAt) % 80) / 80;
  const lapOn = frame >= innerAt + 16;
  const asyncEvents = ['会话开始', '会话结束', '配置变更', '目录切换', '文件被改', '通知'];
  // 右栏整体淡入（16f → f6）+ 六格错峰（stride 3、单项 8f → f3）
  const asyncOp = useProgress(asyncAt, DUR.f6);
  const asyncCells = useStagger(asyncEvents.length, {at: asyncAt, stride: 3, dur: DUR.f3});
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
            opacity: asyncOp,
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
                  opacity: asyncCells[k],
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
  // 上层印章推进 18f → f6；箭头组 20f → f6；缺口警示条原布尔门 → f3 淡入。
  // hooks 必须先于金句早退调用（Rules of Hooks：早退后不得再出现 hook）
  const push = useProgress(pushAt, DUR.f6);
  const arrow = useProgress(arrowAt, DUR.f6);
  const gapOp = useProgress(gapAt, DUR.f3);
  if (frame >= quoteAt) {
    return <QuoteCard zh="扩展点能加限制，不能解除限制。" accent={theme.core} />;
  }
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
  // 冲击波每 34 帧复发一次（持续施压 → 持续被顶回）——模除包络 + 条件抖动是刻意的
  // 周期性冲击模型，motion 层暂无对应原语，保留 bespoke（deferred：需 periodic-impulse 模型）
  const shock = blocked
    ? interpolate((frame - blockAt) % 34, [0, 16], [0, 1], {extrapolateRight: 'clamp'})
    : 0;
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
            opacity: gapOp,
          }}
        >
          {'教学版缺这一层 → 生产环境的安全漏洞'}
        </div>
      </div>
      <Footnote delay={arrowAt}>
        {'hook allow 不能绕过 settings 的 deny/ask —— 第三方的源码分析'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 4-G' 六道闸门流水线（官方 SDK 权限判定图）：hook 的放行仍要穿过后面的 deny/ask 两站
 *  官方把权限判定画成六站；本片高潮句「扩展点能加限制，不能解除限制」的官方背书。 */
const SixGatePipeline: React.FC<{railAt: number; runAt: number; yoloAt: number}> = ({railAt, runAt, yoloAt}) => {
  const frame = useCurrentFrame();
  const stations = [
    {t: 'hook', sub: '扩展点'},
    {t: 'deny', sub: '拒绝'},
    {t: 'ask', sub: '询问'},
    {t: 'settings', sub: '配置'},
    {t: 'mode', sub: '模式'},
    {t: '默认', sub: '兜底问你'},
  ];
  // 轨道浮现 22f / 光点过闸 50f：均属 beat 级窗口（≥22，保留显式时长）
  const rail = useProgress(railAt, 22);
  const travel = useProgress(runAt, 50);
  // 六站错峰点亮（stride 4、单项 10f → f5）；yolo 标注 12f = f5
  const stationP = useStagger(stations.length, {at: railAt + 6, stride: 4, dur: DUR.f5});
  const yoloOp = useProgress(yoloAt, DUR.f5);
  const yolo = frame >= yoloAt;
  // 两轮演示：第一轮光点在 deny 站被截；第二轮（全放行模式）仍在 deny 站被截
  const cutAt = 1 / 6 + 0.5 / 6;
  const stopped = travel > cutAt;
  const PX = 160;
  const GAP = 260;
  const ballX = PX + (GAP * 5) * Math.min(travel, cutAt);
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
          {/* 请求光点 */}
          {rail > 0.8 ? (
            <>
              <circle cx={ballX} cy={250} r={14} fill={stopped ? theme.deny : theme.core}
                style={stopped ? {filter: `drop-shadow(0 0 16px ${theme.deny})`} : undefined} />
              {!stopped ? (
                <line x1={PX} y1={250} x2={ballX} y2={250} stroke={theme.core} strokeWidth={3} opacity={0.5} />
              ) : (
                <line x1={ballX} y1={250} x2={PX + GAP * 0.5} y2={330} stroke={theme.deny} strokeWidth={3} strokeDasharray="6 5" />
              )}
            </>
          ) : null}
        </svg>
        {/* 六站 */}
        {stations.map((st, i) => {
          const e = stationP[i];
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
        {yolo ? (
          <div
            style={{
              position: 'absolute',
              right: 30,
              bottom: 20,
              fontFamily: theme.sans,
              fontSize: 23,
              color: theme.deny,
              opacity: yoloOp,
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
  const cx = 260;
  const cy = 220;
  const r = 128;
  // 加速绕行（34/26/20 逐圈提速，heat 随圈数 /2.5 升温）——手写累加器 → useAccelTravel
  const travel = useAccelTravel({cx, cy, r, durs: [34, 26, 20], at: spinAt, heatPerLap: 2.5});
  const marked = frame >= markAt;
  const heat = travel.heat;
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
          {/* 光点行进至 -30°（标记处）被截断：marked 后由下方标记方块接管该位置 */}
          {!marked ? (
            <circle cx={travel.x} cy={travel.y} r={12} fill={theme.deny} />
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
      <HarnessBadge />
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
        <BoringOnPurpose quoteAt={rel(bE, 'p4-22')} />
      </Sequence>
      <Sequence {...bF} name="4-F 31 事件三层嵌套">
        <HookNesting outerAt={rel(bF, 'p4-23')} midAt={rel(bF, 'p4-24')} innerAt={rel(bF, 'p4-24') + 30} countAt={rel(bF, 'p4-24') + 10} asyncAt={rel(bF, 'p4-25')} />
      </Sequence>
      <Sequence {...bG1} name="4-G1 六闸流水线">
        <SixGatePipeline railAt={rel(bG1, 'p4-29')} runAt={rel(bG1, 'p4-30')} yoloAt={rel(bG1, 'p4-31')} />
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
