/** P0 写死的开场说明（p0-01..p0-08，2 镜）——分镜 0-A / 0-B。
 *
 *  叙事链：系列片头交棒后冷启动直入（开篇视听合力 I-039）：灰色提示长文本卡
 *  居中偏左一次性定格式铺满〔M-005〕（写死感——无活光标、分毫不动）、右侧两格
 *  状态小窗先后点亮（「工具新了」「记忆有了」——状态变了它不知道的视觉先现）
 *  → p0-02「每轮开工」暗环侧转过一拍、同一张说明卡原样再递一次（同卡复现 =
 *  每轮都在念同一段）→ p0-03「系统提示」名签贴上、「消息、工具表」旁侧两条
 *  窄通道条并列显形一拍（三路工程直陈，一现即收——P1 拼装流才展开）→ 0-B
 *  病灶清账：欠债清单三格（警示红描边）stagger 点亮〔M-005〕、前史时间线两格
 *  （一行字符串 → 函数内拼一次——B.1 措辞校准口径只画两格）、「纹丝不动」
 *  状态小窗再闪而长卡静止（对照帧〔M-003〕）、提示条增长轨贴段变长 / 整条
 *  重排 / 新旧段交界红叉、逐轮计费计数器随暗环每转跳一格（不给出金额数字）、
 *  用不到的段落整块降暗。
 *
 *  空间契约：长卡为唯一主体（0-A/0-B 同位分毫不动）、状态小窗居右不抢焦、
 *    欠债清单 A#4 点亮即收后驻侧半透明、三通道一现即收、计费计数与暗环转拍
 *    同步、署源角标右下恒定不抢焦（首部署源位）。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥176；System Prompt ·
 *    system prompt / messages / tools 只进角标；名签/通道条/计数器文字不成句；
 *    时间线只画两格（复活被校准掉的章节序列禁）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {DebtLedger, LoopRing, PromptBar, SectionCardStack, StatusPairWindows, useRingDot} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，RSI I-080 豁免登记）：右下常驻，一次淡入后恒定不抢焦；
 *  bottom 168 避开字幕条（承 ep1–ep9 SourceCredit 形态） */
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

// ── 0-A 冷启动全景：写死长卡落定 + 状态小窗对照 + 每轮同卡再递 + 三通道一现 ──

/** 长卡全局位（0-A/0-B 同位不动——写死感的帧上判据）；状态小窗居右（与长卡
 *  右缘净空 130px、与 0-A 通道条右缘净空 50px，QA 教训 27：签位与块标注角点
 *  ≥20px 净空的放大取值） */
const LONGCARD = {x: 170, y: 170, w: 760, h: 560} as const;
const STATUS = {x: 1070, y: 240, w: 280, h: 340} as const;
/** 暗环驻屏上角（小比例 · 非焦点——0-B 计数拍与转拍同步） */
const RING0 = {x: 1690, y: 76, size: 110} as const;

