/** P3 一句招牌（p3-01..p3-18，镜 3-A..3-D）——description 一句话的路由幕：
 *  换班技能招牌挂上店铺立面（≤1024 字符量尺 +「独扛路由」章；lc-activate 章回放
 *  挂 p3-03）→ 两头失败模式（写窄=客人走过漏触发 / 写宽=什么都探头误触发 /
 *  近失误卡「更新 Excel 预算表」飘过半秒停顿继续走）→ 官方评测四步阶梯
 *  （出题 20 · 跑分 ×3 真读入 · 防背题 60:40 · 收敛约 5 轮）→ 背题王关键词糊满
 *  招牌 + 如实边界对照卡 + 招牌复原拉远见一排门（钩到 P4 门口的规矩）。
 *  幕主色门牌靛（路由信号幕）；评测法阶梯走年检紫（治理面）。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {FPS, beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useCount,
  useDim,
  useDraw,
  useFlowDash,
  useImpulse,
  usePushIn,
  useSpring,
  useStagger,
} from '../motion';
import {SceneTag} from '../components/motifs';
import {Plaque, Stage} from '../components/e1-motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

/** 线性插值（走客/请求卡的直线行程——travel 钩子只覆盖环形，直线用纯函数拼窗）。 */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 店铺立面骨架（3-A/3-B/3-D 共用）：墙体 + 挑臂 + 〔M-004〕招牌 + 横滑门扇。
 *  doorOpen 0..1 同时驱动门扇外滑与门内辉光/SKILL.md 读入页；children 挂在
 *  墙面坐标系（量尺/侧签/关键词块都从这里进）。 */
const ShopFront: React.FC<{
  signTitle: string;
  doorOpen?: number;
  glow?: number;
  wallW?: number;
  wallH?: number;
  dim?: number;
  children?: React.ReactNode;
}> = ({signTitle, doorOpen = 0, glow = 0, wallW = 640, wallH = 560, dim = 0, children}) => {
  const doorW = 190;
  const doorH = 250;
  const doorX = (wallW - doorW) / 2;
  const doorTop = wallH - doorH;
  const slide = doorOpen * (doorW / 2 - 10); // 每扇外滑行程（留一条门缝）
  const interiorO = Math.max(0, (doorOpen - 0.2) / 0.8); // 门内景深随开度浮现
  return (
    <div style={{position: 'relative', width: wallW, height: wallH, opacity: 1 - 0.55 * dim}}>
      {/* 墙体 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: '14px 14px 0 0',
        }}
      />
      {/* 招牌挑臂 */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: wallW / 2 - 96,
          width: 192,
          height: 6,
          background: theme.panelBorder,
          borderRadius: 3,
        }}
      />
      {/* 门洞：底色 + 激活辉光 + SKILL.md 读入页 + 双门扇 */}
      <div
        style={{
          position: 'absolute',
          left: doorX,
          top: doorTop,
          width: doorW,
          height: doorH,
          overflow: 'hidden',
          borderRadius: '6px 6px 0 0',
          background: theme.bg,
          border: `2px solid ${theme.panelBorder}`,
        }}
      >
        {/* 门内：整份说明书读入（p3-04 的落点） */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: interiorO,
            background: `radial-gradient(ellipse at 50% 40%, ${theme.conceptDeep}3d, transparent 75%)`,
          }}
        >
          <svg width={62} height={76} viewBox="0 0 62 76">
            <path
              d="M8 4 H42 L56 18 V70 Q56 74 52 74 H10 Q6 74 6 70 V8 Q6 4 10 4 Z"
              fill={`${theme.conceptDeep}22`}
              stroke={theme.conceptDeep}
              strokeWidth={2.5}
            />
            <line x1={15} y1={24} x2={44} y2={24} stroke={theme.conceptDeep} strokeWidth={2.5} />
            <line x1={15} y1={34} x2={44} y2={34} stroke={theme.conceptDeep} strokeWidth={2.5} opacity={0.7} />
            <line x1={15} y1={44} x2={34} y2={44} stroke={theme.conceptDeep} strokeWidth={2.5} opacity={0.4} />
          </svg>
          <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.conceptDeep}}>SKILL.md</div>
        </div>
        {/* 左右门扇（横滑开启） */}
        <div
          style={{
            position: 'absolute',
            left: -slide,
            top: 0,
            width: doorW / 2 + 2,
            height: '100%',
            background: theme.panel,
            borderRight: `2px solid ${theme.panelBorder}`,
          }}
        >
          <div style={{position: 'absolute', right: 9, top: '52%', width: 5, height: 5, borderRadius: 3, background: theme.dim}} />
        </div>
        <div
          style={{
            position: 'absolute',
            right: -slide,
            top: 0,
            width: doorW / 2 + 2,
            height: '100%',
            background: theme.panel,
            borderLeft: `2px solid ${theme.panelBorder}`,
          }}
        >
          <div style={{position: 'absolute', left: 9, top: '52%', width: 5, height: 5, borderRadius: 3, background: theme.dim}} />
        </div>
      </div>
      {/* 招牌（M-004 sign 版式，靛蓝框）+ 强调辉光 */}
      <div
        style={{
          position: 'absolute',
          top: 38,
          left: '50%',
          transform: 'translateX(-50%)',
          borderRadius: 8,
          boxShadow: glow > 0.02 ? `0 0 ${Math.round(10 + 22 * glow)}px ${theme.conceptDeep}66` : undefined,
        }}
      >
        <Plaque variant="sign" title={signTitle} width={360} />
      </div>
      {children}
    </div>
  );
};

