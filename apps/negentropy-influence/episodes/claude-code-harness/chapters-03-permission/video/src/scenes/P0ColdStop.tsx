/** P0 动手之前（p0-01..p0-07，3 镜）——分镜 0-A / 0-B / 0-C（storyboard v1）。
 *
 *  叙事链：冷启动删盘危机（开篇视听合力 I-039）——删盘命令加速直奔磁盘、
 *  代码之手（陶土橙描边）拍下停闸、命令落地前一帧刹停〔M-005〕（不可逆论证
 *  的画面承载：事后拦不住既成事实，不进口播）；「这道门」词落位手背下方
 *  亮裁决紫闸卡轮廓预现（闸门链装置首现——0-C 单枚暗态）→ 左右对比帧：
 *  左「人跑命令」人形剪影抬手拦可疑卡摇头退回 / 右「自动循环」环体暗态缩形
 *  〔M-001〕+ 青碧回喂流只管吞吐、红色删盘命令穿无框 bash 通道直行无阻、
 *  四文件工具卡边界蓝小框点亮、bash 空位泛无界光晕 → 闸门之外特写：提示词
 *  纸片递向闸卡被挡下滑落（提示词不在裁决链内）、衬线金句空卡预亮浮起
 *  （落字留 5-A 收束）、闸卡后缘三门轮廓列队一闪（P1 预告）。
 *
 *  空间契约：0-A 命令-磁盘-手三点一线位于字幕安全区上方、停闸发生在落地
 *  之前；0-B 左右分屏等高、环体暗态缩形可辨（青碧流环绕）、bash 恒无框、
 *  人形剪影只出现在左半（自动循环无人把关是语义）；0-C 纸片被挡在闸卡之外、
 *  空卡无字、三门只亮轮廓。
 *
 *  红线落实：词落位 = 句首 + 句长比例 wa(id,f)；红色命令在右半不被任何元素
 *  拦下（0-A 已演拦停，0-B 演险）；四工具卡框不提前亮；署源角标右下常驻
 *  不抢焦；y≥56 / bottom≥168。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BrainGlyph, CodeHand, GateCard, LoopRing, Panel} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useImpulse, useProgress} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，RSI I-080）：右下常驻，一次淡入后恒定不抢焦；
 *  bottom 168 避开字幕条（承 ep1/ep2 SourceCredit 形态） */
const SourceCredit: React.FC = () => {
  const o = useProgress(0, DUR.f5);
  return (
    <div
      style={{
        position: 'absolute',
        right: 72,
        bottom: 168,
        fontFamily: theme.mono,
        fontSize: 22,
        letterSpacing: 1,
        color: theme.dim,
        opacity: 0.85 * o,
      }}
    >
      Learn Claude Code
    </div>
  );
};

/** 磁盘图标（圆柱体：椭圆顶 + 柱身 + 盘纹） */
const DiskGlyph: React.FC<{cx: number; cy: number; s?: number; warn?: number}> = ({cx, cy, s = 1, warn = 0}) => (
  <svg width={220 * s} height={230 * s} viewBox="-110 -115 220 230" style={{position: 'absolute', left: cx - 110 * s, top: cy - 115 * s, overflow: 'visible'}}>
    <g stroke={warn > 0.3 ? theme.danger : theme.dim} strokeWidth={5 * s} fill="none">
      {/* 柱身 */}
      <path d="M-84 -46 L-84 62 Q-84 96, 0 96 Q84 96, 84 62 L84 -46" fill={theme.panel} />
      {/* 顶面椭圆 */}
      <ellipse cx={0} cy={-46} rx={84} ry={34} fill={theme.panel} />
      {/* 盘纹两道 */}
      <path d="M-84 12 Q-84 40, 0 40 Q84 40, 84 12" opacity={0.55} />
      <path d="M-84 -12 Q-84 16, 0 16 Q84 16, 84 -12" opacity={0.35} />
    </g>
    <text x={0} y={-40} textAnchor="middle" fontFamily={theme.mono} fontSize={20 * s} fill={theme.dim}>
      disk
    </text>
  </svg>
);

