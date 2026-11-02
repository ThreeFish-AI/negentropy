/** P2 一张回执（p2-01..30，8 镜 11 cue）——分镜 2-A…2-H。
 *
 *  ★ 空间分轨（本集视觉契约）：后台线恒挂画面右缘纵深（BgLane，2-E..2-G），
 *    与 archify 画框（x 311..1609 / y 150..880）零像素重叠——ArchifyClip ③
 *    PillarHUD 同类的边距母图层锚，播放期不让位（分轨替代 ArchifyYield）；
 *    三件事（流水线灯/滚筒跳号/抽屉上锁）、占位小票、「叫号器」点睛的句锚
 *    点亮全部落在 lane 上，与画框特写互为总分。
 *  ★ 跨实例背靠背 lead 判定（评审修复）：gap=0 帧相邻即背靠背 → 第二实例
 *    lead={false}，跨 slug 换图同判例（explained P2ToolRegistry p2-16→p2-17）；
 *    实例级 lead={false} 会经 lead && enters 连带压制空窗后重现章 → 空窗两侧
 *    拆独立实例（2-G）。
 *  ★ 2-G p2-19 空窗由主循环带持有画面：通知 chip 自右缘 lane 沿虚轨落入
 *    BeltStrip（M-001 传送带恒定锚），衔接第二 cue 的画框重现。
 *  cue 清单（11）：
 *    2-A one-call-one-receipt  pair-rule@p2-01 / reject-second@p2-02（相邻自动抑制）
 *    2-C dispatch-two-gates     gate-one@p2-05(+06) / gate-two@p2-07(+08)
 *    2-E bg-tasks-loop          placeholder-hand@p2-10..13
 *    2-F bg-tasks-loop          placeholder-hand@p2-14..15（lead={false}）
 *    2-G bg-tasks-loop          notify-merge@p2-16..18（lead={false}）/ notify-merge@p2-20..22（空窗后独立实例，默认 lead）
 *    2-H two-round-script       turn-one@p2-23(+24) / turn-two@p2-25(+26) / zero-wait@p2-27(+28)（lead={false}）
 *  native：2-B 网购金句卡（衬线 + accent 金）/ 2-D 拨杆拨否仍坠落（单句镜）/
 *    2-H p2-29..30 排队层 + 下一台装置预告；2-A/2-C/2-E/2-F/2-G/2-H(cue 窗) 纯图镜。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BeltStrip, Footnote, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, useBreathe, useDraw, useEnter, useFlowDash, useImpulse, useProgress, useSpring, useStagger} from '../motion';

/** 常驻系列条定位：y<56 归 ChapterProgress 章节条；本集 motifs 种子把 SceneTag
 *  落在左上（left:72/top:64），Badge 让到同行右端（left:auto + right:64）——
 *  双端分置互不叠压、也不侵入章节条。挂载面（组装方核对口径）：P2/P3/P4 挂
 *  Badge 且三集一律右置 top:64（评审修复：默认档 y12–48 会被章节条实底压盖），
 *  P1/P5/P6 顶带让位给地图/对拍/收尾版式不挂——系列身份由 P6 身份卡收束。 */
const BADGE_STYLE: React.CSSProperties = {left: 'auto', right: 64, top: 64};

// ── 2-B 网购金句卡（衬线 · accent 金） ──────────────────────────────────

/** 图标点亮：dim 轮廓常驻，accent 亮层 + 一次性脉冲在句锚「各亮一次」
 *  （双层 svg 交叉淡化——effects 通道不做色插值） */
const LitIcon: React.FC<{at: number; size: number; draw: (c: string) => React.ReactNode}> = ({
  at,
  size,
  draw,
}) => {
  const lit = useProgress(at, DUR.f4);
  const pop = useImpulse({at, dur: DUR.f5, peak: 0.1});
  return (
    <div style={{width: size, height: size, position: 'relative', transform: `scale(${1 + pop})`}}>
      <svg width={size} height={size} style={{position: 'absolute', left: 0, top: 0}}>
        {draw(theme.dim)}
      </svg>
      <svg width={size} height={size} style={{position: 'absolute', left: 0, top: 0, opacity: lit}}>
        {draw(theme.accent)}
      </svg>
    </div>
  );
};

