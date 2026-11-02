/** P1 一间账本几间房（p1-01..p1-10，4 镜）——分镜 1-A / 1-B / 1-C / 1-D。
 *
 *  Morph Continuity（0-C→1-A，头注明示）：同一主体 = 账本+房槽组。起止态：
 *  0-C 末帧账本居中小比例、三间房暗态轮廓挂侧 → 1-A 首帧同布局全局一拍 →
 *  急推放大（连续 scale/translate，账本封面描边、房槽轮廓、细线拓扑逐帧不变，
 *  仅尺度放大与环体/新房入场——morph 由同一合成物变焦实现，回退条件=跳帧）。
 *
 *  叙事链：1-A 急推账本特写（@pushIn，动机：p1-01 立拍拦截「不是副本」——
 *  压向账本主体给否定对象特写）：p1-01「不是复制粘贴出来的副本」词落位复制
 *  图标弹出即被红杠划掉〔M-005〕（拦截 cue 前置 ≤0.45）→ p1-02「另一份工作
 *  目录」词落位新房自账本侧沿生长（兰紫描边空房——生长语义≠复制出现）、
 *  「工作树」词落位房顶名牌亮出（角标 git worktree）→ p1-03「一条线」词落位
 *  分支线自账本抽出连到新房、「互不相扰」词落位线身独立描边一闪；环体旁挂
 *  亮出（执行段挂工作目录指针，指向当前主目录——读写落哪间房由绑定说了算）
 *  → 1-B 绑定语义镜：p1-04「一任务一间」词落位绑定虚线自房牵至任务卡、卡框
 *  亮起〔M-005〕→ p1-05「两个参数」词落位名字签+任务编号签就位（关键词化不显
 *  具体值，角标 create_worktree(name, task_id)）→ 1-C 建房三件逐一点火
 *  （Animated Worked Example）：p1-06 三枚枚举词各落位一件——①目录房落位
 *  （.worktrees/ 围挡）②分支线抽出（兰紫实线，角标 wt/&lt;name&gt;）③房号
 *  写入任务卡兰紫字段；单输入「auth-refactor + 任务编号」自两参数签飞入逐件
 *  驱动（取 P2 角标同名值作演示——worked example 单输入全程可追）；环体指针
 *  同步摆向新房 → p1-07「只写房号」词落位房号字段亮起、「不动状态」词落位
 *  「待领」灯明确不翻色（静止即陈述〔M-003〕，重音镜——灯周晕环一闪而灯色
 *  恒定）→ p1-08「提前备好」词落位任务卡+房小队列入场、「领走就带房」词落位
 *  队首卡被一支光标接走、其房随卡同移 → 1-D 名字门禁：p1-09「一到六十四个
 *  字符」词落位 1..64 字符窗标尺立起（示例名恰落窗内）、「只认字母数字和几
 *  种符号」词落位白名单滚动带亮起（非白名单字符被剔出）→ p1-10「两个点」
 *  词落位「..」签撞门弹回+警示红描边一闪〔M-005〕、「挡死」词落位门禁卡整体
 *  一沉定格、「房备好了」词落位镜头拉半档回主装置位（承下一幕）。
 *
 *  空间契约（安全带实算）：1-A 账本底 210+430=640 / 新房底 380+180=560 /
 *  主目录签底 ≈ 724 / 环体底 160+240=400；1-B 账本底 590 / 任务卡底 580；
 *  1-C 小队列底 ≈ 740；1-D 门禁卡底 630——全部 ≤ 860。三件点火次序=口播
 *  次序、指针单次摆动、「待领」灯全镜恒色（绑定不改状态红线）、复制图标划掉
 *  后即退、新房禁以复制方式出现、绑定线 1-B 不接实、门内禁「..」进入。
 *  机制英文词只进角标（git worktree / .worktrees/ / wt/&lt;name&gt; /
 *  create_worktree）。词落位 = wa(id,f)；y≥110 ≥ 56。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  BranchLine,
  CursorArrow,
  LedgerBlock,
  NameGateCard,
  RoomCard,
  TaskCard,
  WorkRing,
} from '../components/motifs';
import {DUR, clamp01, progress} from '../motion';
import {ease} from '../components/motifs';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 1-A 急推账本特写：morph 变焦 + 复制拦截 + 新房生长 + 分支线 ────────────────

/** 1-A 布局（安全带实算见头注）。morph 初态 = 0-C 全局位：账本中心 (510,425)
 *  经 translate(563,154)+scale(0.72) 落到 (930,460)——拓扑不变仅尺度。 */
