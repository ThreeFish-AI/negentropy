/** P6 落点与信源（分镜 6-B…6-A…6-C，收尾改序：免责→金句→预告）
 *  6-B 信源卡前置（免责不再插在情绪高点与转化动作之间）；
 *  6-A 一句话合同金句卡（serif keep 描边）→ 两行回收（体面地忘 / 固执地记）→
 *     赌注会过期（押注卡 → 删除线+盖章 → keep 新卡升起）→ p6-06 分水岭压场；
 *  6-C 身份卡 + 下期预告卡（只进画面）+ 四件套标尺尾帧（第三格常亮）→ 渐黑。
 *  ★ 渐黑窗口从**末 beat 总时长**（6-C 的 beatDurationInFrames）推导，不是末句时长
 *    —— 第三集上线教训（skills/06 渲染红线四）。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {HarnessScale} from '../components/HarnessScale';
import {Footnote, Panel, SceneHeader} from '../components/motifs';

/** 6-B 信源卡前置：两行逐行浮现（官方文档+取数日期 / 第三方源码分析已逐处标注） */
const SourceFirst: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 4, fps, config: {damping: 200}});
  const rows = [
    ['官方文档', 'code.claude.com/docs · 取数2026年8月'],
    ['源码分析', '第三方逆向分析 · 片中逐处标注'],
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: enter, transform: `translateY(${(1 - enter) * 20}px)`}}>
        <Panel style={{padding: '30px 40px', width: 900}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.core, marginBottom: 18}}>
            {'信源'}
          </div>
          {rows.map(([k, v], i) => (
            <div
              key={k}
              style={{
                display: 'flex',
                marginBottom: 12,
                opacity: interpolate(frame - 8 - i * 5, [0, 10], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              <div style={{width: 150, fontFamily: theme.sans, fontSize: 23, color: theme.dim, flexShrink: 0}}>
                {k}
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 23, color: theme.text}}>{v}</div>
            </div>
          ))}
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

/** 6-A 一句话合同：keep 描边金句卡 + 两行对仗回收 + 赌注会过期（p6-04a/b/c）+ p6-06 分水岭卡压场 */
const OneLineContract: React.FC<{
  recycleAt: number;
  wagerAt: number;
  strikeAt: number;
  riseAt: number;
  divideAt: number;
}> = ({recycleAt, wagerAt, strikeAt, riseAt, divideAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 4, fps, config: {damping: 200}});
  const recycle = interpolate(frame - recycleAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // p6-04a：回收两行上移收缩、押注卡淡入
  const wager = interpolate(frame - wagerAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // p6-04b：箭头扫过 → 划删除线 + 盖章
  const strike = interpolate(frame - strikeAt, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const stamp = interpolate(frame - strikeAt - 10, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // p6-04c：右侧 keep 新卡升起
  const rise = interpolate(frame - riseAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // p6-06：分水岭卡压场（提示词工程 → Harness 工程）
  const divide = interpolate(frame - divideAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{textAlign: 'center', opacity: enter, transform: `translateY(${(1 - enter) * 24}px)`}}>
        {/* 合同卡：serif + keep 描边（赌注段淡出让位） */}
        <div
          style={{
            display: 'inline-block',
            padding: '40px 72px',
            borderRadius: 20,
            border: `4px solid ${theme.keep}`,
            background: 'rgba(169,196,108,0.05)',
            opacity: 1 - wager * 0.85,
            transform: `scale(${1 - wager * 0.18})`,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginBottom: 20}}>
            {'一句话合同'}
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 62, fontWeight: 700, color: theme.text, lineHeight: 1.4}}>
            {'会丢的放桌面，'}
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 62, fontWeight: 700, color: theme.keep, lineHeight: 1.4}}>
            {'不许丢的放本子'}
          </div>
        </div>
        {/* 两行回收：对仗浮现；赌注段上移收缩 */}
        <div
          style={{
            marginTop: 44,
            opacity: recycle * (1 - wager),
            transform: `translateY(${(1 - recycle) * 16 - wager * 20}px) scale(${1 - wager * 0.2})`,
            height: 120,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, lineHeight: 1.8}}>
            {'一套负责体面地忘：分级收拾、先存再丢、压完往回捞'}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, lineHeight: 1.8}}>
            {'一套负责固执地记：一事一文件、索引常驻、先抢救再碎纸'}
          </div>
        </div>
        {/* 赌注会过期：左押注卡（删除线+盖章）→ 右 keep 新卡升起 */}
        {wager > 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 80,
              marginTop: -110,
              opacity: wager,
            }}
          >
            <div style={{position: 'relative', width: 560, textAlign: 'left'}}>
              <div
                style={{
                  padding: '26px 34px',
                  borderRadius: 16,
                  border: `3px solid ${theme.panelBorder}`,
                  background: theme.panel,
                  opacity: 1 - rise * 0.25,
                }}
              >
                <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'记忆 · 押注'}</div>
                <div style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.text, marginTop: 10}}>
                  {'它记不住'}
                </div>
                {/* 模型变强箭头扫过 */}
                <svg width={492} height={44} style={{display: 'block', marginTop: 14}}>
                  <line
                    x1={0}
                    y1={22}
                    x2={Math.max(0, strike * 460)}
                    y2={22}
                    stroke={theme.core}
                    strokeWidth={4}
                    strokeLinecap="round"
                  />
                  {strike >= 1 ? (
                    <polygon points="492,22 472,13 472,31" fill={theme.core} />
                  ) : null}
                </svg>
                <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 8}}>
                  {'模型变强 →'}
                </div>
                {/* 删除线：箭头扫过后划过卡面 */}
                {strike > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: 10,
                      right: 10,
                      top: '50%',
                      height: 4,
                      background: theme.deny,
                      borderRadius: 2,
                      transform: `scaleX(${strike})`,
                      transformOrigin: 'left center',
                    }}
                  />
                ) : null}
              </div>
              {/* 盖章：基本设定删八成 · 评测没掉分 */}
              {stamp > 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    right: -30,
                    top: -34,
                    padding: '10px 20px',
                    border: `3px solid ${theme.core}`,
                    borderRadius: 10,
                    background: theme.coreDeep,
                    fontFamily: theme.mono,
                    fontSize: 22,
                    fontWeight: 700,
                    color: theme.core,
                    transform: `scale(${0.5 + 0.5 * stamp}) rotate(${(1 - stamp) * -12}deg)`,
                    opacity: stamp,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {'删八成 · 没掉分'}
                </div>
              ) : null}
            </div>
            {/* 右：keep 新卡升起（手写让位给自长记忆） */}
            {rise > 0 ? (
              <div
                style={{
                  width: 420,
                  padding: '26px 32px',
                  borderRadius: 16,
                  border: `3px solid ${theme.keep}`,
                  background: 'rgba(169,196,108,0.05)',
                  opacity: rise,
                  transform: `translateY(${(1 - rise) * 34}px)`,
                }}
              >
                <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.keep}}>{'正在让位'}</div>
                <div style={{fontFamily: theme.serif, fontSize: 36, fontWeight: 700, color: theme.keep, marginTop: 10}}>
                  {'它自己长的记忆'}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {/* p6-06 分水岭卡压场：记忆是建议，钩子才是规则 */}
        {divide > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 140,
              display: 'flex',
              justifyContent: 'center',
              opacity: divide,
              transform: `translateY(${(1 - divide) * -18}px)`,
            }}
          >
            <div
              style={{
                padding: '18px 40px',
                borderRadius: 14,
                border: `2.5px solid ${theme.core}`,
                background: theme.coreDeep,
                textAlign: 'center',
              }}
            >
              <div style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.text}}>
                {'记忆是建议，钩子才是规则'}
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.core, marginTop: 8}}>
                {'提示词工程 → Harness 工程 · 官方口径 · 取数 2026-08'}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** 6-C 身份卡 + 下期预告卡 + 四件套标尺尾帧 + 渐黑（末 beat 总时长推导，红线四） */
