/** P2 四步走一单（p2-01..p2-08，4 镜）——分镜 2-A / 2-B / 2-C / 2-D。
 *
 *  Morph Continuity（1-C→2-A，头注明示）：同一主体 = 登记表（承 1-C 右半
 *  放大态）。起止态：1-C 末帧表居右半 → 2-A 首帧表驻走查舞台上方同形微缩。
 *  中间态：位移缩放过程中四列表头、行内容、靛蓝描边逐帧不变，仅位置与伴随
 *  元素变化。身份线索：靛蓝描边 + 四列表头轮廓（保两项）。
 *
 *  叙事链：2-A 走查舞台全景：p2-01「第一步，开单」词落位步签①显字、主代理侧
 *  生成靛蓝请求卡、「领号 142 / 类型关机 / 发队友甲」三词落位三签随口播次序
 *  逐签落位、「先记待处理」词落位登记表同步落一行（142 走查输入值首建，全程
 *  可追基线）→ p2-02「第二步，投递」词落位步签②显字、请求卡沿靛蓝投递线滑入
 *  甲收件箱格、「甲先收尾」词落位甲头顶「收尾中」进度环 → 2-B 回执与销账：
 *  p2-03「第三步，回执」词落位步签③显字、回执卡携同一枚 142 号徽章沿回流线
 *  飞回（同号对签 = 对号的视觉主线）→ p2-04「第四步，销账」词落位步签④显字、
 *  「翻表对号」词落位回执卡号徽章与表行号签对位重合闪兰紫（销账落定拍）、
 *  「批准」词落位状态胶囊翻确认绿（P2 记忆点，重音镜）→ p2-05「收摊退场」
 *  词落位甲环携收件箱格淡出、142 行盖「闭环」微章、四步签退役 → 2-C 幕点
 *  生长：p2-06「一个字不用改」词落位「计划审批」新行滑入、同款流转微演一遍、
 *  p2-06b「行话叫协议状态机」词落位命名签贴上表头（命名铺设，兑现 P5 金句，
 *  重音镜）→ 2-D 幕点延伸→悬念镜（镜界承 G1 修订：p2-07 两拍移入本镜）：
 *  开帧承 2-C 机器本体，p2-07「多开一个类型分支」词落位「+ 类型」分支按钮
 *  点亮、虚位类型签挂上分支、「就够」词落位机器外框整体静止一拍（零改动的
 *  静止即陈述）；p2-08「对号」词落位二字合体亮一拍、「三道检查」词落位再裂
 *  成三枚碎片（号 / 类型 / 状态）stagger 悬浮、静置半拍收黑——悬念交给 P3。
 *
 *  空间契约：142 号签全程同形同色可追、步签显字次序 = 口播次序、表行与请求卡
 *  同号同步；回执卡号徽章与请求卡/表行三处同号同形、状态翻转次序 =
 *  待处理→已批准、销账重合拍兰紫唯一；新行与 142 行同构同款、命名签 ≤6 字；
 *  三碎片仅关键词签、悬浮位与 P3 三栏卡头呼应、机器外框无部件增删（分支按钮
 *  除外）。
 *  红线落实：请求卡类型签禁显「审批」（走查单是关机）、步签③④禁提前显字、
 *  回执卡禁携异号徽章、状态禁无对号动作直接跳绿、甲环体禁在销账前退场、新行
 *  禁走查全程展开（微演即收）、命名签禁复述整句口播、碎片禁提前解释检查内容
 *  （P3 正源）；词落位 = wa(id,f)；y≥56 / bottom≥176。
 *
 *  承接登记：2-D→3-A morph（同一主体 = 「对号」三枚碎片：2-D 末帧三碎片悬浮
 *    半空（背景收黑、碎片微光保持可见）→ 3-A 首帧三碎片飞入三栏检查卡栏头
 *    落位——三签文字、色相、相对次序逐帧不变）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  LoopRing,
  MailboxFile,
  NumberBadge,
  RegistryTable,
  ReplyCard,
  RequestCard,
  StepSign,
  TeammateRing,
  useRingDot,
} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 走查舞台共用布局（2-A / 2-B 同一坐标锚——全景坐标锚） ──────────────────

const STAGE2 = {
  /** 步签行（舞台顶——①②③④） */
  steps: {x: 480, y: 60},
  /** 登记表（驻舞台上方——承 1-C morph 微缩） */
  table: {x: 560, y: 126, w: 800},
  /** 主代理（居左：橙环缩悬 + 投递线起点） */
  lead: {x: 140, y: 430, size: 220},
  /** 队友甲（居右：品红环体 + 收件箱格） */
  mate: {x: 1520, y: 430, size: 220},
  /** 甲收件箱格（承 ep15 信箱同款签名） */
  box: {x: 1560, y: 660, w: 220, h: 180},
  /** 请求卡生成位（主代理侧） */
  req: {x: 160, y: 640},
} as const;