/** 过路客人剪影（3-B）：x 行程由调用方拼窗；lean 探头倾斜、q 问号气泡。 */
const Silhouette: React.FC<{x: number; top: number; bob?: number; lean?: number; o?: number; q?: boolean}> = ({
  x,
  top,
  bob = 0,
  lean = 0,
  o = 1,
  q = false,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: top + bob,
      opacity: o,
      transform: `rotate(${lean}deg)`,
      transformOrigin: '50% 100%',
    }}
  >
    <svg width={34} height={64} viewBox="0 0 34 64">
      <circle cx={17} cy={8} r={7.5} fill={theme.dim} />
      <path
        d="M17 17 C10 18 8 25 8.5 34 L10 62 H14.5 L15.5 43 H18.5 L19.5 62 H24 L25.5 34 C26 25 24 18 17 17 Z"
        fill={theme.dim}
      />
    </svg>
    {q && (
      <div style={{position: 'absolute', top: -24, left: 22, fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>?</div>
    )}
  </div>
);

/** 请求卡（用户端来客，右侧入场）：3-A 周五换班（对得上）/ 3-B 更新 Excel 预算表（近失）。 */
const RequestCard: React.FC<{text: string; x: number; y: number; checkedP?: number; o?: number}> = ({
  text,
  x,
  y,
  checkedP = 0,
  o = 1,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      opacity: o,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: theme.panel,
      border: `2px solid ${theme.panelBorder}`,
      borderRadius: 10,
      padding: '12px 18px',
      boxShadow: '0 4px 18px #00000055',
    }}
  >
    <span style={{fontSize: 21, color: theme.text, whiteSpace: 'nowrap'}}>{text}</span>
    {checkedP > 0 && (
      <span style={{fontSize: 20, color: theme.ok, opacity: checkedP, transform: `scale(${0.5 + 0.5 * checkedP})`}}>✓</span>
    )}
  </div>
);

/** 失败判定章（漏触发/误触发）：红框章 + 一行小注。 */
const Verdict: React.FC<{x: number; y: number; p: number; tag: string; sub: string}> = ({x, y, p, tag, sub}) => (
  <div style={{position: 'absolute', left: x, top: y, opacity: p, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6}}>
    <span
      style={{
        fontSize: 22,
        fontWeight: 700,
        color: theme.danger,
        border: `2.5px solid ${theme.danger}`,
        borderRadius: 8,
        padding: '5px 14px',
        letterSpacing: 4,
      }}
    >
      {tag}
    </span>
    <span style={{fontSize: 15, color: theme.dim}}>{sub}</span>
  </div>
);

/** 招牌侧签（3-A p3-02）：卖什么 / 何时进。 */
const SideTag: React.FC<{text: string; p: number; x: number}> = ({text, p, x}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: 64,
      opacity: p,
      transform: `translateY(${(1 - p) * -10}px)`,
      border: `1.5px solid ${theme.conceptDeep}88`,
      borderRadius: 7,
      padding: '4px 10px',
      fontSize: 16,
      color: theme.text,
      background: theme.panel,
    }}
  >
    {text}
  </div>
);

/** 3-A 招牌开张：换班技能的 description 招牌挂上立面；右列三行随句点亮——
 *  description 路由注解（p3-01）→ 请求卡对上号·门开整份读入（p3-04）→
 *  「最薄 · 最致命」衬线句（p3-05）；量尺 ≤1024 字符 +「独扛路由」章盖在招牌下。 */
