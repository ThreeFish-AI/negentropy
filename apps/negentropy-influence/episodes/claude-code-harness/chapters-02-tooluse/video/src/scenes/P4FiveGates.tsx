/** P4 生产版：五道关（p4-01..p4-09，4 镜）——分镜 4-A / 4-B / 4-C / 4-D。
 *
 *  叙事链：拉远全景重锚（自 P3 峰值降压：左「工具调用」入口 → 中五道关门卡
 *  位 → 右「执行」区——对照表于门后复现〔对照表装置 continuity〕+ 环体缩悬
 *  执行区深处示教学版位置）→ p4-02「五道关」五门 stagger 落位、调用方块停在
 *  门前 → 逐关点名（①格式 ②取值 ③先行检查 ④放行权 ⑤执行；角标 Zod /
 *  validateInput / PreToolUse / canUseTool）+ 方块过门①..④各留绿边过痕、
 *  抵门⑤前微顿 → 连续批分区（粗判卡先现即划；列目录 ✓ 入批 / 删除 ✗ 剔出
 *  单独排队；建任务×3 各带文件签同批并列；三批定格：前批并发 / 中批串行 /
 *  后批再并发，批间顺序箭头恒贯）→ ∞ 特写（读文件上限无穷大；超限落盘动画
 *  「预览+路径」双签；三节点循环图转起 → 禁止标志红杠掐断；∞ 与掐断之间
 *  因果连线点亮）。
 *
 *  空间契约：五门等距纵列；对照表复现为同形缩微（非新建视觉——TableRegistry
 *  同一装置的 0.35 档）；环体〔M-001〕以同形签名缩悬执行区深处。色彩：门卡/
 *  对照表/∞ = mech 琥珀；执行脉冲 = tool 青碧；过痕 = ok 绿；禁止红杠 =
 *  danger（恒配失败态）与 warn 同帧并用时以描边/填充区分。
 *
 *  红线落实：词落位 = 句首 + 句长比例；点名次序 = 口播次序；门⑤不放行（方块
 *  抵前微顿）；删除卡不入并发批；批间箭头不断续；y≥56 / bottom≥150。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, GateCard, LoopRing, Panel, TableRegistry} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useImpulse, useProgress, usePushIn, useTravel} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 五门纵列位（y 中心；门 w×h 由档位给出） */
const GATE_Y = [252, 390, 528, 666, 804] as const;
const GATE_NAMES = [
  {name: '格式', sub: 'Zod'},
  {name: '取值', sub: 'validateInput'},
  {name: '先行检查', sub: 'PreToolUse'},
  {name: '放行权', sub: 'canUseTool'},
  {name: '执行', sub: ''},
] as const;

// ── 4-A 拉远全景：生产舞台 + 五门落位 + 方块停在门前 ────────────────────

