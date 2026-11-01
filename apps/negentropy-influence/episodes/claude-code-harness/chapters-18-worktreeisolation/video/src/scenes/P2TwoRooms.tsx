/** P2 两间房两条线（p2-01..p2-08，3 镜）——分镜 2-A / 2-B / 2-C。
 *
 *  幕间转场（1-D→2-A，头注明示）：不 morph（门禁插曲→走查舞台，拓扑重排），
 *  幕界 SceneFade + 走查舞台全景重锚；账本以同形签名回归居中位（镜间身份
 *  恒常，非 morph）。
 *
 *  叙事链：2-A 走查舞台全景：p2-01「理认证」词落位左房亮起+房内配置文件卡
 *  浮现〔M-005〕、「做登录界面」词落位右房亮起+同款文件卡浮现 → p2-02「认证
 *  房、界面房」词落位两房名牌各亮一拍、「各自的线」词落位两条分支线交替闪
 *  （同账不同线的对照）→ p2-03「谁也踩不着谁」词落位两房内文件卡各自动一笔
 *  （改动各自发生、互不波及）——中央账本纹丝不动（不动如山的机制陈述）→
 *  2-B 认领动作落地（Animated State Trace）：p2-04「认领工具接走」词落位光标
 *  持签接走左任务卡（角标 claim_task）+ 左房门框亮起 + 环体指针切向当前作业
 *  房〔M-005〕、「读写、跑命令」词落位三枚工具小签落入房内、「全落进自己
 *  那间房」词落位左右两房作业条各沿各线并行生长（两线各长各的）→ p2-05
 *  「各记各的线」词落位两条线各自增亮一档、「一清二楚」词落位每处改动点
 *  亮起作者小色点、「丢的也是自己的线」词落位左线末端一处改动点被单独摘除
 *  （丢弃限于自己线，账本与其余改动不动）→ 2-C 双房同幕完工：p2-06「先后
 *  完工」词落位两盏完成灯先后点亮（确认绿一闪转常亮）、「怎么收」词落位
 *  @pushIn 推向中央 + 「房，怎么收？」问号签（钢青）悬停放大 → p2-07「只把
 *  结果记在卡上」词落位结果小签贴上任务卡、「另算」词落位房体与完成灯整体
 *  退半档（去留未决的悬置态）→ p2-08「先数两样东西」词落位账本侧两枚空
 *  计数签轮廓亮出（P3 计数器伏位，不展开）。
 *
 *  空间契约（安全带实算）：2-A 账本底 230+360=590 / 两房底 520 / 环体底
 *  80+140=220；2-B 任务卡底 130+180=310 / 工具签落房内底 ≈ 500；2-C pushIn
 *  1.14× 后计数签底 ≈ 746——全部 ≤ 860；pushIn 以 (50%,42%) 为心、计数签
 *  距心 257px×1.14=293 → 453+293=746（实算复核，防 ep17 cy 误取教训）。
 *  红线落实：账本居中恒定不位移、双房等大对称、config 双份同形、auth-
 *  refactor/ui-login 双签全程在场可追、作业条禁跨线、摘除禁波及对方线、
 *  完工禁即拆房、计数签禁提前显数；机制英文词只进角标（claim_task /
 *  bash · read_file · write_file）。词落位 = wa(id,f)。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BranchLine, CursorArrow, LedgerBlock, RoomCard, TaskCard, WorkRing, mixHex} from '../components/motifs';
import {DUR, clamp01, progress} from '../motion';
import {ease} from '../components/motifs';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 2-A 走查舞台全景：账本居中不动如山 + 双房分挂 + config 双份 ────────────────

/** 走查舞台布局（2-A..2-C 共用骨架；安全带实算见头注） */
const STAGE = {
  ledger: {x: 855, y: 230, w: 210, h: 360},
  rooms: [
    {x: 330, y: 330, w: 230, h: 190, name: '认证房', tag: '.worktrees/auth-refactor/'},
    {x: 1360, y: 330, w: 230, h: 190, name: '界面房', tag: '.worktrees/ui-login/'},
  ],
  ring: {x: 1720, y: 80, size: 140},
  task: {x: 250, y: 130, w: 300, h: 180},
} as const;
/** 两条分支线（账本缘 ↔ 房缘） */
const LINES = [
  {x1: 855, y1: 425, x2: 560, y2: 425},
  {x1: 1065, y1: 425, x2: 1360, y2: 425},
] as const;
/** 作者色（左右两作业者——mate 族与 text 族各一，区分「谁的改动」） */
const AUTHORS = [mixHex(theme.line, '#FFFFFF', 0.4), theme.line] as const;

