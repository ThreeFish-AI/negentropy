/** P1 一个不干活的工具（p1-01..p1-12，4 镜）——分镜 1-A / 1-B / 1-C / 1-D。
 *
 *  叙事链：1-A 三通道框架图（全景坐标锚）——模型脑图标居左、三卡横列（身份
 *  规则·对话记录〔承 0-C morph 落位、尾段亮带在位〕·工具清单），规划蓝清单卡
 *  悬于对话记录卡上方待落→「摆进对话记录」清单卡落入化作卡内一条可见行、随
 *  滚动恒驻尾段亮带（可见区语义回扣 0-C；解法动作一步演完）→ 1-B 清单卡特写
 *  @pushIn：三态图例三样点逐个点火 + 首行骨架跟演一轮态流转（空心→高亮→打勾
 *  →回空心）、「存进内存」清单卡沉入内存槽、模型脑图标渐隐（归属地移交）→
 *  1-C 零执行反差 + 工程账：文件/命令两虚位轮廓各闪一次空置确认（虚位空置即
 *  陈述〔M-003〕）、「规划能力」清单卡泛规划蓝辉光一拍（重音镜）、「两处改动」
 *  对照表增行（琥珀双列签名承 ep2）+ 定义卡贴上 + ①②计数签 + 标尺 5→6、
 *  「一行没改」环体整环静止一拍（调用前挂点微光首现）→ 1-D 计数器特写（后
 *  一半点亮）：清零/加一双条件各演一拍、「数到三」紫色脉冲爆发（重音镜）+
 *  「调用前」挂点闪亮 + 提醒条插进对话流尾部、「插完清零」接着数、「两半
 *  拼齐」前后两半装置缩略同框（装置全貌唯一全亮时刻——P2 走查预锚）。
 *
 *  空间契约：三卡等大横列、清单行落位后驻尾段亮带、清单卡恒规划蓝；虚位轮廓
 *  恒空置、对照表增行承前集同构（5→6 行）、环体描边色/线宽承系列锁定值且除
 *  调用前挂点微光外零变化、标尺不越 6；刻度四格与读数一致（0–3）、指针永不
 *  越 3、提醒条插对话流尾部、清单卡微缩影与 1-B 同款。
 *
 *  红线落实：词落位 = wa(id,f)；morph 起止态保身份线索两项（单柱轮廓+尾段
 *  亮带）；y≥56 / bottom≥168；todo_write 等方法名只进角标。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  BrainGlyph,
  DispatchTableMini,
  GrowthRuler,
  LoopRing,
  MsgBar,
  NagCounter,
  RingPoint,
  TodoListCard,
  TodoLegend,
  ringPt,
} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 1-A 三通道框架图（0-C morph 落位 + 清单卡落入） ─────────────────────

/** 对话记录卡（承 0-C 对话流柱 morph——单柱轮廓 + 尾段亮带两项身份线索在位） */
const RecordCard: React.FC<{x: number; y: number; w: number; h: number; lit: number; bandLit: number; rowLit: number; rolling: number}> = ({
  x,
  y,
  w,
  h,
  lit,
  bandLit,
  rowLit,
  rolling,
}) => {
  // 卡内消息条（滚动条语义：条目随 rolling 滚动、亮带恒驻尾段）
  const bars = ['改文件', '跑测试', '修测试', '再修', '又修'];
  const rowH = (h - 96) / 5;
  const rowY = 96 + rowH * 4 - rowH * 4 * 0; // 底行锚（滚动由容器平移承载）
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: 0.35 + 0.65 * clamp01(lit)}}>
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: 14,
          border: `2.5px solid ${clamp01(lit) > 0.4 ? withAlpha(theme.text, 0.7) : theme.panelBorder}`,
          background: theme.panel,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{padding: '14px 18px', fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{'messages'}</div>
        {/* 消息条竖排（滚动：容器 translateY 随 rolling、亮带窗恒驻尾段） */}
        <div style={{position: 'absolute', left: 16, right: 16, top: 52, bottom: 14, overflow: 'hidden'}}>
          <div style={{transform: `translateY(${-clamp01(rolling) * (rowH - 8)}px)`}}>
            {bars.map((b, i) => (
              <div key={b} style={{height: rowH, display: 'flex', alignItems: 'center'}}>
                <div
                  style={{
                    width: '100%',
                    height: rowH - 12,
                    borderRadius: 7,
                    border: `2px solid ${withAlpha(theme.tool, 0.55)}`,
                    background: withAlpha(theme.tool, 0.08),
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 12,
                    fontFamily: theme.sans,
                    fontSize: 18,
                    color: theme.dim,
                  }}
                >
                  {b}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* 尾段亮带（0-C 可见区语义回扣——窗内亮带恒驻卡面尾段） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: rowY - 52 + rowH,
            borderTop: `3px solid ${withAlpha(theme.text, 0.8)}`,
            background: withAlpha(theme.text, 0.05),
            opacity: clamp01(bandLit),
          }}
        />
        {/* 清单快照行（落入的规划蓝行——恒驻亮带内 = 每轮都看得见） */}
        {rowLit > 0.01 ? (
          <div
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 18,
              opacity: clamp01(rowLit),
            }}
          >
            <div
              style={{
                height: 44,
                borderRadius: 8,
                border: `2.5px solid ${theme.mech}`,
                background: withAlpha(theme.mech, 0.14),
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 12px',
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 600, color: theme.text}}>{'待办清单'}</span>
              <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'todo_write'}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const OneA: React.FC<{atMorph: number; atCard1: number; atCard2: number; atCard3: number; atDrop: number; atRoll: number}> = ({
  atMorph,
  atCard1,
  atCard2,
  atCard3,
  atDrop,
  atRoll,
}) => {
  const frame = useCurrentFrame();
  // 0-C→1-A morph：对话流柱（满幅）缩为三卡横列中的「对话记录」卡——位移中
  // 柱内条目排布/灰化分布逐帧不变，仅尺度变化（身份线索：单柱轮廓+尾段亮带）
  const morph = useProgress(atMorph, DUR.f6, 'decelerate');
  // 三卡依次亮起（stagger——「就这三样」；禁三卡一次全亮）
  const cards = [
    clamp01(progress(frame, atCard1, DUR.f4)),
    clamp01(progress(frame, atCard2, DUR.f4)),
    clamp01(progress(frame, atCard3, DUR.f4)),
  ];
  // 清单卡落入（「摆进对话记录」——解法动作一步演完）
  const drop = useProgress(atDrop, DUR.f5, 'decelerate');
  // 「每轮都看得见」：清单行随滚动条滚动恒驻尾段亮带
  const rolling = useProgress(atRoll, DUR.f6);
  const CARD_W = 430;
  const CARD_H = 420;
  const CARD_Y = 430;
  const colX = [250, 250 + CARD_W + 40, 250 + 2 * (CARD_W + 40)];
  // morph 源几何（0-C 末帧对话流柱满幅位）与目标（中卡位）
  const srcW = 680;
  const dstX = colX[1];
  const recW = CARD_W + (srcW - CARD_W) * (1 - morph);
  const recH = CARD_H + (640 - CARD_H) * (1 - morph);
  const recY = CARD_Y - (CARD_Y - 190) * (1 - morph);
  // ⑨ QA N1：morph 源（=0-C 视窗几何 x620/w680）与目标卡槽逐帧插值——
  // 起帧逐像素对齐 0-C 末帧（身份线索不断档）；尾段亮带恒亮（bandLit 不随
  // morph 淡出——亮带是对话记录卡的固有语义面）
  const recX = (620 - dstX) * (1 - morph);
  return (
    <AbsoluteFill>
      {/* 模型脑图标居左 */}
      <BrainGlyph cx={150} cy={560} size={150} lit={0.9} />
      {/* 三卡横列（等大；中卡 = morph 承接对话记录卡） */}
      {[
        {x: colX[0], lit: cards[0], name: '身份规则', en: 'system', kind: 'text' as const},
        {x: dstX, lit: Math.max(cards[1], 0.25), name: '对话记录', en: 'messages', kind: 'record' as const},
        {x: colX[2], lit: cards[2], name: '工具清单', en: 'tools', kind: 'table' as const},
      ].map((c) => (
        <div key={c.en} style={{position: 'absolute', left: c.x, top: CARD_Y, width: CARD_W, height: CARD_H}}>
          {c.kind === 'record' ? (
            <RecordCard x={recX} y={recY - CARD_Y} w={recW} h={recH} lit={c.lit} bandLit={1} rowLit={drop} rolling={rolling} />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                borderRadius: 14,
                border: `2.5px solid ${c.lit > 0.4 ? withAlpha(theme.text, 0.7) : theme.panelBorder}`,
                background: theme.panel,
                padding: '16px 20px',
                opacity: 0.35 + 0.65 * c.lit,
              }}
            >
              <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
                <span style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 700, color: theme.text}}>{c.name}</span>
                <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{c.en}</span>
              </div>
              {c.kind === 'text' ? (
                <div style={{marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10}}>
                  {[72, 52, 64].map((wd, i) => (
                    <div key={i} style={{height: 10, width: `${wd}%`, borderRadius: 5, background: withAlpha(theme.dim, 0.3)}} />
                  ))}
                  <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 6}}>{'固定文本块'}</span>
                </div>
              ) : (
                <div style={{marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10}}>
                  {['跑命令', '读文件', '写文件', '改文件', '找文件', '…'].map((t) => (
                    <div
                      key={t}
                      style={{
                        height: 52,
                        borderRadius: 8,
                        border: `2px solid ${theme.panelBorder}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: theme.sans,
                        fontSize: 19,
                        color: theme.dim,
                      }}
                    >
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {/* 规划蓝清单卡（悬于对话记录卡上方待落 → 落入化作卡内可见行） */}
      <div
        style={{
          position: 'absolute',
          left: dstX + (recW - 430) / 2,
          top: recY - 130 + 100 * clamp01(drop),
          opacity: 1 - 0.92 * clamp01(drop),
          transform: `scale(${1 - 0.62 * clamp01(drop)})`,
          transformOrigin: 'center bottom',
        }}
      >
        <TodoListCard x={0} y={0} w={430} rowStates={['todo', 'todo', 'todo']} rowLit={[0.8, 0.4, 0.15]} showTag={1} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.8}}>
        {'模型每轮看到的三样 · 上下文通道'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 清单卡特写：三态图例建锚 + 内存槽 ──────────────────────────────

const OneB: React.FC<{atPush: number; atHalf: number; atLegend: number; atDemo: number; atSink: number}> = ({
  atPush,
  atHalf,
  atLegend,
  atDemo,
  atSink,
}) => {
  const frame = useCurrentFrame();
  // @pushIn：p1-03 急推本集主角清单卡（planning §三 P1 行程）
  const zoom = usePushIn(atPush, {scale: 0.07});
  // 「前一半」装置左半区点亮（右半区预暗留位——「装置分两半」的空间占位）
  const halfLit = useProgress(atHalf, DUR.f5);
  // 「三态」图例三样点逐个点火（禁一次全亮）
  const dots = [
    clamp01(progress(frame, atLegend, DUR.f3)),
    clamp01(progress(frame, atLegend + 7, DUR.f3)),
    clamp01(progress(frame, atLegend + 14, DUR.f3)),
  ];
  // 首行骨架跟演一轮态流转：空心→高亮→打勾→回空心（图例演示语义，不预写任务）
  const demo = clamp01(progress(frame, atDemo, DUR.f6));
  const phase = demo < 0.3 ? 'todo' : demo < 0.62 ? 'active' : demo < 0.9 ? 'done' : 'todo';
  const demoRowLit = clamp01(progress(frame, atDemo - DUR.f3, DUR.f4));
  // 「存进内存」：清单卡沉入内存槽、模型脑图标渐隐（归属地移交）
  const sink = useProgress(atSink, DUR.f6, 'decelerate');
  const brainFade = useProgress(atSink + DUR.f3, DUR.f5);
  const demoStates: ('empty' | typeof phase)[] = phase === 'todo' && demo < 0.05 ? ['empty', 'empty', 'empty'] : [phase, 'empty', 'empty'];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: zoom}}>
        {/* 模型脑图标（卡上方——「存进内存」时渐隐：计划从脑子搬进程序） */}
        <BrainGlyph cx={960} cy={220} size={140} lit={0.9 * (1 - brainFade)} />
        {/* 右半区预暗留位（1-D 计数器位——「装置分两半」的空间占位） */}
        <div
          style={{
            position: 'absolute',
            left: 1330,
            top: 330,
            width: 500,
            height: 460,
            borderRadius: 18,
            border: `2.5px dashed ${withAlpha(theme.nag, 0.35)}`,
            background: withAlpha(theme.nag, 0.03),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 1 - halfLit * 0.35,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 15, color: withAlpha(theme.nag, 0.55)}}>{'后一半 · 待亮'}</span>
        </div>
        {/* 清单卡满幅立起（三行空骨架 + 首行跟演态流转；沉入内存槽位移） */}
        <TodoListCard
          x={450}
          y={330}
          w={520}
          rowStates={demoStates}
          rowLit={[Math.max(0.9, demoRowLit), 0.35, 0.35]}
          sink={sink}
          showTag={1}
        />
        {/* 侧边三态图例（与行状态一一对应） */}
        <TodoLegend x={1030} y={420} dots={dots} />
        {/* 内存槽（卡下——「存进内存」清单卡沉入的归属地） */}
        <div
          style={{
            position: 'absolute',
            left: 430,
            top: 700,
            width: 560,
            height: 84,
            boxSizing: 'border-box',
            borderRadius: 12,
            border: `2.5px solid ${withAlpha(theme.dim, 0.5 + 0.4 * sink)}`,
            background: withAlpha(theme.panel, 0.6),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{'memory'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, opacity: sink}}>{'程序内存 · 归属地'}</span>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.85}}>
        {'三态：pending / in_progress / completed'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 零执行反差 + 工程账回扣（5→6 标尺 + 环体「循环不改」） ─────────

const OneC: React.FC<{atVoidF: number; atVoidC: number; atGlow: number; atRow: number; atCounts: number; atStill: number; atRuler: number}> = ({
  atVoidF,
  atVoidC,
  atGlow,
  atRow,
  atCounts,
  atStill,
  atRuler,
}) => {
  const frame = useCurrentFrame();
  // 两虚位轮廓各闪一次空置确认（读不了文件、跑不了命令——虚位空置即陈述〔M-003〕）
  const voidF = useImpulse({at: atVoidF, dur: DUR.f5, peak: 1});
  const voidC = useImpulse({at: atVoidC, dur: DUR.f5, peak: 1});
  // 「规划能力」重音镜：清单卡整体泛规划蓝辉光一拍
  const glow = useProgress(atGlow, DUR.f5);
  // 对照表新行滑入 + 定义卡贴上 + ①②计数签
  const newRow = useProgress(atRow, DUR.f5, 'decelerate');
  const fuse = useImpulse({at: atRow + DUR.f4, dur: DUR.f5, peak: 0.9});
  const defCard = useProgress(atRow + DUR.f4, DUR.f4);
  const counts = [clamp01(progress(frame, atCounts, DUR.f3)), clamp01(progress(frame, atCounts + 6, DUR.f3))];
  // 「一行没改」：环体整环静止一拍（静止即陈述；调用前挂点微光首现）
  const ringLit = useProgress(atStill - DUR.f4, DUR.f4);
  const still = frame >= atStill;
  const dot = still ? 0.32 : ((frame / (30 * 3.2)) % 1 + 1) % 1;
  const RING = {cx: 1660, cy: 620, size: 300} as const;
  const rr = RING.size / 2 - 46;
  // 标尺 5→6 增长定格
  const six = useProgress(atRuler, DUR.f4);
  return (
    <AbsoluteFill>
      {/* ── 上半：零执行能力反差帧（清单卡两侧虚位空置） ── */}
      <div style={{position: 'absolute', left: 120, top: 96, fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>
        {'这个工具什么都不干'}
      </div>
      <TodoListCard x={740} y={130} w={430} rowStates={['todo', 'todo', 'todo']} rowLit={[0.75, 0.4, 0.4]} glow={glow} scale={0.92} />
      {/* 文件图标虚位（左侧空置轮廓） */}
      {[
        {x: 460, label: '读文件', flash: voidF},
        {x: 1130, label: '跑命令', flash: voidC},
      ].map((v) => (
        <div key={v.label} style={{position: 'absolute', left: v.x, top: 240}}>
          <svg width={130} height={110} viewBox="0 0 130 110" style={{opacity: 0.55 + 0.45 * v.flash}}>
            <path
              d="M 28 12 L 84 12 L 104 32 L 104 96 L 28 96 Z"
              fill="none"
              stroke={theme.panelBorder}
              strokeWidth={3}
              strokeDasharray="8 7"
            />
            {v.flash > 0.4 ? (
              <text x={65} y={62} textAnchor="middle" fontFamily={theme.mono} fontSize={16} fill={theme.dim}>
                {'∅'}
              </text>
            ) : null}
          </svg>
          <div style={{textAlign: 'center', fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 8}}>{v.label}</div>
          <div style={{textAlign: 'center', fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'no access'}</div>
        </div>
      ))}
      {/* ── 下半：工程账（对照表增行 + 环体缩悬表侧「循环不改」）。⑨ QA
          RISKY-2 配套：表 scale 0.92（底 874）让位单行标尺（y884 起），
          两件垂直分离不再叠印。 */}
      <DispatchTableMini x={140} y={470} w={560} scale={0.92} newIn={newRow} fuse={fuse} counterLit={newRow} />
      {/* 定义卡（贴上对照表侧——①定义） */}
      <div style={{position: 'absolute', left: 730, top: 500, opacity: defCard}}>
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 10,
            border: `2.5px solid ${withAlpha(theme.dim, 0.7)}`,
            background: theme.panel,
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.text,
            whiteSpace: 'nowrap',
          }}
        >
          {'todo_write 定义卡'}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim, marginTop: 6}}>{'① 一条定义'}</div>
      </div>
      {/* ②注册（计数签位） */}
      <div style={{position: 'absolute', left: 730, top: 610, opacity: counts[1]}}>
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 10,
            border: `2.5px solid ${withAlpha(theme.dim, 0.7)}`,
            background: theme.panel,
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.text,
            whiteSpace: 'nowrap',
          }}
        >
          {'TOOL_HANDLERS 注册'}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim, marginTop: 6}}>{'② 一行注册'}</div>
      </div>
      {/* ①② 计数签（角标式点亮） */}
      <div style={{position: 'absolute', left: 140, top: 470, opacity: 0.9}}>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 20,
            fontWeight: 700,
            color: counts[0] > 0.5 ? theme.ok : theme.panelBorder,
            border: `2.5px solid ${counts[0] > 0.5 ? theme.ok : theme.panelBorder}`,
            borderRadius: 999,
            padding: '2px 12px',
            marginRight: 12,
          }}
        >
          {'①'}
        </span>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 20,
            fontWeight: 700,
            color: counts[1] > 0.5 ? theme.ok : theme.panelBorder,
            border: `2.5px solid ${counts[1] > 0.5 ? theme.ok : theme.panelBorder}`,
            borderRadius: 999,
            padding: '2px 12px',
          }}
        >
          {'②'}
        </span>
      </div>
      {/* 环体（M-001 缩悬表侧——「循环不改」旁注；整环静止一拍 + 调用前挂点微光首现） */}
      <div style={{position: 'absolute', left: RING.cx - RING.size / 2, top: RING.cy - RING.size / 2, opacity: 0.4 + 0.5 * ringLit}}>
        <LoopRing size={RING.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      <RingPoint cx={ringPt(RING.cx, RING.cy, rr, 25).x} cy={ringPt(RING.cx, RING.cy, rr, 25).y} r={10} lit={0.45} />
      <div style={{position: 'absolute', left: RING.cx - 130, top: RING.cy + 165, width: 260, textAlign: 'center', fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
        {'循环 · 一行没改'}
      </div>
      {/* 环体 +0 标注（两处改动计数签位的第三位） */}
      <div style={{position: 'absolute', left: 1530, top: 470, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
        {'环体 +0'}
      </div>
      {/* 底部工具数 5→6 增长条标尺（基线恒常驻；定格不越 6）。⑨ QA RISKY-2：
          单行装置收口 y884-914，全件在字幕安全带 920 之上（读数行不再下沉） */}
      <GrowthRuler x={140} y={884} w={560} six={six} lit={1} />
    </AbsoluteFill>
  );
};

// ── 1-D 计数器特写（后一半点亮：清零/加一 → 数到三注入 → 两半拼齐） ────

const OneD: React.FC<{
  atCount: number;
  atWatch: number;
  atReset: number;
  atPlus: number;
  atThree: number;
  atPulse: number;
  atHook: number;
  atInject: number;
  atClear: number;
  atAgain: number;
  atMerge: number;
}> = ({atCount, atWatch, atReset, atPlus, atThree, atPulse, atHook, atInject, atClear, atAgain, atMerge}) => {
  const frame = useCurrentFrame();
  // 刻度盘亮起（「后一半」——1-B 预暗右半区至此点亮）
  const countLit = useProgress(atCount, DUR.f5);
  const watch = useProgress(atWatch, DUR.f4);
  // p1-10 双条件各演一拍：清零（调用签落入感测位、指针弹回 0）→ 加一（缺席位闪、+1 步进）
  const signDrop = useProgress(atReset, DUR.f4, 'decelerate');
  const resetFlash = useImpulse({at: atReset + DUR.f3, dur: DUR.f4, peak: 1});
  const absentFlash = useImpulse({at: atPlus, dur: DUR.f4, peak: 1});
  const plus1 = useProgress(atPlus + DUR.f3, DUR.f3);
  // p1-11 数到三：指针步进至 3、紫色脉冲爆发（重音镜）+ 挂点闪亮 + 提醒条插入
  const step23 = [clamp01(progress(frame, atThree, DUR.f4)), clamp01(progress(frame, atThree + DUR.f4, DUR.f4))];
  const count = 0 + plus1 + step23[0] + step23[1];
  const pulse = useImpulse({at: atPulse, dur: DUR.f5, peak: 1});
  const hookPulse = useImpulse({at: atHook, dur: DUR.f6, peak: 1});
  const inject = useProgress(atInject, DUR.f4, 'decelerate');
  // p1-12 插完清零、接着数、两半拼齐（缩略同框一拍——装置全貌唯一全亮时刻）
  const after = useProgress(atClear, DUR.f3);
  const again = useProgress(atAgain, DUR.f3);
  const merge = useProgress(atMerge, DUR.f5, 'decelerate');
  // 读数状态机（连续降档 QA-11：清零后归 0，再 +1——max(底线, 进度) 逐段钳制）
  const reading = merge > 0.5 ? Math.min(1, again) : Math.max(count * (1 - after), 0) + (after > 0.5 ? again : 0);
  const RING = {cx: 1660, cy: 560, size: 280} as const;
  const rr = RING.size / 2 - 46;
  // 两半合位几何（1-D 装置位移至左、清单卡缩略自左合位）
  const cntX = 900 - 220 * merge;
  const cntScale = 1 - 0.45 * merge;
  return (
    <AbsoluteFill>
      {/* 清单卡缩略（前一半——1-B 同款微缩；「两半拼齐」自左侧合位一拍） */}
      <div style={{position: 'absolute', left: 240 - 80 * merge, top: 380, transform: `scale(${0.62 + 0.1 * merge})`, transformOrigin: 'left top', opacity: 0.35 + 0.65 * merge}}>
        <TodoListCard x={0} y={0} w={430} rowStates={['todo', 'todo', 'todo']} rowLit={[0.7, 0.4, 0.4]} showTag={1} />
      </div>
      {/* 计数器（后一半——1-B 预暗位至此点亮；主景） */}
      <NagCounter x={cntX} y={380} w={430} count={reading} pulse={pulse} resetFlash={resetFlash} watch={watch} lit={countLit} scale={cntScale} />
      {/* 感测位：待办调用小签（落入→清零；缺席→加一） */}
      <div
        style={{
          position: 'absolute',
          left: cntX + 330,
          top: 306 - 40 * (1 - signDrop),
          opacity: signDrop * (1 - 0.5 * after),
        }}
      >
        <div
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: `2px solid ${theme.mech}`,
            background: withAlpha(theme.mech, 0.14),
            fontFamily: theme.mono,
            fontSize: 14,
            color: theme.text,
            whiteSpace: 'nowrap',
            boxShadow: absentFlash > 0.3 ? 'none' : 'none',
          }}
        >
          {'todo 调用'}
        </div>
      </div>
      {/* 缺席位闪（加一——虚位轮廓闪一下） */}
      {absentFlash > 0.05 ? (
        <div
          style={{
            position: 'absolute',
            left: cntX + 330,
            top: 262,
            width: 108,
            height: 40,
            borderRadius: 8,
            border: `2px dashed ${withAlpha(theme.dim, 0.5 + 0.5 * absentFlash)}`,
            opacity: absentFlash,
          }}
        />
      ) : null}
      {/* 盘旁对话流尾部（提醒条插入位——1-D 专设；角标 reminder 防逐字重合） */}
      <div style={{position: 'absolute', left: 240, top: 700, opacity: countLit}}>
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginBottom: 10}}>{'对话流尾部'}</div>
        <MsgBar x={0} y={0} w={560} label={'…工具结果'} sub={'latest'} color={theme.tool} lit={countLit} />
        <div style={{position: 'absolute', left: 0, top: 66, opacity: inject}}>
          <MsgBar x={0} y={0} w={560} h={56} label={'更新你的待办'} sub={'reminder'} color={theme.nag} lit={inject} flash={pulse} />
        </div>
      </div>
      {/* 环体缩悬远角（挂点待命——「下轮调用前」注入时点闪亮为证） */}
      <div style={{position: 'absolute', left: RING.cx - RING.size / 2, top: RING.cy - RING.size / 2, opacity: 0.55}}>
        <LoopRing size={RING.size} nodes={[]} showExit={false} />
      </div>
      <RingPoint cx={ringPt(RING.cx, RING.cy, rr, 25).x} cy={ringPt(RING.cx, RING.cy, rr, 25).y} r={11} lit={0.45 + 0.55 * hookPulse} pulse={hookPulse} />
      <div style={{position: 'absolute', left: RING.cx - 150, top: RING.cy + 160, width: 300, textAlign: 'center', fontFamily: theme.sans, fontSize: 18, color: theme.dim}}>
        {'调用前 · 下轮注入位'}
      </div>
      {/* 「两半拼齐」合位闪框（装置全貌唯一全亮时刻——P2 走查预锚） */}
      {merge > 0.5 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <rect
            x={150}
            y={330}
            width={1300}
            height={330}
            rx={18}
            fill="none"
            stroke={theme.nag}
            strokeWidth={3.5}
            opacity={0.7 * (merge - 0.5) * 2}
            strokeDasharray="16 12"
          />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P1IdleTool: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p1-01', 'p1-02');
  const bB = w('p1-03', 'p1-05');
  const bC = w('p1-06', 'p1-08');
  const bD = w('p1-09', 'p1-12');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <OneA
          atMorph={0}
          atCard1={wa('p1-01', 0.42) - bA.from}
          atCard2={wa('p1-01', 0.6) - bA.from}
          atCard3={wa('p1-01', 0.78) - bA.from}
          atDrop={wa('p1-02', 0.18) - bA.from}
          atRoll={wa('p1-02', 0.62) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <OneB
          atPush={wa('p1-03', 0.05) - bB.from}
          atHalf={wa('p1-03', 0.5) - bB.from}
          atLegend={wa('p1-04', 0.24) - bB.from}
          atDemo={wa('p1-04', 0.4) - bB.from}
          atSink={wa('p1-05', 0.32) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <OneC
          atVoidF={wa('p1-06', 0.36) - bC.from}
          atVoidC={wa('p1-06', 0.66) - bC.from}
          atGlow={wa('p1-07', 0.4) - bC.from}
          atRow={wa('p1-08', 0.2) - bC.from}
          atCounts={wa('p1-08', 0.42) - bC.from}
          atStill={wa('p1-08', 0.82) - bC.from}
          atRuler={wa('p1-08', 0.55) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="1-D">
        <OneD
          atCount={wa('p1-09', 0.1) - bD.from}
          atWatch={wa('p1-09', 0.5) - bD.from}
          atReset={wa('p1-10', 0.1) - bD.from}
          atPlus={wa('p1-10', 0.62) - bD.from}
          atThree={wa('p1-11', 0.08) - bD.from}
          atPulse={wa('p1-11', 0.3) - bD.from}
          atHook={wa('p1-11', 0.48) - bD.from}
          atInject={wa('p1-11', 0.72) - bD.from}
          atClear={wa('p1-12', 0.06) - bD.from}
          atAgain={wa('p1-12', 0.36) - bD.from}
          atMerge={wa('p1-12', 0.7) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1IdleTool;
