/** P0 没人派活的队伍（p0-01..p0-07，3 镜）——分镜 0-A / 0-B / 0-C。
 *
 *  叙事链：0-A 系列片头交棒后冷启动直入（开篇视听合力 I-039）：任务墙全景
 *  （承 ep12 已建设施同款签名——卡面同构）墙上十余张任务卡成排静挂无人认领，
 *  p0-01「没人派活」「从不停工」两词落位——静挂的卡与队长往返跑动同帧对冲
 *  〔M-005〕→ p0-02「老办法」词落位队长点名派活——跑到队友前递卡、队友接卡
 *  开工〔M-005〕→ p0-03「十个任务」词落位十张卡框选高亮、「手动派十次」词
 *  落位队长往返分发跑出残影、分发计数 1→10 离散递增（服务完本拍即收
 *  〔M-006〕）、「撑不大」词落位残影越拉越长定格（瓶颈具象，重音镜）→
 *  0-B 推近队伍：p0-04「自己看板」「自己认领」两词落位两名队友各自转身面向
 *  任务墙（视线自连）→ p0-05「值班钟」词落位两座小钟先后点亮、随即同步起摆
 *  （重音镜 1–2s punch——本集主装置首亮，主题色①首亮）〔M-005〕→ 0-C 首拍
 *  全流程微演：p0-06「每五秒敲一拍」词落位钟摆以五秒节拍落第一次（零强调
 *  动效）、「先看信，再看板」词落位两落点先后探到（信箱格口→任务墙，次序
 *  即机制）、「写名领走」词落位名字签落卡→ p0-07「最深的坑」词落位暗纹自
 *  钟面边缘渗出一圈、整镜压暗半档定格（悬念钩，P3 接棒位）〔M-003〕。
 *
 *  空间契约：任务墙与编队位于字幕安全区上方（装置底边 y≤860——0-B 队友环
 *  底边 700 / 0-C 落点签底边 826，常量注释见各布局块）、署源角标右下角恒定
 *  不抢焦、计数与口播数字一致（十张/十次，计数离散给值）、天蓝为 0-B 起唯一
 *  新增色、两钟同款等大、起摆后节律恒同步、队长侧无钟。
 *  红线落实：静止纯文字卡禁（每拍有状态推进）、计数禁越过 10、角标禁进字幕
 *  区、钟禁长出调度别人的元素、两钟节律禁互异、暗纹禁具象成机制图形（坑
 *  留给 P3 正源）；词落位 = wa(id,f)；y≥56 / bottom≥176（长角标 bottom 210）。
 *
 *  承接登记：0-C→1-A morph（同一主体 = 队友机体〔天蓝值班钟+品红环体签名〕：
 *  0-C 末帧机体在卡前写名、灯翻暖白=回干活 → 1-A 首帧同一机体放大居中、胸口
 *  三格状态灯立起——放大过程值班钟屏位、天蓝描边、环体转速逐帧不变，仅机体
 *  尺度与新增灯条变化。见 P1Clockwork 头注 morph 段）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  AgentBody,
  ConditionLamps,
  DUTY_GEO,
  DutyClock,
  LoopRing,
  NameTag,
  pendSwing,
  TeammateRing,
  useRingDot,
} from '../components/motifs';
import {DUR, clamp01, progress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，豁免登记于工作区配置）：右下常驻，一次淡入后恒定
 *  不抢焦；bottom 176 避开字幕条（承 ep1–ep16 SourceCredit 形态） */
const SourceCredit: React.FC<{lit?: number}> = ({lit = 1}) => (
  <div
    style={{
      position: 'absolute',
      right: 72,
      bottom: 176,
      fontFamily: theme.mono,
      fontSize: 22,
      letterSpacing: 1,
      color: theme.dim,
      opacity: 0.85 * clamp01(lit),
    }}
  >
    Learn Claude Code
  </div>
);

// ── 0-A 冷启动：任务墙全景 + 队长点名派活瓶颈 ───────────────────────────────

/** 任务墙（卡面承 ep12 同款签名——编号签 + 名签位 + 状态徽点的微缩形）。
 *  安全带红线（ep15 底环侵入返工教训）：wall y 130 + 2 行 ×（92+16）= 底边
 *  346，恒 ≤ 860；往下挪任一常量须同步核算。 */
