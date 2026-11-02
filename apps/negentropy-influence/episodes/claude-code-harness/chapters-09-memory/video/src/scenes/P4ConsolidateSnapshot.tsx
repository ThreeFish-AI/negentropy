/** P4 整理与回滚（p4-01..p4-08，4 镜）——分镜 4-A / 4-B / 4-C / 4-D。
 *
 *  叙事链：4-A 开帧库体全景位一拍（承 3-C 库装置同形——镜间身份恒常，坐标锚）
 *  → 推近积攒计数：库体文件格逐格填入、「攒到十条」计数器跳格至 10、触发线亮
 *  〔M-005〕→「合并重复、修正矛盾、淘汰过时」三动作签依次落下（每签一枚微演：
 *  同文卡并拢 / 矛盾卡改写 / 过时卡褪色——一拍各现）→「最多留三十条」上限标尺
 *  30 格立起 →「删光旧文件、写入全部新文件」库内旧格整层清空（待写白态）→
 *  4-B 快照三段动画特写（单句装置镜）：①拍快照——整库定照、底照缩略图浮于库侧
 *  → ②删旧写新——旧格清空、新条目逐格写入 → ③失败！——写入中途红叉、半成品格
 *  碎裂清除、按底照复原（整库回到底照状态、确认绿框勾落定〔M-003〕）；落定后
 *  静持 ≥10 帧再切 → 4-C 左红右绿消融对照：左「拆掉回滚」快照位空框、写入失败
 *  红叉、两枚卡碎裂归零（计数 2→0 数字定格 punch）、残局一格新格 + 一格空格并
 *  列、判词小签「半新半旧 · 更糟」压上；右「回滚在位」4-B 同款快照复原缩微复现
 *  （计数 2↔2 复原）→ 4-D 拉远降压全景：生产版对照卡（Dream 门控三条件——24
 *  小时时钟 / 五个会话点 / 锁图标 stagger）、梦境微光滤镜、出处角标「源码核查 ·
 *  计数随时点漂移」、压缩清场波扫过（0-C 同款同向、句尾点火——扫幅吃句尾 + 幕
 *  间余量收完）、库体稳如泰山（稳态微光）、问号签升起（末帧 = 清场后稳态 + 问号
 *  悬停——作答落在 5-B）。
 *
 *  空间契约：计数跳格与标尺刻度一致（10 触发 / 30 上限）、触发线与上限格分色分
 *    位可辨、三动作签仅关键词、整理动作不早于触发线亮、三段次序 = 口播次序、
 *    底照缩略图全程可见（复原依据）、复原终态与底照逐格一致、红左绿右、左 2→0
 *    与右 2↔2 双口径同屏可读、碎裂有轨迹、左轨无复原暗示 / 右轨无碎裂、三条件
 *    图标次序 = 口播次序、条件恰三枚、出处角标必带、库体在清场波下零位移。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥176；CONSOLIDATE_THRESHOLD =
 *  10 · consolidate · Dream · .consolidate-lock 只进角标；标尺数字与口播一致；
 *  第四枚条件图标禁。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ClearWave, ConsolidateSeal, CountRuler, MemoryVault, SnapshotFrame} from '../components/motifs';
import {DUR, clamp01, progress, useBreathe, useImpulse, useProgress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 4-A 积攒计数：格填入 → 十条触发 → 三动作签 → 三十上限 → 清空白态 ──────

const VAULT_4A = {x: 240, y: 250, w: 640, h: 400} as const;

const FourA: React.FC<{atFill: number; atTrigger: number; atSeal1: number; atSeal2: number; atSeal3: number; atCap: number; atClear: number; atRewrite: number}> = ({
  atFill,
  atTrigger,
  atSeal1,
  atSeal2,
  atSeal3,
  atCap,
  atClear,
  atRewrite,
}) => {
  const frame = useCurrentFrame();
  // 推近积攒计数（承全景位一拍后推近）
  const push = usePushIn(Math.max(0, atFill - 20), {scale: 0.05, dur: DUR.f6});
  // 文件格逐格填入 + 计数器跳格至 10（数据本体钳制禁过冲）
  const fillN = 10 * clamp01(progress(frame, atFill - 10, 40));
  // 触发线亮（10——基线标尺）
  const trigger = useProgress(atTrigger, DUR.f4);
  const triggerFlash = useImpulse({at: atTrigger, dur: DUR.f5, peak: 1});
  // 三动作签依次落下（每签一枚微演——一拍各现）
  const seal1 = clamp01(progress(frame, atSeal1, DUR.f5));
  const seal2 = clamp01(progress(frame, atSeal2, DUR.f5));
  const seal3 = clamp01(progress(frame, atSeal3, DUR.f5));
  // 上限标尺 30 格立起
  const cap = useProgress(atCap, DUR.f5);
  // 「删光旧文件、写入全部新文件」旧格整层清空（待写白态；新写入由 4-B 承接）
  const clearP = useProgress(atClear, DUR.f6);
  const rewriteP = 30 * clamp01(progress(frame, atRewrite, DUR.f6));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '34% 50%'}}>
        {/* 库体（承 3-C 同形——文件格逐格填入 → 清空 → 重写分轨） */}
        <MemoryVault x={VAULT_4A.x} y={VAULT_4A.y} w={VAULT_4A.w} h={VAULT_4A.h} doorP={0.7} ghostP={1} slotsLit={fillN} clearP={clearP} rewriteP={rewriteP} glow={triggerFlash * 0.4} />
        {/* 计数器 + 触发线 + 上限标尺（10 触发 / 30 上限——分色分位） */}
        <CountRuler
          x={960}
          y={300}
          w={760}
          cells={30}
          cellsLit={Math.max(fillN, rewriteP)}
          triggerAt={10}
          triggerLit={trigger}
          capAt={30}
          capLit={cap}
          capTag={'上限 30 条'}
          readout={`${Math.round(Math.max(fillN, rewriteP))} 条`}
          readoutLit={1}
          readoutFlash={triggerFlash}
          label={'CONSOLIDATE_THRESHOLD = 10 · consolidate'}
          accent={theme.mech}
        />
        {/* 三动作签（合并 / 修正 / 淘汰——依次落下，微演一拍各现） */}
        <ConsolidateSeal x={960} y={470} w={760} mergeP={seal1} fixP={seal2} retireP={seal3} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'攒到十条触发整理 · 删光旧文件、写入全部新文件'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 快照三段动画（单句装置镜——拍快照 / 删旧写新 / 失败复原） ───────────

