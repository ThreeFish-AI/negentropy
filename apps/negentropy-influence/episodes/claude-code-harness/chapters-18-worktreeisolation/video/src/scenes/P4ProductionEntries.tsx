/** P4 生产版：两个入口（p4-01..p4-08，4 镜）——分镜 4-A / 4-B / 4-C / 4-D。
 *
 *  幕间转场（3-D→4-A，头注明示）：语义断裂（教学版→生产版换层）走 SceneFade
 *  + 拉远重锚，不 morph（教学装置与生产舞台拓扑断裂，承 ep2 3-C→4-A 判例）；
 *  教学主装置与生产版房为同构暗层剪影、不同体。4-D→5-A 同走 SceneFade +
 *  主装置同形签名回归（承 ep2 4-D→5-A 判例）。
 *
 *  叙事链：4-A 拉远重锚（自 P3 峰值降压）：p4-01「两个入口」词落位两枚入口
 *  拱位轮廓立起（左右各一，stagger）〔M-005〕→ p4-02「会话级」词落位左入口
 *  名牌亮出+描边定色（本镜只立左入口，右入口留 4-C）→ 4-B 左入口演示：
 *  p4-03「进房工具一落」词落位进房工具卡落下（角标 EnterWorktreeTool）、
 *  「当场切进」词落位会话容器（对话气泡串+工具卡列整组容器，钢青描边）整组
 *  平移切进左目录房（一步完成——单次位移无中途站）〔M-005〕→ p4-04「先
 *  检查」词落位退房签落下（角标 ExitWorktreeTool）→「检查会被删的工作」
 *  双计数微缩窗弹出扫一遍（与教学版守卫同型一闪、不显数）、「再送你回
 *  原处」词落位容器整组送回原位（检查→恢复次序锁定）→ 4-C 右入口演示：
 *  p4-05「另一个入口」词落位右入口名牌亮起〔M-005〕、「一次性任务包一间
 *  房」词落位子代理小舱体（微型舱+房号签）携任务签入场右目录房、「活全
 *  在自己目录里」词落位舱内作业微动画全在房界内发生（房界描边收拢点亮）
 *  → 4-D 边界墙剖面图：p4-06「这堵墙」词落位墙体剖面横贯立起〔M-005〕、
 *  「挡互踩」词落位墙内侧两房改动各自发生互不穿透、「不挡越狱」词落位
 *  警示红虚线自墙内一路穿出到墙外目标（穿透即陈述——边界语义红线：红虚线
 *  贯穿无阻断）→ p4-07「一点没变」词落位红虚线全程恒亮（可达域未收窄）、
 *  「分开的只是目录和线」词落位墙内目录/线两色分层各闪一拍 → p4-08「施工
 *  面，不是笼子」词落位金句卡淡入定格（衬线体压轴，重音镜）〔M-003〕、
 *  墙体在卡后褪为暗层。
 *
 *  空间契约（安全带实算）：4-A 拱位底 560 / 生产房底 800；4-B 会话容器
 *  原位底 540 / 左房底 800；4-C 右房底 810；4-D 墙底 730 / 金句卡底 ≈ 750
 *  ——全部 ≤ 860。容器整组位移（会话级=整组切，禁拆散逐件）；检查先于
 *  回送；微缩窗禁显具体数字（生产版口径未给数、防数字漂移）；舱体 scale
 *  小于 4-B 容器；舱体作业禁越出房界；右入口 4-A/4-B 保持暗轮廓；红虚线
 *  禁在墙体处断开或被拦截；金句卡为唯一衬线体主体（caption-dup-ok 登记
 *  于 storyboard 4-D 行）。机制英文词只进角标（EnterWorktreeTool /
 *  ExitWorktreeTool / AgentTool · isolation: "worktree" / .claude/worktrees/
 *  / worktree-{slug}）。词落位 = wa(id,f)。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, RoomCard} from '../components/motifs';
import {clamp01, progress} from '../motion';
import {ease} from '../components/motifs';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 入口拱位（虚线轮廓待亮 + 名牌位） */
const EntryArch: React.FC<{x: number; y: number; w: number; h: number; litP: number; nameP: number; name: string}> = ({
  x,
  y,
  w,
  h,
  litP,
  nameP,
  name,
}) => {
  const lit = clamp01(litP);
  const np = clamp01(nameP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{overflow: 'visible'}}>
        <path
          d={`M8 ${h} V ${h * 0.4} A ${w / 2 - 8} ${h * 0.4} 0 0 1 ${w - 8} ${h * 0.4} V ${h}`}
          fill={np > 0.4 ? withAlpha(theme.guard, 0.08) : 'transparent'}
          stroke={np > 0.4 ? theme.guard : theme.dim}
          strokeWidth={np > 0.4 ? 6 : 4}
          strokeDasharray={np > 0.4 ? undefined : '10 9'}
          opacity={0.5 + 0.5 * np}
        />
      </svg>
      {/* 名牌（拱位内上——亮出+描边定色） */}
      {np > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: h * 0.3,
            transform: `translate(-50%, ${(1 - np) * -12}px)`,
            padding: '8px 24px',
            borderRadius: 10,
            border: `3px solid ${withAlpha(theme.guard, 0.5 + 0.5 * np)}`,
            background: withAlpha(theme.panel, 0.97),
            fontFamily: theme.sans,
            fontSize: 24,
            fontWeight: 700,
            color: np > 0.5 ? theme.text : theme.dim,
            whiteSpace: 'nowrap',
            opacity: np,
            boxShadow: np > 0.8 ? `0 0 ${18 * np}px ${withAlpha(theme.guard, 0.4 * np)}` : 'none',
          }}
        >
          {name}
        </div>
      ) : null}
    </div>
  );
};

