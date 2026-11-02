/** P4 隔离的边界（p4-01..p4-13，6 镜）——分镜 4-A..4-F。
 *
 *  叙事链：4-A 全景拉开降压重锚（@pushIn 负增量 + 墙体放大居中——wallW 200→560
 *  连续生长）：墙体内嵌白板自 3-C 暗纹转实亮出（WORKDIR 角标）；「消息」签
 *  高亮、「不是进程，也不是文件系统」另两签各打一叉（否定列举的可视裁决）
 *  → 4-B 白板特写（同一工作目录）：紫笔迹文件小卡 + 命令痕迹条同板共存、
 *  主会场视野圈（钢蓝）罩全板；「丢弃的是对话」对话气泡逐一淡出（承 2-C 清空
 *  同形）vs「不是工作成果」白板文件卡保持在场不动——同帧对照 → 4-C 权限门
 *  （子代理工具通路中段检查点，承 ep3 三闸门形态回扣）：「删光整盘」命令卡
 *  行至门前被拦（红×）、拒绝条弹回（deny list · Permission denied）、下一动作
 *  读文件顺利过门（绿边过痕）；「不等于权限豁免」门体常驻标记定格（门不随
 *  隔离消失）→ 4-D 官方数字线（模型计字的单位）：指针爬升越过「一万五」红色
 *  阈值格、告警铃亮起（数值钳制禁过冲——终位刚过阈即停；定格静持 ≥10 帧）
 *  → 4-E 真实版对照引入：教学版装置淡出 / 真实版终端剪影淡入（无手绘剖面感）；
 *  「不建全新对话」两枚对话列并列亮起（悬念位）；归属句期间剪影静持、放大镜
 *  小签点在剪影上 → 4-F 收尾三联：①两列对话前缀逐字节对齐（绿点逐格点亮、
 *  机器节奏，角标 Fork）+ 缓存命中标记落下 + 费用小卡变薄一闪；②隔离/效率
 *  双签天平式并置一拍 + 权限弹窗沿「冒泡」轨迹上升回用户终端；③真实版剪影
 *  收拢退为背景、教学版装置全图重入定格（各装置层依次归位点亮）+ 知识文档
 *  堆剪影自画外压来半拍（P5 伏笔）。
 *
 *  空间契约：三签横排同距、否定叉仅两枚、白板居两室正中、视野圈罩全板、拦截
 *  与放行同门同位、一万五阈值为唯一红格、指针未触线告警不响（因果次序）、
 *  换层前后各 ≥15 帧稳态、剪影无信源标识、绿点逐格可数、弹窗轨迹单向向上、
 *  文档堆只压半拍留给 P5。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；PreToolUse / deny list /
 *  Permission denied / WORKDIR / Fork / prompt cache / 15,000 tokens 只进角标。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {DocStack, MeetingRooms, PrefixAlign, RoomMessageList, WhiteboardWall, PermissionGate, useRingDot} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 4-A 全景拉开：墙体放大居中 + 三签裁决 + 白板转实 ────────────────────

const FourA: React.FC<{atPull: number; atMsg: number; atCrossP: number; atCrossF: number; atBoard: number}> = ({
  atPull,
  atMsg,
  atCrossP,
  atCrossF,
  atBoard,
}) => {
  // @pushIn 负增量（设问起拉远降压、装置全景重锚）
  const pull = usePushIn(atPull, {scale: -0.06, dur: DUR.f6 + DUR.f4});
  // 墙体放大居中（wallW 200→560 连续生长——两室方位不动）
  const wallGrow = useProgress(atPull + DUR.f4, DUR.f6 + DUR.f4, 'decelerate');
  const wallW = 200 + 360 * wallGrow;
  // 三签裁决：「消息」高亮；「进程」「文件系统」各打一叉（否定叉仅两枚）
  const msgLit = useProgress(atMsg, DUR.f4);
  const crossP = useProgress(atCrossP, DUR.f4);
  const crossF = useProgress(atCrossF, DUR.f4);
  // 白板转实亮出（自 3-C 暗纹承袭——问号随之隐没）
  const board = useProgress(atBoard, DUR.f6, 'decelerate');
  const signs = [
    {zh: '消息', en: 'messages', lit: msgLit, cross: 0},
    {zh: '进程', en: 'process', lit: 1, cross: crossP},
    {zh: '文件系统', en: 'filesystem', lit: 1, cross: crossF},
  ];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: pull, transformOrigin: '50% 52%'}}>
        {/* 三枚概念签横排待命（否定列举的可视裁决） */}
        <div style={{position: 'absolute', left: 0, top: 96, width: 1920, display: 'flex', justifyContent: 'center', gap: 44}}>
          {signs.map((s) => (
            <div
              key={s.zh}
              style={{
                position: 'relative',
                width: 260,
                boxSizing: 'border-box',
                borderRadius: 10,
                border: `2.5px solid ${s.lit > 0.5 && s.cross < 0.5 ? theme.steel : theme.panelBorder}`,
                background: s.lit > 0.5 && s.cross < 0.5 ? withAlpha(theme.steel, 0.12) : theme.panel,
                padding: '12px 0',
                textAlign: 'center',
                boxShadow: s.lit > 0.5 && s.cross < 0.5 ? `0 0 ${18 * msgLit}px ${withAlpha(theme.steel, 0.45)}` : 'none',
              }}
            >
              <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: s.cross > 0.5 ? theme.dim : theme.text}}>{s.zh}</div>
              <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 4}}>{s.en}</div>
              {/* 否定叉（仅进程/文件系统两枚——逆旁白禁打在消息签） */}
              {s.cross > 0.05 ? (
                <svg width={244} height={72} viewBox="0 0 244 72" style={{position: 'absolute', left: 6, top: 0, opacity: s.cross}}>
                  <line x1={16} y1={12} x2={228} y2={60} stroke={theme.danger} strokeWidth={5} strokeLinecap="round" />
                  <line x1={228} y1={12} x2={16} y2={60} stroke={theme.danger} strokeWidth={5} strokeLinecap="round" />
                </svg>
              ) : null}
            </div>
          ))}
        </div>
        {/* 剖面（墙体放大居中——白板转实、问号隐没） */}
        <MeetingRooms
          x={280}
          y={250}
          w={1360}
          h={540}
          leftBars={4}
          counterVal={4}
          roomBars={0}
          ringLit={0}
          wallW={wallW}
          wallQ={0.9 * (1 - board)}
          wallBoard={0.18 + 0.82 * board}
          rightOpen={1}
        />
        {/* WORKDIR 角标注（贴板角——由 WhiteboardWall 大特写承续） */}
        <div style={{position: 'absolute', left: 930, top: 560, fontFamily: theme.mono, fontSize: 14, color: theme.dim, opacity: board}}>
          {'WORKDIR · 同一块白板'}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'隔离的是消息 · 不是别的'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 白板特写：同板共存 + 视野圈 + 对话消散/成果留存同帧对照 ──────────

