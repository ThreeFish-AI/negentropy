/** P3 读过的才能收（p3-01..p3-10，3 镜）——分镜 3-A / 3-B / 3-C。
 *
 *  叙事链：3-A 开帧双平面全景一拍 → @pushIn 推至蓝面消息时间轴特写：「不按
 *  时间算」轴端时间刻度划掉、改挂「读没读过」小签（判定换轴的可视）〔M-005〕、
 *  「最反直觉」整轴轻晃一拍；「最近一次回复」位标落定、分界灯亮起、「一律
 *  不动」分界后结果块罩上蓝保护罩；「读过」分界前块紫框亮、「没读过」蓝罩
 *  加锁小闪、「信息从未到达」未读块与模型侧视野圈之间断线一拍 → 3-B 类比
 *  一拍（「已付款·未到货」单据卡三拍：付款→货位空空→第二张单据浮起+模型端
 *  问号；「一次性」小签、「补货=重跑/再付」双小签并列）；随即切回机制画面：
 *  蓝保护罩揭走 → 同款调用块再入列一次（与首轮块同形同位——原样的可核对
 *  判据）→ 计费小卡连闪两道划扣（重音镜）→ 3-C 全链走查（Animated Worked
 *  Example + 数字镜）：「连未读都超限」水位再破线一拍（fit 兜底工况）、未读
 *  超大块沿蓝→紫箭头落盘换预览加路径；「五条已读、三条未读，一条超大」八块
 *  列阵分色亮出；「折叠两条、保留三条、豁免两条、预览一条」各词组落位对应
 *  批次处置（占位条 ×2 / 绿框 ×3 / 罩定 ×2 / 预览签 ×1）；「六万三」计数亮
 *  63,000、「压到一万六」计数回滚定格 ≈16,155（B.2 复算精确值旁标，1–2s 重音
 *  镜，数据本体禁过冲）；紫面同步变厚（蓝面变薄联动）；「一步调用都没花」
 *  计费小卡保持 0 定格放大一拍（零调用总账——与 P4 唯一付费对照基线）
 *  〔M-003〕、「最贵的那步压轴」阶梯缩影第四格预亮一拍（P4 钩子）。
 *
 *  空间契约：分界灯为唯一竖向分隔、已读紫/未读蓝双色语义自此定立、保护罩不
 *  罩已读块、时间刻度不参与判定（逆旁白）；类比单据卡一拍即收（不常驻剧场
 *  化）、重调块与首轮块同款同形、计费卡两道划扣可数；处置计数 2/3/2/1 与口播
 *  一致、八块分色与 3-A 双色语义一致、计数终值 ≈16,155（口播「一万六」四舍
 *  五入口径）、计费 0 恒定、蓝面变薄与紫面变厚同拍联动、任何处置块不经调用
 *  令牌（零调用语义）。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；unseen_tool_result_
 *  positions · fit_tool_results 只进角标；计数读数 Math.round(有界值) 直取、
 *  禁过冲、63,000 与 16,155 两步各保持 ≥15 帧。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  BillingCard,
  DiskCard,
  LoopRing,
  PlaceholderStub,
  StepLadder,
  ThresholdWaterline,
  TimelineAxis,
  TransferArrow,
} from '../components/motifs';
import {ReceiptCard} from '../components/motifs';
import {LADDER_MINI} from './P0FillingPaper';
import {DUR, clamp01, progress, useImpulse, useProgress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 3-A 判定轴：划掉时间 → 位标分界灯 → 双色罩 → 断线 ───────────────────

const ThreeA: React.FC<{atCross: number; atShake: number; atMark: number; atShield: number; atSeen: number; atLock: number; atBreak: number}> = ({
  atCross,
  atShake,
  atMark,
  atShield,
  atSeen,
  atLock,
  atBreak,
}) => {
  const frame = useCurrentFrame();
  // @pushIn（动机：p3-01 最反直觉判定压向分界灯主角）
  const push = usePushIn(0, {scale: 0.07, dur: DUR.f6});
  // 「不按时间算」时间刻度划掉 + 改挂「读没读过」小签
  const cross = useProgress(atCross, DUR.f4);
  const readTag = useProgress(atCross + 6, DUR.f4);
  // 「最反直觉」整轴轻晃一拍（衰减正弦）
  const shakeT = frame - atShake;
  const shake = shakeT > 0 ? Math.sin(shakeT / 1.8) * 6 * Math.exp(-shakeT / 16) : 0;
  // 「最近一次回复」位标落定 + 分界灯亮起；「一律不动」未读蓝罩
  const mark = useProgress(atMark, DUR.f4);
  const lamp = useProgress(atMark + 5, DUR.f5);
  const shield = useProgress(atShield, DUR.f5);
  // 「读过」已读紫框亮；「没读过」蓝罩加锁小闪
  const seen = useProgress(atSeen, DUR.f4);
  const lockFlash = useImpulse({at: atLock, dur: DUR.f5, peak: 1});
  // 「信息从未到达」未读块与模型侧视野圈断线一拍
  const brk = useProgress(atBreak, DUR.f5);
  const eye = useProgress(atBreak - 6, DUR.f4);
  const dot = ((frame / 80) % 1 + 1) % 1;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '38% 50%'}}>
        {/* 双平面缩微全景（开帧一拍——坐标锚） */}
        <div style={{position: 'absolute', left: 150, top: 130, width: 240, height: 150, boxSizing: 'border-box', borderRadius: 10, border: `2.5px solid ${withAlpha(theme.mech, 0.5)}`, background: withAlpha(theme.panel, 0.5), opacity: 0.55}}>
          <div style={{padding: '8px 10px', fontFamily: theme.sans, fontSize: 12, color: theme.mech}}>{'上下文'}</div>
        </div>
        <div style={{position: 'absolute', left: 1540, top: 260, width: 240, height: 150, boxSizing: 'border-box', borderRadius: 10, border: `2.5px solid ${withAlpha(theme.archive, 0.5)}`, background: withAlpha(theme.panel, 0.5), opacity: 0.55}}>
          <div style={{padding: '8px 10px', fontFamily: theme.sans, fontSize: 12, color: theme.archive}}>{'磁盘'}</div>
        </div>
        {/* 环体缩悬（全景锚） */}
        <div style={{position: 'absolute', left: 130, top: 360, opacity: 0.8}}>
          <LoopRing size={110} nodes={[]} showExit={false} dotProgress={dot} />
        </div>
        {/* 阶梯缩影（右上恒驻——三格亮） */}
        <StepLadder x={LADDER_MINI.x} y={LADDER_MINI.y} mode="mini" litMask={3} />
        {/* 消息时间轴（判定轴——主景） */}
        <TimelineAxis
          x={330}
          y={330}
          w={1280}
          blocks={[
            {seen: true},
            {seen: true},
            {seen: true},
            {seen: false},
            {seen: false},
            {seen: false},
          ]}
          blocksLit={6}
          markerP={mark}
          lampP={lamp}
          shieldLit={shield}
          seenLit={seen}
          lockFlash={lockFlash}
          clockCrossP={cross}
          readTagP={readTag}
          shake={shake}
          breakP={brk}
          eyeP={eye}
        />
        {/* 角标（unseen_tool_result_positions） */}
        <div style={{position: 'absolute', left: 330, top: 878, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>
          {'unseen_tool_result_positions · 分界后未读'}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'判定不按时间 · 按读没读过'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 类比一拍：单据卡三拍 + 切回机制（罩揭走→原样再调→两道划扣） ───────

const ThreeB: React.FC<{atPay: number; atEmpty: number; atSecond: number; atOnce: number; atRestock: number; atUnveil: number; atRecall: number; atCharge: number}> = ({
  atPay,
  atEmpty,
  atSecond,
  atOnce,
  atRestock,
  atUnveil,
  atRecall,
  atCharge,
}) => {
  const frame = useCurrentFrame();
  // 单据卡三拍：付款 → 货位空空 → 第二张单据浮起（+模型端问号）
  const pay = useProgress(atPay, DUR.f5);
  const empty = useProgress(atEmpty, DUR.f5);
  const second = useProgress(atSecond, DUR.f4);
  const qP = useProgress(atSecond + 6, DUR.f4);
  // 「一次性的」小签 + 「补货=重跑/再付」双小签
  const once = useProgress(atOnce, DUR.f4);
  const restock = useProgress(atRestock, DUR.f4);
  // 类比卡一拍即收（≤3 拍——切回机制画面时整层退出）
  const exit = useProgress(atUnveil - 8, DUR.f4, 'accelerate');
  // 「拆掉未读保护」切回机制画面：蓝罩揭走一拍
  const unveil = useProgress(atUnveil, DUR.f5);
  // 「原样再调一次」同款调用块再入列（与首轮块同形同位——原样判据）
  const recall = clamp01(progress(frame, atRecall, DUR.f5));
  const recallFlash = useImpulse({at: atRecall + DUR.f5, dur: DUR.f5, peak: 1});
  // 「白付第二遍」计费小卡连闪两道划扣（重音镜——两道先后、可数）
  const ch1 = useProgress(atCharge, DUR.f4);
  const ch2 = useProgress(atCharge + 14, DUR.f4);
  const charges = ch1 + ch2;
  const chargeFlash = useImpulse({at: atCharge + 14, dur: DUR.f6, peak: 1});
  // 机制画面（右侧）：首轮块位（再入块与之同形同位）
  const CALL = {x: 1120, y: 330, w: 560, h: 96} as const;
  return (
    <AbsoluteFill>
      {/* 阶梯缩影（右上恒驻——三格亮） */}
      <StepLadder x={LADDER_MINI.x} y={LADDER_MINI.y} mode="mini" litMask={3} />
      {/* 类比单据卡（左侧——三拍即收） */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: 1 - exit, pointerEvents: 'none'}}>
        <ReceiptCard x={170} y={200} payP={pay} emptyP={empty} secondP={second} onceP={once} restockP={restock} qP={qP} />
        <div style={{position: 'absolute', left: 170, top: 700, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.8}}>
          {'类比 · 一拍即收'}
        </div>
      </div>
      {/* 机制画面（右侧——切回）：蓝罩揭走 + 同款调用块再入列 + 计费两道 */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: clamp01(exit)}}>
        {/* 首轮调用块（在场——同形同位的基准） */}
        <div
          style={{
            position: 'absolute',
            left: CALL.x,
            top: CALL.y,
            width: CALL.w,
            height: CALL.h,
            boxSizing: 'border-box',
            borderRadius: 9,
            border: `2.5px solid ${withAlpha(theme.mech, 0.75)}`,
            background: withAlpha(theme.mech, 0.1),
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 16,
            gap: 12,
            fontFamily: theme.sans,
            fontSize: 17,
            fontWeight: 600,
            color: theme.text,
            whiteSpace: 'nowrap',
          }}
        >
          {'首轮调用 tool_use'}
        </div>
        {/* 首轮结果块（蓝罩——揭走一拍：罩上移淡出） */}
        <div
          style={{
            position: 'absolute',
            left: CALL.x + 40,
            top: CALL.y + 130,
            width: CALL.w - 80,
            height: 80,
            borderRadius: 9,
            border: `3px solid ${withAlpha(theme.mech, 0.55 * (1 - unveil))}`,
            background: withAlpha(theme.mech, 0.1 * (1 - unveil)),
            opacity: 1 - unveil,
            transform: `translateY(${-46 * unveil}px)`,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 14,
            fontFamily: theme.sans,
            fontSize: 15,
            color: theme.dim,
          }}
        >
          {'未读保护罩 · 揭走'}
        </div>
        {/* 再入的同款调用块（原样再调一次——从画外回到与首轮块**同形同位**：
            同 x/y/w/h 完全重叠，加粗描边+「第二遍」标承载「又一枚」的辨识） */}
        {recall > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: CALL.x,
              top: CALL.y + 160 * (1 - recall),
              width: CALL.w,
              height: CALL.h,
              boxSizing: 'border-box',
              borderRadius: 9,
              border: `2.5px solid ${theme.mech}`,
              background: withAlpha(theme.mech, 0.16),
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 16,
              gap: 12,
              fontFamily: theme.sans,
              fontSize: 17,
              fontWeight: 600,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: clamp01(recall * 2),
              boxShadow: recallFlash > 0.05 ? `0 0 ${22 * clamp01(recallFlash)}px ${withAlpha(theme.mech, 0.55)}` : 'none',
            }}
          >
            {'原样再调一次 tool_use'}
            <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.danger}}>{'第二遍'}</span>
          </div>
        ) : null}
        {/* 计费小卡（两道划扣——连闪可数） */}
        <div style={{position: 'absolute', left: CALL.x, top: 640}}>
          <BillingCard x={0} y={0} charges={charges} lit={ch1} caption={'调用计费 · 第二遍白付'} />
          {chargeFlash > 0.04 ? (
            <div style={{position: 'absolute', left: 0, top: -34, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap', opacity: clamp01(chargeFlash)}}>
              {'两道划扣 · 白付'}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'拆掉未读保护 · 重跑再付一遍'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 全链走查：八块处置 2/3/2/1 + 计数 63,000→≈16,155 + 计费恒 0 ──────

/** 八块走查数据（gl-notes B.2 t4：r1/r2 已读占位、r3–r5 已读保留、r6/r7 未读
 *  豁免、r8 未读超大预览——五已读三未读） */
type T4Block = {id: string; seen: boolean; act: 'fold' | 'keep' | 'exempt' | 'preview'; big?: boolean};
const T4_BLOCKS: readonly T4Block[] = [
  {id: 'r1', seen: true, act: 'fold'},
  {id: 'r2', seen: true, act: 'fold'},
  {id: 'r3', seen: true, act: 'keep'},
  {id: 'r4', seen: true, act: 'keep'},
  {id: 'r5', seen: true, act: 'keep'},
  {id: 'r6', seen: false, act: 'exempt'},
  {id: 'r7', seen: false, act: 'exempt'},
  {id: 'r8', seen: false, act: 'preview', big: true},
];

const ThreeC: React.FC<{atBreach: number; atStoreBig: number; atArray: number; atFold: number; atKeep: number; atExempt: number; atPreview: number; atCount: number; atRoll: number; atZero: number; atPrewarm: number}> = ({
  atBreach,
  atStoreBig,
  atArray,
  atFold,
  atKeep,
  atExempt,
  atPreview,
  atCount,
  atRoll,
  atZero,
  atPrewarm,
}) => {
  const frame = useCurrentFrame();
  // 「连未读都超限」水位再破线一拍（fit 兜底工况）
  const breach = useProgress(atBreach, DUR.f4);
  const breachFlash = useImpulse({at: atBreach, dur: DUR.f6, peak: 1});
  // 「最大的也存盘」未读超大块沿蓝→紫箭头落盘、换预览加路径
  const storeBig = clamp01(progress(frame, atStoreBig, DUR.f6));
  const storeBigFlash = useImpulse({at: atStoreBig + DUR.f5, dur: DUR.f5, peak: 1});
  // 「五条已读、三条未读，一条超大」八块列阵分色亮出
  const arrayLit = useProgress(atArray, DUR.f6);
  // 处置批次（次序=口播：折叠两条→保留三条→豁免两条→预览一条）
  const fold = clamp01(progress(frame, atFold, DUR.f5));
  const keep = clamp01(progress(frame, atKeep, DUR.f5));
  const exempt = clamp01(progress(frame, atExempt, DUR.f5));
  const preview = clamp01(progress(frame, atPreview, DUR.f5));
  // 「六万三」计数亮 63,000 →「压到一万六」回滚定格 ≈16,155（数据本体：两步
  // 各保持 ≥15 帧——63,000 自八块列阵亮起即常驻（atArray 起数十帧）、「六万三」
  // 词窗只作强调闪、回滚词起滚至 16,155 定格镜尾，禁过冲）
  const roll = clamp01(progress(frame, atRoll, DUR.f6));
  const countLit = useProgress(atArray, DUR.f4);
  const countFlash = useImpulse({at: atCount, dur: DUR.f5, peak: 0.5});
  const count = roll > 0.001 ? Math.round(63000 - 46845 * roll) : 63000;
  // 「一步调用都没花」计费小卡保持 0 定格放大一拍（零调用总账）
  const zeroBig = useImpulse({at: atZero, dur: DUR.f6, peak: 1});
  const zeroHold = useProgress(atZero, DUR.f3);
  // 「最贵的那步，压轴」阶梯缩影第四格预亮一拍（P4 钩子）
  const prewarm = useProgress(atPrewarm, DUR.f4);
  const prewarmFlash = useImpulse({at: atPrewarm, dur: DUR.f5, peak: 1});
  // 紫面变厚联动（落盘件计数：占位 2 + 预览 1 = 3 件——gl-notes「落盘 3 件」）
  const diskItems = fold * 2 + preview;
  const GRID = {x: 210, y: 190, bw: 360, bh: 78, gapX: 40, gapY: 16} as const;
  return (
    <AbsoluteFill>
      {/* 阶梯缩影（右上恒驻——三格亮 + 第四格预亮一拍） */}
      <StepLadder x={LADDER_MINI.x} y={LADDER_MINI.y} mode="mini" litMask={3} prewarm4={prewarm} />
      {prewarmFlash > 0.04 ? (
        <div style={{position: 'absolute', left: LADDER_MINI.x - 74, top: LADDER_MINI.y + 112, fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap', opacity: clamp01(prewarmFlash)}}>
          {'④ 压轴'}
        </div>
      ) : null}
      {/* 水位条（再破线一拍——fit 兜底工况） */}
      <ThresholdWaterline x={120} y={220} h={480} level={Math.min(1, (63000 / 63000) * (0.55 + 0.45 * breach))} breach={breach} breachFlash={breachFlash} caption={'fit · 超限兜底'} lit={breach} />
      {/* 八块列阵（两列×四行——五已读紫框、三未读蓝罩、r8 超大 + 号） */}
      {T4_BLOCKS.map((b, i) => {
        const col = Math.floor(i / 4);
        const row = i % 4;
        const bx = GRID.x + col * (GRID.bw + GRID.gapX);
        const by = GRID.y + row * (GRID.bh + GRID.gapY);
        const lit = clamp01(arrayLit * 8 - i);
        // 处置态
        const isFold = b.act === 'fold' ? fold : 0;
        const isKeep = b.act === 'keep' ? keep : 0;
        const isExempt = b.act === 'exempt' ? exempt : 0;
        const isPrev = b.act === 'preview' ? preview : 0;
        const handled = Math.max(isFold, isKeep, isExempt, isPrev);
        return (
          <div key={b.id} style={{position: 'absolute', left: bx, top: by, width: GRID.bw, height: GRID.bh, opacity: 0.25 + 0.75 * lit}}>
            {/* 块本体（已读=紫框可折 / 未读=蓝罩；r8 超大在 fit 前另有 + 号） */}
            <div
              style={{
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                borderRadius: 9,
                border: `2.5px solid ${b.seen ? withAlpha(theme.archive, 0.8) : withAlpha(theme.mech, 0.8)}`,
                background: b.seen ? withAlpha(theme.archive, 0.05) : withAlpha(theme.mech, 0.08),
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 12,
                gap: 10,
                fontFamily: theme.mono,
                fontSize: 13,
                color: theme.dim,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{color: b.seen ? theme.archive : theme.mech, fontWeight: 700}}>{b.seen ? '已读' : '未读'}</span>
              {b.big ? <span style={{fontFamily: theme.mono, fontSize: 15, fontWeight: 700, color: theme.dim}}>{'超大 +'}</span> : null}
              {b.big && isPrev > 0.3 ? <span style={{fontSize: 11, color: theme.archive, opacity: isPrev}}>{'→ 预览+路径'}</span> : null}
            </div>
            {/* 处置标记层 */}
            {b.act === 'fold' && isFold > 0.35 ? (
              <div style={{position: 'absolute', left: 0, top: 0, width: GRID.bw, opacity: clamp01((isFold - 0.35) * 2)}}>
                <PlaceholderStub x={0} y={GRID.bh / 2 - 14} w={GRID.bw} foldP={isFold} pathLit={isFold} flash={0} indexTag={i + 1} />
              </div>
            ) : null}
            {b.act === 'keep' ? (
              <div
                style={{
                  position: 'absolute',
                  inset: -8,
                  borderRadius: 12,
                  border: `3px solid ${theme.ok}`,
                  opacity: isKeep * 0.9,
                  boxShadow: `0 0 ${12 * isKeep}px ${withAlpha(theme.ok, 0.4)}`,
                  pointerEvents: 'none',
                }}
              />
            ) : null}
            {b.act === 'exempt' && isExempt > 0.3 ? (
              <div style={{position: 'absolute', right: 10, top: -14, padding: '2px 10px', borderRadius: 6, border: `2.5px solid ${theme.mech}`, background: theme.panel, fontFamily: theme.sans, fontSize: 12, fontWeight: 700, color: theme.mech, whiteSpace: 'nowrap', opacity: clamp01(isExempt)}}>
                {'豁免 · 不动'}
              </div>
            ) : null}
          </div>
        );
      })}
      {/* 超大块落盘箭头 + 紫面（同步变厚——落盘 3 件） */}
      <TransferArrow x={960} y={330} w={260} p={storeBig} lit={storeBig > 0.02 && storeBig < 0.98 ? 1 : 0} flowPhase={frame / 26} />
      <div style={{position: 'absolute', left: 1260, top: 190, width: 420}}>
        <div
          style={{
            width: '100%',
            height: 240 + 110 * clamp01(diskItems / 3),
            boxSizing: 'border-box',
            borderRadius: 12,
            border: `3px solid ${theme.archive}`,
            background: withAlpha(theme.panel, 0.6),
            padding: '10px 12px',
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.archive}}>{'磁盘 · 同步变厚'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, marginTop: 2}}>{`落盘 ${Math.round(diskItems)} 件`}</div>
          {/* 落盘件（占位 ×2 + 超大预览 ×1——逐一落账） */}
          <div style={{marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8}}>
            {[0, 1].map((i) => (
              <div key={`d${i}`} style={{height: 46, borderRadius: 7, border: `2.5px ${clamp01(fold * 2 - i) > 0.4 ? 'solid' : 'dashed'} ${theme.archive}`, opacity: clamp01(fold * 2 - i), display: 'flex', alignItems: 'center', paddingLeft: 10, fontFamily: theme.mono, fontSize: 11, color: theme.archive, whiteSpace: 'nowrap'}}>
                {`.task_outputs/r${i + 1}.json`}
              </div>
            ))}
            <div style={{height: 66, borderRadius: 7, border: `2.5px ${preview > 0.4 ? 'solid' : 'dashed'} ${theme.archive}`, opacity: preview, display: 'flex', alignItems: 'center', paddingLeft: 10, gap: 8, fontFamily: theme.mono, fontSize: 11, color: theme.archive, whiteSpace: 'nowrap'}}>
              {'r8 · 预览 1,000 + 路径'}
            </div>
          </div>
        </div>
        <DiskCard x={0} y={380} w={420} h={180} rowsLit={6 * storeBig} flash={storeBigFlash} title={'超大未读 · 整份'} path={'.task_outputs/tool-results/r8.json'} lit={storeBig} />
      </div>
      {/* 总量计数位（63,000 → ≈16,155——两步定格、数据本体禁过冲） */}
      <div style={{position: 'absolute', left: 210, top: 700, display: 'flex', alignItems: 'baseline', gap: 14, opacity: clamp01(countLit)}}>
        <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap'}}>{'上下文总量'}</span>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 56,
            fontWeight: 700,
            color: theme.text,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            textShadow: `0 0 ${14 * clamp01(roll) + 10 * clamp01(countFlash) + 8 * zeroHold}px ${withAlpha(theme.ok, 0.4)}`,
          }}
        >
          {count.toLocaleString('en-US')}
        </span>
        {roll > 0.98 ? <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>{'≈ 16,155 · 复算精确值'}</span> : null}
      </div>
      {/* 计费小卡（恒 0——零调用总账定格放大一拍） */}
      <div style={{position: 'absolute', left: 700, top: 690}}>
        <BillingCard x={0} y={0} charges={0} lit={arrayLit} big={zeroHold} caption={'调用计费 · 全程'} />
        {zeroBig > 0.04 ? (
          <div style={{position: 'absolute', left: 0, top: -36, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.ok, whiteSpace: 'nowrap', opacity: clamp01(zeroBig)}}>
            {'零调用'}
          </div>
        ) : null}
      </div>
      {/* 工况角标（走查 · 复算口径）+ fit_tool_results */}
      <div style={{position: 'absolute', left: 210, top: 880, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>
        {'走查 · 复算口径 · fit_tool_results'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'折叠 2 · 保留 3 · 豁免 2 · 预览 1 · 计费 0'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P3SeenUnseen: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p3-01', 'p3-03');
  const bB = w('p3-04', 'p3-06');
  const bC = w('p3-07', 'p3-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ThreeA
          atCross={wa('p3-01', 0.18) - bA.from}
          atShake={wa('p3-01', 0.74) - bA.from}
          atMark={wa('p3-02', 0.22) - bA.from}
          atShield={wa('p3-02', 0.62) - bA.from}
          atSeen={wa('p3-03', 0.14) - bA.from}
          atLock={wa('p3-03', 0.5) - bA.from}
          atBreak={wa('p3-03', 0.82) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ThreeB
          atPay={wa('p3-04', 0.3) - bB.from}
          atEmpty={wa('p3-04', 0.62) - bB.from}
          atSecond={wa('p3-04', 0.88) - bB.from}
          atOnce={wa('p3-05', 0.2) - bB.from}
          atRestock={wa('p3-05', 0.6) - bB.from}
          atUnveil={wa('p3-06', 0.2) - bB.from}
          atRecall={wa('p3-06', 0.52) - bB.from}
          atCharge={wa('p3-06', 0.78) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ThreeC
          atBreach={wa('p3-07', 0.3) - bC.from}
          atStoreBig={wa('p3-07', 0.68) - bC.from}
          atArray={wa('p3-08', 0.32) - bC.from}
          atFold={wa('p3-09', 0.14) - bC.from}
          atKeep={wa('p3-09', 0.3) - bC.from}
          atExempt={wa('p3-09', 0.46) - bC.from}
          atPreview={wa('p3-09', 0.6) - bC.from}
          atCount={wa('p3-09', 0.74) - bC.from}
          atRoll={wa('p3-09', 0.88) - bC.from}
          atZero={wa('p3-10', 0.2) - bC.from}
          atPrewarm={wa('p3-10', 0.66) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3SeenUnseen;
