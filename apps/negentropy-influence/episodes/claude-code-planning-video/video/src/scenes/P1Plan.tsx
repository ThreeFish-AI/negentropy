/** P1 把清单钉在桌上（分镜 1-A…1-F）—— TodoWrite
 *  三态清单卡滑入 → 钉进对话流（后续色块被顶开）→ 两行 diff + 金句 → 退位帧（钢印）
 *  → 计划闸（玻璃罩 + 三选一）→ 任务系统预告 + 零件生命周期时间轴。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Chip, CodeCard, Desk, Footnote, Panel, SceneHeader, Stamp} from '../components/motifs';

/** 三态行：空格 → ▸ → ✓ 各一次演示态（storyboard 1-A）。 */
const STATE_ICONS = ['　', '▸', '✓'] as const;
const STATE_NAMES = ['没开始', '干着', '干完了'] as const;

/** 1-A 桌面主舞台。右侧滑入三态清单卡（pending/in_progress/completed 三行，view 描边）。 */
const ChecklistSlidesIn: React.FC<{iconAt: number[]}> = ({iconAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const deskIn = spring({frame: frame - 2, fps, config: {damping: 200}});
  const slideIn = spring({frame: frame - 10, fps, config: {damping: 200}});
  const items = [
    {t: '统一文件名为 snake_case', state: 2},
    {t: '跑一遍测试', state: 1},
    {t: '修好失败的测试', state: 0},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
            <Desk width={1380} height={560} style={{opacity: deskIn}}>
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: 90}}>
          {/* 左侧：桌面上已有的对话流（安静地垫底） */}
          <div style={{opacity: 0.45, width: 320}}>
            {['user', 'assistant', 'tool', 'tool'].map((k, i) => (
              <div key={i} style={{marginBottom: 10}}>
                <Chip
                  kind={k === 'user' ? 'user' : k === 'assistant' ? 'model' : 'tool'}
                  label={k}
                  width={220 + (i % 2) * 60}
                />
              </div>
            ))}
          </div>
          {/* 右侧：三态清单卡滑入落桌 */}
          <div style={{transform: `translateX(${(1 - slideIn) * 240}px)`, opacity: slideIn}}>
            <Panel accent={theme.view} style={{width: 560, padding: '26px 30px', background: `${theme.panel}e6`}}>
              <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim, marginBottom: 18}}>
                {'todo_write · 计划清单'}
              </div>
              {items.map((it, i) => {
                // 状态图标依次闪现：空格 → ▸ → ✓ 各一次演示
                const demo = iconAt[i];
                const phase = frame < demo ? 0 : frame < demo + 14 ? 1 : frame < demo + 28 ? 2 : 3;
                const icon = phase === 0 ? '' : phase === 1 ? STATE_ICONS[Math.min(i, 2)] : STATE_ICONS[it.state];
                const hot = phase > 0 && frame < demo + 34;
                return (
                  <div
                    key={it.t}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: '13px 16px',
                      marginBottom: 8,
                      borderRadius: 8,
                      background: hot ? theme.viewDeep : 'transparent',
                      border: hot ? `2px solid ${theme.view}` : '2px solid transparent',
                    }}
                  >
                    <span
                      style={{
                        width: 34,
                        fontFamily: theme.mono,
                        fontSize: 30,
                        fontWeight: 700,
                        color: theme.view,
                        textAlign: 'center',
                      }}
                    >
                      {icon}
                    </span>
                    <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{it.t}</span>
                  </div>
                );
              })}
              {/* 状态演示轴：三态各演示一次 */}
              <div style={{display: 'flex', gap: 14, marginTop: 14, justifyContent: 'center'}}>
                {STATE_NAMES.map((n, i) => {
                  const on = frame >= iconAt[0] + i * 14;
                  return (
                    <span
                      key={n}
                      style={{
                        fontFamily: theme.mono,
                        fontSize: 19,
                        color: on ? theme.view : theme.dim,
                        border: `2px solid ${on ? theme.view : theme.panelBorder}`,
                        borderRadius: 999,
                        padding: '3px 14px',
                        opacity: on ? 1 : 0.4,
                      }}
                    >
                      {`${STATE_ICONS[i]} ${n}`}
                    </span>
                  );
                })}
              </div>
            </Panel>
          </div>
        </div>
      </Desk>
    </AbsoluteFill>
  );
};

