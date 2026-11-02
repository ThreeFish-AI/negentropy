/** P0 计划说了等于没说（p0-01..p0-08，3 镜）——分镜 0-A / 0-B / 0-C（storyboard v1）。
 *
 *  叙事链：冷启动直入（开篇视听合力 I-039）——消息瀑布全景：三步任务指令卡
 *  驻列顶（三任务签位）、工具结果消息条（青碧）自列顶不断涌入把旧条压向列底，
 *  目标卡（计划前身·规划蓝）随堆叠逐档下沉灰化〔M-005〕（压底=被忘的空间化）
 *  → 0-B 左右同构双画：左机制画面（0-A 同款对话流缩置）、右群聊刷屏帧（类比
 *  A#1——约定条钉列顶被新消息顶下去；1–2 拍即收〔M-006〕）；「翻回去」人手
 *  小图标把旧约定拖回列顶（人做得到——模型侧无人手即缺席对比，A#1 失配边界
 *  随行）→ 0-C 可见区视窗首亮特写（本集术语锚装置）：窗内亮带只照亮尾段、
 *  窗外整列一刀切灰化，计划条卡窗外中下部微光闪两次又熄（够不着的悬念）。
 *
 *  空间契约：对话流单柱居中、目标卡下沉轨迹全程可追（压底≠删除）、署源角标
 *  右下恒定不抢焦；群聊帧两拍即收不常驻、两画面刷屏方向一致（新压旧）、机制
 *  侧无人手图标；视窗只照亮尾段、窗外元素恒灰化、计划条全程在窗外、本镜不
 *  给找回动作（留给 P1）；0-C 末帧形态 = 1-A morph 起点（对话记录卡同构）。
 *
 *  红线落实：词落位 = 句首 + 句长比例 wa(id,f)；消息条状态交接连续降档
 *  （max(底线, 进度)）；y≥56 / bottom≥168；snake_case 等英文只进角标。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {MsgBar, TASK_ROWS, VisibilityWindow} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，RSI I-080 豁免登记）：右下常驻，一次淡入后恒定不抢焦；
 *  bottom 168 避开字幕条（承 ep1–ep4 SourceCredit 形态） */
const SourceCredit: React.FC = () => {
  const o = useProgress(0, DUR.f5);
  return (
    <div
      style={{
        position: 'absolute',
        right: 72,
        bottom: 168,
        fontFamily: theme.mono,
        fontSize: 22,
        letterSpacing: 1,
        color: theme.dim,
        opacity: 0.85 * o,
      }}
    >
      Learn Claude Code
    </div>
  );
};

/** 对话流单柱几何（0-A 全景位；0-B 左半缩置、0-C 满幅特写） */
const FLOW = {x: 960 - 280, top: 150, w: 560, step: 78} as const;

/** 0-A 工具结果消息条集（青碧——次序=口播：开工改文件 → 修测试连刷）。
 *  `at` 为入场锚（由幕组装注入），槽位自列顶向下排——新条入场，旧条被压。 */
type FlowItem = {label: string; sub: string; at: number};
const flowItems = (ats: readonly number[]): FlowItem[] =>
  [
    {label: '改文件', sub: 'edit', at: ats[0]},
    {label: '跑测试', sub: 'test', at: ats[1]},
    {label: '修测试', sub: 'fix', at: ats[2]},
    {label: '再修测试', sub: 'fix', at: ats[3]},
    {label: '又修测试', sub: 'fix', at: ats[4]},
  ].slice(0, ats.length);

