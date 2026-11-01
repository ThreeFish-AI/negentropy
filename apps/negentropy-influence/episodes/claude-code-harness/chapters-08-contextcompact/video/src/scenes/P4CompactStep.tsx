/** P4 最贵的一步（p4-01..p4-10 含 p4-08b，4 镜）——分镜 4-A / 4-B / 4-C / 4-D。
 *
 *  叙事链：4-A 拉远全景（自 P3 峰值降压重锚，@pushIn 负增量；3-C 末帧预亮
 *  第四格的屏位 = 开帧闸机亮起屏位——eye-trace 呼应）：阶梯缩影放大为管线
 *  全景主景——前三格已亮、各格旁一枚「结构扳手」图标挂起〔M-005〕、「理解
 *  不了内容」扳手下方内容块保持乱码纹理（挪得动、读不懂的可视）；p4-02「唯一
 *  花调用」调用令牌自画外飞入、投入闸机——计费小卡 +1 划扣恰一次（全片唯一
 *  付费，与 3-C 计费 0 对照）→ 闸门开启 → 摘要卡自消息列整列压缩生成
 *  〔M-006 接 P4-B〕→ 4-B 摘要卡双段结构特写：「先留档」完整历史整列复印进
 *  紫面留档夹（承 2-A 同形动作——规矩复现）、「摘要只要事实」摘要卡亮出；
 *  「分成两段」双段展开、分隔光带亮起；「记在用户名下」工具结果条携用户名
 *  签滑入上段侧、混排预演一拍（指令句与结果条同段交叠、问号闪现）→ 光带加宽
 *  一拍（分开即解）；「防夹带」滤网落下、「以后都执行某命令」小字条撞上滤网
 *  被拦、落入下段变一行事实记录（带「不执行」小签）→ 4-C 真实版对照引入
 *  （换层一拍）：教学装置整体缩回右上恒驻缩影位（四格全亮），源码对照帧亮起
 *  ——执行序五枚函数卡（编号短签 L379..L454）逐个亮起、与教学管线四步按序
 *  对位（contextCollapse 一卡为「教学版无对应」暗态旁签——CC 独有），四条
 *  对齐线各接对应步骤卡（G1 修订：四线非五线——gl-notes 明示教学版无
 *  contextCollapse）；归属句承载 → 4-D 插句与生产细节卡：「窗口」纸的总容量
 *  翻译帧（草稿纸缩影外框亮起贴签一拍即撤）、「窗口减输出上限」阈值公式卡
 *  块状演算（数值只进角标）、「留一万三」缓冲块旁标 13,000、「连败三次」三格
 *  保险丝亮出、「熔断」第三格烧断一拍（1–2s 重音镜）；p4-10「一条原则」四步
 *  卡间一道贯穿光带掠过（P5 阶梯定格预演）。
 *
 *  空间契约：闸机为唯一付费位、计费卡划扣恰一次、摘要卡自整列生成（全量
 *  语义）；双段结构与段名恒定、滤网为唯一拦截件、夹带条终态=事实记录非执行
 *  态；换层前后各 ≥15 帧稳态、四条对齐线可数（不跳过任何有教学对应的函数
 *  卡）、源码帧无信源痕迹；公式卡为图形化等式（数值只进角标）、保险丝恰三
 *  格、烧断发生在第三格。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；compact_history ·
 *  [Compacted] · query.ts · autoCompact 只进角标；计数读数直取、禁过冲。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  ArchiveFolder,
  BillingCard,
  FuseCard,
  LoopRing,
  MessageColumn,
  StepLadder,
  SummaryCard,
  TokenGate,
  TransferArrow,
} from '../components/motifs';
import {LADDER_MINI} from './P0FillingPaper';
import {DUR, clamp01, progress, useImpulse, useProgress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 执行序五函数卡（gl-notes §3.7：query.ts L379→L454——编号短签） */
const FUNCS = [
  {fn: 'applyToolResultBudget', line: 'L379', step: 0},
  {fn: 'snipCompact', line: 'L403', step: 1},
  {fn: 'microcompact', line: 'L414', step: 2},
  {fn: 'contextCollapse', line: 'L441', step: -1},
  {fn: 'autoCompact', line: 'L454', step: 3},
] as const;

