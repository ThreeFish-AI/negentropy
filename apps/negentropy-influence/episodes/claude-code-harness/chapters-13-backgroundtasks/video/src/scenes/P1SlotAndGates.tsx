/** P1 名额与闸门（p1-01..p1-10，4 镜）——分镜 1-A / 1-B / 1-C / 1-D。
 *
 *  叙事链：1-A 开帧环体压停位坐标锚一拍（承 0-C 态）→ @pushIn 急推协议卡满幅
 *  特写（morph：同一卡推近、调用块与单结果槽位展开——槽位暗态轮廓 → 实体单槽
 *  连续推进）→ p1-01「一次调用，只配一个结果」词落位调用块与单槽点亮连线 →
 *  p1-02「干等」词落位上路计时器膨胀到撑满岔口（堵死）、「违规」词落位下路盖
 *  警示红 ✗——双路同帧均不可通行（两难定格）→ 1-B 双闸门分派装置首次亮出：
 *  p1-03「丢后台」词落位后台轨亮出雾蓝轮廓、「两道闸门」词落位双门 stagger
 *  先后立起 → p1-04 参数签翻出 → 门①读卡位扫过确认绿放行 → 命令卡穿门滑向
 *  后台轨 → p1-05「兜底」词落位门②扫描位亮起（扫描灯带待扫——词级扫描留
 *  1-C）→ 1-C 闸门②词级扫描 ECU：扫描灯带自左向右单向扫过，安装/构建/测试
 *  三词示范命中逐个点亮（词级 stagger，十一词全表进角标不上屏）→ p1-07「不要
 *  后台」小签被灯带径直穿过（不减速不停留——无视的可核对判据）→ 小签暗角化
 *  定格 → 1-D 左红右绿消融同屏（全片张力峰值一）：左轨拔掉兜底判定签 sync、
 *  阻塞条 0→600 动态增长（count-up punch）、缩微环体被等待砖压停（0-A 同形
 *  回扣）；右轨兜底在位转后台、阻塞条 0 秒定格、缩微环体照常旋转（砖在此侧
 *  清走）→ p1-09 600 秒标尺线贯通双轨＋「＝十分钟全程」标注 → p1-10 右轨末端
 *  浮起问号悬念签（半透明，交给 P2/P3）。
 *
 *  空间契约：单槽为唯一高亮主体（禁第二个结果槽位——逆旁白）、两岔路上下
 *    等距对称同帧不可通行；双门串联次序=口播次序（①参数在前②兜底在后）、
 *    后台轨雾蓝为唯一主题色元素、同步轨非惩罚态；扫描单向不回头、命中词
 *    点亮次序=口播次序、「不要」小签全程不被读取；红左绿右恒定、双轨除分派
 *    判定与阻塞外全同构、阻塞刻度与口播一致（0 ↔ 600）。
 *
 *  红线落实：词落位 = wa(id,f)（⑧ 轮按句内字位复核一轮：拦截类 cue 前置词窗
 *    早段——p1-02 红 ✗ 取词窗 0.82 前沿，防句末定格帧语义反转〔QA 教训 35〕）；
 *    y≥56 / bottom≥176；tool_use → tool_result · run_in_background ·
 *    should_run_background · slow_keywords 全表 · dispatch: heuristic → sync ·
 *    0s → 600s 只进角标；600 count-up 数据本体线性禁过冲〔QA 教训（数据红线）〕。
 *
 *  承接登记：0-C→1-A morph（storyboard 登记）——ProtocolCard 同件承载，卡轮廓
 *    ＋通道形跨镜恒定，槽位轮廓随推近展开；1-D→2-A SceneFade＋走查舞台全景
 *    重锚，环体〔M-001〕同形签名回归（非 morph，承 ep2 3-C→4-A 判例）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  BlockingBar,
  DualGateRig,
  KeywordScanner,
  LoopRing,
  ProtocolCard,
  RingExecSeg,
  WaitBrick,
} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 1-A 急推协议卡：单槽展开 + 双路撞墙（morph 起点 = 0-C 卡位） ────────────

const RING_1 = {x: 300, y: 250, size: 440} as const;
const PROTO_1 = {x: 880, y: 300, w: 600, h: 330} as const;

const OneA: React.FC<{atZoom: number; atPair: number; atTimer: number; atX: number}> = ({atZoom, atPair, atTimer, atX}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 急推（显式 26f≈0.9s：跨压停现场→协议卡满幅的大位移；@pushIn 词锚动机 =
  // p1-01 立协议硬规矩压向单槽主角——镜尾微推 usePushIn 叠加聚焦）。
  // 定格位预算（QA 教训 33）：z=1.5、c=(940,460)——岔路计时器撑满后卡右缘
  // x'≈1825、卡底缘 y'≈710，均不越 1920/920 安全带
  const zoomP = clamp01(progress(frame, atZoom, 26));
  const o = {x: PROTO_1.x + PROTO_1.w / 2, y: PROTO_1.y + PROTO_1.h / 2};
  const c = {x: 940, y: 460};
  const z = 1 + (1.5 - 1) * zoomP;
  const zoomTf = `translate(${(c.x - o.x) * zoomP}px, ${(c.y - o.y) * zoomP}px) scale(${z})`;
  // 槽位随推近展开（暗态轮廓 → 实体单槽——morph 中间态：卡形与屏位连续）
  const slotP = clamp01(progress(frame, atZoom + 6, 18));
  // p1-01「一次调用，只配一个结果」：调用块与单槽点亮连线（一对一配对契约）
  const pair = clamp01(progress(frame, atPair, 14));
  // p1-02 两难：上路计时器膨胀撑满岔口（干等=堵死）/ 下路红 ✗（违规）
  const timer = clamp01(progress(frame, atTimer, 18));
  const xP = clamp01(progress(frame, atX, 12));
  // 压停环体（承 0-C 态——推近中退为暗层；光点冻结）
  const cx = RING_1.x + RING_1.size / 2;
  const cy = RING_1.y + RING_1.size / 2;
  const r = RING_1.size / 2 - 46;
  // 镜尾微推（usePushIn 幕内真调用——单槽主角的聚焦语言）
  const microPush = usePushIn(atPair + 6, {scale: 0.03, dur: DUR.f6});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: zoomTf, transformOrigin: `${o.x}px ${o.y}px`}}>
        {/* 压停环体（开帧坐标锚一拍——随推近退为暗层出框） */}
        <div style={{position: 'absolute', left: RING_1.x, top: RING_1.y, opacity: 0.4 * (1 - 0.5 * zoomP)}}>
          <LoopRing size={RING_1.size} nodes={[]} showExit={false} dotProgress={(Math.min(frame, atZoom) / (fps * 2.5)) % 1} />
          <RingExecSeg size={RING_1.size} segP={1} pressP={1} labelP={1} />
        </div>
        <WaitBrick x={cx - 88} y={cy + r - 62} w={176} dropP={1} />
        {/* 对话协议卡（0-C 同件——推近至满幅，槽位展开 + 双岔路显形） */}
        <div style={{position: 'absolute', left: 0, top: 0, transform: microPush, transformOrigin: `${o.x}px ${o.y}px`}}>
          <ProtocolCard
            x={PROTO_1.x}
            y={PROTO_1.y}
            w={PROTO_1.w}
            h={PROTO_1.h}
            slotP={slotP}
            connectP={pair}
            branchP={clamp01(progress(frame, atTimer - 10, 16))}
            timerP={timer}
            xP={xP}
          />
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'tool_use → tool_result'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 双闸门分派装置：双门 stagger 立起 + 第一道放行穿门 ──────────────────

