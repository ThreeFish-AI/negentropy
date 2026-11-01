/** P4 生产版：谁说了算（p4-01..p4-09，4 镜）——分镜 4-A / 4-B / 4-C / 4-D。
 *
 *  叙事链：4-A 开帧走查舞台余位一拍（坐标锚：登记表驻位＋环体缩悬照常转）→
 *  @pushIn 推近教学版后台轨：轨上安装命令卡继续爬行、轨侧超时计时器逼近上限
 *  → p4-01「最多只给两分钟」词落位计时器 120 上限刻度线亮出 → p4-02「撑不完」
 *  词落位计时器走到上限即断——任务卡被弹起、盖上警示红 Timeout 卡、「两分钟
 *  超时收场」词落位进度条在五分之一处（120/600 比例位）定格——双标尺对齐定格
 *  （重音镜），登记表驻位行状态灯随 Timeout 卡转警示红 → 4-B 上下双联「同一
 *  个两分钟」（等高裁决）：上联教学版 4-A 末帧复现（Timeout 警示红卡）→
 *  p4-03「留了后手」词落位下联舞台亮起、「自动转后台」词落位命令卡在超时线处
 *  折入后台轨（雾蓝点亮，转折动作可见）→ p4-04「错误上限」词落位上联竖线段
 *  点亮＋错误标注、「转后台的触发线」词落位下联同一竖线点亮＋触发标注——同一
 *  条线、两种命运（等高双联定格，重音镜）→ 4-C @pushIn 负增量拉远三层信息全
 *  景（降压重锚）：p4-05「真争议」词落位三列框架立起 → p4-06「意图」「线索」
 *  「实际耗时」三词各落位一列证据位点亮（stagger）→ p4-07「删掉了兜底」词落位
 *  背景关键词表被大叉划除、淡出、「只认明确决定」词落位列一参数位独亮一拍 →
 *  4-D 回闪与暗钩：p4-08「那六百秒」词落位 1-D 左轨 600 秒阻塞条同形复现（回
 *  闪，警示红）＋「代价」标注、条上数字 600 重跳一拍（重音镜）→ p4-09「保存」
 *  词落位「保存」小签浮起定格、「更深的误会」词落位问号随签一闪（暗钩交 P5，
 *  不展开机制）。
 *
 *  空间契约：计时器刻度 120 与口播「两分钟」一致、进度条停位与计时断点同帧
 *  对齐（1/5 比例可读）、Timeout 卡警示红、任务卡是断不是完；上下联等高同构
 *  （除结局外全同款）、120s 竖线贯通双联同刻度、上红下蓝分色语义（下联零错误
 *  帧、零绿元素——生产版转后台帧走雾蓝）；三列等距并立、每列一枚证据位（不
 *  展开细节）、关键词表打叉淡出不可复燃；回闪条与 1-D 左轨同形同刻度（同一
 *  实验同一数）、「保存」小签半透明不展开。
 *
 *  红线落实：词落位 = wa(id,f)（⑧ 轮按句内字位复核；拦截类 cue 前置词窗早段
 *    ——p4-04 双线点亮取词窗前沿〔QA 教训 35〕）；y≥56 / bottom≥176；
 *    Timeout (120s) · moved to the background · keyword matching ✗ ·
 *    0s → 600s 只进角标；600 重跳数字本体重跳非过冲位移。
 *
 *  承接登记：3-D→4-A SceneFade＋后台轨全局位重锚（Map-First 接管）——安装
 *    任务签（npm install · bg_0001）同形复用为限制演示对象（镜间身份恒常）。
 *    4-D→5-A SceneFade＋环体缩悬重锚（承 ep10 4-D→5-A 形态：环体以〔M-001〕
 *    同形签名回归，非 morph）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  BackgroundTrack,
  BlockingBar,
  LoopRing,
  RegistryTable,
  RingExecSeg,
  STAGE,
  TimeoutCard,
} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 教学版后台轨 + 计时器全局位（4-A 推近目标；4-B 上联复现同几何） */
const EDU = {trackX: 430, trackY: 560, trackW: 1060, timerX: 1560, timerY: 330} as const;

