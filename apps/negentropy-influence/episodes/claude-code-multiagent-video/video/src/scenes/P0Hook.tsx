/** P0 一个注意力，盖不住一个后端（分镜 0-A…0-C）
 *  系列开场惯例：终端里长出痛点，再拉镜回到系列视觉锚（环）。
 *  0-A 的孤环是本集唯一一次「没有队友的环」——全片对照的起点。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, SceneHeader, SceneTag, useRingDot} from '../components/motifs';

/** 0-A 终端任务清单溢出 → 拉镜：孤环悬在四个模块群中央，注意力只覆盖一小块 */
const OverflowThenZoom: React.FC<{zoomAt: number; cardsAt?: number}> = ({zoomAt, cardsAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dot = useRingDot(2.5);
  // 拉镜进度：0 终端满屏 → 1 环+四模块群全景
  const zoom = interpolate(frame - zoomAt, [0, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const zoomSpring = spring({frame: frame - zoomAt, fps, config: {damping: 200}});
  // 清单持续滚动加长（帧驱动，确定）：每 6 帧多露一行
  const shown = Math.floor(frame / 6);
  const mods = [
    {id: 'auth/', label: '认证', x: -560, y: -190},
    {id: 'db/', label: '数据库', x: 560, y: -190},
    {id: 'api/', label: '接口', x: -560, y: 210},
    {id: 'tests/', label: '测试', x: 560, y: 210},
  ];
  // 环的注意力光晕只盖住中心一小块（半径 = 环直径的一半略多）
  const ringR = 132;
  const glowR = ringR + 64;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 层一：终端（拉镜后缩到中央一小块，与环同域） */}
      <div
        style={{
          position: 'absolute',
          transform: `scale(${1 - zoomSpring * 0.62}) translateY(${zoomSpring * 56}px)`,
          opacity: 1 - zoomSpring * 0.88,
        }}
      >
        <Panel style={{width: 1240, height: 620, padding: 0, overflow: 'hidden'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 44,
              padding: '0 18px',
              borderBottom: `2px solid ${theme.panelBorder}`,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{width: 12, height: 12, borderRadius: 999, background: theme.panelBorder}}
              />
            ))}
            <div style={{marginLeft: 10, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
              {'tasks — 一个注意力'}
            </div>
          </div>
          <div
            style={{
              padding: '18px 24px',
              fontFamily: theme.mono,
              fontSize: 25,
              lineHeight: 1.62,
              height: 530,
              overflow: 'hidden',
            }}
          >
            {[
              '□ 翻新认证模块：迁移到新令牌方案',
              '□ 数据库：三张表加字段与索引',
              '□ 接口：路由全部改新认证',
              '□ 测试：认证与接口回归补齐',
              '□ 认证细节复核：过期刷新边界',
              '□ 数据库迁移脚本：兼容旧数据',
              '□ 接口契约：对外文档同步',
              '□ 测试夹具：新令牌生成器',
              '□ 认证：并发刷新竞态排查',
              '□ 数据库：慢查询复核',
              '□ 接口：错误码统一',
              '□ 测试：并发用例补齐',
              '□ …',
            ].map((ln, i) =>
              i < shown ? (
                <div key={i} style={{color: i < 4 ? theme.text : theme.dim, whiteSpace: 'pre'}}>
                  {ln}
                </div>
              ) : null,
            )}
          </div>
          {/* 滚动条缩成一根线：清单越长，滚动条越矮 */}
          <div
            style={{
              position: 'absolute',
              right: 10,
              top: 54,
              bottom: 12,
              width: 6,
              display: 'flex',
              justifyContent: 'flex-start',
            }}
          >
            <div
              style={{
                width: 6,
                height: Math.max(30, 460 - shown * 34),
                borderRadius: 6,
                background: theme.panelBorder,
              }}
            />
          </div>
        </Panel>
      </div>
      {/* 层二：孤环 + 四模块群（拉镜后浮现） */}
      {zoomSpring > 0.1 ? (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            opacity: (zoomSpring - 0.1) / 0.9,
          }}
        >
          <div style={{position: 'relative', width: 1500, height: 640}}>
            {/* 注意力光晕：只覆盖中心一小块（0-A 的核心画面语言） */}
            <svg width={1500} height={640} style={{position: 'absolute', left: 0, top: 0}}>
              <circle
                cx={750}
                cy={320}
                r={glowR}
                fill={theme.core}
                opacity={0.1 * zoom}
              />
              <circle
                cx={750}
                cy={320}
                r={glowR}
                fill="none"
                stroke={theme.core}
                strokeWidth={2}
                strokeDasharray="10 10"
                opacity={0.45 * zoom}
              />
            </svg>
            <div style={{position: 'absolute', left: 750 - 210, top: 320 - 210}}>
              <LoopRing size={420} draw={zoom} dotProgress={zoom > 0.98 ? dot : undefined} />
            </div>
            {mods.map((m, i) => {
              const on = interpolate(frame - zoomAt - 14 - i * 4, [0, 12], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              return (
                <div
                  key={m.id}
                  style={{
                    position: 'absolute',
                    left: 750 + m.x - 240,
                    top: 320 + m.y - 76,
                    width: 480,
                    height: 152,
                    opacity: on * zoom,
                  }}
                >
                  <Panel style={{padding: '16px 20px', width: '100%', height: '100%'}}>
                    <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{m.id}</div>
                    <div
                      style={{
                        fontFamily: theme.sans,
                        fontSize: 34,
                        fontWeight: 700,
                        color: theme.text,
                        marginTop: 8,
                      }}
                    >
                      {m.label}
                    </div>
                    <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 8}}>
                      {'翻新 · 未照看'}
                    </div>
                  </Panel>
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      ) : null}
      {/* 官方三失败模式症状卡（p0-03 句锚；Harness Engineering 改造） */}
      {cardsAt !== undefined ? <SymptomCards at={cardsAt} /> : null}
    </AbsoluteFill>
  );
};

/** 官方博客三失败模式：agentic laziness / self-preferential bias / goal drift */
const SymptomCards: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const cards = [
    {t: '干一半就宣布完成', sub: '进度条半途打勾', en: 'agentic laziness'},
    {t: '偏爱自己的产出', sub: '自评五星', en: 'self-preferential bias'},
    {t: '目标越走越散', sub: '链条逐级褪色', en: 'goal drift'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 26}}>
        {cards.map((c, i) => {
          const e = interpolate(frame - at - i * 9, [0, 14], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div key={c.t} style={{width: 380, opacity: e, transform: `translateX(${(1 - e) * 40}px)`}}>
              <Panel accent={theme.peer} style={{padding: '20px 22px'}}>
                <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{c.t}</div>
                <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 8}}>{c.sub}</div>
                <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.peer, marginTop: 10}}>{c.en}</div>
              </Panel>
            </div>
          );
        })}
      </div>
      <Footnote delay={at + 20}>
        {'三种失败模式 —— 官方博客《A harness for every task》'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 0-B 四问铭牌：四张空铭牌依次落下，末句闪出对应小图标预览（drawn SVG，无 emoji） */
const FourQuestions: React.FC<{iconAt: number}> = ({iconAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const questions = [
    {q: '活挂在哪里', en: 'WHERE', kind: 'board'},
    {q: '话从哪里走', en: 'HOW', kind: 'mailbox'},
    {q: '怎么谈判', en: 'WHEN', kind: 'handshake'},
    {q: '谁的桌子', en: 'WHOSE', kind: 'desk'},
  ];
  const showIcon = frame >= iconAt;
  // 各问的小图标预览（drawn SVG）：看板格 / 信箱投递口 / 编号握手 / 抽屉桌
  const Icon: React.FC<{kind: string}> = ({kind}) => {
    const c = theme.mech;
    if (kind === 'board') {
      return (
        <svg width={104} height={78}>
          <rect x={8} y={8} width={88} height={62} rx={7} fill="none" stroke={c} strokeWidth={4} />
          <line x1={8} y1={30} x2={96} y2={30} stroke={c} strokeWidth={3} />
          <line x1={38} y1={30} x2={38} y2={70} stroke={c} strokeWidth={3} />
          <line x1={70} y1={30} x2={70} y2={70} stroke={c} strokeWidth={3} />
        </svg>
      );
    }
    if (kind === 'mailbox') {
      return (
        <svg width={104} height={78}>
          <path d="M20 62 V34 A32 26 0 0 1 84 34 V62 Z" fill="none" stroke={c} strokeWidth={4} />
          <line x1={52} y1={22} x2={52} y2={50} stroke={c} strokeWidth={4} />
          <path d="M44 42 L52 52 L60 42" fill="none" stroke={c} strokeWidth={4} strokeLinecap="round" />
        </svg>
      );
    }
    if (kind === 'handshake') {
      return (
        <svg width={104} height={78}>
          <rect x={10} y={26} width={36} height={26} rx={5} fill="none" stroke={c} strokeWidth={4} />
          <rect x={58} y={26} width={36} height={26} rx={5} fill="none" stroke={c} strokeWidth={4} />
          <text x={28} y={45} textAnchor="middle" fontFamily={theme.mono} fontSize={15} fill={c}>
            {'01'}
          </text>
          <text x={76} y={45} textAnchor="middle" fontFamily={theme.mono} fontSize={15} fill={c}>
            {'01'}
          </text>
        </svg>
      );
    }
    return (
      <svg width={104} height={78}>
        <rect x={12} y={18} width={80} height={20} rx={5} fill="none" stroke={c} strokeWidth={4} />
        <rect x={12} y={44} width={80} height={20} rx={5} fill="none" stroke={c} strokeWidth={4} />
        <circle cx={22} cy={70} r={5} fill={c} />
        <circle cx={82} cy={70} r={5} fill={c} />
      </svg>
    );
  };
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 30, alignItems: 'stretch'}}>
        {questions.map((qq, i) => {
          const drop = spring({frame: frame - 8 - i * 14, fps, config: {damping: 200}});
          const io = interpolate(frame - iconAt, [0, 10], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={qq.q}
              style={{
                width: 320,
                opacity: drop,
                transform: `translateY(${(1 - drop) * -46}px)`,
              }}
            >
              <Panel accent={theme.peer} style={{padding: '26px 24px', minHeight: 230}}>
                <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 3}}>
                  {qq.en}
                </div>
                <div
                  style={{
                    fontFamily: theme.serif,
                    fontSize: 40,
                    fontWeight: 700,
                    color: theme.text,
                    marginTop: 10,
                  }}
                >
                  {qq.q}
                </div>
                <div
                  style={{
                    marginTop: 18,
                    height: 84,
                    display: 'flex',
                    alignItems: 'center',
                    opacity: showIcon ? io : 0,
                  }}
                >
                  <Icon kind={qq.kind} />
                </div>
              </Panel>
              {/* 挂绳：铭牌是「挂出来」的 */}
              <svg width={320} height={26} style={{display: 'block'}}>
                <line
                  x1={40}
                  y1={0}
                  x2={160}
                  y2={0}
                  stroke={theme.panelBorder}
                  strokeWidth={3}
                  opacity={drop}
                />
                <line
                  x1={280}
                  y1={0}
                  x2={160}
                  y2={0}
                  stroke={theme.panelBorder}
                  strokeWidth={3}
                  opacity={drop}
                />
                <circle cx={40} cy={2} r={4} fill={theme.panelBorder} opacity={drop} />
                <circle cx={280} cy={2} r={4} fill={theme.panelBorder} opacity={drop} />
              </svg>
            </div>
          );
        })}
      </div>
      {showIcon ? (
        <Footnote delay={iconAt}>{'一堆文件 · 几个信箱 · 一张编号表 · 各自的桌子'}</Footnote>
      ) : null}
    </AbsoluteFill>
  );
};

