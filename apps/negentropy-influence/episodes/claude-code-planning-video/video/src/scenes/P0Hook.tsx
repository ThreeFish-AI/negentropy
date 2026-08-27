/** P0 它没有「昨天」（分镜 0-A…0-C）
 *  痛点：任务单被工具输出顶出视野；桌面平铺色块流；主线问题 + 环在桌后第一次浮现。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Chip, Desk, Footnote, LoopRing, SceneHeader, SceneTag, Stamp, Terminal} from '../components/motifs';

/** p0-07 五样装置（0-C 列队用）：顺序与口播逐字对齐。 */
const DEVICES = [
  {t: '清单', kind: 'list'},
  {t: '副桌', kind: 'desk'},
  {t: '目录', kind: 'card'},
  {t: '垫纸', kind: 'pad'},
  {t: '补救梯', kind: 'ladder'},
] as const;

/** 0-A 系列同款终端：最初的「任务：改命名」首行逐渐被工具输出顶出可视区。
 *  行区整体上移（scrollShift），滚出瞬间残影停在顶端变 dim——「被挤走」被看见。
 *  p0-03「其中一样，刚刚被官方收回去」：右下角「收回」钢印砸下（退位悬念第一分钟埋下）。 */
const TaskScrollsOut: React.FC<{scrollAt: number; ghostAt: number; recallAt: number}> = ({
  scrollAt,
  ghostAt,
  recallAt,
}) => {
  const frame = useCurrentFrame();
  const shift = interpolate(frame - scrollAt, [0, 40], [0, 56], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const drift = interpolate(frame, [Math.max(0, ghostAt - 10), ghostAt + 60], [0, 26], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="TodoWrite" tagline="An Agent Without a Plan Drifts Off Course" accent={theme.view} />
      <div style={{transform: `translateY(${drift}px)`}}>
        <Terminal
          width={1240}
          height={360}
          scrollShift={shift}
          ghostLine="任务：把文件名统一改成 snake_case"
          ghostAt={ghostAt}
          lines={[
            {prompt: '›', text: '任务：把文件名统一改成 snake_case', delay: 4},
            {text: '已改 3 个文件，跑测试 → 2 个失败', color: theme.dim, delay: 52},
            {text: '开始修失败……优化 test_runner.py', color: theme.dim, delay: 96},
            {text: '[bash] sed -i ... rename_util.py', color: theme.mech, delay: 130},
            {text: '[edit] tests/test_runner.py 性能优化', color: theme.mech, delay: 150},
            {text: '[bash] pytest -k perf ...  # 咦，任务单呢？', color: theme.mech, delay: 168},
          ]}
        />
      </div>
      {/* p0-03 收回钢印：deny 色虚影砸下，停半拍后淡出（分镜 0-A 承诺的退位悬念） */}
      {frame >= recallAt ? (
        <div
          style={{
            position: 'absolute',
            right: 300,
            bottom: 250,
            opacity: interpolate(frame - recallAt, [0, 8, 26, 40], [0, 1, 1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <Stamp text="收回" color={theme.deny} at={recallAt} size={150} rotate={-14} />
        </div>
      ) : null}
      <Footnote delay={ghostAt}>{'最初的目标句滚出可视区 —— 注意力没有「锚」'}</Footnote>
    </AbsoluteFill>
  );
};

/** 0-B 终端缩小上移，下方铺开一整张「桌面」：全部对话内容平铺成色块行。
 *  任务单色块持续被新块推向右端，最后被挤出桌沿淡出。 */
const DeskFillsUp: React.FC<{fillPerFrame: number; shoveAt: number; dropAt: number}> = ({
  fillPerFrame,
  shoveAt,
  dropAt,
}) => {
  const frame = useCurrentFrame();
  const W = 1420;
  const H = 520;
  const rows = 7;
  const cols = 12;
  const shown = Math.floor(frame * fillPerFrame);
  // 任务单被推向右端的位移：shoveAt 后持续累积，dropAt 被挤出桌沿淡出
  const push = interpolate(frame - shoveAt, [0, 70], [0, 620], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const dropO = interpolate(frame - dropAt, [0, 22], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labels = ['user', 'assistant', 'tool', 'assistant', 'tool', 'user', 'assistant'];
  const kinds: Array<'user' | 'model' | 'tool'> = ['user', 'model', 'tool', 'model', 'tool', 'user', 'model'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 终端缩小上移（0-A 的余像：上一镜的内容退为背景）。
          先位移再缩放：位移按未缩放坐标系算（transform 从右往左作用），
          -560px 把 1240×330 的终端推到桌面上方、仅露下半截。 */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 1920 / 2 - 1240 * 0.52 / 2,
          width: 1240,
          transform: 'translateY(-560px) scale(0.52)',
          transformOrigin: 'top left',
          opacity: 0.3,
        }}
      >
        <Terminal width={1240} height={330} lines={[]} title="zsh — 已滚出视野" />
      </div>
      <div style={{position: 'relative', marginTop: -40}}>
        <Desk width={W} height={H} style={{padding: 0}}>
          <div style={{position: 'absolute', inset: 16, overflow: 'hidden', borderRadius: 12}}>
            {Array.from({length: rows}).map((_, r) => (
              <div key={r} style={{display: 'flex', gap: 8, marginBottom: 8, paddingLeft: 8}}>
                {Array.from({length: cols}).map((_, c) => {
                  const idx = r * cols + c;
                  if (idx >= shown) return null;
                  const k = kinds[r];
                  const w = 92 + ((idx * 37) % 3) * 26;
                  return (
                    <Chip
                      key={c}
                      kind={k}
                      label={labels[r]}
                      width={w}
                      style={{opacity: 0.9}}
                    />
                  );
                })}
              </div>
            ))}
            {/* 任务单色块：被新块越推越远，最后被挤出桌沿 */}
            {dropO > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  left: 20 + push,
                  top: 20,
                }}
              >
                <Chip kind="task" label="任务：改命名" width={200} height={38} style={{fontSize: 21}} />
              </div>
            ) : null}
          </div>
          {/* 桌沿标尺：谁新谁旧全凭距离 */}
          <div
            style={{
              position: 'absolute',
              right: 18,
              top: -34,
              fontFamily: theme.mono,
              fontSize: 20,
              color: theme.dim,
            }}
          >
            {'旧 ← 桌沿 · 新'}
          </div>
        </Desk>
      </div>
      <Footnote delay={shoveAt}>{'全部内容平铺，谁新谁旧全凭距离 —— 没有重点'}</Footnote>
    </AbsoluteFill>
  );
};

/** 0-C 桌面定格，主线问题两行 serif 大字；环（core）第一次在桌后浮现（35% 透明）。
 *  p0-07 答句后：五样装置小图标自左向右列队点亮（清单/副桌/目录/垫纸/梯子）。 */
const QuestionAndRingBehind: React.FC<{qAt: number; answerAt: number; ringAt: number; devicesAt: number}> = ({
  qAt,
  answerAt,
  ringAt,
  devicesAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const deskIn = spring({frame: frame - 2, fps, config: {damping: 200}});
  const qo = interpolate(frame - qAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ao = interpolate(frame - answerAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ringDraw = interpolate(frame - ringAt, [0, 46], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 环在桌后：先画环（半透明 35%），桌子压在其上——「环在后面看着」 */}
      <div
        style={{
          position: 'absolute',
          opacity: 0.35 * ringDraw,
        }}
      >
        <LoopRing size={560} draw={ringDraw} dimNodes showExit={false} />
      </div>
      <Desk
        width={1380}
        height={460}
        fillOpacity={0.9}
        style={{
          opacity: deskIn,
          transform: `translateY(${(1 - deskIn) * 24}px)`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1.55,
              textAlign: 'center',
              color: theme.text,
              opacity: qo,
            }}
          >
            {'它这一轮到底能看见什么，'}
            <br />
            {'这件事，是它自己说了算吗？'}
          </div>
          <div
            style={{
              marginTop: 34,
              fontFamily: theme.sans,
              fontSize: 27,
              color: theme.view,
              opacity: ao,
            }}
          >
            {'答案：不是。有一整套东西，在替它安排视野。'}
          </div>
          {/* p0-07 五样装置列队：清单/副桌/目录/垫纸/梯子依次点亮（分镜 0-C 承诺） */}
          <div style={{display: 'flex', gap: 26, marginTop: 40}}>
            {DEVICES.map((d, i) => {
              const e = interpolate(frame - devicesAt - i * 6, [0, 10], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              return (
                <div key={d.t} style={{textAlign: 'center', opacity: e, transform: `translateY(${(1 - e) * 12}px)`}}>
                  <svg width={64} height={54} style={{display: 'block', margin: '0 auto'}}>
                    <g stroke={theme.view} strokeWidth={3.5} fill="none" strokeLinecap="round">
                      {d.kind === 'list'
                        ? // 清单：三行勾选
                          [0, 1, 2].map((k) => (
                            <g key={k}>
                              <line x1={8} y1={12 + k * 15} x2={20} y2={12 + k * 15} />
                              <line x1={26} y1={12 + k * 15} x2={56} y2={12 + k * 15} stroke={theme.dim} />
                            </g>
                          ))
                        : d.kind === 'desk'
                          ? // 副桌：小桌 + 旁挂一张
                            (() => (
                              <>
                                <rect x={6} y={26} width={34} height={4} />
                                <line x1={10} y1={30} x2={10} y2={48} />
                                <line x1={36} y1={30} x2={36} y2={48} />
                                <rect x={40} y={34} width={18} height={3} stroke={theme.dim} />
                              </>
                            ))()
                          : d.kind === 'card'
                            ? // 目录：一叠薄卡
                              (() => (
                                <>
                                  <rect x={10} y={8} width={44} height={10} />
                                  <rect x={14} y={24} width={36} height={10} stroke={theme.dim} />
                                  <rect x={18} y={40} width={28} height={10} stroke={theme.dim} />
                                </>
                              ))()
                            : d.kind === 'pad'
                              ? // 垫纸：一张纸 + 拼装角
                                (() => (
                                  <>
                                    <rect x={12} y={6} width={40} height={42} />
                                    <rect x={38} y={34} width={18} height={16} stroke={theme.dim} />
                                  </>
                                ))()
                              : // 梯子：三级
                                (() => (
                                  <>
                                    <line x1={14} y1={4} x2={14} y2={50} />
                                    <line x1={50} y1={4} x2={50} y2={50} />
                                    <line x1={14} y1={16} x2={50} y2={16} />
                                    <line x1={14} y1={30} x2={50} y2={30} />
                                    <line x1={14} y1={44} x2={50} y2={44} />
                                  </>
                                ))()}
                    </g>
                  </svg>
                  <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.text, marginTop: 8}}>{d.t}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Desk>
    </AbsoluteFill>
  );
};

export const P0Hook: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（只取某句的起始帧，不是分镜 beat 窗口）。刻意不叫 w()——
  // check_script --check-scenes 只把 w() 视为分镜窗口，混用会让时点锚刷「分镜陈旧」假 WARN。
  const at = (id: string) => w(id).from;
  const bA = w('p0-01', 'p0-03');
  const relA = (id: string) => at(id) - bA.from;
  const bB = w('p0-04', 'p0-05');
  const relB = (id: string) => at(id) - bB.from;
  const bC = w('p0-06', 'p0-08');
  const relC = (id: string) => at(id) - bC.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P0" title="它没有「昨天」" meta="no yesterday · attention is positional" />
      <Sequence {...bA} name="0-A 任务单滚出视野">
        {/* p0-01 钩子即上滚；p0-03「被官方收回去」：收回钢印 */}
        <TaskScrollsOut scrollAt={relA('p0-01') + 20} ghostAt={relA('p0-02')} recallAt={relA('p0-03')} />
      </Sequence>
      <Sequence {...bB} name="0-B 桌面色块流">
        {/* p0-04「平铺在桌上」起色块堆高；p0-05 主线问句 */}
        <DeskFillsUp fillPerFrame={0.22} shoveAt={relB('p0-04')} dropAt={relB('p0-05')} />
      </Sequence>
      <Sequence {...bC} name="0-C 主线问题与桌后之环">
        {/* p0-06 抛问题+答案句 + 环在桌后描线（35% 透明）；p0-07 五样装置列队 */}
        <QuestionAndRingBehind
          qAt={relC('p0-06')}
          answerAt={relC('p0-06') + 20}
          ringAt={relC('p0-06')}
          devicesAt={relC('p0-07')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