const BoardOpen: React.FC<{
  signAt: number;
  tagsAt: number;
  reqAt: number;
  reqDur: number;
  noteAt: number;
  rulerAt: number;
  stampAt: number;
  serifAt: number;
}> = ({signAt, tagsAt, reqAt, reqDur, noteAt, rulerAt, stampAt, serifAt}) => {
  const frame = useCurrentFrame();
  const enter = useSpring('settle', {at: signAt, dur: DUR.f6});
  const enterO = progress(frame, signAt, DUR.f5);
  const tagSt = useStagger(2, {at: tagsAt, dur: DUR.f4, stride: 6});
  const descO = progress(frame, signAt + 4, DUR.f5);
  const link = useDraw(signAt + 8, DUR.f5);
  const headP = progress(frame, signAt + 8 + DUR.f5, DUR.f3);
  // p3-04 判定链：请求卡驶向招牌 → 对上号 → 门开整份读入
  const arrive = reqAt + Math.round(reqDur * 0.28);
  const cardP = progress(frame, reqAt, Math.max(1, arrive - reqAt));
  const checkP = progress(frame, arrive + 2, DUR.f4);
  const doorOpen = progress(frame, arrive + 8, DUR.f5);
  const noteO = progress(frame, noteAt, DUR.f4);
  // p3-05 量尺 → 章印 → 衬线强调
  const rulerP = useDraw(rulerAt, DUR.f5);
  const tickP = progress(frame, rulerAt + DUR.f5 + 1, DUR.f3);
  const labelP = progress(frame, rulerAt + 4, DUR.f4);
  const stampP = progress(frame, stampAt, DUR.f4);
  const stampImp = useImpulse({at: stampAt, dur: DUR.f6, peak: 1});
  const serif = useSpring('settle', {at: serifAt, dur: DUR.f6});
  const serifO = progress(frame, serifAt, DUR.f5);
  return (
    <div style={{position: 'relative', width: 1620, height: 640}}>
      {/* 地面 */}
      <div style={{position: 'absolute', left: 20, width: 680, top: 601, height: 2, background: theme.panelBorder, opacity: enterO}} />
      {/* 店铺立面（招牌文字 = description 缩略） */}
      <div style={{position: 'absolute', left: 40, top: 40, opacity: enterO, transform: `translateY(${(1 - enter) * -30}px)`}}>
        <ShopFront signTitle="提交排班变更：涉及换班时使用" doorOpen={doorOpen} glow={stampImp}>
          {/* p3-02 侧签：说清卖什么 / 什么情况该进来 */}
          <SideTag text="卖什么" p={tagSt[0]} x={26} />
          <SideTag text="何时进" p={tagSt[1]} x={520} />
          {/* p3-05 量尺：≤1024 字符（描线） */}
          <svg width={420} height={60} style={{position: 'absolute', left: 110, top: 152}}>
            <line x1={8} y1={38} x2={412} y2={38} stroke={theme.conceptDeep} strokeWidth={2.5} {...rulerP} />
            <line x1={8} y1={26} x2={8} y2={50} stroke={theme.conceptDeep} strokeWidth={2.5} opacity={tickP} />
            <line x1={412} y1={26} x2={412} y2={50} stroke={theme.conceptDeep} strokeWidth={2.5} opacity={tickP} />
          </svg>
          <div
            style={{
              position: 'absolute',
              left: 110,
              top: 128,
              width: 420,
              textAlign: 'center',
              fontFamily: theme.mono,
              fontSize: 20,
              color: theme.conceptDeep,
              opacity: labelP,
            }}
          >
            ≤1024 字符
          </div>
          {/* p3-05「独扛路由」章（砸在量尺上） */}
          <div
            style={{
              position: 'absolute',
              left: 322,
              top: 146,
              transform: `rotate(-8deg) scale(${1 + 0.7 * (1 - stampP)})`,
              opacity: stampP,
              border: `3px solid ${theme.conceptDeep}`,
              borderRadius: 8,
              padding: '5px 14px',
              fontSize: 23,
              fontWeight: 700,
              letterSpacing: 4,
              color: theme.conceptDeep,
              background: `${theme.bg}d9`,
            }}
          >
            独扛路由
          </div>
        </ShopFront>
      </div>
      {/* 右列 · p3-01：description 路由注解 → 连线指回招牌 */}
      <div style={{position: 'absolute', left: 780, top: 36, opacity: descO}}>
        <div style={{fontFamily: theme.mono, fontSize: 30, fontWeight: 700, color: theme.conceptDeep, letterSpacing: 1}}>description</div>
        <div style={{fontSize: 20, color: theme.text, marginTop: 8, letterSpacing: 3}}>一句话路由</div>
      </div>
      <svg width={70} height={20} style={{position: 'absolute', left: 702, top: 92, opacity: descO}}>
        <line x1={64} y1={10} x2={10} y2={10} stroke={theme.conceptDeep} strokeWidth={2.5} {...link} />
        <path d="M14 4 L4 10 L14 16 Z" fill={theme.conceptDeep} opacity={headP} />
      </svg>
      {/* p3-04 请求卡（右侧驶入，停在招牌旁） + 判定注 */}
      <RequestCard text="周五换班" x={lerp(1580, 552, cardP)} y={96} checkedP={checkP} o={progress(frame, reqAt, DUR.f3)} />
      <div style={{position: 'absolute', left: 556, top: 168, fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: noteO}}>
        判定：模型 · 多数实现无关键词匹配
      </div>
      {/* 右列 · p3-05：衬线强调句 */}
      <div style={{position: 'absolute', left: 780, top: 452, opacity: serifO, transform: `translateY(${(1 - serif) * 24}px)`}}>
        <div style={{fontFamily: theme.serif, fontSize: 38, fontWeight: 700, color: theme.conceptDeep, letterSpacing: 6}}>最薄 · 最致命</div>
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 10, letterSpacing: 2}}>全片最薄的约定</div>
      </div>
    </div>
  );
};

/** 3-B 失败模式：同一块 CSV 招牌的三种坏态——写窄（门半掩，客人径直走过=漏触发）、
 *  写宽（门大开，客人都探头=误触发）、近失（「更新 Excel 预算表」卡飘过招牌，
 *  半秒停顿后继续走=话题沾边、实际要干别的）。 */