const IdentityAndFade: React.FC<{beatDurationInFrames: number; nextAt: number; scaleAt: number}> = ({
  beatDurationInFrames,
  nextAt,
  scaleAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 4, fps, config: {damping: 200}});
  const nextT = interpolate(frame - nextAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 渐黑：末 1.2 秒线性压暗到全黑，窗口从 beat 总时长反推（红线四）
  const fadeFrames = Math.round(1.2 * fps);
  const fadeStart = beatDurationInFrames - fadeFrames;
  const dark = interpolate(frame, [fadeStart, beatDurationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{textAlign: 'center', opacity: enter, transform: `translateY(${(1 - enter) * 18}px)`}}>
        <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.dim, letterSpacing: 3}}>
          {'Claude Code Harness Engineering'}
        </div>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 62,
            fontWeight: 700,
            color: theme.core,
            marginTop: 18,
          }}
        >
          {'记忆层：会丢的和不能丢的'}
        </div>
        {/* 下期预告卡：标题只在画面（反串线纪律） */}
        <div
          style={{
            marginTop: 26,
            padding: '13px 28px',
            border: `1.5px solid ${theme.panelBorder}`,
            borderRadius: 12,
            background: theme.panel,
            opacity: nextT,
            transform: `translateY(${(1 - nextT) * 16}px)`,
            display: 'inline-block',
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, letterSpacing: 2}}>
            {'下期 · 时机层'}
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 31, color: theme.text, marginTop: 5}}>
            {'谁来按下开始'}
          </div>
        </div>
      </div>
      {/* 四件套标尺尾帧：第三格「上下文管理」保持点亮（渐黑前压入） */}
      {frame >= scaleAt ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 1080 - 250,
            opacity: interpolate(frame - scaleAt, [0, 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `scale(0.62)`,
            transformOrigin: 'center bottom',
          }}
        >
          <HarnessScale dropAt={scaleAt} compact cellW={300} />
        </div>
      ) : null}
      {/* 渐黑遮罩 */}
      <AbsoluteFill style={{background: '#000', opacity: dark, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

export const P6Ending: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  // 收尾改序（分镜 6-B → 6-A → 6-C）：免责前置、金句居中、身份+预告压轴
  const bB = w('p6-07', 'p6-08');
  const relB = (id: string) => at(id) - bB.from;
  const bA = w('p6-01', 'p6-06');
  const relA = (id: string) => at(id) - bA.from;
  const bC = w('p6-09', 'p6-10');
  const relC = (id: string) => at(id) - bC.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P6" title="落点与信源" meta="memory is context, not a gate" durationInFrames={scene.durationInFrames} />
      <Sequence {...bB} name="6-B 信源卡前置">
        <SourceFirst />
      </Sequence>
      <Sequence {...bA} name="6-A 一句话合同金句卡">
        <OneLineContract
          recycleAt={relA('p6-03')}
          wagerAt={relA('p6-04a')}
          strikeAt={relA('p6-04b')}
          riseAt={relA('p6-04c')}
          divideAt={relA('p6-06')}
        />
        {/* p6-05：官方口径角标（两条腿都是上下文，不是闸门——分水岭卡的出处行） */}
        <Footnote delay={relA('p6-05')}>{'这两条腿，都是上下文，不是闸门 —— 官方口径 · 取数 2026-08'}</Footnote>
      </Sequence>
      <Sequence {...bC} name="6-C 身份卡与下期预告">
        {/* 渐黑窗口从**本 beat 总时长**推导，不是末句时长（红线四） */}
        <IdentityAndFade
          beatDurationInFrames={bC.durationInFrames}
          nextAt={relC('p6-09')}
          scaleAt={relC('p6-10')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
