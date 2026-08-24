/** P4 不丢的那一层（分镜 4-A…4-E）
 *  4-A 全景回望：四级收拾+应急+回捞全在桌面上；桌面边缘「迟早被压」；桌面褪色一次；
 *  4-B ★转折帧：tab 字条 → 摘要光束扫过 → 变「有代码风格偏好」六字 / 碎片飘走；
 *  4-C 登记簿登场：三行 frontmatter / 索引追加 / 重复卡被退；
 *  4-D 四类记忆四宫格（keep 描边统一，反枚举）；
 *  4-E 两条取路：索引常驻 + 旁路小问（≤5 卡、拿不准缩回、关键词降级）。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Desk, Footnote, Ledger, PaperCard, SceneTag} from '../components/motifs';

/** 4-A 全景回望：已讲机制小图标环绕桌面；桌面整体轻微褪色一次 */
const AllOnDesk: React.FC<{fadeAt: number}> = ({fadeAt}) => {
  const frame = useCurrentFrame();
  // 褪色一次（预告命运）：降到 0.62 再回 0.85（保留一点——桌面还要用）
  const fate = interpolate(frame - fadeAt, [0, 16, 30], [0, 1, 0.35], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const marks = [
    {t: '一级 裁中段', x: 70, y: 64},
    {t: '二级 折旧纸', x: 400, y: 64},
    {t: '三级 大件入库', x: 730, y: 64},
    {t: '四级 全桌重写', x: 1060, y: 64},
    {t: '应急通道', x: 70, y: 470},
    {t: '回捞钩', x: 400, y: 470},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1400, height: 560}}>
        {marks.map((m, i) => (
          <div
            key={m.t}
            style={{
              position: 'absolute',
              left: m.x,
              top: m.y,
              opacity: interpolate(frame - i * 5, [0, 12], [0.3, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            <div
              style={{
                padding: '8px 18px',
                borderRadius: 999,
                border: `2px solid ${theme.panelBorder}`,
                background: theme.panel,
                fontFamily: theme.mono,
                fontSize: 21,
                color: theme.dim,
                whiteSpace: 'nowrap',
              }}
            >
              {m.t}
            </div>
          </div>
        ))}
        {/* 桌面主体：边缘标「迟早被压」；褪色一次 */}
        <div
          style={{
            position: 'absolute',
            left: 130,
            top: 140,
            opacity: 1 - fate * 0.38,
            filter: `saturate(${1 - fate * 0.3})`,
          }}
        >
          <Desk w={1100} h={280}>
            <div style={{position: 'absolute', left: 40, top: 40, display: 'flex', flexWrap: 'wrap', gap: 12, width: 1020}}>
              {Array.from({length: 14}).map((_, i) => (
                <PaperCard key={i} w={120} h={60} tone={i < 4 ? 'full' : 'half'} />
              ))}
            </div>
          </Desk>
        </div>
        <div
          style={{
            position: 'absolute',
            right: 20,
            top: 260,
            fontFamily: theme.mono,
            fontSize: 23,
            color: theme.dim,
            whiteSpace: 'nowrap',
            opacity: interpolate(frame - fadeAt, [0, 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {'桌面 · 迟早被压'}
        </div>
      </div>
      <Footnote delay={fadeAt}>{'桌面上的东西再怎么管，都有一个共同命运'}</Footnote>
    </AbsoluteFill>
  );
};

/** 4-B ★转折帧：tab 字条 → 摘要光束横扫 → 字面重写为六字；原字条碎片飘走 */
const TabToSummary: React.FC<{beamAt: number; rewriteAt: number; shredAt: number}> = ({
  beamAt,
  rewriteAt,
  shredAt,
}) => {
  const frame = useCurrentFrame();
  // 摘要光束：一道横扫的亮带（中性亮，不用色相——摘要不是敌人也不是朋友）
  const beam = interpolate(frame - beamAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 字面逐字重写：原句字符**逐个让位**给六个字（同刻总字数单调不增，nowrap 不溢出）
  const orig = '缩进用 tab，别用空格';
  const fin = '有代码风格偏好';
  const rewrite = interpolate(frame - rewriteAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 让位规则：前段先收（原句从尾部逐字消失），收完再长出新句（总长 ≤ 原句长）
  const faded = orig.slice(0, Math.max(0, orig.length - Math.min(orig.length, Math.floor(rewrite * 2 * orig.length))));
  const grown = fin.slice(
    0,
    Math.max(0, Math.floor((rewrite - 0.5) * 2 * fin.length)),
  );
  // 原字条碎片飘走（细节之死）
  const shred = interpolate(frame - shredAt, [0, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1240, height: 420}}>
        {/* 字条特写：纸底 + 原句 */}
        <div
          style={{
            position: 'absolute',
            left: 620 - 440,
            top: 60,
            width: 880,
            padding: '44px 56px',
            borderRadius: 16,
            background: theme.panel,
            border: `3px solid ${theme.panelBorder}`,
            opacity: 1 - shred * 0.9,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'你认真交代过'}</div>
          <div style={{fontFamily: theme.serif, fontSize: 58, fontWeight: 700, color: theme.text, marginTop: 18, whiteSpace: 'nowrap'}}>
            {rewrite <= 0 ? (
              orig
            ) : (
              <>
                <span style={{opacity: 0.35}}>{faded}</span>
                <span style={{color: theme.text}}>{grown}</span>
              </>
            )}
          </div>
          <div
            style={{
              marginTop: 22,
              fontFamily: theme.mono,
              fontSize: 22,
              color: theme.dim,
              opacity: rewrite > 0.8 ? 1 : 0,
            }}
          >
            {'几轮压缩之后'}
          </div>
        </div>
        {/* 摘要光束：横扫亮带（只在扫描期间可见） */}
        {beam > 0 && beam < 1 ? (
          <div
            style={{
              position: 'absolute',
              left: 620 - 440 + 880 * beam,
              top: 40,
              width: 60,
              height: 240,
              background: theme.text,
              opacity: 0.14,
              borderRadius: 8,
              filter: 'blur(4px)',
              pointerEvents: 'none',
            }}
          />
        ) : null}
        {/* 碎片飘走：原字条细节（tab/空格 的字粒）散落 */}
        {shred > 0
          ? Array.from({length: 8}).map((_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 400 + ((i * 71) % 320),
                  top: 90 + shred * (240 + ((i * 43) % 140)),
                  fontFamily: theme.mono,
                  fontSize: 24,
                  color: theme.dim,
                  opacity: (1 - shred) * 0.8,
                  transform: `rotate(${((i * 61) % 60) - 30}deg) translateX(${((i * 29) % 80) - 40}px)`,
                }}
              >
                {['tab', '空格', '缩进', '别', '用'][i % 5]}
              </div>
            ))
          : null}
        {/* 结论行 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: -60,
            textAlign: 'center',
            fontFamily: theme.serif,
            fontSize: 34,
            color: theme.text,
            opacity: interpolate(frame - shredAt - 6, [0, 14], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {'摘要没有做错什么——可有些细节，恰恰是主干'}
        </div>
      </div>
      <Footnote delay={rewriteAt}>{'例子出自开源教学仓库原文（README @ 67a9126c）'}</Footnote>
    </AbsoluteFill>
  );
};

/** 4-C 登记簿登场：本子弹入 + frontmatter 三行打出 + 索引追加 + 重复卡被「已有」退回 */
/** 4-C 两条腿框架（Harness Engineering 改造版）：
 *  第一条腿你写（项目规则文件夹：四层拼接/四兆上限/两百行）+ 第二条腿它自己写（自动记忆，四类有门限）。
 *  内嵌原 LedgerArrives 登记簿动画。 */
const TwoLegsFrame: React.FC<{legAt: number; autoAt: number; children: React.ReactNode}> = ({
  legAt,
  autoAt,
  children,
}) => {
  const frame = useCurrentFrame();
  const leg = interpolate(frame - legAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const auto = interpolate(frame - autoAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill>
      {/* 左腿：你写的 */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 180,
          width: 380,
          opacity: leg,
          transform: `translateX(${(1 - leg) * -30}px)`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.keep, marginBottom: 10}}>
          {'第一条腿：你写'}
        </div>
        {['四层拼接 · 不覆盖', '越近工作目录越后读', '单文件超四兆整份跳过', '超两百行开始不听话'].map((s, i) => (
          <div
            key={s}
            style={{
              fontFamily: theme.sans,
              fontSize: 19,
              color: theme.dim,
              marginBottom: 7,
              opacity: interpolate(frame - legAt - 6 - i * 5, [0, 8], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {'· ' + s}
          </div>
        ))}
      </div>
      {/* 右腿：它自己写 */}
      <div
        style={{
          position: 'absolute',
          right: 60,
          top: 180,
          width: 380,
          textAlign: 'right',
          opacity: auto,
          transform: `translateX(${(1 - auto) * 30}px)`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.keep, marginBottom: 10}}>
          {'第二条腿：它自己写'}
        </div>
        {['自动记忆 · 用户目录', '按四类落卡', '有门限（25KB / 200 行）', '压缩后照常重注入'].map((s, i) => (
          <div
            key={s}
            style={{
              fontFamily: theme.sans,
              fontSize: 19,
              color: theme.dim,
              marginBottom: 7,
              opacity: interpolate(frame - autoAt - 6 - i * 5, [0, 8], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {s + ' ·'}
          </div>
        ))}
      </div>
      {/* 中央：登记簿动画（原 4-C 主体） */}
      <div style={{position: 'absolute', inset: 0}}>{children}</div>
    </AbsoluteFill>
  );
};

const LedgerArrives: React.FC<{bookAt: number; fmAt: number[]; indexAt: number; dupAt: number}> = ({
  bookAt,
  fmAt,
  indexAt,
  dupAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const land = spring({frame: frame - bookAt, fps, config: {damping: 14}});
  const dup = spring({frame: frame - dupAt, fps, config: {damping: 13}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Memory" tagline="A Layer That Never Compacts" accent={theme.keep} />
      <div style={{position: 'relative', display: 'flex', gap: 90, alignItems: 'center', marginTop: 30}}>
        {/* 登记簿：keep 实体 */}
        <div
          style={{
            transform: `translateY(${(1 - land) * -60}px) rotate(${(1 - land) * -6}deg)`,
            opacity: land,
          }}
        >
          <Ledger w={420} h={380} pages={7}>
            <div style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.keep}}>
              {'登记簿'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 6}}>
              {'.memory/ · 一事一文件'}
            </div>
            {/* frontmatter 三行逐行打出 */}
            {['name: user-preference-tabs', 'description: 用 tab 缩进', 'type: user'].map((ln, i) => (
              <div
                key={ln}
                style={{
                  fontFamily: theme.mono,
                  fontSize: 20,
                  color: theme.text,
                  marginTop: 12,
                  whiteSpace: 'nowrap',
                  opacity: interpolate(frame - fmAt[i], [0, 10], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                }}
              >
                {ln}
              </div>
            ))}
            <div
              style={{
                marginTop: 18,
                fontFamily: theme.mono,
                fontSize: 19,
                color: theme.dim,
                opacity: interpolate(frame - fmAt[2] - 14, [0, 10], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              {'一事一个文件 · 三行登记头'}
            </div>
          </Ledger>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 26}}>
          {/* 索引页：自动追加一行 */}
          <div
            style={{
              width: 620,
              borderRadius: 12,
              border: `2px solid ${theme.keep}`,
              background: theme.panel,
              padding: '16px 22px',
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.keep}}>{'MEMORY.md 索引'}</div>
            {['plan-review.md', 'data-no-mock.md'].map((f) => (
              <div key={f} style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 8}}>
                {`- ${f}`}
              </div>
            ))}
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 20,
                color: theme.keep,
                marginTop: 8,
                whiteSpace: 'nowrap',
                opacity: interpolate(frame - indexAt, [0, 10], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              {'- user-preference-tabs.md　← 顺手追加'}
            </div>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 18,
                color: theme.dim,
                marginTop: 8,
                opacity: interpolate(frame - indexAt - 12, [0, 10], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              {'一行一条，永远不会对不上 · 上限 200 行'}
            </div>
          </div>
          {/* 重复卡被「已有」印章退回 */}
          {dup > 0 ? (
            <div style={{position: 'relative', opacity: dup}}>
              <div
                style={{
                  width: 620,
                  borderRadius: 10,
                  border: `2px dashed ${theme.panelBorder}`,
                  background: theme.panel,
                  padding: '12px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <PaperCard w={110} h={54} tone="half" label="提取" />
                <span style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>
                  {'提取器先查已有记忆，记过的不再记'}
                </span>
              </div>
              <div
                style={{
                  position: 'absolute',
                  right: 24,
                  top: -18,
                  padding: '4px 14px',
                  border: `3px solid ${theme.dim}`,
                  borderRadius: 8,
                  fontFamily: theme.mono,
                  fontSize: 24,
                  fontWeight: 700,
                  color: theme.dim,
                  transform: `rotate(${8 + (1 - dup) * 24}deg)`,
                }}
              >
                {'已有 · 退回'}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <Footnote delay={bookAt}>{'没有数据库，没有云同步——就是项目旁边一个普通目录'}</Footnote>
    </AbsoluteFill>
  );
};

/** 4-D 四类记忆四宫格：keep 描边统一色（反枚举），例子逐字打入 */
const FourKinds: React.FC<{litAt: number[]}> = ({litAt}) => {
  const frame = useCurrentFrame();
  const cells = [
    {q: '你是谁', kind: 'user', ex: '缩进用 tab'},
    {q: '怎么干活', kind: 'feedback', ex: '别造假数据'},
    {q: '在发生什么', kind: 'project', ex: '这次重写是合规驱动的'},
    {q: '去哪儿找', kind: 'reference', ex: '那个老 bug 记录在哪'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 560px)', gap: 26}}>
        {cells.map((c, i) => {
          const on = frame >= litAt[i];
          const exShown = Math.max(0, Math.min(c.ex.length, Math.floor((frame - litAt[i] - 8) / 1.6)));
          return (
            <div
              key={c.q}
              style={{
                borderRadius: 16,
                border: `3px solid ${on ? theme.keep : theme.panelBorder}`,
                background: on ? 'rgba(169,196,108,0.05)' : theme.panel,
                padding: '24px 30px',
                minHeight: 190,
                opacity: on ? 1 : 0.45,
              }}
            >
              <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
                <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{fontFamily: theme.serif, fontSize: 42, fontWeight: 700, color: on ? theme.keep : theme.dim}}>
                  {c.q}
                </span>
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 8}}>{c.kind}</div>
              <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text, marginTop: 16, minHeight: 36}}>
                {on ? (
                  <>
                    {'「'}
                    {c.ex.slice(0, exShown)}
                    {exShown >= c.ex.length ? '」' : ''}
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <Footnote delay={litAt[0]}>{'四类记忆，就是四个问题 —— 开源仓库实测【一】'}</Footnote>
    </AbsoluteFill>
  );
};

/** 4-E 两条取路：索引常驻（桌角常亮）+ 旁路小问（≤5 卡、犹豫卡缩回、关键词降级） */
/** 4-E 尾钩：前缀缓存三层条 + 价目（Harness Engineering 改造版）
 *  系统提示 → 项目上下文 → 对话；上层一动其后全重算——解释「改规则要新开会话」「中途换模型那轮慢」；
 *  p4-25a/b 价目：命中一折计费 · 写入加四分之一 · 两次一问就回本——稳定放前面就是在给钱排座位。 */
const PrefixCacheStrip: React.FC<{stripAt: number; priceAt: number}> = ({stripAt, priceAt}) => {
  const frame = useCurrentFrame();
  const layers = [
    {t: '系统提示', sub: '最稳'},
    {t: '项目上下文', sub: '规则/记忆'},
    {t: '对话', sub: '每轮增长'},
  ];
  const strip = interpolate(frame - stripAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 顶层闪烁 → 下层全红重算（p4-25 句锚后）
  const shake = frame >= stripAt + 30 ? Math.sin((frame - stripAt - 30) / 4) * 2 : 0;
  const invalid = frame >= stripAt + 30;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 168,
        transform: `translateX(-50%) translateY(${(1 - strip) * 24}px)`,
        opacity: strip * 0.96,
        display: 'flex',
        gap: 10,
        alignItems: 'flex-end',
      }}
    >
      {layers.map((l, i) => {
        const e = interpolate(frame - stripAt - i * 5, [0, 10], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const red = invalid && i >= 1;
        return (
          <div
            key={l.t}
            style={{
              width: 220,
              padding: '9px 14px',
              border: `2px solid ${red ? theme.deny : theme.keep}`,
              borderRadius: 8,
              background: theme.panel,
              textAlign: 'center',
              opacity: e,
              transform: `translateY(${i === 0 ? shake : 0}px)`,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.text}}>{l.t}</div>
            <div style={{fontFamily: theme.mono, fontSize: 14, color: red ? theme.deny : theme.dim}}>
              {red ? '重算' : l.sub}
            </div>
          </div>
        );
      })}
      {invalid ? (
        <div style={{position: 'absolute', right: -250, top: 8, width: 230, fontFamily: theme.sans, fontSize: 16, color: theme.dim}}>
          {'改规则要新开会话 · 中途换模型那轮慢'}
        </div>
      ) : null}
      {/* p4-25a/b 价目条：命中一折 · 写入 +1/4 · 两次回本 */}
      {frame >= priceAt ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '100%',
            marginTop: 14,
            transform: `translateX(-50%) translateY(${interpolate(frame - priceAt, [0, 12], [12, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}px)`,
            opacity: interpolate(frame - priceAt, [0, 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            whiteSpace: 'nowrap',
            fontFamily: theme.mono,
            fontSize: 18,
            color: theme.keep,
            border: `1.5px solid ${theme.keep}88`,
            borderRadius: 8,
            padding: '7px 16px',
            background: theme.panel,
          }}
        >
          {'价目：命中 ×0.1 · 写入 +1/4 —— 两次一问就回本'}
        </div>
      ) : null}
    </div>
  );
};

const TwoPaths: React.FC<{sideAt: number; cardsAt: number; shrinkAt: number; degradeAt: number}> = ({
  sideAt,
  cardsAt,
  shrinkAt,
  degradeAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const side = interpolate(frame - sideAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shrink = interpolate(frame - shrinkAt, [0, 16], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const degraded = frame >= degradeAt;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 70, alignItems: 'stretch'}}>
        {/* 路一：索引常驻 */}
        <div style={{width: 560}}>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginBottom: 12}}>
            {'路一 · 索引常驻'}
          </div>
          <div
            style={{
              borderRadius: 14,
              border: `3px solid ${theme.keep}`,
              background: theme.panel,
              padding: '18px 24px',
              boxShadow: `0 0 ${Math.round(18 + 10 * (0.5 + 0.5 * Math.sin(frame / 9)))}px ${theme.keepDeep}`,
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.keep}}>{'MEMORY.md'}</div>
            {['user-preference-tabs.md', 'plan-review.md', 'data-no-mock.md', 'legacy-bug-hunt.md'].map((f, i) => (
              <div
                key={f}
                style={{
                  fontFamily: theme.mono,
                  fontSize: 21,
                  color: theme.text,
                  marginTop: 10,
                  opacity: interpolate(frame - i * 6, [0, 10], [0.4, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                }}
              >
                {`- ${f}`}
              </div>
            ))}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 12}}>
            {'贴在基本设定里 · 每次开工扫一眼家底 · 便宜、全天候'}
          </div>
        </div>
        {/* 路二：旁路小问 */}
        <div style={{width: 640, position: 'relative'}}>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginBottom: 12}}>
            {'路二 · 旁路小问（按需取）'}
          </div>
          {/* 细支路描线 → 小模型 */}
          <svg width={640} height={90}>
            <path
              d={`M 10 44 C 150 44, 200 44, 330 44 L ${330 + 150 * side} 44`}
              stroke={theme.mech}
              strokeWidth={4}
              fill="none"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - side}
            />
            <circle cx={10} cy={44} r={8} fill={theme.text} opacity={0.6} />
            {side > 0.95 ? <polygon points="480,44 462,34 462,54" fill={theme.mech} /> : null}
          </svg>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 18px',
              borderRadius: 999,
              border: `2px solid ${theme.mech}`,
              fontFamily: theme.sans,
              fontSize: 22,
              color: theme.mech,
              opacity: side,
            }}
          >
            {'小号模型 · 挑真正用得上的'}
          </div>
          {/* 飞回的 ≤5 卡：一张犹豫卡自动缩回 */}
          <div style={{display: 'flex', gap: 12, marginTop: 26, minHeight: 120, alignItems: 'center'}}>
            {[0, 1, 2, 3, 4].map((i) => {
              const t = spring({frame: frame - cardsAt - i * 6, fps, config: {damping: 200}});
              // 第 4 张（index 4）是犹豫卡：先到、再缩回（scale 降 0、透明度降）
              const hesitant = i === 4;
              const scale = hesitant ? Math.max(0, shrink) * t : t;
              const op = hesitant ? Math.max(0, shrink) : 1;
              return (
                <div
                  key={i}
                  style={{
                    transform: `translateY(${(1 - t) * -46}px) scale(${scale === 0 ? 0.001 : scale})`,
                    opacity: op,
                  }}
                >
                  <PaperCard w={100} h={78} bars={3} tone="full" label={hesitant ? '拿不准' : undefined} />
                </div>
              );
            })}
          </div>
          <div style={{display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap'}}>
            <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.text}}>{'最多 5 条'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{'宁缺毋滥'}</span>
          </div>
          {/* 降级：关键词匹配 */}
          {degraded ? (
            <div
              style={{
                marginTop: 16,
                padding: '10px 18px',
                borderRadius: 10,
                border: `2px dashed ${theme.panelBorder}`,
                fontFamily: theme.mono,
                fontSize: 20,
                color: theme.dim,
                opacity: interpolate(frame - degradeAt, [0, 10], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              {'支路失败 → 退回关键词匹配（便宜的兜底）'}
            </div>
          ) : null}
        </div>
      </div>
      <Footnote delay={degradeAt}>{'产品用小号模型挑选 —— 第三方的源码分析'}</Footnote>
    </AbsoluteFill>
  );
};

export const P4Ledger: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p4-01', 'p4-02');
  const relA = (id: string) => at(id) - bA.from;
  const bB = w('p4-03', 'p4-07');
  const relB = (id: string) => at(id) - bB.from;
  const bC = w('p4-08', 'p4-12');
  const relC = (id: string) => at(id) - bC.from;
  const bD = w('p4-13', 'p4-17');
  const relD = (id: string) => at(id) - bD.from;
  const bE = w('p4-18', 'p4-29');
  const relE = (id: string) => at(id) - bE.from;
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 全景回望桌面褪色一次">
        <AllOnDesk fadeAt={relA('p4-02')} />
      </Sequence>
      <Sequence {...bB} name="4-B 转折帧">
        <TabToSummary
          beamAt={relB('p4-05')}
          rewriteAt={relB('p4-05') + 26}
          shredAt={relB('p4-06')}
        />
      </Sequence>
      <Sequence {...bC} name="4-C 记忆两条腿">
        <TwoLegsFrame legAt={relC('p4-08')} autoAt={relC('p4-11')}>
          <LedgerArrives
            bookAt={relC('p4-09') - relC('p4-08')}
            fmAt={[relC('p4-10'), relC('p4-10') + 12, relC('p4-10') + 24]}
            indexAt={relC('p4-11')}
            dupAt={relC('p4-12')}
          />
        </TwoLegsFrame>
      </Sequence>
      <Sequence {...bD} name="4-D 四类记忆四宫格">
        <FourKinds
          litAt={[
            relD('p4-14'),
            relD('p4-15'),
            relD('p4-16'),
            relD('p4-17'),
          ]}
        />
      </Sequence>
      <Sequence {...bE} name="4-E 两条取路与前缀缓存">
        <TwoPaths
          sideAt={relE('p4-21')}
          cardsAt={relE('p4-22')}
          shrinkAt={relE('p4-22') + 70}
          degradeAt={relE('p4-24')}
        />
        <PrefixCacheStrip stripAt={relE('p4-24')} priceAt={relE('p4-25a')} />
      </Sequence>
    </AbsoluteFill>
  );
};
