/** P2 三步任务走一遍（p2-01..p2-10，3 镜）——分镜 2-A / 2-B / 2-C。
 *
 *  叙事链：2-A 走查舞台全景（Animated State Trace 承前集同款）——左轨消息条
 *  竖列（用户任务卡携三签落顶格 + snake_case 角标小注）、右轨清单卡+计数器驻
 *  侧翼〔承 1-D morph：装置移驻舞台侧位、清单行清空建单、计数器归 0〕、环体
 *  缩悬顶角（挂点微光在位）、底部 t 刻度轴 t1–t11 游标待发 →「建清单」三行
 *  依次成文首条标进行中、「进了对话」清单快照条以消息身份插左轨列尾（1-A
 *  通道演示的走查兑现）、「开工」改文件调用块弹出执行（青碧）→ 2-B 一镜两段
 *  速差：上半顺利段快进（首条打勾次条高亮计数清零）→ 转折吸收窗口慢镜——
 *  测试失败条插入放大（警示红描边）、注意力光圈收缩吸住、修测试条连刷、清单
 *  快照条被挤出可见区渐暗（0-C 语义回扣）、「一，二，三」计数器逐格爬升与
 *  音节同拍、爬到 3 紫色脉冲蓄势一拍悬停 → 2-C 注入→拉回→收尾快进：提醒条
 *  沿紫色脉冲线插入消息尾部 + 环体调用前挂点同拍闪亮（本集两大 punch 之一，
 *  1–2s）、光圈松开清单卡重建（前两勾末条高亮——P1 图例走完闭环）、收尾
 *  三勾全亮+任务完成状态灯（确认绿）、疑问钩字卡浮起半拍收暗（悬念交给 P3）。
 *
 *  空间契约：左右双轨恒并置、清单三态样式与 1-B 图例同款同色、t 游标推进与
 *  拍对应、snake_case 只进角标；快进段与慢镜段速差可感、计数器读数与口播逐拍
 *  一致、清单条退场=渐暗非删除；计数器在清单仍可见时不爬升（因果：没碰才计
 *  数）、光圈套住的是失败条非清单；提醒条紫与计数器同源色、重建态=前两勾+
 *  末条高亮、注入恒在下轮调用前（挂点闪亮为证）、三勾在「任务完成」词前不
 *  预亮、疑问钩字卡不给答案。
 *
 *  红线落实：词落位 = wa(id,f)；因果链时序硬约束（挤出窗外在前、计数爬升在
 *  后）；y≥56 / bottom≥168（t 轴 bottom 200 以上）；reminder 英文只进角标。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {FocusRing, LoopRing, MsgBar, NagCounter, RingPoint, TAxis, TodoListCard, ringPt} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 走查舞台几何（全幕恒定——双轨并置 + 顶角环 + 底部 t 轴） */
const STAGE = {
  leftX: 190,
  leftTop: 210,
  leftW: 560,
  rightX: 1020,
  rightTop: 220,
  ring: {cx: 1700, cy: 250, size: 250},
  axis: {x: 190, y: 880, w: 1500},
} as const;

/** 用户任务卡（三签 + snake_case 角标）。⑨ QA W2：提升为 P2 幕级常驻层——
 *  原 2-A Sequence 内实现导致 2-A→2-B 切点任务卡消失、左轨条目硬跳；现三镜
 *  共用同一位（leftTop+34，入场动画幕级锚），快照条/消息条 y 跨镜对齐。 */