/** 1-B 清单卡「啪」地钉进对话流：图钉 spring 落下，后续色块撞上卡被「顶开」滑落。 */
const PinIntoFlow: React.FC<{pinAt: number; bumpAt: number}> = ({pinAt, bumpAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pin = spring({frame: frame - pinAt, fps, config: {damping: 11}});
  // 后续色块被顶开：撞上卡片后向下顺滑让位
  const bump = spring({frame: frame - bumpAt, fps, config: {damping: 200}});
  const flow: Array<{kind: 'user' | 'model' | 'tool'; label: string; w: number}> = [
    {kind: 'user', label: 'user', w: 200},
    {kind: 'model', label: 'assistant', w: 260},
    {kind: 'tool', label: 'tool: bash', w: 300},
    {kind: 'tool', label: 'tool: edit', w: 280},
    {kind: 'model', label: 'assistant', w: 240},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1240, height: 640}}>
        {/* 对话流：清单卡固定在左上，后续色块被顶开 */}
        <div style={{position: 'absolute', left: 40, top: 40, width: 720}}>
          {flow.map((f, i) => {
            const at = 6 + i * 14;
            const e = spring({frame: frame - at, fps, config: {damping: 200}});
            const push = i >= 2 ? bump : 0;
            return (
              <div
                key={i}
                style={{
                  marginBottom: 12,
                  opacity: e,
                  transform: `translateX(${(1 - e) * -60 + push * (i - 1) * 14}px) translateY(${push * 26}px)`,
                }}
              >
                <Chip kind={f.kind} label={f.label} width={f.w} />
              </div>
            );
          })}
        </div>
        {/* 清单卡：始终可见，钉在对话流里 */}
        <div
          style={{
            position: 'absolute',
            left: 460,
            top: 96 + (1 - pin) * -180,
            opacity: pin,
          }}
        >
          <div style={{position: 'relative'}}>
            <Panel accent={theme.view} style={{width: 480, padding: '20px 24px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginBottom: 10}}>
                {'todo_write（挂在对话里）'}
              </div>
              {['✓ 统一文件名', '▸ 跑一遍测试', '　 修好失败的测试'].map((t, i) => (
                <div key={i} style={{fontFamily: theme.mono, fontSize: 24, color: theme.text, marginBottom: 6}}>
                  {t}
                </div>
              ))}
            </Panel>
            {/* 图钉：spring 过冲落下（「啪」） */}
            <svg
              width={40}
              height={44}
              style={{position: 'absolute', left: 224, top: -26, transform: `scale(${0.6 + 0.4 * pin})`}}
            >
              <circle cx={20} cy={20} r={15} fill={theme.view} stroke={theme.viewDeep} strokeWidth={3} />
              <circle cx={20} cy={20} r={5} fill={theme.bg} />
              <line x1={20} y1={34} x2={20} y2={44} stroke={theme.viewDeep} strokeWidth={4} strokeLinecap="round" />
            </svg>
            {/* 钉住涟漪 */}
            {pin > 0.95 ? (
              <div
                style={{
                  position: 'absolute',
                  left: 204,
                  top: -44,
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  border: `3px solid ${theme.view}`,
                  opacity: interpolate(frame - pinAt, [12, 26], [0.8, 0], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                }}
              />
            ) : null}
          </div>
        </div>
        {/* 「被顶开」注记 */}
        <div
          style={{
            position: 'absolute',
            left: 40,
            bottom: 60,
            fontFamily: theme.sans,
            fontSize: 25,
            color: theme.dim,
            opacity: bump,
          }}
        >
          {'几十条工具输出也顶不动它 —— 钉住的纸永远在视野里'}
        </div>
      </div>
      <Footnote delay={bumpAt}>{'清单挂在对话里：每轮重读，都会被再看见一次'}</Footnote>
    </AbsoluteFill>
  );
};

/** 1-C 左下角小代码卡：注册表两行 diff（TOOLS+1 / TOOL_HANDLERS+1，mech 高亮）；右侧金句卡。 */
const TwoLineDiff: React.FC<{quoteAt: number}> = ({quoteAt}) => {
  const frame = useCurrentFrame();
  const quoteOn = frame >= quoteAt;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1500, height: 700}}>
        {!quoteOn ? (
          <>
            <div style={{position: 'absolute', left: 60, bottom: 120}}>
              <div style={{marginBottom: 14}}>
                <CodeCard
                  lines={['TOOLS = [..., todo_write]          # +1', 'TOOL_HANDLERS["todo_write"] = ...   # +1']}
                  width={760}
                  framesPerLine={10}
                  highlight={[0, 1]}
                  showLineNumbers={false}
                  accent={theme.mech}
                />
              </div>
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 24,
                  color: theme.dim,
                  marginTop: 12,
                  opacity: interpolate(frame, [30, 46], [0, 1], {extrapolateRight: 'clamp'}),
                }}
              >
                {'循环本身一行没动 —— 本集反复要数的事实'}
              </div>
            </div>
            {/* 右侧：金句卡淡入（p1-12 前置句铺垫） */}
            <div
              style={{
                position: 'absolute',
                right: 60,
                top: 140,
                width: 560,
                opacity: interpolate(frame - quoteAt + 40, [0, 30], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              <Panel accent={theme.view} style={{padding: '30px 34px'}}>
                <div style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.text, lineHeight: 1.6}}>
                  {'它增加的不是执行能力，'}
                  <br />
                  {'是规划能力。'}
                </div>
                <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginTop: 16}}>
                  {'—— 最简实现 README'}
                </div>
              </Panel>
            </div>
          </>
        ) : (
          <QuoteCard zh="增加的不是执行能力，是规划能力。" cite="最简实现 README 关键洞察" accent={theme.view} />
        )}
      </div>
    </AbsoluteFill>
  );
};

