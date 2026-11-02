/** P4 真实的队伍（p4-01..p4-07，4 镜）——分镜 4-A / 4-B / 4-C / 4-D。
 *
 *  叙事链：4-A 拉远降压（@pushIn 负增量——自 P3 消融峰值拉远重锚生产全景）：
 *  p4-01「真实的」词落位拓扑全景淡入（主代理橙环居中、多枚品红环体环绕同款
 *  同转速）→ p4-02「一人一只文件信箱」词落位环绕信箱逐只点亮、锁扣随后逐一
 *  扣上（与 1-B 四只同款；锁扣=真实版唯一新增部件）〔M-005〕→ 4-B 文件锁特写：
 *  p4-03「写信还加文件锁」词落位锁扣落锁、「撞上了就重试」词落位两枚写信光标
 *  在锁口相撞红闪 + 后到者绕行重试回环、「最多十次」词落位十格重试带立起
 *  （与 2-B 轮次带同构不同角标——锁重试 ≠ 轮次上限）→ 4-C 权限冒泡四步链：
 *  开帧「教学版省掉」虚线框一拍随链出演退役〔M-006〕→ p4-04「权限冒泡」词落位
 *  ①请求泡自队友环体升起 → p4-05 四步依口播次序走完（「比如删个文件」动作签
 *  贴泡面 →「冒进主代理信箱」泡升入 →「批完」主环侧审批卡用户按下批准 →
 *  「发回去」回执泡沉回队友环体、放行绿一闪）→ 4-D 官方定夺收尾：p4-06「统一
 *  出现在」词落位审批卡定格 + 归属小签贴上 → p4-07「实验特性」「默认不开」词
 *  落位开关卡滑入、开关置「关」位锁定（谨慎默认平实呈现，不渲染风险）。
 *
 *  空间契约：橙环居中唯一、品红环体同款多枚无大小分层（主从只以颜色与位置
 *    区分）、信箱与全片同形（锁扣唯一新增）；撞锁红闪 ≤1s、重试回环单向、
 *    计数带十格暗格起；四步次序 = 口播次序、泡体品红恒定、审批卡只在主环侧、
 *    泡禁跳过信箱直达主环；开关态=关、归属小签仅一枚。
 *  红线落实：拓扑节点文字禁成句、计数带禁亮满（未撞满十次）、禁与轮次上限混
 *    用同角标、四步禁齐演（跳次序）、开关禁置开、风险化红色渲染禁（官方语义
 *    为平实陈述）、卡面禁复述口播；词落位 = wa(id,f)；y≥56 / bottom≥176。
 *
 *  承接登记：3-E→4-A SceneFade+拉远重锚（教学消融→生产拓扑=语义断裂；身份
 *    线索=环体同款+信箱同款跨镜恒常：生产拓扑=三环编队的同构扩展）；4-D→5-A
 *    SceneFade+环群同形回归。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, MailboxFile, PermBubble, RetryBar, TeammateRing, useRingDot} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 4-A 生产拓扑全景：橙环居中 + 品红环体环绕 + 每环一只带锁信箱 ────────────

/** 拓扑几何：主环居中、五枚队友环绕（圆周分布——主从只以颜色与位置区分） */
// y 上移 560→485：底部卫星环底缘 990→915，退出字幕安全带（顶 920）
const TOPO_CENTER = {x: 960, y: 485} as const;
const TOPO_R = 402;
const SATELLITES = [-90, -18, 54, 126, 198].map((deg) => {
  const rad = (deg * Math.PI) / 180;
  return {x: TOPO_CENTER.x + TOPO_R * Math.cos(rad) - 105, y: TOPO_CENTER.y + TOPO_R * Math.sin(rad) - 105};
});