const MissModes: React.FC<{
  baseAt: number;
  narrowAt: number;
  narrowDur: number;
  wideAt: number;
  wideDur: number;
  nearAt: number;
  nearDur: number;
  missAt: number;
  missDur: number;
}> = ({baseAt, narrowAt, narrowDur, wideAt, wideDur, nearAt, nearDur, missAt, missDur}) => {
  const frame = useCurrentFrame();
  const enter = useSpring('settle', {at: baseAt, dur: DUR.f6});
  const enterO = progress(frame, baseAt, DUR.f5);
  const tagSt = useStagger(2, {at: baseAt + 6, dur: DUR.f4, stride: 8});
  const tagDim = useDim({at: nearAt, to: 0.35, dur: DUR.f5}); // 近失聚焦后两端标签退场
  const narrowP = progress(frame, narrowAt, DUR.f4);
  const wideP = progress(frame, wideAt, DUR.f4);
  const nearP = progress(frame, nearAt, DUR.f5);
  // 门态：写窄半掩 0.35 → 写宽全开 → 近失回合拢
  const doorOpen = (0.35 * narrowP + 0.65 * wideP) * (1 - 0.8 * nearP);
  // p3-07 写窄：一位客人从右（用户端）向左径直走过
  const wStart = narrowAt + Math.round(narrowDur * 0.18);
  const wLen = Math.max(1, Math.round(narrowDur * 0.64));
  const walkP = progress(frame, wStart, wLen);
  const walkerO = progress(frame, wStart, DUR.f3) * (1 - progress(frame, wideAt, DUR.f4));
  // 漏触发 / 误触发 判定章（后者接力占同一锚位）
  const leakP = progress(frame, narrowAt + Math.round(narrowDur * 0.82), DUR.f4) * (1 - progress(frame, wideAt, DUR.f3));
  const falseP = progress(frame, wideAt + Math.round(wideDur * 0.55), DUR.f4) * (1 - progress(frame, nearAt, DUR.f3));
  // p3-09/10 近失误卡：飘入 → 半秒停顿（招牌辉光对读）→ 继续走
  const cardStart = nearAt + Math.round(nearDur * 0.12);
  const dwellAt = missAt + Math.round(missDur * 0.12);
  const dwellEnd = dwellAt + Math.round(FPS / 2); // 半秒停顿
  const leaveEnd = missAt + Math.round(missDur * 0.9);
  const cIn = progress(frame, cardStart, Math.max(1, dwellAt - cardStart));
  const cOut = progress(frame, dwellEnd, Math.max(1, leaveEnd - dwellEnd));
  const hold = (cIn >= 1 ? 1 : 0) * (1 - cOut);
  const cardX = lerp(lerp(1830, 1044, cIn), -360, cOut) + Math.sin(frame * 0.35) * 3 * hold; // 停顿期微悬停
  const cardO = progress(frame, cardStart, DUR.f3);
  const cmpP = progress(frame, dwellAt + 3, DUR.f3) * (1 - progress(frame, dwellEnd, DUR.f3));
  const nearTagP = progress(frame, dwellEnd, DUR.f4);
  const glow = useImpulse({at: dwellAt, dur: DUR.f6, peak: 1}); // 停顿对读：招牌一次辉光
  const modeTag = (label: string, x: number, actP: number, st: number) => (
    <div
      key={label}
      style={{
        position: 'absolute',
        left: x,
        top: 128,
        opacity: st * tagDim,
        transform: `translateY(${(1 - st) * -12}px)`,
        border: `2px solid ${actP > 0.5 ? theme.danger : theme.panelBorder}`,
        color: actP > 0.5 ? theme.danger : theme.dim,
        background: actP > 0.5 ? `${theme.danger}12` : 'transparent',
        borderRadius: 10,
        padding: '8px 18px',
        fontSize: 22,
        letterSpacing: 3,
      }}
    >
      {label}
    </div>
  );
  return (
    <div style={{position: 'relative', width: 1720, height: 680, opacity: enterO, transform: `translateY(${(1 - enter) * -28}px)`}}>
      {/* 地面 */}
      <div style={{position: 'absolute', left: 60, right: 60, top: 600, height: 2, background: theme.panelBorder}} />
      {/* 店铺（CSV 技能的招牌） */}
      <div style={{position: 'absolute', left: 580, top: 80}}>
        <ShopFront signTitle="处理 CSV 表格：涉及表格时使用" doorOpen={doorOpen} glow={glow} wallW={560} wallH={520} />
      </div>
      {/* 两态标签（p3-06 引入，各句激活） */}
      {modeTag('写窄', 150, narrowP, tagSt[0])}
      {modeTag('写宽', 1462, wideP, tagSt[1])}
      {/* p3-09 题眼：最难防的是近失 */}
      <div
        style={{
          position: 'absolute',
          left: 796,
          top: 40,
          opacity: nearP,
          fontSize: 22,
          color: theme.danger,
          border: `2px dashed ${theme.danger}88`,
          borderRadius: 9,
          padding: '6px 16px',
          letterSpacing: 3,
        }}
      >
        最难防
      </div>
      {/* p3-07 写窄：客人径直走过（门口不停留） */}
      <Silhouette
        x={lerp(1650, 110, walkP)}
        top={536}
        o={walkerO}
        bob={walkP > 0 && walkP < 1 ? Math.sin(frame * 0.55) * 2.5 : 0}
      />
      {/* p3-08 写宽：三位客人先后到门口探头 */}
      {[0, 1, 2].map((i) => {
        const st = wideAt + 4 + i * 7;
        const p = progress(frame, st, 26);
        const leanP = progress(frame, st + 26, DUR.f5);
        const fade = 1 - progress(frame, nearAt + i * 4, DUR.f5); // 近失段退场
        return (
          <Silhouette
            key={i}
            x={lerp(1660 - i * 64, 806 + i * 52, p)}
            top={536}
            o={progress(frame, st, DUR.f3) * fade}
            lean={-14 * leanP}
            q={leanP > 0.5}
          />
        );
      })}
      {/* 判定章：漏触发 / 误触发 */}
      <Verdict x={985} y={312} p={leakP} tag="漏触发" sub="该来的没进" />
      <Verdict x={985} y={312} p={falseP} tag="误触发" sub="不该进的进了" />
      {/* p3-09/10 近失误卡 + 停顿期对读双签 + 走后「近失」章 */}
      <RequestCard text="更新 Excel 预算表" x={cardX} y={108} o={cardO} />
      <div style={{position: 'absolute', left: 1040, top: 186, display: 'flex', gap: 12, opacity: cmpP}}>
        <span style={{fontSize: 16, color: theme.conceptDeep, border: `1.5px solid ${theme.conceptDeep}88`, borderRadius: 7, padding: '4px 10px'}}>看着像</span>
        <span style={{fontSize: 16, color: theme.danger, border: `1.5px solid ${theme.danger}88`, borderRadius: 7, padding: '4px 10px'}}>其实不是</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1006,
          top: 60,
          transform: 'rotate(-6deg)',
          fontSize: 21,
          fontWeight: 700,
          color: theme.danger,
          border: `2.5px solid ${theme.danger}`,
          borderRadius: 8,
          padding: '5px 14px',
          letterSpacing: 4,
          opacity: nearTagP,
        }}
      >
        近失
      </div>
    </div>
  );
};

/** 步一 出题：约 20 条真实请求洗牌入盒——双色卡面 = 一半该触发 / 一半不该。 */
const StepQuiz: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const st = useStagger(5, {at: at + 2, dur: DUR.f3, stride: 4});
  const n = useCount({from: 0, to: 20, at: at + 6, dur: DUR.f6});
  const flow = useFlowDash({period: 24}); // 洗牌流线
  const boxP = progress(frame, at + 10, DUR.f4);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {/* 计数：20 条 */}
      <div style={{position: 'absolute', right: 8, top: 10, textAlign: 'right'}}>
        <span style={{fontFamily: theme.mono, fontSize: 46, fontWeight: 700, color: theme.deny}}>{Math.round(n)}</span>
        <span style={{fontSize: 16, color: theme.dim, marginLeft: 6}}>条</span>
      </div>
      {/* 卡扇：靛蓝=该触发 / 灰=不该 */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 10 + i * 60,
            top: 22 + Math.abs(i - 2) * 7,
            width: 54,
            height: 72,
            borderRadius: 6,
            opacity: st[i],
            transform: `rotate(${(i - 2) * 8}deg) translateY(${(1 - st[i]) * -12}px)`,
            background: i % 2 === 0 ? `${theme.conceptDeep}2e` : 'transparent',
            border: `1.5px solid ${i % 2 === 0 ? theme.conceptDeep : theme.panelBorder}`,
          }}
        />
      ))}
      {/* 洗牌流线 → 收卡盒 */}
      <svg width={330} height={52} style={{position: 'absolute', left: 10, top: 102}}>
        <path d="M2 42 C 90 8, 230 8, 296 36" fill="none" stroke={theme.panelBorder} strokeWidth={2.5} {...flow} />
        <path d="M298 20 V 48 H 328" fill="none" stroke={theme.dim} strokeWidth={2.5} opacity={boxP} />
      </svg>
      {/* 图例 */}
      <div style={{position: 'absolute', left: 12, top: 164, display: 'flex', gap: 18, alignItems: 'center', fontSize: 13, color: theme.dim, opacity: st[4]}}>
        <span style={{display: 'flex', alignItems: 'center', gap: 6}}>
          <span style={{width: 10, height: 10, borderRadius: 5, background: theme.conceptDeep}} />
          该触发
        </span>
        <span style={{display: 'flex', alignItems: 'center', gap: 6}}>
          <span style={{width: 10, height: 10, borderRadius: 5, background: theme.panelBorder}} />
          不该
        </span>
      </div>
    </div>
  );
};

