/** P1 三类错误三条路（p1-01..p1-14，5 镜）——分镜 1-A / 1-B / 1-C / 1-D / 1-E。
 *
 *  叙事链：1-A 骨架全景（承 0-C pushIn 终态）：环体「调用模型」段被恢复蓝保护壳
 *  包住（壳建锚）＋分类卡三行空槽驻位（0-C 末生长入场的同位承接）＋三条暗态
 *  通道下行展开 → p1-02 错误信号沿壳内网格滑至分类卡、扫描线扫过一拍（判定
 *  演示）、回环细箭头自壳出口绕回环起点即收〔M-006〕 → 1-B 首行点火「截断 →
 *  升额度」：半截输出块断口高亮 → 额度卡翻牌 8000→64000 + 增长条自基线拉升
 *  （重音镜）+ 原样重发箭头 → 半截块留壳外（干净请求对照）→ 存下半截 + 断点
 *  续写提示签注入 + 道歉✗复述✗灰影小签 → 1-C 次行点火「超限 → 压缩」：请求块
 *  挤压溢出窗口框 → 九条消息块头部三条淡出收叠 + 尾部五条保留高亮 + 第二次
 *  尝试箭头 → 「压 1」徽章雏形 + 退出红旗压住重发 + 再压演示（块尺寸恒定）
 *  → 1-D 三行点火「瞬态 → 等待」：退避紫阶梯逐级铺开（级高翻倍）、级数字
 *  跟落、32s 封顶虚线亮起曲线触线走平（重音镜）→ 1-E 拉回关系层：曲线全貌
 *  细齿随机长出 + 请求点错落散布 + Retry-After 旗标插队 + 过载计数 3/3 点满 +
 *  备用模型卡解除半透明滑入待命位（伏笔留 P2 回收）＋分类表三行全亮缩驻右上
 *  ＋问号签悬置。
 *
 *  空间契约：壳只包「调用模型」段（不包整环）、分类卡槽位空态起步逐行点火、
 *    半截块全程留在壳外、增长条基线 8000 可读且不越 64000、尾部五条高亮与
 *    头部淡出可辨、阶梯级高逐级翻倍、细齿随机不齐整、备用卡带「需已配置」
 *    备注签、缩微表位（1600,70）与 2-A/2-B 逐像素一致。
 *
 *  红线落实：词落位 = wa(id,f)（manifest 已就位；⑧ 轮已按句内字位复核一轮
 *    微调，词级 silencedetect 实测复核留 ⑨ 轮 QA，超前 >0.3s 即调）；y≥56 / bottom≥176；try / except ·
 *    stop_reason="max_tokens" · ESCALATED_MAX_TOKENS=64000 ·
 *    CONTINUATION_PROMPT · prompt_too_long · reactive compact · keep_tail=5 ·
 *    429 / 529 · min(500×2^attempt, 32000)ms · Retry-After · model-backup 只进
 *    角标；提示签/参数行文字不成句复述口播。
 *
 *  morph 登记（QA 教训 28 口径）：0-C→1-A 主路径——环体同位（RING_W）+ 分类卡
 *  同位（CARD_A）承接，1-A 首帧壳自段周围生长合拢（growP 0→1），路径端点
 *  空签转暗态通道（同色同位零重绘）；1-D→1-E 为镜界硬切＋BackoffCurve 同组件
 *  w/h 缩放位移的同形承接（阶梯/封顶/细齿形状逐帧不变，非连续 morph）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  BackoffCurve,
  BackupCard,
  BudgetRuler,
  LoopRing,
  MessageStack,
  RingShell,
  RoutingTable,
  TABLE_MINI,
  TokenBudgetCard,
  ringPt,
} from '../components/motifs';
import {DUR, clamp01, progress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 环体全局位（承 0-C pushIn 终态——1.06 静态缩放锚在段位，morph 连续） */
const RING_1 = {x: 730, y: 190, size: 460} as const;
const RING_1C = {cx: RING_1.x + RING_1.size / 2, cy: RING_1.y + RING_1.size / 2, r: RING_1.size / 2 - 46} as const;
/** 分类卡位（0-C morph 终态同位承接） */
const CARD_A = {x: 1210, y: 180, w: 560, h: 300} as const;
const CHAN_XS = [1310, 1490, 1670] as const;