/** 表内 142 行号签中心（销账对位重合的靶位） */
const ROW_BADGE_C = {x: STAGE2.table.x + 40, y: STAGE2.table.y + 52 + 29} as const;

/** 「收尾中」进度环（甲头顶——关机请求的类型语义：是关机，先把手上活收尾） */
const WrapRing: React.FC<{x: number; y: number; p: number}> = ({x, y, p}) => {
  const frac = clamp01(p);
  return (
    <svg width={120} height={54} viewBox="0 0 120 54" style={{position: 'absolute', left: x, top: y, overflow: 'visible'}}>
      <circle cx={27} cy={27} r={18} fill="none" stroke={withAlpha(theme.panelBorder, 0.9)} strokeWidth={5} />
      <circle
        cx={27}
        cy={27}
        r={18}
        fill="none"
        stroke={theme.mate}
        strokeWidth={5}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - frac}
        transform={`rotate(-90 27 27)`}
      />
      <text x={56} y={34} fontFamily={theme.sans} fontSize={19} fontWeight={700} fill={theme.mate}>
        收尾中
      </text>
    </svg>
  );
};

// ── 2-A 开单 + 投递：请求卡三签逐签落位 + 表落 142 行 + 滑入甲收件箱格 ────────

const TwoA: React.FC<{atStep1: number; atBadge: number; atType: number; atTo: number; atRow: number; atStep2: number; atSlide: number; atWrap: number}> = ({
  atStep1,
  atBadge,
  atType,
  atTo,
  atRow,
  atStep2,
  atSlide,
  atWrap,
}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 步签①②显字（口播次序）
  const s1 = clamp01(progress(frame, atStep1, DUR.f4));
  const s2 = clamp01(progress(frame, atStep2, DUR.f4));
  // 请求卡三签（号签 142 / 类型签 关机 / 收件签 队友甲——随口播次序逐签落位）
  const bP = clamp01(progress(frame, atBadge, DUR.f4));
  const tP = clamp01(progress(frame, atType, DUR.f4));
  const toP = clamp01(progress(frame, atTo, DUR.f4));
  // 表落 142 行（先记待处理——走查输入值首建）
  const rowP = clamp01(progress(frame, atRow, 16));
  // 请求卡滑入甲收件箱格（p2-02「第二步，投递」——沿靛蓝投递线）
  const slide = clamp01(progress(frame, atSlide, 26));
  // 甲头顶「收尾中」进度环（p2-02「甲先收尾」）
  const wrap = clamp01(progress(frame, atWrap, 18));
  // 投递线（主代理 → 甲收件箱格：滑入拍起描线 + 流光）
  const lineP = clamp01(progress(frame, atSlide - 6, 24));
  // 请求卡轨迹：生成位 → 甲收件箱格内
  const reqX = STAGE2.req.x + (STAGE2.box.x + 10 - STAGE2.req.x) * slide;
  const reqY = STAGE2.req.y + (STAGE2.box.y + 44 - STAGE2.req.y) * slide;
  return (
    <AbsoluteFill>
      {/* 登记表（驻舞台上方——承 1-C morph 微缩；142 行滑入落行） */}
      <div style={{position: 'absolute', left: STAGE2.table.x, top: STAGE2.table.y}}>
        <RegistryTable
          x={0}
          y={0}
          w={STAGE2.table.w}
          rows={[{key: 'r142', badge: '142', type: '关机', to: '队友甲', state: 'pending', rowP}]}
        />
      </div>
      {/* 四枚步签（舞台顶——①开单 ②投递 已显字，③④ 虚位） */}
      <div style={{position: 'absolute', left: STAGE2.steps.x, top: STAGE2.steps.y, display: 'flex', gap: 26}}>
        <StepSign index={0} label="开单" litP={1} textP={s1} />
        <StepSign index={1} label="投递" litP={1} textP={s2} />
        <StepSign index={2} litP={1} />
        <StepSign index={3} litP={1} />
      </div>
      {/* 主代理（橙环缩悬——走查中待命） */}
      <div style={{position: 'absolute', left: STAGE2.lead.x, top: STAGE2.lead.y}}>
        <LoopRing size={STAGE2.lead.size} nodes={[]} showExit={false} dotProgress={dot} />
        <div style={{position: 'absolute', left: 34, top: STAGE2.lead.size + 6, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap'}}>
          主代理
        </div>
      </div>
      {/* 队友甲（品红环体 + 收件箱格） */}
      <div style={{position: 'absolute', left: STAGE2.mate.x, top: STAGE2.mate.y, opacity: 1}}>
        <TeammateRing size={STAGE2.mate.size} dotProgress={(dot + 0.4) % 1} />
        <div style={{position: 'absolute', left: 46, top: STAGE2.mate.size + 6, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.mate, whiteSpace: 'nowrap'}}>
          队友甲
        </div>
        {/* 「收尾中」进度环（甲头顶——p2-02 词落位亮起） */}
        {wrap > 0.02 ? <WrapRing x={54} y={-64} p={wrap} /> : null}
      </div>
      {/* 甲收件箱格（承 ep15 信箱同款签名——请求卡滑入位） */}
      <div style={{position: 'absolute', left: STAGE2.box.x, top: STAGE2.box.y}}>
        <MailboxFile x={0} y={0} w={STAGE2.box.w} h={STAGE2.box.h} name="teammate-a.jsonl" litP={1} rows={slide > 0.85 ? 1 : 0} glowP={slide > 0.6 && slide < 0.95 ? 0.8 : 0} />
      </div>
      {/* 投递线（靛蓝——主代理 → 甲收件箱格，滑入拍描线） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <path
          d={`M ${STAGE2.lead.x + STAGE2.lead.size + 6} ${STAGE2.lead.y + STAGE2.lead.size / 2} Q 1000 ${STAGE2.lead.y + 60} ${STAGE2.box.x - 8} ${STAGE2.box.y + 40}`}
          fill="none"
          stroke={withAlpha(theme.req, 0.75)}
          strokeWidth={4.5}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - lineP}
        />
      </svg>
      {/* 请求卡（靛蓝——三签逐签落位；沿投递线滑入收件箱格） */}
      <div style={{position: 'absolute', left: reqX, top: reqY, opacity: clamp01(progress(frame, atStep1 + 4, 10))}}>
        <div style={{transform: `scale(${1 - 0.3 * slide})`, transformOrigin: '0 0'}}>
          <RequestCard w={300} badgeP={bP} typeP={tP} toP={toP} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'dispatch_message · shutdown_request · 四步走一单'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 回执与销账：回执卡携 142 回流 → 对号重合闪兰紫 → 翻绿闭环 → 退场 ────

const TwoB: React.FC<{atStep3: number; atFly: number; atStep4: number; atMatch: number; atApprove: number; atExit: number}> = ({
  atStep3,
  atFly,
  atStep4,
  atMatch,
  atApprove,
  atExit,
}) => {
  const frame = useCurrentFrame();
  const push = usePushIn(2, {scale: 0.06, dur: DUR.f6});
  const dot = useRingDot(2.5);
  // 步签③④显字
  const s3 = clamp01(progress(frame, atStep3, DUR.f4));
  const s4 = clamp01(progress(frame, atStep4, DUR.f4));
  // 回执卡沿回流线飞回（甲收件箱格 → 表行号签位）
  const fly = clamp01(progress(frame, atFly, 30));
  // 对号重合（回执卡号徽章与表行号签对位重合——销账落定拍闪兰紫）
  const match = clamp01(progress(frame, atMatch, 10));
  const matchGlow = Math.sin(Math.PI * clamp01(progress(frame, atMatch + 6, 26)));
  // 状态胶囊翻确认绿（「批准」词——P2 记忆点重音镜）
  const approve = clamp01(progress(frame, atApprove, DUR.f4));
  const approveFlash = Math.sin(Math.PI * clamp01(progress(frame, atApprove, 24)));
  // 甲环携收件箱格淡出退场 + 142 行盖「闭环」微章 + 四步签退役（p2-05）
  const exit = clamp01(progress(frame, atExit, 20));
  const closed = clamp01(progress(frame, atExit + 10, DUR.f4));
  // 回执卡轨迹：甲收件箱格 → 表行号签（贝塞尔——先降后升的回流弧）
  const from = {x: STAGE2.box.x + 40, y: STAGE2.box.y + 60};
  const to = {x: ROW_BADGE_C.x, y: ROW_BADGE_C.y};
  const flyX = from.x + (to.x - from.x) * fly;
  const flyY = from.y + (to.y - from.y) * fly - Math.sin(Math.PI * fly) * 120;
  const cardO = fly > 0.02 ? 1 - clamp01(match - 0.5) * 2 : 0;
  return (
    <AbsoluteFill style={{transform: push, transformOrigin: '50% 30%'}}>
      {/* 登记表（142 行悬停待翻 → 销账翻绿 → 盖闭环微章） */}
      <div style={{position: 'absolute', left: STAGE2.table.x, top: STAGE2.table.y}}>
        <RegistryTable
          x={0}
          y={0}
          w={STAGE2.table.w}
          rows={[{key: 'r142', badge: '142', type: '关机', to: '队友甲', state: 'approved', stateP: approve, closedP: closed, hotP: 0.2 + 0.8 * Math.max(matchGlow, approveFlash * 0.6)}]}
        />
      </div>
      {/* 四枚步签（③回执 ④销账 显字；p2-05 服务完本拍退役〔M-006〕） */}
      <div style={{position: 'absolute', left: STAGE2.steps.x, top: STAGE2.steps.y, display: 'flex', gap: 26, opacity: 1 - exit * 0.85}}>
        <StepSign index={0} label="开单" litP={1} textP={1} />
        <StepSign index={1} label="投递" litP={1} textP={1} />
        <StepSign index={2} label="回执" litP={1} textP={s3} />
        <StepSign index={3} label="销账" litP={1} textP={s4} />
      </div>
      {/* 主代理（左侧待命——回执回流终点侧） */}
      <div style={{position: 'absolute', left: STAGE2.lead.x, top: STAGE2.lead.y}}>
        <LoopRing size={STAGE2.lead.size} nodes={[]} showExit={false} dotProgress={dot} />
        <div style={{position: 'absolute', left: 34, top: STAGE2.lead.size + 6, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap'}}>
          主代理
        </div>
      </div>
      {/* 队友甲 + 收件箱格（销账后携格淡出退场——甲环体在销账前不退场） */}
      <div style={{position: 'absolute', left: STAGE2.mate.x, top: STAGE2.mate.y, opacity: 1 - exit}}>
        <TeammateRing size={STAGE2.mate.size} dotProgress={(dot + 0.4) % 1} />
        <div style={{position: 'absolute', left: 46, top: STAGE2.mate.size + 6, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.mate, whiteSpace: 'nowrap'}}>
          队友甲 · 收摊
        </div>
      </div>
      <div style={{position: 'absolute', left: STAGE2.box.x, top: STAGE2.box.y, opacity: 1 - exit}}>
        <MailboxFile x={0} y={0} w={STAGE2.box.w} h={STAGE2.box.h} name="teammate-a.jsonl" litP={1} rows={0} />
      </div>
      {/* 回流线（兰紫虚线——甲收件箱格 → 表行；对号合拍点亮） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <path
          d={`M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${Math.min(from.y, to.y) - 120} ${to.x} ${to.y}`}
          fill="none"
          stroke={withAlpha(theme.receipt, 0.25 + 0.55 * fly)}
          strokeWidth={4}
          strokeDasharray="12 10"
        />
        {/* 销账落定拍（对位重合闪兰紫——表行号签位辉光环） */}
        {matchGlow > 0.03 ? (
          <circle cx={to.x} cy={to.y} r={30 + 22 * matchGlow} fill="none" stroke={withAlpha(theme.receipt, 0.9 * matchGlow)} strokeWidth={4} />
        ) : null}
      </svg>
      {/* 回执卡（兰紫——携同一枚 142 号徽章 + 「同意」签沿回流线飞回） */}
      <div style={{position: 'absolute', left: flyX - 150, top: flyY - 24, opacity: cardO}}>
        <ReplyCard w={300} badgeP={1} agreeP={1} />
      </div>
      {/* 对号重合读数（表行号签上——号对上 ✓） */}
      {match > 0.4 ? (
        <div
          style={{
            position: 'absolute',
            left: ROW_BADGE_C.x + 34,
            top: ROW_BADGE_C.y - 16,
            fontFamily: theme.mono,
            fontSize: 17,
            color: theme.receipt,
            whiteSpace: 'nowrap',
            opacity: match,
          }}
        >
          号对上 ✓
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'shutdown_response · 翻表对号，才改状态'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-C 幕点生长：计划审批新行 + 同款微演 + 协议状态机命名签 ─────────────────

const TABLE_2C = {x: 460, y: 250, w: 1000} as const;
const FRAME_2C = {x: 420, y: 196, w: 1080, h: 500} as const;

const TwoC: React.FC<{atNewRow: number; atMicro: number; atName: number}> = ({atNewRow, atMicro, atName}) => {
  const frame = useCurrentFrame();
  // 新行滑入（p2-06「一个字不用改」——同构重复，节奏较 2-B 加快）
  const rowP = clamp01(progress(frame, atNewRow, 14));
  // 同款三态流转微演（待处理→已批准一闪即收——观众已识机制）
  const micro = clamp01(progress(frame, atMicro, 14));
  // 命名签贴上表头（p2-06b「行话叫协议状态机」——命名铺设，重音镜）
  const nameP = clamp01(progress(frame, atName, DUR.f4));
  const nameGlow = Math.sin(Math.PI * clamp01(progress(frame, atName, 30)));
  // 机器本体外框（表+动线装置——虚线外框常驻；2-D 承接）
  const frameIn = clamp01(progress(frame, 4, 16));
  return (
    <AbsoluteFill>
      {/* 机器本体外框（「机器」= 表 + 动线装置的整体轮廓——2-D 开帧承接位） */}
      <div
        style={{
          position: 'absolute',
          left: FRAME_2C.x,
          top: FRAME_2C.y,
          width: FRAME_2C.w,
          height: FRAME_2C.h,
          borderRadius: 18,
          border: `2.5px dashed ${withAlpha(theme.dim, 0.55)}`,
          opacity: frameIn,
        }}
      />
      {/* 登记表（142 行已闭环 + 计划审批新行滑入走同款微演） */}
      <div style={{position: 'absolute', left: TABLE_2C.x, top: TABLE_2C.y}}>
        <RegistryTable
          x={0}
          y={0}
          w={TABLE_2C.w}
          nameP={nameP}
          rows={[
            {key: 'r142', badge: '142', type: '关机', to: '队友甲', state: 'approved', stateP: 1, closedP: 1, hotP: 0.15},
            {key: 'plan', badge: undefined, type: '计划审批', to: '主代理', state: 'approved', rowP, stateP: micro},
          ]}
        />
      </div>
      {/* 命名签辉光一拍（重音镜——贴上表头的落定拍） */}
      {nameGlow > 0.03 ? (
        <div
          style={{
            position: 'absolute',
            left: TABLE_2C.x + TABLE_2C.w - 190,
            top: TABLE_2C.y + 8,
            width: 176,
            height: 38,
            borderRadius: 9,
            boxShadow: `0 0 ${30 * nameGlow}px ${withAlpha(theme.receipt, 0.7 * nameGlow)}`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'同一张表 · 同一套状态 · ProtocolState'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-D 幕点延伸→悬念镜：分支按钮 + 静止一拍 + 「对号」合体裂三碎片 ──────────

/** 三碎片悬浮位（与 P3 三栏卡头呼应——P3ThreeChecks COL_HEADS 同 x 序） */
const SHARDS_2D = [
  {x: 700, y: 640, label: '号'},
  {x: 930, y: 660, label: '类型'},
  {x: 1160, y: 640, label: '状态'},
] as const;

const TwoD: React.FC<{atBranch: number; atStill: number; atMergeWord: number; atSplit: number}> = ({atBranch, atStill, atMergeWord, atSplit}) => {
  const frame = useCurrentFrame();
  // 「+ 类型」分支按钮点亮 + 虚位类型签挂上（p2-07「多开一个类型分支」）
  const branch = clamp01(progress(frame, atBranch, DUR.f4));
  // 机器外框整体静止一拍（p2-07「就够」——零改动的静止即陈述：外框亮一拍后
  // 完全静止，无任何部件增删〔分支按钮除外〕）
  const still = Math.sin(Math.PI * clamp01(progress(frame, atStill, 26)));
  // 「对号」二字合体亮一拍（p2-08 词落位）
  const merged = clamp01(progress(frame, atMergeWord, 12));
  const mergedGlow = Math.sin(Math.PI * clamp01(progress(frame, atMergeWord, 30)));
  // 裂成三枚碎片 stagger 悬浮（「三道检查」词落位——P3 正源预埋）
  const split = clamp01(progress(frame, atSplit, 18));
  const shardFly = [0, 1, 2].map((i) => clamp01(progress(frame, atSplit + 3 + i * 4, 14)));
  // 静置半拍收黑（背景暗罩——三碎片微光保持可见，morph 不断）
  const darken = clamp01(progress(frame, atSplit + 34, 18)) * 0.72;
  return (
    <AbsoluteFill>
      {/* 机器本体（承 2-C 同位——表 + 外框；分支按钮为唯一新增部件） */}
      <div
        style={{
          position: 'absolute',
          left: FRAME_2C.x,
          top: FRAME_2C.y,
          width: FRAME_2C.w,
          height: FRAME_2C.h,
          borderRadius: 18,
          border: `2.5px dashed ${withAlpha(theme.dim, 0.55 + 0.45 * still)}`,
          boxShadow: still > 0.03 ? `0 0 ${26 * still}px ${withAlpha(theme.dim, 0.4 * still)}` : 'none',
        }}
      />
      <div style={{position: 'absolute', left: TABLE_2C.x, top: TABLE_2C.y, opacity: 1 - split * 0.75}}>
        <RegistryTable
          x={0}
          y={0}
          w={TABLE_2C.w}
          nameP={1}
          branchP={branch}
          rows={[
            {key: 'r142', badge: '142', type: '关机', to: '队友甲', state: 'approved', stateP: 1, closedP: 1},
            {key: 'plan', badge: undefined, type: '计划审批', to: '主代理', state: 'approved', stateP: 1},
          ]}
        />
      </div>
      {/* 虚位类型签（挂上分支——「加新协商？多开一个类型分支」） */}
      {branch > 0.4 ? (
        <div
          style={{
            position: 'absolute',
            left: TABLE_2C.x + TABLE_2C.w - 210,
            top: TABLE_2C.y + 108,
            padding: '6px 18px',
            borderRadius: 9,
            border: `2.5px dashed ${withAlpha(theme.ok, 0.8)}`,
            fontFamily: theme.sans,
            fontSize: 18,
            fontWeight: 700,
            color: theme.ok,
            whiteSpace: 'nowrap',
            opacity: clamp01((branch - 0.4) * 2.5),
          }}
        >
          新类型 · 虚位
        </div>
      ) : null}
      {/* 「对号」二字（合体亮一拍 → 裂碎：合体位屏中央，裂碎后碎片自中央散开） */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 470,
          transform: `translate(-50%, -50%) scale(${1 + 0.12 * mergedGlow})`,
          opacity: merged * (1 - split * 0.9),
        }}
      >
        <div
          style={{
            padding: '18px 56px',
            borderRadius: 16,
            border: `4px solid ${withAlpha(theme.receipt, 0.9)}`,
            background: withAlpha(theme.panel, 0.98),
            fontFamily: theme.serif,
            fontSize: 64,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            boxShadow: mergedGlow > 0.03 ? `0 0 ${40 * mergedGlow}px ${withAlpha(theme.receipt, 0.65 * mergedGlow)}` : 'none',
          }}
        >
          对号
        </div>
      </div>
      {/* 三碎片（号 / 类型 / 状态——自中央散开悬浮、各携微光；静置半拍） */}
      {SHARDS_2D.map((s, i) => {
        const f = shardFly[i];
        if (f <= 0.02) return null;
        const x = 960 + (s.x - 960) * f;
        const y = 470 + (s.y - 470) * f;
        return (
          <div
            key={`sh${i}`}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              transform: `translate(-50%, -50%) scale(${0.6 + 0.4 * f})`,
              opacity: f,
            }}
          >
            <div
              style={{
                padding: '14px 34px',
                borderRadius: 12,
                border: `3px solid ${withAlpha(theme.text, 0.85)}`,
                background: withAlpha(theme.panel, 0.98),
                fontFamily: theme.serif,
                fontSize: 34,
                fontWeight: 700,
                color: theme.text,
                whiteSpace: 'nowrap',
                boxShadow: `0 0 ${18 * f}px ${withAlpha(theme.text, 0.4 * f)}`,
              }}
            >
              {s.label}
            </div>
          </div>
        );
      })}
      {/* 收黑暗罩（悬念交给 P3——三碎片微光保持可见，morph 不断） */}
      <AbsoluteFill style={{background: theme.bg, opacity: darken, pointerEvents: 'none'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7 * (1 - darken)}}>
        {'+ 类型分支就够 · 「对号」里藏着三道检查'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2FourStepWalk: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-02');
  const bB = w('p2-03', 'p2-05');
  // 镜界承 storyboard G1 修订：2-C 止于命名签（p2-06..p2-06b），
  // 分支按钮与「就够」静止一拍移入 2-D（p2-07..p2-08）
  const bC = w('p2-06', 'p2-06b');
  const bD = w('p2-07', 'p2-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <TwoA
          atStep1={wa('p2-01', 0.08) - bA.from}
          atBadge={wa('p2-01', 0.28) - bA.from}
          atType={wa('p2-01', 0.45) - bA.from}
          atTo={wa('p2-01', 0.58) - bA.from}
          atRow={wa('p2-01', 0.74) - bA.from}
          atStep2={wa('p2-02', 0.08) - bA.from}
          atSlide={wa('p2-02', 0.16) - bA.from}
          atWrap={wa('p2-02', 0.72) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB
          atStep3={wa('p2-03', 0.08) - bB.from}
          atFly={wa('p2-03', 0.22) - bB.from}
          atStep4={wa('p2-04', 0.08) - bB.from}
          atMatch={wa('p2-04', 0.3) - bB.from}
          atApprove={wa('p2-04', 0.58) - bB.from}
          atExit={wa('p2-05', 0.31) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC atNewRow={wa('p2-06', 0.28) - bC.from} atMicro={wa('p2-06', 0.52) - bC.from} atName={wa('p2-06b', 0.55) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="2-D">
        <TwoD
          atBranch={wa('p2-07', 0.4) - bD.from}
          atStill={wa('p2-07', 0.83) - bD.from}
          atMergeWord={wa('p2-08', 0.22) - bD.from}
          atSplit={wa('p2-08', 0.7) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2FourStepWalk;
