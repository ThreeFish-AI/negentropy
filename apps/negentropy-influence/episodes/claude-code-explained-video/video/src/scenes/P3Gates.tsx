/** P3 执行之前，先过闸门（分镜 3-A…3-G，含新镜 3-D2 沙箱横切面）—— 开源示教素材「Permission Desk」的概念重建
 *  三种结果不各占一色：allow 回 core（放行=回主干）、ask 用 mech、deny 用 danger。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {CodeCard, Footnote, GateRouter, LoopRing, NumberedCard, Panel, SceneHeader, useRingDot} from '../components/motifs';

/** 3-A 五张工具卡，跑命令那张在「工作目录」框外 */
const UnguardedShell: React.FC<{frameAt: number; cmdAt: number; execAt: number}> = ({
  frameAt,
  cmdAt,
  execAt,
}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  const boxT = interpolate(frame - frameAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shake = frame >= frameAt + 22 ? Math.sin(frame / 2.2) * 2.5 : 0;
  const showCmd = frame >= cmdAt;
  const dim = showCmd ? 0.55 : 1;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
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
      {showCmd ? (
        <div
          style={{
            position: 'absolute',
            fontFamily: theme.mono,
            fontSize: 56,
            fontWeight: 700,
            color: theme.deny,
            transform: `scale(${interpolate(frame - cmdAt, [0, 14], [0.8, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })})`,
          }}
        >
          {'rm -rf /'}
        </div>
      ) : null}
      {frame >= execAt ? (
        <div style={{position: 'absolute', right: 96, bottom: 210, opacity: 0.9}}>
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
      ) : null}
    </AbsoluteFill>
  );
};