/** 对话流柱（0-A/0-B 左半共用——条目+目标卡+任务卡；scale 缩置时整体变换） */
const FlowColumn: React.FC<{
  x: number;
  top: number;
  w: number;
  step: number;
  items: readonly FlowItem[];
  planY: number;
  planDim: number;
  planGhost: number;
  taskLit: readonly number[];
  scale?: number;
}> = ({x, top, w, step, items, planY, planDim, planGhost, taskLit, scale = 1}) => {
  const frame = useCurrentFrame();
  // 新条入场 → 全列既有条目整体被压一档（连续降档：脉冲叠加位移，禁二态突变）。
  // hooks 铁律①：reduce 回调内不吃 hook——本地纯函数 impulse（与 useImpulse 同式）
  const impulseAt = (at: number, dur: number, peak: number) =>
    Math.sin(Math.PI * clamp01(progress(frame, at, dur))) * peak;
  const sinkPulse = items.reduce((s, it) => s + impulseAt(it.at, DUR.f5, 14), 0);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: 0,
        width: w,
        height: 1080,
        transform: `scale(${scale})`,
        transformOrigin: `${x + w / 2}px ${top}px`,
      }}
    >
      {/* 任务指令卡（列顶驻留——三任务签位，p0-02 依次点亮） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top,
          width: w,
          boxSizing: 'border-box',
          borderRadius: 12,
          border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`,
          background: theme.panel,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'task'}</span>
        {TASK_ROWS.map((t, i) => {
          const p = clamp01(taskLit[i] ?? 0);
          return (
            <span
              key={t.en}
              style={{
                fontFamily: theme.sans,
                fontSize: 21,
                fontWeight: 600,
                color: p > 0.5 ? theme.text : theme.dim,
                border: `2px solid ${p > 0.5 ? withAlpha(theme.text, 0.7) : theme.panelBorder}`,
                borderRadius: 7,
                padding: '4px 12px',
                whiteSpace: 'nowrap',
                opacity: 0.45 + 0.55 * p,
              }}
            >
              {t.zh}
            </span>
          );
        })}
      </div>
      {/* 目标卡（计划前身·规划蓝——随堆叠下沉灰化；压底≠删除） */}
      <div style={{position: 'absolute', left: 0, top: top + planY + sinkPulse, width: w}}>
        <MsgBar
          x={0}
          y={0}
          w={w}
          h={58}
          label={'三步计划'}
          sub={'plan'}
          color={theme.mech}
          lit={1}
          ghost={planGhost}
        />
      </div>
      {/* 工具结果消息条（青碧——自列顶涌入、槽位向下排） */}
      {items.map((it, i) => {
        const p = clamp01(progress(frame, it.at, DUR.f4));
        return (
          <div
            key={`${it.label}-${i}`}
            style={{
              position: 'absolute',
              left: 0,
              top: top + 88 + (i + 1) * step + sinkPulse,
              opacity: p,
              transform: `translateY(${(1 - p) * -34}px)`,
            }}
          >
            <MsgBar x={0} y={0} w={w} label={it.label} sub={it.sub} color={theme.tool} lit={1} />
          </div>
        );
      })}
    </div>
  );
};

// ── 0-A 冷启动：消息瀑布 + 目标卡压底 ───────────────────────────────────

const ZeroA: React.FC<{
  atPlan: number;
  atTask1: number;
  atTask2: number;
  atTask3: number;
  atFixes: number;
  atSunk: number;
}> = ({atPlan, atTask1, atTask2, atTask3, atFixes, atSunk}) => {
  const frame = useCurrentFrame();
  // p0-01「做完一步，忘两步」：目标卡下沉一档 + 亮度降一档（连续降档 QA-11）
  const sink1 = useProgress(atPlan, DUR.f5, 'decelerate');
  const dim1 = useProgress(atPlan + DUR.f3, DUR.f4);
  // p0-03「初衷被忘在脑后」：沉至中下部完全灰化定格
  const sink2 = useProgress(atSunk, DUR.f5, 'decelerate');
  const ghost2 = useProgress(atSunk + DUR.f4, DUR.f5);
  const planY = 78 + 130 * sink1 + 190 * sink2;
  const planGhost = Math.max(0.35 * dim1, ghost2 * 0.95);
  // 三任务签依次点亮（p0-02 词窗）
  const taskLit = [
    clamp01(progress(frame, atTask1, DUR.f3)),
    clamp01(progress(frame, atTask2, DUR.f3)),
    clamp01(progress(frame, atTask3, DUR.f3)),
  ];
  // 消息条：p0-01 一条改文件（做完一步）；p0-03 修测试连刷堆高
  const items = [
    {label: '改文件', sub: 'edit', at: atPlan + DUR.f3},
    {label: '跑测试', sub: 'test', at: atFixes},
    {label: '修测试', sub: 'fix', at: atFixes + 8},
    {label: '再修测试', sub: 'fix', at: atFixes + 16},
    {label: '又修测试', sub: 'fix', at: atFixes + 24},
  ];
  return (
    <AbsoluteFill>
      <FlowColumn x={FLOW.x} top={FLOW.top} w={FLOW.w} step={FLOW.step} items={items} planY={planY} planDim={0} planGhost={planGhost} taskLit={taskLit} />
      <SourceCredit />
    </AbsoluteFill>
  );
};

// ── 0-B 群聊类比帧 + 机制画面（左右同构双画） ───────────────────────────