// ── 4-A 拉远重锚：生产舞台全景 + 双入口拱位 + 教学版暗层剪影 ────────────────────

/** 4-A 布局（安全带实算：拱位底 560 / 生产房底 800，恒 ≤ 860） */
const ARCH_4A = [
  {x: 530, y: 250, w: 320, h: 310},
  {x: 1070, y: 250, w: 320, h: 310},
] as const;
const PROOM_4A = [
  {x: 470, y: 600, w: 280, h: 200, tag: '.claude/worktrees/'},
  {x: 1370, y: 600, w: 280, h: 200, tag: 'worktree-{slug}'},
] as const;

const FourA: React.FC<{atArch: number; atLeftName: number}> = ({atArch, atLeftName}) => {
  const frame = useCurrentFrame();
  // 两枚入口拱位轮廓立起（stagger）
  const archIn = (i: number) => clamp01(progress(frame, atArch + i * 8, 12));
  // 左入口名牌亮出+描边定色（本镜只立左入口）
  const leftName = clamp01(progress(frame, atLeftName, 12));
  // 生产版目录房随拱位落位
  const roomIn = (i: number) => clamp01(progress(frame, atArch + 14 + i * 8, 12));
  return (
    <AbsoluteFill>
      {/* 镜深处教学版主装置暗层剪影（账本+房+环体缩悬——让位，不同体） */}
      <div style={{position: 'absolute', opacity: 0.16}}>
        <div style={{position: 'absolute', left: 880, top: 150, width: 160, height: 300, borderRadius: '10px 14px 14px 10px', border: `3px solid ${theme.dim}`}} />
        <div style={{position: 'absolute', left: 660, top: 220, width: 130, height: 110}}>
          <RoomCard x={0} y={0} w={130} h={110} litP={0.6} />
        </div>
        <div style={{position: 'absolute', left: 1120, top: 220, width: 130, height: 110}}>
          <RoomCard x={0} y={0} w={130} h={110} litP={0.6} />
        </div>
        <div style={{position: 'absolute', left: 890, top: 60}}>
          <LoopRing size={130} nodes={[]} showExit={false} showLabels={false} />
        </div>
      </div>
      {/* 双入口拱位（左→右 stagger；右入口保持暗轮廓） */}
      {ARCH_4A.map((a, i) => (
        <EntryArch key={`ar${i}`} x={a.x} y={a.y} w={a.w} h={a.h} litP={archIn(i)} nameP={i === 0 ? leftName : 0} name="会话级" />
      ))}
      {/* 生产版目录房（各入口通向一间——角标 .claude/worktrees/ · worktree-{slug}） */}
      {PROOM_4A.map((r, i) => (
        <div key={`pr${i}`}>
          <RoomCard x={r.x} y={r.y} w={r.w} h={r.h} litP={roomIn(i)} growP={roomIn(i)} />
          <div style={{position: 'absolute', left: r.x + 4, top: r.y + r.h + 30, fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85 * roomIn(i)}}>
            {r.tag}
          </div>
        </div>
      ))}
      {/* 拱位 → 生产房的通道短线（各入口通向一间） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {ARCH_4A.map((a, i) => (
          <line
            key={`ln${i}`}
            x1={a.x + a.w / 2}
            y1={a.y + a.h}
            x2={PROOM_4A[i].x + PROOM_4A[i].w / 2}
            y2={PROOM_4A[i].y}
            stroke={theme.dim}
            strokeWidth={3}
            strokeDasharray="8 8"
            opacity={0.5 * roomIn(i)}
          />
        ))}
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'真实版 · 两个入口：会话级 + 子代理'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 左入口演示：会话容器整组切进/检查/送回（一步完成） ──────────────────────

/** 4-B 布局（安全带实算：容器原位底 540 / 左房底 800） */
const LROOM_4B = {x: 430, y: 560, w: 420, h: 240} as const;
const CONT_4B = {x: 1050, y: 200, w: 520, h: 340} as const;

/** 会话容器（对话气泡串 + 工具卡列的整组容器——钢青描边；整组位移非拆散） */
const SessionContainer: React.FC<{litP: number; moveP: number}> = ({litP, moveP}) => {
  const lit = clamp01(litP);
  const mv = ease(clamp01(moveP));
  // 一步切进：原位 → 房内（单次位移无中途站——插值同拍直线）
  const x = CONT_4B.x + (LROOM_4B.x + 40 - CONT_4B.x) * mv;
  const y = CONT_4B.y + (LROOM_4B.y + 50 - CONT_4B.y) * mv;
  const s = 1 - 0.42 * mv;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: CONT_4B.w,
        height: CONT_4B.h,
        transform: `scale(${s})`,
        transformOrigin: '0 0',
        opacity: lit,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: `3.5px solid ${withAlpha(theme.guard, 0.85)}`,
          background: withAlpha(theme.panel, 0.96),
          padding: '16px 20px',
        }}
      >
        {/* 对话气泡串（左列） */}
        {[0, 1, 2].map((b) => (
          <div
            key={`bb${b}`}
            style={{
              width: 250 - b * 40,
              height: 40,
              marginBottom: 14,
              borderRadius: '12px 12px 12px 2px',
              border: `2.5px solid ${withAlpha(theme.dim, 0.6)}`,
              background: withAlpha(theme.dim, 0.1),
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 14,
            }}
          >
            <span style={{width: 140 - b * 30, height: 10, borderRadius: 3, background: withAlpha(theme.dim, 0.4)}} />
          </div>
        ))}
        {/* 工具卡列（右列） */}
        <div style={{position: 'absolute', right: 20, top: 18, display: 'flex', flexDirection: 'column', gap: 14}}>
          {[0, 1].map((c) => (
            <div
              key={`tc${c}`}
              style={{
                width: 170,
                height: 86,
                borderRadius: 10,
                border: `2.5px solid ${withAlpha(theme.guard, 0.6)}`,
                background: withAlpha(theme.panel, 0.98),
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                paddingLeft: 12,
              }}
            >
              <svg width={22} height={22} viewBox="0 0 22 22">
                <path d="M4 3 h9 l5 5 v11 h-14 z" fill="none" stroke={theme.guard} strokeWidth={2} />
              </svg>
              <span style={{width: 80, height: 9, borderRadius: 3, background: withAlpha(theme.dim, 0.4)}} />
            </div>
          ))}
        </div>
        <div style={{position: 'absolute', left: 20, bottom: 12, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>
          {'会话容器 · 整组'}
        </div>
      </div>
    </div>
  );
};

const FourB: React.FC<{atEnter: number; atSwitch: number; atExit: number; atCheck: number; atReturn: number}> = ({
  atEnter,
  atSwitch,
  atExit,
  atCheck,
  atReturn,
}) => {
  const frame = useCurrentFrame();
  // 进房工具卡落下（角标 EnterWorktreeTool）
  const enter = clamp01(progress(frame, atEnter, 12));
  // 会话容器整组平移切进（单次位移）+ 左房门框亮起
  const mv = clamp01(progress(frame, atSwitch, 14));
  const door = clamp01(progress(frame, atSwitch + 8, 10));
  // 退房签落下（角标 ExitWorktreeTool）
  const exit = clamp01(progress(frame, atExit, 12));
  // 双计数微缩窗（与教学版守卫同型——不显数）扫一遍
  const check = clamp01(progress(frame, atCheck, 10));
  const sweep = Math.sin(Math.PI * clamp01(progress(frame, atCheck + 4, 16)));
  // 容器整组送回原位（检查→恢复次序锁定）
  const back = clamp01(progress(frame, atReturn, 14));
  const move = mv * (1 - back);
  return (
    <AbsoluteFill>
      {/* 左目录房（生产版——容器切进目标） */}
      <RoomCard x={LROOM_4B.x} y={LROOM_4B.y} w={LROOM_4B.w} h={LROOM_4B.h} litP={1} doorP={door} />
      <div style={{position: 'absolute', left: LROOM_4B.x + 4, top: LROOM_4B.y + LROOM_4B.h + 30, fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>
        {'.claude/worktrees/ · worktree-{slug}'}
      </div>
      {/* 会话容器（原位 → 切进左房 → 检查后送回） */}
      <SessionContainer litP={clamp01(progress(frame, 3, 10))} moveP={move} />
      {/* 进房工具卡（落容器顶——角标 EnterWorktreeTool） */}
      {enter > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: CONT_4B.x + 10,
            top: CONT_4B.y - 74 + (1 - enter) * -40,
            padding: '8px 18px',
            borderRadius: 10,
            border: `3px solid ${withAlpha(theme.guard, 0.9)}`,
            background: withAlpha(theme.panel, 0.97),
            fontFamily: theme.sans,
            fontSize: 19,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: enter,
          }}
        >
          进房 · 一步
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, marginLeft: 10}}>{'EnterWorktreeTool'}</span>
        </div>
      ) : null}
      {/* 退房签（落下——角标 ExitWorktreeTool） */}
      {exit > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: LROOM_4B.x + LROOM_4B.w - 240,
            top: LROOM_4B.y - 66 + (1 - exit) * -36,
            padding: '8px 18px',
            borderRadius: 10,
            border: `3px solid ${withAlpha(theme.guard, 0.9)}`,
            background: withAlpha(theme.panel, 0.97),
            fontFamily: theme.sans,
            fontSize: 19,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: exit,
          }}
        >
          退房
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, marginLeft: 10}}>{'ExitWorktreeTool'}</span>
        </div>
      ) : null}
      {/* 双计数微缩窗（先检查会被删的工作——同型不显数） */}
      {check > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: LROOM_4B.x + LROOM_4B.w + 40,
            top: LROOM_4B.y - 40,
            padding: '12px 18px',
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.guard, 0.5 + 0.5 * sweep)}`,
            background: withAlpha(theme.panel, 0.97),
            opacity: check,
            boxShadow: sweep > 0.05 ? `0 0 ${20 * sweep}px ${withAlpha(theme.guard, 0.5 * sweep)}` : 'none',
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', marginBottom: 8}}>先检查会被删的工作</div>
          {/* 两条微缩计数条（不显数——生产版口径未给数） */}
          {[0, 1].map((b) => (
            <div key={`mb${b}`} style={{display: 'flex', alignItems: 'center', gap: 10, marginTop: 6}}>
              <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap'}}>{b === 0 ? '未提交' : '未推送'}</span>
              <span style={{width: 90, height: 12, borderRadius: 3, border: `2px dashed ${withAlpha(theme.dim, 0.55)}`}} />
              <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'? 项'}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'进房工具一落 · 整个会话当场切进 · 退房先检查再送回'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 右入口演示：子代理小舱体入场 + 房界圈住全部作业 ─────────────────────────

/** 4-C 布局（安全带实算：右房底 810；舱体在房界内 ≈ 底 770） */
const RROOM_4C = {x: 1330, y: 560, w: 460, h: 250} as const;
const POD_4C = {w: 150, h: 108} as const;

const FourC: React.FC<{atName: number; atPod: number; atBound: number}> = ({atName, atPod, atBound}) => {
  const frame = useCurrentFrame();
  // 右入口名牌亮起
  const name = clamp01(progress(frame, atName, 12));
  // 子代理小舱体自远处入场（携任务签+房号签）
  const pod = ease(clamp01(progress(frame, atPod, 18)));
  const podX = 1860 + (RROOM_4C.x + 130 - 1860) * pod;
  const podY = 380 + (RROOM_4C.y + 90 - 380) * pod;
  // 舱内作业微动画（全部在房界内——房界收拢点亮）
  const bound = clamp01(progress(frame, atBound, 14));
  const boundPulse = Math.sin(Math.PI * clamp01(progress(frame, atBound + 14, 18)));
  const workTick = Math.sin(frame / 6);
  return (
    <AbsoluteFill>
      {/* 右入口拱位（承 4-A 暗轮廓——名牌亮起） */}
      <EntryArch x={1070} y={250} w={320} h={310} litP={1} nameP={name} name="子代理" />
      {/* 右目录房（房界描边收拢点亮——圈住全部作业痕迹） */}
      <div style={{position: 'absolute', left: RROOM_4C.x, top: RROOM_4C.y, width: RROOM_4C.w, height: RROOM_4C.h}}>
        <div
          style={{
            position: 'absolute',
            inset: -10 * bound,
            borderRadius: 16,
            border: `${4 + 2 * bound}px solid ${withAlpha(theme.guard, 0.4 + 0.6 * bound)}`,
            background: withAlpha(theme.guard, 0.05 * bound),
            boxShadow: boundPulse > 0.04 ? `0 0 ${26 * boundPulse}px ${withAlpha(theme.guard, 0.55 * boundPulse)}` : 'none',
            opacity: bound > 0.02 ? 1 : 0,
            transition: 'none',
          }}
        />
        <RoomCard x={0} y={0} w={RROOM_4C.w} h={RROOM_4C.h} litP={1} />
        <div style={{position: 'absolute', left: 4, top: RROOM_4C.h + 26, fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap'}}>
          {'AgentTool · isolation: "worktree"'}
        </div>
        {/* 子代理小舱体（微型舱+房号签——体量对照：scale 小于 4-B 会话容器） */}
        <div style={{position: 'absolute', left: podX - RROOM_4C.x, top: podY - RROOM_4C.y, opacity: clamp01(progress(frame, atPod, 10))}}>
          <div
            style={{
              position: 'relative',
              width: POD_4C.w,
              height: POD_4C.h,
              borderRadius: 12,
              border: `3px solid ${withAlpha(theme.line, 0.85)}`,
              background: withAlpha(theme.panel, 0.97),
              padding: '8px 12px',
            }}
          >
            {/* 舱内工具小签（微缩三枚——全部落在房界内） */}
            <div style={{display: 'flex', gap: 6, marginBottom: 8}}>
              {['读', '写', '跑'].map((t, i) => (
                <span
                  key={`pt${i}`}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: `2px solid ${withAlpha(theme.dim, 0.6)}`,
                    fontFamily: theme.sans,
                    fontSize: 13,
                    fontWeight: 700,
                    color: theme.dim,
                    whiteSpace: 'nowrap',
                    opacity: bound > 0.3 ? 0.55 + 0.45 * Math.abs(Math.sin(frame / 7 + i)) : 0.85,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
            {/* 消息微条（作业微动画——微幅脉动，不越界） */}
            {[0, 1].map((m) => (
              <div
                key={`pm${m}`}
                style={{
                  width: 100 - m * 26 + (bound > 0.3 ? workTick * 6 : 0),
                  height: 9,
                  borderRadius: 3,
                  background: withAlpha(theme.line, 0.4),
                  marginBottom: 7,
                }}
              />
            ))}
            {/* 房号签（舱侧——携房入场） */}
            <span style={{position: 'absolute', right: -14, top: -30, padding: '3px 10px', borderRadius: 7, border: `2.5px solid ${withAlpha(theme.line, 0.85)}`, background: withAlpha(theme.panel, 0.97), fontFamily: theme.mono, fontSize: 13, color: theme.line, whiteSpace: 'nowrap'}}>
              房号
            </span>
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'一次性任务包一间房 · 活全在自己目录里'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D 边界墙剖面：钢青砖纹 + 墙内分色 + 红虚线贯穿 + 金句卡压轴 ────────────────

/** 4-D 布局（安全带实算：墙底 730 / 墙内房底 560 / 金句卡底 ≈ 750） */
const WALL_4D = {x: 1150, y: 170, w: 150, h: 560} as const;
const IROOMS_4D = [
  {x: 300, y: 280, w: 170, h: 140},
  {x: 560, y: 420, w: 170, h: 140},
] as const;
const TARGET_4D = {x: 1620, y: 400} as const;

const FourD: React.FC<{atWall: number; atNoCross: number; atEscape: number; atConst: number; atLayer: number; atQuote: number}> = ({
  atWall,
  atNoCross,
  atEscape,
  atConst,
  atLayer,
  atQuote,
}) => {
  const frame = useCurrentFrame();
  // 墙体剖面横贯立起（钢青砖纹）
  const wall = clamp01(progress(frame, atWall, 18));
  // 墙内两房改动各自发生（互不穿透——两枚编辑闪各自房内）
  const editA = Math.sin(Math.PI * clamp01(progress(frame, atNoCross, 16)));
  const editB = Math.sin(Math.PI * clamp01(progress(frame, atNoCross + 8, 16)));
  // 红虚线自墙内一路穿出到墙外目标（贯穿无阻断）
  const escape = clamp01(progress(frame, atEscape, 20));
  // 红虚线全程恒亮（可达域未收窄）
  const konst = clamp01(progress(frame, atConst, 12));
  // 墙内目录/线两色分层各闪一拍
  const layerRoom = Math.sin(Math.PI * clamp01(progress(frame, atLayer, 14)));
  const layerLine = Math.sin(Math.PI * clamp01(progress(frame, atLayer + 12, 14)));
  // 金句卡淡入定格 + 墙体褪为暗层
  const quote = clamp01(progress(frame, atQuote, 16));
  return (
    <AbsoluteFill>
      {/* 墙体剖面（钢青砖纹——立起后随金句卡褪暗） */}
      <div style={{position: 'absolute', left: WALL_4D.x, top: WALL_4D.y, width: WALL_4D.w, height: WALL_4D.h, opacity: wall * (1 - quote * 0.62)}}>
        <svg width={WALL_4D.w} height={WALL_4D.h} viewBox={`0 0 ${WALL_4D.w} ${WALL_4D.h}`} style={{overflow: 'visible'}}>
          {Array.from({length: 10}, (_, r) => {
            const bh = WALL_4D.h / 10;
            const off = r % 2 === 0 ? 0 : WALL_4D.w / 4;
            return (
              <g key={`br${r}`}>
                {[0, 1].map((c) => (
                  <rect
                    key={`brc${r}-${c}`}
                    x={off + c * (WALL_4D.w / 2)}
                    y={r * bh + 2}
                    width={WALL_4D.w / 2 - 6}
                    height={bh - 4}
                    rx={4}
                    fill={withAlpha(theme.guard, 0.1)}
                    stroke={withAlpha(theme.guard, 0.75)}
                    strokeWidth={3}
                  />
                ))}
              </g>
            );
          })}
        </svg>
        {/* 墙标（钢青——隔离边界即指即收） */}
        <div style={{position: 'absolute', left: -18, top: -40, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.guard, whiteSpace: 'nowrap'}}>
          隔离边界
        </div>
      </div>
      {/* 墙内左侧：目录房+分支线分色清晰（兰紫房/线 + 钢青围挡） */}
      {IROOMS_4D.map((r, i) => {
        const edit = i === 0 ? editA : editB;
        const flash = i === 0 ? layerRoom : layerRoom * 0.6;
        return (
          <div key={`ir${i}`}>
            <RoomCard x={r.x} y={r.y} w={r.w} h={r.h} litP={1} fenceP={1} flashP={flash * 0.6} />
            {/* 各自发生互不穿透的编辑闪（房内一笔——零跨房元素） */}
            {edit > 0.04 ? (
              <div
                style={{
                  position: 'absolute',
                  left: r.x + 22,
                  top: r.y + r.h * 0.5,
                  width: 64 * edit,
                  height: 10,
                  borderRadius: 3,
                  background: withAlpha(theme.line, 0.8),
                }}
              />
            ) : null}
          </div>
        );
      })}
      {/* 墙内分支线（自房牵向左缘——兰紫分层闪） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {IROOMS_4D.map((r, i) => (
          <line
            key={`il${i}`}
            x1={130}
            y1={430 + i * 40}
            x2={r.x}
            y2={r.y + r.h / 2}
            stroke={theme.line}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={(0.55 + 0.45 * layerLine) * wall}
          />
        ))}
      </svg>
      {/* 墙外右侧：远处目标（路径虚线仍连通——警示红虚线贯穿墙体无阻断） */}
      <div style={{position: 'absolute', left: TARGET_4D.x, top: TARGET_4D.y, opacity: 0.75}}>
        <svg width={90} height={90} viewBox="0 0 90 90">
          <rect x={8} y={10} width={74} height={70} rx={8} fill="none" stroke={theme.dim} strokeWidth={4} />
          {[0, 1, 2].map((s) => (
            <line key={`sv${s}`} x1={20} y1={30 + s * 18} x2={70} y2={30 + s * 18} stroke={theme.dim} strokeWidth={3.5} strokeLinecap="round" />
          ))}
          <circle cx={76} cy={16} r={5} fill={theme.danger} />
        </svg>
        <div style={{position: 'absolute', left: -30, top: 96, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
          远处目标
        </div>
      </div>
      {/* 警示红虚线（墙内房 → 穿墙 → 远处目标——连续一笔、贯穿无阻断） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <line
          x1={IROOMS_4D[0].x + IROOMS_4D[0].w}
          y1={IROOMS_4D[0].y + 60}
          x2={TARGET_4D.x + 45}
          y2={TARGET_4D.y + 45}
          stroke={theme.danger}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray="14 10"
          pathLength={1}
          strokeDashoffset={1 - escape}
          opacity={0.55 + 0.45 * konst}
        />
      </svg>
      {/* 金句卡（衬线体压轴——caption-dup-ok 登记；墙褪暗层） */}
      {quote > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 620,
            transform: `translateX(-50%) translateY(${(1 - quote) * 22}px)`,
            zIndex: 3,
            opacity: quote,
          }}
        >
          <div
            style={{
              // caption-dup-ok: 金句卡复述 p4-06 结论词（边界护栏卡=本集记忆点，隔两句同幕回扣，承 ep1 5-A 豁免先例——storyboard 4-D 行登记）
              padding: '26px 52px',
              borderRadius: 14,
              border: `2px solid ${withAlpha(theme.core, 0.5)}`,
              background: withAlpha(theme.panel, 0.98),
              fontFamily: theme.serif,
              fontSize: 42,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              letterSpacing: 2,
            }}
          >
            挡互踩 · 不挡越狱
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7 * (1 - quote * 0.6)}}>
        {'施工面，不是笼子 · 红虚线贯穿＝够得着的地方一点没变'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P4ProductionEntries: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p4-01', 'p4-02');
  const bB = w('p4-03', 'p4-04');
  const bC = w('p4-05');
  const bD = w('p4-06', 'p4-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <FourA atArch={wa('p4-01', 0.86) - bA.from} atLeftName={wa('p4-02', 0.42) - bA.from} />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FourB
          atEnter={wa('p4-03', 0.14) - bB.from}
          atSwitch={wa('p4-03', 0.58) - bB.from}
          atExit={wa('p4-04', 0.28) - bB.from}
          atCheck={wa('p4-04', 0.55) - bB.from}
          atReturn={wa('p4-04', 0.88) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <FourC atName={wa('p4-05', 0.07) - bC.from} atPod={wa('p4-05', 0.50) - bC.from} atBound={wa('p4-05', 0.86) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <FourD
          atWall={wa('p4-06', 0.38) - bD.from}
          atNoCross={wa('p4-06', 0.57) - bD.from}
          atEscape={wa('p4-06', 0.76) - bD.from}
          atLayer={wa('p4-07', 0.17) - bD.from}
          atConst={wa('p4-07', 0.86) - bD.from}
          atQuote={wa('p4-08', 0.76) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4ProductionEntries;