/** 1-D 退位帧：官方默认停用清单工具——「收回」钢印 + 官方公告条（Harness Engineering 改造版）。
 *  分镜 1-D：damping:12 过冲 + ripple；被盖章的 todo_write 卡本体有反应——
 *  描边 view→panelBorder 褪色、三行状态字依次划线、整卡下沉 12px 降到 0.45 透明；「押注押到期」标签。 */
const RetirementStamp: React.FC<{noticeAt: number; stampAt: number; betAt: number}> = ({
  noticeAt,
  stampAt,
  betAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const notice = interpolate(frame - noticeAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const stamp = spring({frame: frame - stampAt, fps, config: {damping: 12}});
  // 盖章冲击：容器同帧 translateY(3px) 下沉、8 帧回弹
  const shakeT = interpolate(frame - stampAt, [0, 8], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cardSink = frame >= stampAt ? Math.min(1, (frame - stampAt) / 14) : 0;
  const struck = (i: number) => frame >= stampAt + 6 + i * 6;
  const bet = interpolate(frame - betAt, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          position: 'relative',
          width: 1100,
          height: 560,
          transform: `translateY(${3 * shakeT}px)`,
        }}
      >
        {/* 清单卡（缩小版，居中）——盖章后褪色、划线、下沉、降透明 */}
        <Panel
          accent={cardSink > 0 ? theme.panelBorder : theme.view}
          style={{
            position: 'absolute',
            left: 280,
            top: 60 + 12 * cardSink,
            width: 540,
            padding: '22px 28px',
            opacity: 1 - 0.55 * cardSink,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'todo_write'}</div>
          {['pending 待办', 'in_progress 干着', 'completed 完事'].map((s, i) => (
            <div
              key={s}
              style={{
                fontFamily: theme.sans,
                fontSize: 23,
                color: struck(i) ? theme.dim : theme.text,
                marginTop: 10,
                textDecoration: struck(i) ? 'line-through' : 'none',
                opacity: 0.85,
              }}
            >
              {s}
            </div>
          ))}
        </Panel>
        {/* 官方公告条 */}
        <div
          style={{
            position: 'absolute',
            left: 60,
            top: 300,
            width: 980,
            opacity: notice,
            transform: `translateY(${(1 - notice) * 16}px)`,
          }}
        >
          <Panel accent={theme.view} style={{padding: '18px 26px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>
              {'官方：新一代模型上，清单工具默认不再安装'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 8}}>
              {'官方理由：这些模型自己就能记住要干什么 · code.claude.com'}
            </div>
          </Panel>
        </div>
        {/* 收回钢印（damping:12 过冲 + ripple，来自 motifs.Stamp） */}
        <Stamp text="收回" color={theme.deny} at={stampAt} size={150} rotate={-12} style={{position: 'absolute', left: 430, top: 110}} />
        {/* 「押注押到期」标签 */}
        {bet > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 770,
              top: 180,
              opacity: bet,
              transform: `translateY(${(1 - bet) * 12}px) rotate(6deg)`,
              border: `2px solid ${theme.deny}`,
              borderRadius: 8,
              padding: '6px 16px',
              fontFamily: theme.serif,
              fontSize: 26,
              fontWeight: 700,
              color: theme.deny,
              background: `${theme.deny}12`,
            }}
          >
            {'押注押到期'}
          </div>
        ) : null}
      </div>
      <Footnote delay={noticeAt}>
        {'零件押的是「模型记不住」的赌注 —— 模型变强，赌注过期（官方文档口径）'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 1-E 新镜「计划闸」：只读探索的手被玻璃罩罩住；view 计划卡落桌；「改文件」动作块
 *  撞罩被 deny 弹回；三选一按钮（反枚举：panel 底 + 编号 01/02/03）；末句金句卡。 */
const PlanGate: React.FC<{
  glassAt: number;
  planAt: number;
  bounceAt: number;
  choicesAt: number;
  quoteAt: number;
}> = ({glassAt, planAt, bounceAt, choicesAt, quoteAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame >= quoteAt) {
    return <QuoteCard zh="清单给执行者 · 计划给决策者 —— 两份文件，两种读者" accent={theme.view} />;
  }
  // 玻璃罩自上罩下（spring）
  const glass = spring({frame: frame - glassAt, fps, config: {damping: 200}});
  // 计划卡落桌（damping:200）
  const plan = spring({frame: frame - planAt, fps, config: {damping: 200}});
  // 「改文件」动作块撞罩弹回：复用 3-C 单向阀 bounce 曲线（0→-46→-32 位移 + deny 闪）
  const blocked = frame >= bounceAt;
  const travel = interpolate(frame - bounceAt, [-16, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bounce = blocked
    ? interpolate(frame - bounceAt, [0, 12, 26], [0, -46, -32], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;
  const CHOICES = ['交给自动闸门', '逐条人工点头', '继续再想'] as const;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1300, height: 640}}>
        {/* 文件（只读探索的对象）+ 玻璃罩 */}
        <div style={{position: 'absolute', left: 120, top: 120}}>
          <Panel style={{width: 300, padding: '18px 22px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'src/query.ts'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.text, marginTop: 8, whiteSpace: 'pre'}}>
              {'只读探索：\n读结构 · 记结论\n不动一行'}
            </div>
          </Panel>
          {/* 玻璃罩：mech 描边 + 8% 白底，自上罩下 */}
          <div
            style={{
              position: 'absolute',
              left: -18,
              top: -120 * glass,
              width: 336,
              height: 200,
              border: `3px solid ${theme.mech}`,
              borderRadius: '12px 12px 0 0',
              background: 'rgba(255,255,255,0.08)',
              opacity: glass,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.mech, textAlign: 'center', marginTop: 10}}>
              {'计划模式 · 玻璃罩'}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, textAlign: 'center', marginTop: 6}}>
              {'罩住：看得见，改不得'}
            </div>
          </div>
        </div>
        {/* 计划卡：从上落桌（view 描边） */}
        <div style={{position: 'absolute', left: 560, top: 100 + (1 - plan) * -160, opacity: plan}}>
          <Panel accent={theme.view} style={{width: 380, padding: '16px 22px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'计划（写给你过目）'}</div>
            {['① 摸清调用链', '② 列出改法两套', '③ 标注风险点'].map((s) => (
              <div key={s} style={{fontFamily: theme.sans, fontSize: 22, color: theme.text, marginTop: 7}}>
                {s}
              </div>
            ))}
          </Panel>
        </div>
        {/* 「改文件」动作块：从右侧飞向玻璃罩，撞罩被 deny 弹回（复用 3-C 单向阀曲线） */}
        {blocked ? (
          <div
            style={{
              position: 'absolute',
              left: 760 - travel * 220 - bounce,
              top: 250,
              opacity: travel > 0.05 ? 1 : 0,
            }}
          >
            <Chip kind="tool" label="[edit] 改文件" width={210} style={{borderColor: theme.deny}} />
            <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.deny, marginTop: 6}}>
              {'计划没批，一律拦住'}
            </div>
          </div>
        ) : null}
        {/* 三选一按钮：反枚举（panel 底 + 编号 01/02/03，仅当前项染 mech） */}
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 40, display: 'flex', justifyContent: 'center', gap: 22}}>
          {CHOICES.map((c, i) => {
            const on = frame >= choicesAt + i * 9;
            const lit = frame >= choicesAt + i * 9 + 18;
            return (
              <div
                key={c}
                style={{
                  width: 300,
                  padding: '13px 18px',
                  borderRadius: 10,
                  background: theme.panel,
                  border: `2px solid ${lit ? theme.mech : theme.panelBorder}`,
                  opacity: on ? 1 : 0.35,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transform: `translateY(${on ? 0 : 8}px)`,
                }}
              >
                <span style={{fontFamily: theme.mono, fontSize: 20, color: lit ? theme.mech : theme.dim}}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{fontFamily: theme.sans, fontSize: 22, color: lit ? theme.mech : theme.dim}}>{c}</span>
              </div>
            );
          })}
        </div>
      </div>
      <Footnote delay={choicesAt}>{'计划模式：只读探索 → 写计划 → 批准那一下三选一（官方文档口径）'}</Footnote>
    </AbsoluteFill>
  );
};

