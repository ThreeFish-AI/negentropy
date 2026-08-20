/** P3 执行之前，先过闸门（分镜 3-A…3-G）—— 站点「Permission Desk」的概念重建
 *  三种结果不各占一色：allow 回 core（放行=回主干）、ask 用 mech、deny 用 danger。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
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
      <SceneTag chapter="s03 · Permission" tagline="Check Permissions Before Execution" />
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
      <div style={{opacity: asking ? 0.35 : 1}}>
        <GateRouter gates={[1, 1, 1]} travel={t1} blockedBy={2} />
      </div>
      {asking ? (
        <Panel
          accent={theme.mech}
          style={{position: 'absolute', width: 700, padding: '26px 30px', background: theme.panel}}
        >
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.mech}}>
            {'⚠  Potentially destructive command'}
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
            {'教学示意，不是安全边界'}
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
        {arc > 0 ? (
          <svg width={760} height={260} style={{position: 'absolute', left: -30, top: 30, pointerEvents: 'none'}}>
            <path
              d="M 400 210 C 520 210, 560 120, 470 96"
              stroke={theme.mech}
              strokeWidth={4}
              fill="none"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - arc}
            />
            {arc > 0.9 ? (
              <text x={545} y={165} fontFamily={theme.sans} fontSize={24} fill={theme.mech}>
                {'兜底'}
              </text>
            ) : null}
          </svg>
        ) : null}
      </div>
      <Footnote delay={fourthAt}>{'PermissionResult 四种 —— 课程作者的源码分析'}</Footnote>
    </AbsoluteFill>
  );
};

/** 3-F 八个来源叠成一摞 + 优先级箭头 */
const EightSources: React.FC<{stackAt: number; arrowAt: number; overrideAt: number}> = ({
  stackAt,
  arrowAt,
  overrideAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stack = ['你的全局配置', '这个项目的配置', '本地配置', '功能开关', '公司管理策略'];
  const side = ['启动参数', '内联命令', '会话授权'];
  const arrow = interpolate(frame - arrowAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const over = frame >= overrideAt;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 90}}>
      <div style={{position: 'relative', width: 520}}>
        {stack.map((s, i) => {
          const idx = stack.length - 1 - i; // 自下向上堆叠
          const at = stackAt + idx * 7;
          const e = spring({frame: frame - at, fps, config: {damping: 200}});
          const top = idx * -4;
          const isTop = idx === stack.length - 1;
          const dimmed = over && !isTop && idx !== stack.length - 2;
          return (
            <div
              key={s}
              style={{
                position: 'relative',
                marginTop: i === 0 ? 0 : 10,
                transform: `translateY(${(1 - e) * 26 + top}px)`,
                opacity: e * (dimmed ? 0.5 : 1),
              }}
            >
              <Panel
                accent={isTop && arrow > 0.85 ? theme.mech : theme.panelBorder}
                style={{
                  padding: '16px 22px',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
                  background: isTop && arrow > 0.85 ? theme.mechDeep : theme.panel,
                }}
              >
                <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{s}</span>
              </Panel>
            </div>
          );
        })}
        {arrow > 0 ? (
          <svg width={70} height={330} style={{position: 'absolute', left: -60, top: 6}}>
            <line
              x1={35}
              y1={320}
              x2={35}
              y2={320 - 300 * arrow}
              stroke={theme.mech}
              strokeWidth={4}
            />
            <polygon
              points={`35,${320 - 300 * arrow} 27,${332 - 300 * arrow} 43,${332 - 300 * arrow}`}
              fill={theme.mech}
              opacity={arrow > 0.2 ? 1 : 0}
            />
          </svg>
        ) : null}
        {over ? (
          <div
            style={{
              position: 'absolute',
              right: -34,
              top: 26,
              fontFamily: theme.sans,
              fontSize: 24,
              color: theme.mech,
            }}
          >
            {'压过 ↓'}
          </div>
        ) : null}
      </div>
      <div>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginBottom: 12}}>
          {'另有三个旁路'}
        </div>
        {side.map((s, i) => (
          <Panel
            key={s}
            style={{
              padding: '12px 20px',
              marginBottom: 10,
              opacity: interpolate(frame - stackAt - 30 - i * 6, [0, 12], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{s}</span>
          </Panel>
        ))}
      </div>
      <Footnote delay={arrowAt}>
        {'user < project < local < flag < policy —— 课程作者的源码分析'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 3-G 自动批准三级漏斗 + 末端刹车 */
const AutoApprove: React.FC<{funnelAt: number; travelAt: number; brakeAt: number}> = ({
  funnelAt,
  travelAt,
  brakeAt,
}) => {
  const frame = useCurrentFrame();
  const stages = [
    {t: '按更宽松的模式试判', w: 900},
    {t: '查安全工具白名单', w: 700},
    {t: '交给一个小模型判断', w: 500},
  ];
  const braked = frame >= brakeAt;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16}}>
        {stages.map((s, i) => {
          const at = funnelAt + i * 10;
          const on = frame >= at;
          const passing = frame >= travelAt + i * 14 && frame < travelAt + i * 14 + 14;
          return (
            <div key={s.t} style={{position: 'relative', opacity: on ? 1 : 0.15}}>
              <Panel
                accent={passing ? theme.mech : theme.panelBorder}
                style={{
                  width: s.w,
                  padding: '18px 24px',
                  textAlign: 'center',
                  background: passing ? theme.mechDeep : theme.panel,
                }}
              >
                <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{s.t}</span>
              </Panel>
              {on ? (
                <div
                  style={{
                    position: 'absolute',
                    right: -104,
                    top: 20,
                    fontFamily: theme.sans,
                    fontSize: 21,
                    color: theme.core,
                  }}
                >
                  {'命中即出'}
                </div>
              ) : null}
            </div>
          );
        })}
        <div style={{display: 'flex', gap: 12, marginTop: 6}}>
          {[0, 1, 2].map((i) => {
            const at = brakeAt - 30 + i * 9;
            return (
              <span
                key={i}
                style={{
                  fontSize: 34,
                  fontWeight: 700,
                  color: theme.deny,
                  opacity: frame >= at ? 1 : 0,
                }}
              >
                {'✗'}
              </span>
            );
          })}
        </div>
        {braked ? (
          <Panel accent={theme.core} style={{padding: '16px 30px', marginTop: 4}}>
            <span style={{fontFamily: theme.serif, fontSize: 34, color: theme.core, fontWeight: 700}}>
              {'退回人工审批'}
            </span>
          </Panel>
        ) : null}
      </div>
      <Footnote delay={brakeAt}>{'让模型帮忙看门，但不敢把门全交给模型'}</Footnote>
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
      <Sequence {...bF} name="3-F 八个来源">
        <EightSources
          stackAt={rel(bF, 'p3-26')}
          arrowAt={rel(bF, 'p3-28')}
          overrideAt={rel(bF, 'p3-29')}
        />
      </Sequence>
      <Sequence {...bG} name="3-G 自动批准与刹车">
        <AutoApprove
          funnelAt={rel(bG, 'p3-31')}
          travelAt={rel(bG, 'p3-32')}
          brakeAt={rel(bG, 'p3-34')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
