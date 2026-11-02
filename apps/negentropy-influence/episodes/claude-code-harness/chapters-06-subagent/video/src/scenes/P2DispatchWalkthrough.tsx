/** P2 派一次活（p2-01..p2-09，4 镜）——分镜 2-A / 2-B / 2-C / 2-D。
 *
 *  叙事链：2-A 走查舞台全景（每幕首镜全景坐标锚）：两室剖面同位在场 + 环体缩悬
 *  支线微光；「你说」指令气泡携关键词签落下（「找测试框架」——关键词化不复述
 *  全句）；「六份代码文件」目录树六签 stagger 亮出；「直接派活」主会场工具表
 *  task 卡弹出、描述卡沿上方弧线飞入新会议室（派活不走回流通道——通道单向
 *  右→左，红线）；其余五件工具卡保持暗态（不动手的具象）→ 2-B 紫室内部特写
 *  （承 1-B 机位）：六签按目录树次序逐个点亮飞入（每签一趟读取脉冲）、消息条
 *  逐条堆高（读文件结果条 ×6 与轮转条交错、计数递增）、结论卡成形（角标
 *  pytest）；切主会场侧：只落两条新消息（派活记录 + 结论，确认绿各一闪）、
 *  计数角标 +2 定格 → 2-C 清空重音镜：十五条消息条满幅（计数定格 15 先亮）
 *  → 整层集体淡出归零（空态三现之三，与 1-B/1-D 末态同形）；淡出后静持 ≥10
 *  帧再切 → 2-D 三栏数字对比全景（装置退场一拍）：派活 4 条/147 字符（钢蓝，
 *  增长条最短+精确值旁标）/ 亲自动手 14 条/2626 字符（灰，攀升至满幅+微缩阵列
 *  铺一拍）/ 子代理内部 15 条/2617 字符（紫，自生自灭小签）；底部共用基线
 *  标尺；「拆了规矩」左栏回流通道小图标闪示一拍（P3 主角预显，钩子）。
 *
 *  空间契约：六文件签 a–f 全程同形同色可追、读取次序=目录树次序、主会场工具
 *  卡走查期保持暗态、主会场增量恰两条、结论卡单张、增长条高度比=真实字符比
 *  （147:2626:2617 数据本体禁过冲）、右栏不计入主对话账。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；task(description=…) /
 *  tool_result / pytest 只进角标。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BaselineBars, ConclusionCard, MeetingRooms, RoomMessageList, TaskCard, useRingDot} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 剖面全局位（承 P1——跨幕同方位同形重入，镜间身份恒常） */
const STAGE = {x: 230, y: 210, w: 1460, h: 560} as const;

/** 目录树六签（a–f 全程同形同色可追） */
const FILES = ['a.py', 'b.py', 'c.py', 'd.py', 'e.py', 'f.py'] as const;

/** 目录树（主会场外侧——六签纵列） */
const FileTree: React.FC<{x: number; y: number; lit: readonly number[]; readPulse?: readonly number[]}> = ({x, y, lit, readPulse = []}) => (
  <div style={{position: 'absolute', left: x, top: y}}>
    <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginBottom: 10}}>{'目录 · 6 files'}</div>
    <div style={{position: 'relative', width: 150}}>
      {FILES.map((f, i) => {
        const p = clamp01(lit[i] ?? 0);
        const pulse = clamp01(readPulse[i] ?? 0);
        return (
          <div
            key={f}
            style={{
              position: 'absolute',
              left: (i % 2) * 14,
              top: i * 56,
              padding: '7px 13px',
              borderRadius: 7,
              border: `2px solid ${p > 0.5 ? withAlpha(theme.tool, 0.85) : theme.panelBorder}`,
              background: p > 0.5 ? withAlpha(theme.tool, 0.08 + 0.14 * pulse) : 'transparent',
              fontFamily: theme.mono,
              fontSize: 17,
              color: p > 0.5 ? theme.text : theme.dim,
              whiteSpace: 'nowrap',
              opacity: 0.4 + 0.6 * p,
              boxShadow: pulse > 0.3 ? `0 0 ${14 * pulse}px ${withAlpha(theme.tool, 0.5)}` : 'none',
            }}
          >
            {f}
          </div>
        );
      })}
    </div>
  </div>
);

// ── 2-A 走查舞台：指令气泡 + 目录树 + 派活飞行 ──────────────────────────

