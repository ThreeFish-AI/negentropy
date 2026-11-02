/** P1 一张卡，六个字段（p1-01..p1-10，5 镜）——分镜 1-A / 1-B / 1-C / 1-D / 1-E。
 *
 *  叙事链：1-A 开帧任务墙全局位一拍（全景坐标锚：槽位网格 + 半透明卡影位）→
 *  急推 slot0 卡影凝为实体紫卡特写（砖=卡的身份揭示）→ 六字段槽位逐项取名
 *  点亮（编号→标题→描述→状态→归属人→依赖列表，stagger 次序=口播次序）＋
 *  「1 任务 = 1 文件」卡角小签＋依赖列表字段内两枚微型卡影 → 1-B 状态机横条：
 *  三段依次点亮（待领灰紫/在做亮紫/完成绿）→ 认领箭头推入（滑标待领→在做、
 *  卡角写归属人签名）→ 完成箭头翻绿（滑标在做→完成、卡面翻绿）→ 1-C 关卡
 *  闸门：横杆压在认领必经之路 ＋ 两枚红挡并列（左依赖未完成 / 右依赖不存在·
 *  引用错误）→ 放行条件演示（依赖签逐枚翻绿）→ 一枚回灰左挡拦停 → 一枚变
 *  虚线问号右挡落下 → 卡面编号闪错一次又稳住（fail-closed 稳态拦截非崩溃）→
 *  1-D 卡翻面 180°：背面文件代码形态（字段名:值 行式、与正面槽位一一对位）＋
 *  读写光标扫行写入 ＋ 画面边缘墙体重启白噪一闪（卡纹丝不动——重启不丢的
 *  帧上证明）→ 1-E 环体侧亮工具池（恒定锚〔M-001〕同形缩悬上侧）：计数条
 *  3→8 阶梯增长（双刻度基线）＋ 3 件既有卡旁五枚任务操作卡 stagger 入池 →
 *  p1-10 教学演示卡先收卡入栏淡出（墙回空槽态）→ 镜头拉回下方任务墙全局位
 *  （走查舞台预告）。
 *
 *  空间契约：六字段点亮次序=口播次序、字段名只作标签；三段横条等宽单向、
 *    签名不早于在做段；两种红挡并列可辨、拦截非碎裂；翻面前后字段↔行一一
 *    对位、闪烁只打墙体不打在卡上；计数条带 3/8 双刻度、环体描边/线宽与系列
 *    锚定逐像素一致、增长不越 8、环体本体零形变。
 *
 *  红线落实：词落位 = wa(id,f)（manifest 已就位——⑧ 轮按句内字位复核一轮通过，
 *    词级实测复核留 ⑨ 轮 QA；登记口径见 P0 头注）；y≥56 / bottom≥176；pending / in_progress
 *    / completed · claim / complete · can_start · TOOLS 3→8 · create_task ·
 *    list_tasks · get_task · claim_task · complete_task · .tasks/ · JSON 只进
 *    角标；字段值不成句复述口播。
 *
 *  承接登记（G1 ⑨ 改判口径）：0-C→1-A **非 morph**——0-C 末帧已推至槽位特写、
 *    本幕首帧回墙全局位（SceneFade 全景重锚，同 4-D→5-A 形态）；身份线索由
 *    墙体网格轮廓+槽位布局跨镜保持。1-E→2-A morph（storyboard 登记）：拉回
 *    前教学卡收卡入栏淡出（教学卡归档不带入走查——卡去向显式登记），墙回
 *    空槽态后墙体网格/槽位布局逐帧不变，2-A 四卡 stagger 入槽。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  DepChip,
  GateArm,
  LoopRing,
  SLOT_H,
  SLOT_W,
  StateMachineBar,
  TaskWall,
  WALL,
  WALL_SLOTS,
  WallCard,
} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 六字段面（1-A 特写取名点亮 / 1-D 翻面正面对位——两镜共用同一 2×3 布局）──

const FIELDS = [
  {k: '编号', v: 'task_001'},
  {k: '标题', v: '写初稿'},
  {k: '描述', v: '内容工厂首篇'},
  {k: '状态', v: '待领'},
  {k: '归属人', v: '—'},
  {k: '依赖列表', v: '[ ]'},
] as const;

/** 六字段槽位面（w/h 由调用方给——1-A 走 360×260 随 zoom 放大、1-D 走 840×520）。
 *  `fieldP` 六项点亮进度（取名=字段名标签贴上+槽位 mech 边）；`depsMiniP`
 *  依赖列表字段内两枚微型卡影（「开工前要等的那些卡」词窗） */