/** 订单小票轮廓（缺口底边 + 两行条目） */
const receiptGlyph = (c: string) => (
  <>
    <path
      d="M8 4 H38 V40 L33 35 L28 40 L23 35 L18 40 L13 35 L8 40 Z"
      fill="none"
      stroke={c}
      strokeWidth={3}
    />
    <line x1={14} y1={15} x2={32} y2={15} stroke={c} strokeWidth={3} />
    <line x1={14} y1={23} x2={28} y2={23} stroke={c} strokeWidth={3} />
  </>
);

/** 信封轮廓（到货短信） */
const envelopeGlyph = (c: string) => (
  <>
    <rect x={4} y={10} width={38} height={26} rx={4} fill="none" stroke={c} strokeWidth={3} />
    <path d="M6 13 L23 26 L40 13" fill="none" stroke={c} strokeWidth={3} />
  </>
);

/** 左右合页入场：订单页（必须立刻回）↔ 短信页（独立消息），中缝闪光一拍，
 *  底部失配边界小字收口 */
const ShopAnalogy: React.FC<{atCard: number; atIconL: number; atIconR: number}> = ({
  atCard,
  atIconL,
  atIconR,
}) => {
  const left = useEnter('slideL', {at: atCard, dur: DUR.f6, dist: 240, springPreset: 'settle'});
  const right = useEnter('slideR', {at: atCard + 4, dur: DUR.f6, dist: 240, springPreset: 'settle'});
  const seam = useImpulse({at: atCard + DUR.f5, dur: DUR.f4, peak: 1});
  const fine = useProgress(atCard + DUR.f6, DUR.f5);

  return (
    <AbsoluteFill>
      {/* 左半页：订单号（下单那刻必须有回音） */}
      <div style={{position: 'absolute', left: 388, top: 340, ...left}}>
        <Panel style={{width: 560, padding: '34px 36px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 20}}>
            <LitIcon at={atIconL} size={46} draw={receiptGlyph} />
            <span style={{fontFamily: theme.serif, fontSize: 42, fontWeight: 700, color: theme.accent}}>
              {'订单号'}
            </span>
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 27, color: theme.text, marginTop: 20}}>
            {'下单那刻 · 必须立刻回'}
          </div>
        </Panel>
      </div>
      {/* 右半页：到货短信（独立消息，不占名额） */}
      <div style={{position: 'absolute', left: 972, top: 340, ...right}}>
        <Panel style={{width: 560, padding: '34px 36px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 20}}>
            <LitIcon at={atIconR} size={46} draw={envelopeGlyph} />
            <span style={{fontFamily: theme.serif, fontSize: 42, fontWeight: 700, color: theme.accent}}>
              {'到货短信'}
            </span>
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 27, color: theme.text, marginTop: 20}}>
            {'独立消息'}
          </div>
        </Panel>
      </div>
      {/* 合页中缝闪光（两页合拢一拍）——条高贴合两卡内容高（评审修复：原 298
          比卡实际约 184px 悬空百余像素，闪光拍会露出无依托竖线） */}
      <div
        style={{
          position: 'absolute',
          left: 958,
          top: 340,
          width: 4,
          height: 184,
          borderRadius: 2,
          background: theme.accent,
          opacity: seam * 0.85,
        }}
      />
      {/* 失配边界小字 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 702,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 23,
          color: theme.dim,
          opacity: fine,
        }}
      >
        {'快递可合并改址 · 通知通道不可'}
      </div>
      <Footnote delay={atCard}>{'tool_use → tool_result'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-D 拨杆拨否仍坠落（单句镜 p2-09） ──────────────────────────────────

/** 拨杆掰到「否」位 → 命令卡仍穿筛网坠入清洗槽。全部时点由单句窗的
 *  分数锚推导（span = dur('p2-09')），不写死帧数 */
const LeverFall: React.FC<{span: number}> = ({span}) => {
  const f = (x: number) => Math.round(span * x);
  const badge = useProgress(2, DUR.f4);
  const cardIn = useEnter('fall', {at: f(0.04), dur: DUR.f5, dist: 70, springPreset: 'settle'});
  const flip = useSpring('settle', {at: f(0.28), dur: DUR.f5});
  const approach = useProgress(f(0.42), f(0.18), 'decelerate');
  const fall = useProgress(f(0.64), f(0.2), 'accelerate');
  const denyGlow = useImpulse({at: f(0.56), dur: f(0.16), peak: 0.65});
  const denyHold = useProgress(f(0.58), f(0.1));
  const swallow = useProgress(f(0.8), f(0.08));
  const ripple1 = useProgress(f(0.86), f(0.12));
  const ripple2 = useProgress(f(0.92), f(0.12));
  const holeFlash = useImpulse({at: f(0.66), dur: f(0.12), peak: 0.9});

  // 拨杆臂角：是（上翘 35°）→ 否（下压 -35°），tip 随弹簧扫过闸口
  const phi = 35 - 70 * flip;
  const armX = 1250 - 105 * Math.cos((phi * Math.PI) / 180);
  const armY = 295 - 105 * Math.sin((phi * Math.PI) / 180);
  // 卡片纵向行程：入场 → 逼近筛网 → 加速坠落（穿网入槽）
  const cardY = 210 + approach * 350 + fall * 215;

  return (
    <AbsoluteFill>
      {/* 拨杆闸口 + 筛网 + 清洗槽口（svg 机械层） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {/* 闸柱与轴 */}
        <line x1={1250} y1={195} x2={1250} y2={395} stroke={theme.panelBorder} strokeWidth={6} />
        <circle cx={1250} cy={295} r={10} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={4} />
        {/* 拨杆臂（mech 装置族） */}
        <line
          x1={1250}
          y1={295}
          x2={armX}
          y2={armY}
          stroke={flip > 0.65 ? theme.deny : theme.mech}
          strokeWidth={7}
          strokeLinecap="round"
        />
        {/* 筛网：11 孔（慢关键词兜底），中四孔在卡穿越时 deny 闪 */}
        {Array.from({length: 11}, (_, i) => {
          const cx = 580 + i * 76;
          const hot = i >= 3 && i <= 7;
          return (
            <g key={i}>
              <circle cx={cx} cy={585} r={9} fill="none" stroke={theme.panelBorder} strokeWidth={2.5} />
              {hot ? (
                <circle cx={cx} cy={585} r={9} fill="none" stroke={theme.deny} strokeWidth={2.5} opacity={holeFlash} />
              ) : null}
            </g>
          );
        })}
        {/* 筛网横杆 */}
        <line x1={560} y1={585} x2={620} y2={585} stroke={theme.panelBorder} strokeWidth={2.5} />
        <line x1={1300} y1={585} x2={1360} y2={585} stroke={theme.panelBorder} strokeWidth={2.5} />
        {/* 清洗槽口涟漪（两圈扩散） */}
        <ellipse
          cx={960}
          cy={800}
          rx={30 + 70 * ripple1}
          ry={8 + 20 * ripple1}
          fill="none"
          stroke={theme.mech}
          strokeWidth={3}
          opacity={(1 - ripple1) * 0.8}
        />
        <ellipse
          cx={960}
          cy={800}
          rx={30 + 70 * ripple2}
          ry={8 + 20 * ripple2}
          fill="none"
          stroke={theme.mech}
          strokeWidth={3}
          opacity={(1 - ripple2) * 0.6}
        />
      </svg>

      {/* 是/否 位标签（否位随拨到位点亮 deny） */}
      <div
        style={{
          position: 'absolute',
          left: 1128,
          top: 196,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
        }}
      >
        {'是'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1128,
          top: 372,
          fontFamily: theme.sans,
          fontSize: 24,
          color: flip > 0.65 ? theme.deny : theme.dim,
        }}
      >
        {'否'}
      </div>

      {/* 清洗槽口（深喉 + 标签） */}
      <div
        style={{
          position: 'absolute',
          left: 770,
          top: 790,
          width: 380,
          height: 44,
          borderRadius: 22,
          border: `3px solid ${theme.panelBorder}`,
          background: '#0B0E13', /* 与冻结件 ArchifyClip 内部帧底同值（贴缝匹配，token 注记） */
          boxShadow: 'inset 0 8px 14px rgba(0,0,0,0.65)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 1172,
          top: 800,
          fontFamily: theme.mono,
          fontSize: 17,
          color: theme.dim,
        }}
      >
        {'清洗槽'}
      </div>

      {/* 命令卡：显式拒绝标签随卡，deny 边缘闪 + 坠落倾斜 + 入槽吞没 */}
      <div
        style={{
          position: 'absolute',
          left: 790,
          top: cardY,
          width: 340,
          opacity: cardIn.opacity * (1 - swallow),
        }}
      >
        <div style={{transform: `${cardIn.transform} rotate(${fall * 9}deg)`}}>
          <Panel style={{height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <span style={{fontFamily: theme.mono, fontSize: 30, color: theme.text}}>{'install'}</span>
          </Panel>
          {/* deny 边缘提示层（effects 通道：脉冲 + 保持） */}
          <div
            style={{
              position: 'absolute',
              inset: -3,
              borderRadius: 16,
              border: `3px solid ${theme.deny}`,
              opacity: denyGlow + denyHold * 0.35,
            }}
          />
          {/* 显式「不要后台」小标 */}
          <div
            style={{
              position: 'absolute',
              right: -12,
              top: -18,
              padding: '2px 10px',
              borderRadius: 7,
              border: `2px solid ${theme.deny}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 16,
              color: theme.deny,
            }}
          >
            {'不要后台'}
          </div>
        </div>
      </div>

      {/* 角标：代码事实 */}
      <div
        style={{
          position: 'absolute',
          left: 1424,
          top: 156,
          padding: '4px 14px',
          borderRadius: 8,
          border: `2px solid ${theme.dim}`,
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.dim,
          opacity: badge,
        }}
      >
        {'代码事实'}
      </div>

      <Footnote delay={2}>{'run_in_background: false'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 右缘后台线（2-E..2-G 恒挂的分轨装置；x≥1650 与画框零重叠） ──────────

/** 后台线纵向 rail + 悬挂件：daemon 灯（呼吸）→ 编号滚筒翻号 bg_0001 →
 *  登记表抽屉上锁（咔哒）→ 占位小票（打印下垂）→ 查表脉冲 →「叫号器」点睛。
 *  句锚全部由幕组装注入（lane 局部帧） */
const BgLane: React.FC<{
  span: number;
  atLamp: number;
  atRoll: number;
  atLock: number;
  atTicket: number;
  atCheck: number;
  atCall: number;
}> = ({span, atLamp, atRoll, atLock, atTicket, atCheck, atCall}) => {
  const rail = useDraw(2, DUR.f6);
  const lamp = useProgress(atLamp, DUR.f4);
  const lampBreath = useBreathe({period: 46, amp: 0.35, base: 0.65});
  const roll = useSpring('settle', {at: atRoll, dur: DUR.f5});
  const rollIn = useProgress(atRoll, DUR.f4);
  const lock = useProgress(atLock, DUR.f4);
  const click = useImpulse({at: atLock + DUR.f5, dur: DUR.f4, peak: 0.1});
  const ticket = useEnter('fall', {at: atTicket, dur: DUR.f5, dist: 26});
  const check = useProgress(atCheck, DUR.f4);
  const checkPop = useImpulse({at: atCheck, dur: DUR.f5, peak: 0.07});
  const callTag = useEnter('pop', {at: atCall, dur: DUR.f4});
  const out = useProgress(span - DUR.f5, DUR.f5);

  return (
    <AbsoluteFill style={{opacity: 1 - out}}>
      {/* 纵深 rail（自上而下描画）+ 悬挂短轨 */}
      <svg width={260} height={680} style={{position: 'absolute', left: 1650, top: 185}}>
        <line x1={10} y1={4} x2={10} y2={664} stroke={theme.panelBorder} strokeWidth={3} {...rail} />
        <line x1={10} y1={50} x2={26} y2={50} stroke={theme.panelBorder} strokeWidth={2} opacity={lamp} />
        <line x1={10} y1={135} x2={26} y2={135} stroke={theme.panelBorder} strokeWidth={2} opacity={rollIn} />
        <line x1={10} y1={245} x2={26} y2={245} stroke={theme.panelBorder} strokeWidth={2} opacity={lock} />
        <line x1={10} y1={363} x2={26} y2={363} stroke={theme.panelBorder} strokeWidth={2} opacity={ticket.opacity} />
        <line x1={10} y1={505} x2={26} y2={505} stroke={theme.panelBorder} strokeWidth={2} opacity={callTag.opacity} />
      </svg>

      {/* ① daemon 灯（mech 呼吸） */}
      <svg width={30} height={30} style={{position: 'absolute', left: 1655, top: 220}}>
        <circle cx={15} cy={15} r={9} fill="none" stroke={theme.panelBorder} strokeWidth={2.5} />
        <circle cx={15} cy={15} r={9} fill={theme.mech} opacity={lamp * lampBreath} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 1692,
          top: 222,
          fontFamily: theme.mono,
          fontSize: 18,
          color: theme.dim,
          opacity: lamp,
        }}
      >
        {'daemon'}
      </div>

      {/* ② 编号滚筒：翻号 bg_0000 → bg_0001 */}
      <div style={{position: 'absolute', left: 1678, top: 300, width: 200, height: 58, opacity: rollIn}}>
        <div
          style={{
            height: 58,
            borderRadius: 10,
            border: `2px solid ${theme.panelBorder}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'bg_'}</span>
          <div style={{perspective: 500}}>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 27,
                fontWeight: 700,
                color: theme.text,
                transformOrigin: '50% 50%',
                transform: `rotateX(${(1 - roll) * -90}deg)`,
              }}
            >
              {roll > 0.5 ? '0001' : '0000'}
            </div>
          </div>
        </div>
      </div>

      {/* ③ 登记表抽屉 + 上锁（锁环落体咔哒；p2-20 查表脉冲 + 「查表」浮标） */}
      <div
        style={{
          position: 'absolute',
          left: 1678,
          top: 424,
          width: 200,
          height: 76,
          opacity: lock,
          transform: `scale(${1 + click + checkPop})`,
          borderRadius: 10,
          border: `2px solid ${check > 0.5 ? theme.mech : theme.panelBorder}`,
          background: theme.panel,
          padding: '10px 14px',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.text}}>{'登记表'}</span>
          <svg width={22} height={26}>
            <path
              d="M6 11 V8 a5 5 0 0 1 10 0 V11"
              fill="none"
              stroke={theme.mech}
              strokeWidth={2.5}
              transform={`translate(0, ${(1 - lock) * -6})`}
            />
            <rect x={3} y={11} width={16} height={12} rx={2.5} fill="none" stroke={theme.mech} strokeWidth={2.5} />
          </svg>
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 6}}>
          {'threading.Lock'}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1678,
          top: 506,
          fontFamily: theme.mono,
          fontSize: 15,
          color: theme.mech,
          opacity: check,
        }}
      >
        {'查表'}
      </div>

      {/* ④ 占位小票（自滚筒下缘打印垂落，锯齿下摆） */}
      <div style={{position: 'absolute', left: 1678, top: 548, ...ticket}}>
        <div
          style={{
            width: 200,
            padding: '12px 14px 14px',
            background: theme.panel,
            border: `2px solid ${theme.panelBorder}`,
            borderTop: `2px dashed ${theme.panelBorder}`,
            borderBottom: `2px dashed ${theme.panelBorder}`,
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 23, color: theme.text}}>{'已启动'}</div>
          <div style={{fontFamily: theme.serif, fontSize: 17, color: theme.dim, marginTop: 4}}>
            {'完成后可得'}
          </div>
        </div>
      </div>

      {/* ⑤ 「叫号器」点睛标签（mech 蓝，pop 挂定） */}
      <div style={{position: 'absolute', left: 1678, top: 690, ...callTag}}>
        <Panel accent={theme.mech} style={{width: 200, padding: '12px 0', textAlign: 'center'}}>
          <span style={{fontFamily: theme.serif, fontSize: 26, fontWeight: 700, color: theme.mech}}>
            {'叫号器'}
          </span>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 2-G p2-19 空窗：主循环带（通知 chip 自 lane 落入传送带） ─────────────

const MainLoopGap: React.FC<{span: number}> = ({span}) => {
  const beltIn = useEnter('fade', {at: 2, dur: DUR.f5});
  const label = useProgress(2, DUR.f4);
  const trail = useDraw(DUR.f4, Math.max(DUR.f5, span - DUR.f5 * 2));
  const chipIn = useProgress(DUR.f4, DUR.f4);
  const travel = useProgress(DUR.f4, span - DUR.f4 * 2, 'decelerate');
  // 行进虚线（评审修复）：M-001 运动语言里运行中的带恒有 dash（motifs BeltStrip
  // 契约——恒速行进感由调用侧叠层，P0 BeltLine 判例）；只画节点盒之间的空档。
  const dash = useFlowDash({dash: 14, gap: 26, period: 26});
  // 起点：右缘 lane 登记表侧；终点：传送带「开口」节点
  const chipX = 1600 + (430 - 1600) * travel;
  const chipY = 425 + (575 - 425) * travel;

  return (
    <AbsoluteFill>
      <div style={beltIn}>
        <BeltStrip x={340} y={530} width={920} />
        {/* 盒位（viewBox 系）：40..104 / 426..490 / 812..876——虚线段收在两处中段空档 */}
        <svg width={920} height={96} viewBox="0 0 920 96" style={{position: 'absolute', left: 340, top: 530}}>
          <line x1={110} y1={48} x2={420} y2={48} stroke={theme.core} strokeWidth={3} strokeLinecap="round" opacity={0.7} {...dash} />
          <line x1={496} y1={48} x2={806} y2={48} stroke={theme.core} strokeWidth={3} strokeLinecap="round" opacity={0.7} {...dash} />
        </svg>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 352,
          top: 478,
          fontFamily: theme.serif,
          fontSize: 30,
          fontWeight: 700,
          color: theme.core,
          opacity: label,
        }}
      >
        {'主循环'}
      </div>
      {/* 通知投递轨（mech 虚纵深 → 开口） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <path
          d="M 1650 425 C 1250 260, 700 330, 448 545"
          fill="none"
          stroke={theme.mechDeep}
          strokeWidth={2.5}
          {...trail}
        />
      </svg>
      {/* 通知 chip（主循环自己送） */}
      <div
        style={{
          position: 'absolute',
          left: chipX - 130,
          top: chipY - 24,
          opacity: chipIn,
        }}
      >
        <Panel accent={theme.mech} style={{width: 260, padding: '10px 0', textAlign: 'center'}}>
          <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.mech}}>{'<task_notification>'}</span>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 2-H 收尾（p2-29..30）：官方排队层 + 下一台装置预告 ───────────────────

