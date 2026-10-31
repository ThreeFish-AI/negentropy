/** P3 拆掉提醒试试（p3-01..p3-10，4 镜）——分镜 3-A / 3-B / 3-C / 3-D。
 *
 *  ★ 3-A 左绿右红消融同屏（本集镜像构图纪律：左=提醒在位 ok、右=拆掉 danger
 *    ——与前四集左红右绿相反，planning §三明文）：双轨并置各带轮次带（11 格）+
 *    三格任务步进带 + 提醒计数位 + 漂移计数位 + 收尾状态位 + 工况角标；左轨
 *    11 轮逐轮点亮全亮、三步全勾、一条提醒闪现、漂移 0；右轨跑满预算格截停
 *    锁止（红框）、只剩两步（第三格空置灰闪）、漂移 7（画面先给数、口播下句
 *    归因）、没收尾红叉；底部四指标数字动态条对照定格（两大 punch 之二）。
 *  ★ 3-B 漂移归因双段：上半漂移环——同一枚格式化动作卡沿小环循环（环上只此
 *    一卡）、旁计数器跳 7、环外虚线路径描出无出口；下半可见区视窗回放慢镜
 *    （0-C 同款装置复现）——修测试条连刷、清单条挤出窗外变灰、窗外消息流再
 *    坠一档、「唯一外力」紫色箭头自下而上把清单条顶回窗内（外力方向自下而上）。
 *  ★ 3-C 阈值三档并列动态条（默认 3 基线位居中 / 阈值 1 / 阈值 999）：阈值 1
 *    档提醒 6 + 六枚注入位密集闪现 + 消息 23→28 + 任务照常完成（不退化）；
 *    999 档提醒 0、四指标逐项翻红与 3-A 右轨逐项同值（2/3·漂移 7·没收尾）。
 *  ★ 3-D 规律金句卡（衬线体）「可见性即影响力」；下缘示意帧——更大脑图标
 *    （更聪明的模型）探向窗外灰化文本、视线虚线触达即断（聪明的光够不着
 *    不在场的信息；大脑不点亮窗外）；「长什么样」疑问签浮起（转 P4 钩子）。
 *
 *  空间契约：左绿右红恒定（镜像构图）、两轨轮次带同款格位、四指标与口播/实验
 *  记录逐项一致、数字条带基线刻度；右轨漂移计数不提前跳 7；视窗与 0-C 同款
 *  同向、漂移环只此一卡、顶回方向自下而上；三档同宽并列、默认 3 为基线标尺
 *  位、999 档漂移恒 7；金句强调色钉常量、脑图标变大但窗外文本恒灰。
 *
 *  红线落实：词落位 = wa(id,f)；层级压暗方向同口播权力方向（金句帧压暗背景
 *  示意层）；y≥56 / bottom≥168；nag_threshold / episode A 等英文只进角标。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  AblationLane,
  BrainGlyph,
  DriftLoop,
  StatBar,
  ThresholdRow,
  VisibilityWindow,
  MsgBar,
} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 3-A 左绿右红消融同屏（两大 punch 之二） ─────────────────────────────

const ThreeA: React.FC<{atLeftRounds: number; atLeftTask: number; atLeftNag: number; atLeftDrift: number; atRightRun: number; atExhaust: number; atRightTask: number; atFlash: number; atCross: number; atStats: number}> = ({
  atLeftRounds,
  atLeftTask,
  atLeftNag,
  atLeftDrift,
  atRightRun,
  atExhaust,
  atRightTask,
  atFlash,
  atCross,
  atStats,
}) => {
  const frame = useCurrentFrame();
  // 左轨（提醒在位·确认绿）：11 轮逐轮点亮全亮
  const leftRounds = useProgress(atLeftRounds, DUR.f6, 'linear');
  const leftTask = useProgress(atLeftTask, DUR.f5);
  // 一条提醒（一轮紫色注入位闪现一次）
  const leftNag = useImpulse({at: atLeftNag, dur: DUR.f6, peak: 1});
  // 零跑偏（漂移计数定格 0——归因前恒 0）
  const leftDriftLit = useProgress(atLeftDrift, DUR.f4);
  // 右轨（拆掉·警示红）：起跑 → 跑满预算格截停锁止
  const rightRun = useProgress(atRightRun, DUR.f6, 'linear');
  const exhausted = useProgress(atExhaust, DUR.f4);
  // 只剩两步（两格勾 + 第三格空置灰闪）+ 没收尾（红叉）
  const rightTask = useProgress(atRightTask, DUR.f5);
  const grayFlash = 0.5 + 0.5 * Math.sin(frame / 6);
  const cross = useProgress(atCross, DUR.f4);
  // 四指标数字动态条对照定格（重音镜）
  const stats = useProgress(atStats, DUR.f5);
  const LANES = {y: 130, w: 820};
  return (
    <AbsoluteFill>
      {/* 左轨（提醒在位——本集镜像构图：左=绿）。⑨ QA RISKY-3：nag 徽标锁存
          （nag={leftNag > 0 || stats > 0 ? 1 : 0}）——impulse 闪完回落 0 与定格
          窗 StatBar「提醒 1」同帧矛盾；闪现过或定格窗开即恒 1 */}
      <AblationLane
        x={100}
        y={LANES.y}
        w={LANES.w}
        tag={'提醒在位'}
        cond={'episode A'}
        accent={theme.ok}
        lit={1}
        rounds={leftRounds}
        task={leftTask > 0.5 ? ['done', 'done', 'done'] : ['todo', 'todo', 'todo']}
        nag={leftNag > 0 || stats > 0 ? 1 : 0}
        nagFlash={leftNag}
        drift={0}
        finish={leftTask > 0.5 ? 1 : 0}
      />
      {/* 右轨（拆掉提醒——右=红；漂移 7 随「漂移照旧/归因」口径：画面先给数） */}
      <AblationLane
        x={1000}
        y={LANES.y}
        w={LANES.w}
        tag={'拆掉提醒'}
        cond={'experiment 1'}
        accent={theme.danger}
        lit={1}
        rounds={rightRun}
        exhausted={exhausted}
        task={rightTask > 0.5 ? ['done', 'done', 'todo'] : ['todo', 'todo', 'todo']}
        taskFlash={grayFlash * rightTask}
        nag={0}
        drift={exhausted > 0.5 ? 7 : 0}
        driftAt={exhausted > 0.5}
        cross={cross}
      />
      {/* 四指标数字动态条（对照定格——左绿右红逐项同款对齐、条带基线刻度恒常驻） */}
      <StatBar x={100} y={560} w={LANES.w} lit={stats} accent={theme.ok} cells={['11 轮', '3/3', '提醒 1', '漂移 0', '收尾 ✓']} />
      <StatBar x={1000} y={560} w={LANES.w} lit={stats} accent={theme.danger} cells={['耗尽', '2/3', '提醒 0', '漂移 7', '没收尾']} />
      {/* 对照读向（中缝——左=在位、右=拆掉的镜像语义签） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 84, textAlign: 'center', fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>
        {'消融对照 · 左：提醒在位 / 右：拆掉提醒'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: stats * 0.9}}>
        {'同一任务 · 只拆一个变量'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 漂移归因：漂移环 + 可见区视窗回放慢镜 ────────────────────────────

const ThreeB: React.FC<{atSpin: number; atCount: number; atNoExit: number; atReplay: number; atSqueeze: number; atFall: number; atPush: number}> = ({
  atSpin,
  atCount,
  atNoExit,
  atReplay,
  atSqueeze,
  atFall,
  atPush,
}) => {
  const frame = useCurrentFrame();
  // 漂移环转起（动作卡绕环——环上只此一卡）。⑨ QA W4：圈速提至 13f/圈（原
  // 26f 慢一档），计数与转圈解耦——删 lapCount*0 作废项，自「七个重复」词窗
  // （atCount）起按圈 tick：driftCount = min(7, lapsSinceWord)，逐圈爬到 7
  const spin = clamp01(progress(frame, atSpin, 9999)) * ((frame - atSpin) / 13);
  const lapsSinceWord = frame >= atCount ? Math.floor((frame - atCount) / 13) + 1 : 0;
  const driftCount = Math.min(7, lapsSinceWord);
  const noExit = useProgress(atNoExit, DUR.f5);
  // 视窗回放慢镜（0-C 同款装置复现——窗形/照亮方向逐镜一致）
  const replay = useProgress(atReplay, DUR.f5);
  const squeeze = useProgress(atSqueeze, DUR.f6);
  // 窗外消息流再坠一档（顺着惯性漂走）
  const fall = useProgress(atFall, DUR.f5, 'accelerate');
  // 「唯一外力」：紫色箭头自下而上把清单条顶回窗内一拍（外力方向自下而上）
  const push = useProgress(atPush, DUR.f6, 'decelerate');
  const pushFlash = useImpulse({at: atPush + DUR.f5, dur: DUR.f5, peak: 1});
  const WIN = {x: 1080, top: 200, w: 640, h: 560} as const;
  const snapY = WIN.top + 210 + 56 * squeeze - 90 * push; // 挤出下沉 → 被顶回窗内
  const inWindow = push > 0.5;
  return (
    <AbsoluteFill>
      {/* ── 上半：漂移环（重复即原地打转的空间陈述） ── */}
      <div style={{position: 'absolute', left: 130, top: 96, fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>
        {'drift · 漂移环'}
      </div>
      <DriftLoop cx={420} cy={430} r={170} spin={spin} count={driftCount} noExit={noExit} lit={1} />
      {/* ── 下半：可见区视窗回放慢镜（归因闭环） ── */}
      <VisibilityWindow x={WIN.x} y={WIN.top} w={WIN.w} h={WIN.h} lit={replay} labelLit={replay} bandRatio={0.34}>
        <div style={{position: 'absolute', left: WIN.x, top: WIN.top, width: WIN.w, height: WIN.h}}>
          {/* 修测试条连刷（窗外上方——随惯性再坠一档） */}
          {['修测试 1', '修测试 2', '修测试 3', '修测试 4'].map((t, i) => {
            const inWin = i >= 2;
            return (
              <div key={t} style={{position: 'absolute', left: 0, top: 30 + i * 84 + 26 * fall, opacity: 0.9}}>
                <MsgBar x={0} y={0} w={WIN.w} label={t} sub={`fix ${i + 1}`} color={inWin ? theme.tool : undefined} lit={replay} ghost={replay > 0.3 && !inWin ? 0.75 : 0} />
              </div>
            );
          })}
          {/* 清单快照条（被挤出窗外变灰 → 唯一外力顶回窗内——渐暗恢复连续降档） */}
          <div style={{position: 'absolute', left: 0, top: snapY - WIN.top, filter: `saturate(${0.35 + 0.65 * push})`}}>
            <MsgBar x={0} y={0} w={WIN.w} h={54} label={'待办清单快照'} sub={'todo_write'} color={theme.mech} lit={replay} ghost={0.9 - 0.55 * push} flash={pushFlash} />
          </div>
        </div>
      </VisibilityWindow>
      {/* 紫色外力箭头（自下而上——顶回方向的空间语义；外力唯一性：无其他箭头） */}
      {push > 0.01 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <line
            x1={WIN.x + WIN.w / 2}
            y1={WIN.top + 480 + 60 * (1 - push)}
            x2={WIN.x + WIN.w / 2}
            y2={WIN.top + 480 - 130 * push}
            stroke={theme.nag}
            strokeWidth={7 * push}
            strokeLinecap="round"
            opacity={0.85 * push}
          />
          {push > 0.85 ? (
            <path
              d={`M ${WIN.x + WIN.w / 2 - 20} ${WIN.top + 480 - 128 + 26} L ${WIN.x + WIN.w / 2} ${WIN.top + 480 - 148} L ${WIN.x + WIN.w / 2 + 20} ${WIN.top + 480 - 128 + 26} Z`}
              fill={theme.nag}
              opacity={clamp01(pushFlash)}
            />
          ) : null}
        </svg>
      ) : null}
      <div style={{position: 'absolute', left: WIN.x + WIN.w / 2 - 90, top: WIN.top + 500, width: 180, textAlign: 'center', fontFamily: theme.sans, fontSize: 19, fontWeight: 600, color: theme.nag, opacity: push}}>
        {'唯一外力 · 提醒'}
      </div>
      {/* 清单条归位判读签（顶回=在窗内） */}
      {inWindow ? (
        <div style={{position: 'absolute', left: WIN.x + WIN.w + 18, top: snapY - 10, fontFamily: theme.sans, fontSize: 17, color: theme.mech, opacity: push}}>
          {'回到窗内'}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ── 3-C 阈值三档并列动态条（基线标尺） ──────────────────────────────────

const ThreeC: React.FC<{atChatty: number; atNag: number; atMsg: number; atTask: number; atDead: number; atRed: number; atDrift: number}> = ({
  atChatty,
  atNag,
  atMsg,
  atTask,
  atDead,
  atRed,
  atDrift,
}) => {
  const frame = useCurrentFrame();
  // 阈值 1 档：亮起 → 提醒计数跳 6（六枚注入位密集闪现）→ 消息 23→28 → 任务照常完成
  const chatty = useProgress(atChatty, DUR.f4);
  const nagFlash = clamp01(progress(frame, atNag, DUR.f6));
  const msgGrow = useProgress(atMsg, DUR.f5);
  const msg = 23 + Math.round(5 * msgGrow);
  const taskDone = useProgress(atTask, DUR.f4);
  // 阈值 999 档：亮起 → 提醒 0 → 四指标逐项翻红（与 3-A 右轨逐项同值）→ 漂移 7
  const dead = useProgress(atDead, DUR.f4);
  const redLit = useProgress(atRed, DUR.f5);
  const drift7 = useProgress(atDrift, DUR.f4);
  const ROWS = {x: 240, w: 1440, gap: 150};
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: 84, textAlign: 'center', fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>
        {'阈值三档 · 默认 3 为基线标尺位'}
      </div>
      {/* 默认 3（基线——P2 走查同款数值，恒亮对照锚） */}
      <ThresholdRow x={ROWS.x} y={150} w={ROWS.w} mode="base" lit={1} />
      {/* 阈值 1（一轮没碰就提醒——啰嗦的具象） */}
      <ThresholdRow x={ROWS.x} y={150 + ROWS.gap} w={ROWS.w} mode="chatty" lit={chatty} nag={6} nagFlash={nagFlash} msg={msg} taskDone={taskDone} />
      {/* 阈值 999（等价于没有提醒——逐项翻红、与 3-A 右轨同值） */}
      <ThresholdRow x={ROWS.x} y={150 + 2 * ROWS.gap} w={ROWS.w} mode="dead" lit={dead} redLit={Math.max(redLit, drift7 * 0.2)} taskDone={dead} />
      {/* 999 档漂移计数跳 7（角标位——「漂移照旧」词窗） */}
      <div style={{position: 'absolute', left: ROWS.x + ROWS.w - 150, top: 150 + 2 * ROWS.gap + 130, opacity: drift7}}>
        <span style={{fontFamily: theme.mono, fontSize: 22, fontWeight: 700, color: theme.danger}}>{'漂移 ×7 · 照旧'}</span>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.85}}>
        {'同一档位只动阈值一个旋钮'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-D 规律金句卡 + 更大脑图标探窗外徒劳 ───────────────────────────────

/** 金句强调词：色钉常量（QA-14——本集主题色 = 规划蓝 mech，收束金句强调词即
 *  「本集之物」的收束指称；color 恒常量不随词窗相位变化，辉光只改强度） */
const KeyWord: React.FC<{at: number; children: React.ReactNode}> = ({at, children}) => {
  const pop = useImpulse({at, dur: DUR.f6, peak: 0.06});
  const glow = useProgress(at, DUR.f5);
  return (
    <span
      style={{
        fontSize: 60,
        fontWeight: 700,
        color: theme.mech,
        display: 'inline-block',
        transform: `scale(${1 + pop})`,
        textShadow: glow > 0.01 ? `0 0 ${24 * glow}px ${withAlpha(theme.mech, 0.5)}` : 'none',
      }}
    >
      {children}
    </span>
  );
};

const ThreeD: React.FC<{atCard: number; atP1: number; atP2: number; atBrain: number; atBlind: number; atCut: number; atQ: number}> = ({
  atCard,
  atP1,
  atP2,
  atBrain,
  atBlind,
  atCut,
  atQ,
}) => {
  const frame = useCurrentFrame();
  // 金句卡淡入定格（衬线体为唯一主体帧）
  const card = useProgress(atCard, DUR.f6);
  // 两短语各压一拍重读（「在场才有影响」「被稀释等于缺席」）
  const p1 = useProgress(atP1, DUR.f5);
  const p2 = useProgress(atP2, DUR.f5);
  // 更聪明的模型：脑图标放大一档再探（bigger——大脑不点亮窗外）
  const brain = useProgress(atBrain, DUR.f5);
  const bigger = brain;
  // 「再聪明也看不见」：视线虚线触达即断（断点闪烁两拍）
  const cut = useProgress(atCut, DUR.f4);
  const blind = useProgress(atBlind, DUR.f4);
  // 「长什么样」疑问签浮起（转 P4 钩子）
  const q = useProgress(atQ, DUR.f5);
  const BRAIN = {cx: 560, cy: 700, size: 190} as const;
  // 视线终点（窗外灰化文本位——恒灰）
  const TARGET = {x: 1180, y: 620} as const;
  const reach = clamp01(progress(frame, atBrain + DUR.f4, DUR.f5));
  const gapX = BRAIN.cx + (TARGET.x - BRAIN.cx) * Math.min(reach, 0.86); // 触达即断（86% 处）
  return (
    <AbsoluteFill>
      {/* 金句卡（衬线体——唯一主体帧；caption-dup-ok: 金句卡刻意复述〔规律
          定格仪式，承系列 3-D 豁免先例〕） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 190,
          display: 'flex',
          justifyContent: 'center',
          opacity: card,
          transform: `translateY(${(1 - card) * 22}px)`,
        }}
      >
        <div
          style={{
            padding: '40px 76px',
            borderRadius: 16,
            border: `3px solid ${withAlpha(theme.mech, 0.55)}`,
            background: withAlpha(theme.panel, 0.92),
            textAlign: 'center',
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 62, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
            <KeyWord at={atCard + DUR.f4}>{'可见性'}</KeyWord>
            {' 即 '}
            <KeyWord at={atCard + DUR.f5}>{'影响力'}</KeyWord>
          </div>
          <div style={{display: 'flex', justifyContent: 'center', gap: 44, marginTop: 18}}>
            <span style={{fontFamily: theme.serif, fontSize: 27, color: p1 > 0.5 ? theme.text : theme.dim, opacity: 0.45 + 0.55 * p1}}>
              {'在场才有影响'}
            </span>
            <span style={{fontFamily: theme.serif, fontSize: 27, color: p2 > 0.5 ? theme.text : theme.dim, opacity: 0.45 + 0.55 * p2}}>
              {'被稀释等于缺席'}
            </span>
          </div>
        </div>
      </div>
      {/* ── 下缘示意帧：更大脑图标探向窗外灰化文本（大脑不点亮窗外） ── */}
      <BrainGlyph cx={BRAIN.cx} cy={BRAIN.cy} size={BRAIN.size} lit={brain} bigger={bigger} />
      {/* 视线虚线（自脑图标 → 窗外文本；触达即断——聪明的光够不着不在场的信息） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: brain}}>
        <line
          x1={BRAIN.cx + 90}
          y1={BRAIN.cy - 40}
          x2={gapX}
          y2={TARGET.y - 10 - 30 * (1 - reach)}
          stroke={withAlpha(theme.dim, 0.75)}
          strokeWidth={3}
          strokeDasharray="10 9"
        />
        {/* 断口标记（触达即断——× 两拍） */}
        {cut > 0.01 ? (
          <g opacity={0.4 + 0.6 * cut}>
            <line x1={gapX + 8} y1={TARGET.y - 28} x2={gapX + 26} y2={TARGET.y - 10} stroke={theme.danger} strokeWidth={4} strokeLinecap="round" />
            <line x1={gapX + 26} y1={TARGET.y - 28} x2={gapX + 8} y2={TARGET.y - 10} stroke={theme.danger} strokeWidth={4} strokeLinecap="round" />
          </g>
        ) : null}
      </svg>
      {/* 窗外灰化文本（恒灰——信息不在场；再聪明也不亮） */}
      <div style={{position: 'absolute', left: TARGET.x - 60, top: TARGET.y - 26, opacity: 0.4 * blind + 0.35}}>
        <MsgBar x={0} y={0} w={420} h={52} label={'窗外的信息'} sub={'out of window'} lit={1} ghost={0.9} />
      </div>
      {/* 疑问签（转 P4 钩子） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 200,
          display: 'flex',
          justifyContent: 'center',
          opacity: q,
        }}
      >
        <span style={{fontFamily: theme.serif, fontSize: 30, color: theme.text, border: `2.5px dashed ${withAlpha(theme.dim, 0.7)}`, borderRadius: 10, padding: '10px 26px'}}>
          {'那真实产品里，它长什么样？'}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P3NagAblation: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p3-01', 'p3-02');
  const bB = w('p3-03', 'p3-05');
  const bC = w('p3-06', 'p3-07');
  const bD = w('p3-08', 'p3-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ThreeA
          atLeftRounds={wa('p3-01', 0.1) - bA.from}
          atLeftTask={wa('p3-01', 0.38) - bA.from}
          atLeftNag={wa('p3-01', 0.6) - bA.from}
          atLeftDrift={wa('p3-01', 0.82) - bA.from}
          atRightRun={wa('p3-02', 0.12) - bA.from}
          atExhaust={wa('p3-02', 0.34) - bA.from}
          atRightTask={wa('p3-02', 0.56) - bA.from}
          atFlash={wa('p3-02', 0.7) - bA.from}
          atCross={wa('p3-02', 0.86) - bA.from}
          atStats={at('p3-02') + span('p3-02') - Math.min(24, span('p3-02') / 3) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ThreeB
          atSpin={wa('p3-03', 0.16) - bB.from}
          atCount={wa('p3-03', 0.5) - bB.from}
          atNoExit={wa('p3-03', 0.82) - bB.from}
          atReplay={wa('p3-04', 0.12) - bB.from}
          atSqueeze={wa('p3-04', 0.4) - bB.from}
          atFall={wa('p3-04', 0.78) - bB.from}
          atPush={wa('p3-05', 0.28) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ThreeC
          atChatty={wa('p3-06', 0.14) - bC.from}
          atNag={wa('p3-06', 0.4) - bC.from}
          atMsg={wa('p3-06', 0.68) - bC.from}
          atTask={wa('p3-06', 0.88) - bC.from}
          atDead={wa('p3-07', 0.12) - bC.from}
          atRed={wa('p3-07', 0.42) - bC.from}
          atDrift={wa('p3-07', 0.8) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="3-D">
        <ThreeD
          atCard={wa('p3-08', 0.14) - bD.from}
          atP1={wa('p3-08', 0.6) - bD.from}
          atP2={wa('p3-08', 0.84) - bD.from}
          atBrain={wa('p3-09', 0.14) - bD.from}
          atBlind={wa('p3-09', 0.5) - bD.from}
          atCut={wa('p3-09', 0.8) - bD.from}
          atQ={wa('p3-10', 0.5) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3NagAblation;