/** 超时计时器（120 秒上限——圆盘读数 + 上限刻度线；到点即断） */
const TimeoutDial: React.FC<{x: number; y: number; elapseP: number; limitP: number; brokeP: number}> = ({x, y, elapseP, limitP, brokeP}) => {
  const elapse = clamp01(elapseP);
  const limit = clamp01(limitP);
  const broke = clamp01(brokeP);
  const r = 86;
  const cx = r + 14;
  const cy = r + 14;
  const readout = Math.round(120 * elapse);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: r * 2 + 28, height: r * 2 + 28}}>
      <svg width={r * 2 + 28} height={r * 2 + 28} viewBox={`0 0 ${r * 2 + 28} ${r * 2 + 28}`} style={{overflow: 'visible'}}>
        {/* 表盘（刻度弧 + 已走弧——已走段随 elapse 增长） */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={withAlpha(theme.panelBorder, 1)} strokeWidth={9} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={broke > 0.4 ? theme.danger : withAlpha(theme.dim, 0.85)} strokeWidth={9} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - elapse} transform={`rotate(-90 ${cx} ${cy})`} />
        {/* 120 上限刻度线（limitP 亮出——最多只给两分钟） */}
        {limit > 0.02 ? (
          <line x1={cx + r - 14} y1={cy} x2={cx + r + 16} y2={cy} stroke={theme.danger} strokeWidth={5} strokeLinecap="round" opacity={limit} />
        ) : null}
        {/* 断点闪（brokeP——到点即断） */}
        {broke > 0.03 ? <circle cx={cx + r} cy={cy} r={12 + 10 * Math.sin(Math.PI * broke)} fill="none" stroke={theme.danger} strokeWidth={3} opacity={broke} /> : null}
      </svg>
      {/* 读数（mono tabular——120 上限） */}
      <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
        <span style={{fontFamily: theme.mono, fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: broke > 0.4 ? theme.danger : theme.text, whiteSpace: 'nowrap'}}>{`${readout} s`}</span>
        <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>{'上限 120 s'}</span>
      </div>
    </div>
  );
};

// ── 4-A 教学版超时：双标尺同框 + 到点即断 + Timeout 卡盖落 ───────────────────