/** 步二 跑分：每条 ×3、过半变绿；判定可视化 = SKILL.md 读入页点亮（真读入）。 */
const StepScore: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const linkDraw = useDraw(at + 28, DUR.f4);
  const halfP = progress(frame, at + 24, DUR.f4);
  const pageP = progress(frame, at + 32, DUR.f5);
  const litP = progress(frame, at + 40, DUR.f4);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {/* 被测请求卡 */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: 12,
          width: 168,
          height: 64,
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          color: theme.text,
        }}
      >
        一条请求
      </div>
      {/* 三连圆点：第 2 次未触发，2/3 过半 → 绿 */}
      <div style={{position: 'absolute', left: 12, top: 92, display: 'flex', gap: 22}}>
        {[0, 1, 2].map((i) => {
          const lit = i !== 1 && progress(frame, at + 8 + i * 7, DUR.f3) > 0;
          return (
            <div
              key={i}
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                background: lit ? theme.ok : 'transparent',
                border: `2px solid ${lit ? theme.ok : theme.panelBorder}`,
              }}
            />
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 12, top: 124, fontFamily: theme.mono, fontSize: 14, color: theme.dim, opacity: halfP}}>过半算数</div>
      {/* 判定链 → SKILL.md 读入页 */}
      <svg width={64} height={16} style={{position: 'absolute', left: 196, top: 96}}>
        <line x1={0} y1={8} x2={46} y2={8} stroke={theme.panelBorder} strokeWidth={2.5} {...linkDraw} />
        <path d="M46 2 L58 8 L46 14 Z" fill={theme.panelBorder} opacity={halfP} />
      </svg>
      <div style={{position: 'absolute', left: 258, top: 8, width: 92, textAlign: 'center', opacity: pageP}}>
        <svg
          width={56}
          height={70}
          viewBox="0 0 56 70"
          style={litP > 0.3 ? {filter: `drop-shadow(0 0 ${Math.round(8 * litP)}px ${theme.deny})`} : undefined}
        >
          <path
            d="M6 3 H36 L50 17 V64 Q50 67 47 67 H9 Q6 67 6 64 Z"
            fill={`${theme.deny}1e`}
            stroke={litP > 0.3 ? theme.deny : theme.panelBorder}
            strokeWidth={2.5}
          />
          <line x1={14} y1={20} x2={38} y2={20} stroke={theme.deny} strokeWidth={2} opacity={litP} />
          <line x1={14} y1={29} x2={38} y2={29} stroke={theme.deny} strokeWidth={2} opacity={litP * 0.7} />
        </svg>
        <div style={{fontFamily: theme.mono, fontSize: 12, color: litP > 0.3 ? theme.deny : theme.dim, marginTop: 3}}>SKILL.md</div>
      </div>
      <div style={{position: 'absolute', left: 258, top: 104, width: 92, textAlign: 'center', fontSize: 14, color: theme.deny, opacity: litP}}>真读入</div>
    </div>
  );
};

/** 步三 防背题：20 条六四分栏——训练 12 / 验证 8；改招牌只看训练，验证集选版。 */
const StepSplit: React.FC<{at: number; dur: number}> = ({at, dur}) => {
  const frame = useCurrentFrame();
  const rev = progress(frame, at + 4, DUR.f5);
  const numsP = progress(frame, at + 14, DUR.f4);
  const pickP = progress(frame, at + Math.round(dur * 0.55), DUR.f4);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {/* 两端计数 + 栏名 */}
      <div style={{position: 'absolute', left: 14, top: 30, width: 204, textAlign: 'center', opacity: numsP}}>
        <span style={{fontFamily: theme.mono, fontSize: 34, fontWeight: 700, color: theme.deny}}>12</span>
        <span style={{fontSize: 15, color: theme.dim, marginLeft: 8}}>训练</span>
      </div>
      <div style={{position: 'absolute', left: 218, top: 30, width: 136, textAlign: 'center', opacity: numsP}}>
        <span style={{fontFamily: theme.mono, fontSize: 34, fontWeight: 700, color: theme.dim}}>8</span>
        <span style={{fontSize: 15, color: theme.dim, marginLeft: 8}}>验证</span>
      </div>
      {/* 60:40 分栏条（擦出） */}
      <div
        style={{
          position: 'absolute',
          left: 14,
          top: 74,
          width: 340,
          height: 18,
          borderRadius: 4,
          overflow: 'hidden',
          border: `1.5px solid ${theme.panelBorder}`,
        }}
      >
        <div style={{display: 'flex', width: 340, transform: `translateX(${(rev - 1) * 340}px)`}}>
          <div style={{width: 204, height: '100%', background: `${theme.deny}66`}} />
          <div style={{width: 136, height: '100%', background: `${theme.panelBorder}66`}} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 14, top: 104, fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: numsP}}>60 : 40</div>
      {/* 拿验证集选版本 */}
      <div
        style={{
          position: 'absolute',
          left: 14,
          top: 136,
          fontSize: 15,
          color: theme.text,
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 7,
          padding: '5px 12px',
          opacity: pickP,
        }}
      >
        验证集选版
      </div>
    </div>
  );
};