const TailNote: React.FC<{atRelease: number; atNext: number; span: number}> = ({
  atRelease,
  atNext,
  span,
}) => {
  const queue = useEnter('slideL', {at: 2, dur: DUR.f5, dist: 80, springPreset: 'settle'});
  const chips = useStagger(4, {at: 2 + DUR.f5, stride: 6, dur: DUR.f4});
  const release = useProgress(atRelease, DUR.f5, 'accelerate');
  const next = useEnter('rise', {at: atNext, dur: DUR.f5, dist: 60, springPreset: 'settle'});
  // 分针在 p2-30 窗内匀速走一格——「管时间」的动势预告（P3 定时线族）
  const hand = useProgress(atNext + DUR.f4, Math.max(DUR.f5, span - atNext - DUR.f4), 'linear');
  const handAgl = ((-60 + 110 * hand) * Math.PI) / 180;

  return (
    <AbsoluteFill>
      {/* 左：官方还多一层——完成的活先存着排队，哪轮有空哪轮送 */}
      <div style={{position: 'absolute', left: 430, top: 380, ...queue}}>
        <Panel style={{width: 620, padding: '26px 30px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <span style={{fontFamily: theme.serif, fontSize: 29, fontWeight: 700, color: theme.text}}>
              {'产品版 · 多一层'}
            </span>
            <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{'queued'}</span>
          </div>
          <div style={{display: 'flex', gap: 12, marginTop: 24, alignItems: 'center'}}>
            {['bg_0001', 'bg_0002', 'bg_0003', 'bg_0004'].map((id, i) => (
              <div
                key={id}
                style={{
                  width: 104,
                  height: 46,
                  borderRadius: 8,
                  border: `2px solid ${theme.panelBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.mono,
                  fontSize: 19,
                  color: theme.text,
                  opacity: i === 0 ? chips[0] * (1 - release) : chips[i],
                  transform: i === 0 ? `translateX(${release * 120}px)` : undefined,
                }}
              >
                {id}
              </div>
            ))}
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 26,
                color: theme.dim,
                opacity: release,
                marginLeft: 4,
              }}
            >
              {'→'}
            </span>
          </div>
          <div
            style={{
              fontFamily: theme.sans,
              fontSize: 22,
              color: theme.dim,
              marginTop: 20,
              opacity: chips[3],
            }}
          >
            {'先存着 · 有空才送'}
          </div>
        </Panel>
      </div>

      {/* 右：第二台装置——它管时间（mech 蓝 = P3 定时线族预告） */}
      <div style={{position: 'absolute', left: 1130, top: 380, ...next}}>
        <Panel accent={theme.mech} style={{width: 430, padding: '24px 30px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.serif, fontSize: 29, fontWeight: 700, color: theme.mech}}>
            {'第二台装置'}
          </div>
          <svg width={130} height={130} style={{marginTop: 14}}>
            <circle cx={65} cy={65} r={52} fill="none" stroke={theme.mech} strokeWidth={4} />
            {[0, 90, 180, 270].map((a) => {
              const rad = ((a - 90) * Math.PI) / 180;
              return (
                <line
                  key={a}
                  x1={65 + 44 * Math.cos(rad)}
                  y1={65 + 44 * Math.sin(rad)}
                  x2={65 + 50 * Math.cos(rad)}
                  y2={65 + 50 * Math.sin(rad)}
                  stroke={theme.mech}
                  strokeWidth={3}
                />
              );
            })}
            {/* 时针（静）+ 分针（走） */}
            <line x1={65} y1={65} x2={65 + 26 * Math.cos((240 * Math.PI) / 180)} y2={65 + 26 * Math.sin((240 * Math.PI) / 180)} stroke={theme.text} strokeWidth={4} strokeLinecap="round" />
            <line x1={65} y1={65} x2={65 + 40 * Math.cos(handAgl)} y2={65 + 40 * Math.sin(handAgl)} stroke={theme.text} strokeWidth={3} strokeLinecap="round" />
            <circle cx={65} cy={65} r={4} fill={theme.mech} />
          </svg>
          <div style={{fontFamily: theme.serif, fontSize: 25, color: theme.text, marginTop: 12}}>
            {'它管时间'}
          </div>
        </Panel>
      </div>

      <Footnote delay={2}>{'npm install · package.json'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P2OneReceipt: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p2-01', 'p2-02');
  const bB = w('p2-03', 'p2-04');
  const bC = w('p2-05', 'p2-08');
  const bD = w('p2-09');
  const bE = w('p2-10', 'p2-13');
  const bF = w('p2-14', 'p2-15');
  const bG = w('p2-16', 'p2-22');
  const bH = w('p2-23', 'p2-30');
  // 后台线横跨 2-E..2-G 三镜（单 Sequence 保住滚筒/小票等跨镜状态）
  const bLane = w('p2-10', 'p2-22');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />
      <SceneTag chapter="一张回执" tagline="一次调用 · 只配一个结果" />

      <Sequence {...bA} name="2-A 配对名额">
        {/* 两 cue 句句相接——实例内自动抑制换章弹入；P1 末图隔幕间呼吸 → 默认入场 */}
        <ArchifyRecap
          slug="one-call-one-receipt"
          caption="一张订单"
          cues={[
            {chapterId: 'pair-rule', at: at('p2-01') - bA.from, durationInFrames: dur('p2-01')},
            {chapterId: 'reject-second', at: at('p2-02') - bA.from, durationInFrames: dur('p2-02')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="2-B 网购类比">
        <ShopAnalogy
          atCard={at('p2-03') - bB.from}
          atIconL={at('p2-03') + Math.round(dur('p2-03') * 0.5) - bB.from}
          atIconR={at('p2-04') + Math.round(dur('p2-04') * 0.45) - bB.from}
        />
      </Sequence>

      <Sequence {...bC} name="2-C 双闸分派">
        {/* 两 cue 各跨双句（拨杆/筛网），相邻自动抑制 */}
        <ArchifyRecap
          slug="dispatch-two-gates"
          caption="双闸分派"
          cues={[
            {chapterId: 'gate-one', at: at('p2-05') - bC.from, durationInFrames: dur('p2-05') + dur('p2-06')},
            {chapterId: 'gate-two', at: at('p2-07') - bC.from, durationInFrames: dur('p2-07') + dur('p2-08')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="2-D 挡不住">
        <LeverFall span={dur('p2-09')} />
      </Sequence>

      {/* 右缘后台线：先于图镜挂轨（母图层锚，画框之下不争位） */}
      <Sequence {...bLane} name="右缘后台线（2-E..2-G）">
        <BgLane
          span={bLane.durationInFrames}
          atLamp={at('p2-11') + Math.round(dur('p2-11') * 0.45) - bLane.from}
          atRoll={at('p2-12') + Math.round(dur('p2-12') * 0.5) - bLane.from}
          atLock={at('p2-13') + Math.round(dur('p2-13') * 0.5) - bLane.from}
          atTicket={at('p2-14') + Math.round(dur('p2-14') * 0.3) - bLane.from}
          atCheck={at('p2-20') + Math.round(dur('p2-20') * 0.5) - bLane.from}
          atCall={at('p2-22') + Math.round(dur('p2-22') * 0.45) - bLane.from}
        />
      </Sequence>

      <Sequence {...bE} name="2-E 三件事">
        <ArchifyRecap
          slug="bg-tasks-loop"
          caption="占位回执"
          cues={[
            {chapterId: 'placeholder-hand', at: at('p2-10') - bE.from, durationInFrames: dur('p2-10') + dur('p2-11') + dur('p2-12') + dur('p2-13')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="2-F 占位小票">
        {/* 跨实例背靠背（上一实例末句 p2-13 直接接 p2-14）→ 关入场 */}
        <ArchifyRecap
          lead={false}
          slug="bg-tasks-loop"
          caption="占位回执"
          cues={[
            {chapterId: 'placeholder-hand', at: at('p2-14') - bF.from, durationInFrames: dur('p2-14') + dur('p2-15')},
          ]}
        />
      </Sequence>

      <Sequence {...bG} name="2-G 通知合流">
        {/* 同章双 cue 中隔 p2-19 空窗：实例级 lead={false} 会经 lead && enters 连带
            压制空窗后重现章的恢复入场（全不透明一帧瞬现）→ 按空窗拆两实例。
            首实例与 2-F 跨镜背靠背（p2-15 末=p2-16 始，gap=0）→ lead={false}；
            p2-20 的 cue 单独实例走默认 lead（explained P2ToolRegistry 2-C 同解） */}
        <ArchifyRecap
          slug="bg-tasks-loop"
          caption="占位回执"
          lead={false}
          cues={[
            {chapterId: 'notify-merge', at: at('p2-16') - bG.from, durationInFrames: dur('p2-16') + dur('p2-17') + dur('p2-18')},
          ]}
        />
        {/* p2-19 空窗由主循环带持有画面（窗 = 本句） */}
        <Sequence from={at('p2-19') - bG.from} durationInFrames={dur('p2-19')} name="2-G 空窗主循环带">
          <MainLoopGap span={dur('p2-19')} />
        </Sequence>
        <ArchifyRecap
          slug="bg-tasks-loop"
          caption="占位回执"
          cues={[
            {chapterId: 'notify-merge', at: at('p2-20') - bG.from, durationInFrames: dur('p2-20') + dur('p2-21') + dur('p2-22')},
          ]}
        />
      </Sequence>

      <Sequence {...bH} name="2-H 两回合剧本">
        {/* 三 cue 句句相接——实例内自动抑制；与 2-G 背靠背（p2-22 末=p2-23 始）跨 slug
            换图同判例（explained P2ToolRegistry p2-16→p2-17）→ lead={false} */}
        <ArchifyRecap
          slug="two-round-script"
          caption="两回合剧本"
          lead={false}
          cues={[
            {chapterId: 'turn-one', at: at('p2-23') - bH.from, durationInFrames: dur('p2-23') + dur('p2-24')},
            {chapterId: 'turn-two', at: at('p2-25') - bH.from, durationInFrames: dur('p2-25') + dur('p2-26')},
            {chapterId: 'zero-wait', at: at('p2-27') - bH.from, durationInFrames: dur('p2-27') + dur('p2-28')},
          ]}
        />
        {/* p2-29..30 native 收尾：排队层 + 下一台装置预告 */}
        <Sequence
          from={at('p2-29') - bH.from}
          durationInFrames={dur('p2-29') + dur('p2-30')}
          name="2-H 收尾排队层"
        >
          <TailNote
            atRelease={Math.round(dur('p2-29') * 0.72)}
            atNext={at('p2-30') - at('p2-29')}
            span={dur('p2-29') + dur('p2-30')}
          />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2OneReceipt;
