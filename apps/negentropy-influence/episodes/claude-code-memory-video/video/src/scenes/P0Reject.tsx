/** P0 一次拒收（分镜 0-A…0-D）
 *  痛点：终端干活到一半报错砸落；随身带的对话把窗口容器灌满（开局就不空——官方
 *  装载清单七项 + 斜纹基底层），撞上「拒收」墙；上下文腐坏双轴（召回曲线下滑 +
 *  注意力 n² 摊薄）；官方四件套标尺钉「上下文管理」格；两层答案画中画预告。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {HarnessScale} from '../components/HarnessScale';
import {Footnote, Panel, PaperCard, SceneHeader, Terminal} from '../components/motifs';

/** 0-A 系列终端：命令链滚动 → 一行 deny 报错砸落（画面压暗一档、光标停闪） */
const ErrorSlam: React.FC<{errAt: number}> = ({errAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const hit = spring({frame: frame - errAt, fps, config: {damping: 14}});
  // 报错砸落后画面压暗一档（不换色，只降亮度）
  const dim = 1 - 0.32 * hit;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', opacity: dim, transform: `translateY(${hit * 10}px)`}}>
        <Terminal
          width={1300}
          height={380}
          cps={30}
          freezeCursorAt={errAt}
          lines={[
            {prompt: '›', text: '把这个项目整体梳理一遍，先看配置和主要脚本', delay: 4},
            {text: 'Read settings.py   Read cli.py   Read worker.py …', color: theme.dim, delay: 66},
            {text: 'Read auth.py  Read models.py  Read api.py …', color: theme.dim, delay: 102},
            {text: 'error: prompt_too_long', color: theme.deny, delay: errAt},
          ]}
        />
        {/* 拒收角标：砸落瞬间从报错行弹出 */}
        {hit > 0 ? (
          <div
            style={{
              position: 'absolute',
              right: -58,
              bottom: -44,
              opacity: hit,
              transform: `scale(${0.5 + 0.5 * hit}) rotate(${(1 - hit) * -14}deg)`,
            }}
          >
            <div
              style={{
                padding: '12px 26px',
                border: `3px solid ${theme.deny}`,
                borderRadius: 10,
                background: theme.denyDeep,
                fontFamily: theme.mono,
                fontSize: 30,
                fontWeight: 700,
                color: theme.deny,
                whiteSpace: 'nowrap',
              }}
            >
              {'拒收'}
            </div>
          </div>
        ) : null}
      </div>
      <Footnote delay={errAt}>{'Context Compact · "Context Will Fill Up"'}</Footnote>
    </AbsoluteFill>
  );
};

/** 0-B 开局装载清单（官方示意值 · context-window 页 · 取数 2026-08）。
 *  p0-05a 起左侧终端降至 0.35、同位淡入七行等宽清单；行尾三档可见性徽章——
 *  终端可见／一行摘要／不可见（官方 VIS_META：full／brief／hidden）。 */
const STARTUP_LOAD: {t: string; n: string; vis: 'full' | 'brief' | 'hidden'; hl?: boolean}[] = [
  {t: '基本设定', n: '4,200', vis: 'hidden', hl: true},
  {t: '自动记忆索引', n: '680', vis: 'hidden'},
  {t: '环境信息', n: '280', vis: 'hidden'},
  {t: '工具名', n: '120', vis: 'hidden'},
  {t: '技能描述', n: '450', vis: 'hidden'},
  {t: '用户级规则', n: '320', vis: 'hidden'},
  {t: '项目规则', n: '1,800', vis: 'hidden'},
];
const VIS_LABEL: Record<'full' | 'brief' | 'hidden', string> = {
  full: '终端可见',
  brief: '一行摘要',
  hidden: '不可见',
};

/** 0-B 左终端缩角 + 右玻璃容器：随身携带的色块逐句灌入 → 液面撞顶、边框闪 deny。
 *  p0-05a 起终端让位给「开局装载清单」；容器底部升起约 10% 高斜纹基底层标「开局已装」；
 *  p0-05b「4,200」行 core 高亮并与基底层连线（画面实证口播的「光基本设定就四千多字」）。 */