/** 步四 收敛：五轮箭头收拢成一点；卡住就换结构，别死磕措辞。 */
const StepConverge: React.FC<{at: number; dur: number}> = ({at, dur}) => {
  const frame = useCurrentFrame();
  // 五条收拢线逐条描出（hooks 数量固定，显式展开）
  const c0 = useDraw(at + 2, DUR.f5);
  const c1 = useDraw(at + 7, DUR.f5);
  const c2 = useDraw(at + 12, DUR.f5);
  const c3 = useDraw(at + 17, DUR.f5);
  const c4 = useDraw(at + 22, DUR.f5);
  const draws = [c0, c1, c2, c3, c4];
  const dotP = progress(frame, at + 30, DUR.f4);
  const pulse = useImpulse({at: at + 36, dur: DUR.f6, peak: 1});
  const chipP = progress(frame, at + Math.round(dur * 0.6), DUR.f4);
  const ys = [12, 42, 72, 102, 132];
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <svg width={330} height={150} style={{position: 'absolute', left: 16, top: 8}}>
        {ys.map((y, i) => (
          <path
            key={i}
            d={`M4 ${y} C 150 ${y}, 170 72, 296 72`}
            fill="none"
            stroke={i === 2 ? theme.deny : `${theme.deny}99`}
            strokeWidth={2.5}
            {...draws[i]}
          />
        ))}
        {dotP > 0 && <circle cx={296} cy={72} r={5 + 3 * pulse} fill={theme.deny} opacity={dotP} />}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 158,
          fontSize: 15,
          color: theme.dim,
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 7,
          padding: '4px 12px',
          opacity: chipP,
        }}
      >
        卡住 → 换结构
      </div>
    </div>
  );
};

/** 3-C 评测四步：官方招牌测试法阶梯（治理面紫）——p3-11 立骨架（4 格虚线鬼影），
 *  每句点亮一级，装置逐级搭起。 */
const STEP_X = [20, 460, 900, 1340];
const STEP_TOP = [320, 215, 110, 5];
const STEP_BOTTOM = 698;
const STEP_META = [
  {title: '出题', sub: '4 维变化'},
  {title: '跑分', sub: '每条 ×3'},
  {title: '防背题', sub: '60 : 40'},
  {title: '收敛', sub: '约 5 轮'},
] as const;

const EvalLadder: React.FC<{frameAt: number; steps: number[]; durs: number[]}> = ({frameAt, steps, durs}) => {
  const frame = useCurrentFrame();
  const ghost = useStagger(4, {at: frameAt + 4, dur: DUR.f4, stride: 5});
  const headP = progress(frame, frameAt, DUR.f5);
  return (
    <div style={{position: 'relative', width: 1780, height: 720}}>
      {/* 阶梯地面线 */}
      <div style={{position: 'absolute', left: 0, right: 0, top: STEP_BOTTOM, height: 2, background: theme.panelBorder, opacity: headP}} />
      {/* 标题行（p3-11） */}
      <div style={{position: 'absolute', left: 24, top: 8, opacity: headP, display: 'flex', alignItems: 'baseline', gap: 14}}>
        <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, letterSpacing: 2}}>官方招牌测试法</span>
        <span style={{fontSize: 40, fontWeight: 700, color: theme.deny}}>4 步</span>
      </div>
      {STEP_META.map((m, i) => {
        const actP = progress(frame, steps[i], DUR.f5);
        const h = STEP_BOTTOM - STEP_TOP[i];
        return (
          <React.Fragment key={m.title}>
            {/* 鬼影格（p3-11 立骨架；点亮后让位） */}
            <div
              style={{
                position: 'absolute',
                left: STEP_X[i],
                top: STEP_TOP[i],
                width: 400,
                height: h,
                border: `2px dashed ${theme.panelBorder}`,
                borderRadius: 12,
                opacity: 0.5 * ghost[i] * (1 - actP),
              }}
            />
            {/* 实格（随句点亮，逐级升高） */}
            <div
              style={{
                position: 'absolute',
                left: STEP_X[i],
                top: STEP_TOP[i],
                width: 400,
                height: h,
                background: theme.panel,
                border: `2px solid ${actP > 0 ? theme.deny : 'transparent'}`,
                borderRadius: 12,
                opacity: actP,
                transform: `translateY(${(1 - actP) * 20}px)`,
                padding: '16px 16px 0',
              }}
            >
              <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
                <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.deny}}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{fontSize: 26, fontWeight: 700, color: theme.text}}>{m.title}</span>
                <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginLeft: 'auto'}}>{m.sub}</span>
              </div>
              <div style={{position: 'relative', width: 368, height: 190, marginTop: 6}}>
                {i === 0 && <StepQuiz at={steps[0]} />}
                {i === 1 && <StepScore at={steps[1]} />}
                {i === 2 && <StepSplit at={steps[2]} dur={durs[0]} />}
                {i === 3 && <StepConverge at={steps[3]} dur={durs[1]} />}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** 拉远后露出的一排门（各家客户端的门口）——不同样式、无字门牌，点名留给 P4。 */
