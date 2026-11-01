/** P2 墙上走一圈（p2-01..p2-11，6 镜）——分镜 2-A / 2-B / 2-C / 2-D / 2-E / 2-F。
 *
 *  叙事链：2-A 走查舞台全景（Animated Worked Example）：四紫卡 stagger 上墙
 *  各就槽位（初稿/配图左列、排版中位、发布右位——次序=口播）→ 蓝色依赖连线
 *  三条依次织出（初稿→排版、配图→排版、排版→发布）＋被依赖卡依赖列表同步
 *  显出编号签 → 2-B 关卡视角扫过：初稿/配图卡前绿灯点亮、排版/发布卡前红闸
 *  落下 → 排版依赖签两枚**全灰**亮出（G1 修订：无一枚完成——首枚翻绿留 p2-05
 *  「做完」词窗、第二枚留 2-C p2-06）、发布上游横杆压住 → 初稿卡签名认领＋
 *  翻绿（排版依赖签 task_001 同步翻绿）→ 配图卡同构推进（第二拍加快）→
 *  2-C 解锁播报三连：配图完成瞬间信号沿既有连线流向排版（信号脉冲＋播报条
 *  「下一份开工名单：排版」＋下游闸门抬起）→ 排版完成点名发布 → 发布完成
 *  报空单（空条非文字）→ p2-07 播报条整条高亮（主动推送语义）→ 2-D「在做 ≠
 *  完成」等高对比小帧：两卡同款并列等高，左在做（签名亮、下游红挡）、右完成
 *  （翻绿、下游绿灯）→ 2-E 全链翻绿定格（四卡按依赖拓扑次序连锁脉冲、三条
 *  连线转常亮、静持 ≥0.5s——重音镜）→ 2-F 幕尾钩：镜头滑向墙角灰卡（低饱和
 *  紫——病态语义）＋虚线问号编号闪烁两下＋半拍收暗（悬念交给 P3）。
 *
 *  空间契约：四卡位次恒定、连线单向下游不交叉折返、任务名签全幕同形同色可
 *    追、灰卡 2-F 前不入镜；绿灯/红闸与 1-C 闸门同款同形、两卡推进同构（差异
 *    仅签名内容）、第二拍快于第一拍；播报信号沿既有连线流动（不另起路径）、
 *    三段播报次序=口播次序、下游卡不在信号到达前点亮；两卡等高等大同款（唯一
 *    差异=状态色）；翻绿次序=依赖拓扑次序（初稿→配图→排版→发布）；灰卡与紫卡
 *    同款异色、问号编号为虚线非实号、连线指向虚空不指实卡。
 *
 *  红线落实：词落位 = wa(id,f)（manifest 已就位——⑧ 轮按句内字位复核一轮通过，
 *    词级实测复核留 ⑨ 轮 QA；登记口径见 P0 头注）；y≥56 / bottom≥176；blockedBy · unblocked
 *    report · claim ≠ complete 只进角标；播报条不复述整句口播。
 *
 *  承接登记：1-E→2-A morph（storyboard 登记）——同墙位（WALL 全局几何）空槽
 *    态承接（1-E 收卡入栏后墙回空槽），四卡 stagger 入槽；2-F→3-A SceneFade +
 *    灰卡同形签名回归（镜间身份恒常，位置呼应承接）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  DepLine,
  SLOT_H,
  SLOT_W,
  TaskWall,
  UnblockFlow,
  WALL,
  WALL_SLOTS,
  WallCard,
} from '../components/motifs';
import {DUR, clamp01, progress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 走查拓扑（全幕恒定：四卡位次 / 连线折线 / 灰卡墙角位） ─────────────────

const CARDS = {
  draft: {slot: 0, title: '写初稿', id: 'task_001'},
  layout: {slot: 1, title: '排版', id: 'task_003'},
  publish: {slot: 2, title: '发布', id: 'task_004'},
  art: {slot: 3, title: '配图', id: 'task_002'},
  ghost: {slot: 5, title: '怪卡', id: 'task_005'},
} as const;
const slotPos = (slot: number) => WALL_SLOTS[slot];
const slotCenter = (slot: number) => ({x: slotPos(slot).x + SLOT_W / 2, y: slotPos(slot).y + SLOT_H / 2});

/** 依赖连线折线（单向下游：右缘出 → 左缘入；配图走下-右-上直角折） */
const LINES = {
  draftToLayout: [
    {x: slotPos(0).x + SLOT_W, y: slotCenter(0).y},
    {x: slotPos(1).x, y: slotCenter(1).y},
  ],
  artToLayout: [
    {x: slotPos(3).x + SLOT_W, y: slotCenter(3).y},
    {x: slotCenter(1).x, y: slotCenter(3).y},
    {x: slotCenter(1).x, y: slotPos(1).y + SLOT_H},
  ],
  layoutToPublish: [
    {x: slotPos(1).x + SLOT_W, y: slotCenter(1).y},
    {x: slotPos(2).x, y: slotCenter(2).y},
  ],
} as const;

