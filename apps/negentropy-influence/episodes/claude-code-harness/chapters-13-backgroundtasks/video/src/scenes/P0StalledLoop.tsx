/** P0 卡住的十分钟（p0-01..p0-07，3 镜）——分镜 0-A / 0-B / 0-C。
 *
 *  叙事链：0-A 冷启动（开篇视听合力 I-039，系列片头交棒后黑场直入全景坐标锚）：
 *  环体〔M-001〕居中偏左照常旋转 → p0-01「卡在原地」词落位一块灰黑「等待」砖
 *  自上方落下压在环「执行」段正上（RingExecSeg 压停加重 + 整环转暗 + 光点冻结
 *  ——本集病灶态建锚）→ 右侧终端窗两行命令对比：p0-02「眨眼就完」词落位上行
 *  读文件命令毫秒返回一闪即收、「十分钟能跑满」词落位下行安装命令进度条起爬
 *  （快慢两档时间感同帧对照）→ p0-03「一步动不了」词落位环体彻底静止一拍
 *  （以静写闷〔M-002〕）、「空转也在花钱」词落位一枚计费小计数器沿环缘随秒
 *  跳格（只跳格不显金额）→ 0-B 洗衣机插曲（类比 A#1 框架层）：p0-04「盯满
 *  三十分钟」词落位小人图标机前原地打转两圈 → p0-05「扔进去」「按下启动」
 *  「就走人」三词各落位一拍步进签依次点亮（stagger）、「它自己提醒」词落位
 *  洗毕提示灯自亮——三拍连演 ≤4s 即收 → 0-C 回到循环现场：环体仍被压停（承
 *  0-A 态），一块「对话协议」卡自环体旁浮起（通道形 + 结果槽位暗态轮廓——悬念
 *  留给 P1）→ p0-06「丢出去」「自己回来」两词各落位理想态虚影箭头一闪即收 →
 *  p0-07「不答应」词落位协议卡整体沉下一格、槽位暗态轮廓加重闪一拍——悬念
 *  定格，幕界 SceneFade。
 *
 *  空间契约：0-A 环体与终端窗双主体左右分置、「等待」砖压在执行段正上、进度条
 *    位于字幕安全区上方、署源角标右下恒定不抢焦；0-B 插曲语义（洗衣机 + 三拍
 *    步进签 + 提示灯 + 角注为全部元素）、环体压停态压暗驻背景一角；0-C 协议卡
 *    为唯一新增主体、槽位只亮轮廓不展开（展开留 1-A）、理想态虚影一闪即收。
 *
 *  红线落实：词落位 = wa(id,f)（⑧ 轮按句内字位比例定锚；词级 silencedetect
 *    实测复核留 ⑨ 轮 QA，超前 >0.3s 即调）；y≥56 / bottom≥176；cat / npm install
 *    只进角标不口播；计费计数器零金额；环体压停语义贯穿 P0（禁自行恢复转动）。
 *
 *  承接登记：0-C→1-A morph（storyboard 登记）——同一主体=对话协议卡，卡轮廓
 *    ＋「一次调用→一个结果」通道形跨镜保持（ProtocolCard 同件承载）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, ProtocolCard, RingExecSeg, WaitBrick} from '../components/motifs';
import {DUR, clamp01, progress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，RSI I-080 豁免登记 vibe-video.toml）：右下常驻，一次
 *  淡入后恒定不抢焦；bottom 168 避开字幕条（承 ep1–ep12 SourceCredit 形态） */