const DoorUnit: React.FC<{
  x: number;
  w: number;
  h: number;
  kind: 'arch' | 'awning' | 'double' | 'tall';
  p: number;
}> = ({x, w, h, kind, p}) => (
  <div style={{position: 'absolute', left: x, top: 680 - h, width: w, height: h, opacity: p, transform: `translateY(${(1 - p) * 14}px)`}}>
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{overflow: 'visible'}}>
      {/* 雨棚门：条纹雨棚 + 平顶门框 */}
      {kind === 'awning' &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x={-4 + (i * (w + 8)) / 6}
            y={0}
            width={(w + 8) / 6}
            height={16}
            fill={i % 2 === 0 ? theme.panelBorder : `${theme.dim}44`}
          />
        ))}
      <rect
        x={0}
        y={kind === 'awning' ? 18 : 0}
        width={w}
        height={h - (kind === 'awning' ? 18 : 0)}
        fill={theme.panel}
        stroke={theme.panelBorder}
        strokeWidth={2.5}
        rx={3}
      />
      {/* 拱门 */}
      {kind === 'arch' && (
        <>
          <path
            d={`M12 ${h - 12} V66 Q12 22 ${w / 2} 22 Q${w - 12} 22 ${w - 12} 66 V${h - 12} Z`}
            fill="none"
            stroke={theme.panelBorder}
            strokeWidth={2}
          />
          <circle cx={w * 0.66} cy={h * 0.6} r={3.5} fill={theme.dim} />
        </>
      )}
      {/* 对开门 */}
      {kind === 'double' && (
        <>
          <line x1={w / 2} y1={26} x2={w / 2} y2={h - 12} stroke={theme.panelBorder} strokeWidth={2} />
          <circle cx={w / 2 - 10} cy={h * 0.58} r={3.5} fill={theme.dim} />
          <circle cx={w / 2 + 10} cy={h * 0.58} r={3.5} fill={theme.dim} />
        </>
      )}
      {/* 高窄门（气窗横线） */}
      {kind === 'tall' && (
        <>
          <line x1={14} y1={h * 0.3} x2={w - 14} y2={h * 0.3} stroke={theme.panelBorder} strokeWidth={2} />
          <circle cx={w * 0.68} cy={h * 0.62} r={3.5} fill={theme.dim} />
        </>
      )}
    </svg>
  </div>
);

/** 3-D 背题王：失败样例关键词把招牌糊满（只认 20 张脸）→ p3-17 如实边界对照卡
 *  （依据？文档未说 / 一致性？无人公开测）→ p3-18 招牌复原 + 镜头拉远，
 *  一排不同样式的门浮现（钩到 P4：各家门口的规矩谁说了算）。 */
const CHIPS: [string, number, number, number][] = [
  ['Excel', 150, 46, -5],
  ['预算', 252, 42, 3],
  ['公式', 348, 48, -2],
  ['CSV', 442, 44, 6],
  ['透视表', 148, 82, 4],
  ['汇总', 254, 86, -6],
  ['冻结行', 346, 80, 2],
  ['周报', 452, 84, -3],
];
const SIDE_DOORS: {x: number; w: number; h: number; kind: 'arch' | 'awning' | 'double' | 'tall'}[] = [
  {x: 66, w: 150, h: 400, kind: 'awning'},
  {x: 252, w: 150, h: 432, kind: 'arch'},
  {x: 438, w: 128, h: 458, kind: 'tall'},
  {x: 1252, w: 152, h: 420, kind: 'arch'},
  {x: 1448, w: 160, h: 392, kind: 'double'},
  {x: 1644, w: 128, h: 450, kind: 'tall'},
];