/** 沿线生长的作业条（消息小条 + 文件改动点逐条攀线——两线各长各的） */
const GrowthMarks: React.FC<{
  line: {x1: number; y1: number; x2: number; y2: number};
  p: number;
  dots: number;
  pluck: number;
  author: string;
}> = ({line, p, dots, pluck, author}) => {
  const marks = [0.34, 0.58, 0.82];
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {marks.map((f, i) => {
        const appear = clamp01((p - i * 0.3) / 0.4);
        if (appear <= 0.02) return null;
        const mx = line.x1 + (line.x2 - line.x1) * f;
        const my = line.y1 + (line.y2 - line.y1) * f;
        // 末端改动点（左线第三枚可被单独摘除——丢弃限于自己线）
        const isPluck = f > 0.8 && pluck > 0.02;
        const py = my - pluck * 70;
        return (
          <g key={`gm${i}`} opacity={isPluck ? 1 - pluck : appear}>
            {/* 消息小条（沿线的作业痕迹） */}
            <rect x={mx - 26} y={my - 30 - (1 - appear) * 10} width={52} height={12} rx={4} fill={withAlpha(author, 0.4)} opacity={0.9 * appear} />
            {/* 文件改动点 */}
            <circle cx={isPluck ? mx : mx} cy={isPluck ? py : my} r={8} fill={theme.bg} stroke={author} strokeWidth={3.5} />
            {/* 作者小色点（谁动了什么，一清二楚） */}
            {dots > 0.03 ? <circle cx={isPluck ? mx + 12 : mx + 12} cy={(isPluck ? py : my) - 12} r={5} fill={author} opacity={dots} /> : null}
          </g>
        );
      })}
    </svg>
  );
};

