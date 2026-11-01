/** P2 裁与缩（p2-01..p2-10，4 镜）——分镜 2-A / 2-B / 2-C / 2-D。
 *
 *  叙事链：2-A 开帧双平面全景一拍 → 裁切中景：消息列拉成长条、条数计数位亮
 *  50、目标刻度 30 预标〔M-005〕；「先留档完整历史」整列复印进紫面留档夹
 *  （蓝→紫箭头整列版——蓝面原列仍在，备份不腾地方）；「留头三条、尾二十六
 *  条」头三格 + 尾部一组高亮框定；「归档标记」中段收走、原位钉标记（裁掉
 *  多少 · 全文在哪两行小签）；阶梯缩影第二格点亮 → 2-B 第三步装置特写：
 *  「最近三条」尾部三格绿框锁定；「超一百二十字符」长度标尺 120 刻度一闪、
 *  逐块先复印（箭头进紫面）后折叠（蓝面原位缩成占位条）、「原文搬家按址取
 *  回」占位条路径签亮（住址语义点睛——占位条首立）；阶梯缩影第三格点亮 →
 *  2-C 左红右绿消融同屏（全片张力峰值）：双轨并置（每轨缩微消息列+缩微紫面+
 *  占位条阵）——左轨「换序」占位条成片出现、紫面空空、落盘计数 1→0、十一枚
 *  占位条逐枚灰死（路径签指向空处）、死占位计数定格 11（1–2s 重音镜）；右轨
 *  「正序」每条占位旁有磁盘副本卡（1:1 可数）；p2-08 双面同拍搜索：蓝面放大
 *  镜扫过无原文、紫面空荡、两处 ✗ 红叉落下 → 2-D 双轨收拢退暗，教训短卡
 *  （衬线）「备份在前 · 删除在后」定格、卡缘红绿双色各闪一拍（最高判裁决）；
 *  随即消息时间轴轮廓淡入一拍（分界灯未亮——P3 主角预显）；定格静持 ≥10 帧
 *  再切（A-16）。
 *
 *  空间契约：留档先于裁切（次序=口播次序）、头三格+尾部高亮组全程可见、归档
 *  标记带路径签；复印先于折叠（次序不可倒）、占位条必带路径签、最近三格全程
 *  完整；红左绿右恒定、左轨 0 份/11 处与口播一致、右轨落盘 1 份·占位带路径
 *  （副本卡与占位 1:1 可数）、双轨除步骤序外全同构（唯一变量的可核对判据）；
 *  教训短卡为唯一新增文字且 ≤12 字/行、时间轴仅轮廓不亮灯。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；snip_compact · transcript ·
 *  micro_compact · KEEP_RECENT_RESULTS · order_swap 只进角标；计数与口播/
 *  实验记录一致（0 份 / 11 处）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ArchiveFolder, ArchiveMark, LoopRing, PlaceholderStub, StepLadder, TransferArrow} from '../components/motifs';
import {AblationTrack} from '../components/motifs';
import {LADDER_MINI} from './P0FillingPaper';
import {DUR, clamp01, progress, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 长条消息列（2-A——12 行窄条；头 3 + 归档段 + 尾组 4） */
const LONG_ROWS = 12 as const;

// ── 2-A 中段裁剪：留档 → 头尾框定 → 中段收走钉标记 ──────────────────────

