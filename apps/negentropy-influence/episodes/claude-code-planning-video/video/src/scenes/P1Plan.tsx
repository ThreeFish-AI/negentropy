/** P1 把清单钉在桌上（分镜 1-A…1-D）—— TodoWrite
 *  三态清单卡滑入 → 钉进对话流（后续色块被顶开）→ 两行 diff + 金句 → 三轮催更印章。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Chip, CodeCard, Desk, Footnote, Panel, SceneHeader, SceneTag, Stamp} from '../components/motifs';

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
      <SceneTag chapter="todo_write" tagline="三态：pending / in_progress / completed" accent={theme.view} />
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
                  {'—— 教学版 README'}
                </div>
              </Panel>
            </div>
          </>
        ) : (
          <QuoteCard zh="增加的不是执行能力，是规划能力。" cite="教学版 README 关键洞察" accent={theme.view} />
        )}
      </div>
    </AbsoluteFill>
  );
};

/** 1-D 退位帧：官方默认停用清单工具——「收回」钢印 + 官方公告条（Harness Engineering 改造版） */
const RetirementStamp: React.FC<{noticeAt: number; stampAt: number; taskSysAt: number}> = ({
  noticeAt,
  stampAt,
  taskSysAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const notice = interpolate(frame - noticeAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const stamp = spring({frame: frame - stampAt, fps, config: {damping: 140}});
  const taskSys = interpolate(frame - taskSysAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1100, height: 560}}>
        {/* 清单卡（缩小版，居中） */}
        <Panel accent={theme.view} style={{position: 'absolute', left: 280, top: 60, width: 540, padding: '22px 28px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'todo_write'}</div>
          {['pending 待办', 'in_progress 干着', 'completed 完事'].map((s, i) => (
            <div key={s} style={{fontFamily: theme.sans, fontSize: 23, color: theme.text, marginTop: 10, opacity: 0.85}}>
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
        {/* 收回钢印 */}
        {stamp > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 430,
              top: 110,
              opacity: Math.min(1, stamp * 1.4),
              transform: `rotate(${-12 + 4 * stamp}deg) scale(${1.5 - 0.5 * stamp})`,
              border: `5px solid ${theme.deny}`,
              borderRadius: 12,
              padding: '10px 30px',
              fontFamily: theme.serif,
              fontSize: 46,
              fontWeight: 700,
              color: theme.deny,
              letterSpacing: 10,
              boxShadow: `0 0 24px ${theme.deny}44`,
            }}
          >
            {'收 回'}
          </div>
        ) : null}
        {/* 任务系统预告 */}
        {taskSys > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -60,
              textAlign: 'center',
              opacity: taskSys,
              fontFamily: theme.sans,
              fontSize: 23,
              color: theme.dim,
            }}
          >
            {'清单背后那套更重的任务系统（带依赖·能锁·落盘）——以后单拆'}
          </div>
        ) : null}
      </div>
      <Footnote delay={noticeAt}>
        {'零件押的是「模型记不住」的赌注 —— 模型变强，赌注过期（官方文档口径）'}
      </Footnote>
    </AbsoluteFill>
  );
};

export const P1Plan: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p1-01', 'p1-03');
  const relA = (id: string) => at(id) - bA.from;
  const bB = w('p1-04', 'p1-09');
  const relB = (id: string) => at(id) - bB.from;
  const bC = w('p1-10', 'p1-13');
  const relC = (id: string) => at(id) - bC.from;
  const bD = w('p1-14', 'p1-19');
  const relD = (id: string) => at(id) - bD.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P1" title="把清单钉在桌上" meta="TodoWrite · retired by default" />
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
        {/* p1-14 官方公告；p1-15 收回钢印；p1-16 任务系统预告 */}
        <RetirementStamp
          noticeAt={relD('p1-14')}
          stampAt={relD('p1-15')}
          taskSysAt={relD('p1-16')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