/** 3-B 三道闸门落下，第一道把请求弹回 */
const GatesFall: React.FC<{gateAt: number[]; bounceAt: number}> = ({gateAt, bounceAt}) => {
  const frame = useCurrentFrame();
  const g = gateAt.map((a) =>
    interpolate(frame - a, [0, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
  );
  const travel = interpolate(frame - bounceAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <GateRouter gates={g} travel={travel} blockedBy={0} />
      {g[0] > 0.8 ? (
        <div style={{display: 'flex', gap: 14, marginTop: 34}}>
          {['删根目录', '提权', '关机', '格式化'].map((t, i) => (
            <Panel
              key={t}
              accent={theme.deny}
              style={{
                padding: '10px 20px',
                opacity: interpolate(frame - gateAt[0] - 12 - i * 4, [0, 10], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
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
  const t1 = interpolate(frame, [0, 26], [0, 1], {extrapolateRight: 'clamp'});
  const t2 = interpolate(frame - passAt, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const asking = frame >= askAt;
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
      {asking ? (
        <Panel
          accent={theme.mech}
          style={{
            position: 'absolute',
            width: 760,
            padding: '26px 30px',
            background: theme.panel,
            top: '52%',
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
              <line x1="15" y1="10" x2="15" y2="18" stroke={theme.deny} strokeWidth={3} strokeLinecap="round" />
              <circle cx="15" cy="22.5" r="1.8" fill={theme.deny} />
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
      ) : null}
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
      {/* 三判定小抄（开源示教素材 Permission Desk 的信息结构）：allow / ask / deny 各带真实载荷 ——
          本幕上方只演了 ask 与 allow，这里把第三条补齐，路由器的三种出口一目了然。
          落位约束：小抄出现时（t2 > 0.4）闸门已整体上移 -150，GateRouter 的闸门名
          （`y - h - 18`）落在 y≈235–258、闸柱顶到 y≈272——小抄必须整体收在其上方，
          否则「三道闸门各自是什么」会被前两张卡盖掉（本幕只剩「问你」露出过）。 */}
      {t2 > 0.4 ? (
        <div
          style={{
            position: 'absolute',
            left: 120,
            // top:56 会把三张卡整体压在 SceneHeader 上——幕序「P3」与幕标题
            // 「执行之前，先过闸门」被 allow/ask 两张卡完全盖住（2026-08 帧级复查
            // f13080 实拍坐实）。抬头带含进度条到 y≈126，故小抄下移到 150；
            // 卡高约 108（10+30+26+23+10+边框），下沿 y≈258 仍收在闸门名
            // （y≈235–258）之上的约束由「闸门整体上移 -150」保障。
            top: 150,
            display: 'flex',
            gap: 18,
            opacity: interpolate(t2, [0.4, 0.8], [0, 1], {extrapolateRight: 'clamp'}),
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

/** 3-D 拒绝表降级为「示意」+ 变体绕过。
 *  金句卡改**底部叠加**（不整屏替换，为 3-D2 沙箱镜留画布）：p3-15 起 +18 帧以底部 Panel
 *  浮出、hold 70 帧淡出——代码卡与变体全程留在原位（分镜 3-D 规格）。 */
const DenyListHonesty: React.FC<{degradeAt: number; bypassAt: number; quoteAt: number}> = ({
  degradeAt,
  bypassAt,
  quoteAt,
}) => {
  const frame = useCurrentFrame();
  // 金句：底部 Panel 浮出（+18 帧起），hold 70 帧后淡出
  const quote = interpolate(frame - quoteAt, [0, 14, 70 + 14, 70 + 14 + 16], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
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
        {degraded ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: `2px dashed ${theme.dim}`,
              borderRadius: 14,
              pointerEvents: 'none',
            }}
          />
        ) : null}
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
            {'示教示意，不是安全边界'}
          </div>
        ) : null}
      </div>
      <div style={{width: 430}}>
        {variants.map((v, i) => {
          const t = interpolate(frame - bypassAt - i * 8, [0, 22], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
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
        {frame >= bypassAt ? (
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 10}}>
            {'换个拼法就绕过去了'}
          </div>
        ) : null}
      </div>
      {/* 金句卡：底部叠加（不整屏替换——下一镜 3-D2 沙箱接着用这块画布） */}
      {quote > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 210,
            display: 'flex',
            justifyContent: 'center',
            opacity: quote,
            transform: `translateY(${(1 - quote) * 16}px)`,
            pointerEvents: 'none',
          }}
        >
          <Panel accent={theme.deny} style={{padding: '18px 40px', background: theme.panel}}>
            <span style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.deny}}>
              {'它告诉你闸门装在哪儿，不是替你把门守住。'}
            </span>
          </Panel>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 3-D2 沙箱横切面（新镜，回答 3-D 金句抛出的问题）：左侧缩小的拒绝表代码卡，
 *  右侧圆角实心壳罩住「跑命令 + 子进程树」，上下两道边界带（文件/网络）。
 *  p3-19a 壳合拢；p3-19b 两道边界带各闪一次；p3-19c 三条变体飞向壳壁被弹回 +
 *  密钥箭头飞出边界（deny）——「拆掉任一道墙」的反例；p3-19d 压官方角标。 */
const SandboxCrossSection: React.FC<{
  shrinkAt: number;
  shellAt: number;
  bandsAt: number;
  bounceAt: number;
  noteAt: number;
}> = ({shrinkAt, shellAt, bandsAt, bounceAt, noteAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 代码卡缩至左侧 55%
  const shrink = interpolate(frame - shrinkAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 壳自四周合拢（spring）
  const shell = spring({frame: frame - shellAt, fps, config: {damping: 180}});
  // 两道边界带各闪一次（p3-19b）
  const bandOn = (i: number) =>
    interpolate(frame - bandsAt - i * 16, [0, 6, 22], [0.55, 1, 0.9], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  // 变体飞向壳壁被弹回（复用 3-D 轨迹，末端 8 帧反弹）
  const fly = interpolate(frame - bounceAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bounceBack = interpolate(frame - bounceAt - 26, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 密钥箭头飞出边界（deny）——「拆掉任一道墙」的反例
  const leak = interpolate(frame - bounceAt - 18, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const note = interpolate(frame - noteAt, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lines = [
    'DENY_LIST = [',
    '    "rm -rf /", "sudo", …',
    ']',
  ];
  const variants = ['rm  -rf  /', 'rm -fr /', 'sudo${IFS}rm'];
  // 壳几何：右侧画布中心
  const CX = 1240;
  const CY = 500;
  const W = 620;
  const H = 440;
  const halfW = W / 2 + (1 - shell) * 560;
  const halfH = H / 2 + (1 - shell) * 400;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 40, transform: `translateX(${shrink * -180}px)`}}>
        {/* 左：缩小的代码卡（3-D 的延续，画面 55% 区） */}
        <div style={{transform: `scale(${1 - shrink * 0.3})`, opacity: 0.5 + (1 - shrink) * 0.5}}>
          <CodeCard lines={lines} width={520} framesPerLine={1} showLineNumbers={false} accent={theme.dim} />
          {/* 变体列表：飞向壳壁（p3-19c 复用 3-D 轨迹） */}
          <div style={{marginTop: 26, paddingLeft: 10}}>
            {variants.map((v, i) => {
              if (fly <= 0) return null;
              const goX = interpolate(fly, [0, 1], [0, 300]);
              const backX = bounceBack * (1 - Math.min(1, bounceBack)) * -180 + bounceBack * -120;
              return (
                <div
                  key={v}
                  style={{
                    fontFamily: theme.mono,
                    fontSize: 24,
                    color: theme.deny,
                    marginBottom: 14,
                    opacity: fly > 0 ? 1 - bounceBack * 0.4 : 0,
                    transform: `translateX(${goX + backX + i * 14}px)`,
                  }}
                >
                  {v}
                </div>
              );
            })}
          </div>
        </div>
        {/* 右：沙箱壳（圆角实心壳罩住进程树） */}
        <svg width={760} height={620}>
          {/* 壳体：mech 描边 4px、rx=26、辉光，spring 合拢 */}
          <rect
            x={CX - halfW}
            y={CY - halfH}
            width={halfW * 2}
            height={halfH * 2}
            rx={26}
            fill={`${theme.mech}0d`}
            stroke={theme.mech}
            strokeWidth={4}
            opacity={shell}
            style={{filter: `drop-shadow(0 0 12px ${theme.mech}44)`}}
          />
          {/* 上下两道边界带（文件 / 网络——内核强制的两堵墙） */}
          {['文件：只许工作区', '网络：只走代管口子'].map((t, i) => {
            const top = i === 0;
            const o = bandOn(i) * shell;
            if (o <= 0) return null;
            return (
              <g key={t} opacity={o}>
                <line
                  x1={CX - halfW + 30}
                  y1={top ? CY - halfH + 34 : CY + halfH - 34}
                  x2={CX + halfW - 30}
                  y2={top ? CY - halfH + 34 : CY + halfH - 34}
                  stroke={theme.mech}
                  strokeWidth={3}
                  strokeDasharray="10 7"
                />
                <text
                  x={CX}
                  y={top ? CY - halfH + 22 : CY + halfH - 44}
                  textAnchor="middle"
                  fontFamily={theme.sans}
                  fontSize={21}
                  fill={theme.mech}
                >
                  {t}
                </text>
              </g>
            );
          })}
          {/* 壳内：跑命令 + 子进程树 */}
          <g opacity={shell}>
            <text x={CX} y={CY - 90} textAnchor="middle" fontFamily={theme.mono} fontSize={26} fill={theme.text}>
              {'bash'}
            </text>
            {[0, 1, 2].map((k) => (
              <g key={k}>
                <line
                  x1={CX}
                  y1={CY - 62}
                  x2={CX - 140 + k * 140}
                  y2={CY - 6}
                  stroke={theme.panelBorder}
                  strokeWidth={2.5}
                />
                <rect
                  x={CX - 190 + k * 140}
                  y={CY - 6}
                  width={100}
                  height={40}
                  rx={8}
                  fill={theme.panel}
                  stroke={theme.panelBorder}
                  strokeWidth={2}
                />
                <text
                  x={CX - 140 + k * 140}
                  y={CY + 20}
                  textAnchor="middle"
                  fontFamily={theme.mono}
                  fontSize={18}
                  fill={theme.dim}
                >
                  {['子进程', '子进程', '子进程'][k]}
                </text>
              </g>
            ))}
          </g>
          {/* 密钥箭头飞出边界（拆墙反例）：deny */}
          {leak > 0 && leak < 0.85 ? (
            <g>
              <line
                x1={CX + 60}
                y1={CY + 60}
                x2={CX + 60 + leak * 190}
                y2={CY + 60 - leak * 150}
                stroke={theme.deny}
                strokeWidth={4}
                strokeLinecap="round"
              />
              <polygon
                points={`${CX + 60 + leak * 190},${CY + 60 - leak * 150} ${CX + 48 + leak * 190},${CY + 52 - leak * 150} ${CX + 56 + leak * 190},${CY + 40 - leak * 150}`}
                fill={theme.deny}
              />
              <text x={CX + 90} y={CY + 96} fontFamily={theme.mono} fontSize={19} fill={theme.deny}>
                {'~/.ssh/id_rsa'}
              </text>
            </g>
          ) : null}
          {leak >= 0.85 ? (
            <text x={CX + 130} y={CY - 40} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fill={theme.deny}>
              {'拆掉一道墙：密钥直接飞出'}
            </text>
          ) : null}
        </svg>
      </div>
      {/* p3-19d 官方角标 */}
      <Footnote delay={noteAt}>
        {'Seatbelt / bubblewrap + socat · 权限提示 −84%（官方工程博客，取数 2025-10）'}
      </Footnote>
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
  const arc = interpolate(frame - arcAt, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const breathe = 0.5 + 0.5 * Math.sin(frame / 8);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative'}}>
        <div style={{display: 'grid', gridTemplateColumns: '340px 340px', gap: 24}}>
          {cells.map((c, i) => {
            const fourth = i === 3;
            const on = fourth ? frame >= fourthAt : true;
            const e = spring({frame: frame - (fourth ? fourthAt : i * 5), fps, config: {damping: 200}});
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
        {/* 「不表态 → 问你」的回连弧走**格子外侧**（右缘之外）。
            旧弧 M400 210 C520 210,560 120,470 96 起点落在第四格内部，
            整条弧横穿「不表态」四个大字、「兜底」二字又压在格内（2026-08
            帧级复查 f14473 实拍坐实）。改为自第四格右缘中点出发、绕右侧
            外空白上行、收在第二格（拒绝）右缘——全程 x ≥ 704 = 格阵右缘，
            与任何文字零相交。 */}
        {arc > 0 ? (
          <svg width={900} height={330} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
            <path
              d="M 704 268 C 790 268, 800 190, 790 150 C 782 118, 750 106, 704 106"
              stroke={theme.mech}
              strokeWidth={4}
              fill="none"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - arc}
            />
            {arc > 0.9 ? (
              <>
                {/* 箭头收口指回「拒绝/问你」一侧 */}
                <path d="M704 106 l14 -7 v14 Z" fill={theme.mech} />
                <text x={806} y={196} fontFamily={theme.sans} fontSize={24} fill={theme.mech}>
                  {'兜底'}
                </text>
              </>
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
  // 光点沿三站行进；在第二幕演示里被第①站截获
  const travel = interpolate(frame - ballAt, [0, 46], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hit = frame >= denyHitAt;
  const naked = frame >= nakedAt;
  const orderOn = interpolate(frame - orderAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
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
          const e = spring({frame: frame - at, fps, config: {damping: 200}});
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
              opacity: interpolate(frame - nakedAt, [0, 14], [0, 1], {extrapolateRight: 'clamp'}),
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
 *  评它做了什么，而非它说了什么；网页注入的文本骗不到审判者。
 *  右上成绩单卡（p3-31a/b）：快筛误杀率 8.5% → 复核 0.4%（两段对照，220px 轨道）。 */
const ClassifierVision: React.FC<{
  scrollAt: number;
  reportAt: number;
  barAt: number;
  stripAt: number;
  goldenAt: number;
  spoofAt: number;
}> = ({scrollAt, reportAt, barAt, stripAt, goldenAt, spoofAt}) => {
  const frame = useCurrentFrame();
  const rows = [
    {t: '模型的自我辩解：我确认这是安全的操作', why: '辩解不看', strike: true},
    {t: '工具结果：tests/ 42 passed, 0 failed', why: '结果不看', strike: true},
    {t: '工具调用描述：准备执行 npm install', why: '描述不看', strike: true},
    {t: '用户消息：帮我把依赖装上', why: '', strike: false},
    {t: '裸命令：npm install --save-dev vitest', why: '', strike: false},
  ];
  const spoofOn = frame >= spoofAt;
  const golden = interpolate(frame - goldenAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 成绩单卡（p3-31a 浮出）
  const report = interpolate(frame - reportAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 误杀率色条：deny→core 从 8.5% 宽收到 0.4% 宽（p3-31b，220px 轨道）
  const TRACK = 220;
  const shrinkBar = interpolate(frame - barAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const barPct = 0.085 + (0.004 - 0.085) * shrinkBar;
  const stage2On = interpolate(frame - barAt - 16, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
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
        {/* 右上成绩单卡（p3-31a/b） */}
        {report > 0 ? (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: -16,
              width: 420,
              opacity: report,
              transform: `translateY(${(1 - report) * -14}px)`,
            }}
          >
            <Panel accent={theme.deny} style={{padding: '16px 20px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.text}}>
                {'审判者的成绩单'}
              </div>
              {/* 误杀率色条：220px 轨道，deny→core */}
              <div style={{marginTop: 14}}>
                <div style={{width: TRACK, height: 18, borderRadius: 9, background: theme.panelBorder, overflow: 'hidden'}}>
                  <div
                    style={{
                      width: `${Math.max(0.4, barPct * 100 * 2)}%`,
                      height: '100%',
                      background: shrinkBar > 0.6 ? theme.core : theme.deny,
                    }}
                  />
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', width: TRACK, marginTop: 8}}>
                  <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>
                    {'快筛 8.5%'}
                  </span>
                  <span
                    style={{
                      fontFamily: theme.sans,
                      fontSize: 19,
                      color: theme.core,
                      opacity: stage2On,
                    }}
                  >
                    {'复核 0.4%'}
                  </span>
                </div>
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontFamily: theme.mono,
                  fontSize: 17,
                  color: theme.dim,
                  opacity: stage2On,
                }}
              >
                {'Stage1 FPR 8.5% → Stage2 0.4%（官方工程博客，取数 2026-03）'}
              </div>
            </Panel>
          </div>
        ) : null}
        <div style={{display: 'flex', flexDirection: 'column', gap: 14, width: 900}}>
          {rows.map((r, i) => {
            const at = scrollAt + i * 9;
            const e = interpolate(frame - at, [0, 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
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
        {/* 反例帧：伪装的「用户早就批准了」被视野边界弹回 */}
        {spoofOn ? (
          <svg width={1360} height={120} style={{position: 'absolute', left: 0, bottom: -60}}>
            {(() => {
              const t2 = interpolate(frame - spoofAt, [0, 30], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const x = 200 + t2 * 900;
              const rejected = t2 > 0.75;
              return (
                <g>
                  <rect
                    x={x}
                    y={40}
                    width={rejected ? 0 : 300 * (1 - Math.max(0, (t2 - 0.75) * 4))}
                    height={44}
                    rx={8}
                    fill={theme.panel}
                    stroke={theme.deny}
                    strokeWidth={2}
                    opacity={rejected ? 0 : 1}
                  />
                  {t2 < 0.75 ? (
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
  /** 句尾锚（全局帧）：分镜「pX-YY 尾（+N 帧）」的机械化落点 */
  const endAt = (id: string) => w(id).from + w(id).durationInFrames;
  /** 句尾锚封顶进 Sequence 窗口（末句 +N 会探出窗口——窗口只含句间 gap）：
   *  cap 为「窗口末尾 − need 帧可见」，动效仍发生不被剪掉。 */
  const tailAt = (b: {from: number; durationInFrames: number}, id: string, plus: number, need: number) =>
    Math.min(endAt(id) + plus - b.from, b.durationInFrames - need);
  const bA = w('p3-01', 'p3-06');
  const bB = w('p3-07', 'p3-09');
  const bC = w('p3-10', 'p3-12');
  const bD = w('p3-14', 'p3-15');
  const bD2 = w('p3-19a', 'p3-19d');
  const bE = w('p3-20', 'p3-24');
  const bF = w('p3-25', 'p3-29');
  const bG = w('p3-30', 'p3-35');
  return (
    <AbsoluteFill>
      <SceneHeader index="P3" title="执行之前，先过闸门" meta="Permissions · deny → ask → allow" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="3-A 没人管的跑命令">
        {/* p3-05 已删：执行节点反讽锚点改挂 p3-04 句尾 +16 帧 */}
        <UnguardedShell
          frameAt={rel(bA, 'p3-02')}
          cmdAt={rel(bA, 'p3-04')}
          execAt={endAt('p3-04') + 16 - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B 三道闸门落下">
        <GatesFall
          gateAt={[rel(bB, 'p3-08'), rel(bB, 'p3-08') + 14, rel(bB, 'p3-08') + 28]}
          bounceAt={rel(bB, 'p3-09')}
        />
      </Sequence>
      <Sequence {...bC} name="3-C 审批与放行">
        {/* p3-13 已删：畅通通路锚点改挂 p3-12 句尾 +25 帧（「弃权不等于放行」由 3-E 承载）。
            p3-12 是本 beat 末句——封顶到窗口末尾留 34 帧可见尾迹动画。 */}
        <AskAndPass askAt={rel(bC, 'p3-12')} passAt={tailAt(bC, 'p3-12', 25, 34)} />
      </Sequence>
      <Sequence {...bD} name="3-D 拒绝表的诚实">
        {/* p3-16..19 已删：降级/绕过/金句全部压在 p3-14/15 两句的句内偏移上（分镜 3-D 规格） */}
        <DenyListHonesty
          degradeAt={rel(bD, 'p3-14') + 14}
          bypassAt={rel(bD, 'p3-14') + 30}
          quoteAt={rel(bD, 'p3-15') + 18}
        />
      </Sequence>
      <Sequence {...bD2} name="3-D2 沙箱横切面">
        {/* p3-19a 代码卡缩位+壳合拢；19b 边界带；19c 变体弹回+密钥反例；19d 角标 */}
        <SandboxCrossSection
          shrinkAt={rel(bD2, 'p3-19a')}
          shellAt={rel(bD2, 'p3-19a') + 8}
          bandsAt={rel(bD2, 'p3-19b')}
          bounceAt={rel(bD2, 'p3-19c')}
          noteAt={rel(bD2, 'p3-19d')}
        />
      </Sequence>
      <Sequence {...bE} name="3-E 四种结果">
        <FourResults fourthAt={rel(bE, 'p3-23')} arcAt={rel(bE, 'p3-24')} />
      </Sequence>
      <Sequence {...bF} name="3-F 官方求值顺序">
        {/* p3-27 已删：拒绝站截获锚点前挂到 p3-26 句尾 +30 帧 */}
        <EvalOrder
          orderAt={rel(bF, 'p3-25')}
          ballAt={rel(bF, 'p3-26')}
          denyHitAt={endAt('p3-26') + 30 - bF.from}
          nakedAt={rel(bF, 'p3-28')}
        />
      </Sequence>
      <Sequence {...bG} name="3-G auto 分类器视野">
        {/* p3-33 已删：末两行高亮锚点并入 p3-32 +20 帧；31a/b 成绩单卡随动 */}
        <ClassifierVision
          scrollAt={rel(bG, 'p3-31')}
          reportAt={rel(bG, 'p3-31a')}
          barAt={rel(bG, 'p3-31b')}
          stripAt={rel(bG, 'p3-32')}
          goldenAt={rel(bG, 'p3-32') + 20}
          spoofAt={rel(bG, 'p3-34')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