const AA = {
  ledger: {x: 380, y: 210, w: 260, h: 430},
  ring: {x: 690, y: 160, size: 240},
  mainDir: {x: 850, y: 660},
  room: {x: 1150, y: 380, w: 220, h: 180},
  copyIcon: {x: 1120, y: 270},
} as const;
/** 分支线：账本右缘 (640,460) → 新房左缘 (1150,464) */
const BL_1A = {x1: 640, y1: 460, x2: 1150, y2: 464} as const;

/** 复制粘贴图标（两叠方片）+ 禁止红杠——弹出即划掉、划掉后即退 */
const CopyStrike: React.FC<{litP: number; strikeP: number; retireP: number}> = ({litP, strikeP, retireP}) => {
  const lit = clamp01(litP);
  const strike = clamp01(strikeP);
  const retire = clamp01(retireP);
  if (retire > 0.98) return null;
  return (
    <div style={{position: 'absolute', left: AA.copyIcon.x, top: AA.copyIcon.y, opacity: lit * (1 - retire)}}>
      <svg width={110} height={110} viewBox="0 0 110 110" style={{overflow: 'visible'}}>
        <g stroke={theme.dim} strokeWidth={5} fill="none" opacity={0.9}>
          <rect x={30} y={30} width={54} height={54} rx={8} />
          <path d="M42 30 v-14 h54 v54 h-14" />
        </g>
        {strike > 0.02 ? (
          <line
            x1={14}
            y1={96}
            x2={14 + strike * 82}
            y2={96 - strike * 82}
            stroke={theme.danger}
            strokeWidth={7}
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      {strike > 0.5 ? (
        <div style={{position: 'absolute', left: -6, top: 108, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap'}}>
          不是副本
        </div>
      ) : null}
    </div>
  );
};

const OneA: React.FC<{
  atPush: number;
  atCopy: number;
  atStrike: number;
  atGrow: number;
  atPlate: number;
  atLine: number;
  atIndep: number;
}> = ({atPush, atCopy, atStrike, atGrow, atPlate, atLine, atIndep}) => {
  const frame = useCurrentFrame();
  // morph 急推（0-C 全局位 → 账本特写：s 0.72→1 / 偏移 563,154→0,0）
  const push = ease(clamp01(progress(frame, atPush, 20)));
  const s = 0.72 + 0.28 * push;
  const tx = 563 * (1 - push);
  const ty = 154 * (1 - push);
  // 复制图标：弹出（拦截 cue 前置）→ 红杠划掉 → 即退
  const copy = clamp01(progress(frame, atCopy, 8));
  const strike = clamp01(progress(frame, atStrike, 10));
  const retire = clamp01(progress(frame, atStrike + 14, 12));
  // 新房自账本侧沿生长（生长语义≠复制出现）
  const grow = clamp01(progress(frame, atGrow, 24));
  // 房顶名牌「工作树」
  const plate = clamp01(progress(frame, atPlate, 12));
  // 分支线抽出 + 线身独立描边一闪
  const line = clamp01(progress(frame, atLine, 18));
  const indep = Math.sin(Math.PI * clamp01(progress(frame, atIndep, 18)));
  // 环体旁挂亮出（随急推渐显）+ 执行段点亮 + 指针指主目录
  const ring = clamp01(progress(frame, atPush + 8, 16));
  const arc = clamp01(progress(frame, atPush + 16, 12));
  const ptr = clamp01(progress(frame, atPush + 20, 14));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: `translate(${tx}px, ${ty}px) scale(${s})`, transformOrigin: '0 0'}}>
        {/* 账本（承 0-C 封面描边与房槽拓扑——morph 中恒在） */}
        <LedgerBlock x={AA.ledger.x} y={AA.ledger.y} w={AA.ledger.w} h={AA.ledger.h} riseP={1} slots={3} slotsLitP={[0.55, 0.55, 0.55]} />
        {/* 环体旁挂 + 执行段工作目录指针（本集判定性契约首锚——指针指当前主目录） */}
        <WorkRing
          x={AA.ring.x}
          y={AA.ring.y}
          size={AA.ring.size}
          litP={ring}
          arcP={arc}
          ptA={{x: AA.mainDir.x + 60, y: AA.mainDir.y}}
          ptB={{x: AA.mainDir.x + 60, y: AA.mainDir.y}}
          swingP={0}
          ptrP={ptr}
          tagP={arc}
        />
        {/* 主目录签（指针初始靶点——当前主目录） */}
        <div style={{position: 'absolute', left: AA.mainDir.x, top: AA.mainDir.y, display: 'flex', alignItems: 'center', gap: 10, opacity: ring}}>
          <svg width={40} height={34} viewBox="0 0 40 34">
            <path d="M3 4 h13 l5 6 h16 v20 h-34 z" fill={withAlpha(theme.dim, 0.18)} stroke={theme.dim} strokeWidth={2.6} />
          </svg>
          <span style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>主目录</span>
        </div>
        {/* 复制粘贴图标 + 禁止红杠（弹出即划掉） */}
        <CopyStrike litP={copy} strikeP={strike} retireP={retire} />
        {/* 新房（自账本侧沿生长——兰紫描边空房 + 房顶名牌「工作树」） */}
        <RoomCard
          x={AA.room.x}
          y={AA.room.y}
          w={AA.room.w}
          h={AA.room.h}
          growP={grow}
          name="工作树"
          nameLitP={plate}
          flashP={indep * 0.6}
        />
        {/* 分支线（自账本抽出连到新房——兰紫；角标 git worktree 落线尾下） */}
        <BranchLine x1={BL_1A.x1} y1={BL_1A.y1} x2={BL_1A.x2} y2={BL_1A.y2} drawP={line} litP={indep} />
        {/* 角标组（机制英文词只进角标） */}
        <div style={{position: 'absolute', left: AA.room.x + 10, top: AA.room.y + AA.room.h + 24, fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap', opacity: plate * 0.9}}>
          {'git worktree'}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'不是副本 · 同一本账上铺开的另一份工作目录'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 绑定语义镜：任务卡钢青框 + 房号字段空位 + 两枚参数签 + 待接虚线 ─────────

/** 1-B 布局（安全带实算：账本底 590 / 房底 510 / 任务卡底 580） */
const AB = {
  ledger: {x: 170, y: 250, w: 200, h: 340},
  room: {x: 440, y: 350, w: 190, h: 160},
  card: {x: 1160, y: 300, w: 470, h: 280},
  params: [
    {x: 400, y: 240, label: '名字'},
    {x: 580, y: 240, label: '任务编号'},
  ],
} as const;

const OneB: React.FC<{atBind: number; atParams: number}> = ({atBind, atParams}) => {
  const frame = useCurrentFrame();
  // 绑定虚线自房牵至任务卡 + 卡框亮起（「一任务一间」）
  const bind = clamp01(progress(frame, atBind, 16));
  const cardLit = clamp01(progress(frame, atBind + 6, 12));
  // 两枚参数签各就位（「两个参数」——关键词化不显具体值）
  const p1 = clamp01(progress(frame, atParams, 10));
  const p2 = clamp01(progress(frame, atParams + 8, 10));
  return (
    <AbsoluteFill>
      {/* 账本缩居屏左（承 1-A 末态签名） */}
      <LedgerBlock x={AB.ledger.x} y={AB.ledger.y} w={AB.ledger.w} h={AB.ledger.h} slots={3} slotsLitP={[0.55, 0.55, 0.55]} />
      {/* 房（1-A 新房在场） */}
      <RoomCard x={AB.room.x} y={AB.room.y} w={AB.room.w} h={AB.room.h} growP={1} />
      {/* 绑定虚线（兰紫 dashed——待接；点火在 1-C，本镜禁接实） */}
      <BranchLine x1={AB.room.x + AB.room.w} y1={AB.room.y + 90} x2={AB.card.x} y2={AB.card.y + 120} drawP={0} dashed litP={bind * 0.9} />
      {/* 任务卡（钢青框亮出 + 房号字段空位（兰紫描边）+ 状态角「待领」灯） */}
      <TaskCard
        x={AB.card.x}
        y={AB.card.y}
        w={AB.card.w}
        h={AB.card.h}
        id="task_014"
        title="认证重构"
        litP={cardLit}
        pendingLitP={cardLit}
      />
      {/* 两枚参数签（名字 / 任务编号——关键词标签） */}
      {AB.params.map((p, i) => {
        const lit = i === 0 ? p1 : p2;
        return (
          <div
            key={`pm${i}`}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y - (1 - lit) * 14,
              padding: '8px 20px',
              borderRadius: 10,
              border: `2.5px solid ${withAlpha(theme.line, 0.4 + 0.6 * lit)}`,
              background: withAlpha(theme.panel, 0.97),
              fontFamily: theme.sans,
              fontSize: 20,
              fontWeight: 700,
              color: lit > 0.5 ? theme.text : theme.dim,
              whiteSpace: 'nowrap',
              opacity: lit,
            }}
          >
            {p.label}
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'create_worktree(name, task_id) · 一任务一间'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 建房三件逐一点火（Animated Worked Example）+ 队列领走 ──────────────────

/** 1-C 布局（承 1-B；小队列底 ≈ 740；环体缩悬上中——底 320） */
const AC = {
  ring: {x: 760, y: 110, size: 210},
  queueY: 620,
  queueXs: [1020, 1230, 1440],
} as const;
/** 单输入演示值（取 P2 角标同名值——worked example 单输入全程可追） */
const DEMO_NAME = 'auth-refactor';

const OneC: React.FC<{
  atDir: number;
  atBranch: number;
  atField: number;
  atSwing: number;
  atOnlyNum: number;
  atStill: number;
  atQueue: number;
  atTake: number;
}> = ({atDir, atBranch, atField, atSwing, atOnlyNum, atStill, atQueue, atTake}) => {
  const frame = useCurrentFrame();
  // ① 目录房落位（.worktrees/ 围挡亮出）
  const fence = clamp01(progress(frame, atDir, 14));
  // ② 分支线抽出（兰紫实线——自账本缘到房缘）
  const bl = clamp01(progress(frame, atBranch, 14));
  const blLabel = clamp01(progress(frame, atBranch + 12, 8));
  // ③ 房号写入任务卡兰紫字段（逐字落入）
  const fw = clamp01(progress(frame, atField, 20));
  // 单输入飞入（名字签值 → 房 / 编号签值 → 字段——逐件驱动全程可追）
  const chipA = clamp01(progress(frame, atDir - 8, 14));
  const chipB = clamp01(progress(frame, atField - 10, 14));
  // 环体指针单次摆向新房（摆向新房=读写落点切换）
  const swing = clamp01(progress(frame, atSwing, 16));
  const arc = 1;
  // 「只写房号」字段亮起
  const glow = Math.sin(Math.PI * clamp01(progress(frame, atOnlyNum, 20)));
  // 「不动状态」——待领灯不翻色的静止陈述（晕环一闪、灯色恒定）
  const stillHalo = Math.sin(Math.PI * clamp01(progress(frame, atStill, 24)));
  // 小队列入场（主事的备货——三对卡+房 stagger）
  const qIn = (i: number) => clamp01(progress(frame, atQueue + i * 6, 12));
  // 队首卡被光标接走、房随卡同移
  const take = clamp01(progress(frame, atTake, 18));
  // 卡与字段的常量（承 1-B 布局）
  const card = AB.card;
  return (
    <AbsoluteFill>
      {/* 账本 + 房（承 1-B） */}
      <LedgerBlock x={AB.ledger.x} y={AB.ledger.y} w={AB.ledger.w} h={AB.ledger.h} slots={3} slotsLitP={[0.55, 0.55, 0.55]} />
      <RoomCard x={AB.room.x} y={AB.room.y} w={AB.room.w} h={AB.room.h} growP={1} fenceP={fence} />
      {/* ② 分支线（实线抽出——角标 wt/<name> 落线身） */}
      <BranchLine
        x1={AB.ledger.x + AB.ledger.w - 6}
        y1={AB.room.y + 80}
        x2={AB.room.x + 4}
        y2={AB.room.y + 80}
        drawP={bl}
        litP={bl}
        label={`wt/${DEMO_NAME}`}
        labelP={blLabel}
      />
      {/* 环体（缩悬上中——执行段指针单次摆向新房） */}
      <WorkRing
        x={AC.ring.x}
        y={AC.ring.y}
        size={AC.ring.size}
        arcP={arc}
        ptA={{x: AB.ledger.x + 100, y: AB.ledger.y + AB.ledger.h + 40}}
        ptB={{x: AB.room.x + AB.room.w / 2, y: AB.room.y - 6}}
        swingP={swing}
        ptrP={1}
        tagP={1}
      />
      {/* 任务卡（钢青框 + 兰紫房号字段写入 + 「待领」灯恒色） */}
      <TaskCard
        x={card.x}
        y={card.y}
        w={card.w}
        h={card.h}
        id="task_014"
        title="认证重构"
        litP={1}
        pendingLitP={1}
        fieldWriteP={fw}
        fieldValue={DEMO_NAME}
        fieldGlowP={glow}
      />
      {/* 「不动状态」静止陈述晕环（待领灯周——一闪而灯色恒定，重音镜） */}
      {stillHalo > 0.04 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <circle
            cx={card.x + card.w - 96}
            cy={card.y + 30}
            r={20 + 10 * stillHalo}
            fill="none"
            stroke={theme.dim}
            strokeWidth={3}
            opacity={0.8 * stillHalo}
            strokeDasharray="5 5"
          />
        </svg>
      ) : null}
      {/* 单输入飞入芯片（名字值 → 房 / 编号值 → 字段） */}
      {chipA > 0.02 && chipA < 0.98 ? (
        <div
          style={{
            position: 'absolute',
            left: 470 + chipA * 90,
            top: 262 + chipA * 130,
            padding: '3px 12px',
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(theme.line, 0.9)}`,
            background: withAlpha(theme.panel, 0.97),
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.line,
            whiteSpace: 'nowrap',
            opacity: 1 - Math.max(0, chipA - 0.8) * 5,
          }}
        >
          {DEMO_NAME}
        </div>
      ) : null}
      {chipB > 0.02 && chipB < 0.98 ? (
        <div
          style={{
            position: 'absolute',
            left: 640 + chipB * 520,
            top: 262 + chipB * 220,
            padding: '3px 12px',
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(theme.line, 0.9)}`,
            background: withAlpha(theme.panel, 0.97),
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.line,
            whiteSpace: 'nowrap',
            opacity: 1 - Math.max(0, chipB - 0.8) * 5,
          }}
        >
          {'task_014'}
        </div>
      ) : null}
      {/* 小队列入场（任务卡+房成对——备货具象；队首被光标接走、房随卡同移） */}
      {AC.queueXs.map((qx, i) => {
        const inP = qIn(i);
        const taken = i === 0 ? take : 0;
        return (
          <div
            key={`q${i}`}
            style={{
              position: 'absolute',
              left: qx - taken * 340,
              top: AC.queueY - taken * 260,
              opacity: inP * (1 - taken * 0.92),
              transform: `translateY(${(1 - inP) * 22}px)`,
            }}
          >
            <div style={{position: 'relative', width: 170, height: 120}}>
              <TaskCard x={0} y={0} w={170} h={110} id="task_015" title={`备货 ${i + 1}`} micro pendingLitP={1} />
              <div style={{position: 'absolute', left: 128, top: 18}}>
                <RoomCard x={0} y={0} w={74} h={62} />
              </div>
            </div>
          </div>
        );
      })}
      {/* 接走队首的光标（领走就带房） */}
      {take > 0.02 ? (
        <CursorArrow x={AC.queueXs[0] - 300 + (1 - take) * 120} y={AC.queueY - 240 + (1 - take) * 140} litP={take} label="领走" />
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'开目录 · 起线 · 写房号 · 只写房号、不动状态'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-D 名字门禁：1..64 字符窗标尺 + 白名单带 + 「..」撞门弹回 + 挡死一沉 ───────

/** 1-D 布局（安全带实算：门禁卡底 630；拉半档后缩至 0.9 仍 ≤ 860） */
const GATE_1D = {x: 650, y: 210, w: 620, h: 420} as const;

const OneD: React.FC<{atRuler: number; atBand: number; atEject: number; atHit: number; atHit2: number; atSink: number; atBack: number}> = ({
  atRuler,
  atBand,
  atEject,
  atHit,
  atHit2,
  atSink,
  atBack,
}) => {
  const frame = useCurrentFrame();
  const ruler = clamp01(progress(frame, atRuler, 14));
  const band = clamp01(progress(frame, atBand, 12));
  const eject = clamp01(progress(frame, atEject, 12));
  const hit = clamp01(progress(frame, atHit, 18));
  const hitFlash = Math.sin(Math.PI * clamp01(progress(frame, atHit + 8, 14)));
  const hit2 = clamp01(progress(frame, atHit2, 18));
  const sink = clamp01(progress(frame, atSink, 12));
  // 拉半档回主装置位（承下一幕——整组缩 0.9 + 深处主装置位暗层浮现）
  const back = ease(clamp01(progress(frame, atBack, 18)));
  const stage = clamp01(progress(frame, atBack + 8, 16));
  return (
    <AbsoluteFill>
      {/* 深处主装置位（P2 走查舞台预告——暗层剪影，禁显机制细节） */}
      <div style={{position: 'absolute', inset: 0, opacity: stage * 0.3}}>
        <LedgerBlock x={855} y={250} w={210} h={360} dimP={0.8} ghost slots={0} />
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <line x1={700} y1={430} x2={855} y2={430} stroke={theme.dim} strokeWidth={3} opacity={0.5} />
          <line x1={1065} y1={430} x2={1220} y2={430} stroke={theme.dim} strokeWidth={3} opacity={0.5} />
        </svg>
      </div>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1 - 0.1 * back})`, transformOrigin: '50% 46%'}}>
        <NameGateCard
          x={GATE_1D.x}
          y={GATE_1D.y}
          w={GATE_1D.w}
          h={GATE_1D.h}
          litP={1}
          rulerP={ruler}
          bandP={band}
          bandShift={frame * 0.55}
          ejectP={eject}
          hitP={hit}
          hit2P={hit2}
          sinkP={sink}
        />
      </div>
      {/* 撞门红描边一闪（门禁卡边框泛红一拍——撞门时刻） */}
      {hitFlash > 0.04 ? (
        <div
          style={{
            position: 'absolute',
            left: GATE_1D.x - 8,
            top: GATE_1D.y - 8,
            width: GATE_1D.w + 16,
            height: GATE_1D.h + 16,
            borderRadius: 20,
            border: `3px solid ${withAlpha(theme.danger, 0.8 * hitFlash)}`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'名字门禁 · 1..64 字符 · 两个点，进不来'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P1LedgerAndRooms: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p1-01', 'p1-03');
  const bB = w('p1-04', 'p1-05');
  const bC = w('p1-06', 'p1-08');
  const bD = w('p1-09', 'p1-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <OneA
          atPush={wa('p1-01', 0.08) - bA.from}
          atCopy={wa('p1-01', 0.42) - bA.from}
          atStrike={wa('p1-01', 0.60) - bA.from}
          atGrow={wa('p1-02', 0.48) - bA.from}
          atPlate={wa('p1-02', 0.90) - bA.from}
          atLine={wa('p1-03', 0.34) - bA.from}
          atIndep={wa('p1-03', 0.84) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <OneB atBind={wa('p1-04', 0.78) - bB.from} atParams={wa('p1-05', 0.26) - bB.from} />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <OneC
          atDir={wa('p1-06', 0.28) - bC.from}
          atBranch={wa('p1-06', 0.55) - bC.from}
          atField={wa('p1-06', 0.83) - bC.from}
          atSwing={wa('p1-06', 0.55) - bC.from}
          atOnlyNum={wa('p1-07', 0.20) - bC.from}
          atStill={wa('p1-07', 0.42) - bC.from}
          atQueue={wa('p1-08', 0.28) - bC.from}
          atTake={wa('p1-08', 0.82) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="1-D">
        <OneD
          atRuler={wa('p1-09', 0.40) - bD.from}
          atBand={wa('p1-09', 0.76) - bD.from}
          atEject={wa('p1-09', 0.94) - bD.from}
          atHit={wa('p1-10', 0.08) - bD.from}
          atHit2={wa('p1-10', 0.24) - bD.from}
          atSink={wa('p1-10', 0.52) - bD.from}
          atBack={wa('p1-10', 0.72) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1LedgerAndRooms;