const FourA: React.FC<{atZoom: number; atLimit: number; atBreak: number; atFreeze: number}> = ({atZoom, atLimit, atBreak, atFreeze}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // @pushIn 推近教学版后台轨（聚焦计时器——词锚动机 p4-01）
  const push = usePushIn(atZoom, {scale: 0.09, dur: DUR.f6});
  // p4-01「最多只给两分钟」：120 上限刻度线亮出
  const limit = clamp01(progress(frame, atLimit, 14));
  // 计时器逼近上限（elapse 沿句子推进到 1——数据本体线性）
  const elapse = clamp01(progress(frame, atZoom + 10, atBreak - atZoom - 6));
  // p4-02「撑不完」：到点即断——任务卡被弹起 + Timeout 卡盖落；登记表行灯转红
  const broke = clamp01(progress(frame, atBreak, 14));
  const bounce = Math.sin(Math.PI * clamp01(progress(frame, atBreak, 16)));
  // 「两分钟超时收场」：进度条在 1/5 处（120/600 比例位）定格——双标尺对齐定格
  // （十分钟安装走满两分钟 = 恰 20%：elapse 到 1 时 prog 恰落 1/5 刻度，冻结即对齐）
  const freeze = clamp01(progress(frame, atFreeze, 14));
  const prog = 0.05 + 0.15 * elapse;
  // 环体缩悬（走查舞台余位坐标锚——照常转）
  const dotPos = (frame / (fps * 2.5)) % 1;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '42% 55%'}}>
        {/* 走查舞台余位（坐标锚——登记表驻位 dimP + 环体缩悬照常转） */}
        <div style={{position: 'absolute', left: STAGE.ring.x, top: STAGE.ring.y, opacity: 0.55}}>
          <LoopRing size={STAGE.ring.size} nodes={[]} showExit={false} dotProgress={dotPos} />
          <RingExecSeg size={STAGE.ring.size} segP={1} freeP={1} />
        </div>
        {/* 登记表驻位（右上缩位——bg_0001 行状态灯随 Timeout 卡转警示红，末次实质出场） */}
        <RegistryTable x={1400} y={110} w={430} h={200} litP={0.85} rowP={1} state={broke > 0.5 ? 'timeout' : 'running'} dimP={0.22} mini />
        {/* 教学版后台轨（安装命令卡继续爬行——3-D 同签承接；断点后卡被弹起） */}
        <BackgroundTrack x={EDU.trackX} y={EDU.trackY} w={EDU.trackW} litP={1} cardT={0.5 - bounce * 0.02} progP={prog} flowT={frame / 40} flowP={broke > 0.4 ? 0 : 0.6} />
        {/* 「十分钟安装」进度条全程刻度（轨下标尺——十分钟 = 全程；断点停位 1/5） */}
        <div style={{position: 'absolute', left: EDU.trackX, top: EDU.trackY + 110, width: EDU.trackW, opacity: clamp01(progress(frame, atZoom + 14, DUR.f5))}}>
          <div style={{position: 'relative', height: 16, borderRadius: 5, border: `2px solid ${withAlpha(theme.dim, 0.55)}`, background: withAlpha(theme.panel, 0.9)}}>
            <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${prog * 100}%`, borderRadius: 4, background: broke > 0.4 ? withAlpha(theme.danger, 0.55) : withAlpha(theme.dim, 0.45)}} />
            {/* 1/5 比例位刻度（120/600——断点停位锚） */}
            <div style={{position: 'absolute', left: '20%', top: -8, bottom: -8, borderLeft: `3px solid ${broke > 0.3 ? theme.danger : withAlpha(theme.dim, 0.8)}`}} />
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 5, whiteSpace: 'nowrap'}}>
            <span>{'0'}</span>
            <span style={{color: broke > 0.3 ? theme.danger : theme.dim, fontWeight: 700}}>{'2 min（1/5）'}</span>
            <span>{'10 min 全程'}</span>
          </div>
        </div>
        {/* 超时计时器（轨右上侧——逼近上限 → 到点即断） */}
        <TimeoutDial x={EDU.timerX} y={EDU.timerY} elapseP={elapse} limitP={limit} brokeP={bounce} />
        {/* Timeout 卡（警示红——到点即断的具象：盖落在轨上任务卡上半） */}
        <TimeoutCard x={EDU.trackX + 420} y={EDU.trackY - 140 - bounce * 22} stampP={broke} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'Timeout (120s)'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 上下双联「同一个两分钟」：同一条竖线、两种命运（等高裁决） ───────────

/** 双联几何：上联教学版 / 下联生产版（等高同构）；120s 竖线 x 贯通 */
const PANES = {topY: 150, botY: 540, h: 330, lineX: 1320} as const;

/** 单联（等高同构——除结局外全同款：命令卡行 + 超时线位 + 主循环环体缩微） */
const Pane: React.FC<{
  y: number;
  label: string;
  litP: number;
  timeoutP: number;
  foldP: number;
  lineSegP: number;
  lineLabel: string;
  lineColor: string;
}> = ({y, label, litP, timeoutP, foldP, lineSegP, lineLabel, lineColor}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lit = clamp01(litP);
  const timeout = clamp01(timeoutP);
  const fold = clamp01(foldP);
  const seg = clamp01(lineSegP);
  // 主循环环体缩微：教学版断点后停转（冻结光点+压停）/ 生产版照常转（零绿元素）
  const dotPos = timeout > 0.5 ? 0.3 : (frame / (fps * 2.2)) % 1;
  return (
    <div style={{position: 'absolute', left: 260, top: y, width: 1460, height: PANES.h, opacity: lit, transform: `translateY(${(1 - lit) * 18}px)`}}>
      {/* 联标题签 */}
      <div style={{position: 'absolute', left: 0, top: 0, padding: '5px 18px', borderRadius: 8, border: `2.5px solid ${lineColor}`, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: lineColor, whiteSpace: 'nowrap'}}>
        {label}
      </div>
      {/* 时间轴行（命令卡沿轴运行至 120s 线位） */}
      <div style={{position: 'absolute', left: 30, top: 110, width: 1180, height: 3, background: withAlpha(theme.panelBorder, 1)}} />
      {/* 命令卡（npm install · bg_0001 同签——运行至 120s 线位；教学版到线弹起盖
          Timeout / 生产版到线折入后台轨） */}
      <div style={{position: 'absolute', left: 820, top: 70}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 16px',
            borderRadius: 9,
            border: `2.5px solid ${fold > 0.3 ? withAlpha(theme.mech, 0.9) : withAlpha(theme.panelBorder, 0.95)}`,
            background: withAlpha(theme.panel, 0.97),
            whiteSpace: 'nowrap',
            transform: fold > 0.02 ? `translate(${fold * 70}px, ${fold * 112}px)` : 'none',
            opacity: 1,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.text}}>{'npm install'}</span>
          <span style={{padding: '1px 7px', borderRadius: 5, border: `2px solid ${theme.mech}`, fontFamily: theme.mono, fontSize: 11, fontWeight: 700, color: theme.mech}}>{'bg_0001'}</span>
        </div>
        {/* 教学版结局：Timeout 警示红卡（上联专属——下联零错误帧；盖在卡上=到点即断） */}
        {timeout > 0.02 ? (
          <div style={{position: 'absolute', left: -10, top: -46 - timeout * 18}}>
            <TimeoutCard x={0} y={0} stampP={timeout} />
          </div>
        ) : null}
      </div>
      {/* 生产版结局：命令卡折入后台轨（下联专属——雾蓝点亮；上红下蓝分色语义） */}
      {fold > 0.02 ? (
        <div style={{position: 'absolute', left: 760, top: 185}}>
          <svg width={560} height={60} viewBox="0 0 560 60">
            <line x1={0} y1={40} x2={540} y2={40} stroke={withAlpha(theme.mech, 0.4 + 0.5 * fold)} strokeWidth={5} strokeLinecap="round" />
            <path d="M 20 6 L 20 40" fill="none" stroke={withAlpha(theme.mech, 0.85)} strokeWidth={3.5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - fold} />
            <path d="M 500 32 L 522 40 L 500 48" fill="none" stroke={withAlpha(theme.mech, 0.8)} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{position: 'absolute', left: 30 + fold * 360, top: -6, padding: '4px 12px', borderRadius: 7, border: `2.5px solid ${theme.mech}`, background: theme.panel, fontFamily: theme.mono, fontSize: 13, fontWeight: 700, color: theme.mech, whiteSpace: 'nowrap', opacity: fold}}>
            {'moved to the background'}
          </div>
        </div>
      ) : null}
      {/* 主循环环体缩微（同款——教学版断点后停转 / 生产版照常转；零绿元素） */}
      <div style={{position: 'absolute', left: 1240, top: 120, opacity: 0.8}}>
        <LoopRing size={120} nodes={[]} showExit={false} dotProgress={dotPos} />
        <RingExecSeg size={120} segP={1} freeP={timeout > 0.5 ? 0 : 1} pressP={timeout > 0.5 ? 1 : 0} />
      </div>
      {/* 竖线段标注（错误上限 / 转后台的触发线——联内右下，贴竖线内侧） */}
      {seg > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: PANES.lineX - 260 - 150,
            top: 250,
            padding: '4px 14px',
            borderRadius: 8,
            border: `2.5px solid ${lineColor}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 17,
            fontWeight: 700,
            color: lineColor,
            whiteSpace: 'nowrap',
            opacity: seg,
          }}
        >
          {lineLabel}
        </div>
      ) : null}
    </div>
  );
};