const WALL_0A = {x: 120, y: 130, cols: 6, rows: 2, w: 150, h: 92, gap: 16} as const;
const TRACK_0A = {x1: 330, x2: 1240, y: 596} as const;
/** 编队（右侧两队友——mate 环底边 470+200=670 恒 ≤ 860） */
const MATES_0A = [
  {x: 1330, y: 470, size: 200},
  {x: 1600, y: 470, size: 200},
] as const;
const LEAD_RING_0A = {size: 170} as const;

/** 墙上 12 张待认领卡（十张 + 两张——编号签 + 暗名签条，无人认领态） */
const WallMini: React.FC<{x: number; y: number; id: string; lit: number; selP: number}> = ({x, y, id, lit, selP}) => {
  const sel = clamp01(selP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: WALL_0A.w, height: WALL_0A.h, opacity: lit}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 9,
          border: `2.5px solid ${sel > 0.3 ? withAlpha(theme.text, 0.85) : withAlpha(theme.panelBorder, 0.95)}`,
          background: withAlpha(theme.panel, 0.92),
          boxShadow: sel > 0.3 ? `0 0 ${10 * sel}px ${withAlpha(theme.text, 0.3 * sel)}` : 'none',
        }}
      >
        <div style={{position: 'absolute', left: 10, top: 8, fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>{id}</div>
        <div style={{position: 'absolute', left: 10, top: 34, width: 96, height: 9, borderRadius: 3, background: withAlpha(theme.dim, 0.32)}} />
        <div style={{position: 'absolute', left: 10, top: 52, width: 64, height: 9, borderRadius: 3, background: withAlpha(theme.dim, 0.2)}} />
        <div style={{position: 'absolute', right: 10, top: 10, width: 11, height: 11, borderRadius: '50%', border: `2.5px solid ${withAlpha(theme.dim, 0.55)}`}} />
      </div>
    </div>
  );
};

/** 分段积分位移（纯函数帧算——队长往返的分段速度表：起跑/递卡慢/分发快/
 *  撑不大停）；pingpong 折返。 */
const integratedRun = (frame: number, segs: readonly {at: number; v: number}[]): number => {
  let d = 0;
  let prev = segs[0].at;
  let v = segs[0].v;
  for (let i = 1; i < segs.length; i += 1) {
    const span = Math.max(0, Math.min(frame, segs[i].at) - prev);
    d += v * span;
    prev = segs[i].at;
    v = segs[i].v;
  }
  return d + v * Math.max(0, frame - prev);
};
const pingpong = (d: number, len: number): number => {
  const m = ((d % (2 * len)) + 2 * len) % (2 * len);
  return m < len ? m : 2 * len - m;
};