const OneB: React.FC<{atBgRail: number; atGate1: number; atGate2: number; atParam: number; atRead: number; atGreen: number; atPass: number; atScan: number}> = ({atBgRail, atGate1, atGate2, atParam, atRead, atGreen, atPass, atScan}) => {
  const frame = useCurrentFrame();
  const rigLit = clamp01(progress(frame, 2, DUR.f5));
  // p1-03「丢后台」：后台轨亮出雾蓝轮廓（唯一主题色元素）
  const bgRail = clamp01(progress(frame, atBgRail, 14));
  // p1-03「两道闸门」：双门 stagger 落位（①②先后立起）
  const g1 = clamp01(progress(frame, atGate1, 16));
  const g2 = clamp01(progress(frame, atGate2, 16));
  // p1-04：参数签翻出 → 读卡位扫过 → 绿放行灯亮 → 命令卡穿门滑向后台轨
  const param = clamp01(progress(frame, atParam, 12));
  const read = clamp01(progress(frame, atRead, 14));
  const green = clamp01(progress(frame, atGreen, DUR.f4));
  const pass = clamp01(progress(frame, atPass, 22));
  // p1-05「兜底」：门②扫描位亮起（扫描灯带待扫——词级扫描留 1-C）
  const scan = clamp01(progress(frame, atScan, 14));
  return (
    <AbsoluteFill>
      <DualGateRig
        x={200}
        y={330}
        w={1500}
        litP={rigLit}
        gate1P={g1}
        gate2P={g2}
        bgRailP={bgRail}
        paramP={param}
        readP={read}
        greenP={green}
        passT={pass}
        scanP={scan}
      />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'run_in_background · should_run_background'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 闸门②词级扫描 ECU：灯带单向扫过 + 命中词 stagger + 无视小签 ─────────

const OneC: React.FC<{atBand: number; atHits: number[]; atBlue: number; atOut: number; atNoTag: number; atThru: number; atDim: number}> = ({atBand, atHits, atBlue, atOut, atNoTag, atThru, atDim}) => {
  const frame = useCurrentFrame();
  // 扫描灯带：自左向右单向扫过（恒速线性——扫描单向不回头；第二程穿过小签
  // 不减速不停留 = 无视的可核对判据，恒速由构造保证）
  const lap1 = clamp01(progress(frame, atBand, 30));
  const lap2 = clamp01(progress(frame, atThru, 26));
  const bandT = lap1 >= 1 ? lap2 : lap1;
  // 命中词三枚：灯带扫过对应横位即点亮（安装→构建→测试，次序=口播）
  const hitFx = [0.26, 0.48, 0.7];
  const hits = ['安装', '构建', '测试'].map((t, i) => ({
    t,
    fx: hitFx[i],
    p: atHits[i] !== undefined ? clamp01(progress(frame, atHits[i], 10)) : 0,
  }));
  // p1-06「猜它是慢操作」：命令文本条整体转雾蓝 + 收尾滑入后台轨（outP）
  const blue = clamp01(progress(frame, atBlue, 16));
  const out = clamp01(progress(frame, atOut, 20));
  // p1-07：显式「不要后台」小签（明说）→ 灯带径直穿过（thru）→ 暗角化定格
  const noTag = clamp01(progress(frame, atNoTag, DUR.f4));
  const noDim = clamp01(progress(frame, atDim, 16));
  // 后台轨收尾位（条右下方——判为慢操作后的去向，1-B 后台轨同形）
  return (
    <AbsoluteFill>
      <KeywordScanner
        x={240}
        y={340}
        w={1440}
        bandT={bandT}
        hits={hits}
        blueP={blue}
        outP={out}
        noTagP={noTag}
        noTagDimP={noDim}
      />
      {/* 收尾去向轨（后台轨缩微——命令卡穿门滑入） */}
      <div style={{position: 'absolute', left: 240, top: 660, width: 1440, opacity: out * 0.9}}>
        <svg width={1440} height={40} viewBox="0 0 1440 40">
          <line x1={0} y1={20} x2={1440} y2={20} stroke={withAlpha(theme.mech, 0.45 + 0.4 * out)} strokeWidth={4} strokeLinecap="round" />
        </svg>
        <div style={{position: 'absolute', left: 1000 * out, top: -18, padding: '5px 14px', borderRadius: 8, border: `2.5px solid ${theme.mech}`, background: theme.panel, fontFamily: theme.mono, fontSize: 16, color: theme.mech, whiteSpace: 'nowrap', opacity: out}}>
          {'npm install → 后台'}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 17, color: theme.dim, opacity: 0.7}}>
        {'slow_keywords: install / build / test / deploy / compile / docker build / pip install / npm install / cargo build / pytest / make'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-D 左红右绿消融同屏：双轨增长 + 标尺贯通 + 问号悬念（张力峰值一） ──────

/** 双轨布局（红左绿右恒定；除分派判定与阻塞外全同构）；标尺线 y 对齐阻塞条条心 */
const TRACKS_1D = {left: {x: 170, tag: '拔掉兜底'}, right: {x: 1010, tag: '兜底在位'}} as const;
const TRACK_W = 740;
const RULER_Y = 388;

const OneD: React.FC<{atFrame: number; atLeftBar: number; atRuler: number; atQ: number; atClear: number}> = ({atFrame, atLeftBar, atRuler, atQ, atClear}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // p1-08「实测说话」：双轨框架立起（峰值 punch——微推 usePushIn 幕内真调用）
  const frameP = clamp01(progress(frame, atFrame, 20));
  const push = usePushIn(atFrame, {scale: 0.045, dur: DUR.f6});
  // 左轨阻塞条 0→600 动态增长（count-up——数据本体线性禁过冲，重音镜 punch）
  const grow = clamp01(progress(frame, atLeftBar, 52));
  const leftVal = Math.round(600 * grow);
  // 右轨：恒 0 定格（机制在位恒 0——禁任何阻塞）；右轨砖清走（解放态）
  const clear = clamp01(progress(frame, atClear, 18));
  // p1-09：600 秒标尺线贯通双轨 + 「＝十分钟全程」标注落定（基线锚定）
  const ruler = clamp01(progress(frame, atRuler, 20));
  // p1-10：右轨后台轨末端问号悬念签（半透明——真结果怎么进对话）
  const q = clamp01(progress(frame, atQ, DUR.f5));
  // 缩微环体：左轨压停（0-A 同形回扣——砖 + 冻结光点）/ 右轨照常旋转
  const miniDot = (Math.min(frame, atFrame + 10) / (fps * 2.2)) % 1;
  const freeDot = (frame / (fps * 2.2)) % 1;
  const lane = (side: 'left' | 'right') => {
    const x = TRACKS_1D[side].x;
    const isLeft = side === 'left';
    const tone = isLeft ? theme.danger : theme.ok;
    return (
      <div style={{position: 'absolute', left: x, top: 180, width: TRACK_W, opacity: frameP, transform: `translateY(${(1 - frameP) * 24}px)`}}>
        {/* 轨标题签（拔掉兜底 / 兜底在位） */}
        <div
          style={{
            display: 'inline-block',
            padding: '6px 20px',
            borderRadius: 9,
            border: `2.5px solid ${tone}`,
            background: withAlpha(theme.panel, 0.95),
            fontFamily: theme.sans,
            fontSize: 21,
            fontWeight: 700,
            color: tone,
            whiteSpace: 'nowrap',
          }}
        >
          {TRACKS_1D[side].tag}
        </div>
        {/* 同款安装命令卡（npm install——双轨同构） */}
        <div
          style={{
            marginTop: 22,
            width: TRACK_W * 0.72,
            padding: '12px 18px',
            borderRadius: 10,
            border: `3px solid ${withAlpha(theme.panelBorder, 0.95)}`,
            background: withAlpha(theme.panel, 0.95),
            fontFamily: theme.mono,
            fontSize: 24,
            color: theme.text,
            whiteSpace: 'nowrap',
          }}
        >
          {'$ npm install'}
        </div>
        {/* 分派判定签（唯一差异一：sync ↔ 转后台） */}
        <div
          style={{
            marginTop: 16,
            display: 'inline-block',
            padding: '5px 16px',
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(tone, 0.85)}`,
            background: withAlpha(tone, 0.1),
            fontFamily: theme.mono,
            fontSize: 16,
            fontWeight: 700,
            color: tone,
            whiteSpace: 'nowrap',
          }}
        >
          {isLeft ? 'dispatch: heuristic → sync' : 'dispatch: heuristic → background'}
        </div>
        {/* 阻塞时长条（唯一差异二：0→600 ↔ 恒 0） */}
        <div style={{marginTop: 24}}>
          <BlockingBar x={0} y={0} w={TRACK_W * 0.86} fillP={isLeft ? grow : 0} value={isLeft ? leftVal : 0} tone={isLeft ? 'danger' : 'ok'} litP={1} />
        </div>
        {/* 主循环缩微环体（左压停同形回扣 ↔ 右解放旋转——砖在右轨侧清走） */}
        <div style={{position: 'absolute', left: TRACK_W * 0.62, top: 470, width: 190, height: 190}}>
          <div style={{opacity: isLeft ? 0.45 : 0.9}}>
            <LoopRing size={190} nodes={[]} showExit={false} dotProgress={isLeft ? miniDot : freeDot} />
            <RingExecSeg size={190} segP={1} pressP={isLeft ? 1 : 0} freeP={isLeft ? 0 : 1} />
          </div>
          {/* 等待砖：左轨压在执行段正上（0-A 同形回扣）/ 右轨侧向清走 */}
          <WaitBrick x={190 / 2 - 40} y={190 / 2 + (190 / 2 - 46) - 26} w={80} h={30} dropP={1} clearP={isLeft ? 0 : clear} mini />
        </div>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '50% 46%'}}>
        {lane('left')}
        {lane('right')}
        {/* 600 秒基线标尺线（贯通双轨同刻度——p1-09「＝十分钟全程」） */}
        {ruler > 0.02 ? (
          <svg width={1920} height={40} viewBox="0 0 1920 40" style={{position: 'absolute', left: 0, top: RULER_Y - 20, opacity: ruler, pointerEvents: 'none'}}>
            <line x1={150} y1={20} x2={1920 - 60} y2={20} stroke={theme.text} strokeWidth={3.5} strokeDasharray="16 10" opacity={0.85} />
            <circle cx={1920 - 60} cy={20} r={7} fill={theme.text} opacity={0.85} />
          </svg>
        ) : null}
        {ruler > 0.4 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: RULER_Y - 46,
              textAlign: 'center',
              fontFamily: theme.sans,
              fontSize: 24,
              fontWeight: 700,
              color: theme.text,
              opacity: clamp01(progress(frame, atRuler + 8, DUR.f4)),
              whiteSpace: 'nowrap',
            }}
          >
            {'＝十分钟全程'}
          </div>
        ) : null}
        {/* 问号悬念签（右轨后台轨末端——真结果怎么进对话，交给 P2/P3） */}
        {q > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: TRACKS_1D.right.x + TRACK_W - 120,
              top: 300,
              width: 96,
              height: 96,
              borderRadius: '50%',
              border: `3px dashed ${withAlpha(theme.notify, 0.85)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.serif,
              fontSize: 52,
              color: withAlpha(theme.notify, 0.9),
              opacity: q * 0.92,
              transform: `translateY(${(1 - q) * 14}px)`,
            }}
          >
            ？
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'e5 · dispatch: heuristic → sync · 0s → 600s'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P1SlotAndGates: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p1-01', 'p1-02');
  const bB = w('p1-03', 'p1-05');
  const bC = w('p1-06', 'p1-07');
  const bD = w('p1-08', 'p1-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <OneA
          atZoom={wa('p1-01', 0.08) - bA.from}
          atPair={wa('p1-01', 0.52) - bA.from}
          atTimer={wa('p1-02', 0.42) - bA.from}
          atX={wa('p1-02', 0.82) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <OneB
          atBgRail={wa('p1-03', 0.14) - bB.from}
          atGate1={wa('p1-03', 0.76) - bB.from}
          atGate2={wa('p1-03', 0.88) - bB.from}
          atParam={wa('p1-04', 0.38) - bB.from}
          atRead={wa('p1-04', 0.62) - bB.from}
          atGreen={wa('p1-04', 0.74) - bB.from}
          atPass={wa('p1-04', 0.84) - bB.from}
          atScan={wa('p1-05', 0.2) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <OneC
          atBand={wa('p1-06', 0.08) - bC.from}
          atHits={[0.1, 0.24, 0.38].map((f) => wa('p1-06', f) - bC.from)}
          atBlue={wa('p1-06', 0.7) - bC.from}
          atOut={wa('p1-06', 0.84) - bC.from}
          atNoTag={wa('p1-07', 0.28) - bC.from}
          atThru={wa('p1-07', 0.5) - bC.from}
          atDim={wa('p1-07', 0.8) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="1-D">
        <OneD
          atFrame={wa('p1-08', 0.1) - bD.from}
          atLeftBar={wa('p1-08', 0.72) - bD.from}
          atClear={wa('p1-08', 0.24) - bD.from}
          atRuler={wa('p1-09', 0.62) - bD.from}
          atQ={wa('p1-10', 0.42) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1SlotAndGates;