const ShotA: React.FC<{atGates: number; atCube: number; atStop: number}> = ({atGates, atCube, atStop}) => {
  const frame = useCurrentFrame();
  // @pushIn 负增量：自 P3 峰值拉远降压、重锚生产全景
  const push = usePushIn(0, {scale: -0.06, dur: DUR.f6});
  // p4-01 设问句：舞台空置一拍（门位虚线轮廓——ghost 态）
  // p4-02「五道关」：五门 stagger 依次落位（逐门点亮）
  const gateLit = [0, 1, 2, 3, 4].map((i) => clamp01(progress(frame, atGates + i * 5, DUR.f4)));
  // 调用小方块：自入口出发 →「落地前」停在门前
  const cubeGo = useProgress(atCube, Math.max(1, atStop - atCube), 'decelerate');
  const cubeX = 250 + (812 - 250) * cubeGo;
  const cubeO = useProgress(atCube, DUR.f3);
  return (
    <AbsoluteFill style={{transform: push}}>
      {/* 左：工具调用入口 */}
      <div style={{position: 'absolute', left: 150, top: 470}}>
        <Panel style={{padding: '12px 20px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 600, color: theme.text}}>{'工具调用'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 2}}>{'tool call'}</div>
        </Panel>
      </div>
      {/* 中：五道关门卡位（p4-01 虚线轮廓 → p4-02 stagger 落位；等距纵列） */}
      {GATE_Y.map((gy, i) => (
        <GateCard key={i} x={830} y={gy - 52} w={200} h={104} index={i + 1} lit={gateLit[i]} ghost={0.6} />
      ))}
      {/* 调用小方块（自入口出发，「落地前」停在门前——本镜不入门） */}
      <div
        style={{
          position: 'absolute',
          left: cubeX,
          top: 528,
          width: 48,
          height: 48,
          borderRadius: 10,
          border: `3px solid ${theme.tool}`,
          background: `${theme.tool}22`,
          opacity: cubeO,
        }}
      />
      {/* 右：执行区（对照表于门后复现——同形琥珀双列表；环体缩悬深处示教学版位） */}
      <div style={{position: 'absolute', left: 1180, top: 470}}>
        <Panel accent={theme.tool} style={{padding: '12px 20px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 600, color: theme.text}}>{'执行'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 2}}>{'execute'}</div>
        </Panel>
      </div>
      <TableRegistry x={1470} y={180} scale={0.35} rows={5} dim={0.15} />
      <div style={{position: 'absolute', left: 1600, top: 640, opacity: 0.5}}>
        <LoopRing size={120} nodes={[0, 1, 2, 3, 4].map((i) => ({label: `s${i}`, angle: -90 + i * 72}))} showLabels={false} showExit={false} />
      </div>
      {/* 入口 → 门 → 执行 区的方向基线（生产管线的读法锚） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line x1={300} y1={553} x2={806} y2={553} stroke={withAlpha(theme.dim, 0.4)} strokeWidth={2.5} strokeDasharray="8 10" />
        <line x1={1040} y1={553} x2={1160} y2={553} stroke={withAlpha(theme.dim, 0.4)} strokeWidth={2.5} strokeDasharray="8 10" />
      </svg>
      <Footnote delay={atGates}>{'五道关 · 拉远重锚'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-B 逐关点名 + 方块通关（过痕 ×4、门⑤前微顿） ──────────────────────

const ShotB: React.FC<{atName12: number; atName3: number; atName4: number; atPass: number; atHalt: number}> = ({
  atName12,
  atName3,
  atName4,
  atPass,
  atHalt,
}) => {
  const frame = useCurrentFrame();
  // 名牌逐亮（次序 = 口播：①② → ③ → ④；⑤「执行」恒在但保持末位语义）
  const lit = [
    clamp01(progress(frame, atName12, DUR.f3)),
    clamp01(progress(frame, atName12 + 4, DUR.f3)),
    clamp01(progress(frame, atName3, DUR.f3)),
    clamp01(progress(frame, atName4, DUR.f3)),
    1,
  ];
  // 方块逐关通关：过门①..④（y 沿纵列步进），「第五道才是执行」抵门⑤前微顿
  const passP = useProgress(atPass, Math.max(1, atHalt + DUR.f4 - atPass), 'decelerate');
  const stageF = Math.min(4, passP * 4.6); // 0..4 段；4 = 抵门⑤前
  const seg = Math.min(3.999, Math.floor(stageF));
  const cubeY = GATE_Y[0] + (GATE_Y[Math.min(4, seg + 1)] - GATE_Y[0]) * (stageF / 4);
  const haltShake = useImpulse({at: atHalt, dur: DUR.f4, peak: 0.12});
  return (
    <AbsoluteFill>
      {GATE_Y.map((gy, i) => (
        <GateCard
          key={i}
          x={760}
          y={gy - 70}
          w={280}
          h={140}
          index={i + 1}
          name={GATE_NAMES[i].name}
          sub={GATE_NAMES[i].sub || undefined}
          lit={lit[i]}
          passMark={stageF >= i + 0.6 && i < 4 ? 1 : 0}
        />
      ))}
      {/* 调用方块：沿门列下穿（过门①..④各留绿痕），抵门⑤前微顿（禁入门⑤） */}
      <div
        style={{
          position: 'absolute',
          left: 690,
          top: cubeY - 26,
          width: 52,
          height: 52,
          borderRadius: 11,
          border: `3px solid ${theme.tool}`,
          background: `${theme.tool}22`,
          transform: `scale(${1 + haltShake})`,
        }}
      />
      <div style={{position: 'absolute', left: 1130, top: 250, fontFamily: theme.mono, fontSize: 21, color: theme.dim, opacity: lit[3]}}>
        {'角标：Zod · validateInput'}
      </div>
      <div style={{position: 'absolute', left: 1130, top: 292, fontFamily: theme.mono, fontSize: 21, color: theme.dim, opacity: lit[3]}}>
        {'PreToolUse · canUseTool'}
      </div>
      <Footnote delay={atPass}>{'①..④ 过痕 · ⑤ 执行'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-C 连续批分区（粗判划除 + 判定签 + 三批定格） ──────────────────────

/** 六枚调用的既定位（横串按批分区排布：前批建×3 | 中批删 | 后批列+找） */
const CHAIN = [
  {k: 'task-a', zh: '建任务', tag: 'a.md', x: 300, batch: 0},
  {k: 'task-b', zh: '建任务', tag: 'b.md', x: 440, batch: 0},
  {k: 'task-c', zh: '建任务', tag: 'c.md', x: 580, batch: 0},
  {k: 'rm', zh: '删除', tag: 'tmp', x: 920, batch: 1},
  {k: 'ls', zh: '列目录', tag: './', x: 1300, batch: 2},
  {k: 'glob', zh: '找文件', tag: '*.py', x: 1470, batch: 2},
] as const;

const ShotC: React.FC<{atRough: number; atStrike: number; atVerdicts: number; atTasks: number; atSplit: number}> = ({
  atRough,
  atStrike,
  atVerdicts,
  atTasks,
  atSplit,
}) => {
  const frame = useCurrentFrame();
  // 粗判卡：先现即划（「按具体输入判」划除）
  const rough = useEnter('pop', {at: atRough, dur: DUR.f4});
  const strike = useProgress(atStrike, DUR.f4, 'accelerate');
  // 判定签：列目录 ✓ 入批 / 删除 ✗ 剔出单独排队（方块下移一行）
  const okSign = useEnter('pop', {at: atVerdicts, dur: DUR.f4, springPreset: 'settle'});
  const noSign = useEnter('pop', {at: atVerdicts + 4, dur: DUR.f4, springPreset: 'settle'});
  const dropOut = useProgress(atVerdicts + 8, DUR.f5, 'decelerate');
  // 建任务三卡同批并列（各带文件小签——改了状态也并发的证据形态）
  const tasks = [0, 1, 2].map((i) => clamp01(progress(frame, atTasks + i * 3, DUR.f3)));
  // 整列切三批定格（批框 + 批内并发箭头 + 批间顺序箭头）
  const split = useProgress(atSplit, DUR.f5);
  return (
    <AbsoluteFill>
      {/* 粗判卡（上方）：「只读都能跑」先现 → 划除 */}
      <div style={{position: 'absolute', left: 660, top: 236, ...rough}}>
        <Panel style={{padding: '12px 26px', position: 'relative'}}>
          <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.dim}}>{'只读都能跑'}</span>
          <span
            style={{
              position: 'absolute',
              left: 14,
              right: 14,
              top: '52%',
              height: 4,
              background: theme.warn,
              transform: `scaleX(${strike})`,
              transformOrigin: 'left center',
              borderRadius: 2,
            }}
          />
        </Panel>
        <div style={{position: 'absolute', right: 0, bottom: -34, fontFamily: theme.mono, fontSize: 20, color: theme.warn, opacity: strike}}>
          {'按具体输入判 →'}
        </div>
      </div>
      {/* 六枚调用小方块（暗态幕首在场；判定/点亮由词位驱动） */}
      {CHAIN.map((c) => {
        const isTask = c.k.startsWith('task');
        const lit = isTask ? tasks[Number(c.k.slice(5)) - 1] : 1;
        const dropped = c.k === 'rm' ? dropOut : 0;
        return (
          <div
            key={c.k}
            style={{
              position: 'absolute',
              left: c.x,
              top: 470 + dropped * 150,
              width: 110,
              height: 92,
              boxSizing: 'border-box',
              borderRadius: 12,
              border: `2.5px solid ${lit > 0.5 ? theme.mech : theme.panelBorder}`,
              background: lit > 0.5 ? `${theme.mech}14` : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: 0.5 + 0.5 * lit,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 600, color: theme.text}}>{c.zh}</span>
            {isTask ? (
              <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: lit}}>{c.tag}</span>
            ) : null}
          </div>
        );
      })}
      {/* 判定小签：列目录 ✓（入批）/ 删除 ✗（剔出单独排队） */}
      <div style={{position: 'absolute', left: 1280, top: 594, ...okSign}}>
        <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.ok}}>{'列目录 ✓'}</span>
      </div>
      <div style={{position: 'absolute', left: 880, top: 780, ...noSign}}>
        <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.warn}}>{'删除 ✗ · 单独排队'}</span>
      </div>
      {/* 三批分区框（前批并发 / 中批串行 / 后批再并发）+ 批内箭头 + 批间顺序箭头 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none', opacity: split}}>
        <rect x={272} y={432} width={426} height={168} rx={16} fill="none" stroke={theme.mech} strokeWidth={3} strokeDasharray="14 10" />
        <rect x={882} y={432} width={166} height={168} rx={16} fill="none" stroke={theme.mech} strokeWidth={3} strokeDasharray="14 10" />
        <rect x={1262} y={432} width={356} height={168} rx={16} fill="none" stroke={theme.mech} strokeWidth={3} strokeDasharray="14 10" />
        {/* 批内并发箭头（前批 ×3 齐出 / 后批 ×2 齐出——多箭头=并发） */}
        {[320, 460, 600].map((x) => (
          <path key={`a${x}`} d={`M ${x} 640 v 34 m -7 -10 l 7 12 l 7 -12`} fill="none" stroke={theme.tool} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {[1330, 1500].map((x) => (
          <path key={`b${x}`} d={`M ${x} 640 v 34 m -7 -10 l 7 12 l 7 -12`} fill="none" stroke={theme.tool} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {/* 中批单行（串行——单箭头下移一格） */}
        <path d="M 965 640 v 34 m -7 -10 l 7 12 l 7 -12" fill="none" stroke={theme.dim} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
        {/* 批间顺序箭头（恒定贯穿——保序） */}
        <path d="M 712 500 H 856 M 846 492 L 860 500 L 846 508" fill="none" stroke={theme.text} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 1068 500 H 1242 M 1232 492 L 1246 500 L 1232 508" fill="none" stroke={theme.text} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, top: 700, textAlign: 'center', fontFamily: theme.mono, fontSize: 20, color: theme.dim, opacity: split}}>
        {'partitionToolCalls · 批内并发 · 批间保序'}
      </div>
      <Footnote delay={atSplit}>{'partitionToolCalls'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-D ∞ 特写 + 落盘动画 + 掐断循环 ────────────────────────────────────

const ShotD: React.FC<{atFile: number; atInf: number; atLoop: number; atBan: number; atLink: number}> = ({
  atFile,
  atInf,
  atLoop,
  atBan,
  atLink,
}) => {
  // 超限落盘：结果条超长 → 落盘 → 模型侧收到「预览 + 路径」双签
  const spill = useProgress(atFile, DUR.f5, 'decelerate');
  const fileDrop = useProgress(atFile + DUR.f4, DUR.f4);
  const duoIn = useEnter('rise', {at: atFile + DUR.f5, dur: DUR.f4, dist: 14});
  // ∞ 亮出（重音镜）+ 呼吸辉光
  const infO = useProgress(atInf, DUR.f4);
  const infGlow = useImpulse({at: atInf, dur: DUR.f6, peak: 1});
  // 三节点循环图转起（巡游点）→ 禁止标志落下红杠掐断
  const loopDot = useTravel({cx: 1420, cy: 530, r: 130, secPerLap: 1.6, offset: 0});
  const loopOn = useProgress(atLoop, DUR.f3);
  const banO = useProgress(atBan, DUR.f4, 'accelerate');
  const banDrop = useProgress(atBan, DUR.f5, 'accelerate');
  const banFlash = useImpulse({at: atBan + DUR.f4, dur: DUR.f5, peak: 1});
  // ∞ 与掐断循环之间因果连线
  const link = useProgress(atLink, DUR.f5, 'decelerate');
  return (
    <AbsoluteFill>
      {/* 左：工具卡上限列（读文件 ∞ 位；其余具体长度短条） */}
      {[
        {zh: '读文件', en: 'read_file', inf: true},
        {zh: '写文件', en: 'write_file', inf: false},
        {zh: '改文件', en: 'edit_file', inf: false},
        {zh: '找文件', en: 'glob', inf: false},
        {zh: '跑命令', en: 'bash', inf: false},
      ].map((t, i) => (
        <div
          key={t.en}
          style={{
            position: 'absolute',
            left: 210,
            top: 300 + i * 108,
            width: 520,
            height: 92,
            boxSizing: 'border-box',
            borderRadius: 10,
            border: `2px solid ${t.inf ? theme.mech : theme.panelBorder}`,
            background: t.inf ? `${theme.mech}12` : 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '0 20px',
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>{t.zh}</span>
          <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{t.en}</span>
          {/* 结果上限位：∞（唯一无上限位）或具体长度短条 */}
          {t.inf ? (
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: theme.serif,
                fontSize: 58,
                fontWeight: 700,
                color: theme.mech,
                opacity: infO,
                textShadow: `0 0 ${30 * infGlow}px ${theme.mech}`,
                lineHeight: 1,
              }}
            >
              {'∞'}
            </span>
          ) : (
            <span style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10}}>
              <span style={{width: 120, height: 14, borderRadius: 7, background: theme.panelBorder, opacity: 0.75}} />
              <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'上限'}</span>
            </span>
          )}
        </div>
      ))}
      {/* 超限落盘小动画（写文件卡侧：结果条超长溢出 → 文件图标落盘） */}
      <svg width={700} height={140} style={{position: 'absolute', left: 620, top: 396, overflow: 'visible', opacity: spill > 0.02 ? 1 : 0}}>
        <rect x={0} y={20} width={Math.min(340, 340 * spill * 1.4)} height={26} rx={6} fill={withAlpha(theme.dim, 0.5)} />
        <rect
          x={Math.min(334, 334 * spill * 1.4)}
          y={12 + 40 * fileDrop}
          width={54}
          height={40}
          rx={8}
          fill={theme.panel}
          stroke={theme.mech}
          strokeWidth={2.5}
          transform={`translate(${(1 - fileDrop) * 40} ${(1 - fileDrop) * -20})`}
        />
        <path d="M14 20 h14 v14" fill="none" stroke={theme.mech} strokeWidth={2.5} opacity={fileDrop} transform="translate(12 32)" />
      </svg>
      {/* 模型侧收到「预览 + 路径」双签 */}
      <div style={{position: 'absolute', left: 640, top: 240, ...duoIn}}>
        <div style={{display: 'flex', gap: 14}}>
          <Panel accent={theme.mech} style={{padding: '8px 16px'}}>
            <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.text}}>{'预览 preview'}</span>
          </Panel>
          <Panel accent={theme.mech} style={{padding: '8px 16px'}}>
            <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.text}}>{'路径 path'}</span>
          </Panel>
        </div>
      </div>
      {/* 右：三节点小循环图（读→落盘→新文件→再读…；转起后禁止标志掐断） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <circle cx={1420} cy={530} r={130} fill="none" stroke={withAlpha(theme.dim, 0.7)} strokeWidth={3} />
        {[
          {a: -90, label: '读'},
          {a: 30, label: '落盘'},
          {a: 150, label: '新文件'},
        ].map((n) => {
          const rad = (n.a * Math.PI) / 180;
          const x = 1420 + 130 * Math.cos(rad);
          const y = 530 + 130 * Math.sin(rad);
          return (
            <g key={n.label}>
              <circle cx={x} cy={y} r={13} fill={theme.bg} stroke={theme.dim} strokeWidth={3} />
              <text x={x} y={n.a === -90 ? y - 24 : y + 34} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fill={theme.dim}>
                {n.label}
              </text>
            </g>
          );
        })}
        {/* 巡游点（循环转起——无限循环的运动面） */}
        {loopOn > 0.5 ? <circle cx={loopDot.x} cy={loopDot.y} r={10} fill={theme.warn} opacity={0.9} /> : null}
        {/* 禁止标志（红杠掐断回路——落下动画 + 闪一拍） */}
        <g opacity={banO}>
          <circle cx={1420} cy={530} r={86} fill="none" stroke={theme.danger} strokeWidth={7} opacity={0.9} transform={`translate(0 ${(1 - banDrop) * -120})`} />
          <line
            x1={1359}
            y1={469}
            x2={1481}
            y2={591}
            stroke={theme.danger}
            strokeWidth={8}
            strokeLinecap="round"
            opacity={0.95}
            transform={`translate(0 ${(1 - banDrop) * -120})`}
          />
          <circle cx={1420} cy={530} r={100} fill="none" stroke={theme.danger} strokeWidth={3} opacity={0.5 * banFlash} />
        </g>
        {/* ∞ 卡与掐断循环图之间因果连线（「例外的道理」） */}
        <line
          x1={740}
          y1={344}
          x2={740 + (1288 - 740) * link}
          y2={344 + (488 - 344) * link}
          stroke={theme.mech}
          strokeWidth={3.5}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - link}
        />
      </svg>
      <Footnote delay={atInf}>{'maxResultSizeChars'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P4FiveGates: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p4-01', 'p4-02');
  const bB = w('p4-03');
  const bC = w('p4-04', 'p4-06');
  const bD = w('p4-07', 'p4-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <ShotA atGates={wa('p4-02', 0.62) - bA.from} atCube={wa('p4-02', 0.4) - bA.from} atStop={wa('p4-02', 0.86) - bA.from} />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <ShotB
          atName12={wa('p4-03', 0.18) - bB.from}
          atName3={wa('p4-03', 0.42) - bB.from}
          atName4={wa('p4-03', 0.55) - bB.from}
          atPass={wa('p4-03', 0.75) - bB.from}
          atHalt={wa('p4-03', 0.94) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <ShotC
          atRough={wa('p4-04', 0.15) - bC.from}
          atStrike={wa('p4-04', 0.35) - bC.from}
          atVerdicts={wa('p4-04', 0.52) - bC.from}
          atTasks={wa('p4-05', 0.35) - bC.from}
          atSplit={wa('p4-06', 0.18) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <ShotD
          atFile={wa('p4-07', 0.22) - bD.from}
          atInf={wa('p4-08', 0.18) - bD.from}
          atLoop={wa('p4-08', 0.62) - bD.from}
          atBan={wa('p4-08', 0.82) - bD.from}
          atLink={wa('p4-09', 0.6) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4FiveGates;
