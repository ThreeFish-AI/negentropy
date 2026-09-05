/** P3 执行之前，先过闸门（分镜 3-A…3-G）—— 开源教学素材「Permission Desk」的概念重建
 *  三种结果不各占一色：allow 回 core（放行=回主干）、ask 用 mech、deny 用 danger。
 *  重制（2026-09 运动层）：动效收敛到 motion 模型（分镜动效列 @动词 可机检）。 */
import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {HarnessBadge} from '../components/harness-stack';
import {
  CodeCard,
  Footnote,
  GateRouter,
  LoopRing,
  NumberedCard,
  Panel,
  SceneTag,
  useRingDot,
} from '../components/motifs';
import {DUR, SPRING, useBreathe, useProgress, useShake, useStagger, win} from '../motion';

/** 3-A 五张工具卡，跑命令那张在「工作目录」框外 */
const UnguardedShell: React.FC<{frameAt: number; cmdAt: number; execAt: number}> = ({
  frameAt,
  cmdAt,
  execAt,
}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 合框 22f 是 beat 级动作（≥22 保留显式时长）
  const boxT = useProgress(frameAt, 22);
  // 闸门成形后持续微抖（错误语义；局部相位——模型口径）
  const shake = useShake({at: frameAt + 22, amp: 2.5, freq: 2.2});
  const showCmd = frame >= cmdAt;
  const dim = showCmd ? 0.55 : 1;
  // rm -rf 大字：瞬现门 → 恒渲染 + f3 淡入；弹入 14f → f6 档
  const cmdOp = useProgress(cmdAt, DUR.f3);
  const cmdPop = useProgress(cmdAt, DUR.f6);
  // 循环角标：同款瞬现门 → 淡入
  const execOp = useProgress(execAt, DUR.f3);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Permission" tagline="Check Permissions Before Execution" />
      <div style={{opacity: dim, display: 'flex', alignItems: 'center', gap: 26}}>
        {/* 工作目录框：把四张 file tool 收进去 */}
        <div
          style={{
            position: 'relative',
            padding: 18,
            border: `3px solid ${theme.mech}`,
            borderRadius: 16,
            opacity: boxT,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -16,
              left: 18,
              background: theme.bg,
              padding: '0 10px',
              fontFamily: theme.sans,
              fontSize: 21,
              color: theme.mech,
            }}
          >
            {'工作目录'}
          </div>
          <div style={{display: 'flex', gap: 14}}>
            {['读文件', '写文件', '改文件', '找文件'].map((t, i) => (
              <NumberedCard key={t} index={i + 2} label={t} width={182} delay={i * 3} />
            ))}
          </div>
        </div>
        <div style={{transform: `translateX(${shake}px)`}}>
          <NumberedCard index={1} label="跑命令" sub="没人管它" active width={200} />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          fontFamily: theme.mono,
          fontSize: 56,
          fontWeight: 700,
          color: theme.deny,
          opacity: cmdOp,
          transform: `scale(${0.8 + 0.2 * cmdPop})`,
        }}
      >
        {'rm -rf /'}
      </div>
      <div style={{position: 'absolute', right: 96, bottom: 210, opacity: 0.9 * execOp}}>
        <LoopRing size={180} draw={1} dotProgress={dot} activeNode={2} showExit={false} />
        <div
          style={{
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 21,
            color: theme.dim,
            marginTop: 4,
          }}
        >
          {'循环照常执行'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 3-B 三道闸门落下，第一道把请求弹回 */
const GatesFall: React.FC<{gateAt: number[]; bounceAt: number}> = ({gateAt, bounceAt}) => {
  // 三道闸门：锚点等差（stride 取自 prop 锚距），落下 16f → f6 档
  const g = useStagger(3, {at: gateAt[0], stride: gateAt[1] - gateAt[0], dur: DUR.f6});
  const travel = useProgress(bounceAt, DUR.f6);
  // 危险词 chips：第一道闸近落定（gateAt[0]+12）起 stride 4 错峰，10f → f5
  const banOp = useStagger(4, {at: gateAt[0] + 12, stride: 4, dur: DUR.f5});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <GateRouter gates={g} travel={travel} blockedBy={0} />
      {/* 容器参与 AbsoluteFill 垂直居中——恒渲染会整体上移 GateRouter（几何变化），
          保留门；子项自身已错峰淡入 */}
      {g[0] > 0.8 ? (
        <div style={{display: 'flex', gap: 14, marginTop: 34}}>
          {['删根目录', '提权', '关机', '格式化'].map((t, i) => (
            <Panel
              key={t}
              accent={theme.deny}
              style={{
                padding: '10px 20px',
                opacity: banOp[i],
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.deny}}>{t}</span>
            </Panel>
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 3-C 二三道闸门工作：一个停在审批前，一个畅通直达 */
const AskAndPass: React.FC<{askAt: number; passAt: number}> = ({askAt, passAt}) => {
  const frame = useCurrentFrame();
  const t1 = useProgress(0, 26);
  const t2 = useProgress(passAt, 30);
  const asking = frame >= askAt;
  // 审批卡：瞬现门 → 恒渲染 + f3 淡入
  const askOp = useProgress(askAt, DUR.f3);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 审批卡弹出时闸门整体上移让位——否则卡片会盖住三道闸，
          「停在第三道闸门前等待」这层语义就看不见了 */}
      <div
        style={{
          opacity: asking ? 0.45 : 1,
          transform: `translateY(${asking ? -150 : 0}px)`,
        }}
      >
        <GateRouter gates={[1, 1, 1]} travel={t1} blockedBy={2} />
      </div>
      <Panel
        accent={theme.mech}
        style={{
          position: 'absolute',
          width: 760,
          padding: '26px 30px',
          background: theme.panel,
          top: '52%',
          opacity: askOp,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          {/* 绘制的三角叹号（不用 emoji——全彩字形会击穿三色契约） */}
          <svg width={30} height={27} style={{flexShrink: 0}}>
            <path
              d="M15 2 L28 25 L2 25 Z"
              fill="none"
              stroke={theme.deny}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <line x1={15} y1={10} x2={15} y2={18} stroke={theme.deny} strokeWidth={3} strokeLinecap="round" />
            <circle cx={15} cy={22.5} r={1.8} fill={theme.deny} />
          </svg>
          <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.mech}}>
            {'Potentially destructive command'}
          </span>
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.text, marginTop: 14}}>
          {'bash("rm -rf ./tmp/build-cache")'}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 28, color: theme.dim, marginTop: 18}}>
          {'Allow? [y/N] '}
          <span style={{color: theme.core, opacity: Math.floor(frame / 12) % 2 === 0 ? 1 : 0.2}}>
            {'▍'}
          </span>
        </div>
      </Panel>
      {t2 > 0 ? (
        <div style={{position: 'absolute', bottom: 200, width: 1120}}>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginBottom: 6}}>
            {'三道都没命中的日常操作'}
          </div>
          <div style={{position: 'relative', height: 22}}>
            <div style={{position: 'absolute', left: 0, top: 9, right: 0, height: 3, background: theme.panelBorder}} />
            <div style={{position: 'absolute', left: 0, top: 9, width: `${t2 * 100}%`, height: 3, background: theme.core}} />
            <div
              style={{
                position: 'absolute',
                left: `${t2 * 100}%`,
                top: 0,
                width: 20,
                height: 20,
                borderRadius: 999,
                background: theme.core,
              }}
            />
          </div>
        </div>
      ) : null}
      {/* 三判定小抄（开源教学素材 Permission Desk 的信息结构）：allow / ask / deny 各带真实载荷 ——
          本幕上方只演了 ask 与 allow，这里把第三条补齐，路由器的三种出口一目了然。
          落位约束：小抄出现时（t2 > 0.4）闸门已整体上移 -150，GateRouter 的闸门名
          （`y - h - 18`）落在 y≈235–258、闸柱顶到 y≈272——小抄必须整体收在其上方，
          否则「三道闸门各自是什么」会被前两张卡盖掉（本幕只剩「问你」露出过）。 */}
      {t2 > 0.4 ? (
        <div
          style={{
            position: 'absolute',
            left: 120,
            top: 56,
            display: 'flex',
            gap: 18,
            opacity: win(t2, [0.4, 0.8]),
          }}
        >
          {[
            {v: 'allow', c: theme.core, op: 'read_file README.md', note: '只读、工作区内'},
            {v: 'ask', c: theme.mech, op: 'rm -rf ./tmp/build-cache', note: '要你点一次头'},
            {v: 'deny', c: theme.deny, op: 'sudo rm -rf /', note: '根本到不了执行口'},
          ].map((r) => (
            <div
              key={r.v}
              style={{
                border: `2px solid ${r.c}`,
                borderRadius: 10,
                padding: '10px 16px',
                background: theme.panel,
                minWidth: 300,
              }}
            >
              <div style={{fontFamily: theme.mono, fontSize: 24, fontWeight: 700, color: r.c}}>
                {r.v}
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.text, marginTop: 6}}>
                {r.op}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 4}}>
                {r.note}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 3-D 拒绝表降级为「示意」+ 变体绕过 */
const DenyListHonesty: React.FC<{degradeAt: number; bypassAt: number; quoteAt: number}> = ({
  degradeAt,
  bypassAt,
  quoteAt,
}) => {
  const frame = useCurrentFrame();
  // hooks 先于 QuoteCard 早退（Rules of Hooks：调用数须恒定）
  const degradeOp = useProgress(degradeAt, DUR.f3);
  const bypassOp = useProgress(bypassAt, DUR.f3);
  // 绕过变体：stride 8 错峰滑入，22f 描入（≥22 保留显式时长）
  const variantP = useStagger(3, {at: bypassAt, stride: 8, dur: 22});
  if (frame >= quoteAt) {
    return <QuoteCard zh="它告诉你闸门装在哪儿，不是替你把门守住。" accent={theme.deny} />;
  }
  const degraded = frame >= degradeAt;
  const lines = [
    'DENY_LIST = [',
    '    "rm -rf /", "sudo", "shutdown",',
    '    "reboot", "mkfs", "dd if=",',
    '    "> /dev/sda",',
    ']',
  ];
  const variants = ['rm  -rf  /', 'rm -fr /', 'sudo${IFS}rm'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 60}}>
      <div style={{position: 'relative'}}>
        <CodeCard
          lines={lines}
          width={620}
          framesPerLine={3}
          showLineNumbers={false}
          accent={degraded ? undefined : theme.deny}
        />
        {/* 降级虚框：绝对定位无布局影响——瞬现门 → 淡入 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: `2px dashed ${theme.dim}`,
            borderRadius: 14,
            pointerEvents: 'none',
            opacity: degradeOp,
          }}
        />
        {/* 降级说明是常规流子节点：恒渲染会永久改变行内居中（几何变化），保留瞬现门 */}
        {degraded ? (
          <div
            style={{
              marginTop: 14,
              fontFamily: theme.sans,
              fontSize: 23,
              color: theme.dim,
              textAlign: 'center',
            }}
          >
            {'教学示意，不是安全边界'}
          </div>
        ) : null}
      </div>
      <div style={{width: 430}}>
        {variants.map((v, i) => {
          const t = variantP[i];
          if (t <= 0) return null;
          return (
            <div
              key={v}
              style={{
                fontFamily: theme.mono,
                fontSize: 27,
                color: theme.deny,
                marginBottom: 18,
                transform: `translateX(${t * 90}px)`,
                opacity: t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15,
              }}
            >
              {v}
            </div>
          );
        })}
        {/* 末位流子节点且右列恒短于左列——恒渲染无布局影响，瞬现门 → 淡入 */}
        <div
          style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 10, opacity: bypassOp}}
        >
          {'换个拼法就绕过去了'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 3-E 四种结果四宫格，第四格「不表态」回连到「问你」 */
const FourResults: React.FC<{fourthAt: number; arcAt: number}> = ({fourthAt, arcAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cells = [
    {t: '放行', en: 'allow', c: theme.core},
    {t: '拒绝', en: 'deny', c: theme.deny},
    {t: '问你', en: 'ask', c: theme.mech},
    {t: '不表态', en: 'passthrough', c: theme.dim},
  ];
  // 回连弧 24f 是 beat 级（≥22 保留显式时长）。弧进度同时驱动 svg 守卫与「兜底」
  // 字门——draw 三元组保持内联共享同一进度（换 useDraw 会 fork 出 decelerate
  // 进度，使 0.9 字门与描线失同步）
  const arc = useProgress(arcAt, 24);
  // sin(frame/8) → period 2π·8
  const breathe = useBreathe({period: 2 * Math.PI * 8, amp: 0.5, base: 0.5});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative'}}>
        <div style={{display: 'grid', gridTemplateColumns: '340px 340px', gap: 24}}>
          {cells.map((c, i) => {
            const fourth = i === 3;
            const on = fourth ? frame >= fourthAt : true;
            // 弹簧在 map 内保持纯调用（锚点非均匀：三格 i*5、第四格 fourthAt）；
            // damping 200 → SPRING.settle
            const e = spring({frame: frame - (fourth ? fourthAt : i * 5), fps, config: SPRING.settle});
            return (
              <Panel
                key={c.en}
                accent={on ? c.c : theme.panelBorder}
                style={{
                  padding: '26px 28px',
                  opacity: on ? e : 0.3 + breathe * 0.2,
                  borderStyle: fourth && !on ? 'dashed' : 'solid',
                }}
              >
                <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: on ? c.c : theme.dim}}>
                  {c.t}
                </div>
                <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginTop: 6}}>
                  {c.en}
                </div>
              </Panel>
            );
          })}
        </div>
        {arc > 0 ? (
          <svg width={760} height={260} style={{position: 'absolute', left: -30, top: 30, pointerEvents: 'none'}}>
            <path
              d="M 400 210 C 520 210, 560 120, 470 96"
              stroke={theme.mech}
              strokeWidth={4}
              fill="none"
              {...evolvePath(arc, 'M 400 210 C 520 210, 560 120, 470 96')}
            />
            {arc > 0.9 ? (
              <text x={545} y={165} fontFamily={theme.sans} fontSize={24} fill={theme.mech}>
                {'兜底'}
              </text>
            ) : null}
          </svg>
        ) : null}
      </div>
      <Footnote delay={fourthAt}>{'PermissionResult 四种 —— 第三方的源码分析'}</Footnote>
    </AbsoluteFill>
  );
};