const TwoA: React.FC<{atCount: number; atTarget: number; atArchive: number; atKeep: number; atCut: number; atL2: number}> = ({
  atCount,
  atTarget,
  atArchive,
  atKeep,
  atCut,
  atL2,
}) => {
  const frame = useCurrentFrame();
  // 「一过五十条」条数计数亮 50；「收到三十条」目标刻度 30 预标
  const count50 = useProgress(atCount, DUR.f4);
  const target30 = useProgress(atTarget, DUR.f4);
  // 「先留档完整历史」整列复印进紫面留档夹一拍（蓝面原列仍在——备份不腾地方）
  const archive = useProgress(atArchive, DUR.f6, 'decelerate');
  const archiveFlash = useImpulse({at: atArchive + DUR.f5, dur: DUR.f5, peak: 1});
  // 「留头三条、尾二十六条」头三格 + 尾部一组高亮框定
  const keep = useProgress(atKeep, DUR.f5);
  // 「归档标记」中段收走、原位钉标记（两行小签）
  const cut = useProgress(atCut, DUR.f6, 'decelerate');
  // 阶梯缩影第二格点亮
  const l2 = useProgress(atL2, DUR.f4);
  const dot = ((frame / 80) % 1 + 1) % 1;
  const LIST = {x: 240, y: 180, w: 660, rowH: 52} as const;
  return (
    <AbsoluteFill>
      {/* 环体缩悬（全景锚） */}
      <div style={{position: 'absolute', left: 120, top: 76, opacity: 0.85}}>
        <LoopRing size={120} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {/* 阶梯缩影（第二格点亮） */}
      <StepLadder x={LADDER_MINI.x} y={LADDER_MINI.y} mode="mini" litMask={1 + l2} />
      {/* 蓝面长条消息列 */}
      <div style={{position: 'absolute', left: LIST.x, top: LIST.y, width: LIST.w}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 8}}>
          <span style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.mech}}>{'上下文 · 消息列'}</span>
          {/* 条数计数位（50 起点——词落亮） */}
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 20,
              fontWeight: 700,
              color: theme.text,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              opacity: count50,
            }}
          >
            {'50 条'}
          </span>
          {/* 目标刻度（30 预标） */}
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 14,
              color: theme.dim,
              whiteSpace: 'nowrap',
              opacity: target30,
            }}
          >
            {'目标 → 30 条'}
          </span>
        </div>
        <div style={{position: 'relative'}}>
          {Array.from({length: LONG_ROWS}, (_, i) => {
            const inHead = i < 3;
            const inTail = i >= LONG_ROWS - 4;
            const inMid = !inHead && !inTail;
            // 中段收走（归档段淡出上移）+ 头尾高亮
            const midFade = inMid ? cut : 0;
            // ⑨ QA N1：头尾同档亮度（删 i!==6 残留条件）
            const keepGlow = inHead || inTail ? keep : 0;
            return (
              <div key={i} style={{position: 'relative', height: LIST.rowH, marginBottom: 6}}>
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    boxSizing: 'border-box',
                    borderRadius: 7,
                    border: `2px solid ${inMid ? withAlpha(theme.panelBorder, 0.8) : withAlpha(theme.mech, 0.4 + 0.3 * keepGlow)}`,
                    background: inHead || inTail ? withAlpha(theme.mech, 0.05 + 0.07 * keepGlow) : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 12,
                    fontFamily: theme.mono,
                    fontSize: 12,
                    color: theme.dim,
                    opacity: (1 - midFade) * 0.92,
                    transform: `translateY(${-14 * midFade}px)`,
                    outline: keepGlow > 0.3 ? `2px solid ${withAlpha(theme.text, 0.45 * keepGlow)}` : 'none',
                  }}
                >
                  {`消息 ${i + 1}`}
                  {inHead && keepGlow > 0.3 ? <span style={{marginLeft: 10, fontFamily: theme.sans, fontSize: 11, fontWeight: 700, color: theme.text, opacity: keepGlow}}>{'头 · 保留'}</span> : null}
                  {inTail && keepGlow > 0.3 ? <span style={{marginLeft: 10, fontFamily: theme.sans, fontSize: 11, fontWeight: 700, color: theme.text, opacity: keepGlow}}>{'尾 · 保留 26 条'}</span> : null}
                </div>
              </div>
            );
          })}
          {/* 归档标记（原位钉回——中段收走后第 4..8 行区域） */}
          <div style={{position: 'absolute', left: 40, top: 3 * (LIST.rowH + 6) + 10, width: 520, opacity: clamp01(cut)}}>
            <ArchiveMark x={0} y={0} w={520} pinP={cut} cutText={'裁掉 10 条 · 收到 30'} atText={'全文在 .transcripts/'} />
          </div>
        </div>
      </div>
      {/* 蓝→紫箭头（整列版——留档复印） */}
      <TransferArrow x={930} y={330} w={210} p={archive} lit={archive > 0.02 && archive < 0.98 ? 1 : 0} flowPhase={frame / 26} />
      {/* 紫面留档夹（整列复印进夹） */}
      <ArchiveFolder x={1180} y={190} w={420} h={480} fillP={archive} rowsMax={12} flash={archiveFlash} />
      {/* 角标（snip_compact · transcript） */}
      <div style={{position: 'absolute', left: 240, top: 880, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>
        {'snip_compact · transcript 留档'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'第二步 · 先留档 再裁中段'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 第三步特写：绿框锁定 → 标尺 → 逐块复印折叠 → 路径签 ─────────────

const TwoB: React.FC<{atGreen: number; atRuler: number; atCopyA: number; atCopyB: number; atCopyC: number; atL3: number}> = ({
  atGreen,
  atRuler,
  atCopyA,
  atCopyB,
  atCopyC,
  atL3,
}) => {
  const frame = useCurrentFrame();
  // 「保住最近三条完整」尾部三格绿框锁定
  const green = useProgress(atGreen, DUR.f5);
  // 「超一百二十字符」长度标尺 120 刻度一闪
  const ruler = useImpulse({at: atRuler, dur: DUR.f6, peak: 1});
  const rulerHold = useProgress(atRuler, DUR.f3);
  // 三块旧结果逐个「先复印后折叠」（每块两段：copy → fold；次序不可倒）
  const copies = [atCopyA, atCopyB, atCopyC].map((a) => clamp01(progress(frame, a, DUR.f5)));
  const folds = [atCopyA, atCopyB, atCopyC].map((a) => clamp01(progress(frame, a + DUR.f5, DUR.f4)));
  const pathLit = [atCopyA, atCopyB, atCopyC].map((a) => clamp01(progress(frame, a + DUR.f5 + 6, DUR.f4)));
  // 阶梯缩影第三格点亮
  const l3 = useProgress(atL3, DUR.f4);
  const BLOCKS = {x: 260, y: 190, w: 560, h: 92} as const;
  return (
    <AbsoluteFill>
      {/* 阶梯缩影（第三格点亮） */}
      <StepLadder x={LADDER_MINI.x} y={LADDER_MINI.y} mode="mini" litMask={2 + l3} />
      {/* 已读旧结果块 ×3（上——逐个复印折叠）+ 最近三条绿框（下） */}
      <div style={{position: 'absolute', left: BLOCKS.x, top: BLOCKS.y, width: BLOCKS.w}}>
        <div style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.mech, marginBottom: 10}}>{'已读旧结果 · 更旧'}</div>
        {[0, 1, 2].map((i) => {
          const copy = copies[i];
          const fold = folds[i];
          return (
            <div key={i} style={{position: 'relative', height: BLOCKS.h + 14}}>
              {/* 原块（复印后折叠缩成占位条——原位） */}
              <div
                style={{
                  width: BLOCKS.w,
                  height: BLOCKS.h * (1 - 0.62 * fold),
                  boxSizing: 'border-box',
                  borderRadius: 9,
                  border: `2.5px solid ${withAlpha(theme.mech, 0.75)}`,
                  background: withAlpha(theme.mech, 0.08),
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 14,
                  fontFamily: theme.mono,
                  fontSize: 13,
                  color: theme.dim,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  opacity: 1,
                }}
              >
                {`旧结果 ${i + 1} · 超一百二十字符`}
              </div>
              {/* 占位条（折叠终点——带路径签） */}
              {fold > 0.4 ? (
                <div style={{position: 'absolute', left: 0, top: 0, width: BLOCKS.w, opacity: clamp01((fold - 0.4) * 2)}}>
                  <PlaceholderStub x={0} y={0} w={BLOCKS.w} foldP={fold} pathLit={pathLit[i]} indexTag={i + 1} />
                </div>
              ) : null}
              {/* 复印箭头（本块 → 右侧紫面；复印完成即收） */}
              {copy > 0.02 && copy < 0.95 ? <TransferArrow x={BLOCKS.w - 140} y={BLOCKS.h / 2 - 22} w={240} p={copy} lit={1} flowPhase={frame / 22} /> : null}
            </div>
          );
        })}
        {/* 长度标尺（120 刻度——一闪） */}
        {rulerHold > 0.02 ? (
          <div
            style={{
              width: 320 + 60 * rulerHold,
              height: 26,
              boxSizing: 'border-box',
              borderRadius: 6,
              border: `2.5px solid ${withAlpha(theme.dim, 0.5 + 0.5 * rulerHold)}`,
              position: 'relative',
              marginTop: 4,
              opacity: clamp01(rulerHold * 2),
              boxShadow: ruler > 0.05 ? `0 0 ${16 * clamp01(ruler)}px ${withAlpha(theme.dim, 0.5)}` : 'none',
            }}
          >
            <span style={{position: 'absolute', right: -4, top: -4, width: 3, height: 30, background: theme.danger}} />
            <span style={{position: 'absolute', right: -130, top: 2, fontFamily: theme.mono, fontSize: 13, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap'}}>
              {'120 字符 · 标尺'}
            </span>
          </div>
        ) : null}
      </div>
      {/* 最近三条结果（完整——绿框锁定，全程完整） */}
      <div style={{position: 'absolute', left: BLOCKS.x, top: 640, width: BLOCKS.w}}>
        <div style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.mech, marginBottom: 10}}>{'最近三条 · 完整'}</div>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 58,
              marginBottom: 8,
              boxSizing: 'border-box',
              borderRadius: 8,
              border: `2.5px solid ${green > 0.4 ? theme.ok : withAlpha(theme.mech, 0.5)}`,
              background: withAlpha(theme.ok, 0.06 * green),
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 14,
              gap: 12,
              fontFamily: theme.mono,
              fontSize: 13,
              color: theme.dim,
              whiteSpace: 'nowrap',
              boxShadow: green > 0.4 ? `0 0 ${10 * green}px ${withAlpha(theme.ok, 0.4)}` : 'none',
            }}
          >
            {`最近结果 ${3 - i}`}
            {green > 0.4 ? <span style={{fontFamily: theme.sans, fontSize: 11, fontWeight: 700, color: theme.ok}}>{'KEEP'}</span> : null}
          </div>
        ))}
      </div>
      {/* 紫面磁盘副本堆（复印目的地——三件逐一落账） */}
      <div style={{position: 'absolute', left: 1250, top: 190, width: 440}}>
        <div style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.archive, marginBottom: 10}}>{'磁盘 · 副本'}</div>
        {[0, 1, 2].map((i) => {
          const on = copies[i];
          return (
            <div
              key={i}
              style={{
                height: 92,
                marginBottom: 14,
                boxSizing: 'border-box',
                borderRadius: 9,
                border: `2.5px ${on > 0.3 ? 'solid' : 'dashed'} ${on > 0.3 ? theme.archive : withAlpha(theme.archive, 0.4)}`,
                background: withAlpha(theme.archive, 0.05 * on),
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 14,
                gap: 10,
                opacity: 0.3 + 0.7 * on,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.archive}}>{`副本 ${i + 1}`}</span>
              <span style={{fontFamily: theme.mono, fontSize: 11, color: theme.dim, whiteSpace: 'nowrap'}}>{'.task_outputs/…'}</span>
            </div>
          );
        })}
      </div>
      {/* 角标（micro_compact · KEEP_RECENT_RESULTS） */}
      <div style={{position: 'absolute', left: BLOCKS.x, top: 880, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>
        {'micro_compact · KEEP_RECENT_RESULTS 3'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'第三步 · 先存盘 再换占位条'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-C 换序消融（全片张力峰值）：左红右绿双轨 + 双计数位 ────────────────

const TwoC: React.FC<{atTracks: number; atSwap: number; atZero: number; atDead: number; atHold: number; atMag: number; atX: number}> = ({
  atTracks,
  atSwap,
  atZero,
  atDead,
  atHold,
  atMag,
  atX,
}) => {
  const frame = useCurrentFrame();
  // 「顺序能换吗？实测说话」双轨立起
  const tracks = useProgress(atTracks, DUR.f6, 'decelerate');
  // 「把缩短提到存盘前面」左轨步骤序倒转闪一拍（swap 步骤签 2↔3 互换）
  const swap = useImpulse({at: atSwap, dur: DUR.f6, peak: 1});
  const swapHold = useProgress(atSwap, DUR.f3);
  // 「一份变零份」左轨落盘计数 1→0（紫面空空）——数据本体：跳变值保持 ≥15 帧
  const zeroAt = clamp01(progress(frame, atZero, DUR.f3));
  const savedLeft = zeroAt > 0.5 ? '0' : '1';
  // 「十一处占位成死字」十一枚占位条逐枚灰死 + 死占位计数定格 11（1–2s 重音镜）
  const dead = clamp01(progress(frame, atDead, DUR.f6 + DUR.f4));
  const deadCount = dead > 0.02 ? String(Math.min(11, Math.floor(dead * 11.999))) : '0';
  const hold = useImpulse({at: atHold, dur: DUR.f6, peak: 0.1});
  // p2-08「上下文没有，磁盘也没有」双面同拍搜索：放大镜扫过 + 两处 ✗
  const mag = clamp01(progress(frame, atMag, DUR.f6));
  const xP = useProgress(atMag + DUR.f5, DUR.f4);
  return (
    <AbsoluteFill>
      {/* 左轨（红——换序：先缩短后落盘） */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: tracks, transform: `scale(${1 + hold * 0.04})`, transformOrigin: '32% 55%'}}>
        <AblationTrack
          x={80}
          y={150}
          w={850}
          h={680}
          mode="swap"
          accent={theme.danger}
          tag={'换序 · 先缩短'}
          sub={'order_swap'}
          stampsLit={11}
          deadP={dead * 11}
          swapFlash={swap}
          magP={mag}
          xP={xP}
          savedCount={savedLeft}
          deadCount={deadCount}
          countsLit={dead > 0.02 ? 1 : 0}
          countsFlash={hold}
        />
        {/* 步骤序倒转签（存盘↔缩短 互换——词窗一拍） */}
        <div
          style={{
            position: 'absolute',
            left: 120,
            top: 840,
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.danger,
            whiteSpace: 'nowrap',
            opacity: Math.max(swapHold, 0.55),
          }}
        >
          {'步骤序：缩短 → 存盘（倒转）'}
        </div>
      </div>
      {/* 右轨（绿——正序：先落盘再缩短） */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: tracks}}>
        <AblationTrack
          x={990}
          y={150}
          w={850}
          h={680}
          mode="proper"
          accent={theme.ok}
          tag={'正序 · 先存盘'}
          sub={'baseline'}
          stampsLit={11}
          copiesLit={11}
          savedCount={'1'}
          deadCount={'0'}
          countsLit={dead > 0.02 ? 1 : 0}
        />
      </div>
      {/* 双轨立起注（实测口径） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 92, textAlign: 'center', fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: tracks}}>
        {'实测 · 换序消融（除步骤序外全同构）'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75 * tracks}}>
        {'落盘 1→0 份 · 死占位 11 处'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-D 教训定格 + 时间轴预显（P3 钩子） ────────────────────────────────

const TwoD: React.FC<{atCard: number; atEdges: number; atAxis: number}> = ({atCard, atEdges, atAxis}) => {
  const frame = useCurrentFrame();
  // 「备份永远排在删除前面」教训短卡淡入定格
  const card = useProgress(atCard, DUR.f6);
  // 「顺序即数据生死」卡缘红绿双色各闪一拍（最高判裁决视觉——1–2s 重音）
  const edgeRed = useImpulse({at: atEdges, dur: DUR.f6, peak: 1});
  const edgeGreen = useImpulse({at: atEdges + 16, dur: DUR.f6, peak: 1});
  // 「什么算旧」消息时间轴轮廓淡入一拍（欲显未显——分界灯不亮）
  const axis = useProgress(atAxis, DUR.f5);
  return (
    <AbsoluteFill>
      {/* 双轨退居暗层（残影） */}
      <div style={{position: 'absolute', inset: 0, opacity: 0.16 * clamp01(card), pointerEvents: 'none'}}>
        <AblationTrack x={80} y={170} w={850} h={660} mode="swap" accent={theme.danger} tag={'换序'} sub={'order_swap'} stampsLit={11} deadP={11} savedCount={'0'} deadCount={'11'} countsLit={1} />
        <AblationTrack x={990} y={170} w={850} h={660} mode="proper" accent={theme.ok} tag={'正序'} sub={'baseline'} stampsLit={11} copiesLit={11} savedCount={'1'} deadCount={'0'} countsLit={1} />
      </div>
      {/* 教训短卡（衬线——唯一新增文字 ≤12 字/行，不复述口播原句） */}
      <div
        style={{
          position: 'absolute',
          left: 460,
          top: 300 - 30 * clamp01(card),
          opacity: clamp01(card),
          transform: `translateY(${(1 - clamp01(card)) * 24}px)`,
        }}
      >
        <div
          style={{
            padding: '30px 56px',
            borderRadius: 14,
            border: `3px solid ${theme.text}`,
            background: theme.panel,
            position: 'relative',
            boxShadow: `0 0 ${26 * clamp01(card)}px ${withAlpha(theme.text, 0.2)}`,
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 52, fontWeight: 700, color: theme.text, letterSpacing: 6, whiteSpace: 'nowrap'}}>
            {'备份在前 · 删除在后'}
          </div>
          {/* 卡缘红绿双色（各闪一拍——消融裁决的视觉余响） */}
          <div style={{position: 'absolute', left: -8, top: 10, bottom: 10, width: 5, borderRadius: 3, background: theme.danger, opacity: clamp01(edgeRed)}} />
          <div style={{position: 'absolute', right: -8, top: 10, bottom: 10, width: 5, borderRadius: 3, background: theme.ok, opacity: clamp01(edgeGreen)}} />
        </div>
      </div>
      {/* 消息时间轴轮廓（淡入一拍——P3 主角预显：仅轮廓、无灯无块细节） */}
      {axis > 0.02 ? (
        <div style={{position: 'absolute', left: 260, top: 560, width: 1400, opacity: axis * 0.75}}>
          <div style={{height: 0, borderTop: `3.5px solid ${withAlpha(theme.dim, 0.7)}`}} />
          <div style={{display: 'flex', gap: 14, marginTop: 22}}>
            {Array.from({length: 8}, (_, i) => (
              <div
                key={i}
                style={{
                  width: 140,
                  height: 64,
                  boxSizing: 'border-box',
                  borderRadius: 8,
                  border: `2px dashed ${withAlpha(theme.dim, 0.5)}`,
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
          <div style={{marginTop: 14, fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>{'消息时间轴 · ？'}</div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'顺序即数据生死'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2SnipMicro: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-03');
  const bB = w('p2-04', 'p2-05');
  const bC = w('p2-06', 'p2-08');
  const bD = w('p2-09', 'p2-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <TwoA
          atCount={wa('p2-01', 0.24) - bA.from}
          atTarget={wa('p2-01', 0.56) - bA.from}
          atArchive={wa('p2-02', 0.14) - bA.from}
          atKeep={wa('p2-02', 0.6) - bA.from}
          atCut={wa('p2-03', 0.4) - bA.from}
          atL2={wa('p2-03', 0.78) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB
          atGreen={wa('p2-04', 0.3) - bB.from}
          atRuler={wa('p2-05', 0.14) - bB.from}
          atCopyA={wa('p2-05', 0.4) - bB.from}
          atCopyB={wa('p2-05', 0.58) - bB.from}
          atCopyC={wa('p2-05', 0.76) - bB.from}
          atL3={at('p2-05') + span('p2-05') - 12 - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC
          atTracks={wa('p2-06', 0.2) - bC.from}
          atSwap={wa('p2-06', 0.6) - bC.from}
          atZero={wa('p2-07', 0.2) - bC.from}
          atDead={wa('p2-07', 0.48) - bC.from}
          atHold={wa('p2-07', 0.86) - bC.from}
          atMag={wa('p2-08', 0.24) - bC.from}
          atX={wa('p2-08', 0.24) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="2-D">
        <TwoD atCard={wa('p2-09', 0.24) - bD.from} atEdges={wa('p2-09', 0.64) - bD.from} atAxis={wa('p2-10', 0.44) - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2SnipMicro;