const ZeroA: React.FC<{
  atRun: number;
  atOld: number;
  atHand: number;
  atWork: number;
  atTen: number;
  atTenTimes: number;
  atStretch: number;
  beatEnd: number;
}> = ({atRun, atOld, atHand, atWork, atTen, atTenTimes, atStretch, beatEnd}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dot = useRingDot(2.5);
  // 十卡框选高亮（「十个任务」——12 张中前 10 张 stagger 选中）
  const selAt = atTen;
  const sel = (i: number) => clamp01(progress(frame, selAt + i * 2, 8));
  // 队长往返（分段速度：p0-01 起跑 3.2px/帧 → p0-02 递卡期 0.6 → 派十次 7.5 → 撑不大 0）
  const runSegs = [
    {at: 0, v: 0},
    {at: atRun, v: 3.2},
    {at: atOld, v: 0.6},
    {at: atTenTimes, v: 7.5},
    {at: atStretch, v: 0},
  ] as const;
  const trackLen = TRACK_0A.x2 - TRACK_0A.x1;
  const runX = TRACK_0A.x1 + pingpong(integratedRun(frame, runSegs), trackLen);
  // 递卡期偏向队友（blend 到队友侧——递卡/回轨的往返可读）
  const toMate = clamp01(progress(frame, atHand - 10, 14)) * (1 - clamp01(progress(frame, atTenTimes - 8, 12)));
  const mateHandX = MATES_0A[0].x - 60;
  const leadX = runX * (1 - toMate) + (mateHandX - 30) * toMate;
  // 递出的任务卡（lead 手中 → 队友一胸口；飞行弧避让环体）
  const handFly = clamp01(progress(frame, atHand + 8, 16));
  const cardX = leadX + 46 + (MATES_0A[0].x + 40 - (leadX + 46)) * handFly;
  const cardY = TRACK_0A.y - 26 - Math.sin(Math.PI * handFly) * 120;
  // 队友一接卡开工（环体加速 + 状态点亮）
  const mate1Work = clamp01(progress(frame, atWork, 12));
  const mateDot = ((frame / (fps * (2.5 - 1.1 * mate1Work))) % 1 + 1) % 1;
  // 分发计数 1→10（离散：派十次窗口内逐张落卡递增，服务完本拍即收）
  const dispatchSpan = Math.max(30, atStretch - atTenTimes - 14);
  const stride = dispatchSpan / 10;
  const delivered = Math.min(10, Math.max(0, Math.floor((frame - (atTenTimes + 10)) / stride) + (frame >= atTenTimes + 10 ? 1 : 0)));
  const counterLit = clamp01(progress(frame, atTenTimes + 8, 8)) * (1 - clamp01(progress(frame, beatEnd - 10, 8)));
  // 残影（分发期跑出——copies at frame - k·lag；撑不大起 lag 越拉越长 + 更多影）
  const stretch = clamp01(progress(frame, atStretch, 18));
  const ghostN = 2 + Math.round(stretch * 3);
  const lag = 7 + 8 * stretch;
  // 「撑不大」定格拍（残影拉长后整组静止一拍）
  const freezeGlow = Math.sin(Math.PI * clamp01(progress(frame, atStretch + 16, 26)));
  return (
    <AbsoluteFill>
      {/* 任务墙（承 ep12 卡面签名——十余张待认领） */}
      {Array.from({length: WALL_0A.rows * WALL_0A.cols}, (_, i) => {
        const col = i % WALL_0A.cols;
        const row = Math.floor(i / WALL_0A.cols);
        return (
          <WallMini
            key={`wc${i}`}
            x={WALL_0A.x + col * (WALL_0A.w + WALL_0A.gap)}
            y={WALL_0A.y + row * (WALL_0A.h + WALL_0A.gap)}
            id={`task_${String(i + 1).padStart(3, '0')}`}
            lit={clamp01(progress(frame, 2 + i * 1.5, 8))}
            selP={i < 10 ? sel(i) : 0}
          />
        );
      })}
      {/* 队长（主代理橙环〔M-001〕挂侧 + 机体——忙得团团转） */}
      {Array.from({length: ghostN}, (_, k) => {
        const gFrame = frame - (k + 1) * lag;
        if (gFrame < atRun) return null;
        const gx = TRACK_0A.x1 + pingpong(integratedRun(gFrame, runSegs), trackLen);
        return (
          <div
            key={`gh${k}`}
            style={{
              position: 'absolute',
              left: gx + 24,
              top: TRACK_0A.y + 10,
              width: 68,
              height: 84,
              borderRadius: 15,
              border: `2.5px solid ${withAlpha(theme.core, 0.28 - k * 0.045)}`,
              opacity: 0.5 - k * 0.08,
            }}
          />
        );
      })}
      <div style={{position: 'absolute', left: leadX, top: TRACK_0A.y}}>
        <LoopRing size={LEAD_RING_0A.size} nodes={[]} showExit={false} dotProgress={dot} />
        <AgentBody x={34} y={24} w={84} h={104} tone={theme.core}>
          <div
            style={{
              position: 'absolute',
              left: 22,
              top: 14,
              width: 40,
              height: 12,
              borderRadius: 6,
              border: `2.5px solid ${withAlpha(theme.core, 0.9)}`,
              background: withAlpha(theme.core, 0.25 + 0.4 * freezeGlow),
            }}
          />
        </AgentBody>
        <div style={{position: 'absolute', left: 30, top: LEAD_RING_0A.size + 16, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap'}}>
          队长 · 派活
        </div>
      </div>
      {/* 两名队友（品红环体承 ep15/ep16 签名——做完活原地立正待命） */}
      {MATES_0A.map((m, i) => (
        <div key={`mt${i}`} style={{position: 'absolute', left: m.x, top: m.y}}>
          <TeammateRing size={m.size} dotProgress={i === 0 ? mateDot : dot} />
          <AgentBody x={m.size / 2 - 42} y={34} w={84} h={104} tone={theme.mate} litP={1} droopP={i === 0 ? 0 : 0.12}>
            <div
              style={{
                position: 'absolute',
                left: 22,
                top: 14,
                width: 40,
                height: 12,
                borderRadius: 6,
                border: `2.5px solid ${i === 0 ? withAlpha(theme.text, 0.4 + 0.6 * mate1Work) : withAlpha(theme.dim, 0.7)}`,
                background: i === 0 && mate1Work > 0.4 ? withAlpha(theme.text, 0.3) : 'transparent',
              }}
            />
          </AgentBody>
          <div style={{position: 'absolute', left: m.size / 2 - 40, top: m.size + 12, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.mate, whiteSpace: 'nowrap'}}>
            {i === 0 ? `队友一${mate1Work > 0.5 ? ' · 开工' : ''}` : '队友二 · 待命'}
          </div>
        </div>
      ))}
      {/* 递出的任务卡（p0-02 点名派活——卡自队长手中飞抵队友一） */}
      {handFly > 0.02 && handFly < 0.98 ? (
        <div
          style={{
            position: 'absolute',
            left: cardX,
            top: cardY,
            width: 92,
            height: 60,
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(theme.core, 0.85)}`,
            background: withAlpha(theme.panel, 0.97),
            opacity: 1,
          }}
        >
          <div style={{padding: '8px 10px', fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>task_001</div>
          <div style={{margin: '0 10px', height: 8, borderRadius: 3, background: withAlpha(theme.dim, 0.35)}} />
        </div>
      ) : null}
      {/* 分发计数小角标（1→10 离散递增——服务完本拍即收〔M-006〕） */}
      {counterLit > 0.02 ? (
        <div style={{position: 'absolute', left: 1210, top: 470, opacity: counterLit}}>
          <span style={{fontFamily: theme.mono, fontSize: 40, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: theme.text}}>
            {`手动派 ${delivered}/10 次`}
          </span>
        </div>
      ) : null}
      <SourceCredit lit={clamp01(progress(frame, 4, DUR.f5))} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'任务墙 · 十余张卡待认领 · 队长挨个派'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 值班钟首亮：队友转身面向任务墙 + 两钟先后点亮同步起摆 ────────────────

/** 0-B 布局（安全带红线：mate 环 260 底边 380+260=640、名签底 ~700，恒 ≤ 860） */
const TURN_0B = [
  {bodyX: 560, bodyY: 430, ringX: 490, ringY: 380, ringSize: 260},
  {bodyX: 1180, bodyY: 430, ringX: 1110, ringY: 380, ringSize: 260},
] as const;
const CLOCK_0B = {size: 118, dy: 30} as const;
/** 背景墙带（视线落点——顶部暗卡带） */
const WALLSTRIP_0B = {x: 240, y: 118, n: 9, w: 150, h: 62, gap: 14} as const;

const ZeroB: React.FC<{atTurn1: number; atTurn2: number; atClock1: number; atClock2: number; atSwing: number}> = ({
  atTurn1,
  atTurn2,
  atClock1,
  atClock2,
  atSwing,
}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 两队友各自转身面向任务墙（视线自连——dashed 连线自机体头顶到墙带）
  const turn1 = clamp01(progress(frame, atTurn1, 14));
  const turn2 = clamp01(progress(frame, atTurn2, 14));
  // 两钟先后点亮 + 同步起摆（重音镜 1–2s punch——主题色①首亮）
  const lit1 = clamp01(progress(frame, atClock1, DUR.f4));
  const lit2 = clamp01(progress(frame, atClock2, DUR.f4));
  const glow = Math.sin(Math.PI * clamp01(progress(frame, atClock2 + 4, 34)));
  const swingOn = clamp01(progress(frame, atSwing, 10));
  const sw = pendSwing(frame, atSwing) * swingOn;
  return (
    <AbsoluteFill>
      {/* 背景墙带（暗卡列——视线的落点域） */}
      {Array.from({length: WALLSTRIP_0B.n}, (_, i) => (
        <div
          key={`ws${i}`}
          style={{
            position: 'absolute',
            left: WALLSTRIP_0B.x + i * (WALLSTRIP_0B.w + WALLSTRIP_0B.gap),
            top: WALLSTRIP_0B.y,
            width: WALLSTRIP_0B.w,
            height: WALLSTRIP_0B.h,
            borderRadius: 8,
            border: `2px solid ${withAlpha(theme.panelBorder, 0.8)}`,
            background: withAlpha(theme.panel, 0.7),
            opacity: 0.6,
          }}
        />
      ))}
      {/* 队长退至后景（不再派活——虚化无钟） */}
      <div style={{position: 'absolute', left: 1660, top: 170, opacity: 0.4}}>
        <LoopRing size={140} nodes={[]} showExit={false} showLabels={false} dotProgress={dot} />
        <div style={{position: 'absolute', left: 24, top: 150, fontFamily: theme.sans, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>队长 · 后景</div>
      </div>
      {/* 两名队友并立（品红环 + 胸口值班钟首亮——钟摆两落点暗态待摆） */}
      {TURN_0B.map((m, i) => {
        const turn = i === 0 ? turn1 : turn2;
        const lit = i === 0 ? lit1 : lit2;
        return (
          <div key={`tb${i}`}>
            <div style={{position: 'absolute', left: m.ringX, top: m.ringY}}>
              <TeammateRing size={m.ringSize} dotProgress={(dot + 0.33 * (i + 1)) % 1} opacity={0.95} />
            </div>
            <AgentBody x={m.bodyX} y={m.bodyY} w={120} h={160} tone={theme.mate}>
              <div style={{position: 'absolute', left: -1, top: CLOCK_0B.dy - 30, width: '100%'}}>
                <DutyClock
                  x={1}
                  y={0}
                  size={CLOCK_0B.size}
                  litP={lit}
                  swing={sw}
                  landing1P={0}
                  landing2P={0}
                  glow={i === 1 ? glow : glow * 0.6}
                />
              </div>
            </AgentBody>
            <div style={{position: 'absolute', left: m.bodyX - 8, top: m.bodyY + 168, fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.mate, whiteSpace: 'nowrap'}}>
              {i === 0 ? '队友一' : '队友二'}
            </div>
            {/* 视线自连（转身面向任务墙——dashed 连线到墙带） */}
            <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
              <line
                x1={m.bodyX + 60}
                y1={m.bodyY - 12}
                x2={m.bodyX + 60 + (WALLSTRIP_0B.x + 220 + i * 380 - (m.bodyX + 60)) * turn}
                y2={m.bodyY - 12 + (WALLSTRIP_0B.y + WALLSTRIP_0B.h + 10 - (m.bodyY - 12)) * turn}
                stroke={withAlpha(theme.dim, 0.8)}
                strokeWidth={3}
                strokeDasharray="9 8"
              />
            </svg>
          </div>
        );
      })}
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'值班钟 · 每五秒一拍 · 钟只决定自己何时再看一眼'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-C 首拍全流程微演：钟面满幅 + 两落点次序演示 + 写名 + 暗纹悬念 ───────────

/** 0-C 钟位（钟面满幅——落点签底边 ≈ 120+780+46=946？否：landY=cy+cos26°·armL
 *  +size·0.06 = 310+434+37 = 781，tagH/2=46 → 底边 827 恒 ≤ 860；常量改动须
 *  同步核算（ep15 底环 990 侵入教训）。 */
const CLOCK_0C = {x: 650, y: 120, size: 620} as const;
/** 第二落点侧的三灯卡（任务墙一张卡——三枚条件灯位；左缘与落点签净空 ≥20px） */
const DEMO_CARD_0C = {x: 1350, y: 560, w: 330, h: 220} as const;

const ZeroC: React.FC<{atBeat: number; atLook1: number; atLook2: number; atWrite: number; atDark: number}> = ({
  atBeat,
  atLook1,
  atLook2,
  atWrite,
  atDark,
}) => {
  const frame = useCurrentFrame();
  // 钟摆事件式落位（词锚驱动——先信后墙次序即机制；零强调动效的匀速摆）：
  // 中位 → 第一落点（-1，信）→ 回中 → 第二落点（+1，墙）→ 停在两落点之间偏侧
  const swing =
    frame < atLook1 + 8
      ? -clamp01(progress(frame, atBeat - 10, 18))
      : frame < atLook2 - 12
        ? -1 + clamp01(progress(frame, atLook1 + 8, 12))
        : frame < atDark - 6
          ? clamp01(progress(frame, atLook2 - 12, 18))
          : 1 - clamp01(progress(frame, atDark - 6, 16)) * 0.92;
  // 第一落点探查（格口空、闪一下——impulse 锁存至回落）
  const probe1 = Math.sin(Math.PI * clamp01(progress(frame, atLook1 - 2, 22)));
  const landing1Lit = clamp01(progress(frame, atBeat - 6, 14));
  // 第二落点（任务墙方向——灯位卡随探查亮出）
  const probe2 = Math.sin(Math.PI * clamp01(progress(frame, atLook2 + 6, 22)));
  const landing2Lit = clamp01(progress(frame, atLook2 - 10, 14));
  // 三灯卡（三枚条件灯位——齐亮后名字签落卡）
  const cardLit = clamp01(progress(frame, atLook2 + 4, 12));
  const lamps: [number, number, number] = [
    clamp01(progress(frame, atLook2 + 14, 8)),
    clamp01(progress(frame, atLook2 + 22, 8)),
    clamp01(progress(frame, atLook2 + 30, 8)),
  ];
  const writeP = clamp01(progress(frame, atWrite, 16));
  // 暗纹渗出（「认领」的坑预告——非具象图形：自钟缘渗出一圈暗晕）+ 压暗半档定格
  const ooze = clamp01(progress(frame, atDark, 26));
  const darken = clamp01(progress(frame, atDark + 8, 24)) * 0.45;
  return (
    <AbsoluteFill>
      {/* 值班钟满幅（钟摆两落点签——收件箱格口 / 任务墙方向） */}
      <DutyClock
        x={CLOCK_0C.x}
        y={CLOCK_0C.y}
        size={CLOCK_0C.size}
        litP={1}
        swing={swing}
        landing1P={landing1Lit}
        landing2P={landing2Lit}
        probe1P={probe1}
        probe2P={probe2}
      />
      {/* 第一落点旁注（空、闪一下——收件箱格口为空；置于落点签上方净空 ≥20px） */}
      {probe1 > 0.05 ? (
        <div
          style={{
            position: 'absolute',
            left: CLOCK_0C.x + 28,
            top: CLOCK_0C.y + 578,
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.dim,
            whiteSpace: 'nowrap',
            opacity: probe1,
          }}
        >
          空 · 闪一下
        </div>
      ) : null}
      {/* 第二落点侧：任务墙一张卡（三枚条件灯位 + 名字签空位） */}
      <div style={{position: 'absolute', left: DEMO_CARD_0C.x, top: DEMO_CARD_0C.y, width: DEMO_CARD_0C.w, height: DEMO_CARD_0C.h, opacity: cardLit}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.panelBorder, 0.95)}`,
            background: withAlpha(theme.panel, 0.96),
          }}
        >
          <div style={{position: 'absolute', left: 16, top: 12, fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'task_005'}</div>
          <ConditionLamps x={20} y={54} w={220} lamps={lamps} />
          <NameTag x={20} y={172} label="队友一" writeP={writeP} size={26} />
        </div>
      </div>
      {/* 暗纹渗出（钟缘一圈暗晕——坑预告，禁具象成机制图形） */}
      {ooze > 0.02 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <circle
            cx={CLOCK_0C.x + CLOCK_0C.size / 2}
            cy={CLOCK_0C.y + CLOCK_0C.size / 2}
            r={CLOCK_0C.size * DUTY_GEO.faceR + 20 + ooze * 130}
            fill="none"
            stroke={withAlpha(theme.bg, 0.9)}
            strokeWidth={26 + ooze * 40}
            opacity={0.8 * ooze}
          />
        </svg>
      ) : null}
      {/* 压暗半档定格（悬念钩——P3 接棒位） */}
      <AbsoluteFill style={{background: '#000000', opacity: darken, pointerEvents: 'none'}} />
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7 * (1 - darken)}}>
        {'每五秒一拍 · 先信后墙 · 写名领走'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0NobodyAssigns: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-05');
  const bC = w('p0-06', 'p0-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A">
        <ZeroA
          atRun={wa('p0-01', 0.62) - bA.from}
          atOld={wa('p0-02', 0.12) - bA.from}
          atHand={wa('p0-02', 0.32) - bA.from}
          atWork={wa('p0-02', 0.55) - bA.from}
          atTen={wa('p0-03', 0.22) - bA.from}
          atTenTimes={wa('p0-03', 0.45) - bA.from}
          atStretch={wa('p0-03', 0.78) - bA.from}
          beatEnd={bA.durationInFrames}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atTurn1={wa('p0-04', 0.3) - bB.from}
          atTurn2={wa('p0-04', 0.6) - bB.from}
          atClock1={wa('p0-05', 0.24) - bB.from}
          atClock2={wa('p0-05', 0.4) - bB.from}
          atSwing={wa('p0-05', 0.62) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atBeat={wa('p0-06', 0.2) - bC.from}
          atLook1={wa('p0-06', 0.42) - bC.from}
          atLook2={wa('p0-06', 0.6) - bC.from}
          atWrite={wa('p0-06', 0.86) - bC.from}
          atDark={wa('p0-07', 0.45) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0NobodyAssigns;
