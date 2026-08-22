/** P0 一次拒收（分镜 0-A…0-D）
 *  痛点：终端干活到一半报错砸落；随身带的对话把窗口容器灌满，撞上「拒收」墙；
 *  「删一点」的三个恶果快闪；两层答案（桌面/登记簿）画中画预告。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, PaperCard, Terminal} from '../components/motifs';

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

/** 0-B 左终端缩角 + 右玻璃容器：随身携带的色块逐句灌入 → 液面撞顶、边框闪 deny */
const WindowFills: React.FC<{pourAt: number[]; topAt: number}> = ({pourAt, topAt}) => {
  const frame = useCurrentFrame();
  const CW = 560;
  const CH = 620;
  const fillH = Math.min(CH, pourAt.filter((a) => frame >= a).length * (CH / pourAt.length));
  const slammed = frame >= topAt;
  const flash = slammed ? 0.5 + 0.5 * Math.abs(Math.sin((frame - topAt) / 4)) : 0;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 120}}>
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
              bottom: 0,
              height: fillH,
              display: 'flex',
              flexDirection: 'column-reverse',
            }}
          >
            {pourAt.map((a, i) => (
              <div
                key={a}
                style={{
                  height: CH / pourAt.length - 6,
                  margin: 3,
                  borderRadius: 6,
                  background: theme.text,
                  opacity: frame >= a ? 0.16 + 0.14 * ((i % 3) / 2) : 0,
                }}
              />
            ))}
          </div>
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
    </AbsoluteFill>
  );
};

/** 0-C 「删一点」的三恶果快闪（口播点到两样：删任务书/删回执；画面对齐口播两帧） */
const DeleteSins: React.FC<{taskAt: number; receiptAt: number}> = ({taskAt, receiptAt}) => {
  const frame = useCurrentFrame();
  const shots = [
    {at: taskAt, tag: '删错了任务书', verdict: '它忘了自己要干嘛', id: 'task'},
    {at: receiptAt, tag: '删错了回执', verdict: '它对着空气发问', id: 'receipt'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {shots.map((s) => {
        const t = interpolate(frame - s.at, [0, 10, 118, 130], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        if (t <= 0) return null;
        return (
          <AbsoluteFill
            key={s.id}
            style={{justifyContent: 'center', alignItems: 'center', opacity: t}}
          >
            <div style={{position: 'relative', display: 'flex', alignItems: 'center', gap: 46}}>
              {/* 任务书：core 描边三张（头三张=任务书，语言与 1-B 一致） */}
              {s.id === 'task' ? (
                <div style={{display: 'flex', gap: 10}}>
                  {[0, 1, 2].map((i) => (
                    <PaperCard
                      key={i}
                      w={104}
                      h={128}
                      bars={4}
                      accent={i === 1 ? theme.core : undefined}
                      tone="faded"
                      label="任务书"
                    />
                  ))}
                </div>
              ) : (
                <div style={{display: 'flex', gap: 14, alignItems: 'center'}}>
                  <PaperCard w={150} h={96} label="请求" tone="full" />
                  <PaperCard w={150} h={96} label="回执" tone="faded" dashed />
                </div>
              )}
              <div>
                <div
                  style={{
                    fontFamily: theme.mono,
                    fontSize: 28,
                    fontWeight: 700,
                    color: theme.deny,
                  }}
                >
                  {s.tag}
                </div>
                <div
                  style={{
                    fontFamily: theme.serif,
                    fontSize: 40,
                    color: theme.text,
                    marginTop: 12,
                  }}
                >
                  {s.verdict}
                </div>
              </div>
              {/* 删除斜杠 */}
              <svg width={520} height={280} style={{position: 'absolute', left: -60, pointerEvents: 'none'}}>
                <line
                  x1={30}
                  y1={250}
                  x2={30 + 440 * t}
                  y2={250 - 220 * t}
                  stroke={theme.deny}
                  strokeWidth={7}
                  strokeLinecap="round"
                  opacity={0.85}
                />
              </svg>
            </div>
          </AbsoluteFill>
        );
      })}
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
  const bA = w('p0-01', 'p0-03');
  const relA = (id: string) => at(id) - bA.from;
  const bB = w('p0-04', 'p0-08');
  const relB = (id: string) => at(id) - bB.from;
  const bC = w('p0-09', 'p0-12');
  const relC = (id: string) => at(id) - bC.from;
  const bD = w('p0-13', 'p0-17');
  const relD = (id: string) => at(id) - bD.from;
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 终端报错砸落">
        <ErrorSlam errAt={relA('p0-02')} />
      </Sequence>
      <Sequence {...bB} name="0-B 窗口容器灌满撞拒收墙">
        <WindowFills
          pourAt={[relB('p0-04'), relB('p0-05'), relB('p0-06'), relB('p0-07')]}
          topAt={relB('p0-08')}
        />
      </Sequence>
      <Sequence {...bC} name="0-C 删东西三恶果快闪">
        <DeleteSins taskAt={relC('p0-11')} receiptAt={relC('p0-12')} />
      </Sequence>
      <Sequence {...bD} name="0-D 两层答案画中画预告">
        <TwoAnswers
          leftAt={relD('p0-14')}
          rightAt={relD('p0-15')}
          lineAt={relD('p0-16')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