/** 0-C 禁止牌剪影快闪：不许插队 / 不许转包 / 不许悄悄丢（deny 圆牌 + 斜杠） */
const ForbiddenSigns: React.FC = () => {
  const frame = useCurrentFrame();
  const signs = [
    {t: '不许插队', sub: '依赖没齐不许开工'},
    {t: '不许转包', sub: '队友不许再孵队友'},
    {t: '不许悄悄丢', sub: '脏桌不许直接删除'},
  ];
  // 每张牌 22 帧定格一闪；末张（不许悄悄丢）常驻到本 beat 结束
  const per = 22;
  const idx = Math.min(signs.length - 1, Math.floor(frame / per));
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {signs.map((s, i) => {
        const on = i === idx;
        if (!on) return null;
        const pop = spring({frame: frame - i * per, fps: 30, config: {damping: 200}});
        return (
          <div
            key={s.t}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 30,
              transform: `scale(${0.85 + 0.15 * pop})`,
              opacity: pop,
            }}
          >
            <svg width={280} height={280} style={{overflow: 'visible'}}>
              <circle cx={140} cy={140} r={128} fill={theme.denyDeep} opacity={0.55} />
              <circle cx={140} cy={140} r={128} fill="none" stroke={theme.deny} strokeWidth={10} />
              <line
                x1={140 - 128 * Math.cos(Math.PI / 4)}
                y1={140 - 128 * Math.sin(Math.PI / 4)}
                x2={140 + 128 * Math.cos(Math.PI / 4)}
                y2={140 + 128 * Math.sin(Math.PI / 4)}
                stroke={theme.deny}
                strokeWidth={10}
                strokeLinecap="round"
              />
              <text
                x={140}
                y={150}
                textAnchor="middle"
                fontFamily={theme.serif}
                fontSize={54}
                fontWeight={700}
                fill={theme.deny}
                letterSpacing={4}
              >
                {'不'}
              </text>
            </svg>
            <div style={{fontFamily: theme.serif, fontSize: 46, fontWeight: 700, color: theme.text}}>
              {s.t}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>{s.sub}</div>
          </div>
        );
      })}
      {idx >= signs.length - 1 ? (
        <Footnote delay={(signs.length - 1) * per}>
          {'这一集的乐趣，就在这些「不」字里'}
        </Footnote>
      ) : null}
    </AbsoluteFill>
  );
};