/** 卡前关卡灯 + 横杆（2-B/2-D——与 1-C GateArm 同款同形的缩用形态：
 *  灯（绿=放行 / 红=压住）+ 斜纹横杆（落下拦 / 抬起放）） */
const CardGate: React.FC<{x: number; y: number; greenP?: number; redP?: number; dropP?: number; liftP?: number}> = ({x, y, greenP = 0, redP = 0, dropP = 0, liftP = 0}) => {
  const green = clamp01(greenP);
  const red = clamp01(redP);
  const drop = clamp01(dropP);
  const lift = clamp01(liftP);
  const armA = -70 * (1 - drop) + 74 * lift;
  const lit = Math.max(green, red);
  const color = green > 0.4 ? theme.ok : theme.danger;
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: 0.35 + 0.65 * lit}}>
      <svg width={86} height={54} viewBox="0 0 86 54" style={{overflow: 'visible'}}>
        <line x1={5} y1={50} x2={5} y2={8} stroke={withAlpha(theme.dim, 0.85)} strokeWidth={4} strokeLinecap="round" />
        <line x1={81} y1={50} x2={81} y2={8} stroke={withAlpha(theme.dim, 0.85)} strokeWidth={4} strokeLinecap="round" />
        <g transform={`rotate(${armA} 5 8)`} opacity={drop > 0.05 ? 1 : 0}>
          <line x1={5} y1={8} x2={81} y2={8} stroke={color} strokeWidth={5.5} strokeLinecap="round" opacity={0.9} />
          {[0, 1].map((i) => (
            <line key={`st${i}`} x1={22 + i * 28} y1={8} x2={31 + i * 28} y2={3} stroke={color} strokeWidth={2.6} strokeLinecap="round" opacity={0.7} />
          ))}
        </g>
        <circle cx={43} cy={46} r={8} fill={green > 0.4 ? theme.ok : 'transparent'} stroke={green > 0.4 ? theme.ok : withAlpha(theme.danger, 0.85)} strokeWidth={3} opacity={lit} />
      </svg>
    </div>
  );
};

// ── 2-A 走查舞台全景：四卡 stagger 上墙 + 三线织图 + 依赖签显出 ─────────────