const FourA: React.FC<{atWide: number; atMail: number[]; atLock: number[]}> = ({atWide, atMail, atLock}) => {
  const frame = useCurrentFrame();
  // 拉远降压（pushIn 负增量：0.94 → 1.0——自消融峰值重锚生产全景）
  const wide = usePushIn(atWide, {scale: -0.06, dur: DUR.f6});
  // 拓扑淡入（整体一拍显形）
  const fade = clamp01(progress(frame, atWide + 4, 24));
  const dot = useRingDot(2.5);
  return (
    <AbsoluteFill style={{transform: wide, transformOrigin: '50% 52%'}}>
      <div style={{position: 'absolute', inset: 0, opacity: fade}}>
        {/* 主代理橙环（居中唯一） */}
        <div style={{position: 'absolute', left: TOPO_CENTER.x - 170, top: TOPO_CENTER.y - 230}}>
          <LoopRing size={340} nodes={[]} showExit={false} dotProgress={dot} />
          <div style={{position: 'absolute', left: 340 / 2 - 44, top: 352, fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap'}}>主代理</div>
        </div>
        {/* 五枚品红环体环绕（同款同转速——每环一只带锁信箱） */}
        {SATELLITES.map((s, i) => {
          const mail = clamp01(progress(frame, atMail[i], DUR.f4));
          const lock = clamp01(progress(frame, atLock[i], DUR.f4));
          // 信箱驻环外侧（圆周外向——一人一只文件信箱）
          // 信箱 y 钳制：底边不入字幕安全带（860 上沿，信箱高 124 → y ≤ 730）
          const outwardRaw = i % 2 === 0 ? {x: s.x + 216, y: s.y + 96} : {x: s.x - 158, y: s.y + 96};
          const outward = {x: outwardRaw.x, y: Math.min(outwardRaw.y, 730)};
          const inView = outward.x > 20 && outward.x + 140 < 1900;
          return (
            <React.Fragment key={`sat${i}`}>
              <div style={{position: 'absolute', left: s.x, top: s.y}}>
                <TeammateRing size={210} dotProgress={dot} />
              </div>
              {inView ? (
                <div style={{position: 'absolute', left: outward.x, top: outward.y, opacity: mail}}>
                  <MailboxFile x={0} y={0} w={140} h={124} name={`t${i + 1}.jsonl`} litP={1} lockP={lock} />
                </div>
              ) : (
                <div style={{position: 'absolute', left: s.x + 36, top: Math.min(s.y + 216, 730), opacity: mail}}>
                  <MailboxFile x={0} y={0} w={140} h={124} name={`t${i + 1}.jsonl`} litP={1} lockP={lock} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 212, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'~/.claude/teams/{team}/inboxes/ · teammateMailbox.ts'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 文件锁特写：落锁 + 光标相撞红闪 + 绕行重试回环 + 十格重试带 ──────────

const MAIL_4B = {x: 730, y: 250, w: 460, h: 350} as const;
const LOCK_PT = {x: 960, y: 246} as const;

const FourB: React.FC<{atLock: number; atClash: number; atLoop: number; atBar: number}> = ({atLock, atClash, atLoop, atBar}) => {
  const frame = useCurrentFrame();
  // 锁扣落锁（信箱上方——写信还加文件锁）
  const lock = clamp01(progress(frame, atLock, 16));
  // 两枚写信光标飞向锁口、在锁口相撞（红闪爆点 ≤1s：闪现即收）
  const clash = Math.sin(Math.PI * clamp01(progress(frame, atClash, 22)));
  const cursorT = clamp01(progress(frame, atClash - 10, 16));
  // 后到者绕行重试回环（虚线弧 + 箭头——单向回环）
  const loop = clamp01(progress(frame, atLoop, 18));
  // 十格重试计数带立起（暗格——未撞满十次）
  const bar = clamp01(progress(frame, atBar, 16));
  return (
    <AbsoluteFill>
      {/* 信箱大特写（带锁扣——落锁） */}
      <div style={{position: 'absolute', left: MAIL_4B.x, top: MAIL_4B.y}}>
        <MailboxFile x={0} y={0} w={MAIL_4B.w} h={MAIL_4B.h} name="lead.jsonl" litP={1} rows={1} lockP={lock} />
      </div>
      {/* 两枚写信光标（I 形——自左右两侧飞向锁口） */}
      {([1, -1] as const).map((d, i) => {
        const x = LOCK_PT.x + d * (300 - 300 * cursorT);
        return (
          <div
            key={`cur${i}`}
            style={{
              position: 'absolute',
              left: x - 6,
              top: LOCK_PT.y - 26 + Math.abs(d) * -40 * (1 - cursorT),
              opacity: cursorT > 0.02 && cursorT < 0.99 ? 1 : 0,
            }}
          >
            <svg width={14} height={44} viewBox="0 0 14 44">
              <line x1={7} y1={4} x2={7} y2={40} stroke={theme.text} strokeWidth={4} strokeLinecap="round" />
              <line x1={2} y1={4} x2={12} y2={4} stroke={theme.text} strokeWidth={3} strokeLinecap="round" />
              <line x1={2} y1={40} x2={12} y2={40} stroke={theme.text} strokeWidth={3} strokeLinecap="round" />
            </svg>
          </div>
        );
      })}
      {/* 相撞红闪（锁口爆点——≤1s 闪现即收，无残红） */}
      {clash > 0.05 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <circle cx={LOCK_PT.x} cy={LOCK_PT.y} r={14 + 44 * clash} fill="none" stroke={withAlpha(theme.danger, 0.9 * (1 - clash))} strokeWidth={5} />
          <circle cx={LOCK_PT.x} cy={LOCK_PT.y} r={10} fill={withAlpha(theme.danger, 0.85 * clash)} />
        </svg>
      ) : null}
      {/* 绕行重试回环（后到者绕弧回到队尾——虚线弧 + 箭头，单向） */}
      {loop > 0.03 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <path
            d={`M ${LOCK_PT.x + 40} ${LOCK_PT.y - 20} Q ${LOCK_PT.x + 300} ${LOCK_PT.y - 170} ${LOCK_PT.x + 130} ${LOCK_PT.y - 240}`}
            fill="none"
            stroke={withAlpha(theme.dim, 0.85)}
            strokeWidth={4}
            strokeDasharray="12 9"
            pathLength={1}
            strokeDashoffset={1 - loop}
          />
          {loop > 0.9 ? (
            <path d={`M ${LOCK_PT.x + 152} ${LOCK_PT.y - 234} L ${LOCK_PT.x + 130} ${LOCK_PT.y - 240} L ${LOCK_PT.x + 140} ${LOCK_PT.y - 218}`} fill="none" stroke={withAlpha(theme.dim, 0.85)} strokeWidth={4} strokeLinecap="round" />
          ) : null}
        </svg>
      ) : null}
      {/* 十格锁重试带（暗格起——最多十次的基线标尺，与轮次带同构不同角标） */}
      <RetryBar x={560} y={800} w={800} litP={bar} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'proper-lockfile · 撞上了就重试'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 权限冒泡四步链：虚线框一拍 → 泡升 → 入箱 → 批准 → 回执沉回 ──────────

const MATE_4C = {x: 250, y: 320, size: 330} as const;
const MAIL_4C = {x: 830, y: 170, w: 340, h: 280} as const;
const RING_4C = {x: 1290, y: 240, size: 380} as const;
const APPROVE_4C = {x: 1150, y: 640, w: 510, h: 190} as const;

const FourC: React.FC<{atGhost: number; atRise: number; atSign: number; atEnter: number; atApprove: number; atBack: number}> = ({atGhost, atRise, atSign, atEnter, atApprove, atBack}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 「教学版省掉」虚线框（开帧一拍——随链出演退役 M-006）
  const ghost = clamp01(progress(frame, atGhost, 10)) * (1 - clamp01(progress(frame, atGhost + 24, 12)));
  // ① 请求泡自队友环体升起（p4-04「权限冒泡」）
  const rise = clamp01(progress(frame, atRise, 20));
  // 动作签贴泡面（「比如删个文件」）
  const sign = clamp01(progress(frame, atSign, DUR.f4));
  // ② 泡升入主代理信箱（p4-05「冒进主代理信箱」）
  const enter = clamp01(progress(frame, atEnter, 22));
  // ③ 主环侧审批卡亮 + 用户指针按下「批准」（「批完」）
  const approve = clamp01(progress(frame, atApprove, 16));
  const press = Math.sin(Math.PI * clamp01(progress(frame, atApprove + 8, 14)));
  // ④ 回执泡沉回队友环体 + 放行绿一闪（「发回去」）
  const back = clamp01(progress(frame, atBack, 22));
  const green = Math.sin(Math.PI * clamp01(progress(frame, atBack + 14, 18)));
  // 泡位置（场景侧 transform 驱动四步：环顶升起 → 横移入箱 → 沉回；基座=环顶升起点）
  const fromPt = {x: MATE_4C.x + MATE_4C.size / 2 - 60, y: MATE_4C.y - 130};
  const boxPt = {x: MAIL_4C.x + 110, y: MAIL_4C.y + 60};
  const bubbleVis = rise > 0.02 ? 1 : 0;
  return (
    <AbsoluteFill>
      {/* 「教学版省掉」虚线框（开帧一拍即退役——教学版整个省掉了权限冒泡） */}
      {ghost > 0.03 ? (
        <div
          style={{
            position: 'absolute',
            left: 200,
            top: 120,
            width: 1520,
            height: 760,
            borderRadius: 18,
            border: `3px dashed ${withAlpha(theme.dim, 0.7)}`,
            opacity: ghost,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 18,
            fontFamily: theme.mono,
            fontSize: 19,
            color: theme.dim,
            whiteSpace: 'nowrap',
          }}
        >
          教学版省掉 · 生产版在此
        </div>
      ) : null}
      {/* 队友环体（左侧——请求泡的出发点） */}
      <div style={{position: 'absolute', left: MATE_4C.x, top: MATE_4C.y}}>
        <TeammateRing size={MATE_4C.size} dotProgress={dot} />
        <div style={{position: 'absolute', left: 60, top: MATE_4C.size + 8, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.mate, whiteSpace: 'nowrap'}}>队友 · 要删文件</div>
        {/* ④ 放行绿一闪（工具放行——回执沉回后） */}
        <div
          style={{
            position: 'absolute',
            left: 96,
            top: MATE_4C.size + 52,
            padding: '5px 16px',
            borderRadius: 9,
            border: `2.5px solid ${withAlpha(theme.ok, 0.9)}`,
            background: withAlpha(theme.panel, 0.97),
            fontFamily: theme.sans,
            fontSize: 18,
            fontWeight: 700,
            color: theme.ok,
            whiteSpace: 'nowrap',
            opacity: green,
          }}
        >
          工具放行 ✓
        </div>
      </div>
      {/* 主代理信箱（中上——泡的入箱位：审批统一进信箱） */}
      <div style={{position: 'absolute', left: MAIL_4C.x, top: MAIL_4C.y}}>
        <MailboxFile x={0} y={0} w={MAIL_4C.w} h={MAIL_4C.h} name="lead.jsonl" litP={1} rows={1} />
      </div>
      {/* 主代理橙环（右侧——审批卡只在其侧） */}
      <div style={{position: 'absolute', left: RING_4C.x, top: RING_4C.y}}>
        <LoopRing size={RING_4C.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {/* 审批卡（主环侧——③ 用户指针按下「批准」） */}
      <div
        style={{
          position: 'absolute',
          left: APPROVE_4C.x,
          top: APPROVE_4C.y,
          width: APPROVE_4C.w,
          height: APPROVE_4C.h,
          borderRadius: 14,
          border: `3px solid ${approve > 0.3 ? withAlpha(theme.core, 0.85) : withAlpha(theme.panelBorder, 0.9)}`,
          background: withAlpha(theme.panel, 0.97),
          padding: '18px 26px',
          opacity: clamp01(progress(frame, atApprove - 4, DUR.f5)),
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>审批 · 删文件</div>
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 8, whiteSpace: 'nowrap'}}>{'permission_request · 来自队友'}</div>
        <div style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 16}}>
          <span
            style={{
              padding: '8px 26px',
              borderRadius: 9,
              border: `2.5px solid ${withAlpha(theme.core, 0.9)}`,
              background: press > 0.2 ? withAlpha(theme.core, 0.2) : 'transparent',
              fontFamily: theme.sans,
              fontSize: 21,
              fontWeight: 700,
              color: theme.text,
              transform: `scale(${1 - 0.06 * press})`,
              whiteSpace: 'nowrap',
            }}
          >
            批准
          </span>
          {/* 用户指针（指向按钮——按下一拍） */}
          <svg width={40} height={40} viewBox="0 0 40 40" style={{transform: `translate(${-press * 6}px, ${press * 4}px)`}}>
            <path d="M8 4 L8 30 L15 23 L20 34 L25 31 L20 21 L29 21 Z" fill={theme.text} stroke={theme.bg} strokeWidth={1.5} />
          </svg>
        </div>
      </div>
      {/* 审批请求泡（① 升起 → 贴签 → ② 横移入箱 → ④ 沉回——四步次序=口播） */}
      {bubbleVis > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: fromPt.x,
            top: fromPt.y,
            zIndex: 3,
            transform: `translateY(${(1 - rise) * 60}px) translateX(${(boxPt.x - fromPt.x) * enter}px) translateY(${back * (fromPt.y - boxPt.y)}px)`,
            opacity: back > 0.85 ? 1 - (back - 0.85) / 0.15 : 1,
          }}
        >
          <PermBubble litP={rise} signP={sign} size={120} />
        </div>
      ) : null}
      {/* 泡入箱/沉回的轨迹线（品红冒泡回路——单向可追） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <line x1={fromPt.x + 60} y1={fromPt.y + 60} x2={boxPt.x + 60} y2={boxPt.y + 60} stroke={withAlpha(theme.mate, 0.3)} strokeWidth={3} strokeDasharray="10 8" opacity={Math.max(enter, back)} />
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'permission_request / permission_response · 权限冒泡'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D 官方定夺收尾：审批卡定格 + 归属签 + 「实验特性 · 默认关」开关卡 ────────

const CARD_4D = {x: 660, y: 230, w: 600, h: 230} as const;
const SWITCH_4D = {x: 700, y: 560, w: 520, h: 150} as const;

const FourD: React.FC<{atPin: number; atCite: number; atSlide: number; atOff: number}> = ({atPin, atCite, atSlide, atOff}) => {
  const frame = useCurrentFrame();
  // 审批卡定格（承 4-C 末态——审批提示统一出现在主代理会话）
  const pin = clamp01(progress(frame, atPin, 12));
  // 「官方文档」归属小签（卡角——仅一枚）
  const cite = clamp01(progress(frame, atCite, DUR.f4));
  // 开关卡滑入（实验特性——谨慎默认平实呈现）
  const slide = clamp01(progress(frame, atSlide, 18));
  // 开关置「关」位锁定（默认不开——平实，无红色渲染）
  const off = clamp01(progress(frame, atOff, 12));
  return (
    <AbsoluteFill>
      {/* 审批卡定格（中央——统一出现在主代理会话） */}
      <div
        style={{
          position: 'absolute',
          left: CARD_4D.x,
          top: CARD_4D.y,
          width: CARD_4D.w,
          height: CARD_4D.h,
          borderRadius: 14,
          border: `3px solid ${withAlpha(theme.core, 0.85)}`,
          background: withAlpha(theme.panel, 0.97),
          padding: '20px 28px',
          opacity: pin,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>审批提示 · 统一出现在主代理会话</div>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 18, whiteSpace: 'nowrap'}}>
          <span style={{padding: '6px 20px', borderRadius: 9, border: `2.5px solid ${withAlpha(theme.ok, 0.85)}`, background: withAlpha(theme.ok, 0.14), fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.ok}}>
            已批 ✓
          </span>
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'删文件 · 来自队友'}</span>
        </div>
        {/* 归属小签（卡角——官方文档也这么写） */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 20,
            padding: '4px 12px',
            borderRadius: 7,
            border: `2px solid ${withAlpha(theme.dim, 0.7)}`,
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.dim,
            whiteSpace: 'nowrap',
            opacity: cite,
          }}
        >
          官方文档
        </div>
      </div>
      {/* 「实验特性 · 默认关」开关卡（侧滑入——开关置关位锁定） */}
      <div
        style={{
          position: 'absolute',
          left: SWITCH_4D.x,
          top: SWITCH_4D.y,
          width: SWITCH_4D.w,
          height: SWITCH_4D.h,
          borderRadius: 14,
          border: `3px solid ${withAlpha(theme.panelBorder, 0.9)}`,
          background: withAlpha(theme.panel, 0.97),
          padding: '18px 28px',
          opacity: slide,
          transform: `translateX(${(1 - slide) * 90}px)`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>团队机制 · 实验特性</div>
        <div style={{display: 'flex', alignItems: 'center', gap: 22, marginTop: 16}}>
          {/* 开关拨杆（置「关」位——默认不开：滑至左锁定） */}
          <div
            style={{
              width: 96,
              height: 46,
              borderRadius: 23,
              border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`,
              background: withAlpha(theme.panelBorder, 0.4),
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 4,
                left: 4 + (1 - off) * 44,
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: theme.dim,
                display: 'block',
              }}
            />
          </div>
          <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>{off > 0.5 ? '默认 · 关' : '开关'}</span>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'官方定夺 · 审批在主代理 · 默认不开'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P4RealTopology: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p4-01', 'p4-02');
  const bB = w('p4-03', 'p4-03');
  const bC = w('p4-04', 'p4-05');
  const bD = w('p4-06', 'p4-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <FourA
          atWide={wa('p4-01', 0.2) - bA.from}
          atMail={[0.55, 0.63, 0.71, 0.79, 0.87].map((f) => wa('p4-02', f) - bA.from)}
          atLock={[0.72, 0.78, 0.84, 0.9, 0.96].map((f) => wa('p4-02', f) - bA.from)}
        />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FourB
          atLock={wa('p4-03', 0.25) - bB.from}
          atClash={wa('p4-03', 0.45) - bB.from}
          atLoop={wa('p4-03', 0.58) - bB.from}
          atBar={wa('p4-03', 0.8) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <FourC
          atGhost={2}
          atRise={wa('p4-04', 0.8) - bC.from}
          atSign={wa('p4-05', 0.26) - bC.from}
          atEnter={wa('p4-05', 0.5) - bC.from}
          atApprove={wa('p4-05', 0.68) - bC.from}
          atBack={wa('p4-05', 0.88) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <FourD
          atPin={wa('p4-06', 0.2) - bD.from}
          atCite={wa('p4-06', 0.5) - bD.from}
          atSlide={wa('p4-07', 0.55) - bD.from}
          atOff={wa('p4-07', 0.8) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4RealTopology;