const SourceCredit: React.FC<{lit?: number}> = ({lit = 1}) => (
  <div
    style={{
      position: 'absolute',
      right: 72,
      bottom: 168,
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

// ── 0-A 冷启动：等待砖压停环体 + 快慢命令同帧对照 + 空转计费 ────────────────

/** 环体全局位（0-A/0-C 共用——压停态跨镜同位）；终端窗右侧 */
const RING_0 = {x: 300, y: 250, size: 440} as const;
const TERM = {x: 1030, y: 170, w: 780, h: 560} as const;

const ZeroA: React.FC<{atBrick: number; atFast: number; atSlow: number; atStill: number; atCost: number}> = ({atBrick, atFast, atSlow, atStill, atCost}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 等待砖落下压停（词锚 p0-01「卡在原地」——落砖即转暗停转）
  const brickDrop = clamp01(progress(frame, atBrick, 22));
  // 光点：砖落前匀速巡游、砖落后冻结（min 钳制——停转语义贯穿，禁自行恢复）
  const dotPos = (Math.min(frame, atBrick + 18) / (fps * 2.5)) % 1;
  // 整环转暗（压停态——容器透明度承载，描边色/线宽不动）
  const ringDim = clamp01(progress(frame, atBrick + 6, 16));
  // p0-03「一步动不了」：彻底静止一拍（执行段加重 + 砖下沉半格的闷感）
  const still = clamp01(progress(frame, atStill, 14));
  // 上行读文件命令：毫秒返回一闪即收（sin 一拍）
  const fastBack = Math.sin(Math.PI * clamp01(progress(frame, atFast, 12)));
  // 下行安装命令进度条：缓慢爬行（长窗线性——十分钟能跑满的时间感）
  const slowBar = clamp01(progress(frame, atSlow, 460));
  // 空转计费小计数器：随秒跳格（只跳格不显金额——planning 不量化口径）
  const costOn = clamp01(progress(frame, atCost, DUR.f4));
  const costCells = Math.min(10, Math.floor(Math.max(0, frame - atCost) / 24));
  // 执行段坐标（砖的落位——环心 + 底部扇区）
  const cx = RING_0.x + RING_0.size / 2;
  const cy = RING_0.y + RING_0.size / 2;
  const r = RING_0.size / 2 - 46;
  const brickW = 176;
  const brickX = cx - brickW / 2;
  const brickY = cy + r - 62;
  return (
    <AbsoluteFill>
      {/* 环体〔M-001〕居中偏左（陶土橙——压停转暗） */}
      <div style={{position: 'absolute', left: RING_0.x, top: RING_0.y, opacity: 1 - 0.62 * ringDim}}>
        <LoopRing size={RING_0.size} nodes={[]} showExit={false} dotProgress={dotPos} />
        {/* 「执行」段标记（压停时点亮加重——环上时点段的读法层） */}
        <RingExecSeg size={RING_0.size} segP={clamp01(progress(frame, atBrick - 4, DUR.f4))} pressP={Math.max(brickDrop, still)} labelP={clamp01(progress(frame, atBrick + 10, DUR.f4))} />
      </div>
      {/* 等待砖（灰黑——自上方落下压在执行段正上；静止拍再压实半格） */}
      <WaitBrick x={brickX} y={brickY + still * 10} w={brickW} dropP={brickDrop} />
      {/* 空转计费小计数器（沿环缘——随秒跳格，零金额） */}
      {costOn > 0.02 ? (
        <div style={{position: 'absolute', left: cx + r - 30, top: cy - 158, opacity: costOn, transform: `translateY(${(1 - costOn) * -12}px)`}}>
          <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, letterSpacing: 1, whiteSpace: 'nowrap'}}>{'空转 · 计费'}</div>
          <div style={{display: 'flex', gap: 5, marginTop: 6}}>
            {Array.from({length: 10}, (_, i) => (
              <span
                key={`cc${i}`}
                style={{
                  width: 13,
                  height: 18,
                  borderRadius: 3,
                  background: i < costCells ? withAlpha(theme.core, 0.75) : 'transparent',
                  border: `2px solid ${i < costCells ? withAlpha(theme.core, 0.8) : withAlpha(theme.dim, 0.45)}`,
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
      {/* 终端窗（右侧——两行命令对比） */}
      <div
        style={{
          position: 'absolute',
          left: TERM.x,
          top: TERM.y,
          width: TERM.w,
          height: TERM.h,
          borderRadius: 14,
          border: `3px solid ${withAlpha(theme.tool, 0.5)}`,
          background: withAlpha(theme.panel, 0.55),
          padding: '18px 26px',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: `2px solid ${withAlpha(theme.panelBorder, 0.8)}`}}>
          {[0, 1, 2].map((d) => (
            <span key={`td${d}`} style={{width: 11, height: 11, borderRadius: '50%', background: withAlpha(theme.dim, 0.5)}} />
          ))}
          <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginLeft: 8, whiteSpace: 'nowrap'}}>{'terminal'}</span>
        </div>
        {/* 上行：读文件（角标 cat）——毫秒返回一闪即收 */}
        <div style={{marginTop: 26}}>
          <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.text, whiteSpace: 'nowrap'}}>{'$ cat report.md'}</div>
          <div
            style={{
              marginTop: 10,
              padding: '7px 14px',
              borderRadius: 7,
              border: `2px solid ${withAlpha(theme.tool, 0.7)}`,
              background: withAlpha(theme.tool, 0.12),
              fontFamily: theme.mono,
              fontSize: 19,
              color: theme.tool,
              whiteSpace: 'nowrap',
              opacity: fastBack,
            }}
          >
            {'ok · 3 ms'}
          </div>
        </div>
        {/* 下行：安装（角标 npm install）——进度条缓慢爬行 */}
        <div style={{marginTop: 44}}>
          <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.text, whiteSpace: 'nowrap'}}>{'$ npm install'}</div>
          <div style={{position: 'relative', height: 34, borderRadius: 8, border: `2.5px solid ${withAlpha(theme.dim, 0.6)}`, background: withAlpha(theme.panel, 0.9), marginTop: 12}}>
            <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${slowBar * 100}%`, borderRadius: 6, background: withAlpha(theme.dim, 0.45)}} />
            <span style={{position: 'absolute', right: 10, top: 4, fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>{'…installing'}</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 8, whiteSpace: 'nowrap'}}>
            <span>{'慢'}</span>
            <span>{'0 ─────────── 10 min'}</span>
          </div>
        </div>
      </div>
      <SourceCredit lit={clamp01(progress(frame, 4, DUR.f5))} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'cat · npm install'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 洗衣机插曲：三拍步进签 + 提示灯自亮 + 小人原地打转 ──────────────────

/** 洗衣机全局位（居中偏左）；三拍步进签右列；环体压停驻背景右下角 */
const WASHER = {x: 480, y: 210, w: 400, h: 440} as const;
const STEPS_0B = [
  {k: '①', t: '衣服扔进去'},
  {k: '②', t: '按下启动'},
  {k: '③', t: '人走开'},
] as const;

/** 滚筒洗衣机小图（SVG 直陈——机身 + 圆窗滚筒 + 控制排 + 洗毕提示灯位） */
const Washer: React.FC<{drumT: number; lampP: number; litP: number}> = ({drumT, lampP, litP}) => {
  const w = WASHER.w;
  const h = WASHER.h;
  const drumR = 118;
  const dcx = w / 2;
  const dcy = h / 2 + 14;
  return (
    <div style={{position: 'absolute', left: WASHER.x, top: WASHER.y, width: w, height: h, opacity: clamp01(litP)}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 18, border: `4px solid ${withAlpha(theme.dim, 0.75)}`, background: withAlpha(theme.panel, 0.92)}} />
      {/* 控制排（顶部——旋钮两枚 + 洗毕提示灯位（待亮）） */}
      <div style={{position: 'absolute', left: 28, right: 28, top: 22, display: 'flex', alignItems: 'center', gap: 18}}>
        <span style={{width: 26, height: 26, borderRadius: '50%', border: `3px solid ${withAlpha(theme.dim, 0.7)}`}} />
        <span style={{width: 26, height: 26, borderRadius: '50%', border: `3px solid ${withAlpha(theme.dim, 0.7)}`}} />
        <span style={{flex: 1}} />
        {/* 洗毕提示灯（lampP 自亮——无人值守的完成信号，确认绿只此一处语义） */}
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: `3px solid ${lampP > 0.4 ? theme.ok : withAlpha(theme.dim, 0.6)}`,
            background: lampP > 0.4 ? theme.ok : 'transparent',
            boxShadow: lampP > 0.4 ? `0 0 ${14 * lampP}px ${withAlpha(theme.ok, 0.7)}` : 'none',
          }}
        />
        <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap'}}>{'done'}</span>
      </div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
        {/* 滚筒圆窗（外圈 + 内筒 + 提升筋随 drumT 慢转） */}
        <circle cx={dcx} cy={dcy} r={drumR + 12} fill="none" stroke={withAlpha(theme.dim, 0.55)} strokeWidth={7} />
        <circle cx={dcx} cy={dcy} r={drumR} fill={withAlpha(theme.bg, 0.9)} stroke={withAlpha(theme.panelBorder, 0.9)} strokeWidth={4} />
        <g transform={`rotate(${drumT * 360} ${dcx} ${dcy})`} opacity={0.85}>
          {[0, 120, 240].map((a) => {
            const rad = (a * Math.PI) / 180;
            return <line key={`fin${a}`} x1={dcx} y1={dcy} x2={dcx + (drumR - 14) * Math.cos(rad)} y2={dcy + (drumR - 14) * Math.sin(rad)} stroke={withAlpha(theme.dim, 0.5)} strokeWidth={6} strokeLinecap="round" />;
          })}
        </g>
        <circle cx={dcx} cy={dcy} r={20} fill="none" stroke={withAlpha(theme.dim, 0.5)} strokeWidth={5} />
      </svg>
    </div>
  );
};

const ZeroB: React.FC<{atSpin: number; atS1: number; atS2: number; atS3: number; atLamp: number}> = ({atSpin, atS1, atS2, atS3, atLamp}) => {
  const frame = useCurrentFrame();
  // 小人图标机前原地打转两圈（干等的具象——rotate 720°，A-26 禁情绪表演：图符不拟人）
  const spinP = clamp01(progress(frame, atSpin, 34));
  const spinA = spinP * 720;
  // 滚筒慢转（机械运转常速——帧驱动确定性）
  const drumT = (frame / 260) % 1;
  // 三拍步进签依次点亮（stagger 次序=口播）
  const sPs = [atS1, atS2, atS3].map((a) => clamp01(progress(frame, a, DUR.f4)));
  // 洗毕提示灯自亮
  const lamp = clamp01(progress(frame, atLamp, DUR.f4));
  // 环体压停态压暗驻背景一角（承 0-A 态——砖仍在、光点冻结）
  return (
    <AbsoluteFill>
      <Washer drumT={drumT} lampP={lamp} litP={clamp01(progress(frame, 2, DUR.f5))} />
      {/* 小人图标（机前原地打转两圈——转完即收） */}
      {spinP > 0.02 && spinP < 0.98 ? (
        <svg width={64} height={64} viewBox="0 0 64 64" style={{position: 'absolute', left: WASHER.x + WASHER.w / 2 - 150, top: WASHER.y + WASHER.h / 2 - 32, opacity: Math.sin(Math.PI * spinP)}}>
          <g transform={`rotate(${spinA} 32 32)`}>
            <circle cx={32} cy={14} r={9} fill={withAlpha(theme.dim, 0.85)} />
            <path d="M 24 26 L 40 26 L 42 52 L 35 52 L 32 38 L 29 52 L 22 52 Z" fill={withAlpha(theme.dim, 0.85)} />
          </g>
        </svg>
      ) : null}
      {/* 三拍步进签（右列——①②③ 次序=口播） */}
      <div style={{position: 'absolute', left: 1020, top: 260, display: 'flex', flexDirection: 'column', gap: 30}}>
        {STEPS_0B.map((s, i) => {
          const p = sPs[i];
          return (
            <div
              key={s.k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '12px 22px',
                borderRadius: 10,
                border: `2.5px solid ${p > 0.35 ? theme.text : withAlpha(theme.dim, 0.5)}`,
                background: p > 0.35 ? withAlpha(theme.panel, 0.95) : 'transparent',
                opacity: 0.35 + 0.65 * p,
                transform: `translateX(${(1 - p) * 20}px)`,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 24, fontWeight: 700, color: p > 0.35 ? theme.text : theme.dim}}>{s.k}</span>
              <span style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 600, color: p > 0.35 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{s.t}</span>
            </div>
          );
        })}
      </div>
      {/* A#1 失配边界角注（画面层承载不进口播——低饱和小字） */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'滚筒一次一桶 · 后台可并行多条'}
      </div>
      {/* 环体压停驻背景一角（暗层——承 0-A 态） */}
      <div style={{position: 'absolute', left: 1560, top: 560, opacity: 0.22}}>
        <LoopRing size={210} nodes={[]} showExit={false} />
        <RingExecSeg size={210} segP={1} pressP={1} />
        <WaitBrick x={210 / 2 - 42} y={210 / 2 + (210 / 2 - 46) - 30} w={84} h={30} mini />
      </div>
      <SourceCredit />
    </AbsoluteFill>
  );
};

// ── 0-C 协议悬念卡：通道形 + 槽位暗态轮廓 + 理想态虚影一闪 ──────────────────

/** 协议卡位（环体右侧——1-A 急推的 morph 起点） */
const PROTO_0C = {x: 880, y: 300, w: 600, h: 330} as const;

const ZeroC: React.FC<{atCard: number; atGhostOut: number; atGhostBack: number; atSink: number}> = ({atCard, atGhostOut, atGhostBack, atSink}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 协议卡自环体旁浮起（litP——卡为唯一新增主体）
  const cardLit = clamp01(progress(frame, atCard, DUR.f5));
  // 理想态虚影箭头各一闪即收（sin 一拍——慢命令飞出画外 / 结果回流）
  const gOut = Math.sin(Math.PI * clamp01(progress(frame, atGhostOut, 12)));
  const gBack = Math.sin(Math.PI * clamp01(progress(frame, atGhostBack, 12)));
  // p0-07「不答应」：整卡沉下一格 + 槽位暗态轮廓加重闪一拍（规矩拦路的先现）
  const sink = clamp01(progress(frame, atSink, 16));
  const sinkPulse = Math.sin(Math.PI * clamp01(progress(frame, atSink + 2, 18)));
  // 环体仍被压停（承 0-A 态——同位同形，光点冻结）
  const cx = RING_0.x + RING_0.size / 2;
  const cy = RING_0.y + RING_0.size / 2;
  const r = RING_0.size / 2 - 46;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: RING_0.x, top: RING_0.y, opacity: 0.4}}>
        <LoopRing size={RING_0.size} nodes={[]} showExit={false} dotProgress={(Math.min(frame, atCard) / (fps * 2.5)) % 1} />
        <RingExecSeg size={RING_0.size} segP={1} pressP={1} labelP={1} />
      </div>
      <WaitBrick x={cx - 88} y={cy + r - 62} w={176} dropP={1} />
      {/* 对话协议卡（通道形 + 结果槽位暗态轮廓——悬念留给 P1；1-A 同件承载 morph） */}
      <ProtocolCard
        x={PROTO_0C.x}
        y={PROTO_0C.y}
        w={PROTO_0C.w}
        h={PROTO_0C.h}
        litP={cardLit}
        slotP={sinkPulse * 0.22}
        sinkP={sink}
        ghostOutP={gOut}
        ghostBackP={gBack}
      />
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'tool_use → tool_result'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0StalledLoop: React.FC<{scene: SceneRange}> = ({scene}) => {
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
          atBrick={wa('p0-01', 0.5) - bA.from}
          atFast={wa('p0-02', 0.28) - bA.from}
          atSlow={wa('p0-02', 0.74) - bA.from}
          atStill={wa('p0-03', 0.28) - bA.from}
          atCost={wa('p0-03', 0.74) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atSpin={wa('p0-04', 0.6) - bB.from}
          atS1={wa('p0-05', 0.08) - bB.from}
          atS2={wa('p0-05', 0.28) - bB.from}
          atS3={wa('p0-05', 0.44) - bB.from}
          atLamp={wa('p0-05', 0.78) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atCard={wa('p0-06', 0.06) - bC.from}
          atGhostOut={wa('p0-06', 0.46) - bC.from}
          atGhostBack={wa('p0-06', 0.72) - bC.from}
          atSink={wa('p0-07', 0.72) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0StalledLoop;
