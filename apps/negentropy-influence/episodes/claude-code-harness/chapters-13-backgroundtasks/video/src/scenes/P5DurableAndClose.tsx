/** P5 写下不等于会跑（p5-01..p5-09，4 镜）——分镜 5-A / 5-B / 5-C / 5-D。
 *
 *  叙事链：5-A durable 三拍舞台（开帧环体〔M-001〕缩悬顶角照常旋转——主循环
 *  已无等待砖）：拍一「写盘」p5-01「定义写进磁盘」词落位任务定义卡落进磁盘格、
 *  「活在程序进程里」词落位调度齿轮在进程窗内转一拍（调度的居所）→ 拍二「停
 *  摆」p5-02「进程一关」词落位进程窗合闭、齿轮停转、「保不住」词落位到点触发
 *  位空闪一拍 → p5-03「日程本」小图静置、「没人翻开」翻页手势图标悬而不落 →
 *  拍三「拾起」p5-04「进程重启」进程窗重开、「自动被拾起」调度小手拾起任务卡
 *  （确认绿点亮）、「照常触发」到点位亮起、「不补跑」停摆期节拍格定格为灰格
 *  （错过的不补）→ 5-B 环体定格收束（EWS）：环体居中同形回归（执行段畅通、
 *  无砖——0-A 压停的解除态首尾对照）＋登记表缩微驻位（bg_0001 行＋通知卡缩微
 *  ——本集装置全家福）＋金句卡（衬线体）「慢操作不能赊账——占位先闭合问答，
 *  真结果走新消息进场」两关键词各压一拍重读 → p5-06「还是那个循环」词落位环体
 *  整环定格静止一拍（静止即陈述〔M-003〕）、「不再傻等」词落位执行段上「等待」
 *  砖残影碎散消隐（0-A 意象走完生命周期〔M-006〕）→ 5-C 下期卡（视觉层单句
 *  镜）：日历页小图九点位挂「测试」任务签点亮 →「谁来提醒？」问号签浮起闪一
 *  拍 →「下期」小签落定 → 卡面淡出收束（黑场前过渡）→ 5-D 片尾署源卡（尾部
 *  署源位，RSI I-080 豁免）：主行 Learn Claude Code / 次行仓库地址 / 角注
 *  MIT——p5-08 同拍淡入两行先后落定、p5-09 静持（漂移警示由口播承载，卡面零
 *  复述），全片在此卡收束。
 *
 *  空间契约：三拍次序=口播次序（写盘→停摆→拾起）、确认绿只用于拾起/触发帧、
 *    停摆期灰格与正常节拍格可辨；金句卡衬线体为覆层主体、环体同形（描边色/
 *    线宽承全片锚定）、登记表与通知卡仅缩微不重绘；下期卡只点问题（日历＋
 *    问号为全部元素）、「下期」签为唯一预告词（无调度器/时间表/队列意象——
 *    红线）；署源卡为最后画面、卡面 ≤3 行信息。
 *
 *  红线落实：词落位 = wa(id,f)（⑧ 轮按句内字位复核）；y≥56 / bottom≥176；
 *    尾幕渐黑（红线四）窗取末 beat 总时长（p5-08..p5-09 之和）——终点即本幕
 *    终点；收尾版式不挂 SceneTag（承 ep1–ep12 先例）；「九点该跑的测试」不成
 *    句上屏（签面只「测试」＋时刻位）。
 *
 *  承接登记：4-D→5-A SceneFade＋环体缩悬重锚（承 ep10 4-D→5-A 形态：环体以
 *    〔M-001〕同形签名回归，非 morph）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, Panel, RegistryTable, RingExecSeg, STAGE, TaskNotificationCard, WaitBrick} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFadeOut, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 5-A durable 三拍：写盘 → 停摆 → 拾起（节拍格条全程对照） ────────────────

/** durable 舞台几何：磁盘格（左）/ 进程窗（中）/ 到点位（右）/ 节拍格条（下） */
const DISK = {x: 380, y: 300} as const;
const PWIN = {x: 800, y: 230, w: 480, h: 360} as const;
const FIRE_SLOT = {x: 1420, y: 320} as const;
const BEATS = {x: 380, y: 760, w: 1080, cells: 18} as const;