const TaskCardLayer: React.FC<{atTask: number; dim?: number}> = ({atTask, dim = 0}) => {
  const taskIn = useProgress(atTask, DUR.f5, 'decelerate');
  return (
    <div
      style={{
        position: 'absolute',
        left: STAGE.leftX,
        top: STAGE.leftTop + 34 - 60 * (1 - taskIn),
        width: STAGE.leftW,
        opacity: taskIn * (1 - dim),
      }}
    >
      <div
        style={{
          boxSizing: 'border-box',
          borderRadius: 12,
          border: `2.5px solid ${withAlpha(theme.dim, 0.85)}`,
          background: theme.panel,
          padding: '12px 18px',
          position: 'relative',
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'user · task'}</span>
        <div style={{display: 'flex', gap: 10, marginTop: 8}}>
          {['改下划线命名', '跑测试', '写报告'].map((t) => (
            <span
              key={t}
              style={{
                fontFamily: theme.sans,
                fontSize: 19,
                fontWeight: 600,
                color: theme.text,
                border: `2px solid ${withAlpha(theme.text, 0.55)}`,
                borderRadius: 7,
                padding: '3px 10px',
                whiteSpace: 'nowrap',
              }}
            >
              {t}
            </span>
          ))}
        </div>
        <div style={{position: 'absolute', right: 14, bottom: 8, fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>
          {'snake_case'}
        </div>
      </div>
    </div>
  );
};

/** 左轨条目基准位（⑨ QA W2/N2 跨镜对齐）：快照条 onBand = 窗带上缘内侧
 *  （绝对 470），2-A 建单落位与 2-B 挤出前同位；2-C rebuild 回窗带内 518。 */
const SNAP = {y: STAGE.leftTop + 260, inBand: STAGE.leftTop + 308, outBand: STAGE.leftTop + 158} as const;

/** 环体顶角小件（挂点微光恒驻；2-C 闪亮） */
const StageRing: React.FC<{pulse?: number}> = ({pulse = 0}) => {
  const frame = useCurrentFrame();
  const dot = (frame / (30 * 3.4)) % 1;
  const r = STAGE.ring.size / 2 - 46;
  return (
    <>
      <div style={{position: 'absolute', left: STAGE.ring.cx - STAGE.ring.size / 2, top: STAGE.ring.cy - STAGE.ring.size / 2, opacity: 0.5}}>
        <LoopRing size={STAGE.ring.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      <RingPoint cx={ringPt(STAGE.ring.cx, STAGE.ring.cy, r, 25).x} cy={ringPt(STAGE.ring.cx, STAGE.ring.cy, r, 25).y} r={9} lit={0.45 + 0.55 * clamp01(pulse)} pulse={pulse} />
    </>
  );
};

// ── 2-A 建单 + 快照入列 + 开工 ──────────────────────────────────────────

const TwoA: React.FC<{
  atBoard: number;
  atMorph: number;
  atBuild: number;
  atFirst: number;
  atSnap: number;
  atWork: number;
}> = ({atBoard, atMorph, atBuild, atFirst, atSnap, atWork}) => {
  const frame = useCurrentFrame();
  // 口径标牌亮起（「教学版」——为讲清机制搭的简化版，设计走查例口径签）
  const board = useProgress(atBoard, DUR.f5);
  // morph（1-D→2-A）：装置自画面中央（1-D 全貌位）移驻走查舞台侧位——
  // 位移中两半排布、刻度盘形制不变；清单行清空建单发生在落位后（回退判据规避）。
  // ⑨ QA W1：atMorph 提前至 wa('p2-01',0.06) 且两半 lit 恒 1——原 0.3 档锚
  // 装置 2.3s 全隐后空中显形（两头不靠）；现真滑移承接（1-D 末帧位起全程可见）
  const morph = useProgress(atMorph, DUR.f6, 'decelerate');
  // 建单：三行依次成文（改命名/跑测试/写报告关键词签——不预写句）
  const buildRows = [
    clamp01(progress(frame, atBuild, DUR.f3)),
    clamp01(progress(frame, atBuild + 6, DUR.f3)),
    clamp01(progress(frame, atBuild + 12, DUR.f3)),
  ];
  // 首条标进行中（三态机在位）
  const firstActive = useProgress(atFirst, DUR.f4);
  const states = ['todo', 'todo', 'todo'].map((s, i) => (i === 0 && firstActive > 0.5 ? 'active' : s)) as ('todo' | 'active')[];
  // 清单快照条以消息身份插入左轨列尾（1-A 通道演示的走查兑现）
  const snapIn = useProgress(atSnap, DUR.f4, 'decelerate');
  // 开工：改文件调用块自消息列弹出执行（青碧）
  const work = useProgress(atWork, DUR.f4, 'decelerate');
  // W1：morph 插值两端 = 1-D 末帧全貌位（清单卡 560/320、计数器 990/540）→
  // 走查舞台侧位；全程 lit=1 真滑移
  const cardX = 560 + (STAGE.rightX - 560) * morph;
  const cardY = 320 + (STAGE.rightTop + 60 - 320) * morph;
  const cntX = 990 + (STAGE.rightX + 480 - 990) * morph;
  const cntY = 540 + (STAGE.rightTop + 330 - 540) * morph;
  const cntScale = 0.75 + 0.25 * morph;
  return (
    <AbsoluteFill>
      {/* 口径标牌（舞台顶部——教学版口径） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 92,
          display: 'flex',
          justifyContent: 'center',
          opacity: board,
        }}
      >
        <div
          style={{
            padding: '8px 24px',
            borderRadius: 9,
            border: `2px solid ${withAlpha(theme.dim, 0.6)}`,
            fontFamily: theme.sans,
            fontSize: 21,
            color: theme.dim,
          }}
        >
          {'教学版走查 · 为讲清机制搭的简化版'}
        </div>
      </div>
      {/* ── 左轨：消息条竖列 ── */}
      <div style={{position: 'absolute', left: STAGE.leftX, top: STAGE.leftTop - 30, fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>
        {'messages'}
      </div>
      {/* 清单快照条（以消息身份插列尾——规划蓝行；W2：y 对齐 SNAP 基准位
          （= 2-B 窗带上缘内侧），跨镜零跳变） */}
      <div style={{position: 'absolute', left: STAGE.leftX, top: SNAP.y - 26 * (1 - snapIn), opacity: snapIn}}>
        <MsgBar x={0} y={0} w={STAGE.leftW} h={54} label={'待办清单快照'} sub={'todo_write'} color={theme.mech} lit={snapIn} />
      </div>
      {/* 改文件调用块（开工——青碧执行） */}
      <div style={{position: 'absolute', left: STAGE.leftX, top: STAGE.leftTop + 330 - 30 * (1 - work), opacity: work}}>
        <MsgBar x={0} y={0} w={STAGE.leftW} label={'改文件 · 执行中'} sub={'edit_file'} color={theme.tool} lit={work} flash={work > 0.6 ? 1 : 0} />
      </div>
      {/* ── 右轨：清单卡 + 计数器（1-D morph 落位；W1：lit 恒 1 真滑移承接） ── */}
      <TodoListCard
        x={cardX}
        y={cardY}
        w={470}
        rowStates={states}
        rowLit={buildRows.map((b) => Math.max(0.35, b))}
        lit={1}
        showTag={1}
      />
      <div style={{position: 'absolute', left: cntX, top: cntY, transform: `scale(${cntScale})`, transformOrigin: 'left top', opacity: 1}}>
        <NagCounter x={0} y={0} w={330} count={0} lit={1} watch={1} />
      </div>
      <StageRing />
      {/* 底部 t 刻度轴（t 游标进 t1 → t2；刻度不逐格标字防抢字幕） */}
      <TAxis x={STAGE.axis.x} y={STAGE.axis.y} w={STAGE.axis.w} n={11} cursor={snapIn > 0.4 ? 1 : 0} lit={board} />
    </AbsoluteFill>
  );
};

// ── 2-B 顺利段快进 + 吸收窗口慢镜（一镜两段速差） ───────────────────────

const TwoB: React.FC<{
  atDone: number;
  atNext: number;
  atZero: number;
  atFail: number;
  atRing: number;
  atRush: number;
  atSqueeze: number;
  atCount: number;
  atHold: number;
}> = ({atDone, atNext, atZero, atFail, atRing, atRush, atSqueeze, atCount, atHold}) => {
  const frame = useCurrentFrame();
  // ── 上半顺利段（快进节奏 t3–t4）：首条打勾 → 次条高亮 → 计数清零 ──
  const row1Done = useProgress(atDone, DUR.f3);
  const row2Active = useProgress(atNext, DUR.f3);
  const zero = useImpulse({at: atZero, dur: DUR.f4, peak: 1});
  // ── 转折慢镜（t5–t6）：失败条插入放大（红描边）→ 光圈收缩吸住 → 连刷 ──
  const failIn = useProgress(atFail, DUR.f5, 'decelerate');
  const failBig = 1 + 0.16 * failIn;
  const ringShrink = useProgress(atRing, DUR.f6, 'decelerate');
  const ringHold = useProgress(atRing + DUR.f6, DUR.f4);
  const rush = [0, 1, 2].map((i) => clamp01(progress(frame, atRush + i * 10, DUR.f4)));
  // 清单快照条被挤出可见区渐暗（0-C 视窗语义回扣——渐暗非删除；发生在计数前）
  const squeeze = useProgress(atSqueeze, DUR.f6);
  // 「一，二，三」：三个数字音节与三格步进同拍（逐格爬升）。⑨ QA W3：步进
  // 偏移 +0/+13/+28——按 TTS 实测音节帧对齐（一≈f4465、二≈f4483、三≈f4490
  // 起持续至 4506），原 +0/+9/+18 第三格抢在「三」字前亮
  const CLIMB_OFF = [0, 13, 28];
  const climb = CLIMB_OFF.map((o) => clamp01(progress(frame, atCount + o, DUR.f3)));
  const count = climb[0] + climb[1] + climb[2];
  // 爬到 3 时刻度盘紫色脉冲蓄势一拍悬停（注入前一拍）
  const holdPulse = useProgress(atHold, DUR.f4);
  // 可见区亮带几何（左轨列内——窗内=尾段）。⑨ QA W2：左轨条目 y 跨镜对齐
  // （任务卡幕级常驻底 = leftTop+152；done 条 leftTop+170 起、失败条 440 绝对、
  // 窗带 510-700、rush 三条带内 566-654——互不叠印、与 2-A/2-C 同轨）
  const WINBAND = {top: STAGE.leftTop + 300, h: 190};
  const failCy = 440 + 32;
  const failCx = STAGE.leftX + STAGE.leftW / 2;
  return (
    <AbsoluteFill>
      {/* 左轨列（顺利段消息 + 失败条 + 连刷） */}
      <div style={{position: 'absolute', left: STAGE.leftX, top: STAGE.leftTop - 30, fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>
        {'messages'}
      </div>
      <div style={{position: 'absolute', left: STAGE.leftX, top: STAGE.leftTop + 170, opacity: 0.85}}>
        <MsgBar x={0} y={0} w={STAGE.leftW} label={'改文件 · 完成'} sub={'edit_file'} color={theme.tool} lit={1} />
      </div>
      {/* 测试失败条（插入放大 + 警示红描边——速差转折点） */}
      <div
        style={{
          position: 'absolute',
          left: STAGE.leftX,
          top: 440,
          width: STAGE.leftW,
        }}
      >
        <div
          style={{
            height: 64,
            boxSizing: 'border-box',
            borderRadius: 10,
            border: `3px solid ${theme.danger}`,
            background: withAlpha(theme.danger, 0.12),
            boxShadow: `0 0 ${22 * failIn}px ${withAlpha(theme.danger, 0.5)}`,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '0 18px',
            opacity: failIn,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.danger}}>{'测试失败'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'test failed'}</span>
        </div>
      </div>
      {/* 修测试条连刷（慢镜——扎进修测试） */}
      {rush.map((p, i) => (
        <div key={i} style={{position: 'absolute', left: STAGE.leftX, top: WINBAND.top + 56 + i * 44, opacity: p * 0.9}}>
          <div
            style={{
              width: STAGE.leftW,
              height: 36,
              borderRadius: 7,
              border: `2px solid ${withAlpha(theme.tool, 0.5)}`,
              background: withAlpha(theme.tool, 0.06),
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 14,
              fontFamily: theme.sans,
              fontSize: 17,
              color: theme.dim,
              boxSizing: 'border-box',
            }}
          >
            {`修测试 · 第 ${i + 1} 轮`}
          </div>
        </div>
      ))}
      {/* 清单快照条（挤出窗外变灰——渐暗非删除；0-C 视窗同款窗形）。⑨ QA N2：
          squeeze=0 时贴窗带上缘内侧（SNAP.y=470 绝对，与 2-A 建单落位同点），
          squeeze 后上移出窗顶（368）灰化——窗内→窗外的可见轨迹 */}
      <div
        style={{
          position: 'absolute',
          left: STAGE.leftX,
          top: SNAP.y - (SNAP.y - SNAP.outBand) * squeeze,
          filter: `saturate(${1 - 0.6 * squeeze})`,
        }}
      >
        <MsgBar x={0} y={0} w={STAGE.leftW} h={50} label={'待办清单快照'} sub={'todo_write'} color={theme.mech} lit={1} ghost={squeeze} />
      </div>
      {/* 可见区窗框（左轨尾段亮带——0-C 同款窗形照亮方向） */}
      <div
        style={{
          position: 'absolute',
          left: STAGE.leftX - 12,
          top: WINBAND.top,
          width: STAGE.leftW + 24,
          height: WINBAND.h,
          boxSizing: 'border-box',
          borderTop: `3px solid ${withAlpha(theme.text, 0.8)}`,
          borderBottom: `3px solid ${withAlpha(theme.text, 0.8)}`,
          background: withAlpha(theme.text, 0.04),
          opacity: 0.9,
        }}
      />
      <div style={{position: 'absolute', left: STAGE.leftX + STAGE.leftW + 34, top: WINBAND.top - 6, fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.text, opacity: 0.85}}>
        {'可见区'}
      </div>
      {/* 注意力光圈（收缩套住失败条——吸住的是失败条非清单） */}
      <FocusRing cx={failCx} cy={failCy} r0={430} r1={200} shrink={ringShrink} hold={ringHold} lit={failIn} />
      {/* ── 右轨：清单卡（首条打勾次条高亮）+ 计数器爬升特写 ── */}
      <TodoListCard
        x={STAGE.rightX}
        y={STAGE.rightTop}
        w={470}
        rowStates={[row1Done > 0.5 ? 'done' : 'active', row2Active > 0.5 ? 'active' : 'todo', 'todo']}
        rowLit={[1, 1, 0.4]}
        squeeze={squeeze}
        showTag={1}
      />
      {/* 计数器爬升（读数与口播逐拍一致；清单仍可见时不爬升——因果在锚序保证） */}
      <NagCounter
        x={STAGE.rightX + 40}
        y={STAGE.rightTop + 350}
        w={400}
        count={count}
        pulse={holdPulse}
        resetFlash={zero}
        watch={1}
        lit={1}
        scale={1.1}
      />
      <StageRing />
      <TAxis x={STAGE.axis.x} y={STAGE.axis.y} w={STAGE.axis.w} n={11} cursor={2 + 2 * failIn + (squeeze > 0.5 ? 1 : 0) + 0.5 * climb[2]} lit={1} />
    </AbsoluteFill>
  );
};

// ── 2-C 注入 → 拉回 → 收尾快进 → 疑问钩 ────────────────────────────────

const TwoC: React.FC<{atInject: number; atHook: number; atRelease: number; atRebuild: number; atFinish: number; atLamp: number; atHook2: number; atDim: number}> = ({
  atInject,
  atHook,
  atRelease,
  atRebuild,
  atFinish,
  atLamp,
  atHook2,
  atDim,
}) => {
  const frame = useCurrentFrame();
  // 提醒条沿紫色脉冲线插入消息尾部（注入时点钉死）
  const inject = useProgress(atInject, DUR.f5, 'decelerate');
  const injectPulse = useImpulse({at: atInject, dur: DUR.f6, peak: 1});
  // 环体调用前挂点同拍闪亮（本集两大 punch 之一，1–2s 呼吸）
  const hookPulse = useImpulse({at: atHook, dur: DUR.f6 * 2, peak: 1});
  const hookBreathe = 0.55 + 0.45 * Math.sin(frame / 7);
  // 光圈松开 + 失败条滑回清单卡（拉回）
  const release = useProgress(atRelease, DUR.f5);
  // 清单卡重入窗内：前两行打勾、末行高亮（三态全用——P1 图例闭环）
  const rebuild = useProgress(atRebuild, DUR.f5, 'decelerate');
  // 收尾快进：末行打勾、三勾全亮 + 任务完成状态灯（确认绿；三勾在「任务完成」词后）
  const finish = useProgress(atFinish, DUR.f4);
  const lamp = useProgress(atLamp, DUR.f4);
  // 疑问钩字卡浮起（半拍收暗——不给答案）
  const hookCard = useProgress(atHook2, DUR.f5);
  const dimAll = useProgress(atDim, DUR.f4);
  // ⑨ QA W2/N2：左轨跨镜对齐——修测试条 leftTop+170/216（2-B done 位续排）、
  // 提醒条插窗带底部（leftTop+430）、快照条自 2-B 末态挤出位（outBand）rebuild
  // 回窗带内（inBand）
  const snapTop = STAGE.leftTop + 430;
  return (
    <AbsoluteFill>
      {/* 左轨：提醒条插入尾部（沿紫色脉冲线自挂点方向落入） */}
      <div style={{position: 'absolute', left: STAGE.leftX, top: STAGE.leftTop - 30, fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>
        {'messages'}
      </div>
      {['修测试 · 第 3 轮', '修测试 · 第 4 轮'].map((t, i) => (
        <div key={t} style={{position: 'absolute', left: STAGE.leftX, top: STAGE.leftTop + 170 + i * 46, opacity: 0.75}}>
          <div
            style={{
              width: STAGE.leftW,
              height: 36,
              borderRadius: 7,
              border: `2px solid ${withAlpha(theme.tool, 0.45)}`,
              background: withAlpha(theme.tool, 0.05),
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 14,
              fontFamily: theme.sans,
              fontSize: 17,
              color: theme.dim,
              boxSizing: 'border-box',
            }}
          >
            {t}
          </div>
        </div>
      ))}
      {/* 注入脉冲线（自环体挂点 → 消息尾部的紫色轨迹；虚线底与描线亮沿分元素——
          px dasharray 与 pathLength 归一化互斥，红线三） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <path
          d={`M 1700 340 Q 1400 ${snapTop + 20}, ${STAGE.leftX + STAGE.leftW + 60} ${snapTop + 28}`}
          fill="none"
          stroke={withAlpha(theme.nag, 0.35 * inject)}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="12 10"
        />
        <path
          d={`M 1700 340 Q 1400 ${snapTop + 20}, ${STAGE.leftX + STAGE.leftW + 60} ${snapTop + 28}`}
          fill="none"
          stroke={withAlpha(theme.nag, 0.85 * inject)}
          strokeWidth={4}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - inject}
        />
      </svg>
      {/* 提醒条（紫色——与计数器同源色；卡面英文只进角标 reminder） */}
      <div style={{position: 'absolute', left: STAGE.leftX, top: snapTop, opacity: inject}}>
        <MsgBar x={0} y={0} w={STAGE.leftW} h={56} label={'更新你的待办'} sub={'reminder'} color={theme.nag} lit={inject} flash={injectPulse} />
      </div>
      {/* 失败条（滑回清单卡——拉回动作的可追轨迹；起点=2-B 失败条位 440） */}
      <div style={{position: 'absolute', left: STAGE.leftX + (STAGE.rightX - STAGE.leftX) * 0.5 * release, top: 440 + 60 * release, opacity: 0.85 * (1 - release)}}>
        <div
          style={{
            width: STAGE.leftW * 0.7,
            height: 50,
            borderRadius: 9,
            border: `2.5px solid ${theme.danger}`,
            background: withAlpha(theme.danger, 0.1),
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 16,
            fontFamily: theme.sans,
            fontSize: 20,
            color: theme.danger,
            boxSizing: 'border-box',
            opacity: 1 - release,
          }}
        >
          {'测试失败'}
        </div>
      </div>
      {/* 清单快照条重入窗内（重建——灰度恢复；窗框沿用）。⑨ QA N2：自 2-B 末态
          挤出位（outBand）回窗带内（inBand）——窗内亮带是 0-C 语义的收束回扣 */}
      <div
        style={{
          position: 'absolute',
          left: STAGE.leftX,
          top: SNAP.outBand + (SNAP.inBand - SNAP.outBand) * rebuild,
          filter: `saturate(${0.4 + 0.6 * rebuild})`,
        }}
      >
        <MsgBar x={0} y={0} w={STAGE.leftW} h={50} label={'待办清单快照'} sub={'todo_write'} color={theme.mech} lit={rebuild} ghost={1 - rebuild} />
      </div>
      {/* 右轨：清单卡重建态 → 三勾全亮（三勾在「任务完成」词前不预亮） */}
      <TodoListCard
        x={STAGE.rightX}
        y={STAGE.rightTop}
        w={470}
        rowStates={
          finish > 0.5
            ? ['done', 'done', 'done']
            : rebuild > 0.5
              ? ['done', 'done', 'active']
              : ['done', 'active', 'todo']
        }
        rowLit={[1, 1, 1]}
        squeeze={1 - rebuild}
        showTag={1}
      />
      {/* 任务完成状态灯（确认绿） */}
      <div style={{position: 'absolute', left: STAGE.rightX + 20, top: STAGE.rightTop + 340, opacity: lamp}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 22px',
            borderRadius: 10,
            border: `2.5px solid ${theme.ok}`,
            background: withAlpha(theme.ok, 0.12),
            boxShadow: `0 0 ${20 * lamp}px ${withAlpha(theme.ok, 0.5)}`,
          }}
        >
          <svg width={26} height={26} viewBox="0 0 26 26">
            <path d="M 5 13 L 11 19 L 21 7" fill="none" stroke={theme.ok} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.ok}}>{'任务完成'}</span>
        </div>
      </div>
      {/* 环体（挂点闪亮——注入恒在下轮调用前） */}
      <StageRing pulse={hookPulse * hookBreathe} />
      <TAxis x={STAGE.axis.x} y={STAGE.axis.y} w={STAGE.axis.w} n={11} cursor={inject > 0.3 ? 6 : 5 + 0.9 * inject + (rebuild > 0.5 ? 1 : 0) + (finish > 0.5 ? 2 : 0)} lit={1} />
      {/* 疑问钩字卡（浮起——不给答案；半拍收暗） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 96,
          display: 'flex',
          justifyContent: 'center',
          opacity: hookCard,
        }}
      >
        <div
          style={{
            padding: '16px 40px',
            borderRadius: 12,
            border: `2.5px solid ${withAlpha(theme.dim, 0.7)}`,
            background: withAlpha(theme.panel, 0.92),
            fontFamily: theme.serif,
            fontSize: 38,
            fontWeight: 700,
            color: theme.text,
          }}
        >
          {'这条提醒，真有那么要紧吗？'}
        </div>
      </div>
      <AbsoluteFill style={{background: '#000', opacity: 0.66 * dimAll, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2TodoWalkthrough: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-03');
  const bB = w('p2-04', 'p2-07');
  const bC = w('p2-08', 'p2-10');

  return (
    <AbsoluteFill>
      {/* 任务卡（幕级常驻层——W2：三镜共用，切点不消失；入场锚幕级帧域） */}
      <TaskCardLayer atTask={wa('p2-01', 0.62)} />
      <Sequence {...bA} name="2-A">
        <TwoA
          atBoard={wa('p2-01', 0.08) - bA.from}
          atMorph={wa('p2-01', 0.06) - bA.from}
          atBuild={wa('p2-02', 0.16) - bA.from}
          atFirst={wa('p2-02', 0.72) - bA.from}
          atSnap={wa('p2-03', 0.12) - bA.from}
          atWork={wa('p2-03', 0.62) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB
          atDone={wa('p2-04', 0.12) - bB.from}
          atNext={wa('p2-04', 0.34) - bB.from}
          atZero={wa('p2-04', 0.6) - bB.from}
          atFail={wa('p2-05', 0.24) - bB.from}
          atRing={wa('p2-06', 0.1) - bB.from}
          atRush={wa('p2-06', 0.3) - bB.from}
          atSqueeze={wa('p2-06', 0.72) - bB.from}
          atCount={wa('p2-07', 0.18) - bB.from}
          atHold={wa('p2-07', 0.78) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC
          atInject={wa('p2-08', 0.18) - bC.from}
          atHook={wa('p2-08', 0.18) - bC.from}
          atRelease={wa('p2-09', 0.06) - bC.from}
          atRebuild={wa('p2-09', 0.34) - bC.from}
          atFinish={wa('p2-10', 0.14) - bC.from}
          atLamp={wa('p2-10', 0.34) - bC.from}
          atHook2={wa('p2-10', 0.72) - bC.from}
          atDim={at('p2-10') + span('p2-10') - Math.min(10, span('p2-10') / 4) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2TodoWalkthrough;