const TwoA: React.FC<{atAuth: number; atUi: number; atNames: number; atLines: number; atNoSteal: number}> = ({
  atAuth,
  atUi,
  atNames,
  atLines,
  atNoSteal,
}) => {
  const frame = useCurrentFrame();
  // 左房亮起（理认证）+ 房内配置文件卡浮现；右房随后（做登录界面）——同相不同亮
  const litL = clamp01(progress(frame, atAuth, 12));
  const litR = clamp01(progress(frame, atUi, 12)) * 0.86;
  // 两房名牌各亮一拍
  const nameL = clamp01(progress(frame, atNames, 8));
  const nameR = clamp01(progress(frame, atNames + 10, 8));
  const nameFlashL = Math.sin(Math.PI * clamp01(progress(frame, atNames, 20)));
  const nameFlashR = Math.sin(Math.PI * clamp01(progress(frame, atNames + 10, 20)));
  // 两条分支线交替闪（同账不同线的对照）
  const flashAlt = Math.sin((frame - atLines) / 4);
  const linesOn = clamp01(progress(frame, atNames + 20, 14));
  const altFlash = clamp01(progress(frame, atLines, 12)) * (flashAlt > 0 ? 1 : 0.35);
  // 两房文件卡各自动一笔（改动各自发生）——账本纹丝不动
  const editL = Math.sin(Math.PI * clamp01(progress(frame, atNoSteal, 20)));
  const editR = Math.sin(Math.PI * clamp01(progress(frame, atNoSteal + 8, 20)));
  return (
    <AbsoluteFill>
      {/* 中央账本（不动如山——本镜零位移） */}
      <LedgerBlock x={STAGE.ledger.x} y={STAGE.ledger.y} w={STAGE.ledger.w} h={STAGE.ledger.h} slots={3} slotsLitP={[0.5, 0.5, 0.5]} />
      {/* 两条分支线（各牵一房——交替闪对照） */}
      {LINES.map((l, i) => (
        <BranchLine key={`bl${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} drawP={linesOn} litP={i === 0 ? altFlash : 1 - altFlash * 0.6} />
      ))}
      {/* 左右两房（等大对称、兰紫同相不同亮；config 双份同形） */}
      {STAGE.rooms.map((r, i) => {
        const lit = i === 0 ? litL : litR;
        const plate = i === 0 ? nameL : nameR;
        const flash = i === 0 ? nameFlashL : nameFlashR;
        const edit = i === 0 ? editL : editR;
        return (
          <div key={`rm${i}`} style={{opacity: 0.35 + 0.65 * lit}}>
            <RoomCard
              x={r.x}
              y={r.y}
              w={r.w}
              h={r.h}
              litP={1}
              name={r.name}
              nameLitP={plate}
              flashP={flash * 0.7}
              fileCardP={lit}
            />
            {/* 文件卡上的「各自动一笔」（改动各自发生、互不波及） */}
            {edit > 0.04 ? (
              <div
                style={{
                  position: 'absolute',
                  left: r.x + 24,
                  top: r.y + r.h * 0.42,
                  width: 70 * edit,
                  height: 10,
                  borderRadius: 3,
                  background: withAlpha(AUTHORS[i], 0.75),
                }}
              />
            ) : null}
            {/* 房下角标（双签全程在场可追） */}
            <div style={{position: 'absolute', left: r.x + 6, top: r.y + r.h + 34, fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85 * lit}}>
              {r.tag}
            </div>
          </div>
        );
      })}
      {/* 环体缩悬顶角（坐标锚——执行段指针待命） */}
      <WorkRing
        x={STAGE.ring.x}
        y={STAGE.ring.y}
        size={STAGE.ring.size}
        litP={clamp01(progress(frame, 4, 12))}
        arcP={1}
        ptA={{x: 960, y: 430}}
        ptB={{x: 960, y: 430}}
        ptrP={0.55}
        tagP={0}
        dimP={0.3}
      />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'同一本账 · 各自的线 · 谁也踩不着谁'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 认领落房：光标接卡 + 工具签入房 + 双线并行作业生长 + 单点摘除 ───────────

const TwoB: React.FC<{atClaim: number; atTools: number; atGrow: number; atBright: number; atDots: number; atPluck: number}> = ({
  atClaim,
  atTools,
  atGrow,
  atBright,
  atDots,
  atPluck,
}) => {
  const frame = useCurrentFrame();
  // 光标持「认领」签接走左任务卡（角标 claim_task）
  const claim = clamp01(progress(frame, atClaim, 12));
  // 左房门框亮起
  const door = clamp01(progress(frame, atClaim + 6, 12));
  // 三枚工具小签落入房内（读写/读写/跑命令——关键词标签）
  const tools = ['读文件', '写文件', '跑命令'];
  const toolIn = (i: number) => clamp01(progress(frame, atTools + i * 5, 10));
  // 左右两房作业条各沿各线并行生长（两线各长各的）
  const growL = clamp01(progress(frame, atGrow, 30));
  const growR = clamp01(progress(frame, atGrow + 6, 30));
  // 两条线各自增亮一档
  const bright = clamp01(progress(frame, atBright, 12));
  // 改动点亮起作者小色点
  const dots = clamp01(progress(frame, atDots, 12));
  // 左线末端改动点被单独摘除（丢弃限于自己的线）
  const pluck = clamp01(progress(frame, atPluck, 16));
  // 环体指针切向当前作业房（左房）
  const swing = clamp01(progress(frame, atClaim + 4, 14));
  return (
    <AbsoluteFill>
      {/* 走查舞台骨架（承 2-A——账本居中恒定） */}
      <LedgerBlock x={STAGE.ledger.x} y={STAGE.ledger.y} w={STAGE.ledger.w} h={STAGE.ledger.h} slots={3} slotsLitP={[0.5, 0.5, 0.5]} />
      {LINES.map((l, i) => (
        <BranchLine
          key={`bl2b${i}`}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          drawP={1}
          litP={(i === 0 ? 0.5 : 0.35) + bright * 0.5}
          flashP={i === 0 && atPluck > 0 ? Math.sin(Math.PI * clamp01(progress(frame, atPluck - 4, 10))) * 0.4 : 0}
        />
      ))}
      {STAGE.rooms.map((r, i) => (
        <div key={`rm2b${i}`}>
          <RoomCard x={r.x} y={r.y} w={r.w} h={r.h} name={r.name} nameLitP={1} fileCardP={1} doorP={i === 0 ? door : 0} />
          <div style={{position: 'absolute', left: r.x + 6, top: r.y + r.h + 34, fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>
            {r.tag}
          </div>
        </div>
      ))}
      {/* 三枚工具小签（落入左房内——关键词标签，角标 bash · read_file · write_file） */}
      {tools.map((t, i) => {
        const inP = toolIn(i);
        return (
          <div
            key={`tl${i}`}
            style={{
              position: 'absolute',
              left: STAGE.rooms[0].x + 150 + (1 - inP) * 40,
              top: STAGE.rooms[0].y + 70 + i * 40,
              padding: '4px 14px',
              borderRadius: 8,
              border: `2.5px solid ${withAlpha(theme.dim, 0.5 + 0.5 * inP)}`,
              background: withAlpha(theme.panel, 0.97),
              fontFamily: theme.sans,
              fontSize: 16,
              fontWeight: 700,
              color: inP > 0.5 ? theme.text : theme.dim,
              whiteSpace: 'nowrap',
              opacity: inP,
            }}
          >
            {t}
          </div>
        );
      })}
      {/* 双线并行作业生长（消息小条 + 改动点攀线——两线各长各的） */}
      <GrowthMarks line={LINES[0]} p={growL} dots={dots} pluck={pluck} author={AUTHORS[0]} />
      <GrowthMarks line={LINES[1]} p={growR} dots={dots} pluck={0} author={AUTHORS[1]} />
      {/* 左任务卡（被光标持「认领」签接走——认领后卡面亮起） */}
      <TaskCard
        x={STAGE.task.x}
        y={STAGE.task.y}
        w={STAGE.task.w}
        h={STAGE.task.h}
        id="task_014"
        title="认证重构"
        litP={clamp01(progress(frame, 2, 10))}
        pendingLitP={1}
        claimP={claim}
        claimer="队友一"
        fieldWriteP={1}
        fieldValue="auth-refactor"
      />
      {/* 认领光标（持签接卡） */}
      <CursorArrow x={STAGE.task.x + STAGE.task.w - 60} y={STAGE.task.y - 46} litP={claim} />
      {/* 环体（顶角坐标锚——指针切向当前作业房） */}
      <WorkRing
        x={STAGE.ring.x}
        y={STAGE.ring.y}
        size={STAGE.ring.size}
        arcP={1}
        ptA={{x: 960, y: 430}}
        ptB={{x: STAGE.rooms[0].x + 110, y: STAGE.rooms[0].y - 4}}
        swingP={swing}
        ptrP={1}
        tagP={0}
        dimP={0.3}
      />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'claim_task · 读写、跑命令，全落进自己那间房'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-C 双房完工 + @pushIn 推向账本 + 「房，怎么收？」悬置 ──────────────────────

/** 2-C 计数签伏位（P3 计数器——空轮廓不显数） */
const COUNTER_HOLD = [
  {x: 640, y: 620, w: 200, h: 90, label: '未提交文件'},
  {x: 1080, y: 620, w: 200, h: 90, label: '未推送提交'},
] as const;

const TwoC: React.FC<{atDone1: number; atDone2: number; atPush: number; atResult: number; atRecede: number; atHold: number}> = ({
  atDone1,
  atDone2,
  atPush,
  atResult,
  atRecede,
  atHold,
}) => {
  const frame = useCurrentFrame();
  // 两盏完成灯先后点亮（确认绿一闪转常亮）
  const doneL = clamp01(progress(frame, atDone1, 10));
  const doneR = clamp01(progress(frame, atDone2, 10));
  // @pushIn 推向中央账本（scale 1.14 / 心 (50%,42%)——安全带实算见头注）
  const push = ease(clamp01(progress(frame, atPush, 18)));
  // 「房，怎么收？」问号签（钢青——悬停放大）
  const q = clamp01(progress(frame, atPush + 6, 12));
  const qHover = q * (0.8 + 0.2 * Math.sin(frame / 9));
  // 结果小签贴上任务卡 + 房体与完成灯整体退半档（悬置态）
  const result = clamp01(progress(frame, atResult, 12));
  const recede = clamp01(progress(frame, atRecede, 16));
  // 两枚空计数签轮廓（P3 伏位——禁显数）
  const hold = (i: number) => clamp01(progress(frame, atHold + i * 8, 12));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1 + 0.14 * push})`, transformOrigin: '50% 42%'}}>
        {/* 走查舞台骨架（承 2-B——账本居中恒定不位移） */}
        <LedgerBlock x={STAGE.ledger.x} y={STAGE.ledger.y} w={STAGE.ledger.w} h={STAGE.ledger.h} slots={3} slotsLitP={[0.5, 0.5, 0.5]} />
        {LINES.map((l, i) => (
          <BranchLine key={`bl2c${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} drawP={1} litP={0.8} />
        ))}
        {STAGE.rooms.map((r, i) => {
          const done = i === 0 ? doneL : doneR;
          return (
            <div key={`rm2c${i}`} style={{opacity: 1 - recede * 0.45}}>
              <RoomCard x={r.x} y={r.y} w={r.w} h={r.h} name={r.name} nameLitP={1} fileCardP={1} doorP={1} doneP={done} />
              <div style={{position: 'absolute', left: r.x + 6, top: r.y + r.h + 34, fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85 * (1 - recede * 0.5)}}>
                {r.tag}
              </div>
            </div>
          );
        })}
        {/* 双线作业痕迹保持在场（待拆悬置态——承 2-B 末态；左线末端摘除态保持） */}
        <GrowthMarks line={LINES[0]} p={1} dots={1} pluck={1} author={AUTHORS[0]} />
        <GrowthMarks line={LINES[1]} p={1} dots={1} pluck={0} author={AUTHORS[1]} />
        {/* 「房，怎么收？」问号签（钢青描边——悬停放大，账本上方） */}
        {q > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: STAGE.ledger.x - 130,
              top: STAGE.ledger.y - 108,
              padding: '10px 24px',
              borderRadius: 12,
              border: `3px solid ${withAlpha(theme.guard, 0.55 + 0.45 * q)}`,
              background: withAlpha(theme.panel, 0.97),
              fontFamily: theme.sans,
              fontSize: 24,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: qHover,
              transform: `translateY(${(1 - q) * -14}px) scale(${1 + 0.06 * qHover})`,
              boxShadow: q > 0.6 ? `0 0 ${22 * q}px ${withAlpha(theme.guard, 0.4 * q)}` : 'none',
            }}
          >
            房，怎么收？
          </div>
        ) : null}
        {/* 任务卡（结果小签贴上——任务完成只把结果记在卡上；完成绿随左房完工灯） */}
        <TaskCard
          x={STAGE.task.x}
          y={STAGE.task.y}
          w={STAGE.task.w}
          h={STAGE.task.h}
          id="task_014"
          title="认证重构"
          pendingLitP={1}
          claimP={1}
          claimer="队友一"
          fieldWriteP={1}
          fieldValue="auth-refactor"
          greenP={doneL}
          resultP={result}
        />
        {/* 两枚空计数签轮廓（P3 伏位——dashed 空轮廓，禁显数） */}
        {COUNTER_HOLD.map((c, i) => {
          const hp = hold(i);
          return (
            <div
              key={`ch${i}`}
              style={{
                position: 'absolute',
                left: c.x,
                top: c.y,
                width: c.w,
                height: c.h,
                borderRadius: 10,
                border: `2.5px dashed ${withAlpha(theme.guard, 0.4 + 0.3 * hp)}`,
                background: 'transparent',
                opacity: hp,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.sans,
                fontSize: 17,
                fontWeight: 700,
                color: theme.dim,
                whiteSpace: 'nowrap',
              }}
            >
              {c.label}
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'完工 ≠ 拆房 · 房的去留，另算'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2TwoRooms: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-03');
  const bB = w('p2-04', 'p2-05');
  const bC = w('p2-06', 'p2-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <TwoA
          atAuth={wa('p2-01', 0.44) - bA.from}
          atUi={wa('p2-01', 0.85) - bA.from}
          atNames={wa('p2-02', 0.38) - bA.from}
          atLines={wa('p2-02', 0.86) - bA.from}
          atNoSteal={wa('p2-03', 0.80) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB
          atClaim={wa('p2-04', 0.12) - bB.from}
          atTools={wa('p2-04', 0.38) - bB.from}
          atGrow={wa('p2-04', 0.68) - bB.from}
          atBright={wa('p2-05', 0.12) - bB.from}
          atDots={wa('p2-05', 0.44) - bB.from}
          atPluck={wa('p2-05', 0.74) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC
          atDone1={wa('p2-06', 0.30) - bC.from}
          atDone2={wa('p2-06', 0.48) - bC.from}
          atPush={wa('p2-06', 0.78) - bC.from}
          atResult={wa('p2-07', 0.50) - bC.from}
          atRecede={wa('p2-07', 0.92) - bC.from}
          atHold={wa('p2-08', 0.72) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2TwoRooms;