const FourB: React.FC<{atMarks: number; atVision: number; atFade: number; atStay: number}> = ({atMarks, atVision, atFade, atStay}) => {
  // 紫笔迹显现在白板上（两室笔迹同板共存——「同一个工作目录」）
  const marks = useProgress(atMarks, DUR.f5);
  const marksCmd = useProgress(atMarks + DUR.f4, DUR.f5);
  // 主会场视野圈同步罩板（钢蓝——主代理看得见）
  const vision = useProgress(atVision, DUR.f5);
  // 「丢弃的是对话」气泡逐一淡出（承 2-C 清空同形——逐条淡出）
  const fade = useProgress(atFade, DUR.f5);
  // 「不是工作成果」白板文件卡保持在场不动（同帧对照强调脉冲）
  const stay = useImpulse({at: atStay, dur: DUR.f6, peak: 1});
  return (
    <AbsoluteFill>
      {/* 白板（同一工作目录——主角件） */}
      <WhiteboardWall x={170} y={170} w={980} h={600} lit={1} board={1} marks={marks} marksCmd={marksCmd} vision={vision} workdir={vision} />
      {/* 板上「成果留存」强调框（同帧对照——文件卡不动，框闪一拍） */}
      {stay > 0.03 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <rect
            x={226}
            y={252}
            width={460}
            height={86}
            rx={10}
            fill="none"
            stroke={theme.ok}
            strokeWidth={3}
            opacity={0.8 * stay}
          />
        </svg>
      ) : null}
      {/* 紫室对话（右侧缩微——逐一淡出=丢弃的是对话；承 2-C 清空同形） */}
      <div style={{position: 'absolute', left: 1220, top: 190}}>
        <RoomMessageList x={0} y={0} w={560} h={560} lit={1} tagLit={1} descLit={0} msgs={12 * (1 - fade)} counter={12 * (1 - fade)} clear={fade} />
      </div>
      <div style={{position: 'absolute', left: 1220, top: 800, fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: fade}}>
        {'对话 · 丢弃'}
      </div>
      <div style={{position: 'absolute', left: 170, top: 800, fontFamily: theme.mono, fontSize: 15, color: theme.ok, opacity: stay}}>
        {'成果 · 留存'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'同一个工作目录'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 权限门：拦截 + 拒绝条 + 过痕 + 常驻标记 ──────────────────────────

const FourC: React.FC<{atGate: number; atCard: number; atBlock: number; atReject: number; atPass: number; atMark: number}> = ({
  atGate,
  atCard,
  atBlock,
  atReject,
  atPass,
  atMark,
}) => {
  // 检查点门体亮起（PreToolUse）
  const gate = useProgress(atGate, DUR.f5);
  // 命令卡行至门前（暗红预览——行进到门前即停，禁绕门）
  const card = useProgress(atCard, DUR.f5, 'decelerate');
  // 「被拦下」红×亮起卡停
  const block = useProgress(atBlock, DUR.f4);
  // 「吃张拒绝条」弹回
  const reject = useProgress(atReject, DUR.f5, 'decelerate');
  // 「接着干活」下一动作卡顺利过门（绿边过痕——同门同位两种裁决）
  const pass = useProgress(atPass, DUR.f6, 'linear');
  // 「不等于权限豁免」门体常驻标记定格（显式锁存——触发过即保持）
  const mark = useProgress(atMark, DUR.f5);
  return (
    <AbsoluteFill>
      <PermissionGate x={410} y={240} w={1100} lit={1} gateLit={gate} cardP={card} blocked={block} reject={reject} pass={pass} mark={mark} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'每次用工具 · 照样过检查点'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D 官方数字线：15,000 阈值 + 指针触线告警 ───────────────────────────

const FourD: React.FC<{atClimb: number; atCross: number; atBell: number}> = ({atClimb, atCross, atBell}) => {
  const frame = useCurrentFrame();
  // 指针爬升（数值元素钳制禁过冲——终位刚过阈即停：15200/15000 ≈ 1.013 格外半格）
  const climb = clamp01(progress(frame, atClimb, DUR.f6 + DUR.f5));
  const pointerX = 260 + 1220 * climb * (15200 / 15500);
  // 触线刻（越线一拍——先触线后告警，因果次序）
  const cross = useImpulse({at: atCross, dur: DUR.f4, peak: 1});
  // 「启动就告警」告警铃亮起 + 阈值格泛红一拍（显式锁存——响过保持亮）
  const bell = useProgress(atBell, DUR.f4);
  // 定格静持 ≥10 帧再切（A-16）——atBell + DUR.f4 后本 Sequence 自然静持至 beat 尾
  const ticks = [0, 3000, 6000, 9000, 12000, 15000];
  return (
    <AbsoluteFill>
      {/* 横向刻度线（模型计字的单位——15,000 为唯一红格） */}
      <svg width={1920} height={360} viewBox="0 0 1920 360" style={{position: 'absolute', left: 0, top: 380}}>
        <line x1={260} y1={200} x2={1560} y2={200} stroke={withAlpha(theme.dim, 0.7)} strokeWidth={3} />
        {ticks.map((t) => {
          const x = 260 + (1220 * t) / 15500;
          const isRed = t === 15000;
          return (
            <g key={t}>
              <line x1={x} y1={isRed ? 176 : 184} x2={x} y2={isRed ? 224 : 216} stroke={isRed ? theme.danger : withAlpha(theme.dim, 0.7)} strokeWidth={isRed ? 4 : 2.5} />
              <text x={x} y={252} textAnchor="middle" fontFamily={theme.mono} fontSize={17} fill={isRed ? theme.danger : theme.dim} style={{fontVariantNumeric: 'tabular-nums'}}>
                {t.toLocaleString('en-US')}
              </text>
            </g>
          );
        })}
        {/* 一万五阈值格（唯一红格——指针终位刚过阈即停） */}
        <rect x={260 + (1220 * 15000) / 15500} y={188} width={(1220 * 500) / 15500} height={24} rx={4} fill={withAlpha(theme.danger, 0.16 + 0.2 * bell)} stroke={theme.danger} strokeWidth={2} />
        {/* 指针（自左向右爬升——数据本体） */}
        <g transform={`translate(${pointerX} 0)`}>
          <line x1={0} y1={150} x2={0} y2={216} stroke={theme.text} strokeWidth={4} strokeLinecap="round" />
          <polygon points="0,142 -9,158 9,158" fill={theme.text} />
        </g>
        {/* 触线脉冲（越线一拍） */}
        {cross > 0.03 ? <circle cx={260 + (1220 * 15000) / 15500} cy={200} r={18 + 26 * cross} fill="none" stroke={theme.danger} strokeWidth={3} opacity={0.8 * cross} /> : null}
      </svg>
      {/* 告警铃（启动就告警——响过保持亮） */}
      <div style={{position: 'absolute', left: 1620, top: 300, opacity: bell}}>
        <svg width={72} height={72} viewBox="0 0 72 72">
          <path d="M 36 12 Q 52 12 54 32 L 58 46 L 14 46 L 18 32 Q 20 12 36 12 Z" fill={withAlpha(theme.danger, 0.2)} stroke={theme.danger} strokeWidth={3.5} strokeLinejoin="round" />
          <line x1={36} y1={8} x2={36} y2={14} stroke={theme.danger} strokeWidth={3.5} strokeLinecap="round" />
          <circle cx={36} cy={54} r={4} fill={theme.danger} />
        </svg>
        {bell > 0.6 ? (
          <div style={{position: 'absolute', left: -10, top: 74, fontFamily: theme.mono, fontSize: 15, color: theme.danger, whiteSpace: 'nowrap'}}>
            {'15,000 tokens'}
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 260, top: 300, fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>
        {'自建子代理 · 描述合计'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'官方红线 · 超一万五即告警'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-E 真实版对照引入：教学版淡出 / 剪影淡入 ────────────────────────────

const FourE: React.FC<{atCross: number; atCols: number}> = ({atCross, atCols}) => {
  const frame = useCurrentFrame();
  // 换层交叉一拍（教学版→真实版——前后各 ≥15 帧稳态：教学版承接 4-D 末态缩影）
  const swap = useProgress(atCross, DUR.f6);
  // 两枚对话列并列亮起（「不建全新对话」悬念位——其中一列非全新）
  const cols = [clamp01(progress(frame, atCols, DUR.f4)), clamp01(progress(frame, atCols + DUR.f4, DUR.f4))];
  // 剪影条（更密实的终端对话流——灰阶剪影、无信源标识）
  const SIL = ['v1', '>', 'v2', '>', 'v3', '>', 'v4', '>', 'v5', '>', 'v6', '>', 'v7'];
  return (
    <AbsoluteFill>
      {/* 教学版装置缩影（淡出层） */}
      <div style={{position: 'absolute', left: 480, top: 240, opacity: 1 - swap, transform: `scale(${1 - 0.12 * swap})`}}>
        <MeetingRooms x={0} y={0} w={960} h={380} leftBars={4} counterVal={4} roomBars={0} ringLit={0} />
      </div>
      {/* 真实版终端剪影（淡入层——一列更密实的对话流） */}
      <div style={{position: 'absolute', left: 520, top: 150, opacity: swap}}>
        <div
          style={{
            width: 880,
            height: 640,
            boxSizing: 'border-box',
            borderRadius: 14,
            border: `2.5px solid ${withAlpha(theme.dim, 0.55)}`,
            background: withAlpha(theme.panel, 0.85),
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{padding: '12px 18px', fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'terminal'}</div>
          {SIL.map((s, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 20 + (i % 3) * 12,
                top: 52 + i * 42,
                width: 820 - ((i * 53) % 200),
                height: 30,
                borderRadius: 6,
                background: withAlpha(theme.dim, 0.16 + 0.08 * (i % 2)),
              }}
            />
          ))}
          {/* 两枚对话列并列亮起（非全新的一列=悬念位） */}
          {[0, 1].map((k) => (
            <div
              key={k}
              style={{
                position: 'absolute',
                left: 70 + k * 420,
                top: 90,
                width: 340,
                height: 470,
                boxSizing: 'border-box',
                borderRadius: 10,
                border: `2.5px solid ${cols[k] > 0.5 ? (k === 0 ? theme.steel : theme.mech) : theme.panelBorder}`,
                opacity: cols[k],
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                paddingTop: 8,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>
                {k === 0 ? '主对话' : '有一种跑法'}
              </span>
            </div>
          ))}
        </div>
        {/* 放大镜小签（归属拍点在剪影上——静置不抢焦） */}
        <div style={{position: 'absolute', left: 920, top: 560, opacity: cols[1]}}>
          <svg width={46} height={46} viewBox="0 0 46 46">
            <circle cx={19} cy={19} r={12} fill="none" stroke={theme.text} strokeWidth={3.5} />
            <line x1={28} y1={28} x2={40} y2={40} stroke={theme.text} strokeWidth={4} strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'真实版 · 换层'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-F 收尾三联：前缀对齐 + 权衡 + 全图定格与文档堆压来 ────────────────

const FourF: React.FC<{atDots: number; atHit: number; atBalance: number; atPopup: number; atFreeze: number; atPress: number}> = ({
  atDots,
  atHit,
  atBalance,
  atPopup,
  atFreeze,
  atPress,
}) => {
  const frame = useCurrentFrame();
  // ① 绿点逐格点亮（逐格可数——每格一拍、机器节奏）
  const dots = clamp01(progress(frame, atDots, 8 * 5));
  // 「命中缓存」命中标记落下 + 费用小卡变薄一闪
  const hit = useProgress(atHit, DUR.f5);
  const cost = useProgress(atHit + DUR.f4, DUR.f5);
  // ② 隔离/效率双签天平式并置一拍
  const balance = useProgress(atBalance, DUR.f5);
  // 权限弹窗沿冒泡轨迹上升回终端（单向向上）
  const popup = useProgress(atPopup, DUR.f6, 'decelerate');
  // ③ 全图定格（各装置层依次归位点亮——真跑工况重锚）
  const freeze = useProgress(atFreeze, DUR.f6);
  const relight = [
    clamp01(progress(frame, atFreeze, DUR.f4)),
    clamp01(progress(frame, atFreeze + 5, DUR.f4)),
    clamp01(progress(frame, atFreeze + 10, DUR.f4)),
    clamp01(progress(frame, atFreeze + 15, DUR.f4)),
  ];
  // 舞台交叉（①②→③——真图定格接管；剪影收拢退为背景）
  const swapF = useProgress(atFreeze - DUR.f5, DUR.f5);
  const dot = useRingDot(2.5);
  // 知识文档堆自画外压来半拍（P5 伏笔——只压半拍）
  const press = useProgress(atPress, DUR.f5, 'accelerate') * 0.55;
  return (
    <AbsoluteFill>
      {/* 舞台 ①②：前缀对齐 + 命中 + 权衡 + 冒泡 */}
      <div style={{position: 'absolute', inset: 0, opacity: 1 - swapF}}>
        <PrefixAlign x={150} y={150} w={860} lit={1} dots={dots} hit={hit} cost={cost} popup={popup} />
        {/* 隔离/效率双签（天平式并置一拍——一对真实的权衡） */}
        <div style={{position: 'absolute', left: 1180, top: 200, opacity: balance}}>
          <svg width={480} height={120} viewBox="0 0 480 120">
            <line x1={60} y1={30} x2={420} y2={30} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
            <circle cx={240} cy={30} r={8} fill={theme.text} />
            <line x1={240} y1={38} x2={240} y2={88} stroke={withAlpha(theme.dim, 0.7)} strokeWidth={4} />
            <line x1={190} y1={90} x2={290} y2={90} stroke={withAlpha(theme.dim, 0.7)} strokeWidth={4} strokeLinecap="round" />
            <text x={60} y={16} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fontWeight={700} fill={theme.mech}>
              {'隔离'}
            </text>
            <text x={420} y={16} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fontWeight={700} fill={theme.steel}>
              {'效率'}
            </text>
          </svg>
        </div>
      </div>
      {/* 舞台 ③：全图定格（教学版装置全图重入——各装置层依次归位点亮） */}
      <div style={{position: 'absolute', inset: 0, opacity: swapF}}>
        <MeetingRooms
          x={250}
          y={230}
          w={1400}
          h={540}
          leftBars={4 * relight[0]}
          counterVal={4 * relight[3]}
          taskLit={relight[1]}
          roomBars={0}
          ringLit={relight[2]}
          ringDot={dot}
          branchLit={0.8 * relight[2]}
          channelFlow={relight[3] * 0.5}
        />
        {/* 知识文档堆剪影（自画外压来半拍——不压满，留给 P5） */}
        <DocStack x={1360} y={330} w={520} lit={freeze} press={press} grow={0.4} rows={2400 * press} overflow={0} cost={0.3} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'装置齐了 · 可干净就万事大吉？'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P4Boundary: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p4-01', 'p4-02');
  const bB = w('p4-03', 'p4-04');
  const bC = w('p4-05', 'p4-07');
  const bD = w('p4-08');
  const bE = w('p4-09', 'p4-10');
  const bF = w('p4-11', 'p4-13');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <FourA
          atPull={0}
          atMsg={wa('p4-01', 0.24) - bA.from}
          atCrossP={wa('p4-01', 0.5) - bA.from}
          atCrossF={wa('p4-01', 0.74) - bA.from}
          atBoard={wa('p4-02', 0.5) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FourB
          atMarks={wa('p4-03', 0.36) - bB.from}
          atVision={wa('p4-03', 0.72) - bB.from}
          atFade={wa('p4-04', 0.2) - bB.from}
          atStay={wa('p4-04', 0.62) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <FourC
          atGate={wa('p4-05', 0.6) - bC.from}
          atCard={wa('p4-06', 0.14) - bC.from}
          atBlock={wa('p4-06', 0.42) - bC.from}
          atReject={wa('p4-06', 0.58) - bC.from}
          atPass={wa('p4-06', 0.8) - bC.from}
          atMark={wa('p4-07', 0.5) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <FourD atClimb={wa('p4-08', 0.3) - bD.from} atCross={wa('p4-08', 0.54) - bD.from} atBell={wa('p4-08', 0.72) - bD.from} />
      </Sequence>
      <Sequence {...bE} name="4-E">
        <FourE atCross={wa('p4-09', 0.24) - bE.from} atCols={wa('p4-10', 0.66) - bE.from} />
      </Sequence>
      <Sequence {...bF} name="4-F">
        <FourF
          atDots={wa('p4-11', 0.16) - bF.from}
          atHit={wa('p4-11', 0.62) - bF.from}
          atBalance={wa('p4-12', 0.2) - bF.from}
          atPopup={wa('p4-12', 0.58) - bF.from}
          atFreeze={wa('p4-13', 0.14) - bF.from}
          atPress={wa('p4-13', 0.66) - bF.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4Boundary;