export const P0Hook: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（只取某句起始帧，不是分镜 beat 窗口）。刻意不叫 w()——
  // check_script --check-scenes 只把 w() 视为分镜窗口，混用会刷「分镜陈旧」假 WARN。
  const at = (id: string) => w(id).from;
  const bA = w('p0-01', 'p0-04');
  const bB = w('p0-05', 'p0-08');
  const bC = w('p0-09', 'p0-10');
  return (
    <AbsoluteFill>
      <SceneHeader index="P0" title="一个注意力，盖不住一个后端" meta="agentic laziness · bias · drift" />
      <Sequence {...bA} name="0-A 清单溢出与孤环">
        <SceneTag chapter="Agent Teams" tagline="One Agent Is Not Enough" accent={theme.peer} />
        {/* 拉镜点在 p0-03；cardsAt：官方三失败模式症状卡（Harness Engineering 改造） */}
        <OverflowThenZoom zoomAt={at('p0-03') - bA.from} cardsAt={at('p0-03') - bA.from + 26} />
      </Sequence>
      <Sequence {...bB} name="0-B 四问铭牌">
        {/* 图标预览点在 p0-08「一堆文件、几个信箱、一张编号表」 */}
        <FourQuestions iconAt={at('p0-08') - bB.from} />
      </Sequence>
      <Sequence {...bC} name="0-C 禁止牌剪影">
        <ForbiddenSigns />
      </Sequence>
    </AbsoluteFill>
  );
};