const TwoA: React.FC<{atCards: number[]; atLines: number[]; atDeps: number}> = ({atCards, atLines, atDeps}) => {
  const frame = useCurrentFrame();
  const cardsIn = atCards.map((a) => clamp01(progress(frame, a, 18)));
  const linesIn = atLines.map((a) => clamp01(progress(frame, a, 16)));
  const depsP = clamp01(progress(frame, atDeps, DUR.f4));
  // 上墙次序 = 口播（写初稿、配图、排版、发布）
  const order = [CARDS.draft, CARDS.art, CARDS.layout, CARDS.publish];
  return (
    <AbsoluteFill>
      <TaskWall litP={1} slotsP={1} glowP={0.35} />
      {/* 蓝色依赖连线（三条依次织出——解锁蓝） */}
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <DepLine pts={LINES.draftToLayout} drawP={linesIn[0]} />
        <DepLine pts={LINES.artToLayout} drawP={linesIn[1]} />
        <DepLine pts={LINES.layoutToPublish} drawP={linesIn[2]} />
      </svg>
      {/* 四紫卡 stagger 上墙（各就槽位——半空落槽） */}
      {order.map((c, i) => (
        <WallCard
          key={c.id}
          x={slotPos(c.slot).x}
          y={slotPos(c.slot).y - (1 - cardsIn[i]) * 90}
          title={c.title}
          id={c.id}
          litP={cardsIn[i]}
          deps={c.slot === 1 ? [{id: 'task_001'}, {id: 'task_002'}] : c.slot === 2 ? [{id: 'task_003'}] : undefined}
          depsP={depsP}
        />
      ))}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'blockedBy · 内容工厂'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 关卡视角：绿灯/红闸 + 依赖签全灰亮出 + 两卡认领翻绿 ────────────────

const TwoB: React.FC<{
  atGreen1: number;
  atGreen2: number;
  atRed: number;
  atGrayShow: number;
  atPressPub: number;
  atSign1: number;
  atDone1: number;
  atDep1: number;
  atSign2: number;
  atDone2: number;
}> = ({atGreen1, atGreen2, atRed, atGrayShow, atPressPub, atSign1, atDone1, atDep1, atSign2, atDone2}) => {
  const frame = useCurrentFrame();
  const g1 = clamp01(progress(frame, atGreen1, 10));
  const g2 = clamp01(progress(frame, atGreen2, 10));
  const red = clamp01(progress(frame, atRed, 12));
  // 排版依赖签两枚全灰亮出（G1 修订：无一枚完成——首枚翻绿留 p2-05、第二枚留 2-C）
  const grayShow = clamp01(progress(frame, atGrayShow, 14));
  const grayPulse = Math.sin(Math.PI * clamp01(progress(frame, atGrayShow + 2, 18)));
  // 发布卡上游横杆压住（「压着排版」词窗强调）
  const pressPub = clamp01(progress(frame, atPressPub, DUR.f4));
  // 初稿：签名 → 翻绿（待领→在做→完成单步流转）→ 排版依赖签 task_001 同步翻绿
  const sign1 = clamp01(progress(frame, atSign1, 14));
  const done1 = clamp01(progress(frame, atDone1, 18));
  const dep1G = clamp01(progress(frame, atDep1, 12));
  // 配图：同构推进（第二拍快于第一拍——观众已识机制）
  const sign2 = clamp01(progress(frame, atSign2, 10));
  const done2 = clamp01(progress(frame, atDone2, 14));
  return (
    <AbsoluteFill>
      <TaskWall litP={1} slotsP={1} glowP={0.35} />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <DepLine pts={LINES.draftToLayout} drawP={1} />
        <DepLine pts={LINES.artToLayout} drawP={1} />
        <DepLine pts={LINES.layoutToPublish} drawP={1} />
      </svg>
      {/* 四卡 + 各自关卡灯（初稿/配图绿、排版/发布红闸） */}
      <WallCard x={slotPos(0).x} y={slotPos(0).y} title={CARDS.draft.title} id={CARDS.draft.id} state={done1 > 0.5 ? 'done' : sign1 > 0.5 ? 'claimed' : 'pending'} signP={sign1} signer="写手 · 甲" greenP={done1} />
      <CardGate x={slotPos(0).x + SLOT_W + 10} y={slotPos(0).y + 40} greenP={g1} />
      <WallCard x={slotPos(3).x} y={slotPos(3).y} title={CARDS.art.title} id={CARDS.art.id} state={done2 > 0.5 ? 'done' : sign2 > 0.5 ? 'claimed' : 'pending'} signP={sign2} signer="写手 · 乙" greenP={done2} />
      <CardGate x={slotPos(3).x + SLOT_W + 10} y={slotPos(3).y + 40} greenP={g2} />
      <WallCard
        x={slotPos(1).x}
        y={slotPos(1).y}
        title={CARDS.layout.title}
        id={CARDS.layout.id}
        deps={[{id: 'task_001', doneP: dep1G}, {id: 'task_002'}]}
        depsP={grayShow}
      />
      <CardGate x={slotPos(1).x + SLOT_W + 10} y={slotPos(1).y + 40} redP={red} dropP={red} />
      <WallCard x={slotPos(2).x} y={slotPos(2).y} title={CARDS.publish.title} id={CARDS.publish.id} deps={[{id: 'task_003'}]} depsP={grayShow} />
      <CardGate x={slotPos(2).x + SLOT_W + 10} y={slotPos(2).y + 40} redP={Math.max(red, pressPub)} dropP={red} />
      {/* 排版依赖全灰强调框（两枚全灰亮出——凑齐零枚的可视；G1 修订口径） */}
      {grayPulse > 0.03 ? (
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <rect x={slotPos(1).x + SLOT_W - 172} y={slotPos(1).y + SLOT_H - 96} width={162} height={82} rx={10} fill="none" stroke={theme.dim} strokeWidth={2.5} opacity={grayPulse * 0.8} />
        </svg>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'claim ≠ complete · 关卡只认完成'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-C 解锁播报三连：信号沿线流动 → 下游点亮 → 闸门抬起 → 名单条 ──────────

const TwoC: React.FC<{
  atSig1: number;
  atReport1: number;
  atLayoutDone: number;
  atSig2: number;
  atReport2: number;
  atPubDone: number;
  atReport3: number;
  atFlash: number;
}> = ({atSig1, atReport1, atLayoutDone, atSig2, atReport2, atPubDone, atReport3, atFlash}) => {
  const frame = useCurrentFrame();
  // 段一：配图完成瞬间（开帧已绿）→ 信号沿 L2 流向排版（脉冲到达后下游才点亮）
  const sig1T = clamp01(progress(frame, atSig1, 16));
  const report1 = clamp01(progress(frame, atReport1, DUR.f4));
  const lift1 = clamp01(progress(frame, atReport1, 14));
  const dep2G = clamp01(progress(frame, atReport1 + 4, 10));
  // 段二：排版完成（翻绿）→ 信号沿 L3 → 发布解锁
  const layoutDone = clamp01(progress(frame, atLayoutDone, 16));
  const sig2T = clamp01(progress(frame, atSig2, 16));
  const report2 = clamp01(progress(frame, atReport2, DUR.f4));
  const lift2 = clamp01(progress(frame, atReport2, 14));
  // 段三：发布完成 → 报空单（空条非文字）
  const pubDone = clamp01(progress(frame, atPubDone, 16));
  const report3 = clamp01(progress(frame, atReport3, DUR.f4));
  // p2-07 播报条整条高亮（完成动作自己带回开工名单——推送语义）
  const flash = Math.sin(Math.PI * clamp01(progress(frame, atFlash, 30))) * 0.7 + 0.3 * clamp01(progress(frame, atFlash, DUR.f4));
  return (
    <AbsoluteFill>
      <TaskWall litP={1} slotsP={1} glowP={0.35} />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <DepLine pts={LINES.draftToLayout} drawP={1} litP={1} />
        <DepLine pts={LINES.artToLayout} drawP={1} litP={layoutDone > 0.5 ? 1 : 0} pulseT={sig1T < 1 ? sig1T : -1} />
        <DepLine pts={LINES.layoutToPublish} drawP={1} litP={pubDone > 0.5 ? 1 : 0} pulseT={sig2T < 1 ? sig2T : -1} />
      </svg>
      {/* 四卡状态推进（信号到达才点亮——不提前） */}
      <WallCard x={slotPos(0).x} y={slotPos(0).y} title={CARDS.draft.title} id={CARDS.draft.id} state="done" greenP={1} signP={1} signer="写手 · 甲" />
      <WallCard x={slotPos(3).x} y={slotPos(3).y} title={CARDS.art.title} id={CARDS.art.id} state="done" greenP={1} signP={1} signer="写手 · 乙" />
      <WallCard
        x={slotPos(1).x}
        y={slotPos(1).y}
        title={CARDS.layout.title}
        id={CARDS.layout.id}
        state={layoutDone > 0.5 ? 'done' : 'pending'}
        greenP={layoutDone}
        deps={[{id: 'task_001', doneP: 1}, {id: 'task_002', doneP: dep2G}]}
        depsP={1}
      />
      <CardGate x={slotPos(1).x + SLOT_W + 10} y={slotPos(1).y + 40} redP={1 - lift1} dropP={1 - lift1} liftP={lift1} greenP={lift1} />
      <WallCard x={slotPos(2).x} y={slotPos(2).y} title={CARDS.publish.title} id={CARDS.publish.id} state={pubDone > 0.5 ? 'done' : 'pending'} greenP={pubDone} deps={[{id: 'task_003', doneP: layoutDone}]} depsP={1} />
      <CardGate x={slotPos(2).x + SLOT_W + 10} y={slotPos(2).y + 40} redP={1 - lift2} dropP={1 - lift2} liftP={lift2} greenP={lift2} />
      {/* 播报条（墙下居中——三段顺序替换：排版 / 发布 / 空单） */}
      {report3 > 0.02 ? (
        <UnblockFlow x={640} y={812} w={640} popP={report3} name={null} flashP={flash} />
      ) : report2 > 0.02 ? (
        <UnblockFlow x={640} y={812} w={640} popP={report2} name="发布" flashP={flash} />
      ) : (
        <UnblockFlow x={640} y={812} w={640} popP={report1} name="排版" />
      )}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'unblocked report · 主动推送'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-D「在做 ≠ 完成」等高对比小帧：两卡并列等高、左红右绿裁决 ──────────────

const DUEL = {y: 190, w: 420, h: 280} as const;

const TwoD: React.FC<{atSign: number; atGreen: number; atPress: number}> = ({atSign, atGreen, atPress}) => {
  const frame = useCurrentFrame();
  // 左卡：认领签名亮而状态停在做在（本镜全部论点——左卡不翻绿）
  const sign = clamp01(progress(frame, atSign, 14));
  // 右卡：完成翻绿 + 下游绿灯对照点亮
  const green = clamp01(progress(frame, atGreen, 18));
  // 左卡下游红挡压一拍（「照样被挡着」词窗）
  const press = Math.sin(Math.PI * clamp01(progress(frame, atPress, 22)));
  return (
    <AbsoluteFill>
      {/* 两卡等高等大同款（唯一差异 = 状态色）；标签条（在做 / 完成） */}
      {[
        {x: 430, label: '在做', color: theme.mech},
        {x: 1070, label: '完成', color: theme.ok},
      ].map((side, i) => (
        <div
          key={side.label}
          style={{
            position: 'absolute',
            left: side.x,
            top: 128,
            padding: '5px 22px',
            borderRadius: 9,
            border: `2.5px solid ${withAlpha(side.color, 0.85)}`,
            fontFamily: theme.sans,
            fontSize: 21,
            fontWeight: 700,
            color: side.color,
            whiteSpace: 'nowrap',
          }}
        >
          {side.label}
        </div>
      ))}
      <WallCard x={430} y={DUEL.y} w={DUEL.w} h={DUEL.h} title="排版" id="task_003" state="claimed" signP={sign} signer="写手 · 乙" deps={[{id: 'task_001'}, {id: 'task_002'}]} depsP={1} />
      <WallCard x={1070} y={DUEL.y} w={DUEL.w} h={DUEL.h} title="排版" id="task_003" state="done" greenP={green} signP={1} signer="写手 · 乙" deps={[{id: 'task_001', doneP: 1}, {id: 'task_002', doneP: 1}]} depsP={1} />
      {/* 下游闸门：左红挡压一拍（脉冲强调）↔ 右绿灯常亮（等高裁决） */}
      <CardGate x={430 + DUEL.w / 2 - 43} y={DUEL.y + DUEL.h + 22} redP={0.5 + 0.5 * press} dropP={1} />
      <CardGate x={1070 + DUEL.w / 2 - 43} y={DUEL.y + DUEL.h + 22} greenP={green} liftP={green} dropP={1 - green} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'claim ≠ complete · 等高裁决'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-E 全链翻绿定格：四卡拓扑次序连锁脉冲 + 三线转常亮 + 静持 ─────────────

const TwoE: React.FC<{atChain: number[]; atLines: number}> = ({atChain, atLines}) => {
  const frame = useCurrentFrame();
  // 四卡按完成次序（初稿→配图→排版→发布——依赖拓扑次序）连锁脉冲翻绿定格
  const chain = atChain.map((a) => clamp01(progress(frame, a, 12)));
  const glows = atChain.map((a) => Math.sin(Math.PI * clamp01(progress(frame, a + 4, 20))));
  const linesLit = clamp01(progress(frame, atLines, 20));
  const order = [CARDS.draft, CARDS.art, CARDS.layout, CARDS.publish];
  return (
    <AbsoluteFill>
      <TaskWall litP={1} slotsP={1} glowP={0.35} />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <DepLine pts={LINES.draftToLayout} drawP={1} litP={linesLit} />
        <DepLine pts={LINES.artToLayout} drawP={1} litP={linesLit} />
        <DepLine pts={LINES.layoutToPublish} drawP={1} litP={linesLit} />
      </svg>
      {order.map((c, i) => (
        <div key={c.id} style={{position: 'absolute', left: slotPos(c.slot).x, top: slotPos(c.slot).y, width: SLOT_W, height: SLOT_H}}>
          <WallCard x={0} y={0} title={c.title} id={c.id} state="done" greenP={1} signP={1} signer={i % 2 === 0 ? '写手 · 甲' : '写手 · 乙'} deps={c.slot === 1 ? [{id: 'task_001', doneP: 1}, {id: 'task_002', doneP: 1}] : c.slot === 2 ? [{id: 'task_003', doneP: 1}] : undefined} depsP={1} />
          {/* 连锁翻绿脉冲（拓扑次序重演——glow 光环逐卡接力） */}
          {glows[i] > 0.03 ? (
            <svg width={SLOT_W} height={SLOT_H} viewBox={`0 0 ${SLOT_W} ${SLOT_H}`} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
              <rect x={-4} y={-4} width={SLOT_W + 8} height={SLOT_H + 8} rx={14} fill="none" stroke={theme.ok} strokeWidth={3.5} opacity={glows[i] * 0.9} />
            </svg>
          ) : null}
        </div>
      ))}
      {/* 空单播报收尾（发布完成 → 报：没有——静持在墙下） */}
      <UnblockFlow x={640} y={812} w={640} popP={1} name={null} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'全部完成 · 4/4'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-F 幕尾钩：滑向墙角灰卡 + 虚线问号编号闪烁两下 + 半拍收暗 ──────────────

const GHOST_LINE = [
  {x: slotPos(5).x + SLOT_W, y: slotCenter(5).y},
  {x: 1700, y: slotCenter(5).y},
] as const;

const TwoF: React.FC<{atPan: number; atGhost: number; atQ: number; atDim: number}> = ({atPan, atGhost, atQ, atDim}) => {
  const frame = useCurrentFrame();
  // 滑镜（pan：自定格墙面滑向墙角灰卡——容器 transform + progress，08 规格
  //   运镜约定的 bespoke 逃生舱合法形态；storyboard @travel 记号写在画面列、
  //   动效门不提取，意图即此 pan——语义登记防 ⑨ QA 误报）
  const pan = clamp01(progress(frame, atPan, 26));
  const o = slotCenter(5);
  const tf = `translate(${-pan * 330}px, ${-pan * 158}px) scale(${1 + 0.4 * pan})`;
  // 灰卡入镜（低饱和紫——病态语义；与紫卡同款异色）
  const ghost = clamp01(progress(frame, atGhost, 16));
  // 虚线问号编号闪烁两下（task_999 位——虚线非实号）
  const qT = clamp01(progress(frame, atQ, 26));
  const blink = qT <= 0 ? 0 : qT < 0.33 ? 1 : qT < 0.5 ? 0.15 : qT < 0.75 ? 1 : qT < 0.9 ? 0.15 : 1;
  // 半拍收暗（悬念交给 P3）
  const dimP = clamp01(progress(frame, atDim, 18));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: tf, transformOrigin: `${o.x}px ${o.y}px`, opacity: 1}}>
        <TaskWall litP={1} slotsP={1} glowP={0.3} dimP={dimP * 0.5} />
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <DepLine pts={LINES.draftToLayout} drawP={1} litP={1} />
          <DepLine pts={LINES.artToLayout} drawP={1} litP={1} />
          <DepLine pts={LINES.layoutToPublish} drawP={1} litP={1} />
          {/* 灰卡依赖连线：指向虚空处（不指任何实卡） */}
          <DepLine pts={GHOST_LINE} drawP={ghost} ghostP={ghost} />
        </svg>
        {/* 四绿卡定格（承 2-E 全绿态） */}
        {[CARDS.draft, CARDS.art, CARDS.layout, CARDS.publish].map((c) => (
          <WallCard key={c.id} x={slotPos(c.slot).x} y={slotPos(c.slot).y} title={c.title} id={c.id} state="done" greenP={1} signP={1} signer={c.slot % 2 === 0 ? '写手 · 甲' : '写手 · 乙'} deps={c.slot === 1 ? [{id: 'task_001', doneP: 1}, {id: 'task_002', doneP: 1}] : c.slot === 2 ? [{id: 'task_003', doneP: 1}] : undefined} depsP={1} />
        ))}
        {/* 墙角灰卡（低饱和紫——怪卡；本镜不被处理） */}
        <WallCard x={slotPos(5).x} y={slotPos(5).y} title="?" id="task_005" litP={ghost} grayP={1} deps={[{id: 'task_999', ghostP: 1}]} depsP={ghost} />
        {/* 虚线问号编号（task_999 位——虚空处的闪烁问号签） */}
        {blink > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: 1690,
              top: slotCenter(5).y - 40,
              padding: '8px 20px',
              borderRadius: 9,
              border: `3px dashed ${withAlpha(theme.danger, 0.75)}`,
              background: withAlpha(theme.panel, 0.92),
              fontFamily: theme.mono,
              fontSize: 22,
              fontWeight: 700,
              color: theme.danger,
              whiteSpace: 'nowrap',
              opacity: blink * clamp01(qT * 4),
              textShadow: `0 0 ${12 * blink}px ${withAlpha(theme.danger, 0.4)}`,
            }}
          >
            {'task_999 ?'}
          </div>
        ) : null}
      </div>
      {/* 半拍收暗（整画面压暗一层——悬念交接） */}
      <AbsoluteFill style={{background: theme.bg, opacity: 0.45 * dimP, pointerEvents: 'none'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7 * (1 - 0.4 * dimP)}}>
        {'Blocked by: task_999（不存在）'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2WallWalkthrough: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-02');
  const bB = w('p2-03', 'p2-05');
  const bC = w('p2-06', 'p2-07');
  const bD = w('p2-08', 'p2-09');
  const bE = w('p2-10');
  const bF = w('p2-11');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <TwoA
          atCards={[0.43, 0.57, 0.68, 0.79].map((f) => wa('p2-01', f) - bA.from)}
          atLines={[0.36, 0.55, 0.78].map((f) => wa('p2-02', f) - bA.from)}
          atDeps={wa('p2-02', 0.2) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB
          atGreen1={wa('p2-03', 0.42) - bB.from}
          atGreen2={wa('p2-03', 0.5) - bB.from}
          atRed={wa('p2-03', 0.46) - bB.from}
          atGrayShow={wa('p2-04', 0.26) - bB.from}
          atPressPub={wa('p2-04', 0.76) - bB.from}
          atSign1={wa('p2-05', 0.1) - bB.from}
          atDone1={wa('p2-05', 0.38) - bB.from}
          atDep1={wa('p2-05', 0.44) - bB.from}
          atSign2={wa('p2-05', 0.6) - bB.from}
          atDone2={wa('p2-05', 0.88) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC
          atSig1={wa('p2-06', 0.08) - bC.from}
          atReport1={wa('p2-06', 0.3) - bC.from}
          atLayoutDone={wa('p2-06', 0.52) - bC.from}
          atSig2={wa('p2-06', 0.58) - bC.from}
          atReport2={wa('p2-06', 0.72) - bC.from}
          atPubDone={wa('p2-06', 0.8) - bC.from}
          atReport3={wa('p2-06', 0.9) - bC.from}
          atFlash={wa('p2-07', 0.24) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="2-D">
        <TwoD atSign={wa('p2-08', 0.3) - bD.from} atGreen={wa('p2-09', 0.2) - bD.from} atPress={wa('p2-09', 0.55) - bD.from} />
      </Sequence>
      <Sequence {...bE} name="2-E">
        <TwoE atChain={[0.2, 0.32, 0.44, 0.56].map((f) => wa('p2-10', f) - bE.from)} atLines={wa('p2-10', 0.68) - bE.from} />
      </Sequence>
      <Sequence {...bF} name="2-F">
        <TwoF atPan={wa('p2-11', 0.3) - bF.from} atGhost={wa('p2-11', 0.42) - bF.from} atQ={wa('p2-11', 0.7) - bF.from} atDim={wa('p2-11', 0.85) - bF.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2WallWalkthrough;
