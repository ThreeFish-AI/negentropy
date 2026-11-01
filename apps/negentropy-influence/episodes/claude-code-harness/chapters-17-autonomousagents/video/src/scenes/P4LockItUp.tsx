/** P4 补上一把锁（p4-01..p4-10，4 镜）——分镜 4-A / 4-B / 4-C / 4-D。
 *
 *  幕间转场（3-E→4-A，头注明示）：消融裁决 → 生产结构剖视属语义断裂，走幕界
 *  SceneFade + 拉远重锚（承 ep2 3-C→4-A / ep15/ep16 形态）；位置呼应：3-E 末帧
 *  锁形问号屏位 = 4-A 首帧「写名间」门位（问号在此落成两道闩——悬念兑现）；
 *  环体/值班钟同款签名跨镜恒常。
 *
 *  叙事链：4-A 开帧走查舞台全局一拍（全景坐标锚）→ @pushIn 推近锁结构剖视图：
 *  p4-01「拆成两步」隔墙立起、扫描间/写名间两房间分立 → p4-02「扫描，只负责
 *  把卡挑出来」扫描间快照卡弹出（只读不动手）、「写名字，锁进」写名间亮出 +
 *  门口单人通道图示（一次只许一个人进）→ p4-03「门有两道闩」两道闩先后扣上
 *  （进程锁闩落机体内部位 / 文件锁闩落磁盘文件位——两把锁各管一层）→ p4-04
 *  「进门先重读一遍卡」门内提示牌亮出 + 卡面重扫一遍、「掐死」隔墙上 3-A 同款
 *  裂缝愈合焊死（窗口闭合动画，重音镜）→ 4-B 真实版认领流程条：p4-05 流程条
 *  亮出、「也包在文件锁里」文件锁包裹框先落 → p4-06「官方文档也明说」文档页
 *  角标亮起、「防的，就是同时抢任务」双箭头相撞小图一闪 → p4-07 五步节点
 *  逐节点亮（次序=口播点名次序）、「一口气锁完」洋红括弧一次性框住全条（重音
 *  镜——五步一括弧即原子性）→ 4-C 退避重试+节奏对照：p4-08「抢不到锁就退避
 *  重试」写名箭头撞闩弹回沿回环绕行（撞→弹→绕→再试一拍可读）、「最多三十次」
 *  三十格刻度带立起、「五到一百毫秒」表盘刻度亮出 → p4-09「约五百毫秒一轮」
 *  快拍对照条点亮（真实版快闪对照教学版慢摆——唯一差异=节奏）、「还不设固定
 *  超时」超时表盘位虚化成无上限符号 → 4-D 天平两端对照（不裁决）：p4-10 左盘
 *  计价器滴答走字一拍（空转烧钱具象）、右盘常亮灯亮、「记忆从头重建」积木堆
 *  再摞一块（重建成本具象）；天平全程停在中间不打摆。
 *
 *  空间契约：两房间左右恒定（扫描左 / 写名右）、两道闩为唯一洋红新增件、
 *  裂缝愈合位与 3-A 裂缝同款同向、单人通道同时只容一人宽度可读、五步点亮
 *  次序=口播点名次序、括弧为一次性整体框住（一口气语义非逐段）、刻度带 30 格
 *  与口播一致（未重试满禁亮满）、对照条两版钟样同款异速、五百毫秒带「约」
 *  口径（~500ms）、天平恒平不打摆（不裁决）、积木堆禁倒塌。
 *  红线落实：扫描间禁长出写名动作（职责分离）、闩在 p4-03 前禁预扣、窗口
 *  愈合禁无轨迹、两闩图标禁同位叠放、五步一次全亮禁（幻灯片式）、括弧逐段
 *  分框禁（反原子语义）、对照条禁渲染优劣裁决、任一盘下沉禁（X-001 逆「不
 *  裁决」旁白）；词落位 = wa(id,f)；y≥56 / bottom≥176（长角标 bottom 210）。
 *
 *  承接登记：4-D→5-A SceneFade（生产对照→收束定格属语义断裂）；值班钟以
 *    主装置签名 + 环体〔M-001〕同形回归（镜间身份恒常，非 morph）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  BacktrackLoop,
  BalanceScale,
  CrackGap,
  FiveStepBracket,
  LoopRing,
  MsDial,
  RetryBand,
  TwoLatchDoor,
  WallTaskCard,
  PaceContrastBar,
  pendSwing,
} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 4-A 锁结构剖视：扫描间 / 写名间 + 两道闩 + 裂缝焊死 ──────────────────────

/** 4-A 布局（安全带红线：房间底 210+420=630、门底 250+340+通道 ~650、环顶角
 *  底 180，恒 ≤ 860。 */