const ZeroB: React.FC<{atGray: number; atChat: number; atRush: number; atLatest: number; atHand: number; atRetire: number; atPress: number}> = ({
  atGray,
  atChat,
  atRush,
  atLatest,
  atHand,
  atRetire,
  atPress,
}) => {
  const frame = useCurrentFrame();
  // 左半机制画面（0-A 末态缩置——计划条再沉一档「越压越低」）
  const press = useProgress(atPress, DUR.f5, 'decelerate');
  const planYB = 78 + 130 + 190 + 70 * press; // 承 0-A 末态再 +70
  const items = [
    {label: '改文件', sub: 'edit', at: -999},
    {label: '跑测试', sub: 'test', at: -999},
    {label: '修测试', sub: 'fix', at: -999},
    {label: '再修测试', sub: 'fix', at: -999},
    {label: '又修测试', sub: 'fix', at: -999},
  ];
  // p0-04 金句定性帧：灰化计划条特写一拍（左画面计划条微光一闪即灰）
  const grayFlash = useImpulse({at: atGray, dur: DUR.f5, peak: 0.5});
  // 群聊帧（右半）：p0-05 亮起 → 新消息逐条刷入 → 最新条高亮其余降饱和 →
  // p0-06 人手把旧约定拖回列顶 → 服务完槽位即收（M-006）
  const chatIn = useProgress(atChat, DUR.f5);
  const retire = useProgress(atRetire, DUR.f4, 'accelerate');
  const CHAT = {x: 1130, top: 210, w: 620, step: 74} as const;
  const rushAts = [atRush, atRush + 7, atRush + 14, atRush + 21];
  const latestLit = useProgress(atLatest, DUR.f4);
  // 人手小图标：自右下探入把约定条拖回列顶（人做得到）
  const hand = useProgress(atHand, DUR.f6, 'decelerate');
  // 约定条时序（storyboard 0-B 画面列）：初始钉列顶 → 新消息刷上来把它顶下去
  // （顶下 46px，与刷屏条同步）→ 人手拖回列顶（压下非消失）
  const rushPush = clamp01(progress(frame, rushAts[0] + DUR.f4, DUR.f5));
  const pactY = CHAT.top + 96 + 46 * rushPush * (1 - hand);
  return (
    <AbsoluteFill>
      {/* ── 左半：机制画面（0-A 末态缩置） ── */}
      <div style={{position: 'absolute', left: 60, top: 170, fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>
        {'model · 对话流'}
      </div>
      <FlowColumn x={FLOW.x - 430} top={FLOW.top - 20} w={FLOW.w - 100} step={FLOW.step - 8} items={items} planY={planYB} planDim={0} planGhost={0.95 - 0.4 * grayFlash} taskLit={[1, 1, 1]} />
      {/* ── 右半：群聊刷屏帧（类比 A#1——1–2 拍即收） ── */}
      <div style={{position: 'absolute', left: CHAT.x - 30, top: 150, opacity: chatIn * (1 - retire)}}>
        <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginBottom: 10}}>{'group chat · 类比'}</div>
        {/* 约定消息条（钉在聊天列顶——被人手拖回列顶） */}
        <div style={{position: 'absolute', left: 0, top: pactY - CHAT.top, opacity: chatIn}}>
          <MsgBar x={0} y={0} w={CHAT.w} h={56} label={'开头的约定'} sub={'pinned'} color={theme.mech} lit={chatIn} />
        </div>
        {/* 新消息条一路刷上来（stagger 快节奏——新压旧） */}
        {['新消息', '新消息', '新消息', '最新一段'].map((lab, i) => {
          const p = clamp01(progress(frame, rushAts[i], DUR.f4));
          const isLatest = i === 3;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                top: CHAT.top + 60 + (i + 1) * CHAT.step + 26 * (1 - hand), // 约定拖回时刷屏条再让位下压
                opacity: p * (isLatest ? 1 : 1 - 0.5 * latestLit),
                filter: isLatest ? 'none' : `saturate(${1 - 0.5 * latestLit})`,
              }}
            >
              <MsgBar
                x={0}
                y={0}
                w={CHAT.w}
                label={lab}
                sub={`msg ${i + 1}`}
                color={isLatest ? withAlpha(theme.text, 0.85) : undefined}
                lit={p}
                flash={isLatest ? latestLit : 0}
              />
            </div>
          );
        })}
        {/* 注意力只在最新一段（最新条高亮标注签） */}
        {latestLit > 0.01 ? (
          <div style={{position: 'absolute', left: CHAT.w + 16, top: CHAT.top + 60 + 4 * CHAT.step + 10, opacity: latestLit}}>
            <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>
              {'注意力'}
            </span>
          </div>
        ) : null}
        {/* 人手小图标（「翻回去」——人做得到；机制侧无人手即对比） */}
        {hand > 0.01 ? (
          <div
            style={{
              position: 'absolute',
              left: CHAT.w - 130 + 90 * (1 - hand),
              top: pactY + 30 + 60 * (1 - hand),
              opacity: hand,
            }}
          >
            <svg width={54} height={62} viewBox="0 0 54 62" style={{overflow: 'visible'}}>
              <path
                d="M 20 58 L 20 34 Q 20 28 25 28 Q 30 28 30 34 L 30 24 Q 30 18 35 18 Q 40 18 40 24 L 40 20 Q 40 14 45 14 Q 50 14 50 20 L 50 38 Q 50 52 38 58 Z"
                fill={theme.panel}
                stroke={theme.dim}
                strokeWidth={3}
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-C 可见区视窗首亮（术语锚装置） ────────────────────────────────────

const ZeroC: React.FC<{atWin: number; atLabel: number; atFlicker: number; atDim: number}> = ({atWin, atLabel, atFlicker, atDim}) => {
  const frame = useCurrentFrame();
  // 视窗落下锁定（窗内亮带显形 + 窗外一刀切灰化）
  const win = useProgress(atWin, DUR.f6, 'decelerate');
  const labelLit = useProgress(atLabel, DUR.f4);
  // 窗外灰化计划条微光闪两次又熄（够不着的悬念——两次 impulse 包络）
  const flick =
    useImpulse({at: atFlicker, dur: DUR.f4, peak: 0.55}) + useImpulse({at: atFlicker + DUR.f5, dur: DUR.f4, peak: 0.55});
  // 半拍收暗（盖场景不盖字幕）
  const dimAll = useProgress(atDim, DUR.f4);
  const WIN = {x: 620, top: 190, w: 680, h: 640} as const;
  const bars = ['改文件', '跑测试', '修测试', '再修测试', '又修测试', '继续修'];
  return (
    <AbsoluteFill>
      <VisibilityWindow x={WIN.x} y={WIN.top} w={WIN.w} h={WIN.h} lit={win} labelLit={labelLit} bandRatio={0.32}>
        {/* 对话流满幅（条目排布承 0-A/0-B——窗外一刀切灰化由视窗暗罩承载） */}
        <div style={{position: 'absolute', left: WIN.x, top: WIN.top, width: WIN.w, height: WIN.h}}>
          {bars.map((b, i) => {
            const inWin = i >= 4; // 末两条落在窗内亮带（最新尾段）
            return (
              <div key={b} style={{position: 'absolute', left: 0, top: 24 + i * 92, opacity: win > 0.3 || inWin ? 1 : 0.85}}>
                <MsgBar x={0} y={0} w={WIN.w} label={b} sub={`turn ${i + 1}`} color={inWin ? theme.tool : undefined} lit={1} ghost={win > 0.3 && !inWin ? 0.8 : 0} />
              </div>
            );
          })}
          {/* 计划条（卡窗外中下部——微光闪两次又熄；全程在窗外） */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 24 + 3.3 * 92,
              filter: `brightness(${1 + flick})`,
            }}
          >
            <MsgBar x={0} y={0} w={WIN.w} h={58} label={'三步计划'} sub={'plan'} color={theme.mech} lit={1} ghost={0.95 - 0.4 * flick} />
          </div>
        </div>
      </VisibilityWindow>
      {/* 窗沿机制名只进角标 */}
      <div
        style={{
          position: 'absolute',
          left: WIN.x + WIN.w + 18,
          top: WIN.top + WIN.h * 0.68 - 40,
          fontFamily: theme.mono,
          fontSize: 15,
          color: theme.dim,
          opacity: labelLit,
          whiteSpace: 'nowrap',
        }}
      >
        {'最新一轮可见'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 20, color: theme.dim, opacity: win * 0.85}}>
        {'窗外 = 出了可见区'}
      </div>
      <AbsoluteFill style={{background: '#000', opacity: 0.62 * dimAll, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0SunkPlan: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  // 词落位锚 = 句首 + 句长比例（口播无词级时间戳，比例即词窗；TTS 变更自动重定时）
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-06');
  const bC = w('p0-07', 'p0-08');

  return (
    <AbsoluteFill>
      <SourceCredit />
      <Sequence {...bA} name="0-A">
        <ZeroA
          atPlan={wa('p0-01', 0.3) - bA.from}
          atTask1={wa('p0-02', 0.2) - bA.from}
          atTask2={wa('p0-02', 0.42) - bA.from}
          atTask3={wa('p0-02', 0.64) - bA.from}
          atFixes={wa('p0-03', 0.14) - bA.from}
          atSunk={wa('p0-03', 0.68) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atGray={wa('p0-04', 0.3) - bB.from}
          atChat={wa('p0-05', 0.06) - bB.from}
          atRush={wa('p0-05', 0.34) - bB.from}
          atLatest={wa('p0-05', 0.78) - bB.from}
          atHand={wa('p0-06', 0.1) - bB.from}
          atRetire={wa('p0-06', 0.55) - bB.from}
          atPress={wa('p0-06', 0.85) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atWin={wa('p0-07', 0.1) - bC.from}
          atLabel={wa('p0-07', 0.72) - bC.from}
          atFlicker={wa('p0-08', 0.24) - bC.from}
          atDim={at('p0-08') + span('p0-08') - Math.min(10, span('p0-08') / 4) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0SunkPlan;