const TwoA: React.FC<{atCmd: number; atTree: number; atTask: number; atFly: number; atLand: number}> = ({
  atCmd,
  atTree,
  atTask,
  atFly,
  atLand,
}) => {
  const frame = useCurrentFrame();
  // 指令气泡落下（「你说」——携关键词签「找测试框架」）
  const cmd = useProgress(atCmd, DUR.f5, 'decelerate');
  // 目录树六签 stagger 亮出
  const tree = [0, 1, 2, 3, 4, 5].map((i) => clamp01(progress(frame, atTree + i * 4, DUR.f4)));
  // task 卡弹出（显式锁存——亮过即保持）+ 描述卡起飞（派活弧线：工具表 → 越墙 →
  // 紫室列表首格——不走回流通道；通道单向右→左，派活走上方弧线）
  const taskIn = useProgress(atTask, DUR.f4);
  const pop = useImpulse({at: atTask + 2, dur: DUR.f5, peak: 1});
  const fly = useProgress(atFly, DUR.f6, 'decelerate');
  const land = useProgress(atLand, DUR.f4);
  // 弧线插值（左→右上方越墙——二次曲线确定性插值；弧顶抬到缩悬环体上缘之上，
  // 轨迹避主体：环体锚位在主会场右上角，150px 峰高会贴环掠过）
  const sx = STAGE.x + 96;
  const sy = STAGE.y + 320;
  const ex = STAGE.x + STAGE.w * 0.78;
  const ey = STAGE.y + 74;
  const fx = sx + (ex - sx) * fly;
  const fy = sy + (ey - sy) * fly - 240 * Math.sin(Math.PI * fly);
  const dot = useRingDot(2.5);
  return (
    <AbsoluteFill>
      <MeetingRooms
        x={STAGE.x}
        y={STAGE.y}
        w={STAGE.w}
        h={STAGE.h}
        rightOpen={1}
        leftBars={4}
        counterVal={4}
        toolsFive={[0.35, 0.35, 0.35, 0.35, 0.35]}
        taskLit={taskIn}
        roomDesc={land}
        ringLit={1}
        ringDot={dot}
        branchLit={0.35}
      />
      {/* 指令气泡（顶部落下——关键词签化） */}
      <div style={{position: 'absolute', left: 640, top: 62 + 26 * (1 - cmd), opacity: cmd}}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 22px',
            borderRadius: 12,
            border: `2.5px solid ${withAlpha(theme.text, 0.8)}`,
            background: theme.panel,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'user'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>{'找测试框架'}</span>
        </div>
      </div>
      {/* 目录树（主会场外侧） */}
      <FileTree x={52} y={300} lit={tree} />
      {/* 描述卡飞行（task——派活弧线；落定后驻紫室列表首格由 roomDesc 承接） */}
      {fly > 0.01 && land < 0.99 ? (
        <div style={{position: 'absolute', left: fx, top: fy, opacity: 1 - land * 0.9}}>
          <TaskCard x={0} y={0} w={250} h={52} lit={1} pop={pop} text={'找测试框架'} sub={'task'} />
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'走查 · 不动手，直接派活'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 紫室实跑：六签读入 + 两条落账 ────────────────────────────────────

const TwoB: React.FC<{atRead: number; atConc: number; atTwo: number; atFlash: number}> = ({
  atRead,
  atConc,
  atTwo,
  atFlash,
}) => {
  const frame = useCurrentFrame();
  // 六签按目录树次序逐个点亮 + 每签一趟读取脉冲（读取次序=目录树次序）
  const read = [0, 1, 2, 3, 4, 5].map((i) => clamp01(progress(frame, atRead + i * 9, DUR.f4)));
  const pulse = [0, 1, 2, 3, 4, 5].map((i) => Math.sin(Math.PI * clamp01(progress(frame, atRead + i * 9 + 3, DUR.f5))));
  // 消息条逐条堆高（读文件结果条 ×6 与轮转条交错——12 条 + 收尾轮转至 15 前哨）
  const msgs = 12 * clamp01(progress(frame, atRead, 6 * 9 + DUR.f5));
  // 结论卡成形（「一句结论」——角标 pytest 贴卡角）
  const conc = useProgress(atConc, DUR.f5);
  const concFlash = useImpulse({at: atConc + DUR.f4, dur: DUR.f5, peak: 1});
  // 主会场侧：只落两条（「只多两条」——确认绿各一闪）+ 计数 +2 定格
  const two = useProgress(atTwo, DUR.f5);
  const twoFlash = useImpulse({at: atFlash, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      {/* 紫室内部（承 1-B 机位） */}
      <div style={{position: 'absolute', left: 150, top: 150}}>
        <RoomMessageList
          x={0}
          y={0}
          w={740}
          h={660}
          lit={1}
          tagLit={1}
          descLit={1}
          msgs={msgs}
          counter={msgs}
          counterFlash={concFlash}
        />
      </div>
      {/* 六签读入轨道（面板左缘——按次序点亮飞入） */}
      <div style={{position: 'absolute', left: 60, top: 250}}>
        <FileTree x={0} y={0} lit={read} readPulse={pulse} />
      </div>
      {/* 结论卡（成形——pytest 角标） */}
      <div style={{position: 'absolute', left: 960, top: 480, opacity: conc}}>
        <ConclusionCard x={0} y={0} w={420} h={64} lit={conc} flash={concFlash} text={'用 pytest'} tag={'pytest'} />
      </div>
      {/* 主会场侧面板（右侧切镜位——只多两条） */}
      <div style={{position: 'absolute', left: 1000, top: 150, opacity: two}}>
        <div
          style={{
            width: 800,
            height: 300,
            boxSizing: 'border-box',
            borderRadius: 14,
            border: `3px solid ${withAlpha(theme.steel, 0.85)}`,
            background: withAlpha(theme.panel, 0.92),
            position: 'relative',
            padding: 16,
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.steel}}>{'主对话 · messages'}</span>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 24,
                fontWeight: 700,
                color: theme.text,
                fontVariantNumeric: 'tabular-nums',
                textShadow: twoFlash > 0.05 ? `0 0 ${12 * twoFlash}px ${withAlpha(theme.ok, 0.9)}` : 'none',
              }}
            >
              {/* ⑨ QA N1：计数随 two 联动（+0 与两条并存的假读消除） */}
              {`+${Math.round(2 * two)}`}
            </span>
          </div>
          {/* 恰两条新消息（派活记录 + 结论——钢蓝、确认绿各一闪） */}
          {['派活记录', '结论'].map((lab, k) => (
            <div key={lab} style={{position: 'absolute', left: 16, top: 70 + k * 74, opacity: two}}>
              <div
                style={{
                  width: 768,
                  height: 58,
                  boxSizing: 'border-box',
                  borderRadius: 8,
                  border: `2.5px solid ${theme.steel}`,
                  background: withAlpha(theme.steel, 0.1 + 0.16 * twoFlash),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '0 18px',
                  boxShadow: twoFlash > 0.3 ? `0 0 ${14 * twoFlash}px ${withAlpha(theme.ok, 0.5)}` : 'none',
                }}
              >
                <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 600, color: theme.text}}>{lab}</span>
                <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.steel}}>{k === 0 ? 'task' : 'tool_result'}</span>
              </div>
            </div>
          ))}
          <div style={{position: 'absolute', left: 16, bottom: 12, fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>
            {'其余消息 · 一条不多'}
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'先账后清 · 下一拍清空'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-C 清空重音镜：十五条满幅 → 整层淡出（空态三现之三） ────────────────

const TwoC: React.FC<{atFreeze: number; atClear: number}> = ({atFreeze, atClear}) => {
  const frame = useCurrentFrame();
  // 计数先亮后清（先账后清的次序——基线锚定半拍）
  const freeze = useProgress(atFreeze, DUR.f4);
  const counterFlash = useImpulse({at: atFreeze, dur: DUR.f5, peak: 1});
  // 整层同步淡出（一条不留——同步非逐条）
  const clear = useProgress(atClear, DUR.f5);
  // 淡出后静持 ≥10 帧再切（A-16）——atClear + DUR.f5 后本 Sequence 自然静持
  const hold = clamp01(progress(frame, atClear + DUR.f5, 4));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 560, top: 150}}>
        <RoomMessageList
          x={0}
          y={0}
          w={800}
          h={660}
          lit={1}
          tagLit={1}
          descLit={1}
          msgs={15 * (1 - clear)}
          counter={15 * freeze * (1 - clear)}
          clear={clear}
          counterFlash={counterFlash}
        />
      </div>
      {/* 清空注（角标——清空语义同形复现） */}
      <div style={{position: 'absolute', left: 1420, top: 210, fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: freeze * (1 - clear)}}>
        {'15 条 · 全过程'}
      </div>
      <div style={{position: 'absolute', left: 1420, top: 250, fontFamily: theme.mono, fontSize: 15, color: theme.ok, opacity: clear}}>
        {'清空 · 一条不留'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.6 * hold}}>
        {'空态 · 与装配末态同形'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-D 三栏数字对比（装置退场一拍——数字舞台独立） ──────────────────────

const TwoD: React.FC<{atLeft: number; atMid: number; atAll: number; atArray: number; atHook: number}> = ({
  atLeft,
  atMid,
  atAll,
  atArray,
  atHook,
}) => {
  const frame = useCurrentFrame();
  // 三栏同底等距亮起（装置骨架先行）+ 左栏双计数落定
  const all = useProgress(atAll, DUR.f5);
  const leftP = useProgress(atLeft, DUR.f5);
  // 中栏攀升至满幅（真实比例 2626 顶格——过程全数落账的体量冲击）
  const midP = useProgress(atMid, DUR.f6 + DUR.f4, 'decelerate');
  // 「全数落账」微缩阵列铺一拍（14 条灰阶小条）
  const array = useImpulse({at: atArray, dur: DUR.f6 + DUR.f4, peak: 1});
  // 「拆了规矩」左栏回流通道小图标闪示一拍（P3 主角预显，钩子）
  const hook = useImpulse({at: atHook, dur: DUR.f6, peak: 1});
  const cols = [
    {tag: '派活', sub: 'task → 结论', count: 4, chars: 147, color: theme.steel, barP: leftP, valP: leftP},
    {tag: '亲自动手', sub: '直接干', count: 14, chars: 2626, color: theme.dim, barP: midP, valP: midP},
    {tag: '子代理内部', sub: 'isolated', count: 15, chars: 2617, color: theme.mech, barP: midP, valP: midP, note: '自生自灭'},
  ];
  return (
    <AbsoluteFill>
      <BaselineBars x={210} y={210} w={1500} h={430} lit={all} cols={cols} rulerLit={all} />
      {/* 「全数落账」微缩阵列（中栏旁——14 条灰阶小条铺一拍，重音镜） */}
      {array > 0.05 ? (
        <div style={{position: 'absolute', left: 730, top: 300, display: 'flex', flexDirection: 'column', gap: 5, opacity: array}}>
          {Array.from({length: 14}, (_, i) => (
            <div key={i} style={{width: 150 + ((i * 37) % 60), height: 9, borderRadius: 4, background: withAlpha(theme.dim, 0.42)}} />
          ))}
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'14 条 · 全数落账'}</span>
        </div>
      ) : null}
      {/* 回流通道小图标（左栏下——P3 主角预显，闪示一拍） */}
      {hook > 0.05 ? (
        <div
          style={{
            position: 'absolute',
            left: 320,
            top: 720,
            padding: '8px 16px',
            borderRadius: 9,
            border: `2.5px solid ${theme.steel}`,
            background: withAlpha(theme.steel, 0.1),
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            opacity: hook,
            boxShadow: `0 0 ${20 * hook}px ${withAlpha(theme.steel, 0.5)}`,
          }}
        >
          <svg width={54} height={18} viewBox="0 0 54 18">
            <line x1={50} y1={9} x2={8} y2={9} stroke={theme.steel} strokeWidth={3} strokeDasharray="6 5" />
            <path d="M 16 3 L 8 9 L 16 15" fill="none" stroke={theme.steel} strokeWidth={3} strokeLinecap="round" />
          </svg>
          <span style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>{'回流那步'}</span>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75 * all}}>
        {'实测 · 主对话账面'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2DispatchWalkthrough: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-03');
  const bB = w('p2-04', 'p2-05');
  const bC = w('p2-06');
  const bD = w('p2-07', 'p2-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <TwoA
          atCmd={wa('p2-01', 0.12) - bA.from}
          atTree={wa('p2-02', 0.1) - bA.from}
          atTask={wa('p2-02', 0.55) - bA.from}
          atFly={wa('p2-02', 0.62) - bA.from}
          atLand={wa('p2-03', 0.36) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB
          atRead={wa('p2-04', 0.22) - bB.from}
          atConc={wa('p2-04', 0.72) - bB.from}
          atTwo={wa('p2-05', 0.3) - bB.from}
          atFlash={wa('p2-05', 0.5) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC atFreeze={wa('p2-06', 0.14) - bC.from} atClear={wa('p2-06', 0.5) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="2-D">
        <TwoD
          atAll={wa('p2-07', 0.1) - bD.from}
          atLeft={wa('p2-07', 0.42) - bD.from}
          atMid={wa('p2-08', 0.2) - bD.from}
          atArray={wa('p2-08', 0.66) - bD.from}
          atHook={wa('p2-09', 0.3) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2DispatchWalkthrough;