const ROOMS_4A = {
  scan: {x: 330, y: 210, w: 440, h: 420},
  write: {x: 1150, y: 210, w: 440, h: 420},
  wall: {x: 790, y: 210, w: 340, h: 420},
  door: {x: 885, y: 258, w: 150, h: 330},
  crack: {x: 960, y: 214, h: 40},
  ring: {x: 1750, y: 36, size: 140},
} as const;

const FourA: React.FC<{
  atSplit: number;
  atScan: number;
  atSnap: number;
  atWriteRoom: number;
  atLane: number;
  atLatchA: number;
  atLatchB: number;
  atHint: number;
  atRescan: number;
  atSeal: number;
}> = ({atSplit, atScan, atSnap, atWriteRoom, atLane, atLatchA, atLatchB, atHint, atRescan, atSeal}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 开帧走查舞台全局一拍（全景坐标锚——pushIn 起退场）
  const wide = 1 - clamp01(progress(frame, 10, 14));
  // 推近锁结构主角（@pushIn——4-A 运镜登记处）
  const push = usePushIn(10, {scale: 0.07, dur: 26});
  // 隔墙立起、两房间分立（拆成两步）
  const split = clamp01(progress(frame, atSplit, 18));
  const wallRise = clamp01(progress(frame, atSplit - 4, 16));
  // 扫描间演示（快照卡弹出——只读不动手）
  const scanLit = clamp01(progress(frame, atScan, 12));
  const snap = clamp01(progress(frame, atSnap, 16));
  // 写名间亮出 + 单人通道
  const writeLit = clamp01(progress(frame, atWriteRoom, 12));
  const lane = clamp01(progress(frame, atLane, 12));
  // 两道闩先后扣上（进程锁 → 文件锁——两把锁各管一层）
  const latchA = clamp01(progress(frame, atLatchA, 12));
  const latchB = clamp01(progress(frame, atLatchB, 12));
  // 门内提示牌 + 卡面重扫一遍（锁内重读防 TOCTOU）
  const hint = clamp01(progress(frame, atHint, 12));
  const rescan = Math.sin(Math.PI * clamp01(progress(frame, atRescan, 22)));
  // 裂缝愈合焊死（窗口闭合动画——与 3-A 裂缝同款同向，前后呼应重音镜）
  const seal = clamp01(progress(frame, atSeal, 20));
  const sealFlash = Math.sin(Math.PI * clamp01(progress(frame, atSeal, 30)));
  return (
    <AbsoluteFill style={{transform: push, transformOrigin: '50% 40%'}}>
      {/* 开帧走查舞台缩微（全局关系一拍——任务墙+编队+认领位） */}
      <div style={{position: 'absolute', left: 700, top: 130, opacity: wide * 0.6, transform: `scale(${0.5 + 0.5 * wide})`, transformOrigin: '50% 0%'}}>
        <div style={{display: 'flex', gap: 26}}>
          {['初稿', '配图', '排版', '发布'].map((t) => (
            <WallTaskCard key={`mw${t}`} x={0} y={0} w={170} h={110} id="task_005" title={t} micro greenP={1} />
          ))}
        </div>
      </div>
      {/* 环体〔M-001〕缩悬剖视图顶角（坐标锚） */}
      <div style={{position: 'absolute', left: ROOMS_4A.ring.x, top: ROOMS_4A.ring.y}}>
        <LoopRing size={ROOMS_4A.ring.size} nodes={[]} showExit={false} showLabels={false} dotProgress={((frame / (fps * 2.5)) % 1 + 1) % 1} />
      </div>
      {/* 扫描间（左——只出候选快照） */}
      <div style={{position: 'absolute', left: ROOMS_4A.scan.x, top: ROOMS_4A.scan.y, width: ROOMS_4A.scan.w, height: ROOMS_4A.scan.h, opacity: split}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 16,
            border: `3px solid ${withAlpha(theme.dim, 0.7)}`,
            background: withAlpha(theme.panel, 0.94),
          }}
        >
          <div style={{position: 'absolute', left: 0, right: 0, top: 18, textAlign: 'center', fontFamily: theme.sans, fontSize: 25, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
            扫描间
          </div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 56, textAlign: 'center', fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>
            只出候选快照
          </div>
          {/* 快照卡弹出（只读不动手——dashed 只读签） */}
          <div
            style={{
              position: 'absolute',
              left: 90,
              top: 150,
              width: 260,
              height: 150,
              borderRadius: 11,
              border: `3px ${snap > 0.3 ? 'solid' : 'dashed'} ${withAlpha(theme.watch, 0.4 + 0.5 * snap)}`,
              background: withAlpha(theme.panel, 0.97),
              opacity: scanLit * (0.35 + 0.65 * snap),
              transform: `translateY(${(1 - snap) * 22}px)`,
              padding: '14px 16px',
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'task_009 · 快照'}</div>
            <div style={{margin: '12px 0 0', height: 9, borderRadius: 3, background: withAlpha(theme.dim, 0.32)}} />
            <div style={{margin: '8px 0 0', height: 9, width: '58%', borderRadius: 3, background: withAlpha(theme.dim, 0.22)}} />
            <div style={{position: 'absolute', right: 12, bottom: 10, fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>只读</div>
          </div>
        </div>
      </div>
      {/* 隔墙（两房间之间——3-A 同款裂缝焊死位在墙上段） */}
      <div
        style={{
          position: 'absolute',
          left: ROOMS_4A.wall.x,
          top: ROOMS_4A.wall.y,
          width: ROOMS_4A.wall.w,
          height: ROOMS_4A.wall.h * wallRise,
          borderRadius: 10,
          border: `2.5px dashed ${withAlpha(theme.panelBorder, 0.9)}`,
          background: withAlpha(theme.panel, 0.55),
          opacity: split,
        }}
      >
        <div style={{position: 'absolute', left: 0, right: 0, top: 54, textAlign: 'center', fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
          两步之间
        </div>
      </div>
      <CrackGap x={ROOMS_4A.crack.x} y={ROOMS_4A.crack.y} h={ROOMS_4A.crack.h} openP={1} sealP={seal} />
      {/* 写名间（右——门上两道闩 + 门内重读提示牌） */}
      <div style={{position: 'absolute', left: ROOMS_4A.write.x, top: ROOMS_4A.write.y, width: ROOMS_4A.write.w, height: ROOMS_4A.write.h, opacity: split * writeLit}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 16,
            border: `3px solid ${withAlpha(theme.lock, 0.4 + 0.45 * writeLit)}`,
            background: withAlpha(theme.panel, 0.94),
            boxShadow: sealFlash > 0.03 ? `0 0 ${28 * sealFlash}px ${withAlpha(theme.lock, 0.35 * sealFlash)}` : 'none',
          }}
        >
          <div style={{position: 'absolute', left: 0, right: 0, top: 18, textAlign: 'center', fontFamily: theme.sans, fontSize: 25, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
            写名间
          </div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 56, textAlign: 'center', fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>
            {'task_store_lock'}
          </div>
          {/* 卡面重扫一遍（锁内重读——rescan 光带扫过） */}
          {rescan > 0.03 ? (
            <div
              style={{
                position: 'absolute',
                left: 60 + rescan * 300,
                top: 130,
                bottom: 90,
                width: 30,
                borderRadius: 8,
                background: `linear-gradient(90deg, transparent, ${withAlpha(theme.lock, 0.55)}, transparent)`,
                pointerEvents: 'none',
              }}
            />
          ) : null}
          <div style={{position: 'absolute', left: 60, top: 140, width: 280, height: 150, borderRadius: 11, border: `3px solid ${withAlpha(theme.panelBorder, 0.9)}`, background: withAlpha(theme.panel, 0.97), padding: '14px 16px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'task_009 · 重读'}</div>
            <div style={{margin: '12px 0 0', height: 9, borderRadius: 3, background: withAlpha(theme.dim, 0.32)}} />
          </div>
        </div>
      </div>
      {/* 写名间门（两道闩 + 单人通道——挂在隔墙中段） */}
      <TwoLatchDoor x={ROOMS_4A.door.x} y={ROOMS_4A.door.y} w={ROOMS_4A.door.w} h={ROOMS_4A.door.h} litP={split} latchAP={latchA} latchBP={latchB} hintP={hint} laneP={lane} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'task_store_lock · RLock · flock · 两把锁各管一层'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 真实版认领：五步流程条 + 文件锁包裹 + 官方文档角标 + 一口气括弧 ────────

const STEPS_4B = {x: 620, y: 150, w: 560} as const;

const FourB: React.FC<{atBar: number; atWrap: number; atDoc: number; atDocHit: number; atSteps: number[]; atBracket: number}> = ({
  atBar,
  atWrap,
  atDoc,
  atDocHit,
  atSteps,
  atBracket,
}) => {
  const frame = useCurrentFrame();
  // 流程条亮出（真实版认领）
  const bar = clamp01(progress(frame, atBar, 12));
  // 文件锁包裹框先落（真实版认领也包在文件锁里）
  const wrap = clamp01(progress(frame, atWrap, 14));
  // 官方文档页角标亮起 + 双箭头相撞小图一闪
  const doc = clamp01(progress(frame, atDoc, 12));
  const docHit = Math.sin(Math.PI * clamp01(progress(frame, atDocHit, 16)));
  // 五步节点逐节点亮（次序 = 口播点名次序——禁一次全亮）
  const steps = atSteps.map((a) => clamp01(progress(frame, a, 10)));
  // 洋红括弧一次性整体框住（一口气——一笔描成非逐段）
  const bracket = clamp01(progress(frame, atBracket, 18));
  const bracketFlash = Math.sin(Math.PI * clamp01(progress(frame, atBracket, 30)));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: STEPS_4B.x, top: STEPS_4B.y, opacity: bar}}>
        <FiveStepBracket x={0} y={0} w={STEPS_4B.w} stepsP={steps} wrapP={wrap} bracketP={bracket} docP={doc} docHitP={docHit} />
      </div>
      {/* 括弧落定重音（一口气锁完——五步一括弧即原子性） */}
      {bracketFlash > 0.03 ? (
        <div
          style={{
            position: 'absolute',
            left: STEPS_4B.x + STEPS_4B.w + 10,
            top: STEPS_4B.y + 220,
            fontFamily: theme.sans,
            fontSize: 26,
            fontWeight: 700,
            color: theme.lock,
            whiteSpace: 'nowrap',
            opacity: bracketFlash,
          }}
        >
          一口气
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'claimTaskWithBusyCheck · proper-lockfile · 文件锁防的就是同时抢任务'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 退避重试 + 节奏对照：撞闩回环 + 30 格刻度带 + 5–100ms + 快拍对照 ──────

/** 4-C 布局（安全带红线：刻度带底 640+26+角标 ~695、快拍对照条底 760+96=856，
 *  恒 ≤ 860——快拍条是全片最贴安全带的装置，下移任何常量前先核 860 线。 */
const CC = {
  loop: {x: 460, y: 320, w: 560},
  dial: {x: 230, y: 250},
  band: {x: 360, y: 640},
  pace: {x: 340, y: 760, w: 1240},
} as const;

const FourC: React.FC<{atHit: number; atBand: number; atMs: number; atPace: number; atNoLimit: number}> = ({
  atHit,
  atBand,
  atMs,
  atPace,
  atNoLimit,
}) => {
  const frame = useCurrentFrame();
  // 撞闩弹回 + 退避回环绕行（撞→弹→绕→再试一拍可读——p 单参四段）
  const loopP = clamp01(progress(frame, atHit, 66));
  // 三十格刻度带立起（基线标尺——未重试满禁亮满，lit=0 全暗格）
  const band = clamp01(progress(frame, atBand, 16));
  // 5–100ms 表盘刻度亮出
  const ms = clamp01(progress(frame, atMs, 12));
  const msSweep = clamp01(progress(frame, atMs, 40));
  // 快拍对照条点亮（真实版钟样快闪对照教学版慢摆——唯一差异=节奏）
  const pace = clamp01(progress(frame, atPace, 14));
  const slow = pendSwing(frame);
  const fast = Math.abs(Math.sin(frame / 2.2));
  // 超时表盘位虚化成无上限符号（两版纪律差——与 1-E 十二拍表盘对照）
  const noLimit = clamp01(progress(frame, atNoLimit, 14));
  return (
    <AbsoluteFill>
      <BacktrackLoop x={CC.loop.x} y={CC.loop.y} w={CC.loop.w} p={loopP} />
      <div style={{position: 'absolute', left: CC.loop.x + CC.loop.w - 96, top: CC.loop.y - 78, fontFamily: theme.sans, fontSize: 17, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>
        写名 · 抢不到锁
      </div>
      <MsDial x={CC.dial.x} y={CC.dial.y} size={150} litP={ms} dialP={msSweep} />
      <RetryBand x={CC.band.x} y={CC.band.y} lit={0} bandP={band} litP={1} />
      <PaceContrastBar x={CC.pace.x} y={CC.pace.y} w={CC.pace.w} litP={pace} slowSwing={slow} fastTick={fast} noLimitP={noLimit} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'退避重试 · 最多 30 次 · 5–100ms · 真实版 ~500ms 一轮 · 不设固定超时'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D 天平两端对照（不裁决——恒平不打摆） ────────────────────────────────────

const SCALE_4D = {x: 960, y: 300, size: 560} as const;

const FourD: React.FC<{atMeter: number; atLamp: number; atBlock: number; atLabels: number}> = ({
  atMeter,
  atLamp,
  atBlock,
  atLabels,
}) => {
  const frame = useCurrentFrame();
  // 左盘计价器滴答走字一拍（空转烧钱具象——离散走字）
  const meter = clamp01(progress(frame, atMeter, 14));
  const meterVal = Math.min(4, Math.floor(clamp01(progress(frame, atMeter, 40)) * 4) + (frame >= atMeter ? 1 : 0));
  // 右盘常亮灯亮（长驻等待）
  const lamp = clamp01(progress(frame, atLamp, 12));
  // 积木堆再摞一块（重建成本具象——离散块数 3 → 4；禁倒塌）
  const blockDrop = clamp01(progress(frame, atBlock, 16));
  const blocks = frame >= atBlock ? 4 : 3;
  // 两端短语签（≤6 字——两难选址无普适答案）
  const labels = clamp01(progress(frame, atLabels, 14));
  return (
    <AbsoluteFill>
      <BalanceScale
        x={SCALE_4D.x}
        y={SCALE_4D.y}
        size={SCALE_4D.size}
        meterP={meter}
        meterVal={meterVal}
        lampP={lamp}
        blocks={blocks}
        blockDropP={blockDrop}
        labelP={labels}
      />
      {/* 两盘怕什么的小签（计价器=怕空转 / 积木=怕重建——各配一短句，不裁决） */}
      <div style={{position: 'absolute', left: SCALE_4D.x - SCALE_4D.size / 2 + 60, top: SCALE_4D.y + 348, fontFamily: theme.mono, fontSize: 16, color: theme.danger, whiteSpace: 'nowrap', opacity: meter}}>
        怕空转 · 烧钱
      </div>
      <div style={{position: 'absolute', left: SCALE_4D.x + 60, top: SCALE_4D.y + 348, fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap', opacity: blockDrop}}>
        怕记忆从头重建
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 150, textAlign: 'center', fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap', opacity: labels}}>
        闲多久？两版选得不一样——不裁决
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'六十秒收工 ↔ 长驻等待 · 无普适答案'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P4LockItUp: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p4-01', 'p4-04');
  const bB = w('p4-05', 'p4-07');
  const bC = w('p4-08', 'p4-09');
  const bD = w('p4-10', 'p4-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <FourA
          atSplit={wa('p4-01', 0.5) - bA.from}
          atScan={wa('p4-02', 0.16) - bA.from}
          atSnap={wa('p4-02', 0.3) - bA.from}
          atWriteRoom={wa('p4-02', 0.6) - bA.from}
          atLane={wa('p4-02', 0.72) - bA.from}
          atLatchA={wa('p4-03', 0.36) - bA.from}
          atLatchB={wa('p4-03', 0.62) - bA.from}
          atHint={wa('p4-04', 0.2) - bA.from}
          atRescan={wa('p4-04', 0.32) - bA.from}
          atSeal={wa('p4-04', 0.52) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FourB
          atBar={wa('p4-05', 0.32) - bB.from}
          atWrap={wa('p4-05', 0.68) - bB.from}
          atDoc={wa('p4-06', 0.22) - bB.from}
          atDocHit={wa('p4-06', 0.6) - bB.from}
          atSteps={[0.12, 0.24, 0.36, 0.48, 0.6].map((f) => wa('p4-07', f) - bB.from)}
          atBracket={wa('p4-07', 0.8) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <FourC atHit={wa('p4-08', 0.2) - bC.from} atBand={wa('p4-08', 0.6) - bC.from} atMs={wa('p4-08', 0.84) - bC.from} atPace={wa('p4-09', 0.22) - bC.from} atNoLimit={wa('p4-09', 0.6) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <FourD atMeter={wa('p4-10', 0.32) - bD.from} atLamp={wa('p4-10', 0.5) - bD.from} atBlock={wa('p4-10', 0.82) - bD.from} atLabels={wa('p4-10', 0.12) - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4LockItUp;