const KingPin: React.FC<{chipAt: number; chipDur: number; cardAt: number; restoreAt: number; restoreDur: number}> = ({
  chipAt,
  chipDur,
  cardAt,
  restoreAt,
  restoreDur,
}) => {
  const frame = useCurrentFrame();
  const enter = useSpring('settle', {at: chipAt, dur: DUR.f6});
  const enterO = progress(frame, chipAt, DUR.f5);
  // p3-16 关键词块堆叠糊满招牌
  const chipSt = useStagger(8, {at: chipAt + 4, dur: DUR.f3, stride: 3});
  const chipOut = progress(frame, restoreAt, DUR.f4);
  const stampAt = chipAt + Math.round(chipDur * 0.55);
  const stampIn = progress(frame, stampAt, DUR.f4);
  const stampO = stampIn * (1 - chipOut);
  const subO = progress(frame, stampAt + 6, DUR.f4) * (1 - chipOut);
  // p3-17 对照卡入场 + 墙面压暗
  const cardS = useSpring('settle', {at: cardAt, dur: DUR.f6});
  const cardO = progress(frame, cardAt, DUR.f5) * (1 - progress(frame, restoreAt, DUR.f3));
  const dimP = progress(frame, cardAt, DUR.f5) * (1 - progress(frame, restoreAt, DUR.f5));
  // p3-18 复原 + 拉远
  const zoom = usePushIn(restoreAt, {scale: -0.38, dur: Math.round(restoreDur * 0.55)});
  const doorsAt = restoreAt + 10;
  const hookP = progress(frame, restoreAt + Math.round(restoreDur * 0.45), DUR.f5);
  return (
    <div style={{position: 'relative', width: 1800, height: 720}}>
      <div style={{position: 'absolute', inset: 0, transform: zoom, transformOrigin: '900px 400px'}}>
        {/* 地面 */}
        <div style={{position: 'absolute', left: 30, right: 30, top: 679, height: 2, background: theme.panelBorder, opacity: enterO}} />
        {/* 一排门（p3-18 拉远后浮现） */}
        {SIDE_DOORS.map((d, i) => (
          <DoorUnit key={i} x={d.x} w={d.w} h={d.h} kind={d.kind} p={progress(frame, doorsAt + i * 4, DUR.f5)} />
        ))}
        {/* 中央店铺：CSV 招牌被关键词糊满 → 复原干净 */}
        <div style={{position: 'absolute', left: 580, top: 120, opacity: enterO, transform: `translateY(${(1 - enter) * -26}px)`}}>
          <ShopFront signTitle="处理 CSV 表格：涉及表格时使用" wallW={640} wallH={560} dim={0.55 * dimP}>
            {CHIPS.map(([t, x, y, r], i) => (
              <div
                key={t}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  transform: `rotate(${r}deg) translateY(${(1 - chipSt[i]) * -12 + chipOut * 26}px)`,
                  opacity: chipSt[i] * (1 - chipOut),
                  background: `${theme.conceptDeep}2e`,
                  border: `1.5px solid ${theme.conceptDeep}88`,
                  borderRadius: 5,
                  padding: '3px 9px',
                  fontFamily: theme.mono,
                  fontSize: 15,
                  color: theme.text,
                }}
              >
                {t}
              </div>
            ))}
            {/* 「背题王」章 + 注脚 */}
            <div
              style={{
                position: 'absolute',
                left: 442,
                top: 128,
                transform: `rotate(6deg) scale(${1 + 0.6 * (1 - stampIn)})`,
                opacity: stampO,
                border: `3px solid ${theme.danger}`,
                borderRadius: 8,
                padding: '5px 13px',
                fontSize: 23,
                fontWeight: 700,
                letterSpacing: 3,
                color: theme.danger,
                background: `${theme.bg}d9`,
              }}
            >
              背题王
            </div>
            <div style={{position: 'absolute', left: 442, top: 184, fontSize: 15, color: theme.danger, opacity: subO * 0.85}}>只认 20 张脸</div>
          </ShopFront>
        </div>
        {/* p3-17 如实边界对照卡 */}
        <div
          style={{
            position: 'absolute',
            left: 1252,
            top: 216,
            width: 500,
            background: theme.panel,
            border: `1.5px solid ${theme.deny}55`,
            borderLeft: `4px solid ${theme.deny}`,
            borderRadius: 12,
            padding: '20px 24px',
            opacity: cardO,
            transform: `translateY(${(1 - cardS) * 24}px)`,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.deny, letterSpacing: 3, marginBottom: 14}}>如实 · 边界</div>
          <div style={{fontFamily: theme.serif, fontSize: 25, color: theme.text}}>
            依据？<span style={{fontSize: 20, color: theme.dim}}> 文档未说</span>
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 25, color: theme.text, marginTop: 10}}>
            一致性？<span style={{fontSize: 20, color: theme.dim}}> 无人公开测</span>
          </div>
        </div>
      </div>
      {/* 拉远后的问题钩（不随镜头缩放） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 10, textAlign: 'center', fontSize: 30, color: theme.conceptDeep, letterSpacing: 8, opacity: hookP}}>
        谁说了算？
      </div>
    </div>
  );
};

export const P3Signboard: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p3-01', 'p3-05');
  const bB = w('p3-06', 'p3-10');
  const bC = w('p3-11', 'p3-15');
  const bD = w('p3-16', 'p3-18');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A 招牌">
        <SceneTag chapter="P3" tagline="一句招牌" accent={theme.conceptDeep} />
        {/* lc-activate 章回放承载「登记目录·逐轮比对」（p3-03）；店铺立面按窗让位 */}
        <ArchifyYield cues={[{at: at('p3-03') - bA.from, durationInFrames: dur('p3-03')}]}>
          <BoardOpen
            signAt={at('p3-01') - bA.from}
            tagsAt={at('p3-02') - bA.from + Math.round(dur('p3-02') * 0.35)}
            reqAt={at('p3-04') - bA.from + Math.round(dur('p3-04') * 0.05)}
            reqDur={dur('p3-04')}
            noteAt={at('p3-04') - bA.from + Math.round(dur('p3-04') * 0.62)}
            rulerAt={at('p3-05') - bA.from + Math.round(dur('p3-05') * 0.12)}
            stampAt={at('p3-05') - bA.from + Math.round(dur('p3-05') * 0.58)}
            serifAt={at('p3-05') - bA.from}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="lifecycle"
          caption="生命周期 · 激活"
          cues={[
            {chapterId: 'lc-activate', at: at('p3-03') - bA.from, durationInFrames: dur('p3-03'), },
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="3-B 失败模式">
        <SceneTag chapter="P3" tagline="一句招牌" accent={theme.conceptDeep} />
        <Stage>
          <MissModes
            baseAt={at('p3-06') - bB.from}
            narrowAt={at('p3-07') - bB.from}
            narrowDur={dur('p3-07')}
            wideAt={at('p3-08') - bB.from}
            wideDur={dur('p3-08')}
            nearAt={at('p3-09') - bB.from}
            nearDur={dur('p3-09')}
            missAt={at('p3-10') - bB.from}
            missDur={dur('p3-10')}
          />
        </Stage>
      </Sequence>

      <Sequence {...bC} name="3-C 评测四步">
        <SceneTag chapter="P3" tagline="一句招牌" accent={theme.conceptDeep} />
        {/* 激活章二次锚（p3-13 跑分判定=SKILL.md 是否真的被读入）——全屏独占期间阶梯
         *  让位；窗缩至句前缀（尾 56 帧留给第 2 级跑分点亮，防动画全程被窗吞没） */}
        <ArchifyYield cues={[{at: at('p3-13') - bC.from, durationInFrames: dur('p3-13') - 56}]}>
          <Stage>
            <EvalLadder
              frameAt={at('p3-11') - bC.from}
              steps={[
                at('p3-12') - bC.from,
                at('p3-13') - bC.from + dur('p3-13') - 56,
                at('p3-14') - bC.from,
                at('p3-15') - bC.from,
              ]}
              durs={[dur('p3-14'), dur('p3-15')]}
            />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="lifecycle"
          caption="激活 · 跑分判定"
          cues={[{chapterId: 'lc-activate', at: at('p3-13') - bC.from, durationInFrames: dur('p3-13') - 56, }]}
        />
      </Sequence>

      <Sequence {...bD} name="3-D 背题王">
        <SceneTag chapter="P3" tagline="一句招牌" accent={theme.conceptDeep} />
        <Stage>
          <KingPin
            chipAt={at('p3-16') - bD.from}
            chipDur={dur('p3-16')}
            cardAt={at('p3-17') - bD.from}
            restoreAt={at('p3-18') - bD.from}
            restoreDur={dur('p3-18')}
          />
        </Stage>
      </Sequence>
    </AbsoluteFill>
  );
};