/** 四步名（对齐线右端——与 StepLadder 四步同词） */
const STEP_NAMES = ['① 大件落盘', '② 裁中段', '③ 缩旧结果', '④ 全量摘要'] as const;

// ── 4-A 管线全景：扳手挂起 → 令牌投闸 → 唯一付费 → 摘要卡生成 ───────────

const FourA: React.FC<{atWrench: number; atGarble: number; atFly: number; atDrop: number; atGate: number; atGen: number}> = ({
  atWrench,
  atGarble,
  atFly,
  atDrop,
  atGate,
  atGen,
}) => {
  const frame = useCurrentFrame();
  // @pushIn 负增量（动机：p4-01 设问起拉远降压、管线全景重锚）
  const pull = usePushIn(0, {scale: -0.05, dur: DUR.f6 + DUR.f4});
  // 「结构操作」三枚扳手图标挂起一排（前三格旁）
  const wrench = useProgress(atWrench, DUR.f5);
  // 「理解不了内容」扳手下方内容块保持乱码纹理（挪得动、读不懂）
  const garble = useProgress(atGarble, DUR.f5);
  // 「唯一花调用」令牌飞入 →「全量摘要」投入闸机
  const fly = clamp01(progress(frame, atFly, DUR.f5));
  const drop = clamp01(progress(frame, atDrop, DUR.f4));
  // 计费小卡 +1 划扣恰一次（全片唯一付费）
  const charge = useProgress(atDrop + DUR.f3, DUR.f4);
  const chargeFlash = useImpulse({at: atDrop + DUR.f3, dur: DUR.f6, peak: 1});
  // 闸门开启 → 摘要卡自消息列整列压缩生成
  const gate = useProgress(atGate, DUR.f5, 'decelerate');
  const gateFlash = useImpulse({at: atGate, dur: DUR.f6, peak: 1});
  const gen = clamp01(progress(frame, atGen, DUR.f6));
  // 主景阶梯位 + 第四格闸机位（闸机自 3-C 预亮屏位（右上缩影位）迁入——eye-trace）
  const LADDER = {x: 600, y: 230} as const;
  const gateMove = useProgress(0, DUR.f5 + DUR.f3);
  const gateHomeX = LADDER.x + 3 * 262 + 96;
  const gateHomeY = LADDER.y + 40;
  const gateX = LADDER_MINI.x + 60 + (gateHomeX - LADDER_MINI.x - 60) * gateMove;
  const gateY = LADDER_MINI.y + 20 + (gateHomeY - LADDER_MINI.y - 20) * gateMove;
  const dot = ((frame / 80) % 1 + 1) % 1;
  // 消息列缩微（摘要卡生成源——整列）
  const MSGCOL = {x: 150, y: 300} as const;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: pull, transformOrigin: '50% 50%'}}>
        {/* 环体缩悬阶梯侧上角 */}
        <div style={{position: 'absolute', left: 430, top: 84, opacity: 0.85}}>
          <LoopRing size={120} nodes={[]} showExit={false} dotProgress={dot} />
        </div>
        {/* 消息列缩微（摘要生成的源——整列压缩） */}
        <div style={{position: 'absolute', left: MSGCOL.x, top: MSGCOL.y, transform: `scale(${1 - 0.34 * gen})`, transformOrigin: 'left top', opacity: 0.85 - 0.35 * gen}}>
          <MessageColumn x={0} y={0} w={330} rowH={54} rows={['msg', 'call', 'result', 'msg', 'call', 'result']} rowsLit={6} scale={0.9} headerLabel={'消息列 · 整列'} />
        </div>
        {/* 压缩箭头（整列 → 摘要卡） */}
        <TransferArrow x={MSGCOL.x + 250} y={470} w={280} p={gen} lit={gen > 0.02 && gen < 0.98 ? 1 : 0} flowPhase={frame / 26} />
        {/* 管线全景主景（阶梯放大——前三格亮、第四格由闸机入驻点亮） */}
        <StepLadder x={LADDER.x} y={LADDER.y} litMask={3 + gate} axisP={1} mode="main" />
        {/* 三枚结构扳手（前三格旁挂起——挪得动） */}
        {[0, 1, 2].map((i) => {
          const wx = LADDER.x + i * 262 + 250;
          const wy = LADDER.y + (3 - i) * 92 + 40;
          return (
            <div key={i} style={{position: 'absolute', left: wx, top: wy, opacity: clamp01(wrench)}}>
              <svg width={64} height={56} viewBox="0 0 64 56">
                <circle cx={16} cy={40} r={10} fill="none" stroke={theme.core} strokeWidth={5} />
                <line x1={23} y1={33} x2={52} y2={8} stroke={theme.core} strokeWidth={5} strokeLinecap="round" />
                <line x1={44} y1={4} x2={56} y2={16} stroke={theme.core} strokeWidth={5} strokeLinecap="round" />
              </svg>
              {/* 乱码纹理（读不懂——扳手下方内容块） */}
              <div style={{marginTop: 4, width: 120, height: 26, borderRadius: 5, border: `2px dashed ${withAlpha(theme.dim, 0.6)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.mono, fontSize: 12, color: theme.dim, opacity: clamp01(garble)}}>
                {'▓▒░ 乱码 ░▒▓'}
              </div>
            </div>
          );
        })}
        {/* 闸机（第四格位——自缩影屏位迁入；令牌投闸） */}
        <div style={{position: 'absolute', left: gateX, top: gateY}}>
          <TokenGate x={0} y={0} tokenFly={fly} tokenDrop={drop} gateOpen={gate} gateFlash={gateFlash} />
        </div>
        {/* 计费小卡（在场——承 3-C 同款；+1 划扣恰一次） */}
        <div style={{position: 'absolute', left: 150, top: 150}}>
          <BillingCard x={0} y={0} charges={charge} lit={1} caption={'调用计费 · 全片唯一'} />
          {chargeFlash > 0.04 ? (
            <div style={{position: 'absolute', left: 0, top: -32, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap', opacity: clamp01(chargeFlash)}}>
              {'恰一次'}
            </div>
          ) : null}
        </div>
        {/* 摘要卡（自整列压缩生成——缩微态，4-B 放大特写接棒） */}
        <div style={{position: 'absolute', left: 700, top: 560, opacity: clamp01(gen) * 0.9}}>
          <SummaryCard x={0} y={0} w={520} h={300} genP={gen} segP={0} bandP={0} />
        </div>
        {/* 角标（compact_history） */}
        <div style={{position: 'absolute', left: LADDER.x, top: 850, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>
          {'compact_history · 整列全量摘要'}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'前三步纯结构 · 第四步唯一花调用'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 摘要卡双段：先留档 → 双段光带 → 用户名下混排 → 滤网拦截 ─────────

const FourB: React.FC<{atArchive: number; atCard: number; atSeg: number; atUser: number; atMix: number; atWiden: number; atFilter: number; atBlocked: number; atFact: number}> = ({
  atArchive,
  atCard,
  atSeg,
  atUser,
  atMix,
  atWiden,
  atFilter,
  atBlocked,
  atFact,
}) => {
  const frame = useCurrentFrame();
  // 「先留档」完整历史整列复印进紫面留档夹（承 2-A 同形动作——规矩复现）
  const archive = useProgress(atArchive, DUR.f6, 'decelerate');
  const archiveFlash = useImpulse({at: atArchive + DUR.f5, dur: DUR.f5, peak: 1});
  // 「摘要只要事实」摘要卡亮出
  const card = useProgress(atCard, DUR.f5);
  // 「分成两段」双段展开 + 分隔光带亮起
  const seg = useProgress(atSeg, DUR.f5);
  const band = useProgress(atSeg + 5, DUR.f4);
  // 「记在用户名下」工具结果条携用户名签滑入上段侧；混排预演 + 问号 → 光带加宽
  const user = useProgress(atUser, DUR.f4);
  const mix = useProgress(atMix, DUR.f5);
  const qP = useProgress(atMix + 8, DUR.f4);
  const widen = useProgress(atWiden, DUR.f4);
  // 「防夹带」滤网落下 → 小字条撞网被拦 → 落入下段变事实记录
  const filter = useProgress(atFilter, DUR.f4);
  const smuggle = clamp01(progress(frame, atFilter + 6, DUR.f5));
  const blocked = useProgress(atBlocked, DUR.f4);
  const fact = useProgress(atFact, DUR.f4);
  return (
    <AbsoluteFill>
      {/* 阶梯缩影（右上恒驻——四格全亮，4-A 闸机点亮后承续） */}
      <StepLadder x={LADDER_MINI.x} y={LADDER_MINI.y} mode="mini" litMask={4} />
      {/* 消息列缩微（留档源）+ 复印箭头 + 留档夹（承 2-A 同形） */}
      <div style={{position: 'absolute', left: 130, top: 220}}>
        <MessageColumn x={0} y={0} w={280} rowH={46} rows={['msg', 'call', 'result', 'msg', 'call', 'result']} rowsLit={6} scale={0.85} headerLabel={'完整历史 · 整列'} />
      </div>
      <TransferArrow x={150} y={560} w={150} p={archive} lit={archive > 0.02 && archive < 0.98 ? 1 : 0} flowPhase={frame / 26} />
      <div style={{position: 'absolute', left: 100, top: 610, opacity: clamp01(archive)}}>
        <ArchiveFolder x={0} y={0} w={300} h={220} fillP={archive} rowsMax={7} flash={archiveFlash} />
      </div>
      {/* 摘要卡双段（主景） */}
      <div style={{position: 'absolute', left: 640, top: 190, opacity: clamp01(card)}}>
        <SummaryCard
          x={0}
          y={0}
          w={800}
          h={560}
          genP={1}
          segP={seg}
          bandP={band}
          bandWideP={widen}
          userTagP={user}
          mixP={mix}
          qP={qP}
          filterP={filter}
          smuggleFly={smuggle}
          blockedP={blocked}
          factP={fact}
        />
      </div>
      {/* 角标（[Compacted] 双段） */}
      <div style={{position: 'absolute', left: 640, top: 790, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>
        {'[Compacted] · 上段当前请求 / 下段对话摘要'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'先留档 · 摘要只要事实 · 防夹带'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 源码对照（换层一拍）：五函数卡 + 四条对齐线（G1 修订） ────────────

const FourC: React.FC<{atSwap: number; atFnA: number; atFnB: number; atFnC: number; atFnD: number; atFnE: number}> = ({
  atSwap,
  atFnA,
  atFnB,
  atFnC,
  atFnD,
  atFnE,
}) => {
  const frame = useCurrentFrame();
  // 「真实的」换层交叉一拍（教学装置缩回右上恒驻缩影位——四格全亮）
  const swap = useProgress(atSwap, DUR.f5 + DUR.f4);
  // 五枚函数卡 stagger 逐个亮起（归属句承载——【三】级句式）
  const fnAt = [atFnA, atFnB, atFnC, atFnD, atFnE];
  const fnLit = fnAt.map((a) => clamp01(progress(frame, a, DUR.f4)));
  // 对齐线接通：每亮一枚与教学管线对应步骤卡之间一条对齐线（四条——
  // contextCollapse 无教学对应、暗态旁签不接线）
  const linkLit = FUNCS.map((f, i) => (f.step >= 0 ? clamp01(progress(frame, fnAt[i] + 4, DUR.f4)) : 0));
  const FN = {x: 420, y: 170, h: 92, gap: 22} as const;
  const STEPS_X = 1240 as const;
  return (
    <AbsoluteFill>
      {/* 教学装置缩回右上恒驻缩影位（四格全亮——与 4-D→5-A morph 起点闭合） */}
      <StepLadder x={LADDER_MINI.x} y={LADDER_MINI.y} mode="mini" litMask={4 * swap} />
      {/* 换层交叉注（教学版 → 源码帧） */}
      <div style={{position: 'absolute', left: 380, top: 92, fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap', opacity: clamp01(swap)}}>
        {'教学版 → 源码执行序（换层对照）'}
      </div>
      {/* 源码对照帧：五枚函数卡（执行序竖列） */}
      {FUNCS.map((f, i) => {
        const lit = fnLit[i];
        const fy = FN.y + i * (FN.h + FN.gap);
        const noStep = f.step < 0;
        return (
          <div key={f.fn} style={{position: 'absolute', left: FN.x, top: fy, width: 560}}>
            <div
              style={{
                width: 560,
                height: FN.h,
                boxSizing: 'border-box',
                borderRadius: 10,
                border: `3px ${noStep ? 'dashed' : 'solid'} ${noStep ? withAlpha(theme.dim, 0.5) : lit > 0.4 ? theme.tool : theme.panelBorder}`,
                background: noStep ? 'transparent' : withAlpha(theme.panel, 0.95),
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 16,
                gap: 14,
                opacity: noStep ? 0.55 : 0.35 + 0.65 * lit,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 15, fontWeight: 700, color: noStep ? theme.dim : theme.tool}}>{f.line}</span>
              <span style={{fontFamily: theme.mono, fontSize: 19, fontWeight: 700, color: noStep ? theme.dim : theme.text, whiteSpace: 'nowrap'}}>{f.fn}</span>
              {/* contextCollapse 暗态旁签（教学版无对应——CC 独有） */}
              {noStep ? (
                <span style={{marginLeft: 'auto', marginRight: 12, padding: '2px 10px', borderRadius: 6, border: `2px dashed ${withAlpha(theme.dim, 0.6)}`, fontFamily: theme.sans, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap'}}>
                  {'教学版无对应 · CC 独有'}
                </span>
              ) : null}
            </div>
            {/* 对齐线（四条——接右上缩影下方的四步名签；G1 修订：跳过无对应卡） */}
            {f.step >= 0 && linkLit[i] > 0.02 ? (
              <svg width={STEPS_X - FN.x - 560} height={FN.h} viewBox={`0 0 ${STEPS_X - FN.x - 560} ${FN.h}`} style={{position: 'absolute', left: 566, top: 0, overflow: 'visible'}}>
                <line x1={4} y1={FN.h / 2} x2={(STEPS_X - FN.x - 560 - 20) * clamp01(linkLit[i])} y2={FN.h / 2} stroke={withAlpha(theme.tool, 0.85)} strokeWidth={3.5} strokeLinecap="round" strokeDasharray="9 7" />
                <path
                  d={`M ${STEPS_X - FN.x - 560 - 22} ${FN.h / 2 - 9} L ${STEPS_X - FN.x - 560 - 6} ${FN.h / 2} L ${STEPS_X - FN.x - 560 - 22} ${FN.h / 2 + 9}`}
                  fill="none"
                  stroke={theme.tool}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  opacity={clamp01(linkLit[i])}
                />
              </svg>
            ) : null}
          </div>
        );
      })}
      {/* 教学四步名签（对齐线右端——与右上缩影四格同序） */}
      {STEP_NAMES.map((nm, i) => (
        <div
          key={nm}
          style={{
            position: 'absolute',
            left: STEPS_X,
            top: FN.y + 24 + [0, 1, 2, 4][i] * (FN.h + FN.gap),
            padding: '8px 18px',
            borderRadius: 9,
            border: `2.5px solid ${i === 3 ? theme.core : theme.panelBorder}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 18,
            fontWeight: 700,
            color: i === 3 ? theme.core : theme.dim,
            whiteSpace: 'nowrap',
            opacity: clamp01(swap) * (0.5 + 0.5 * fnLit[[0, 1, 2, 4][i]]),
          }}
        >
          {nm}
        </div>
      ))}
      {/* 角标（query.ts · autoCompact）+ 归属句承载注 */}
      <div style={{position: 'absolute', left: FN.x, top: 850, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>
        {'query.ts · autoCompact · 执行序逐函数对得上'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75 * clamp01(swap)}}>
        {'真实 Claude Code · 按序对位'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D 窗口插句 + 公式卡 + 保险丝 + 原则光带预演 ────────────────────────

const FourD: React.FC<{atWindow: number; atFormula: number; atBuffer: number; atFuse: number; atBurn: number; atSweep: number}> = ({
  atWindow,
  atFormula,
  atBuffer,
  atFuse,
  atBurn,
  atSweep,
}) => {
  const frame = useCurrentFrame();
  // 「纸的总容量，行话叫窗口」草稿纸缩影外框亮起贴「窗口」签一拍即撤
  const winTag = useImpulse({at: atWindow, dur: DUR.f6, peak: 1});
  const winHold = useProgress(atWindow, DUR.f3);
  // 「阈值按精确额度」公式卡块状演算（窗口框 − 输出上限块 − 缓冲块 = 阈值线）
  const formula = useProgress(atFormula, DUR.f5);
  const minus1 = useProgress(atFormula + 6, DUR.f4);
  const minus2 = useProgress(atFormula + 12, DUR.f4);
  // 「留一万三」缓冲块旁标 13,000（数值进角标不进大字）
  const buffer = useProgress(atBuffer, DUR.f4);
  // 「连败三次」三格保险丝亮出 →「熔断」第三格烧断一拍（1–2s 重音镜）
  const fuse = useProgress(atFuse, DUR.f5);
  const burn = useProgress(atBurn, DUR.f4, 'accelerate');
  const burnFlash = useImpulse({at: atBurn + DUR.f3, dur: DUR.f6, peak: 1});
  // 「一条原则」四步卡间一道贯穿光带掠过（P5 阶梯定格预演——缩影上掠过）
  const sweep = clamp01(progress(frame, atSweep, DUR.f6));
  // 公式块几何（块状等式：宽∝量级示意、数值只进角标）
  const F = {x: 560, y: 200, bw: 300, bh: 84} as const;
  return (
    <AbsoluteFill>
      {/* 草稿纸缩影（外框亮起贴「窗口」签——一拍即撤；插句 p4-08b 承接帧） */}
      <div style={{position: 'absolute', left: 170, top: 190, width: 320}}>
        <div
          style={{
            width: 300,
            height: 210,
            boxSizing: 'border-box',
            borderRadius: 10,
            border: `3px solid ${withAlpha(theme.mech, 0.5 + 0.4 * winHold)}`,
            background: withAlpha(theme.panel, 0.8),
            position: 'relative',
            boxShadow: winHold > 0.3 ? `0 0 ${22 * winHold}px ${withAlpha(theme.mech, 0.4)}` : 'none',
          }}
        >
          <div style={{padding: '10px 12px', fontFamily: theme.sans, fontSize: 14, color: theme.mech}}>{'草稿纸 · 缩影'}</div>
          {[0, 1, 2, 3].map((k) => (
            <div key={k} style={{height: 10, width: `${86 - k * 14}%`, borderRadius: 4, background: withAlpha(theme.mech, 0.18), margin: '10px 12px 0'}} />
          ))}
          {/* 窗口签（纸的总容量=窗口——一拍即撤） */}
          {winTag > 0.03 ? (
            <div
              style={{
                position: 'absolute',
                right: -110,
                top: 60,
                padding: '6px 18px',
                borderRadius: 9,
                border: `2.5px solid ${theme.text}`,
                background: theme.panel,
                fontFamily: theme.sans,
                fontSize: 19,
                fontWeight: 700,
                color: theme.text,
                whiteSpace: 'nowrap',
                opacity: clamp01(winTag) * (winHold > 0.02 ? 1 : 0),
              }}
            >
              {'窗口 · 总容量'}
            </div>
          ) : null}
        </div>
        <div style={{marginTop: 10, fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap'}}>{'context window'}</div>
      </div>
      {/* 公式卡（图形化等式——块状演算；数值只进角标） */}
      <div style={{position: 'absolute', left: F.x, top: F.y, opacity: clamp01(formula)}}>
        <div style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 14}}>{'阈值 = 窗口 − 输出上限 − 缓冲'}</div>
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          {/* 窗口框（大块） */}
          <div style={{width: F.bw, height: F.bh, boxSizing: 'border-box', borderRadius: 10, border: `3px solid ${theme.mech}`, background: withAlpha(theme.mech, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.text}}>
            {'窗口'}
          </div>
          {/* 减号 + 输出上限块 */}
          <span style={{fontFamily: theme.mono, fontSize: 34, fontWeight: 700, color: theme.dim, opacity: minus1}}>{'−'}</span>
          <div style={{width: 190, height: F.bh, boxSizing: 'border-box', borderRadius: 10, border: `3px solid ${withAlpha(theme.dim, 0.85)}`, background: withAlpha(theme.dim, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.dim, opacity: 0.4 + 0.6 * minus1}}>
            {'输出上限'}
          </div>
          {/* 减号 + 缓冲块（旁标 13,000——角标口径） */}
          <span style={{fontFamily: theme.mono, fontSize: 34, fontWeight: 700, color: theme.dim, opacity: minus2}}>{'−'}</span>
          <div style={{position: 'relative', width: 150, height: F.bh, boxSizing: 'border-box', borderRadius: 10, border: `3px solid ${withAlpha(theme.dim, 0.85)}`, background: withAlpha(theme.dim, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.dim, opacity: 0.4 + 0.6 * minus2}}>
            {'缓冲'}
            <span style={{position: 'absolute', right: -104, top: F.bh / 2 - 16, fontFamily: theme.mono, fontSize: 14, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', opacity: clamp01(buffer)}}>
              {'13,000 · 角标口径'}
            </span>
          </div>
          {/* 等号 + 阈值线 */}
          <span style={{fontFamily: theme.mono, fontSize: 34, fontWeight: 700, color: theme.dim, opacity: minus2}}>{'='}</span>
          <div style={{width: 200, height: 6, borderRadius: 3, background: theme.core, opacity: minus2}} />
        </div>
        <div style={{marginTop: 16, fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', opacity: minus2}}>
          {'contextWindow − maxOutputTokens − 13_000'}
        </div>
      </div>
      {/* 三格保险丝（第三格烧断——1–2s 重音镜） */}
      <div style={{position: 'absolute', left: 560, top: 560, opacity: clamp01(fuse)}}>
        <FuseCard x={0} y={0} litP={fuse} burnP={burn} burnFlash={burnFlash} />
      </div>
      {/* 阶梯缩影（右上恒驻——四格全亮；原则光带掠过= P5 预演） */}
      <StepLadder x={LADDER_MINI.x} y={LADDER_MINI.y} mode="mini" litMask={4} sweepP={sweep} />
      {/* 光带掠过注（一条原则——P5 预演） */}
      {sweep > 0.02 && sweep < 0.98 ? (
        <div style={{position: 'absolute', left: LADDER_MINI.x - 130, top: LADDER_MINI.y + 130, fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', opacity: Math.sin(Math.PI * sweep)}}>
          {'一条原则 · 浮出'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'精确阈值 · 连败三次熔断'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P4CompactStep: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p4-01', 'p4-02');
  const bB = w('p4-03', 'p4-06');
  const bC = w('p4-07', 'p4-08');
  const bD = w('p4-08b', 'p4-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <FourA
          atWrench={wa('p4-01', 0.3) - bA.from}
          atGarble={wa('p4-01', 0.68) - bA.from}
          atFly={wa('p4-02', 0.3) - bA.from}
          atDrop={wa('p4-02', 0.58) - bA.from}
          atGate={wa('p4-02', 0.74) - bA.from}
          atGen={wa('p4-02', 0.86) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FourB
          atArchive={wa('p4-03', 0.24) - bB.from}
          atCard={wa('p4-03', 0.66) - bB.from}
          atSeg={wa('p4-04', 0.36) - bB.from}
          atUser={wa('p4-05', 0.24) - bB.from}
          atMix={wa('p4-05', 0.62) - bB.from}
          atWiden={wa('p4-05', 0.9) - bB.from}
          atFilter={wa('p4-06', 0.24) - bB.from}
          atBlocked={wa('p4-06', 0.56) - bB.from}
          atFact={wa('p4-06', 0.82) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <FourC
          atSwap={wa('p4-07', 0.4) - bC.from}
          atFnA={wa('p4-08', 0.2) - bC.from}
          atFnB={wa('p4-08', 0.34) - bC.from}
          atFnC={wa('p4-08', 0.48) - bC.from}
          atFnD={wa('p4-08', 0.62) - bC.from}
          atFnE={wa('p4-08', 0.76) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <FourD
          atWindow={wa('p4-08b', 0.5) - bD.from}
          atFormula={wa('p4-09', 0.16) - bD.from}
          atBuffer={wa('p4-09', 0.42) - bD.from}
          atFuse={wa('p4-09', 0.66) - bD.from}
          atBurn={wa('p4-09', 0.88) - bD.from}
          atSweep={wa('p4-10', 0.5) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4CompactStep;