/** 3-F 官方求值顺序：拒绝 → 询问 → 放行，首中即出局（Harness Engineering 改造版）
 *  官方语义：三类规则按固定顺序求值、第一个命中即出局、规则具体度不改顺序；
 *  裸名 deny 把整件工具从模型身上移除；拒绝连全放行模式都压得住。 */
const EvalOrder: React.FC<{orderAt: number; ballAt: number; denyHitAt: number; nakedAt: number}> = ({
  orderAt,
  ballAt,
  denyHitAt,
  nakedAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stations = [
    {t: '拒绝 deny', c: 'deny', sub: '命中即出局'},
    {t: '询问 ask', c: 'mech', sub: '命中即出局'},
    {t: '放行 allow', c: 'core', sub: '兜底到它'},
  ];
  // 光点沿三站行进；在第二幕演示里被第①站截获（46f beat 级，保留显式时长）
  const travel = useProgress(ballAt, 46);
  const hit = frame >= denyHitAt;
  const naked = frame >= nakedAt;
  // 顺序点亮 20f → f6 档
  const orderOn = useProgress(orderAt, DUR.f6);
  // 裸名 deny 注释：门保留（元素本就以 opacity 淡入），14f → f6 档
  const nakedOp = useProgress(nakedAt, DUR.f6);
  const PX = 300; // 轨道起点
  const GAP = 380;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1560, height: 560}}>
        <svg width={1560} height={560} style={{position: 'absolute'}}>
          {/* 主轨道 */}
          <line
            x1={PX}
            y1={300}
            x2={PX + GAP * 2 + 240}
            y2={300}
            stroke={theme.panelBorder}
            strokeWidth={5}
            opacity={orderOn}
          />
          {/* 首中即出局横幅（顺序点亮后压上） */}
          {orderOn > 0.9 ? (
            <text x={780} y={110} textAnchor="middle" fontFamily={theme.serif} fontSize={34} fill={theme.text}>
              {'头一个命中，就出局'}
            </text>
          ) : null}
          {/* 请求光点：被第①站截获 */}
          {(() => {
            const x = PX + (GAP * 2 + 200) * travel;
            const cutX = PX + GAP * 0.5;
            const stopped = hit && travel > (GAP * 0.5) / (GAP * 2 + 200);
            const finalX = stopped ? cutX : x;
            return (
              <g>
                {!stopped ? (
                  <line x1={PX} y1={300} x2={finalX} y2={300} stroke={theme.core} strokeWidth={3} opacity={0.5} />
                ) : null}
                <circle cx={finalX} cy={300} r={13} fill={stopped ? theme.deny : theme.core}
                  style={stopped ? {filter: `drop-shadow(0 0 14px ${theme.deny})`} : undefined} />
                {stopped ? (
                  <text x={finalX} y={252} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.deny}>
                    {'出局'}
                  </text>
                ) : null}
              </g>
            );
          })()}
        </svg>
        {/* 三站闸门 */}
        {stations.map((st, i) => {
          const at = orderAt + 4 + i * 7;
          // map 内弹簧保持纯调用；damping 200 → SPRING.settle
          const e = spring({frame: frame - at, fps, config: SPRING.settle});
          const color = st.c === 'deny' ? theme.deny : st.c === 'mech' ? theme.mech : theme.core;
          return (
            <div
              key={st.t}
              style={{
                position: 'absolute',
                left: PX + GAP * i - 130,
                top: 330,
                width: 260,
                opacity: e,
                transform: `translateY(${(1 - e) * 26}px)`,
              }}
            >
              <Panel accent={color} style={{padding: '14px 18px', textAlign: 'center'}}>
                <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.text}}>{st.t}</div>
                <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 6}}>{st.sub}</div>
              </Panel>
              {/* 站上竖闸 */}
              <svg width={260} height={64} style={{display: 'block', margin: '0 auto'}}>
                <line x1={130} y1={0} x2={130} y2={40} stroke={color} strokeWidth={7} />
                <circle cx={130} cy={46} r={7} fill={color} />
              </svg>
            </div>
          );
        })}
        {/* 裸名 deny：整件工具从模型身上消失 */}
        {naked ? (
          <div
            style={{
              position: 'absolute',
              right: 40,
              top: 470,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              opacity: nakedOp,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim, textDecoration: 'line-through'}}>
              {'Bash'}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.deny}}>{'→'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.deny}}>
              {'整件工具，从模型身上消失'}
            </span>
          </div>
        ) : null}
      </div>
      <Footnote delay={orderAt}>
        {'deny → ask → allow 首中即出局 · 裸名 deny 移除整件工具 —— 官方文档 permissions'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 3-G auto 分类器视野分屏：审判者只看用户消息与裸命令（Harness Engineering 改造版）
 *  官方工程博客：模型的自我辩解、工具结果、调用描述全被剥在视野外——
 *  评它做了什么，而非它说了什么；网页注入的文本骗不到审判者。 */
const ClassifierVision: React.FC<{scrollAt: number; stripAt: number; goldenAt: number; spoofAt: number}> = ({
  scrollAt,
  stripAt,
  goldenAt,
  spoofAt,
}) => {
  const frame = useCurrentFrame();
  const rows = [
    {t: '模型的自我辩解：我确认这是安全的操作', why: '辩解不看', strike: true},
    {t: '工具结果：tests/ 42 passed, 0 failed', why: '结果不看', strike: true},
    {t: '工具调用描述：准备执行 npm install', why: '描述不看', strike: true},
    {t: '用户消息：帮我把依赖装上', why: '', strike: false},
    {t: '裸命令：npm install --save-dev vitest', why: '', strike: false},
  ];
  const spoofOn = frame >= spoofAt;
  // 金化 18f → f6 档
  const golden = useProgress(goldenAt, DUR.f6);
  // 五行逐条滚入：stride 9、单项 12f = DUR.f5
  const rowP = useStagger(rows.length, {at: scrollAt, stride: 9, dur: DUR.f5});
  // 反例帧行进 30f（≥22 保留显式时长）——提升到组件顶（IIFE 内不可调 hook）
  const spoofT = useProgress(spoofAt, 30);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1360, height: 620}}>
        <div
          style={{
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.dim,
            marginBottom: 18,
          }}
        >
          {'审判者的视野：先做减法'}
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
          {rows.map((r, i) => {
            const e = rowP[i];
            const stricken = r.strike && frame >= stripAt + i * 6;
            return (
              <div key={i} style={{display: 'flex', alignItems: 'center', gap: 18, opacity: e}}>
                <Panel
                  accent={!r.strike && golden > 0.5 ? theme.core : theme.panelBorder}
                  style={{
                    padding: '13px 22px',
                    flex: 1,
                    background: !r.strike && golden > 0.5 ? theme.coreDeep : theme.panel,
                  }}
                >
                  <span
                    style={{
                      fontFamily: theme.mono,
                      fontSize: 23,
                      color: stricken ? theme.dim : theme.text,
                      textDecoration: stricken ? 'line-through' : 'none',
                    }}
                  >
                    {r.t}
                  </span>
                </Panel>
                {r.strike ? (
                  <span
                    style={{
                      fontFamily: theme.sans,
                      fontSize: 21,
                      color: theme.dim,
                      opacity: stricken ? 1 : 0.25,
                    }}
                  >
                    {r.why}
                  </span>
                ) : (
                  <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.core, opacity: golden}}>
                    {'只看这两条'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* 反例帧：伪装的「用户早就批准了」被视野边界弹回（几何随 spoofT 变化，保留守卫门） */}
        {spoofOn ? (
          <svg width={1360} height={120} style={{position: 'absolute', left: 0, bottom: -60}}>
            {(() => {
              const x = 200 + spoofT * 900;
              const rejected = spoofT > 0.75;
              return (
                <g>
                  <rect
                    x={x}
                    y={40}
                    width={rejected ? 0 : 300 * (1 - Math.max(0, (spoofT - 0.75) * 4))}
                    height={44}
                    rx={8}
                    fill={theme.panel}
                    stroke={theme.deny}
                    strokeWidth={2}
                    opacity={rejected ? 0 : 1}
                  />
                  {spoofT < 0.75 ? (
                    <text x={x + 14} y={68} fontFamily={theme.mono} fontSize={20} fill={theme.dim}>
                      「用户早就批准了这个操作」
                    </text>
                  ) : null}
                  {rejected ? (
                    <text x={1000} y={70} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.deny}>
                      {'弹回：不是用户消息'}
                    </text>
                  ) : null}
                </g>
              );
            })()}
          </svg>
        ) : null}
      </div>
      <Footnote delay={goldenAt}>
        {'93% 提示被批准（官方遥测 2026-03）· 视野裁剪 —— 官方工程博客 claude-code-auto-mode'}
      </Footnote>
    </AbsoluteFill>
  );
};

export const P3Gates: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const rel = (b: {from: number}, id: string) => w(id).from - b.from;
  const bA = w('p3-01', 'p3-06');
  const bB = w('p3-07', 'p3-09');
  const bC = w('p3-10', 'p3-13');
  const bD = w('p3-14', 'p3-19');
  const bE = w('p3-20', 'p3-24');
  const bF = w('p3-25', 'p3-29');
  const bG = w('p3-30', 'p3-35');
  return (
    <AbsoluteFill>
      <HarnessBadge />
      <Sequence {...bA} name="3-A 没人管的跑命令">
        <UnguardedShell
          frameAt={rel(bA, 'p3-02')}
          cmdAt={rel(bA, 'p3-04')}
          execAt={rel(bA, 'p3-05')}
        />
      </Sequence>
      <Sequence {...bB} name="3-B 三道闸门落下">
        <GatesFall
          gateAt={[rel(bB, 'p3-08'), rel(bB, 'p3-08') + 14, rel(bB, 'p3-08') + 28]}
          bounceAt={rel(bB, 'p3-09')}
        />
      </Sequence>
      <Sequence {...bC} name="3-C 审批与放行">
        <AskAndPass askAt={rel(bC, 'p3-12')} passAt={rel(bC, 'p3-13')} />
      </Sequence>
      <Sequence {...bD} name="3-D 拒绝表的诚实">
        <DenyListHonesty
          degradeAt={rel(bD, 'p3-16')}
          bypassAt={rel(bD, 'p3-18')}
          quoteAt={rel(bD, 'p3-19')}
        />
      </Sequence>
      <Sequence {...bE} name="3-E 四种结果">
        <FourResults fourthAt={rel(bE, 'p3-23')} arcAt={rel(bE, 'p3-24')} />
      </Sequence>
      <Sequence {...bF} name="3-F 官方求值顺序">
        <EvalOrder
          orderAt={rel(bF, 'p3-25')}
          ballAt={rel(bF, 'p3-26')}
          denyHitAt={rel(bF, 'p3-27')}
          nakedAt={rel(bF, 'p3-28')}
        />
      </Sequence>
      <Sequence {...bG} name="3-G auto 分类器视野">
        <ClassifierVision
          scrollAt={rel(bG, 'p3-31')}
          stripAt={rel(bG, 'p3-32')}
          goldenAt={rel(bG, 'p3-33')}
          spoofAt={rel(bG, 'p3-34')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