const FourB: React.FC<{atLower: number; atFold: number; atTopLine: number; atBotLine: number}> = ({atLower, atFold, atTopLine, atBotLine}) => {
  const frame = useCurrentFrame();
  // 上联（教学版 4-A 末帧复现——Timeout 警示红卡恒在）
  const topLit = clamp01(progress(frame, 2, DUR.f5));
  const timeoutP = clamp01(progress(frame, 2, 16));
  // p4-03「留了后手」：下联舞台亮起
  const lower = clamp01(progress(frame, atLower, 16));
  // 「自动转后台」：命令卡在超时线处折入后台轨（转折动作可见——雾蓝点亮）
  const fold = clamp01(progress(frame, atFold, 20));
  // p4-04「错误上限」上联竖线段点亮 /「转后台的触发线」下联同一竖线点亮
  const topLine = clamp01(progress(frame, atTopLine, 14));
  const botLine = clamp01(progress(frame, atBotLine, 14));
  return (
    <AbsoluteFill>
      {/* 120s 竖线（贯通双联同刻度——一条线、两种命运） */}
      <svg width={40} height={760} viewBox="0 0 40 760" style={{position: 'absolute', left: PANES.lineX - 20, top: 130}}>
        <line x1={20} y1={10} x2={20} y2={750} stroke={withAlpha(theme.dim, 0.55)} strokeWidth={3} strokeDasharray="12 9" />
        <line x1={20} y1={10} x2={20} y2={370} stroke={theme.danger} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - topLine} />
        <line x1={20} y1={390} x2={20} y2={750} stroke={theme.mech} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - botLine} />
      </svg>
      <Pane y={PANES.topY} label="教学版 · 超时收场" litP={topLit} timeoutP={timeoutP} foldP={0} lineSegP={topLine} lineLabel="错误上限" lineColor={theme.danger} />
      <Pane y={PANES.botY} label="生产版 · 留了后手" litP={lower} timeoutP={0} foldP={fold} lineSegP={botLine} lineLabel="转后台的触发线" lineColor={theme.mech} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'moved to the background · Timeout (120s)'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 三层信息全景（拉远降压）：三列并立 + 关键词表打叉淡出 ────────────────