// ── 1-A 骨架全景：保护壳建锚 + 错误信号滑卡判定 + 回环箭头 ─────────────────

const OneA: React.FC<{
  atShell: number;
  atSignal: number;
  atSlide: number;
  atScan: number;
  atLoop: number;
}> = ({atShell, atSignal, atSlide, atScan, atLoop}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const shell = clamp01(progress(frame, atShell, DUR.f6));
  // 错误信号（红色小帧）被壳内网格接住 → 沿网格滑至分类卡
  const signalIn = clamp01(progress(frame, atSignal, DUR.f4));
  const slide = clamp01(progress(frame, atSlide, 34));
  const sigX = RING_1C.cx - 34 + (CARD_A.x + 60 - (RING_1C.cx - 34)) * slide;
  const sigY = RING_1C.cy - RING_1C.r + 78 + (CARD_A.y + 96 - (RING_1C.cy - RING_1C.r + 78)) * slide;
  // 扫描线扫过一拍（RoutingTable scanP）
  const scan = clamp01(progress(frame, atScan, 22));
  // 回环细箭头（自壳出口绕环一周指回段入口——服务完本拍即收）
  const loopIn = clamp01(progress(frame, atLoop, DUR.f5));
  const loopOut = clamp01(progress(frame, atLoop + 34, DUR.f4));
  const loopP = loopIn * (1 - loopOut);
  const arcEnd = -55 + 285 * loopIn;
  const dotPos = ((frame + 6) / (fps * 4.5)) % 1;
  return (
    <AbsoluteFill>
      {/* 环体（承 0-C pushIn 终态的静态 1.06 缩放——锚在段位） */}
      <div style={{position: 'absolute', left: RING_1.x, top: RING_1.y, transform: 'scale(1.06)', transformOrigin: '230px 46px'}}>
        <LoopRing size={RING_1.size} nodes={[]} showExit={false} dotProgress={dotPos} />
        <svg width={RING_1.size} height={RING_1.size} viewBox={`0 0 ${RING_1.size} ${RING_1.size}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          {/* 段高亮条（本集高亮段正式建锚） */}
          <path
            d={`M ${ringPt(RING_1.size / 2, RING_1.size / 2, RING_1C.r, -120).x} ${ringPt(RING_1.size / 2, RING_1.size / 2, RING_1C.r, -120).y} A ${RING_1C.r} ${RING_1C.r} 0 0 1 ${ringPt(RING_1.size / 2, RING_1.size / 2, RING_1C.r, -60).x} ${ringPt(RING_1.size / 2, RING_1.size / 2, RING_1C.r, -60).y}`}
            fill="none"
            stroke={theme.core}
            strokeWidth={11}
            strokeLinecap="round"
            opacity={0.55 + 0.4 * shell}
          />
          {/* 保护壳（恢复蓝气泡壳——只包段不包整环） */}
          <RingShell cx={RING_1.size / 2} cy={RING_1.size / 2} r={RING_1C.r} growP={shell} glowP={0.5 + 0.4 * shell} />
          {/* 壳内网格（接住错误信号的网格——三横两纵细线） */}
          <g opacity={0.5 * shell}>
            {[0, 1].map((k) => (
              <line
                key={`cg${k}`}
                x1={RING_1C.cx - 74}
                y1={RING_1C.cy - RING_1C.r + 48 + k * 44}
                x2={RING_1C.cx + 74}
                y2={RING_1C.cy - RING_1C.r + 48 + k * 44}
                stroke={withAlpha(theme.mech, 0.5)}
                strokeWidth={1.6}
              />
            ))}
            {[-40, 0, 40].map((dx) => (
              <line key={`cv${dx}`} x1={RING_1C.cx + dx} y1={RING_1C.cy - RING_1C.r + 34} x2={RING_1C.cx + dx} y2={RING_1C.cy - RING_1C.r + 132} stroke={withAlpha(theme.mech, 0.5)} strokeWidth={1.6} />
            ))}
          </g>
          {/* 回环细箭头（自壳出口逆着循环绕一周指回段入口——单向回路） */}
          {loopP > 0.02 ? (
            <g opacity={loopP}>
              <path
                d={describeRingArc(RING_1.size / 2, RING_1.size / 2, RING_1C.r + 52, -55, arcEnd)}
                fill="none"
                stroke={withAlpha(theme.mech, 0.85)}
                strokeWidth={3}
                strokeDasharray="7 7"
              />
              <circle cx={ringPt(RING_1.size / 2, RING_1.size / 2, RING_1C.r + 52, arcEnd).x} cy={ringPt(RING_1.size / 2, RING_1.size / 2, RING_1C.r + 52, arcEnd).y} r={6} fill={theme.mech} />
            </g>
          ) : null}
        </svg>
      </div>
      {/* 分类卡（三行空槽暗态——0-C 末生长入场位的同位承接） */}
      <RoutingTable x={CARD_A.x} y={CARD_A.y} w={CARD_A.w} h={CARD_A.h} litP={1} rowsLit={0} scanP={scan} />
      {/* 三条暗态通道（自分类卡下行展开——端点空签暗态驻场） */}
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {CHAN_XS.map((cx, i) => (
          <g key={`ch${i}`} opacity={0.75}>
            <line x1={cx} y1={CARD_A.y + CARD_A.h} x2={cx} y2={CARD_A.y + CARD_A.h + 108} stroke={withAlpha(theme.mech, 0.5)} strokeWidth={3} strokeDasharray="8 8" />
            <rect x={cx - 32} y={CARD_A.y + CARD_A.h + 108} width={64} height={40} rx={8} fill={withAlpha(theme.panel, 0.9)} stroke={withAlpha(theme.mech, 0.45)} strokeWidth={2.5} strokeDasharray="6 5" />
          </g>
        ))}
      </svg>
      {/* 错误信号（红色小帧——壳内网格接住 → 滑至分类卡行区） */}
      {signalIn > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: sigX,
            top: sigY,
            width: 68,
            height: 42,
            borderRadius: 8,
            border: `3px solid ${theme.danger}`,
            background: withAlpha(theme.panel, 0.95),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 15,
            fontWeight: 700,
            color: theme.danger,
            whiteSpace: 'nowrap',
            opacity: signalIn * (slide >= 1 ? 0.4 : 1),
          }}
        >
          {'错'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'try / except'}
      </div>
    </AbsoluteFill>
  );
};

/** 环外弧 path（-55 顺时针绕至 angle；与 motifs.arcPath 同式，场景侧局部副本） */
const describeRingArc = (cx: number, cy: number, r: number, a0: number, a1: number): string => {
  const p = (a: number) => ringPt(cx, cy, r, a);
  const s = p(a0);
  const e = p(a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
};

// ── 1-B 首行点火「截断 → 升额度」：半截块 + 翻牌 + 增长条 + 干净请求 ─────────

/** 1-B/1-C/1-D 分类表特写位（推近占屏——首行/次行/三行依次点火） */
const TABLE_CU = {x: 110, y: 116, w: 600, h: 380} as const;
const OneB: React.FC<{
  atRow1: number;
  atHalf: number;
  atFlip: number;
  atFlash: number;
  atResend: number;
  atClean: number;
  atStash: number;
  atCont: number;
  atXx1: number;
  atXx2: number;
}> = ({atRow1, atHalf, atFlip, atFlash, atResend, atClean, atStash, atCont, atXx1, atXx2}) => {
  const frame = useCurrentFrame();
  const row1 = clamp01(progress(frame, atRow1, DUR.f5));
  const row1Lit = row1; // rowsLit 连续值：首行点亮
  // 半截输出块（写到一半戛然而止——断口高亮）
  const halfIn = clamp01(progress(frame, atHalf, DUR.f5));
  const cutFlash = Math.sin(Math.PI * clamp01(progress(frame, atHalf + 12, 16)));
  // 额度翻牌 + 增长条（数据本体禁过冲——线性/ease 值驱动）
  const flip = clamp01(progress(frame, atFlip, 30));
  const bar = clamp01(progress(frame, atFlip, 42));
  const flash = Math.sin(Math.PI * clamp01(progress(frame, atFlash, 18)));
  // 原样重发箭头（原路再发一次——脉冲一拍行进）
  const resend = Math.sin(Math.PI * clamp01(progress(frame, atResend, 26)));
  // 半截块被留在壳外（干净请求的具象）
  const clean = clamp01(progress(frame, atClean, DUR.f5));
  // 存下半截（收进暂存槽）+ 续写提示签注入请求
  const stash = clamp01(progress(frame, atStash, DUR.f5));
  const cont = clamp01(progress(frame, atCont, DUR.f5));
  // 两枚灰影小签各划红叉（道歉 ✗ / 复述 ✗）
  const xx1 = clamp01(progress(frame, atXx1, DUR.f4));
  const xx2 = clamp01(progress(frame, atXx2, DUR.f4));
  return (
    <AbsoluteFill>
      {/* 分类表特写（首行点火） */}
      <RoutingTable x={TABLE_CU.x} y={TABLE_CU.y} w={TABLE_CU.w} h={TABLE_CU.h} litP={1} rowsLit={row1Lit} />
      {/* 额度数字卡（8000 → 64000 翻牌——重音镜） */}
      <TokenBudgetCard x={850} y={128} w={330} h={164} flipP={flip} litP={1} />
      {/* 额度增长条标尺（基线 8000 恒常驻——自基线拉升至 64000） */}
      <BudgetRuler x={850} y={352} w={640} litP={clamp01(progress(frame, atFlip, 8))} barP={bar} flash={flash} />
      {/* 请求箭头（原样重发——干净请求通道；重发拍行进虚线脉冲） */}
      <svg width={660} height={70} viewBox="0 0 660 70" style={{position: 'absolute', left: 850, top: 448, overflow: 'visible'}}>
        <line x1={0} y1={34} x2={540} y2={34} stroke={withAlpha(theme.tool, 0.75)} strokeWidth={4} strokeDasharray={resend > 0.05 ? undefined : '10 9'} strokeDashoffset={resend > 0.05 ? undefined : -frame} opacity={resend > 0.05 ? 1 : 0.8} />
        <path d="M 532 22 L 556 34 L 532 46" fill="none" stroke={withAlpha(theme.tool, 0.85)} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        <text x={0} y={66} fontFamily={theme.mono} fontSize={16} fill={theme.dim}>
          {'请求'}
        </text>
      </svg>
      {/* 续写提示签（注入请求——关键词签） */}
      {cont > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 1180,
            top: 430,
            padding: '6px 18px',
            borderRadius: 9,
            border: `3px solid ${theme.mech}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 18,
            fontWeight: 700,
            color: theme.mech,
            whiteSpace: 'nowrap',
            opacity: cont,
            transform: `translateY(${(1 - cont) * 12}px)`,
          }}
        >
          {'断点续写'}
        </div>
      ) : null}
      {/* 两枚灰影小签（道歉 ✗ / 复述 ✗——不道歉不复述的否定陈述） */}
      {[
        {t: '道歉', p: xx1, x: 1370},
        {t: '复述', p: xx2, x: 1550},
      ].map((s) =>
        s.p > 0.02 ? (
          <div
            key={s.t}
            style={{
              position: 'absolute',
              left: s.x,
              top: 452,
              padding: '4px 14px',
              borderRadius: 8,
              border: `2.5px solid ${withAlpha(theme.dim, 0.55)}`,
              background: withAlpha(theme.panel, 0.7),
              fontFamily: theme.sans,
              fontSize: 16,
              color: theme.dim,
              whiteSpace: 'nowrap',
              opacity: 0.55 + 0.45 * s.p,
            }}
          >
            {/* ⑨ QA N2：✗ 单独上 danger（danger 恒配 ✗ 色契约）；删除线只挂灰标签 */}
            <span style={{textDecoration: s.p > 0.5 ? 'line-through' : 'none'}}>{s.t}</span>
            <span style={{color: theme.danger}}>{' ✗'}</span>
          </div>
        ) : null,
      )}
      {/* 半截输出块（写到一半戛然而止——断口高亮；被留在壳外/收进暂存槽） */}
      {halfIn > 0.02 ? (
        <div
          style={{
            // ⑨ QA W1：stash 终态落暂存槽中心——scale 原点在盒心，故终态未缩放盒心
            // (805,674) ⇒ left 665 / top 579（缩放后 162×110 恰卧槽内）；透明度下限
            // 0.35；缩放盒底边 729<920 不压角标行
            position: 'absolute',
            left: 1250 - stash * 585,
            top: 150 + stash * 429,
            width: 280,
            height: 190,
            opacity: halfIn * (1 - 0.65 * stash),
            transform: `scale(${1 - 0.42 * stash})`,
            transformOrigin: 'center center',
          }}
        >
          <div style={{width: '100%', height: '100%', borderRadius: 12, border: `3px solid ${withAlpha(theme.dim, 0.75)}`, background: withAlpha(theme.panel, 0.94), padding: 16, display: 'flex', flexDirection: 'column', gap: 10}}>
            {[0, 1, 2, 3].map((k) => (
              <span key={`hb${k}`} style={{height: 12, borderRadius: 4, width: `${[92, 74, 88, 46][k]}%`, background: withAlpha(k === 3 ? theme.danger : theme.dim, k === 3 ? 0.75 : 0.3)}} />
            ))}
            {/* 断口（戛然而止的截断位——红闪高亮） */}
            <div style={{position: 'absolute', left: 10, right: 10, bottom: 64, borderTop: `3px dashed ${theme.danger}`, opacity: 0.5 + 0.5 * cutFlash}} />
          </div>
          {/* 「壳外」标注（请求保持干净——半截块全程不进请求通道） */}
          {clean > 0.3 ? (
            <div style={{position: 'absolute', left: 8, bottom: -34, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap', opacity: clamp01(clean) * (1 - stash)}}>{'壳外 · 不带上'}</div>
          ) : null}
        </div>
      ) : null}
      {/* 暂存槽（存下半截——半截块收进处） */}
      {stash > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 700,
            top: 626,
            width: 210,
            height: 96,
            borderRadius: 10,
            border: `2.5px dashed ${withAlpha(theme.dim, 0.8)}`,
            background: withAlpha(theme.panel, 0.6),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.dim,
            whiteSpace: 'nowrap',
            opacity: stash,
          }}
        >
          {'暂存槽'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'stop_reason="max_tokens" · ESCALATED_MAX_TOKENS=64000 · CONTINUATION_PROMPT'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 次行点火「超限 → 压缩」：溢出窗口 + 九条收叠 + 压 1 徽章 + 退出旗 ────

const STACK_C = {x: 860, y: 130, w: 320, h: 560} as const;
const OneC: React.FC<{
  atRow2: number;
  atOverflow: number;
  atCollapse: number;
  atRetry2: number;
  atBadge: number;
  atFlag: number;
  atRepress: number;
}> = ({atRow2, atOverflow, atCollapse, atRetry2, atBadge, atFlag, atRepress}) => {
  const frame = useCurrentFrame();
  const row2 = clamp01(progress(frame, atRow2, DUR.f5));
  // 请求块挤压溢出窗口框（块比框大一圈装不进）
  const press = clamp01(progress(frame, atOverflow, 30));
  // 头部三条淡出收叠 + 尾部五条保留高亮
  const collapse = clamp01(progress(frame, atCollapse, 32));
  const tail = clamp01(progress(frame, atCollapse + 10, DUR.f5));
  // 压完再试（第二次尝试箭头）
  const retry2 = Math.sin(Math.PI * clamp01(progress(frame, atRetry2, 26)));
  // 「压 1」上限徽章雏形（上界概念首现）
  const badge = clamp01(progress(frame, atBadge, DUR.f4));
  // 退出标志（警示红小旗）落下压住重发箭头
  const flag = clamp01(progress(frame, atFlag, DUR.f5));
  // 再压演示：收叠位已空、头部无块可收、请求块尺寸恒定一拍（压不动）
  const repress = clamp01(progress(frame, atRepress, 26));
  const repressShake = Math.sin(frame / 1.7) * 3 * repress;
  return (
    <AbsoluteFill>
      {/* 分类表特写（次行点火） */}
      <RoutingTable x={TABLE_CU.x} y={TABLE_CU.y} w={TABLE_CU.w} h={TABLE_CU.h} litP={1} rowsLit={1 + row2} />
      {/* 九条消息块竖列（头部淡出收叠 + 尾部五条保留高亮框） */}
      <MessageStack x={STACK_C.x} y={STACK_C.y} w={STACK_C.w} h={STACK_C.h} collapseP={collapse} tailLit={tail} litP={1} />
      <div style={{position: 'absolute', left: STACK_C.x, top: STACK_C.y + STACK_C.h + 14, fontFamily: theme.mono, fontSize: 18, color: theme.text, whiteSpace: 'nowrap'}}>
        {'消息 '}
        <span style={{color: collapse > 0.9 ? theme.mech : theme.dim}}>{collapse > 0.9 ? '6' : '9'}</span>
        {' 条'}
      </div>
      {/* 第二次尝试箭头（压完再试——自块列右缘指向窗口框） */}
      <svg width={140} height={60} viewBox="0 0 140 60" style={{position: 'absolute', left: 1210, top: 520, overflow: 'visible', opacity: 0.25 + 0.75 * retry2}}>
        <line x1={0} y1={30} x2={112} y2={30} stroke={withAlpha(theme.tool, 0.8)} strokeWidth={4} />
        <path d="M 106 18 L 128 30 L 106 42" fill="none" stroke={withAlpha(theme.tool, 0.9)} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* 溢出窗口框（固定尺寸）+ 比框大一圈的请求块（挤压装不进） */}
      <div style={{position: 'absolute', left: 1340, top: 260, width: 250, height: 240, borderRadius: 12, border: `3.5px dashed ${withAlpha(theme.dim, 0.85)}`}} />
      <div
        style={{
          position: 'absolute',
          left: 1326 - 26 * press,
          top: 244 - 18 * press,
          width: 300,
          height: 286,
          borderRadius: 12,
          border: `3.5px solid ${withAlpha(theme.danger, 0.8)}`,
          background: withAlpha(theme.panel, 0.92),
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 18,
          transform: `translateX(${repressShake}px)`,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.danger, whiteSpace: 'nowrap'}}>{'请求 · 超大'}</span>
        {[0, 1, 2, 3, 4].map((k) => (
          <span key={`rb${k}`} style={{height: 16, borderRadius: 4, width: `${88 - k * 7}%`, background: withAlpha(theme.dim, 0.3)}} />
        ))}
        {/* 再压演示注记（收叠位已空——块尺寸恒定） */}
        {repress > 0.3 ? (
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.danger, whiteSpace: 'nowrap', opacity: repress}}>{'再压 · 尺寸不变'}</span>
        ) : null}
      </div>
      {/* 「压 1」上限徽章雏形（上界概念首现——小签贴块列角） */}
      {badge > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: STACK_C.x + STACK_C.w - 30,
            top: STACK_C.y - 26,
            padding: '5px 16px',
            borderRadius: 10,
            border: `2.5px solid ${theme.mech}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 18,
            fontWeight: 700,
            color: theme.mech,
            whiteSpace: 'nowrap',
            opacity: badge,
            transform: `translateY(${(1 - badge) * -14}px)`,
          }}
        >
          {'压 1'}
        </div>
      ) : null}
      {/* 退出标志（警示红小旗——落下压住重发箭头；唯一警示红元素之一） */}
      {flag > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 1252,
            top: 470 + (1 - flag) * -60,
            padding: '6px 18px',
            borderRadius: 9,
            border: `3px solid ${theme.danger}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 19,
            fontWeight: 700,
            color: theme.danger,
            whiteSpace: 'nowrap',
            opacity: flag,
            transform: `rotate(${(1 - flag) * -14}deg)`,
            boxShadow: `0 0 ${14 * flag}px ${withAlpha(theme.danger, 0.4)}`,
          }}
        >
          {'退出'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'prompt_too_long · reactive compact · keep_tail=5'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-D 三行点火「瞬态 → 等待」：退避阶梯特写 + 封顶虚线走平 ────────────────

const OneD: React.FC<{atRow3: number; atTag1: number; atTag2: number; atStairs: number; atCap: number}> = ({atRow3, atTag1, atTag2, atStairs, atCap}) => {
  const frame = useCurrentFrame();
  const row3 = clamp01(progress(frame, atRow3, DUR.f5));
  // 两枚小错误签（限流 / 过载）落入第三行入口
  const t1 = clamp01(progress(frame, atTag1, DUR.f4));
  const t2 = clamp01(progress(frame, atTag2, DUR.f4));
  // 阶梯逐级铺开（级高逐级翻倍——半秒起步逐级 1s/2s/4s 跟落）
  const stairs = 4 * clamp01(progress(frame, atStairs, 52));
  // 32s 封顶虚线亮起 + 曲线触线走平（重音镜）
  const cap = clamp01(progress(frame, atCap, DUR.f5 + 8));
  return (
    <AbsoluteFill>
      {/* 分类表（三行点火——紧凑位让位给曲线特写） */}
      <RoutingTable x={110} y={100} w={560} h={240} litP={1} rowsLit={2 + row3} />
      {/* 两枚小错误签（落入第三行入口——行右缘） */}
      {[
        {t: '限流', p: t1, x: 560},
        {t: '过载', p: t2, x: 560},
      ].map((s, i) =>
        s.p > 0.02 ? (
          <div
            key={s.t}
            style={{
              position: 'absolute',
              left: s.x,
              top: 300 - i * 0 + (1 - s.p) * -46 + i * 52,
              padding: '3px 12px',
              borderRadius: 7,
              border: `2.5px solid ${withAlpha(theme.danger, 0.8)}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 15,
              fontWeight: 700,
              color: theme.danger,
              whiteSpace: 'nowrap',
              opacity: s.p,
            }}
          >
            {s.t}
          </div>
        ) : null,
      )}
      {/* 退避紫阶梯特写（半秒起步逐级翻倍 + 32s 封顶虚线 + 触线走平） */}
      <BackoffCurve x={740} y={140} w={1020} h={640} stairsP={stairs} capP={cap} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'429 / 529 · min(500×2^attempt, 32000)ms'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-E 关系层：细齿 + 旗标插队 + 备用卡待命 + 表缩驻 + 问号签 ──────────────

const OneE: React.FC<{
  atJitter: number;
  atDots: number;
  atFlag: number;
  atCnt1: number;
  atCnt2: number;
  atCnt3: number;
  atBackup: number;
  atQ: number;
}> = ({atJitter, atDots, atFlag, atCnt1, atCnt2, atCnt3, atBackup, atQ}) => {
  const frame = useCurrentFrame();
  const jitter = clamp01(progress(frame, atJitter, 34));
  const dots = clamp01(progress(frame, atDots, 30));
  const flag = clamp01(progress(frame, atFlag, DUR.f5 + 6));
  // 三枚过载小帧计数 3/3 点满
  const c1 = clamp01(progress(frame, atCnt1, 10));
  const c2 = clamp01(progress(frame, atCnt2, 10));
  const c3 = clamp01(progress(frame, atCnt3, 10));
  // 备用卡解除半透明滑入待命位（伏笔留 P2 回收）
  const backup = clamp01(progress(frame, atBackup, 30));
  // 表整体脉冲一次 + 问号签浮起（三路就绪的悬念定格）
  const pulse = Math.sin(Math.PI * clamp01(progress(frame, atQ, DUR.f5)));
  const q = clamp01(progress(frame, atQ + 4, DUR.f4));
  return (
    <AbsoluteFill>
      {/* 等待曲线全貌（承 1-D 末态 + 细齿 + 散点 + 旗标） */}
      <BackoffCurve x={150} y={170} w={840} h={560} stairsP={4} capP={1} jitterP={jitter} dotsP={dots} flagP={flag} />
      {/* 过载计数 3/3（备用卡上方——点满触发切换伏笔） */}
      <div style={{position: 'absolute', left: 1160, top: 236, display: 'flex', gap: 10, alignItems: 'center'}}>
        {[c1, c2, c3].map((c, i) => (
          <span
            key={`oc${i}`}
            style={{
              width: 30,
              height: 38,
              borderRadius: 6,
              border: `2.5px solid ${c > 0.4 ? theme.danger : theme.panelBorder}`,
              background: c > 0.4 ? withAlpha(theme.danger, 0.32) : 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 15,
              fontWeight: 700,
              color: c > 0.4 ? theme.danger : theme.dim,
            }}
          >
            {c > 0.4 ? '过' : ''}
          </span>
        ))}
        {/* ⑨ QA W2：计数标签动态终值（与 2-B 同款）——计数未开始显 0/3 不剧透 */}
        <span style={{fontFamily: theme.mono, fontSize: 17, color: c3 > 0.9 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{`${Math.min(3, Math.floor(c1 + c2 + c3))}/3`}</span>
      </div>
      {/* 备用模型卡（半透明待命位 → 解除半透明滑入——MAX_CONSECUTIVE_529=3 伏笔） */}
      <div style={{position: 'absolute', left: 1160 + (1 - backup) * 90, top: 300, opacity: 0.45 + 0.55 * backup}}>
        <BackupCard x={0} y={0} litP={1} solid={backup} />
      </div>
      {/* 分类表三行全亮缩驻右上（跨幕锚件——脉冲一次 + 问号签悬置） */}
      <div style={{position: 'absolute', left: TABLE_MINI.x, top: TABLE_MINI.y, transform: `scale(${1 + 0.035 * pulse})`, transformOrigin: '20% 40%'}}>
        <RoutingTable x={0} y={0} w={TABLE_MINI.w} h={TABLE_MINI.h} litP={1} rowsLit={3} scale={TABLE_MINI.scale} />
      </div>
      {q > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: TABLE_MINI.x + 96,
            top: TABLE_MINI.y - 44,
            fontFamily: theme.serif,
            fontSize: 64,
            fontWeight: 700,
            color: theme.text,
            opacity: q,
            transform: `translateY(${(1 - q) * 14}px)`,
            textShadow: `0 0 ${18 * q}px ${withAlpha(theme.mech, 0.5)}`,
          }}
        >
          {'？'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'Retry-After · model-backup'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P1ThreePaths: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p1-01', 'p1-02');
  const bB = w('p1-03', 'p1-06');
  const bC = w('p1-07', 'p1-09');
  const bD = w('p1-10', 'p1-11');
  const bE = w('p1-12', 'p1-14');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <OneA
          atShell={wa('p1-01', 0.44) - bA.from}
          atSignal={wa('p1-01', 0.7) - bA.from}
          atSlide={wa('p1-02', 0.14) - bA.from}
          atScan={wa('p1-02', 0.24) - bA.from}
          atLoop={wa('p1-02', 0.68) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <OneB
          atRow1={wa('p1-03', 0.14) - bB.from}
          atHalf={wa('p1-03', 0.68) - bB.from}
          atFlip={wa('p1-04', 0.34) - bB.from}
          atFlash={wa('p1-04', 0.66) - bB.from}
          atResend={wa('p1-04', 0.82) - bB.from}
          atClean={wa('p1-05', 0.3) - bB.from}
          atStash={wa('p1-06', 0.16) - bB.from}
          atCont={wa('p1-06', 0.4) - bB.from}
          atXx1={wa('p1-06', 0.8) - bB.from}
          atXx2={wa('p1-06', 0.9) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <OneC
          atRow2={wa('p1-07', 0.16) - bC.from}
          atOverflow={wa('p1-07', 0.76) - bC.from}
          atCollapse={wa('p1-08', 0.26) - bC.from}
          atRetry2={wa('p1-08', 0.74) - bC.from}
          atBadge={wa('p1-09', 0.06) - bC.from}
          atFlag={wa('p1-09', 0.36) - bC.from}
          atRepress={wa('p1-09', 0.7) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="1-D">
        <OneD
          atRow3={wa('p1-10', 0.14) - bD.from}
          atTag1={wa('p1-10', 0.3) - bD.from}
          atTag2={wa('p1-10', 0.44) - bD.from}
          atStairs={wa('p1-11', 0.1) - bD.from}
          atCap={wa('p1-11', 0.7) - bD.from}
        />
      </Sequence>
      <Sequence {...bE} name="1-E">
        <OneE
          atJitter={wa('p1-12', 0.12) - bE.from}
          atDots={wa('p1-12', 0.5) - bE.from}
          atFlag={wa('p1-13', 0.24) - bE.from}
          atCnt1={wa('p1-13', 0.56) - bE.from}
          atCnt2={wa('p1-13', 0.63) - bE.from}
          atCnt3={wa('p1-13', 0.7) - bE.from}
          atBackup={wa('p1-13', 0.86) - bE.from}
          atQ={wa('p1-14', 0.58) - bE.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1ThreePaths;