const FiveA: React.FC<{atDisk: number; atGear: number; atClose: number; atEmpty: number; atBook: number; atHand: number; atReopen: number; atPick: number; atFire: number; atGray: number}> = ({atDisk, atGear, atClose, atEmpty, atBook, atHand, atReopen, atPick, atFire, atGray}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 环体缩悬顶角（主循环已无等待砖——照常旋转）
  const dotPos = (frame / (fps * 2.5)) % 1;
  // 拍一：任务定义卡落进磁盘格
  const disk = clamp01(progress(frame, atDisk, 18));
  const cardDrop = clamp01(progress(frame, atDisk + 2, 20));
  // 调度齿轮（进程窗内——先转一拍「调度的居所」，关窗即停）
  const gearSpin = (Math.min(frame, atClose) / 7) % 1;
  const gearIntro = clamp01(progress(frame, atGear, 16));
  // 拍二：进程窗合闭（scaleY 收合）+ 齿轮停 + 任务卡静置
  const close = clamp01(progress(frame, atClose, 16));
  // 「保不住」：到点触发位空闪一拍（空位在、无人触发）
  const emptyFlash = Math.sin(Math.PI * clamp01(progress(frame, atEmpty, 14)));
  // 日程本小图静置 + 翻页手势悬而不落
  const book = clamp01(progress(frame, atBook, 14));
  const hand = clamp01(progress(frame, atHand, 14));
  // 拍三：进程窗重开 + 调度小手拾起任务卡（确认绿点亮）+ 到点位亮起
  const reopen = clamp01(progress(frame, atReopen, 16));
  const openP = reopen - close;
  const pick = clamp01(progress(frame, atPick, 18));
  const fire = clamp01(progress(frame, atFire, DUR.f4));
  // 「不补跑」：停摆期节拍格定格为灰格（错过的不补——停摆窗映射格区间）
  const gray = clamp01(progress(frame, atGray, 14));
  const stallFrom = 6;
  const stallTo = 11;
  return (
    <AbsoluteFill>
      {/* 环体缩悬顶角（照常旋转——解放态贯穿） */}
      <div style={{position: 'absolute', left: STAGE.ring.x, top: STAGE.ring.y}}>
        <LoopRing size={STAGE.ring.size} nodes={[]} showExit={false} dotProgress={dotPos} />
        <RingExecSeg size={STAGE.ring.size} segP={1} freeP={1} />
      </div>
      {/* 磁盘格（左——任务定义的居所） */}
      <div style={{position: 'absolute', left: DISK.x, top: DISK.y, opacity: clamp01(progress(frame, 4, DUR.f5))}}>
        <svg width={220} height={220} viewBox="0 0 220 220">
          <rect x={10} y={30} width={200} height={160} rx={16} fill={withAlpha(theme.panel, 0.95)} stroke={withAlpha(theme.dim, 0.7)} strokeWidth={3.5} />
          <circle cx={110} cy={110} r={44} fill="none" stroke={withAlpha(theme.dim, 0.55)} strokeWidth={3} />
          <circle cx={110} cy={110} r={10} fill={withAlpha(theme.dim, 0.55)} />
          <text x={110} y={216} textAnchor="middle" fontFamily={theme.mono} fontSize={15} fill={theme.dim}>
            磁盘
          </text>
        </svg>
        {/* 任务定义卡（落进磁盘格——拍一） */}
        <div
          style={{
            position: 'absolute',
            left: 50,
            top: 46 + (1 - cardDrop) * -170,
            width: 120,
            height: 74,
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(theme.tool, 0.85)}`,
            background: withAlpha(theme.panel, 0.98),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: cardDrop,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'task_def'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.text}}>{'定义卡'}</span>
        </div>
      </div>
      {/* 进程窗（中——程序进程；调度齿轮的居所） */}
      <div style={{position: 'absolute', left: PWIN.x, top: PWIN.y, width: PWIN.w, height: PWIN.h, opacity: clamp01(progress(frame, 6, DUR.f5))}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 14,
            border: `3.5px solid ${withAlpha(theme.tool, 0.55)}`,
            background: withAlpha(theme.panel, 0.6),
            transform: `scaleY(${1 - 0.94 * close + 0.94 * reopen})`,
            transformOrigin: '50% 0%',
            overflow: 'hidden',
          }}
        >
          {/* 窗标题栏 */}
          <div style={{display: 'flex', alignItems: 'center', gap: 9, padding: '10px 16px', borderBottom: `2px solid ${withAlpha(theme.panelBorder, 0.8)}`}}>
            {[0, 1, 2].map((d) => (
              <span key={`pd${d}`} style={{width: 10, height: 10, borderRadius: '50%', background: withAlpha(theme.dim, 0.5)}} />
            ))}
            <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginLeft: 6, whiteSpace: 'nowrap'}}>{'进程 · scheduler'}</span>
          </div>
          {/* 调度齿轮（窗内——转一拍即停；重开后再转） */}
          <div style={{position: 'absolute', left: PWIN.w / 2 - 70, top: 96, opacity: gearIntro}}>
            <svg width={140} height={140} viewBox="0 0 140 140">
              <g transform={`rotate(${gearSpin * 360 + (pick > 0.3 ? (frame - atPick) * 0.8 : 0)} 70 70)`}>
                {[0, 45, 90, 135].map((a) => {
                  const rad = (a * Math.PI) / 180;
                  return (
                    <line
                      key={`gt${a}`}
                      x1={70 + 34 * Math.cos(rad)}
                      y1={70 + 34 * Math.sin(rad)}
                      x2={70 + 54 * Math.cos(rad)}
                      y2={70 + 54 * Math.sin(rad)}
                      stroke={withAlpha(theme.dim, 0.8)}
                      strokeWidth={9}
                      strokeLinecap="round"
                    />
                  );
                })}
                <circle cx={70} cy={70} r={38} fill="none" stroke={withAlpha(theme.dim, 0.8)} strokeWidth={9} />
                <circle cx={70} cy={70} r={12} fill={withAlpha(theme.panel, 1)} stroke={withAlpha(theme.dim, 0.8)} strokeWidth={5} />
              </g>
            </svg>
          </div>
          {/* 任务卡（窗内静置——停摆期保住定义保不住触发） */}
          <div
            style={{
              position: 'absolute',
              left: PWIN.w / 2 - 80,
              top: 250,
              width: 160,
              height: 70,
              borderRadius: 9,
              border: `2.5px solid ${pick > 0.4 ? theme.ok : withAlpha(theme.panelBorder, 0.95)}`,
              background: withAlpha(theme.panel, 0.98),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: clamp01(progress(frame, atDisk + 6, DUR.f4)),
              transform: `translateY(${pick * -46}px)`,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'到点任务'}</span>
            {pick > 0.5 ? (
              <svg width={22} height={22} viewBox="0 0 20 20" style={{opacity: clamp01(pick * 2 - 1)}}>
                <path d="M 3 10.5 L 8 15.5 L 17 4.5" fill="none" stroke={theme.ok} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </div>
        </div>
        {/* 调度小手（窗右下——重开后伸入拾起任务卡；确认绿点亮） */}
        {pick > 0.02 ? (
          <svg width={90} height={90} viewBox="0 0 90 90" style={{position: 'absolute', left: PWIN.w / 2 + 60, top: 240 - pick * 30, opacity: pick}}>
            <g fill="none" stroke={theme.ok} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M 30 70 L 30 40 Q 30 32 38 32 Q 46 32 46 40 L 46 44" />
              <path d="M 46 44 L 46 34 Q 46 26 54 26 Q 62 26 62 34 L 62 46" />
              <path d="M 62 46 L 62 40 Q 62 34 69 34 Q 76 34 76 42 L 76 60 Q 76 74 62 80 L 44 80 Q 32 76 30 64 Z" />
            </g>
          </svg>
        ) : null}
      </div>
      {/* 到点触发位（右——空闪（保不住）→ 点亮（照常触发，确认绿） */}
      <div style={{position: 'absolute', left: FIRE_SLOT.x, top: FIRE_SLOT.y, opacity: clamp01(progress(frame, atClose, DUR.f5))}}>
        <svg width={140} height={140} viewBox="0 0 140 140">
          <circle cx={70} cy={70} r={46} fill="none" stroke={withAlpha(theme.dim, 0.6)} strokeWidth={3.5} strokeDasharray="9 8" />
          <circle cx={70} cy={70} r={18 + 14 * emptyFlash} fill="none" stroke={withAlpha(theme.dim, 0.4 + 0.4 * emptyFlash)} strokeWidth={3} opacity={0.3 + 0.7 * emptyFlash} />
          <circle cx={70} cy={70} r={20} fill={fire > 0.4 ? theme.ok : 'transparent'} stroke={fire > 0.2 ? theme.ok : withAlpha(theme.dim, 0.6)} strokeWidth={4} opacity={fire > 0.2 ? fire : 0.5} />
        </svg>
        <div style={{position: 'absolute', left: 0, right: 0, top: 148, textAlign: 'center', fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>{'到点位'}</div>
      </div>
      {/* 日程本小图（右下——A#6 机制位：一图即止不扩演） + 翻页手势悬而不落 */}
      {book > 0.02 ? (
        <div style={{position: 'absolute', left: 1420, top: 560, opacity: book}}>
          <svg width={180} height={130} viewBox="0 0 180 130">
            <rect x={16} y={18} width={148} height={98} rx={8} fill={withAlpha(theme.panel, 0.95)} stroke={withAlpha(theme.dim, 0.7)} strokeWidth={3} />
            <line x1={90} y1={18} x2={90} y2={116} stroke={withAlpha(theme.dim, 0.5)} strokeWidth={2.5} />
            {[0, 1, 2].map((r) => (
              <g key={`bl${r}`}>
                <line x1={30} y1={40 + r * 26} x2={76} y2={40 + r * 26} stroke={withAlpha(theme.dim, 0.45)} strokeWidth={2.5} />
                <line x1={104} y1={40 + r * 26} x2={150} y2={40 + r * 26} stroke={withAlpha(theme.dim, 0.45)} strokeWidth={2.5} />
              </g>
            ))}
          </svg>
          {/* 翻页手势（悬而不落——没人翻开就不会发生） */}
          {hand > 0.02 ? (
            <svg width={80} height={80} viewBox="0 0 80 80" style={{position: 'absolute', left: 60, top: -64 - hand * 0, opacity: hand * 0.9}}>
              <g fill="none" stroke={withAlpha(theme.dim, 0.8)} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M 26 66 L 26 34 Q 26 27 33 27 Q 40 27 40 34 L 40 38" />
                <path d="M 40 38 L 40 29 Q 40 22 47 22 Q 54 22 54 29 L 54 40" />
                <path d="M 54 40 L 54 35 Q 54 29 60 29 Q 66 29 66 36 L 66 52 Q 66 64 54 70 L 40 70 Q 30 66 26 58 Z" />
                <path d="M 66 44 Q 76 38 72 28" strokeDasharray="5 5" />
              </g>
            </svg>
          ) : null}
        </div>
      ) : null}
      {/* 节拍格条（下——正常节拍格 + 停摆期灰格可辨；不补跑=灰格定格） */}
      <div style={{position: 'absolute', left: BEATS.x, top: BEATS.y, width: BEATS.w, opacity: clamp01(progress(frame, atClose + 10, DUR.f5))}}>
        <div style={{display: 'flex', gap: 8}}>
          {Array.from({length: BEATS.cells}, (_, i) => {
            // 停摆窗映射格区间：停摆前正常亮 / 停摆期灰格（gray 定格可辨）/ 恢复后复亮
            const inStall = i >= stallFrom && i <= stallTo;
            const resumed = i > stallTo && reopen > 0.5;
            const cellLit = (i < stallFrom || resumed) && !inStall;
            return (
              <span
                key={`bt${i}`}
                style={{
                  flex: 1,
                  height: 34,
                  borderRadius: 6,
                  background: inStall
                    ? withAlpha(theme.dim, 0.14 * (0.4 + 0.6 * gray) + 0.05)
                    : cellLit
                      ? withAlpha(theme.dim, 0.4)
                      : withAlpha(theme.dim, 0.12),
                  border: `2px solid ${inStall ? withAlpha(theme.dim, 0.5) : withAlpha(theme.dim, 0.55)}`,
                  opacity: inStall ? 0.35 + 0.65 * gray : 1,
                }}
              />
            );
          })}
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 6, whiteSpace: 'nowrap'}}>
          <span>{'正常节拍'}</span>
          <span style={{color: gray > 0.3 ? theme.text : theme.dim}}>{'停摆期 · 灰格不补'}</span>
          <span>{'恢复'}</span>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'durable · 定义在盘 · 调度在进程'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 环体定格收束：全家福缩微 + 金句卡 + 砖残影碎散 ──────────────────────

const RING_5B = {x: 740, y: 140, size: 440} as const;

const FiveB: React.FC<{atQuote: number; atK1: number; atK2: number; atStatic: number; atCrumble: number}> = ({atQuote, atK1, atK2, atStatic, atCrumble}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 金句卡淡入定格（收束仪式）
  const quote = useProgress(atQuote, DUR.f5);
  // 两关键词各压一拍重读（scale + 辉光——mech 占位/notify 新消息 双主题色）
  const k1 = Math.sin(Math.PI * clamp01(progress(frame, atK1, DUR.f6)));
  const k2 = Math.sin(Math.PI * clamp01(progress(frame, atK2, DUR.f6)));
  const k1G = clamp01(progress(frame, atK1, DUR.f5));
  const k2G = clamp01(progress(frame, atK2, DUR.f5));
  // p5-06「还是那个循环」：整环定格静止一拍（静止即陈述〔M-003〕——光点冻结）
  const dotPos = (Math.min(frame, atStatic) / (fps * 2.5)) % 1;
  // 「不再傻等」：执行段上「等待」砖残影碎散消隐（0-A 意象走完生命周期）
  const crumble = clamp01(progress(frame, atCrumble, 22));
  const ghostP = 1 - crumble;
  const cx = RING_5B.x + RING_5B.size / 2;
  const cy = RING_5B.y + RING_5B.size / 2;
  const r = RING_5B.size / 2 - 46;
  return (
    <AbsoluteFill>
      {/* 环体〔M-001〕居中同形回归（执行段畅通、无砖——压停解除态首尾对照） */}
      <div style={{position: 'absolute', left: RING_5B.x, top: RING_5B.y}}>
        <LoopRing size={RING_5B.size} nodes={[]} showExit={false} dotProgress={dotPos} />
        <RingExecSeg size={RING_5B.size} segP={1} freeP={1} ghostP={ghostP} />
      </div>
      {/* 等待砖残影（执行段正上——半透明虚影，碎散消隐） */}
      <WaitBrick x={cx - 88} y={cy + r - 62} w={176} litP={0.35 * ghostP} dropP={1} crumbleP={crumble} />
      {/* 装置全家福（环旁缩微驻位——登记表 bg_0001 行 + 通知卡缩微，仅缩微不重绘） */}
      <div style={{position: 'absolute', left: 1210, top: 200, opacity: 0.55 * quote + 0.3}}>
        <RegistryTable x={0} y={0} w={300} h={150} mini litP={1} rowP={1} state="done" />
        <div style={{position: 'absolute', left: 320, top: 6}}>
          <TaskNotificationCard x={0} y={0} w={220} h={130} litP={1} colsP={4} mini />
        </div>
      </div>
      {/* 金句卡（衬线体覆层——两关键词各压一拍重读） */}
      {quote > 0.02 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 640, display: 'flex', justifyContent: 'center', zIndex: 3}}>
          <div style={{opacity: quote, transform: `translateY(${(1 - quote) * 20}px)`}}>
            <Panel accent={theme.notify} style={{padding: '26px 56px'}}>
              <div style={{fontFamily: theme.serif, fontSize: 42, color: theme.text, whiteSpace: 'nowrap'}}>
                {/* caption-dup-ok: 金句卡刻意复述（收束定格仪式，承 ep1 5-A / ep2 5-A
                    / ep10 5-A 豁免先例——storyboard 5-B 行登记） */}
                <span>{'慢操作'}</span>
                <span style={{fontWeight: 700, color: theme.mech, display: 'inline-block', transform: `scale(${1 + 0.05 * k1})`, textShadow: k1G > 0.01 ? `0 0 ${22 * k1G}px ${withAlpha(theme.mech, 0.5)}` : 'none'}}>{'不能赊账'}</span>
                <span>{'——占位先闭合问答，真结果走'}</span>
                <span style={{fontWeight: 700, color: theme.notify, display: 'inline-block', transform: `scale(${1 + 0.05 * k2})`, textShadow: k2G > 0.01 ? `0 0 ${22 * k2G}px ${withAlpha(theme.notify, 0.5)}` : 'none'}}>{'新消息进场'}</span>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'占位回执 · task_notification'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 下期卡（视觉层单句镜）：日历九点测试签 + 问号签 + 下期签 ─────────────

const CAL = {x: 760, y: 190, w: 400, h: 470} as const;

const FiveC: React.FC<{atNine: number; atQ: number; atNext: number; atFade: number}> = ({atNine, atQ, atNext, atFade}) => {
  const frame = useCurrentFrame();
  // 九点位「测试」任务签点亮
  const nine = clamp01(progress(frame, atNine, DUR.f4));
  // 「谁来提醒？」问号签浮起闪一拍（只点问题）
  const q = Math.sin(Math.PI * clamp01(progress(frame, atQ, 16)));
  // 「下期」小签落定
  const next = clamp01(progress(frame, atNext, DUR.f4));
  // 卡面淡出收束（黑场前过渡——整卡随 beat 末淡出）
  const fade = 1 - clamp01(progress(frame, atFade, 16));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, opacity: fade}}>
        {/* 日历页小图（月历格——九点位挂任务签；无调度器/时间表意象，只点问题） */}
        <div style={{position: 'absolute', left: CAL.x, top: CAL.y, width: CAL.w, height: CAL.h}}>
          <div style={{position: 'absolute', inset: 0, borderRadius: 16, border: `3.5px solid ${withAlpha(theme.panelBorder, 1)}`, background: withAlpha(theme.panel, 0.95)}} />
          {/* 日历头（两个挂孔 + 月名位） */}
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '14px 0', borderBottom: `2px solid ${withAlpha(theme.panelBorder, 0.8)}`}}>
            {[0, 1].map((h) => (
              <span key={`h${h}`} style={{width: 12, height: 12, borderRadius: '50%', background: withAlpha(theme.dim, 0.4)}} />
            ))}
          </div>
          {/* 日期格（3×4 小格——九点位 = 第 2 行第 3 列挂任务签） */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 18}}>
            {Array.from({length: 12}, (_, i) => {
              const isNine = i === 5;
              return (
                <div
                  key={`d${i}`}
                  style={{
                    height: 82,
                    borderRadius: 8,
                    border: `2px ${isNine ? 'solid' : 'dashed'} ${isNine && nine > 0.3 ? withAlpha(theme.core, 0.85) : withAlpha(theme.dim, 0.4)}`,
                    background: isNine && nine > 0.3 ? withAlpha(theme.core, 0.1) : 'transparent',
                    position: 'relative',
                  }}
                >
                  <span style={{position: 'absolute', left: 8, top: 6, fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{String(i + 1).padStart(2, '0')}</span>
                  {/* 九点位任务签（「测试」——词落位点亮） */}
                  {isNine && nine > 0.3 ? (
                    <span
                      style={{
                        position: 'absolute',
                        left: 8,
                        bottom: 8,
                        padding: '3px 10px',
                        borderRadius: 6,
                        border: `2.5px solid ${theme.core}`,
                        background: theme.panel,
                        fontFamily: theme.sans,
                        fontSize: 15,
                        fontWeight: 700,
                        color: theme.core,
                        whiteSpace: 'nowrap',
                        opacity: nine,
                        boxShadow: `0 0 ${10 * nine}px ${withAlpha(theme.core, 0.5)}`,
                      }}
                    >
                      测试
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        {/* 问号签（日历右上外——谁来提醒？只点问题不预告机制） */}
        {q > 0.03 ? (
          <div
            style={{
              position: 'absolute',
              left: CAL.x + CAL.w - 60,
              top: CAL.y - 74,
              padding: '8px 22px',
              borderRadius: 10,
              border: `2.5px dashed ${withAlpha(theme.dim, 0.85)}`,
              fontFamily: theme.serif,
              fontSize: 26,
              fontWeight: 700,
              color: theme.dim,
              whiteSpace: 'nowrap',
              opacity: q,
            }}
          >
            谁来提醒？
          </div>
        ) : null}
        {/* 「下期」小签（唯一预告词——落定定格） */}
        {next > 0.02 ? (
          <div style={{position: 'absolute', left: 0, right: 0, top: 740, display: 'flex', justifyContent: 'center', opacity: next, transform: `translateY(${(1 - next) * 14}px)`}}>
            <Panel accent={theme.core} style={{padding: '12px 44px', textAlign: 'center'}}>
              <div style={{fontFamily: theme.serif, fontSize: 36, fontWeight: 700, color: theme.text, letterSpacing: 10, paddingLeft: 10, whiteSpace: 'nowrap'}}>下期</div>
            </Panel>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-D 片尾署源卡（尾部署源位，RSI I-080 豁免） ──────────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-08 口播同拍淡入；两行先后落定（署源专名口播例外随行）
  const card = useEnter('rise', {at: atCard + 2, dur: DUR.f6, dist: 24, restBottom: 560});
  const l1At = atCard + Math.round(durCard * 0.3);
  const l1 = useProgress(l1At, DUR.f5);
  const l2At = l1At + DUR.f6;
  const l2 = useProgress(l2At, DUR.f5);
  const mit = useProgress(l2At + 8, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: 316,
        opacity: card.opacity,
        transform: card.transform,
      }}
    >
      <Panel accent={withAlpha(theme.mech, 0.4)} style={{position: 'relative', padding: '46px 64px', textAlign: 'center'}}>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 56,
            fontWeight: 700,
            color: theme.text,
            letterSpacing: 2,
            whiteSpace: 'nowrap',
            opacity: l1,
            transform: `translateY(${(1 - l1) * 12}px)`,
          }}
        >
          {'Learn Claude Code'}
        </div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 28,
            color: theme.dim,
            marginTop: 20,
            whiteSpace: 'nowrap',
            opacity: l2,
            transform: `translateY(${(1 - l2) * 10}px)`,
          }}
        >
          {'github.com/shareAI-lab/learn-claude-code'}
        </div>
        {/* 角注（卡面第 3 行信息，≤3 行封顶） */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 20,
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.dim,
            letterSpacing: 1,
            opacity: mit * 0.9,
          }}
        >
          {'MIT'}
        </div>
      </Panel>
    </div>
  );
};

/** 幕末渐黑（红线四）：窗 = 末 beat 总时长（p5-08..p5-09 之和），终点即本幕终点 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P5DurableAndClose: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p5-01', 'p5-04');
  const bB = w('p5-05', 'p5-06');
  const bC = w('p5-07');
  const bD = w('p5-08', 'p5-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <FiveA
          atDisk={wa('p5-01', 0.56) - bA.from}
          atGear={wa('p5-01', 0.8) - bA.from}
          atClose={wa('p5-02', 0.1) - bA.from}
          atEmpty={wa('p5-02', 0.82) - bA.from}
          atBook={wa('p5-03', 0.14) - bA.from}
          atHand={wa('p5-03', 0.58) - bA.from}
          atReopen={wa('p5-04', 0.2) - bA.from}
          atPick={wa('p5-04', 0.42) - bA.from}
          atFire={wa('p5-04', 0.68) - bA.from}
          atGray={wa('p5-04', 0.9) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <FiveB
          atQuote={wa('p5-05', 0.08) - bB.from}
          atK1={wa('p5-05', 0.32) - bB.from}
          atK2={wa('p5-05', 0.82) - bB.from}
          atStatic={wa('p5-06', 0.3) - bB.from}
          atCrumble={wa('p5-06', 0.74) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <FiveC
          atNine={wa('p5-07', 0.14) - bC.from}
          atQ={wa('p5-07', 0.38) - bC.from}
          atNext={wa('p5-07', 0.5) - bC.from}
          atFade={span('p5-07') - 18}
        />
      </Sequence>
      <Sequence {...bD} name="5-D">
        <CreditCard atCard={at('p5-08') - bD.from} durCard={span('p5-08')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bD.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5DurableAndClose;