/** 三列（模型/命令文本/系统——等距并立；每列一枚证据位不展开细节） */
const COLS_4C = [
  {k: '模型', v: '意图', hint: '参数位'},
  {k: '命令文本', v: '线索', hint: 'npm install · 命中位'},
  {k: '系统', v: '实际耗时', hint: '计时器 · 读数位'},
] as const;

const FourC: React.FC<{atCols: number; atEvidence: number[]; atCross: number; atCrossFade: number; atParamOnly: number}> = ({atCols, atEvidence, atCross, atCrossFade, atParamOnly}) => {
  const frame = useCurrentFrame();
  // @pushIn 负增量（拉远降压——争议起拉远、三层全景重锚）
  const pull = usePushIn(2, {scale: -0.06, dur: DUR.f6});
  // p4-05「真争议」：三列框架立起
  const cols = clamp01(progress(frame, atCols, 18));
  // p4-06 三列证据位点亮（stagger——意图/线索/实际耗时）
  const evPs = atEvidence.map((a) => clamp01(progress(frame, a, DUR.f4)));
  // p4-07「删掉了兜底」：背景关键词表被大叉划除、淡出（不可复燃）
  const cross = clamp01(progress(frame, atCross, 16));
  const crossFade = clamp01(progress(frame, atCrossFade, 18));
  // 「只认明确决定」：列一参数位独亮一拍（决定权收拢到模型侧）
  const paramOnly = Math.sin(Math.PI * clamp01(progress(frame, atParamOnly, 18)));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: pull, transformOrigin: '50% 50%'}}>
        {/* 背景：1-C 关键词表缩微复现（远处——被大叉划除后淡出） */}
        <div style={{position: 'absolute', left: 360, top: 96, width: 1200, opacity: (0.3 + 0.3 * cross) * (1 - crossFade)}}>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 12, padding: '14px 18px', borderRadius: 10, border: `2px dashed ${withAlpha(theme.dim, 0.5)}`}}>
            {['install', 'build', 'test', 'deploy', 'compile', 'docker build', 'pip install', 'pytest', 'make'].map((k) => (
              <span key={k} style={{fontFamily: theme.mono, fontSize: 15, color: withAlpha(theme.dim, 0.8), whiteSpace: 'nowrap'}}>
                {k}
              </span>
            ))}
          </div>
          {/* 大叉（划除——警示红） */}
          {cross > 0.02 ? (
            <svg width={1200} height={140} viewBox="0 0 1200 140" style={{position: 'absolute', inset: 0, opacity: cross}}>
              <line x1={40} y1={16} x2={1160} y2={124} stroke={theme.danger} strokeWidth={9} strokeLinecap="round" />
              <line x1={1160} y1={16} x2={40} y2={124} stroke={theme.danger} strokeWidth={9} strokeLinecap="round" />
            </svg>
          ) : null}
        </div>
        {/* 三列并立（列框 + 证据位——p4-06 stagger 点亮） */}
        {COLS_4C.map((col, i) => {
          const cx = 250 + i * 470;
          const ev = evPs[i];
          const solo = i === 0 ? paramOnly : 0;
          return (
            <div
              key={col.k}
              style={{
                position: 'absolute',
                left: cx,
                top: 300,
                width: 400,
                height: 380,
                borderRadius: 14,
                border: `3.5px solid ${ev > 0.35 ? withAlpha(theme.text, 0.7) : withAlpha(theme.panelBorder, 0.95)}`,
                background: withAlpha(theme.panel, 0.95),
                opacity: cols * (0.35 + 0.65 * ev),
                transform: `translateY(${(1 - cols) * 26}px)`,
                padding: '20px 24px',
                boxShadow: solo > 0.1 ? `0 0 ${20 * solo}px ${withAlpha(theme.text, 0.3)}` : 'none',
              }}
            >
              {/* 列头图标（意图 / 命令文本 / 计时器——等距同构） */}
              <svg width={54} height={54} viewBox="0 0 54 54">
                {i === 0 ? (
                  <g fill="none" stroke={withAlpha(theme.dim, 0.85)} strokeWidth={3}>
                    <rect x={8} y={10} width={38} height={34} rx={7} />
                    <path d="M 17 24 L 37 24 M 17 33 L 30 33" strokeLinecap="round" />
                  </g>
                ) : i === 1 ? (
                  <g fill="none" stroke={withAlpha(theme.dim, 0.85)} strokeWidth={3} strokeLinecap="round">
                    <path d="M 10 14 L 44 14 M 10 27 L 38 27 M 10 40 L 30 40" />
                  </g>
                ) : (
                  <g fill="none" stroke={withAlpha(theme.dim, 0.85)} strokeWidth={3}>
                    <circle cx={27} cy={27} r={18} />
                    <path d="M 27 15 L 27 27 L 36 33" strokeLinecap="round" />
                  </g>
                )}
              </svg>
              <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text, marginTop: 12, whiteSpace: 'nowrap'}}>{col.k}</div>
              {/* 证据位（每列一枚——不展开细节） */}
              <div
                style={{
                  marginTop: 18,
                  padding: '10px 16px',
                  borderRadius: 9,
                  border: `2.5px ${ev > 0.35 ? 'solid' : 'dashed'} ${ev > 0.35 ? theme.text : withAlpha(theme.dim, 0.55)}`,
                  background: ev > 0.35 ? withAlpha(theme.panel, 0.9) : 'transparent',
                  fontFamily: theme.sans,
                  fontSize: 20,
                  fontWeight: 700,
                  color: ev > 0.35 ? theme.text : theme.dim,
                  whiteSpace: 'nowrap',
                  boxShadow: solo > 0.1 ? `0 0 ${14 * solo}px ${withAlpha(theme.text, 0.35)}` : 'none',
                }}
              >
                {col.v}
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 12, whiteSpace: 'nowrap', opacity: ev}}>{col.hint}</div>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'keyword matching ✗ · should_run_background'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D 回闪与暗钩：600 秒阻塞条同形复现 + 「保存」小签浮起 ──────────────────