const SixFieldFace: React.FC<{
  w: number;
  h: number;
  fieldP: number[];
  depsMiniP?: number;
  headP?: number;
}> = ({w, h, fieldP, depsMiniP = 0, headP = 1}) => {
  const pad = Math.round(w * 0.045);
  const headH = Math.round(h * 0.16);
  const gridW = w - pad * 2;
  const gridH = h - headH - pad;
  const cw = (gridW - pad) / 2;
  const ch = (gridH - pad * 2) / 3;
  return (
    <div style={{position: 'relative', width: w, height: h}}>
      {/* 卡头（编号 + 标题——承 WallCard 卡头同构） */}
      <div style={{position: 'absolute', left: pad, top: Math.round(pad * 0.6), display: 'flex', alignItems: 'baseline', gap: Math.round(w * 0.035), opacity: clamp01(headP)}}>
        <span style={{fontFamily: theme.mono, fontSize: Math.max(13, Math.round(w * 0.042)), color: theme.dim, whiteSpace: 'nowrap', letterSpacing: 1}}>{'task_001'}</span>
        <span style={{fontFamily: theme.sans, fontSize: Math.max(18, Math.round(w * 0.062)), fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'写初稿'}</span>
      </div>
      {/* 六字段槽 2×3（虚线空槽 → 取名点亮：mech 边 + 字段名标签 + 极短值） */}
      {FIELDS.map((f, i) => {
        const p = clamp01(fieldP[i] ?? 0);
        const col = i % 2;
        const row = Math.floor(i / 2);
        const fx = pad + col * (cw + pad);
        const fy = headH + row * (ch + pad);
        const isDeps = i === 5;
        return (
          <div
            key={f.k}
            style={{
              position: 'absolute',
              left: fx,
              top: fy,
              width: cw,
              height: ch,
              borderRadius: 8,
              border: `2px ${p > 0.35 ? 'solid' : 'dashed'} ${p > 0.35 ? withAlpha(theme.mech, 0.85) : withAlpha(theme.dim, 0.5)}`,
              background: p > 0.35 ? withAlpha(theme.mech, 0.1) : 'transparent',
              padding: `${Math.max(3, Math.round(ch * 0.1))}px ${Math.max(6, Math.round(cw * 0.06))}px`,
              opacity: 0.35 + 0.65 * p,
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: Math.max(11, Math.round(w * 0.036)), color: p > 0.35 ? theme.mech : theme.dim, whiteSpace: 'nowrap', letterSpacing: 1}}>
              {p > 0.2 ? f.k : ''}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: Math.max(12, Math.round(w * 0.04)), color: theme.text, marginTop: 2, whiteSpace: 'nowrap', opacity: p > 0.5 ? 0.9 : 0}}>
              {p > 0.5 ? f.v : ''}
            </div>
            {/* 依赖列表字段内两枚微型卡影（开工前要等的那些卡） */}
            {isDeps && depsMiniP > 0.02 ? (
              <div style={{display: 'flex', gap: Math.max(3, Math.round(cw * 0.05)), marginTop: 2, opacity: clamp01(depsMiniP)}}>
                {[0, 1].map((m) => (
                  <span
                    key={`mini${m}`}
                    style={{
                      width: Math.max(22, Math.round(cw * 0.24)),
                      height: Math.max(12, Math.round(ch * 0.26)),
                      borderRadius: 3,
                      border: `2px solid ${withAlpha(theme.mech, 0.6)}`,
                      background: withAlpha(theme.panel, 0.9),
                      opacity: 0.55 + 0.45 * clamp01(depsMiniP),
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

// ── 1-A 急推单卡：卡影凝实 + 六字段取名点亮 + 角签 ─────────────────────────

/** 卡影挂槽位（0-C 预演四枚——1-A 开帧同位承接；slot0 随急推凝实） */
const SHADOW_SLOTS = [0, 3, 1, 2] as const;
const SHADOW_IDS = ['task_001', 'task_002', 'task_003', 'task_004'] as const;
const SHADOW_TITLES = ['写初稿', '配图', '排版', '发布'] as const;

const OneA: React.FC<{atZoom: number; atTag: number; atFields: number[]; atDepsMini: number}> = ({atZoom, atTag, atFields, atDepsMini}) => {
  const frame = useCurrentFrame();
  // 急推（显式帧数 24f≈0.8s：跨全局位→特写的大位移；@pushIn 词锚动机见头注）
  const zoomP = clamp01(progress(frame, atZoom, 24));
  const o = {x: WALL_SLOTS[0].x + SLOT_W / 2, y: WALL_SLOTS[0].y + SLOT_H / 2};
  const c = {x: 860, y: 520};
  const z = 1 + (2.3 - 1) * zoomP;
  const zoomTf = `translate(${(c.x - o.x) * zoomP}px, ${(c.y - o.y) * zoomP}px) scale(${z})`;
  // slot0 卡影凝实（透明度 0.35→1 随急推后半程）
  const solid = 0.35 + 0.65 * clamp01(progress(frame, atZoom + 12, 14));
  // 六字段逐项取名点亮（stagger 次序=口播：编号→标题→描述→状态→归属人→依赖列表）
  const fieldP = atFields.map((a) => clamp01(progress(frame, a, 12)));
  // 「1 任务 = 1 文件」卡角小签
  const tag = clamp01(progress(frame, atTag, DUR.f4));
  // 依赖列表字段内两枚微型卡影
  const depsMini = clamp01(progress(frame, atDepsMini, DUR.f4));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: zoomTf, transformOrigin: `${o.x}px ${o.y}px`}}>
        {/* 墙全局位（开帧全景坐标锚——0-C 空墙形态承接） */}
        <TaskWall litP={1} slotsP={1} glowP={0.5} />
        {/* 三枚旁位卡影（保持半透明——凝实只属 slot0 主角） */}
        {SHADOW_SLOTS.slice(1).map((s, i) => (
          <WallCard key={`sh${s}`} x={WALL_SLOTS[s].x} y={WALL_SLOTS[s].y} title={SHADOW_TITLES[i + 1]} id={SHADOW_IDS[i + 1]} litP={1} solidP={0.35} />
        ))}
        {/* slot0 主角卡（半透明卡影 → 凝实六字段卡——同 DOM 纯状态推进） */}
        <div
          style={{
            position: 'absolute',
            left: WALL_SLOTS[0].x,
            top: WALL_SLOTS[0].y,
            width: SLOT_W,
            height: SLOT_H,
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.mech, 0.45 + 0.5 * (solid - 0.35) / 0.65)}`,
            background: withAlpha(theme.panel, 0.6 + 0.4 * solid),
            opacity: 0.45 + 0.55 * solid,
            boxShadow: solid > 0.9 ? `0 0 20px ${withAlpha(theme.mech, 0.35)}` : 'none',
          }}
        >
          <SixFieldFace w={SLOT_W} h={SLOT_H} fieldP={fieldP} depsMiniP={depsMini} />
        </div>
        {/* 「1 任务 = 1 文件」卡角小签（贴卡右上角外） */}
        {tag > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: WALL_SLOTS[0].x + SLOT_W - 96,
              top: WALL_SLOTS[0].y - 40,
              padding: '5px 16px',
              borderRadius: 8,
              border: `2.5px solid ${withAlpha(theme.core, 0.8)}`,
              background: theme.panel,
              fontFamily: theme.mono,
              fontSize: 15,
              fontWeight: 700,
              color: theme.core,
              whiteSpace: 'nowrap',
              opacity: tag,
              transform: `translateY(${(1 - tag) * -12}px)`,
            }}
          >
            {'1 任务 = 1 文件'}
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'.tasks/{id}.json'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 状态机横条：三段点亮 + 认领/完成两动作单步流转 ─────────────────────

const BAR_B = {x: 620, y: 356, w: 1120} as const;

const OneB: React.FC<{atSegs: number[]; atClaim: number; atSign: number; atDone: number}> = ({atSegs, atClaim, atSign, atDone}) => {
  const frame = useCurrentFrame();
  // 三段依次点亮（词锚=口播「待领、在做、完成」三词窗）
  const segs = atSegs.reduce((acc, a) => acc + clamp01(progress(frame, a, 10)), 0);
  // 认领：箭头推入 → 滑标 0→1 → 签名落卡角（因果次序：签名不早于在做段）
  const claim = clamp01(progress(frame, atClaim, 14));
  const pos1 = clamp01(progress(frame, atClaim + 6, 12));
  const sign = clamp01(progress(frame, atSign, 16));
  // 完成：箭头翻绿 → 滑标 1→2 → 卡面翻绿
  const done = clamp01(progress(frame, atDone, 14));
  const pos2 = clamp01(progress(frame, atDone + 6, 12));
  const green = clamp01(progress(frame, atDone + 14, 18));
  // 状态文字（卡上状态字段随滑标改写：待领→在做→完成）
  const stateTxt = pos2 > 0.5 ? '完成' : pos1 > 0.5 ? '在做' : '待领';
  const push = usePushIn(0, {scale: 0.04, dur: DUR.f6});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '50% 42%'}}>
        {/* 教学卡（左——状态字段随动作改写；签名与翻绿各一次落卡） */}
        <WallCard
          x={130}
          y={196}
          w={420}
          h={280}
          title="写初稿"
          id="task_001"
          state={pos2 > 0.5 ? 'done' : pos1 > 0.5 ? 'claimed' : 'pending'}
          signP={sign}
          signer="写手 · 甲"
          greenP={green}
        />
        {/* 状态字段当前值（卡右侧近横条——随滑标改写的可读面） */}
        <div style={{position: 'absolute', left: 180, top: 520, padding: '6px 22px', borderRadius: 9, border: `2.5px solid ${pos2 > 0.5 ? theme.ok : pos1 > 0.5 ? theme.mech : withAlpha(theme.dim, 0.7)}`, background: theme.panel, fontFamily: theme.mono, fontSize: 22, fontWeight: 700, color: pos2 > 0.5 ? theme.ok : pos1 > 0.5 ? theme.mech : theme.dim, whiteSpace: 'nowrap'}}>
          {stateTxt}
        </div>
        {/* 三状态横条 + 两动作箭头（右——等宽单向） */}
        <StateMachineBar x={BAR_B.x} y={BAR_B.y} w={BAR_B.w} h={104} litP={1} segsP={segs} pos={pos1 + pos2} claimP={claim} doneP={done} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'pending → in_progress → completed · claim / complete'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 关卡闸门：放行条件演示 → 左挡（未完成）→ 右挡（不存在）→ 编号闪错 ──

const GATE_C = {x: 700, y: 320} as const;
const CARD_C = {x: 1150, y: 196, w: 420, h: 280} as const;

const OneC: React.FC<{atGate: number; atPass: number; atGray: number; atLeftBar: number; atGhostChip: number; atRightBar: number; atErr: number}> = ({atGate, atPass, atGray, atLeftBar, atGhostChip, atRightBar, atErr}) => {
  const frame = useCurrentFrame();
  // 闸门压下（认领必经之路）
  const drop = clamp01(progress(frame, atGate, DUR.f5));
  // 放行条件演示：两枚依赖签逐枚翻绿 + 闸门抬绿灯（理想态一拍）
  const pass = clamp01(progress(frame, atPass, 20));
  const dep1G = clamp01(progress(frame, atPass, 12));
  const dep2G = clamp01(progress(frame, atPass + 8, 12));
  const passLift = clamp01(progress(frame, atPass + 14, 14));
  // 违反一：一枚依赖签回灰（未完成）→ 左红挡落下、认领箭头撞停
  const grayBack = clamp01(progress(frame, atGray, 12));
  const leftBar = clamp01(progress(frame, atLeftBar, DUR.f4));
  const arrowStop = clamp01(progress(frame, atLeftBar + 2, 20));
  // 违反二：一枚依赖签变虚线问号（不存在）→ 右红挡落下（两挡并列可辨）
  const ghostChip = clamp01(progress(frame, atGhostChip, 14));
  const rightBar = clamp01(progress(frame, atRightBar, DUR.f4));
  // 编号闪错一次又稳住（fail-closed 稳态拦截非崩溃——红挡≠碎裂）
  const errP = Math.sin(Math.PI * clamp01(progress(frame, atErr, 20)));
  // 认领箭头（自左推进——被闸门拦停在杆前）
  const arrowX = 340 + 300 * arrowStop;
  const deps = [
    {id: 'task_002', doneP: dep1G * (1 - grayBack), ghostP: 0},
    {id: 'task_003', doneP: dep2G * (1 - grayBack), ghostP: ghostChip},
  ];
  return (
    <AbsoluteFill>
      {/* 背景卡（左——依赖列表亮出两枚依赖小卡签） */}
      <div style={{position: 'absolute', left: 150, top: 196, width: 420, height: 280}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: 420, height: 280, borderRadius: 12, border: `3px solid ${withAlpha(theme.mech, 0.6)}`, background: withAlpha(theme.panel, 0.95), padding: '16px 18px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, letterSpacing: 2, whiteSpace: 'nowrap'}}>{'依赖列表 · blockedBy'}</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18, opacity: clamp01(progress(frame, atGate - 4, DUR.f4))}}>
            {deps.map((d) => (
              <DepChip key={d.id} id={d.id} doneP={d.doneP} ghostP={d.ghostP} w={220} />
            ))}
          </div>
        </div>
      </div>
      {/* 关卡闸门（中——横杆 + 双红挡并列；pass 期抬绿灯） */}
      <GateArm x={GATE_C.x} y={GATE_C.y} w={260} dropP={drop} bar={rightBar > 0.2 ? 'both' : leftBar > 0.2 ? 'left' : null} barP={Math.max(leftBar, rightBar)} liftP={passLift * (1 - Math.max(leftBar, rightBar))} greenP={passLift * (1 - Math.max(leftBar, rightBar))} />
      {/* 认领箭头（自左推进 → 撞停杆前——不绕过闸门） */}
      <svg width={520} height={70} viewBox="0 0 520 70" style={{position: 'absolute', left: arrowX - 260, top: 604, overflow: 'visible', opacity: clamp01(progress(frame, atGate - 8, DUR.f4))}}>
        <line x1={0} y1={35} x2={400} y2={35} stroke={withAlpha(theme.mech, 0.8)} strokeWidth={5} strokeLinecap="round" />
        <path d="M 392 20 L 424 35 L 392 50" fill="none" stroke={theme.mech} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        <text x={8} y={66} fontFamily={theme.sans} fontSize={16} fontWeight={700} fill={theme.mech}>
          {'认领'}
        </text>
      </svg>
      {/* 主卡（右——认领目标；编号闪错一次又稳住） */}
      <WallCard x={CARD_C.x} y={CARD_C.y} w={CARD_C.w} h={CARD_C.h} title="排版" id="task_003" errP={errP} deps={[{id: 'task_002'}, {id: 'task_001'}]} depsP={clamp01(progress(frame, atGate, DUR.f4))} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'can_start · fail-closed'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-D 卡翻面：正面字段槽 ↔ 背面代码行一一对位 + 光标写入 + 墙体重启闪烁 ──

const FLIP_CARD = {x: 540, y: 130, w: 840, h: 520} as const;

const OneD: React.FC<{atFlip: number; atCursor: number; atFlicker: number}> = ({atFlip, atCursor, atFlicker}) => {
  const frame = useCurrentFrame();
  // 翻面 180°（正面字段槽 ↔ 背面代码行）
  const flip = clamp01(progress(frame, atFlip, 30));
  const rotY = flip * 180;
  // 读写光标扫过一行写入（owner: null → 写入归属）
  const cursor = clamp01(progress(frame, atCursor, 30));
  const written = cursor > 0.6 ? "'写手 · 甲'" : 'null';
  const cursorX = Math.min(1, cursor * 1.6);
  // 墙体重启闪烁一拍（只打墙体——卡面零漂移：卡与墙分属独立 DOM 层）
  const flicker = clamp01(progress(frame, atFlicker, 14));
  // 代码行（背面——字段名:值 行式；行位与正面 2×3 槽位一一对位）
  const codeLines = [
    {k: 'id', v: "'task_001'"},
    {k: 'subject', v: "'写初稿'"},
    {k: 'description', v: "'内容工厂首篇'"},
    {k: 'status', v: "'pending'"},
    {k: 'owner', v: written},
    {k: 'blockedBy', v: '[ ]'},
  ];
  const pad = 38;
  const headH = 84;
  const cw = (FLIP_CARD.w - pad * 2 - pad) / 2;
  const ch = (FLIP_CARD.h - headH - pad - pad * 2) / 3;
  return (
    <AbsoluteFill>
      {/* 背景墙体（画面边缘暗层——重启闪烁打在这层） */}
      <div style={{position: 'absolute', left: -80, top: -60, transform: 'scale(0.86)', transformOrigin: '0 0', opacity: 0.3}}>
        <TaskWall litP={1} slotsP={0.6} glowP={0.2} flickerP={flicker} />
      </div>
      {/* 翻面卡（perspective 容器 + 双面 backfaceVisibility——翻转 180°） */}
      <div style={{position: 'absolute', left: FLIP_CARD.x, top: FLIP_CARD.y, width: FLIP_CARD.w, height: FLIP_CARD.h, perspective: 1500}}>
        <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateY(${rotY}deg)`}}>
          {/* 正面：六字段槽位（取名全亮态——对位锚） */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 14,
              border: `4px solid ${theme.mech}`,
              background: withAlpha(theme.panel, 0.97),
              backfaceVisibility: 'hidden',
              padding: pad,
            }}
          >
            <SixFieldFace w={FLIP_CARD.w - pad * 2} h={FLIP_CARD.h - pad * 2} fieldP={[1, 1, 1, 1, 1, 1]} />
          </div>
          {/* 背面：文件代码形态（字段名:值 行式——行位与正面槽位一一对位） */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 14,
              border: `4px solid ${withAlpha(theme.tool, 0.85)}`,
              background: withAlpha(theme.panel, 0.98),
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              padding: pad,
            }}
          >
            {codeLines.map((ln, i) => {
              const col = i % 2;
              const row = Math.floor(i / 2);
              const lx = col * (cw + pad);
              const ly = headH + row * (ch + pad);
              const isOwner = ln.k === 'owner';
              return (
                <div
                  key={ln.k}
                  style={{
                    position: 'absolute',
                    left: lx,
                    top: ly,
                    width: cw,
                    height: ch,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '0 16px',
                    borderRadius: 8,
                    border: `2px solid ${isOwner && cursor > 0.1 ? withAlpha(theme.tool, 0.7) : withAlpha(theme.panelBorder, 0.7)}`,
                    background: isOwner && cursor > 0.1 ? withAlpha(theme.tool, 0.1) : 'transparent',
                    fontFamily: theme.mono,
                    fontSize: 26,
                    whiteSpace: 'nowrap',
                    opacity: clamp01(progress(frame, atFlip + 20 + i * 2, 8)),
                  }}
                >
                  <span style={{color: theme.dim}}>{`${ln.k}:`}</span>
                  <span style={{color: theme.text}}>{ln.v}</span>
                  {/* 读写光标（扫过 owner 行——程序能读写的活证据） */}
                  {isOwner && cursor > 0.05 && cursor < 0.98 ? (
                    <span style={{position: 'absolute', left: 110 + cursorX * 220, top: 8, bottom: 8, width: 3, background: theme.tool, opacity: 0.9}} />
                  ) : null}
                </div>
              );
            })}
            <div style={{position: 'absolute', left: 0, top: 26, fontFamily: theme.mono, fontSize: 20, color: theme.dim, whiteSpace: 'nowrap'}}>{'.tasks/task_001.json'}</div>
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'.tasks/ · JSON · 程序可读写'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-E 环体侧亮工具池：计数 3→8 + 五卡入池 + 收卡入栏 + 拉回墙面 ──────────

/** 环体上侧位 + 工具池挂面（右侧）；墙缩位（下方——拉回的 morph 起点） */
const RING_1E = {x: 330, y: 70, size: 380} as const;
const POOL = {x: 800, y: 108, w: 820, h: 372} as const;
/** 墙缩小容器：scale 0.52、墙全局几何映到 (632,528) 尺寸 655×343（下半屏心 (960,700)） */
const WALL_MINI = {tx: 460.8, ty: 466, scale: 0.52} as const;
const OLD_TOOLS = ['bash', 'read_file', 'write_file'] as const;
const NEW_TOOLS = [
  {k: '建', name: 'create_task'},
  {k: '列', name: 'list_tasks'},
  {k: '查', name: 'get_task'},
  {k: '领', name: 'claim_task'},
  {k: '结', name: 'complete_task'},
] as const;

const OneE: React.FC<{atCount: number; atNewCards: number[]; atRetract: number; atPull: number}> = ({atCount, atNewCards, atRetract, atPull}) => {
  const frame = useCurrentFrame();
  // 计数条 3→8 阶梯增长（数据本体：Counter 线性值 + 阶梯显示）
  const countP = clamp01(progress(frame, atCount, 46));
  const countN = 3 + Math.min(5, Math.floor(countP * 5.999));
  // 五枚新任务操作卡 stagger 入池（关键词签 建/列/查/领/结——不与既有 3 件混色）
  const newPs = atNewCards.map((a) => clamp01(progress(frame, a, DUR.f4)));
  // 教学演示卡收卡入栏淡出（p1-10 拉回前——教学卡归档不带入走查）
  const retract = clamp01(progress(frame, atRetract, 20));
  // 镜头拉回（显式 zoom 36f：缩小墙放大回全局几何——1-E→2-A morph 的起止态）
  const pullP = clamp01(progress(frame, atPull, 36));
  const o = {x: 960, y: 700};
  const c = {x: 960, y: 450};
  const z = 1 + (1 / WALL_MINI.scale - 1) * pullP;
  const zoomTf = `translate(${(c.x - o.x) * pullP}px, ${(c.y - o.y) * pullP}px) scale(${z})`;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: zoomTf, transformOrigin: `${o.x}px ${o.y}px`}}>
        {/* 环体〔M-001〕同形缩悬上侧（描边/线宽承系列锁定——加挂面不换环） */}
        <div style={{position: 'absolute', left: RING_1E.x, top: RING_1E.y, opacity: 1 - 0.85 * pullP}}>
          <LoopRing size={RING_1E.size} nodes={[]} showExit={false} dotProgress={(frame / 84) % 1} />
        </div>
        {/* 环→挂面连线（挂面挂在环侧——机制逐层加挂） */}
        <svg width={60} height={8} viewBox="0 0 60 8" style={{position: 'absolute', left: RING_1E.x + RING_1E.size - 4, top: RING_1E.y + RING_1E.size / 2 - 4, opacity: (1 - 0.85 * pullP) * 0.8}}>
          <line x1={0} y1={4} x2={60} y2={4} stroke={theme.core} strokeWidth={3} strokeDasharray="7 6" />
        </svg>
        {/* 工具池挂面（计数条 + 8 卡位） */}
        <div style={{position: 'absolute', left: POOL.x, top: POOL.y, width: POOL.w, height: POOL.h, opacity: 1 - 0.9 * pullP}}>
          <div style={{position: 'absolute', inset: 0, borderRadius: 14, border: `3px solid ${withAlpha(theme.core, 0.65)}`, background: withAlpha(theme.panel, 0.95), padding: '20px 28px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 2, whiteSpace: 'nowrap'}}>{'工具池 · TOOLS'}</div>
            {/* 计数条（3 基线刻度恒驻 → 填充至 8；双刻度基线锚定） */}
            <div style={{marginTop: 18, width: POOL.w - 56}}>
              <div style={{position: 'relative', height: 34, borderRadius: 7, border: `2.5px solid ${withAlpha(theme.core, 0.55)}`, background: withAlpha(theme.panel, 0.9)}}>
                <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: '37.5%', background: withAlpha(theme.core, 0.3)}} />
                <div style={{position: 'absolute', left: `${37.5 + 62.5 * countP}%`, top: 0, bottom: 0, width: 4, background: theme.core, opacity: countP > 0.02 ? 0.95 : 0}} />
                <div style={{position: 'absolute', right: 4, top: -7, bottom: -7, borderRight: `3px dashed ${withAlpha(theme.dim, 0.8)}`}} />
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 6, whiteSpace: 'nowrap'}}>
                <span>{'基线 3'}</span>
                <span style={{fontSize: 26, fontWeight: 700, color: countN >= 8 ? theme.core : theme.text, fontVariantNumeric: 'tabular-nums'}}>{countN}</span>
                <span>{'8'}</span>
              </div>
            </div>
            {/* 卡位两行：既有 3 件（灰 dim——旧工具）+ 新添 5 枚（mech——任务操作） */}
            <div style={{position: 'absolute', left: 28, right: 28, top: 186, display: 'flex', gap: 14}}>
              {OLD_TOOLS.map((t) => (
                <div
                  key={t}
                  style={{
                    flex: 1,
                    height: 66,
                    borderRadius: 9,
                    border: `2.5px solid ${withAlpha(theme.dim, 0.55)}`,
                    background: withAlpha(theme.panel, 0.9),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: theme.mono,
                    fontSize: 17,
                    color: theme.dim,
                    whiteSpace: 'nowrap',
                    opacity: 0.8,
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
            <div style={{position: 'absolute', left: 28, right: 28, top: 268, display: 'flex', gap: 14}}>
              {NEW_TOOLS.map((t, i) => {
                const p = newPs[i];
                return (
                  <div
                    key={t.k}
                    style={{
                      flex: 1,
                      height: 72,
                      borderRadius: 9,
                      border: `2.5px solid ${p > 0.35 ? withAlpha(theme.mech, 0.85) : withAlpha(theme.panelBorder, 0.8)}`,
                      background: p > 0.35 ? withAlpha(theme.mech, 0.14) : 'transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      opacity: p,
                      transform: `translateY(${(1 - p) * 16}px)`,
                      boxShadow: p > 0.9 ? `0 0 12px ${withAlpha(theme.mech, 0.35)}` : 'none',
                    }}
                  >
                    <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: p > 0.35 ? theme.mech : theme.dim, whiteSpace: 'nowrap'}}>{t.k}</span>
                    <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap'}}>{t.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {/* 任务墙（下方缩小位——拉回的 morph 起点；1-E 前段挂 slot0 教学演示卡） */}
        <div style={{position: 'absolute', left: WALL_MINI.tx, top: WALL_MINI.ty, transform: `scale(${WALL_MINI.scale})`, transformOrigin: '0 0'}}>
          <TaskWall litP={1} slotsP={1} glowP={0.4} />
          {/* 教学演示卡（凝实态→收卡入栏淡出：缩小滑向墙右上「归档」栏签） */}
          <div
            style={{
              position: 'absolute',
              left: WALL_SLOTS[0].x,
              top: WALL_SLOTS[0].y,
              width: SLOT_W,
              height: SLOT_H,
              opacity: 1 - retract,
              transform: `translate(${retract * (WALL.w - SLOT_W - WALL_SLOTS[0].x + 60)}px, ${retract * -160}px) scale(${1 - 0.6 * retract})`,
            }}
          >
            <WallCard x={0} y={0} title="写初稿" id="task_001" state="pending" litP={1} solidP={1} />
          </div>
          {/* 归档栏签（教学卡去向显式登记——不带入走查） */}
          {retract > 0.2 ? (
            <div
              style={{
                position: 'absolute',
                left: WALL.w - 190,
                top: 40,
                padding: '5px 16px',
                borderRadius: 8,
                border: `2.5px dashed ${withAlpha(theme.dim, 0.7)}`,
                fontFamily: theme.mono,
                fontSize: 16,
                color: theme.dim,
                whiteSpace: 'nowrap',
                opacity: clamp01(progress(frame, atRetract + 4, DUR.f4)) * (1 - pullP), // ⑨ QA W3：随拉回淡出——防幕界硬消失（f3557→f3582 亮像素骤归零）
              }}
            >
              {'教学卡 · 归档'}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7 * (1 - pullP)}}>
        {'TOOLS 3→8 · 建列查领结'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P1CardSixFields: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p1-01', 'p1-02');
  const bB = w('p1-03', 'p1-04');
  const bC = w('p1-05', 'p1-07');
  const bD = w('p1-08');
  const bE = w('p1-09', 'p1-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <OneA
          atZoom={wa('p1-01', 0.08) - bA.from}
          atTag={wa('p1-01', 0.55) - bA.from}
          atFields={[0.16, 0.24, 0.31, 0.39, 0.46, 0.6].map((f) => wa('p1-02', f) - bA.from)}
          atDepsMini={wa('p1-02', 0.82) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <OneB
          atSegs={[0.44, 0.62, 0.81].map((f) => wa('p1-03', f) - bB.from)}
          atClaim={wa('p1-04', 0.3) - bB.from}
          atSign={wa('p1-04', 0.55) - bB.from}
          atDone={wa('p1-04', 0.7) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <OneC
          atGate={wa('p1-05', 0.24) - bC.from}
          atPass={wa('p1-05', 0.72) - bC.from}
          atGray={wa('p1-06', 0.3) - bC.from}
          atLeftBar={wa('p1-06', 0.42) - bC.from} // ⑨ QA W4：0.55→0.42 对齐「有一个没完成」词窗（防句中点定格帧绿灯+「不许开工」字幕反读）
          atGhostChip={wa('p1-07', 0.2) - bC.from}
          atRightBar={wa('p1-07', 0.4) - bC.from}
          atErr={wa('p1-07', 0.7) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="1-D">
        <OneD atFlip={wa('p1-08', 0.22) - bD.from} atCursor={wa('p1-08', 0.5) - bD.from} atFlicker={wa('p1-08', 0.72) - bD.from} />
      </Sequence>
      <Sequence {...bE} name="1-E">
        <OneE
          atCount={wa('p1-09', 0.28) - bE.from}
          atNewCards={[0.5, 0.56, 0.62, 0.68, 0.74].map((f) => wa('p1-09', f) - bE.from)}
          atRetract={wa('p1-10', 0.15) - bE.from}
          atPull={wa('p1-10', 0.42) - bE.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1CardSixFields;