const VAULT_4B = {x: 480, y: 240, w: 720, h: 430} as const;
const SNAP_4B = {x: 1300, y: 300, w: 240, h: 180} as const;

const FourB: React.FC<{atSnap: number; atWrite: number; atFail: number; atCrack: number; atRestore: number}> = ({atSnap, atWrite, atFail, atCrack, atRestore}) => {
  const frame = useCurrentFrame();
  // ①拍快照：定照闪 + 底照缩略图浮于库侧（复原依据全程可见）
  const snap = useProgress(atSnap, DUR.f4);
  const snapFlash = useImpulse({at: atSnap, dur: DUR.f5, peak: 1});
  // ②删旧写新：旧格清空 → 新条目逐格写入（写入中途 = 半成品格；格数口径与
  // 底照缩略图 5×3=15 一致——复原终态 = 底照逐格一致的帧上判据）
  const clearP = clamp01(progress(frame, atWrite, 16));
  const rewriteN = 15 * clamp01(progress(frame, atWrite + 12, 22));
  // ③失败！：写入中途红叉 → 半成品格碎裂清除 → 按底照复原
  const fail = useProgress(atFail, DUR.f4);
  const failFlash = useImpulse({at: atFail, dur: DUR.f5, peak: 1});
  const crack = clamp01(progress(frame, atCrack, DUR.f5));
  const clearSweep = clamp01(progress(frame, atCrack + 8, 14));
  const lay = clamp01(progress(frame, atRestore, 26));
  const check = useProgress(atRestore + 20, DUR.f4);
  const checkFlash = useImpulse({at: atRestore + 24, dur: DUR.f6, peak: 1});
  // 半成品碎裂（确定性六碎片——自半写格飞散）
  const frag = [
    {dx: -140, dy: -110, r: -24},
    {dx: 130, dy: -140, r: 32},
    {dx: -180, dy: 100, r: 18},
    {dx: 160, dy: 120, r: -20},
    {dx: -50, dy: -200, r: 12},
    {dx: 70, dy: 190, r: -28},
  ] as const;
  // 底照铺回后的库格（复原终态 = 底照逐格一致——15 格底照态）
  const restoredN = 15 * lay;
  return (
    <AbsoluteFill>
      {/* 库体（三段主装置：写入半程 → 碎裂 → 底照铺回） */}
      <MemoryVault
        x={VAULT_4B.x}
        y={VAULT_4B.y}
        w={VAULT_4B.w}
        h={VAULT_4B.h}
        doorP={0.85}
        ghostP={1}
        slotsLit={fail > 0.3 ? restoredN : rewriteN}
        clearP={fail > 0.3 ? 0 : clearP}
        rewriteP={fail > 0.3 ? 0 : 0}
        flash={Math.max(snapFlash, checkFlash) * 0.7}
      />
      {/* 定照闪（整库白闪一拍——快照拍下） */}
      {snapFlash > 0.04 ? (
        <div style={{position: 'absolute', left: VAULT_4B.x, top: VAULT_4B.y, width: VAULT_4B.w, height: VAULT_4B.h, background: withAlpha(theme.text, 0.28 * snapFlash), pointerEvents: 'none'}} />
      ) : null}
      {/* 底照缩略图（浮于库侧——复原依据全程可见；layP 展开铺回） */}
      <SnapshotFrame x={SNAP_4B.x} y={SNAP_4B.y - 40 * snap} w={SNAP_4B.w} h={SNAP_4B.h} snapP={snap} layP={lay} checkP={check} />
      {/* 复原绿框勾（落定在库框——复原终态 = 底照逐格一致） */}
      {check > 0.02 ? (
        <svg width={64} height={64} viewBox="0 0 64 64" style={{position: 'absolute', left: VAULT_4B.x + VAULT_4B.w - 30, top: VAULT_4B.y - 26, overflow: 'visible', opacity: check, transform: `scale(${0.7 + 0.3 * check})`}}>
          <rect x={4} y={4} width={56} height={56} rx={11} fill={theme.panel} stroke={theme.ok} strokeWidth={5} />
          <path d="M 16 32 L 27 43 L 48 20" fill="none" stroke={theme.ok} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {/* 写入失败红叉（库上——一拍砸下） */}
      {fail > 0.02 && check <= 0.02 ? (
        <svg width={120} height={120} viewBox="0 0 120 120" style={{position: 'absolute', left: VAULT_4B.x + VAULT_4B.w / 2 - 60, top: VAULT_4B.y + VAULT_4B.h / 2 - 60, overflow: 'visible', opacity: fail * (1 - lay), transform: `scale(${0.7 + 0.3 * failFlash})`}}>
          <line x1={26} y1={26} x2={94} y2={94} stroke={theme.danger} strokeWidth={11} strokeLinecap="round" />
          <line x1={94} y1={26} x2={26} y2={94} stroke={theme.danger} strokeWidth={11} strokeLinecap="round" />
        </svg>
      ) : null}
      {/* 半成品格碎裂（六碎片飞散——碎裂有轨迹） */}
      {crack > 0.02 && crack < 0.98 ? (
        frag.map((fg, i) => (
          <div
            key={`fr${i}`}
            style={{
              position: 'absolute',
              left: VAULT_4B.x + 320 + fg.dx * crack,
              top: VAULT_4B.y + 210 + fg.dy * crack - 24 * crack,
              width: 72,
              height: 48,
              borderRadius: 7,
              border: `2.5px solid ${withAlpha(theme.danger, 0.65 * (1 - crack))}`,
              background: withAlpha(theme.panel, 0.85 * (1 - crack)),
              transform: `rotate(${fg.r * crack}deg)`,
              opacity: 1 - crack,
              pointerEvents: 'none',
            }}
          />
        ))
      ) : null}
      {/* 清除扫带（碎裂后扫过半成品——红扫一拍） */}
      {clearSweep > 0.02 && clearSweep < 0.98 ? (
        <div style={{position: 'absolute', left: VAULT_4B.x, top: VAULT_4B.y + VAULT_4B.h * clearSweep, width: VAULT_4B.w, height: 26, background: `linear-gradient(${withAlpha(theme.danger, 0)}, ${withAlpha(theme.danger, 0.35)}, ${withAlpha(theme.danger, 0)})`}} />
      ) : null}
      {/* 三段步骤注（①②③——次序 = 口播次序） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 150, textAlign: 'center', fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
        {fail > 0.3 ? (lay > 0.6 ? '③ 失败 → 按底照复原' : '③ 失败！碎裂清除') : clearP > 0.5 ? '② 删旧写新（写入中途）' : '① 拍快照（底照浮出）'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'consolidate · 快照 → 删旧写新 → 失败复原'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 左红右绿消融（拆掉回滚 2→0 ↔ 回滚在位 2↔2） ──────────────────────

const AB4 = {ly: 170, lx: 90, rx: 970, w: 860, h: 620} as const;

const FourC: React.FC<{atNoSnap: number; atFail: number; atZero: number; atMess: number; atVerdict: number; atRightReplay: number}> = ({atNoSnap, atFail, atZero, atMess, atVerdict, atRightReplay}) => {
  const frame = useCurrentFrame();
  // 左轨：快照位空框（拆掉回滚）+ 写入失败红叉
  const noSnap = useProgress(atNoSnap, DUR.f4);
  const fail = useProgress(atFail, DUR.f4);
  const failFlash = useImpulse({at: atFail, dur: DUR.f5, peak: 1});
  // 两枚卡碎裂（归零——碎裂有轨迹）+ 计数 2→0（数字定格 punch）
  const zero = useProgress(atZero, DUR.f5);
  const punch = useImpulse({at: atZero + DUR.f3, dur: DUR.f6, peak: 1});
  const leftCount = Math.round(2 * (1 - zero));
  // 残局（一格新格 + 一格空格并列）+ 判词小签
  const mess = useProgress(atMess, DUR.f5);
  const verdict = useProgress(atVerdict, DUR.f4);
  // 右轨：4-B 同款快照复原缩微复现（计数 2↔2）
  const replay = useProgress(atRightReplay, DUR.f5);
  const rSnap = clamp01(progress(frame, atRightReplay, DUR.f4));
  const rFail = clamp01(progress(frame, atRightReplay + 14, DUR.f4));
  const rLay = clamp01(progress(frame, atRightReplay + 26, 24));
  const rCheck = clamp01(progress(frame, atRightReplay + 44, DUR.f4));
  const frag = [
    {dx: -120, dy: -90, r: -20},
    {dx: 110, dy: -120, r: 28},
    {dx: -150, dy: 80, r: 14},
    {dx: 140, dy: 100, r: -16},
  ] as const;
  return (
    <AbsoluteFill>
      {/* ── 左轨·拆掉回滚（警示红） ── */}
      <div style={{position: 'absolute', left: AB4.lx, top: AB4.ly, width: AB4.w, height: AB4.h, boxSizing: 'border-box', borderRadius: 16, border: `3.5px solid ${withAlpha(theme.danger, 0.55)}`, background: withAlpha(theme.panel, 0.92), padding: '14px 18px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.danger}}>{'拆掉回滚'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'无快照 · 裸写'}</span>
        </div>
        {/* 快照位空框（无底照——复原依据缺失） */}
        <div style={{position: 'relative', height: 250, marginTop: 10}}>
          <SnapshotFrame x={40} y={30} w={230} h={170} emptyP={noSnap} failP={fail * failFlash} />
          {/* 写入中卡（两枚——一次失败即碎） */}
          {[0, 1].map((k) => (
            <div
              key={`zc${k}`}
              style={{
                position: 'absolute',
                left: 330 + k * 190 + frag[k].dx * zero,
                top: 60 + frag[k].dy * zero - 20 * zero,
                width: 150,
                height: 96,
                borderRadius: 9,
                border: `2.5px solid ${withAlpha(theme.danger, 0.7 * (1 - zero))}`,
                background: withAlpha(theme.panel, 0.9 * (1 - zero)),
                transform: `rotate(${frag[k].r * zero}deg)`,
                opacity: 1 - zero,
              }}
            />
          ))}
          {/* 残局（一格新格 + 一格空格并列——半新半旧的具象） */}
          {mess > 0.02 ? (
            <div style={{position: 'absolute', left: 330, top: 60, display: 'flex', gap: 40, opacity: mess}}>
              <div style={{width: 150, height: 96, borderRadius: 9, border: `2.5px solid ${withAlpha(theme.mech, 0.7)}`, background: withAlpha(theme.mech, 0.14), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.sans, fontSize: 14, color: theme.mech}}>
                {'一格新格'}
              </div>
              <div style={{width: 150, height: 96, borderRadius: 9, border: `2.5px dashed ${withAlpha(theme.dim, 0.7)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.sans, fontSize: 14, color: theme.dim}}>
                {'一格空格'}
              </div>
            </div>
          ) : null}
        </div>
        {/* 判词小签（半新半旧 · 更糟——压上） */}
        {verdict > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: 300,
              top: 236 - 24 * verdict,
              padding: '8px 22px',
              borderRadius: 10,
              border: `3px solid ${theme.danger}`,
              background: theme.panel,
              fontFamily: theme.serif,
              fontSize: 26,
              fontWeight: 700,
              color: theme.danger,
              whiteSpace: 'nowrap',
              opacity: verdict,
              transform: `rotate(-3deg)`,
            }}
          >
            {'半新半旧 · 更糟'}
          </div>
        ) : null}
        {/* 双计数位（左 2→0 定格 punch） */}
        <CountRuler x={20} y={452} w={520} cells={6} cellsLit={leftCount} readout={`${leftCount} 条`} readoutLit={1} readoutFlash={punch} label={'一次写入失败 · 两条直接归零'} accent={theme.danger} />
      </div>
      {/* ── 右轨·回滚在位（确认绿） ── */}
      <div style={{position: 'absolute', left: AB4.rx, top: AB4.ly, width: AB4.w, height: AB4.h, boxSizing: 'border-box', borderRadius: 16, border: `3.5px solid ${withAlpha(theme.ok, 0.55)}`, background: withAlpha(theme.panel, 0.92), padding: '14px 18px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.ok}}>{'回滚在位'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'有底照 · 敢重写'}</span>
        </div>
        {/* 4-B 同款快照复原缩微复现 */}
        <div style={{position: 'relative', height: 250, marginTop: 10, opacity: replay}}>
          <SnapshotFrame x={40} y={30} w={230} h={170} snapP={rSnap} layP={rLay} checkP={rCheck} failP={rFail * 0.6} />
          {/* 库缩微（两条恒在——复原后与底照逐格一致） */}
          <MemoryVault x={330} y={30} w={340} h={180} scale={0.9} doorP={0.8} ghostP={1} slotsLit={2} label={'.memory/'} />
        </div>
        {/* 双计数位（右 2↔2 复原） */}
        <CountRuler x={20} y={452} w={520} cells={6} cellsLit={2} readout={'2 条 ↔ 2 条'} readoutLit={1} label={'同款失败 · 按底照复原'} accent={theme.ok} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'快照 · 2→0 ↔ 2↔2'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D 拉远降压：Dream 三条件卡 + 清场波 + 库体稳态 + 问号签 ───────────────

const DREAM = {x: 620, y: 190, w: 680, h: 500} as const;

const FourD: React.FC<{atCard: number; atCite: number; atClock: number; atFive: number; atLock: number; atQ: number; atWave: number; waveSpan: number}> = ({
  atCard,
  atCite,
  atClock,
  atFive,
  atLock,
  atQ,
  atWave,
  waveSpan,
}) => {
  const frame = useCurrentFrame();
  // 对照卡浮起 + 梦境微光滤镜亮
  const card = useProgress(atCard, DUR.f6);
  const dreamy = useBreathe({period: 90, amp: 0.25, base: 0.6});
  // 出处角标贴上（【三】级归属视觉承接）
  const cite = useProgress(atCite, DUR.f4);
  // 三条件 stagger：24 小时时钟 / 五个会话点 / 锁图标（次序 = 口播次序、恰三枚）
  const clock = useProgress(atClock, DUR.f4);
  const five = clamp01(progress(frame, atFive, 26));
  const lock = useProgress(atLock, DUR.f4);
  const lockFlash = useImpulse({at: atLock + DUR.f3, dur: DUR.f5, peak: 1});
  // 问号签升起（作答落在 5-B）
  const q = useProgress(atQ, DUR.f5);
  // 压缩清场波（0-C 同款同向——句尾点火，扫幅吃句尾 + 幕间余量收完）
  const wave = clamp01(progress(frame, atWave, Math.max(30, waveSpan)));
  // 库体稳态（清场波下零位移——稳态微光）
  const glow = useBreathe({period: 60, amp: 0.35, base: 0.55});
  return (
    <AbsoluteFill>
      {/* 库体（稳如泰山——左下驻位，波下零位移） */}
      <div style={{position: 'absolute', left: 150, top: 520}}>
        <MemoryVault x={0} y={0} w={380} h={220} scale={0.92} doorP={0.6} ghostP={1} slotsLit={12} glow={glow} label={'.memory/'} />
        <div style={{position: 'absolute', left: 20, top: 240, fontFamily: theme.sans, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>{'库体 · 纹丝不动'}</div>
      </div>
      {/* Dream 对照卡（生产版门控三条件） */}
      <div style={{position: 'absolute', left: DREAM.x, top: DREAM.y - 30 * card, opacity: card}}>
        <div
          style={{
            width: DREAM.w,
            height: DREAM.h,
            boxSizing: 'border-box',
            borderRadius: 18,
            border: `3.5px solid ${withAlpha(theme.mech, 0.7)}`,
            background: withAlpha(theme.panel, 0.95),
            position: 'relative',
            padding: '20px 26px',
            boxShadow: `0 0 ${34 * dreamy}px ${withAlpha(theme.mech, 0.2 + 0.12 * dreamy)}`,
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.text}}>{'真实产品的整理 · Dream'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.mech}}>{'consolidate'}</span>
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 6}}>{'低频特权 · 三道门槛全过才做'}</div>
          {/* 三条件图标位（垂直三槽——24h 时钟 / 五会话点 / 锁） */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 26, marginTop: 26}}>
            {/* ①24 小时时钟（表盘 24 刻度） */}
            <div style={{display: 'flex', alignItems: 'center', gap: 24, opacity: clock}}>
              <svg width={96} height={96} viewBox="0 0 96 96">
                <circle cx={48} cy={48} r={40} fill="none" stroke={withAlpha(theme.mech, 0.7)} strokeWidth={3.5} />
                {Array.from({length: 24}, (_, k) => {
                  const a = (k * 2 * Math.PI) / 24;
                  return <line key={`tk${k}`} x1={48 + 33 * Math.cos(a)} y1={48 + 33 * Math.sin(a)} x2={48 + 39 * Math.cos(a)} y2={48 + 39 * Math.sin(a)} stroke={withAlpha(theme.mech, 0.55)} strokeWidth={k % 6 === 0 ? 3 : 1.6} />;
                })}
                <line x1={48} y1={48} x2={48} y2={22} stroke={theme.text} strokeWidth={4} strokeLinecap="round" />
                <line x1={48} y1={48} x2={68} y2={54} stroke={theme.text} strokeWidth={3} strokeLinecap="round" />
                <circle cx={48} cy={48} r={4} fill={theme.text} />
              </svg>
              <div>
                <div style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.text}}>{'距上次 ≥ 24 小时'}</div>
                <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 2}}>{'低频 · 不抢白天的活'}</div>
              </div>
            </div>
            {/* ②五个会话点（连亮） */}
            <div style={{display: 'flex', alignItems: 'center', gap: 24, opacity: 0.45 + 0.55 * five}}>
              <svg width={96} height={56} viewBox="0 0 96 56">
                <line x1={10} y1={28} x2={86} y2={28} stroke={withAlpha(theme.mech, 0.4)} strokeWidth={2.5} />
                {[0, 1, 2, 3, 4].map((k) => {
                  const p = clamp01(five * 5 - k);
                  return <circle key={`pt${k}`} cx={10 + k * 19} cy={28} r={7} fill={p > 0.4 ? theme.mech : 'transparent'} stroke={theme.mech} strokeWidth={2.5} opacity={0.4 + 0.6 * p} />;
                })}
              </svg>
              <div>
                <div style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.text}}>{'≥ 5 个会话动过'}</div>
                <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 2}}>{'攒够了才值得整理'}</div>
              </div>
            </div>
            {/* ③锁图标（落锁） */}
            <div style={{display: 'flex', alignItems: 'center', gap: 24, opacity: lock}}>
              <svg width={96} height={86} viewBox="0 0 96 86" style={{overflow: 'visible', filter: lockFlash > 0.05 ? `drop-shadow(0 0 ${12 * lockFlash}px ${withAlpha(theme.mech, 0.6)})` : 'none'}}>
                <rect x={16} y={34} width={64} height={44} rx={9} fill={withAlpha(theme.mech, 0.18)} stroke={theme.mech} strokeWidth={4} />
                <path d={`M 30 34 V 24 a 18 18 0 0 1 36 0 V 34`} fill="none" stroke={theme.mech} strokeWidth={4} />
                <circle cx={48} cy={52} r={6} fill={theme.mech} />
                <line x1={48} y1={52} x2={48} y2={64} stroke={theme.mech} strokeWidth={4} strokeLinecap="round" />
              </svg>
              <div>
                <div style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.text}}>{'抢一把锁'}</div>
                <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 2}}>{'.consolidate-lock'}</div>
              </div>
            </div>
          </div>
          {/* 梦境微光滤镜（卡面软紫纱——呼吸极缓） */}
          <div style={{position: 'absolute', inset: 0, borderRadius: 18, background: withAlpha(theme.mech, 0.05 + 0.035 * dreamy), pointerEvents: 'none'}} />
          {/* 出处角标（【三】级归属视觉承接——必带） */}
          {cite > 0.02 ? (
            <div style={{position: 'absolute', right: 14, top: 12, padding: '2px 10px', borderRadius: 6, border: `2px solid ${withAlpha(theme.dim, 0.8)}`, background: theme.panel, fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap', opacity: cite}}>
              {'源码核查 · 计数随时点漂移'}
            </div>
          ) : null}
        </div>
      </div>
      {/* 问号签（升起——凭什么不怕压缩清场；作答落 5-B） */}
      {q > 0.02 ? (
        <div style={{position: 'absolute', left: 1420, top: 620 - 70 * q, display: 'flex', alignItems: 'center', gap: 12, opacity: q, transform: `translateY(${(1 - q) * 24}px)`}}>
          <span style={{fontFamily: theme.serif, fontSize: 56, fontWeight: 700, color: theme.mech}}>{'？'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'凭什么不怕'}</span>
        </div>
      ) : null}
      {/* 压缩清场波（0-C 同款同向——自上而下；库体在其下零位移） */}
      <ClearWave sweepP={wave} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'Dream · .consolidate-lock · 三条件全过才做'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P4ConsolidateSnapshot: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p4-01', 'p4-02');
  const bB = w('p4-03');
  const bC = w('p4-04', 'p4-05');
  const bD = w('p4-06', 'p4-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <FourA
          atFill={wa('p4-01', 0.1) - bA.from}
          atTrigger={wa('p4-01', 0.22) - bA.from}
          atSeal1={wa('p4-01', 0.42) - bA.from}
          atSeal2={wa('p4-01', 0.56) - bA.from}
          atSeal3={wa('p4-01', 0.7) - bA.from}
          atCap={wa('p4-01', 0.86) - bA.from}
          atClear={wa('p4-02', 0.3) - bA.from}
          atRewrite={wa('p4-02', 0.66) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FourB
          atSnap={wa('p4-03', 0.14) - bB.from}
          atWrite={wa('p4-03', 0.36) - bB.from}
          atFail={wa('p4-03', 0.52) - bB.from}
          atCrack={wa('p4-03', 0.6) - bB.from}
          atRestore={wa('p4-03', 0.76) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <FourC
          atNoSnap={wa('p4-04', 0.16) - bC.from}
          atFail={wa('p4-04', 0.42) - bC.from}
          atZero={wa('p4-04', 0.68) - bC.from}
          atMess={wa('p4-05', 0.24) - bC.from}
          atVerdict={wa('p4-05', 0.58) - bC.from}
          atRightReplay={wa('p4-04', 0.3) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <FourD
          atCard={wa('p4-06', 0.28) - bD.from}
          atCite={wa('p4-06', 0.72) - bD.from}
          atClock={wa('p4-07', 0.16) - bD.from}
          atFive={wa('p4-07', 0.44) - bD.from}
          atLock={wa('p4-07', 0.72) - bD.from}
          atQ={wa('p4-08', 0.18) - bD.from}
          atWave={wa('p4-08', 0.52) - bD.from}
          waveSpan={bD.durationInFrames - (wa('p4-08', 0.52) - bD.from)}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4ConsolidateSnapshot;