const ZeroA: React.FC<{
  atCard: number;
  atTool: number;
  atMem: number;
  atLap: number;
  atReissue: number;
  atName: number;
  atChannels: number;
}> = ({atCard, atTool, atMem, atLap, atReissue, atName, atChannels}) => {
  const frame = useCurrentFrame();
  // 长卡一次性定格式落定（写死感：无逐字、无光标——整卡一次显形）
  const cardIn = useProgress(atCard, DUR.f5);
  // 「工具新了」「记忆有了」两格状态小窗先后点亮（长卡分毫不动）
  const toolNew = useProgress(atTool, DUR.f4);
  const memOn = useProgress(atMem, DUR.f4);
  // 「每轮开工」暗环侧转过一拍（巡游点加速越过一拍 + 环体微亮）
  const lap = clamp01(progress(frame, atLap, 26));
  const ringGlow = Math.sin(Math.PI * lap);
  // 同一张说明卡原样再递一次（同卡复现：副本平移递出再渐隐，本体零位移）
  const reissue = clamp01(progress(frame, atReissue, 34));
  // 「系统提示」名签贴上（卡角贴纸）
  const nameTag = useProgress(atName, DUR.f4);
  const namePop = useImpulse({at: atName + DUR.f3, dur: DUR.f4, peak: 3});
  // 「消息、工具表」两条窄通道条并列显形一拍（三路直陈；一现即收）
  const chIn = clamp01(progress(frame, atChannels, DUR.f4));
  const chOut = clamp01(progress(frame, atChannels + 20, DUR.f4));
  const dot = useRingDot(2.5, atLap / 75);
  const dotBoost = dot + 0.18 * ringGlow;
  return (
    <AbsoluteFill>
      {/* 写死长卡（灰色 · 一次性铺满——0-B 承同位；副本再递层在下） */}
      <div style={{position: 'absolute', left: LONGCARD.x, top: LONGCARD.y, opacity: cardIn}}>
        <SectionCardStack x={0} y={0} w={LONGCARD.w} h={LONGCARD.h} splitP={0} tintP={0} />
      </div>
      {/* 同卡再递副本（原样复现：内容/形制零变化，仅平移 + 渐隐——「每轮递同一段」） */}
      {reissue > 0.02 && reissue < 0.98 ? (
        <div
          style={{
            position: 'absolute',
            left: LONGCARD.x + 120 * reissue,
            top: LONGCARD.y + 10 * reissue,
            opacity: Math.sin(Math.PI * reissue) * 0.85,
          }}
        >
          <SectionCardStack x={0} y={0} w={LONGCARD.w} h={LONGCARD.h} splitP={0} tintP={0} />
        </div>
      ) : null}
      {/* 名签（系统提示——贴卡角；词窗弹入） */}
      {nameTag > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: LONGCARD.x - 18,
            top: LONGCARD.y - 22 - namePop,
            padding: '6px 20px',
            borderRadius: 9,
            border: `3px solid ${theme.core}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 24,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: nameTag,
            transform: `rotate(-3deg) translateY(${(1 - nameTag) * -14}px)`,
            boxShadow: `0 0 ${14 * nameTag}px ${withAlpha(theme.core, 0.4)}`,
          }}
        >
          {'系统提示'}
        </div>
      ) : null}
      {/* 两条窄通道条（消息 / 工具表——三路直陈之二；一现即收，P1 才展开） */}
      {chIn > 0.02 && chOut < 0.98 ? (
        <>
          {[
            {t: '消息', y: LONGCARD.y + 130},
            {t: '工具表', y: LONGCARD.y + 320},
          ].map((c, i) => {
            const p = clamp01(chIn * (1 + 0.15 * i) - i * 0.12);
            return (
              <div
                key={c.t}
                style={{
                  position: 'absolute',
                  left: LONGCARD.x + LONGCARD.w + 34,
                  top: c.y,
                  width: 54,
                  height: 120,
                  borderRadius: 8,
                  border: `2.5px solid ${withAlpha(theme.tool, 0.5 + 0.5 * p)}`,
                  background: withAlpha(theme.panel, 0.8),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingBottom: 10,
                  gap: 8,
                  opacity: p * (1 - chOut),
                }}
              >
                {[0, 1, 2].map((k) => (
                  <span key={`ch${k}`} style={{width: 26, height: 7, borderRadius: 4, background: withAlpha(theme.tool, 0.25 + 0.2 * k)}} />
                ))}
                <span style={{fontFamily: theme.sans, fontSize: 13, fontWeight: 700, color: theme.tool, whiteSpace: 'nowrap'}}>{c.t}</span>
              </div>
            );
          })}
        </>
      ) : null}
      {/* 右侧两格状态小窗（状态变了、长卡不知道——对照件） */}
      <StatusPairWindows x={STATUS.x} y={STATUS.y} w={STATUS.w} h={STATUS.h} toolNewP={toolNew} memOnP={memOn} />
      {/* 暗环驻屏上角（小比例非焦点；「每轮开工」侧转过一拍微亮） */}
      <div style={{position: 'absolute', left: RING0.x, top: RING0.y, opacity: 0.4 + 0.35 * ringGlow}}>
        <LoopRing size={RING0.size} nodes={[]} showExit={false} dotProgress={dotBoost % 1} />
      </div>
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'System Prompt · system prompt / messages / tools'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 病灶清账：欠债清单三格 + 前史两格 + 提示条增长轨 + 逐轮计费 ──────────

/** 欠债清单位（右——与状态小窗右缘净空 80px）与提示条增长轨（长卡正下方） */
const LEDGER = {x: 1380, y: 210, w: 360, h: 380} as const;
const TRACK = {x: 170, y: 806, w: 760, h: 56} as const;
const TIMELINE = {x: 170, y: 742, w: 560, h: 44} as const;
/** 计费计数器（挂条尾——只跳轮次格、不给金额数字） */
const METER = {x: 952, y: 790} as const;

const ZeroB: React.FC<{
  atDebt: number;
  atTl1: number;
  atTl2: number;
  atCells: number;
  atWinFlash: number;
  atGrow: number;
  atReflow: number;
  atConflict: number;
  atBill: number;
  atWaste: number;
}> = ({atDebt, atTl1, atTl2, atCells, atWinFlash, atGrow, atReflow, atConflict, atBill, atWaste}) => {
  const frame = useCurrentFrame();
  // 欠债清单入场（A#4 点亮）→ 点亮后驻侧半透明
  const debtIn = useProgress(atDebt, DUR.f5);
  const debtDim = 0.32 * clamp01(progress(frame, atCells + 30, DUR.f5));
  // 三格 stagger 点亮（不分段 / 不看状态 / 不缓存——债在结构上）
  const cells = 3 * clamp01(progress(frame, atCells, 30));
  // 「纹丝不动」状态小窗再闪一次而长卡静止（对照帧）
  const winFlash = useImpulse({at: atWinFlash, dur: DUR.f5, peak: 1});
  // 提示条增长轨：贴上新段变长（4→5 段）→ 整条重排一拍 → 新旧段交界红叉
  const segNames = ['开场', '工具', '规矩', '目录', '新能力'] as const;
  const grow = clamp01(progress(frame, atGrow, DUR.f4));
  const segLit = 4 + grow;
  const reflow = Math.sin(Math.PI * clamp01(progress(frame, atReflow, DUR.f5)));
  const conflict = Math.sin(Math.PI * clamp01(progress(frame, atConflict, DUR.f5)));
  // 逐轮计费计数器：随暗环每转一拍跳一格（75 帧/圈；禁金额数字）
  const billStart = Math.max(0, atBill);
  const laps = Math.floor(Math.max(0, frame - billStart) / 75);
  const billTick = clamp01(progress(frame, billStart + laps * 75, 10));
  const billIn = clamp01(progress(frame, billStart, DUR.f4));
  // 「白交钱」用不到的段落整块降暗（增长轨上的一段）
  const waste = clamp01(progress(frame, atWaste, DUR.f4));
  const dot = useRingDot(2.5);
  return (
    <AbsoluteFill>
      {/* 长卡驻屏中（承 0-A 位——分毫不动） */}
      <SectionCardStack x={LONGCARD.x} y={LONGCARD.y} w={LONGCARD.w} h={LONGCARD.h} splitP={0} tintP={0} />
      {/* 前史时间线两格（一行写死的字符串 → 挪进函数 · 启动时拼一次——只画两格） */}
      <div style={{position: 'absolute', left: TIMELINE.x, top: TIMELINE.y, width: TIMELINE.w, height: TIMELINE.h, display: 'flex', alignItems: 'center', gap: 14}}>
        {[
          {t: '一行写死的字符串', at: atTl1},
          {t: '挪进函数 · 启动时拼一次', at: atTl2},
        ].map((c) => {
          const p = clamp01(progress(frame, c.at, DUR.f4));
          return (
            <React.Fragment key={c.t}>
              <div
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: `2.5px ${p > 0.3 ? 'solid' : 'dashed'} ${withAlpha(theme.dim, 0.4 + 0.5 * p)}`,
                  background: withAlpha(theme.panel, 0.9),
                  fontFamily: theme.sans,
                  fontSize: 16,
                  color: p > 0.3 ? theme.text : theme.dim,
                  whiteSpace: 'nowrap',
                  opacity: Math.max(p, 0.35),
                }}
              >
                {c.t}
              </div>
              <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, opacity: p * 0.8}}>{'→'}</span>
            </React.Fragment>
          );
        })}
      </div>
      {/* 提示条增长轨（多一段变长 / 整段重排 / 打架红叉 / 用不到的段降暗） */}
      <PromptBar x={TRACK.x} y={TRACK.y} w={TRACK.w} h={TRACK.h} mode={'grow'} segs={segNames.slice()} segLit={segLit} reflowP={reflow} conflictP={conflict} />
      {/* 用不到的段落整块降暗（新能力段——白交钱的具象；压暗罩盖末段） */}
      {waste > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: TRACK.x + 448,
            top: TRACK.y,
            width: 122,
            height: TRACK.h,
            borderRadius: 8,
            background: withAlpha(theme.bg, 0.62 * waste),
            border: `2px dashed ${withAlpha(theme.danger, 0.5 * waste)}`,
            opacity: waste,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 13,
            color: theme.danger,
            whiteSpace: 'nowrap',
          }}
        >
          {'用不到'}
        </div>
      ) : null}
      {/* 计费计数器（挂条尾——轮次格随暗环转拍跳格；无金额数字） */}
      {billIn > 0.02 ? (
        <div style={{position: 'absolute', left: METER.x, top: METER.y, opacity: billIn}}>
          <div style={{display: 'flex', gap: 5, alignItems: 'center'}}>
            {[0, 1, 2, 3, 4, 5].map((k) => {
              const on = k < laps ? 1 : k === laps ? billTick : 0;
              return (
                <span
                  key={`bp${k}`}
                  style={{
                    width: 13,
                    height: 20,
                    borderRadius: 3,
                    border: `2px solid ${on > 0.4 ? theme.core : theme.panelBorder}`,
                    background: on > 0.4 ? withAlpha(theme.core, 0.4) : 'transparent',
                    display: 'inline-block',
                  }}
                />
              );
            })}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.core, marginTop: 4, whiteSpace: 'nowrap'}}>
            {`每轮计费 · 轮 ${laps + 1}`}
          </div>
        </div>
      ) : null}
      {/* 欠债清单（警示红三格——A#4 点亮即收后驻侧） */}
      <div style={{opacity: 1 - debtDim}}>
        <DebtLedger x={LEDGER.x} y={LEDGER.y} w={LEDGER.w} h={LEDGER.h} lit={debtIn} cellsLit={cells} />
      </div>
      {/* 状态小窗（承 0-A 已亮基态 +「纹丝不动」再闪一次——长卡静止的对照帧） */}
      <StatusPairWindows x={STATUS.x} y={STATUS.y} w={STATUS.w} h={STATUS.h} toolNewP={Math.max(0.72, winFlash * 0.9)} memOnP={Math.max(0.78, winFlash)} />
      {/* 暗环驻屏上角（计拍同步——每转一拍跳一格） */}
      <div style={{position: 'absolute', left: RING0.x, top: RING0.y, opacity: 0.42 + 0.3 * billTick}}>
        <LoopRing size={RING0.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'写死的长卡 · 状态变了它不知道'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0HardcodedIntro: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A">
        <ZeroA
          atCard={wa('p0-01', 0.14) - bA.from}
          atTool={wa('p0-01', 0.44) - bA.from}
          atMem={wa('p0-01', 0.72) - bA.from}
          atLap={wa('p0-02', 0.06) - bA.from}
          atReissue={wa('p0-02', 0.34) - bA.from}
          atName={wa('p0-03', 0.14) - bA.from}
          atChannels={wa('p0-03', 0.42) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atDebt={wa('p0-04', 0.4) - bB.from}
          atTl1={wa('p0-05', 0.22) - bB.from}
          atTl2={wa('p0-05', 0.56) - bB.from}
          atCells={wa('p0-06', 0.18) - bB.from}
          atWinFlash={wa('p0-06', 0.8) - bB.from}
          atGrow={wa('p0-07', 0.14) - bB.from}
          atReflow={wa('p0-07', 0.42) - bB.from}
          atConflict={wa('p0-07', 0.76) - bB.from}
          atBill={wa('p0-08', 0.3) - bB.from}
          atWaste={wa('p0-08', 0.72) - bB.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0HardcodedIntro;