const FourD: React.FC<{atFlash: number; atSix: number; atSave: number; atQ: number}> = ({atFlash, atSix, atSave, atQ}) => {
  const frame = useCurrentFrame();
  // p4-08「代价」：1-D 左轨 600 秒阻塞条同形复现（回闪——同形同刻度）
  const flash = clamp01(progress(frame, atFlash, 18));
  // 「那六百秒」：条上数字 600 重跳一拍（重音镜——同源记忆锚点）
  const six = Math.sin(Math.PI * clamp01(progress(frame, atSix, 20)));
  // p4-09「保存」：小签浮起定格（半透明——更深误会的暗钩，不展开）
  const save = clamp01(progress(frame, atSave, 16));
  // 「更深的误会」：问号随签一闪
  const q = Math.sin(Math.PI * clamp01(progress(frame, atQ, 14)));
  return (
    <AbsoluteFill>
      {/* 「代价」标注（条上方） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.danger, opacity: flash, whiteSpace: 'nowrap'}}>
        {'代价'}
      </div>
      {/* 600 秒阻塞条（1-D 左轨同形复现——同刻度同读法） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 380, display: 'flex', justifyContent: 'center', opacity: flash}}>
        <BlockingBar x={0} y={0} w={860} fillP={1} value={600} tone="danger" litP={1} pulseP={six} />
      </div>
      {/* 「保存」小签（半透明浮起定格——不展开机制） */}
      {save > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 620,
            display: 'flex',
            justifyContent: 'center',
            opacity: save * 0.85,
            transform: `translateY(${(1 - save) * 20}px)`,
          }}
        >
          <div style={{position: 'relative'}}>
            <div style={{padding: '10px 34px', borderRadius: 10, border: `2.5px dashed ${withAlpha(theme.dim, 0.8)}`, fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.dim, letterSpacing: 6, whiteSpace: 'nowrap'}}>
              保存
            </div>
            {/* 问号随行（一闪——暗钩） */}
            <span style={{position: 'absolute', right: -44, top: 2, fontFamily: theme.serif, fontSize: 30, color: withAlpha(theme.danger, 0.85), opacity: q}}>？</span>
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'0s → 600s'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P4TwoMinutes: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p4-01', 'p4-02');
  const bB = w('p4-03', 'p4-04');
  const bC = w('p4-05', 'p4-07');
  const bD = w('p4-08', 'p4-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <FourA
          atZoom={wa('p4-01', 0.05) - bA.from}
          atLimit={wa('p4-01', 0.72) - bA.from}
          atBreak={wa('p4-02', 0.52) - bA.from}
          atFreeze={wa('p4-02', 0.7) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FourB
          atLower={wa('p4-03', 0.24) - bB.from}
          atFold={wa('p4-03', 0.74) - bB.from}
          atTopLine={wa('p4-04', 0.4) - bB.from}
          atBotLine={wa('p4-04', 0.85) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <FourC
          atCols={wa('p4-05', 0.68) - bC.from}
          atEvidence={[0.16, 0.55, 0.84].map((f) => wa('p4-06', f) - bC.from)}
          atCross={wa('p4-07', 0.24) - bC.from}
          atCrossFade={wa('p4-07', 0.42) - bC.from}
          atParamOnly={wa('p4-07', 0.8) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <FourD atFlash={wa('p4-08', 0.28) - bD.from} atSix={wa('p4-08', 0.82) - bD.from} atSave={wa('p4-09', 0.14) - bD.from} atQ={wa('p4-09', 0.72) - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4TwoMinutes;