/** 1-F 任务系统预告（小图标一闪）+「装在循环外」收束 + 零件生命周期时间轴：
 *  左端「模型记不住 → 需要清单」、右端「模型记住了 → 清单过期」；core 光点自左滑右，抵达右端清单卡消失。 */
const LifecycleTimeline: React.FC<{taskSysAt: number; axisAt: number; dotAt: number; quoteAt: number}> = ({
  taskSysAt,
  axisAt,
  dotAt,
  quoteAt,
}) => {
  const frame = useCurrentFrame();
  if (frame >= quoteAt) {
    return <QuoteCard zh="Planning is a capability, not a feature —— 规划是能力，不是功能" accent={theme.view} />;
  }
  const taskSys = interpolate(frame - taskSysAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 时间轴描出
  const axis = interpolate(frame - axisAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // core 光点自左滑向右
  const dot = interpolate(frame - dotAt, [0, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 抵达右端：清单卡彻底消失
  const listGone = interpolate(frame - dotAt, [42, 50], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 任务系统预告：三个小图标一闪（「以后单拆」） */}
      <div
        style={{
          position: 'absolute',
          top: 130,
          display: 'flex',
          gap: 18,
          opacity: taskSys * 0.85,
        }}
      >
        {[
          {t: '带依赖', d: 'A→B'},
          {t: '能锁', d: '锁定'},
          {t: '落盘', d: '落盘'},
        ].map((x, i) => (
          <div
            key={x.t}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 16px',
              borderRadius: 999,
              border: `2px solid ${theme.panelBorder}`,
              fontFamily: theme.sans,
              fontSize: 21,
              color: theme.dim,
              opacity: interpolate(frame - taskSysAt - i * 5, [0, 8], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            <span style={{fontFamily: theme.mono, color: theme.mech}}>{x.d}</span>
            {x.t}
          </div>
        ))}
        <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, alignSelf: 'center', marginLeft: 8}}>
          {'—— 那套以后单拆'}
        </div>
      </div>
      {/* 生命周期时间轴 */}
      <div style={{position: 'relative', width: 1200, height: 380, marginTop: 60}}>
        {/* 轴线 */}
        <svg width={1200} height={120} style={{position: 'absolute', left: 0, top: 120}}>
          <line
            x1={80}
            y1={60}
            x2={80 + 1040 * axis}
            y2={60}
            stroke={theme.panelBorder}
            strokeWidth={4}
            strokeLinecap="round"
          />
          {/* core 光点 */}
          <circle cx={80 + 1040 * dot} cy={60} r={11} fill={theme.core} opacity={axis} />
          {/* 右端箭头（axis 描满后出现） */}
          {axis > 0.98 ? (
            <path d="M1120 60 L1106 50 L1106 70 Z" fill={theme.panelBorder} />
          ) : null}
        </svg>
        {/* 左端：模型记不住 → 需要清单（清单卡小样） */}
        <div style={{position: 'absolute', left: 60, top: 20, width: 300}}>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'模型记不住'}</div>
          <div style={{fontFamily: theme.serif, fontSize: 28, fontWeight: 700, color: theme.view, marginTop: 4}}>
            {'→ 需要清单'}
          </div>
          <div style={{marginTop: 12, opacity: 0.7}}>
            <Chip kind="task" label="todo_write" width={180} />
          </div>
        </div>
        {/* 右端：模型记住了 → 清单过期（清单卡随光点抵达而消失） */}
        <div style={{position: 'absolute', right: 60, top: 20, width: 320, textAlign: 'right'}}>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'模型记住了'}</div>
          <div style={{fontFamily: theme.serif, fontSize: 28, fontWeight: 700, color: theme.deny, marginTop: 4}}>
            {'→ 清单过期'}
          </div>
          <div style={{marginTop: 12, opacity: 0.7 * listGone}}>
            <div style={{display: 'flex', justifyContent: 'flex-end'}}>
              <Chip kind="task" label="todo_write" width={180} style={{textDecoration: 'line-through'}} />
            </div>
          </div>
        </div>
        {/* 中段注记：装在循环外的能力 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 250,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.dim,
            opacity: interpolate(frame - dotAt, [10, 30], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {'清单是装在循环外面的能力 —— 循环本身一行没动'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P1Plan: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p1-01', 'p1-03');
  const relA = (id: string) => at(id) - bA.from;
  const bB = w('p1-05', 'p1-09');
  const relB = (id: string) => at(id) - bB.from;
  const bC = w('p1-10', 'p1-13');
  const relC = (id: string) => at(id) - bC.from;
  const bD = w('p1-14', 'p1-15');
  const relD = (id: string) => at(id) - bD.from;
  const bE = w('p1-15a', 'p1-15e');
  const relE = (id: string) => at(id) - bE.from;
  const bF = w('p1-16', 'p1-19');
  const relF = (id: string) => at(id) - bF.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P1" title="把清单钉在桌上" meta="TodoWrite · plan mode" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="1-A 三态清单滑入">
        {/* 三态图标演示态跟随 p1-02（每条标一个状态）逐个闪现 */}
        <ChecklistSlidesIn iconAt={[relA('p1-02'), relA('p1-02') + 16, relA('p1-02') + 32]} />
      </Sequence>
      <Sequence {...bB} name="1-B 清单钉进对话流">
        {/* 图钉在 p1-07（挂在对话里）落下；p1-08 起后续色块被顶开 */}
        <PinIntoFlow pinAt={relB('p1-07')} bumpAt={relB('p1-08')} />
      </Sequence>
      <Sequence {...bC} name="1-C 两行 diff 与金句">
        {/* p1-12/13 金句：全屏金句卡（beat 内时点锚） */}
        <TwoLineDiff quoteAt={relC('p1-12')} />
      </Sequence>
      <Sequence {...bD} name="1-D 退位帧">
        {/* p1-14 官方公告 + 收回钢印；p1-15 押注押到期标签 + 卡片盖章反应 */}
        <RetirementStamp noticeAt={relD('p1-14')} stampAt={relD('p1-15')} betAt={relD('p1-15') + 30} />
      </Sequence>
      <Sequence {...bE} name="1-E 计划闸">
        {/* p1-15a 玻璃罩罩下；15b 计划卡落桌；15c 改文件撞罩弹回；15d 三选一；15e 金句卡 */}
        <PlanGate
          glassAt={relE('p1-15a')}
          planAt={relE('p1-15b')}
          bounceAt={relE('p1-15c')}
          choicesAt={relE('p1-15d')}
          quoteAt={relE('p1-15e')}
        />
      </Sequence>
      <Sequence {...bF} name="1-F 任务系统与生命周期">
        {/* p1-16 任务系统预告一闪；p1-18/19 金句；时间轴：模型记不住→需要清单 ↔ 模型记住了→清单过期 */}
        <LifecycleTimeline
          taskSysAt={relF('p1-16')}
          axisAt={relF('p1-16') + 24}
          dotAt={relF('p1-16') + 40}
          quoteAt={relF('p1-18')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