const WindowFills: React.FC<{pourAt: number[]; topAt: number; loadAt: number; ledgerAt: number}> = ({
  pourAt,
  topAt,
  loadAt,
  ledgerAt,
}) => {
  const frame = useCurrentFrame();
  const CW = 560;
  const CH = 620;
  const listIn = interpolate(frame - loadAt, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // p0-05b：4,200 行高亮 + 与基底层连线
  const hlT = interpolate(frame - ledgerAt, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 斜纹基底层：约 10% 高，loadAt 后自底升起
  const baseH = interpolate(frame - loadAt, [0, 16], [0, CH * 0.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fillH = Math.min(CH - baseH, pourAt.filter((a) => frame >= a).length * ((CH - baseH) / pourAt.length));
  const slammed = frame >= topAt;
  const flash = slammed ? 0.5 + 0.5 * Math.abs(Math.sin((frame - topAt) / 4)) : 0;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 120}}>
      <div style={{position: 'relative'}}>
        {/* 左：终端（p0-05a 起降 0.35 让位）+ 同位浮出开局装载清单 */}
        <div style={{opacity: 1 - listIn * 0.65}}>
          <Terminal
            width={760}
            height={430}
            cps={28}
            lines={[
              {prompt: '›', text: '梳理这个项目', delay: 4},
              {text: 'Read 大文件 ×1   Read 小文件 ×30', color: theme.dim, delay: 30},
              {text: 'bash ×20 ……', color: theme.dim, delay: 74},
            ]}
          />
        </div>
        {listIn > 0 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: listIn,
            }}
          >
            <Panel style={{padding: '22px 30px', width: 700}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12}}>
                <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.core}}>{'开局装载清单'}</span>
                <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'你还没敲第一个字'}</span>
              </div>
              {STARTUP_LOAD.map((r, i) => {
                const e = interpolate(frame - loadAt - 6 - i * 5, [0, 10], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                const hot = r.hl && hlT > 0;
                return (
                  <div
                    key={r.t}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      height: 33,
                      opacity: e,
                    }}
                  >
                    <span
                      style={{
                        width: 200,
                        fontFamily: theme.mono,
                        fontSize: 19,
                        color: hot ? theme.core : theme.text,
                        fontWeight: hot ? 700 : 400,
                        borderLeft: hot ? `3px solid ${theme.core}` : '3px solid transparent',
                        paddingLeft: 8,
                      }}
                    >
                      {r.t}
                    </span>
                    <span
                      style={{
                        width: 90,
                        textAlign: 'right',
                        fontFamily: theme.mono,
                        fontSize: 19,
                        color: hot ? theme.core : theme.dim,
                        fontWeight: hot ? 700 : 400,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {r.n}
                    </span>
                    {/* 三档可见性徽章 */}
                    <span
                      style={{
                        marginLeft: 'auto',
                        padding: '2px 9px',
                        borderRadius: 5,
                        border: `1.5px solid ${r.vis === 'full' ? theme.keep : r.vis === 'brief' ? theme.mech : theme.panelBorder}`,
                        fontFamily: theme.mono,
                        fontSize: 13,
                        color: r.vis === 'full' ? theme.keep : r.vis === 'brief' ? theme.mech : theme.dim,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {VIS_LABEL[r.vis]}
                    </span>
                  </div>
                );
              })}
            </Panel>
          </div>
        ) : null}
      </div>
      <div style={{position: 'relative'}}>
        {/* 玻璃容器（窗口）：被随身携带的色块灌满 */}
        <div
          style={{
            width: CW,
            height: CH,
            borderRadius: 20,
            border: `4px ${slammed ? 'solid' : 'solid'} ${slammed ? theme.deny : theme.panelBorder}`,
            background: 'rgba(255,255,255,0.02)',
            overflow: 'hidden',
            boxShadow: slammed ? `0 0 ${Math.round(36 * flash)}px ${theme.deny}` : 'none',
            position: 'relative',
          }}
        >
          {/* 液面：读文件/跑命令的色块按句节奏注入、层层堆高（不用色相区分——中性灰阶块） */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: baseH,
              height: fillH,
              display: 'flex',
              flexDirection: 'column-reverse',
            }}
          >
            {pourAt.map((a, i) => (
              <div
                key={a}
                style={{
                  height: Math.max(2, (CH - baseH) / pourAt.length - 6),
                  margin: 3,
                  borderRadius: 6,
                  background: theme.text,
                  opacity: frame >= a ? 0.16 + 0.14 * ((i % 3) / 2) : 0,
                }}
              />
            ))}
          </div>
          {/* 斜纹基底层：开局已装（系统装载垫底，后来的对话压其上） */}
          {baseH > 0 ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: baseH,
                background: `repeating-linear-gradient(45deg, ${theme.panelBorder} 0 8px, transparent 8px 16px)`,
                borderTop: `2px solid ${hlT > 0 ? theme.core : theme.panelBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  padding: '1px 10px',
                  background: theme.bg,
                  fontFamily: theme.mono,
                  fontSize: 15,
                  color: hlT > 0 ? theme.core : theme.dim,
                  whiteSpace: 'nowrap',
                }}
              >
                {'开局已装'}
              </span>
            </div>
          ) : null}
          {/* 顶部「拒收」墙 */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: 10,
              background: slammed ? theme.deny : theme.panelBorder,
              opacity: slammed ? 0.6 + 0.4 * flash : 0.8,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 16,
              top: 22,
              fontFamily: theme.mono,
              fontSize: 24,
              color: slammed ? theme.deny : theme.dim,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {`${Math.round((fillH / CH) * 100)}%`}
          </div>
        </div>
        <div
          style={{
            marginTop: 18,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 24,
            color: theme.dim,
          }}
        >
          {'窗口容器'}
        </div>
        {slammed ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: CH / 2 - 60,
              textAlign: 'center',
              fontFamily: theme.serif,
              fontSize: 44,
              fontWeight: 700,
              color: theme.deny,
              opacity: interpolate(frame - topAt, [4, 16], [0, 1], {
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {'前面全白干'}
          </div>
        ) : null}
      </div>
      <Footnote delay={loadAt}>{'官方示意值 · context-window 页 · 取数 2026-08'}</Footnote>
    </AbsoluteFill>
  );
};

/** 0-C 上下文腐坏双轴（官方工程博客 · 取数 2026-08）：
 *  右轴：X 窗口字数（log 刻度）/ Y 翻旧账准确度——曲线描出并单调下滑，尾段趋平
 *  （渐变非悬崖）；p0-09c deny 衬线压字「能装 ≠ 能记」。
 *  左轴：注意力关系图 4 节点→8→16，边数角标 6→28→120；p0-09b 全部边
 *  opacity 0.9→0.35、线宽收细——顶部「注意力预算＝1 份」定宽条不随节点增长。 */
const ContextRot: React.FC<{curveAt: number; graphAt: number; thinAt: number; stampAt: number}> = ({
  curveAt,
  graphAt,
  thinAt,
  stampAt,
}) => {
  const frame = useCurrentFrame();
  // 曲线描线（strokeDashoffset 反推）
  const curveP = interpolate(frame - curveAt, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 关系图三档：4 节点 → 8 节点 → 16 节点（示意）。档位边界即各档起点——
  // stageT 从**本档起点**起算，跨档瞬间新档网络淡入（旧档直接换轨，档间不重影）。
  const STAGE_AT = [graphAt, graphAt + 34, graphAt + 74];
  const stage = frame < STAGE_AT[1] ? 0 : frame < STAGE_AT[2] ? 1 : 2;
  const nodeCount = [4, 8, 16][stage];
  const edgeCount = [6, 28, 120][stage];
  const thin = interpolate(frame - thinAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const stageT = interpolate(frame - STAGE_AT[stage], [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 右轴曲线：单调下滑、尾段趋平（渐变非悬崖）
  const curvePts: [number, number][] = [];
  for (let k = 0; k <= 20; k++) {
    const x = k / 20;
    // ease-out 下滑：前 60% 掉七成、后 40% 只掉半成——尾段趋平
    const y = 1 - (1 - Math.pow(1 - Math.pow(x, 0.62), 2.2));
    curvePts.push([x, y]);
  }
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 110, alignItems: 'center'}}>
        {/* 左：注意力关系图（n² 摊薄） */}
        <div style={{width: 640}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
            <span style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.text}}>
              {'注意力关系图'}
            </span>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 24,
                color: theme.core,
                fontVariantNumeric: 'tabular-nums',
                opacity: stageT,
              }}
            >
              {`${nodeCount} 节点 · ${edgeCount} 边`}
            </span>
          </div>
          {/* 顶部定宽预算条：不随节点数增长（摊薄的对照物） */}
          <div style={{marginTop: 18, display: 'flex', alignItems: 'center', gap: 12}}>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'注意力预算'}</span>
            <div style={{width: 300, height: 12, borderRadius: 6, background: theme.panelBorder, overflow: 'hidden'}}>
              <div style={{width: '100%', height: '100%', background: theme.core, opacity: 0.85}} />
            </div>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.core}}>{'＝ 1 份'}</span>
          </div>
          <div style={{position: 'relative', width: 640, height: 460, marginTop: 10}}>
            <svg width={640} height={460}>
              {/* 圆周布点：节点数随 stage 变化，边全连接 */}
              {(() => {
                const cx = 320;
                const cy = 230;
                const R = 200;
                const nodes: [number, number][] = Array.from({length: nodeCount}, (_, i) => {
                  const a = (2 * Math.PI * i) / nodeCount - Math.PI / 2;
                  return [cx + R * Math.cos(a), cy + R * Math.sin(a)] as [number, number];
                });
                return (
                  <>
                    {nodes.flatMap((p1, i) =>
                      nodes.slice(i + 1).map((p2, j) => (
                        <line
                          key={`${i}-${j}`}
                          x1={p1[0]}
                          y1={p1[1]}
                          x2={p2[0]}
                          y2={p2[1]}
                          stroke={theme.core}
                          strokeWidth={4 - thin * 2.5}
                          strokeOpacity={(0.9 - thin * 0.55) * stageT}
                        />
                      )),
                    )}
                    {nodes.map((p, i) => (
                      <circle
                        key={i}
                        cx={p[0]}
                        cy={p[1]}
                        r={10 - thin * 3}
                        fill={theme.text}
                        opacity={(0.85 - thin * 0.25) * stageT}
                      />
                    ))}
                  </>
                );
              })()}
            </svg>
          </div>
        </div>
        {/* 右：召回曲线坐标系 */}
        <div style={{width: 700}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
            <span style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.text}}>
              {'翻旧账准确度'}
            </span>
          </div>
          <svg width={700} height={470} style={{marginTop: 14}}>
            {/* 坐标轴 */}
            <line x1={70} y1={20} x2={70} y2={400} stroke={theme.panelBorder} strokeWidth={2.5} />
            <line x1={70} y1={400} x2={660} y2={400} stroke={theme.panelBorder} strokeWidth={2.5} />
            <text x={54} y={34} fill={theme.dim} fontSize={19} fontFamily={theme.mono}>
              {'高'}
            </text>
            <text x={54} y={404} fill={theme.dim} fontSize={19} fontFamily={theme.mono}>
              {'低'}
            </text>
            <text x={70} y={434} fill={theme.dim} fontSize={19} fontFamily={theme.mono}>
              {'窗口字数 →'}
            </text>
            {/* X 轴 log 刻度 */}
            {[0, 1, 2, 3, 4].map((k) => (
              <g key={k}>
                <line x1={70 + k * 147.5} y1={400} x2={70 + k * 147.5} y2={408} stroke={theme.panelBorder} strokeWidth={2} />
                <text
                  x={70 + k * 147.5}
                  y={430}
                  textAnchor="middle"
                  fill={theme.dim}
                  fontSize={16}
                  fontFamily={theme.mono}
                >
                  {['10³', '10⁴', '10⁵', '10⁶', '10⁷'][k]}
                </text>
              </g>
            ))}
            {/* 召回曲线：strokeDashoffset 反推描线 */}
            {(() => {
              const X0 = 70;
              const X1 = 660;
              const Y0 = 46;
              const Y1 = 392;
              const d = curvePts.map(([x, y], i) => {
                const px = X0 + x * (X1 - X0);
                const py = Y1 - y * (Y1 - Y0);
                return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
              });
              const LEN = 2000;
              return (
                <>
                  <path
                    d={d.join(' ')}
                    fill="none"
                    stroke={theme.core}
                    strokeWidth={5}
                    strokeLinecap="round"
                    pathLength={LEN}
                    strokeDasharray={LEN}
                    strokeDashoffset={LEN * (1 - curveP)}
                  />
                  {/* 尾段趋平注记（渐变非悬崖） */}
                  <text
                    x={X1 - 10}
                    y={Y1 - yOf(1) * (Y1 - Y0) - 18}
                    textAnchor="end"
                    fill={theme.dim}
                    fontSize={18}
                    fontFamily={theme.mono}
                    opacity={curveP > 0.9 ? 1 : 0}
                  >
                    {'趋平 · 不是悬崖'}
                  </text>
                </>
              );
              function yOf(x: number): number {
                return 1 - (1 - Math.pow(1 - Math.pow(x, 0.62), 2.2));
              }
            })()}
          </svg>
        </div>
      </div>
      {/* p0-09c 压字 */}
      {frame >= stampAt ? (
        <div
          style={{
            position: 'absolute',
            fontFamily: theme.serif,
            fontSize: 58,
            fontWeight: 700,
            color: theme.deny,
            opacity: interpolate(frame - stampAt, [0, 14], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            letterSpacing: 4,
          }}
        >
          {'能装 ≠ 能记'}
        </div>
      ) : null}
      <Footnote delay={curveAt}>{'召回精度随上下文变长下降 · 官方工程博客 · 取数 2026-08'}</Footnote>
    </AbsoluteFill>
  );
};

/** 0-D 两层答案画中画预告：左「桌面（会丢，管好丢）」右「登记簿（不丢）」+ 中央分隔线生长 */
const TwoAnswers: React.FC<{leftAt: number; rightAt: number; lineAt: number}> = ({
  leftAt,
  rightAt,
  lineAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const eL = spring({frame: frame - leftAt, fps, config: {damping: 200}});
  const eR = spring({frame: frame - rightAt, fps, config: {damping: 200}});
  const line = interpolate(frame - lineAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const F = 0.66; // 画中画缩放系数（字号 52→~34、30→~20，仍可读；700×0.66=462 两侧并排不挤）
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1660, height: 560}}>
        {/* 左：桌面（会丢的那层）——桌上纸卡，其中几张褪色 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 40,
            width: 700,
            opacity: eL,
            transform: `scale(${F}) translateY(${(1 - eL) * 40}px)`,
            transformOrigin: 'left center',
          }}
        >
          <div style={{position: 'relative', width: 700, height: 460}}>
            <Panel style={{width: '100%', height: '100%', borderRadius: 18}} />
            <div style={{position: 'absolute', left: 36, top: 30, display: 'flex', flexWrap: 'wrap', gap: 12, width: 628}}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <PaperCard key={i} w={138} h={86} tone={i < 2 ? 'full' : i < 5 ? 'half' : 'faded'} />
              ))}
            </div>
            <div
              style={{
                position: 'absolute',
                left: 36,
                bottom: 22,
                fontFamily: theme.mono,
                fontSize: 24,
                color: theme.dim,
              }}
            >
              {'桌面 · 对话历史'}
            </div>
          </div>
          <div
            style={{
              marginTop: 26,
              fontFamily: theme.serif,
              fontSize: 52,
              fontWeight: 700,
              color: theme.text,
            }}
          >
            {'第一层：承认会丢'}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, marginTop: 10}}>
            {'把丢管起来——分级、有序、有保底'}
          </div>
        </div>
        {/* 右：登记簿（不丢的那层）——keep 描边本子 */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 40,
            width: 700,
            opacity: eR,
            transform: `scale(${F}) translateY(${(1 - eR) * 40}px)`,
            transformOrigin: 'right center',
            display: 'flex',
            flexDirection: 'row',
            gap: 34,
            alignItems: 'center',
          }}
        >
          <svg width={240} height={330}>
            <rect x={30} y={20} width={190} height={290} rx={12} fill={theme.panel} stroke={theme.keep} strokeWidth={4} />
            <rect x={30} y={20} width={26} height={290} rx={8} fill={theme.keepDeep} />
            {[0, 1, 2, 3].map((i) => (
              <line
                key={i}
                x1={78}
                y1={80 + i * 52}
                x2={190}
                y2={80 + i * 52}
                stroke={theme.keep}
                strokeWidth={4}
                strokeLinecap="round"
                opacity={0.75}
              />
            ))}
          </svg>
          <div>
            <div
              style={{
                fontFamily: theme.serif,
                fontSize: 52,
                fontWeight: 700,
                color: theme.keep,
              }}
            >
              {'第二层：保证不丢'}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, marginTop: 10, lineHeight: 1.5}}>
              {'另立账本，重要的写进去就不出来'}
            </div>
          </div>
        </div>
        {/* 中央分隔线生长——本集结构图 */}
        <div
          style={{
            position: 'absolute',
            left: 828,
            top: 60,
            height: 420 * line,
            width: 3,
            background: theme.panelBorder,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: -70,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 24,
            color: theme.dim,
            opacity: line,
          }}
        >
          {'两层咬合，才是完整答案'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P0Reject: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p0-01', 'p0-02');
  const relA = (id: string) => at(id) - bA.from;
  const bB = w('p0-04', 'p0-06');
  const relB = (id: string) => at(id) - bB.from;
  const bC = w('p0-09', 'p0-09c');
  const relC = (id: string) => at(id) - bC.from;
  const bC2 = w('p0-10', 'p0-11');
  const relC2 = (id: string) => at(id) - bC2.from;
  const bD = w('p0-13', 'p0-15');
  const relD = (id: string) => at(id) - bD.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P0" title="一次拒收" meta="prompt_too_long · context will fill up" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="0-A 终端报错砸落">
        <ErrorSlam errAt={relA('p0-02')} />
      </Sequence>
      <Sequence {...bB} name="0-B 窗口容器灌满撞拒收墙">
        <WindowFills
          pourAt={[relB('p0-04'), relB('p0-05'), relB('p0-05a'), relB('p0-05b')]}
          topAt={relB('p0-06')}
          loadAt={relB('p0-05a')}
          ledgerAt={relB('p0-05b')}
        />
      </Sequence>
      <Sequence {...bC} name="0-C 上下文腐坏双轴">
        <ContextRot
          curveAt={relC('p0-09')}
          graphAt={relC('p0-09a')}
          thinAt={relC('p0-09b')}
          stampAt={relC('p0-09c')}
        />
      </Sequence>
      <Sequence {...bC2} name="0-C2 四件套标尺">
        <HarnessScale dropAt={relC2('p0-10')} splitAt={relC2('p0-11')} />
      </Sequence>
      <Sequence {...bD} name="0-D 两层答案画中画预告">
        <TwoAnswers
          leftAt={relD('p0-14')}
          rightAt={relD('p0-15')}
          lineAt={relD('p0-15') + 16}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