/** 删盘命令卡（警示红——本集反例主角的静止形态；位移由调用方驱动） */
const RmCard: React.FC<{x: number; y: number; o?: number; trail?: number}> = ({x, y, o = 1, trail = 0}) => (
  <div style={{position: 'absolute', left: x, top: y, opacity: o}}>
    {/* 警示红尾迹（命令左缘的加速拖尾） */}
    {trail > 0.01 ? (
      <div
        style={{
          position: 'absolute',
          right: '100%',
          top: 12,
          width: 190 * trail,
          height: 26,
          borderRadius: 6,
          background: `linear-gradient(90deg, transparent, ${withAlpha(theme.danger, 0.5 * trail)})`,
        }}
      />
    ) : null}
    <div
      style={{
        padding: '12px 24px',
        borderRadius: 10,
        border: `2.5px solid ${theme.danger}`,
        background: theme.panel,
        boxShadow: `0 0 ${20 * trail}px ${withAlpha(theme.danger, 0.55 * trail)}`,
      }}
    >
      <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.danger, whiteSpace: 'nowrap'}}>{'rm -rf /'}</span>
    </div>
  </div>
);

// ── 0-A 冷启动：删盘命令直奔磁盘，代码之手拍下停闸 ─────────────────────

const ZeroA: React.FC<{atRush: number; atHand: number; atGate: number; atFlash: number}> = ({atRush, atHand, atGate, atFlash}) => {
  // 命令加速逼近（accelerate——危机感），「拦住它的」词落位刹停（落地前一帧）
  const rush = useProgress(atRush, DUR.f6, 'accelerate');
  const stopX = 1130;
  const cmdX = 120 + (stopX - 120) * rush;
  const trail = Math.max(0, rush - 0.3) * 1.4;
  // 代码之手：自下缘探入悬停闸位上空 →「拦住它的」拍下（spring 沉手感）
  const handIn = useProgress(0, DUR.f5);
  const press = useProgress(atHand, DUR.f3);
  // 手背下方闸卡轮廓预现（裁决紫虚线轮廓——闸门链首现）→「先过裁决」闪一次
  const gateO = useProgress(atGate, DUR.f4);
  const gateFlash = useImpulse({at: atFlash, dur: DUR.f4, peak: 1});
  const brake = useImpulse({at: atHand + DUR.f2, dur: DUR.f3, peak: 0.1});
  return (
    <AbsoluteFill>
      {/* 磁盘（居中偏上偏右——命令三点一线的终点） */}
      <DiskGlyph cx={1400} cy={400} s={1} warn={trail * 0.8} />
      {/* 删盘命令卡：自左缘滑出加速逼近、落地前一帧刹停（brake 微弹=急停感） */}
      <div style={{position: 'absolute', left: cmdX - 130 * brake, top: 388}}>
        <RmCard x={0} y={0} trail={trail} />
      </div>
      {/* 代码之手（陶土橙描边——0-A 首现、5-B 同款回归） */}
      <CodeHandLayer handIn={handIn} press={press} />
      {/* 手背下方闸卡轮廓预现（裁决紫 ghost——本集主装置第一次露面） */}
      <div style={{position: 'absolute', left: 920, top: 640, opacity: gateO}}>
        <GateCard x={0} y={0} w={180} h={170} kind="deny" lit={0.001 + gateFlash * 0.35} ghost={0.55} showName={false} />
        {/* 轮廓闪一次（「先过裁决」词落位） */}
        {gateFlash > 0.01 ? (
          <div
            style={{
              position: 'absolute',
              inset: -8,
              borderRadius: 16,
              border: `3px solid ${theme.mech}`,
              boxShadow: `0 0 ${26 * gateFlash}px ${withAlpha(theme.mech, 0.8)}`,
              opacity: gateFlash,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
      {/* 闸位标线（命令与磁盘之间的裁决位——手正压其上） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line
          x1={920}
          y1={820}
          x2={1140}
          y2={820}
          stroke={withAlpha(theme.mech, 0.5 * gateO)}
          strokeWidth={3}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - gateO}
        />
      </svg>
      <FootTag>{'check_permission · 动手之前'}</FootTag>
    </AbsoluteFill>
  );
};

/** 代码之手层（0-A 专用包装：悬停位 + 拍下行程；与 5-B 同款首尾拦截面） */
const CodeHandLayer: React.FC<{handIn: number; press: number}> = ({handIn, press}) => (
  <CodeHand cx={1010} cy={520 - 30 * handIn} press={press} opacity={handIn} scale={0.82} />
);

/** 贴底角标行（bottom 168——字幕带上沿之上） */
const FootTag: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 168,
      textAlign: 'center',
      fontFamily: theme.mono,
      fontSize: 22,
      color: theme.dim,
      opacity: 0.85,
    }}
  >
    {children}
  </div>
);

// ── 0-B 左右对比：人跑命令 vs 自动循环 ─────────────────────────────────

/** 右半四件文件工具小卡（各带边界蓝小框——承 ep2 视觉签名） */
const TOOL_MINIS = [
  {zh: '读', en: 'read'},
  {zh: '写', en: 'write'},
  {zh: '改', en: 'edit'},
  {zh: '找', en: 'glob'},
] as const;

const ZeroB: React.FC<{atHandL: number; atCross: number; atBound: number; atOpen: number; atNear: number}> = ({
  atHandL,
  atCross,
  atBound,
  atOpen,
  atNear,
}) => {
  const frame = useCurrentFrame();
  // 左半：人形剪影抬手（「过你的手」）拦下可疑命令卡、摇头退回
  const armRaise = useProgress(atHandL, DUR.f4);
  const susGo = useProgress(atHandL - DUR.f3, DUR.f5, 'decelerate');
  const shake = Math.sin(Math.PI * clamp01(progress(frame, atHandL + DUR.f3, DUR.f4)));
  // 右半：红命令沿无框 bash 通道直行（等速线性——机械感）→「照样跑得到」抵近磁盘悬置
  const cross = useProgress(atCross, DUR.f6 + DUR.f5, 'linear');
  const near = useProgress(atNear, DUR.f4, 'decelerate');
  const rmX = 1020 + 560 * cross + 90 * near;
  // 四工具卡蓝框点亮（「文件工具有边界」）；bash 空位无界光晕（「还全开着」）
  const boundO = useProgress(atBound, DUR.f4);
  const halo = useProgress(atOpen, DUR.f4);
  const haloBreathe = 0.55 + 0.45 * Math.sin(frame / 14);
  return (
    <AbsoluteFill>
      {/* 中缝分屏线（左右等高） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line x1={960} y1={150} x2={960} y2={860} stroke={theme.panelBorder} strokeWidth={3} strokeDasharray="10 12" opacity={0.75} />
      </svg>
      {/* ── 左半：人跑命令 ── */}
      <div style={{position: 'absolute', left: 150, top: 190, fontFamily: theme.mono, fontSize: 23, color: theme.dim}}>
        {'人跑命令 · 有人把关'}
      </div>
      {/* 人形剪影（暖色=core 低饱和——「过你的手」的把关人；只在左半） */}
      <PersonGlyph cx={330} cy={560} raise={armRaise} />
      {/* 命令通道口（门口形——有人坐镇） */}
      <svg width={200} height={210} style={{position: 'absolute', left: 560, top: 470, overflow: 'visible'}}>
        <path
          d="M16 200 L16 60 Q16 12, 100 12 Q184 12, 184 60 L184 200"
          fill="none"
          stroke={theme.dim}
          strokeWidth={4}
          opacity={0.7}
        />
      </svg>
      {/* 可疑命令卡：欲过通道口 → 人形抬手拦下、摇头退回 */}
      <div
        style={{
          position: 'absolute',
          left: 470 + 60 * susGo - 50 * armRaise + shake * 10,
          top: 590,
          opacity: 0.55 + 0.45 * armRaise,
        }}
      >
        <Panel accent={withAlpha(theme.danger, 0.85)} style={{padding: '8px 16px'}}>
          <span style={{fontFamily: theme.mono, fontSize: 21, color: theme.danger, whiteSpace: 'nowrap'}}>{'可疑命令'}</span>
        </Panel>
      </div>
      {/* 摇头标记（人形头上——拦下时一拍；「可疑的你自然不跑」） */}
      <div
        style={{
          position: 'absolute',
          left: 290,
          top: 330,
          fontFamily: theme.sans,
          fontSize: 26,
          fontWeight: 700,
          color: theme.ok,
          opacity: armRaise * 0.9,
        }}
      >
        {'摇头 · 退回'}
      </div>
      {/* ── 右半：自动循环（无人把关）── */}
      <div style={{position: 'absolute', left: 1060, top: 190, fontFamily: theme.mono, fontSize: 23, color: theme.dim, opacity: 0.85}}>
        {'自动循环 · 没这根神经'}
      </div>
      {/* 四文件工具小卡（上缘横排；边界蓝小框「文件工具有边界」点亮） */}
      {TOOL_MINIS.map((t, i) => (
        <div key={t.en} style={{position: 'absolute', left: 1070 + i * 190, top: 270, opacity: 0.9}}>
          <div
            style={{
              position: 'relative',
              width: 158,
              height: 66,
              borderRadius: 10,
              border: `2.5px solid ${theme.edge}`,
              background: withAlpha(theme.edge, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{t.zh}</span>
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{t.en}</span>
            {/* 边界蓝小框（点亮收拢——ep2 1-D 视觉签名） */}
            <span
              style={{
                position: 'absolute',
                inset: -7,
                borderRadius: 14,
                border: `2px dashed ${theme.edge}`,
                opacity: 0.9 * boundO,
              }}
            />
          </div>
        </div>
      ))}
      {/* bash 无框空位（无卡无框——「还全开着」的无界光晕） */}
      {halo > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 1070 + 3 * 190 - 16,
            top: 250,
            width: 210,
            height: 106,
            borderRadius: 999,
            background: `radial-gradient(ellipse, ${withAlpha(theme.danger, 0.2 * halo * haloBreathe)} 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: 1070 + 3 * 190,
          top: 294,
          width: 158,
          height: 66,
          borderRadius: 10,
          border: `2px dashed ${withAlpha(theme.dim, 0.4)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'bash 全开'}</span>
      </div>
      {/* 环体暗态缩形（M-001：青碧回喂流环绕、只管吞吐） */}
      <div style={{position: 'absolute', left: 1240, top: 470, opacity: 0.55}}>
        <LoopRing size={220} nodes={[0, 1, 2, 3, 4].map((i) => ({label: `s${i}`, angle: -90 + i * 72}))} showLabels={false} showExit={false} dimNodes />
      </div>
      {/* 青碧回喂流（环侧吞吐虚线弧） */}
      <svg width={340} height={150} style={{position: 'absolute', left: 1190, top: 520, overflow: 'visible', opacity: 0.8}}>
        <path
          d="M 20 110 Q 170 30, 320 110"
          fill="none"
          stroke={theme.tool}
          strokeWidth={4}
          strokeDasharray="12 10"
          strokeDashoffset={-(frame * 22) / 30}
        />
        <path d="M310 96 L324 110 L306 120 Z" fill={theme.tool} opacity={0.85} />
      </svg>
      {/* bash 无框通道（地面虚线——无任何门/框） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line x1={1020} y1={690} x2={1840} y2={690} stroke={withAlpha(theme.dim, 0.35)} strokeWidth={2.5} strokeDasharray="7 9" />
      </svg>
      {/* 删盘命令（警示红）：沿无框通道直行穿过环体奔磁盘——无阻（演险不演拦） */}
      <div style={{position: 'absolute', left: rmX, top: 620}}>
        <RmCard x={0} y={0} trail={0.5} />
      </div>
      <DiskGlyph cx={1815} cy={470} s={0.62} warn={near * 0.5} />
      <FootTag>{'文件工具有界 · bash 无框'}</FootTag>
    </AbsoluteFill>
  );
};

/** 人形剪影（暖色低饱和——左半把关人；raise 0..1 抬手拦下） */
const PersonGlyph: React.FC<{cx: number; cy: number; raise: number}> = ({cx, cy, raise}) => {
  const armA = -20 + 70 * raise; // 手臂自垂放抬到拦位
  return (
    <svg width={220} height={330} viewBox="-110 -165 220 330" style={{position: 'absolute', left: cx - 110, top: cy - 165, overflow: 'visible'}}>
      <g stroke={withAlpha(theme.core, 0.85)} strokeWidth={6} fill="none" strokeLinecap="round">
        {/* 头 */}
        <circle cx={0} cy={-120} r={34} />
        {/* 躯干 */}
        <line x1={0} y1={-84} x2={0} y2={30} />
        {/* 双腿（坐镇姿态） */}
        <line x1={0} y1={30} x2={-42} y2={140} />
        <line x1={0} y1={30} x2={46} y2={140} />
        {/* 拦手（右臂——抬向通道口） */}
        <line x1={0} y1={-64} x2={78 * Math.cos((armA * Math.PI) / 180)} y2={-64 + 78 * Math.sin((armA * Math.PI) / 180)} />
        {/* 另一臂 */}
        <line x1={0} y1={-64} x2={-60} y2={10} />
      </g>
    </svg>
  );
};

// ── 0-C 闸门之外特写：纸片被挡 + 金句空卡 + 三门轮廓 ───────────────────

const ZeroC: React.FC<{atPaper: number; atBlocked: number; atCard: number; atSolid: number; atThree: number; atEach: number}> = ({
  atPaper,
  atBlocked,
  atCard,
  atSolid,
  atThree,
  atEach,
}) => {
  const frame = useCurrentFrame();
  // 纸片：贴上模型侧 → 递向闸卡 → 被挡下滑落（管不了程序允许什么）
  const paperO = useProgress(atPaper, DUR.f3);
  const deliver = useProgress(atBlocked - DUR.f4, DUR.f4, 'decelerate');
  const drop = useProgress(atBlocked + DUR.f2, DUR.f5, 'accelerate');
  const paperX = 600 + 250 * deliver;
  const paperY = 520 + 190 * drop * drop;
  const paperO2 = 1 - useProgress(atBlocked + DUR.f4, DUR.f3);
  // 金句空卡：自暗处预亮浮起（0.12→0.4）→ 框线转实一拍
  const cardRise = useProgress(atCard, DUR.f5);
  const solid = useProgress(atSolid, DUR.f3);
  const solidFlash = useImpulse({at: atSolid, dur: DUR.f4, peak: 1});
  // 三门轮廓：闸卡后缘裂出列队 → 自左至右各微亮一次
  const threeO = useProgress(atThree, DUR.f4);
  const eachLit = [0, 1, 2].map((i) => clamp01(progress(frame, atEach + i * 6, DUR.f3)));
  return (
    <AbsoluteFill>
      {/* 模型侧（脑图标 + 铭牌） */}
      <div style={{position: 'absolute', left: 330, top: 520, display: 'flex', alignItems: 'center', gap: 20}}>
        <BrainGlyph color={theme.text} />
        <div>
          <div style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 600, color: theme.text}}>{'模型'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'model'}</div>
        </div>
      </div>
      {/* 提示词纸片（角标 prompt——递向闸卡被挡下滑落：管想做什么、管不了允许什么） */}
      <div style={{position: 'absolute', left: paperX, top: paperY, opacity: paperO * paperO2, transform: `rotate(${8 * drop}deg)`}}>
        <div
          style={{
            width: 190,
            height: 96,
            background: theme.panel,
            border: `2.5px solid ${theme.dim}`,
            borderRadius: 6,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: drop > 0.1 ? 'none' : `0 8px 18px ${withAlpha('#000000', 0.4)}`,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'prompt'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>{'想做什么'}</span>
        </div>
      </div>
      {/* 暗态闸卡（裁决紫描边轮廓——挡在纸片与通道口之间；0-C 主体） */}
      <GateCard x={1080} y={450} w={210} h={200} kind="deny" lit={0.3} ghost={0.3} showName={false} />
      <div style={{position: 'absolute', left: 1105, top: 670, fontFamily: theme.mono, fontSize: 18, color: theme.dim, opacity: 0.8}}>
        {'裁决位 · 不归提示词管'}
      </div>
      {/* 衬线金句空卡（侧上方位——预亮浮起、无字；落字留 5-A） */}
      <div
        style={{
          position: 'absolute',
          left: 430,
          top: 200 + (1 - cardRise) * 26,
          opacity: 0.14 + 0.3 * cardRise,
        }}
      >
        <div
          style={{
            width: 460,
            height: 170,
            borderRadius: 16,
            border: `2.5px ${solid > 0.5 ? 'solid' : 'dashed'} ${solid > 0.5 ? theme.text : withAlpha(theme.text, 0.55)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: solidFlash > 0.01 ? `0 0 ${28 * solidFlash}px ${withAlpha(theme.text, 0.4)}` : 'none',
          }}
        >
          {/* ⑨ QA N1：占位字不上屏（原「（立场卡）」直渲）——空白卡 +「…」呼吸
              提示（帧驱动正弦，落字留 5-A 的设计不变） */}
          <span
            style={{
              fontFamily: theme.serif,
              fontSize: 34,
              letterSpacing: 10,
              color: withAlpha(theme.text, 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(frame / 18))),
            }}
          >
            {'…'}
          </span>
        </div>
      </div>
      {/* 三门轮廓（闸卡后缘裂出列队——P1 预告；自左至右各微亮一次） */}
      <div style={{position: 'absolute', left: 1340, top: 210, opacity: threeO, display: 'flex', gap: 34}}>
        {[0, 1, 2].map((i) => (
          <svg key={i} width={66} height={80} viewBox="0 0 66 80" style={{overflow: 'visible'}}>
            <path
              d="M6 76 L6 30 Q6 6, 33 6 Q60 6, 60 30 L60 76"
              fill="none"
              stroke={eachLit[i] > 0.4 ? theme.mech : withAlpha(theme.mech, 0.4)}
              strokeWidth={3.5}
              opacity={0.45 + 0.55 * eachLit[i]}
            />
          </svg>
        ))}
      </div>
      <FootTag>{'提示词不在裁决链内'}</FootTag>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0ColdStop: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  // 词落位锚 = 句首 + 句长比例（口播无词级时间戳，比例即词窗；TTS 变更自动重定时）
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-02');
  const bB = w('p0-03', 'p0-04');
  const bC = w('p0-05', 'p0-07');

  return (
    <AbsoluteFill>
      <SourceCredit />
      <Sequence {...bA} name="0-A">
        <ZeroA
          atRush={wa('p0-01', 0.3) - bA.from}
          atHand={wa('p0-01', 0.62) - bA.from}
          atGate={wa('p0-02', 0.35) - bA.from}
          atFlash={wa('p0-02', 0.78) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atHandL={wa('p0-03', 0.18) - bB.from}
          atCross={wa('p0-03', 0.5) - bB.from}
          atBound={wa('p0-04', 0.22) - bB.from}
          atOpen={wa('p0-04', 0.5) - bB.from}
          atNear={wa('p0-04', 0.78) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atPaper={wa('p0-05', 0.2) - bC.from}
          atBlocked={wa('p0-05', 0.62) - bC.from}
          atCard={wa('p0-06', 0.28) - bC.from}
          atSolid={wa('p0-06', 0.72) - bC.from}
          atThree={wa('p0-07', 0.35) - bC.from}
          atEach={wa('p0-07', 0.7) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0ColdStop;
