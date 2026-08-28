/** P3 应急通道与帮工纪律（分镜 3-A…3-C）
 *  3-A 帮工特写：指令卡首尾双弹（只许写字·绝不调工具）；工具之手被 deny 栏杆挡回两次；
 *  3-B 草稿区与正式区：草稿字迹显现 → 誊写正式卡 → 草稿碎纸飘落；
 *  3-C ★回捞钩：压缩后文件柜门开，五张卡按重要性被钩回桌面；末句诚实角标。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Cabinet, Desk, Footnote, HelperFigure, Panel, PaperCard, SceneHeader} from '../components/motifs';

/** 3-A 帮工特写：指令卡首（top 指令）尾（bottom 叮嘱）各弹一次 + 工具之手两次被挡 */
const HelperDiscipline: React.FC<{firstAt: number; lastAt: number; handAt: number[]}> = ({
  firstAt,
  lastAt,
  handAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 4, fps, config: {damping: 200}});
  const first = spring({frame: frame - firstAt, fps, config: {damping: 13}});
  const last = spring({frame: frame - lastAt, fps, config: {damping: 13}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1420, height: 560, opacity: enter}}>
        {/* 中央：帮工小人 */}
        <div style={{position: 'absolute', left: 610, top: 130}}>
          <HelperFigure
            size={230}
            armAngle={interpolate(frame, [0, 90], [0, -20], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}
          />
        </div>
        {/* 头顶指令卡（开头第一句） */}
        <div
          style={{
            position: 'absolute',
            left: 430,
            top: -10,
            opacity: first,
            transform: `translateY(${(1 - first) * -36}px) rotate(${(1 - first) * -8}deg)`,
          }}
        >
          <div
            style={{
              padding: '14px 26px',
              borderRadius: 12,
              background: theme.panel,
              border: `3px solid ${theme.mech}`,
              fontFamily: theme.sans,
              fontSize: 27,
              fontWeight: 700,
              color: theme.mech,
              whiteSpace: 'nowrap',
            }}
          >
            {'「这次只许写字，绝不许调用任何工具」'}
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: theme.mono,
              fontSize: 20,
              color: theme.dim,
              textAlign: 'center',
            }}
          >
            {'开头第一句'}
          </div>
        </div>
        {/* 结尾叮嘱卡（再叮嘱一遍） */}
        {last > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 430,
              bottom: -6,
              opacity: last,
              transform: `translateY(${(1 - last) * 36}px) rotate(${(1 - last) * 8}deg)`,
            }}
          >
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 20,
                color: theme.dim,
                textAlign: 'center',
              }}
            >
              {'结尾还要再叮嘱一遍'}
            </div>
            <div
              style={{
                padding: '10px 22px',
                borderRadius: 12,
                background: theme.panel,
                border: `2px dashed ${theme.mech}`,
                fontFamily: theme.sans,
                fontSize: 23,
                color: theme.mech,
                whiteSpace: 'nowrap',
              }}
            >
              {'「不许调工具」'}
            </div>
          </div>
        ) : null}
        {/* 工具之手：从右侧伸出 → 被 deny 栏杆挡回，两次 */}
        {handAt.map((h, round) => {
          // 伸出 0→1，随后撞栏弹回 1→0
          const reach = interpolate(frame - h, [0, 12, 18, 30], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          if (reach <= 0) return null;
          // reach=1 时指尖恰好抵住 deny 栏杆（left 880）——挡回要「看得见撞上」
          const handX = 832 + (1 - reach) * 260;
          return (
            <div key={round}>
              {/* 手：drawn（无 emoji）——一条臂 + 张开的手掌线 */}
              <svg
                width={340}
                height={150}
                style={{position: 'absolute', left: handX - 252, top: 240}}
              >
                <line x1={0} y1={75} x2={210} y2={75} stroke={theme.dim} strokeWidth={14} strokeLinecap="round" />
                {[0, 1, 2, 3].map((f) => (
                  <line
                    key={f}
                    x1={210}
                    y1={75}
                    x2={252}
                    y2={42 + f * 22}
                    stroke={theme.dim}
                    strokeWidth={9}
                    strokeLinecap="round"
                  />
                ))}
                <text x={40} y={40} fontFamily={theme.sans} fontSize={21} fill={theme.dim}>
                  {'工具之手'}
                </text>
              </svg>
              {/* deny 栏杆：竖条 + 挡回闪现 */}
              <div
                style={{
                  position: 'absolute',
                  left: 880,
                  top: 210,
                  width: 14,
                  height: 150,
                  borderRadius: 6,
                  background: theme.deny,
                  opacity: reach > 0.85 ? 1 : 0.4,
                  boxShadow: reach > 0.85 ? `0 0 ${Math.round(28 * reach)}px ${theme.deny}` : 'none',
                }}
              />
              {reach > 0.9 && frame < h + 20 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 760,
                    top: 180,
                    fontFamily: theme.sans,
                    fontSize: 24,
                    fontWeight: 700,
                    color: theme.deny,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {`挡回 ×${round + 1}`}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <Footnote delay={firstAt}>
        {'指令原文由第三方从真实实现里抄出（首尾各一遍）—— 第三方的源码分析'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 3-B 草稿区 → 正式区誊清 → 草稿碎纸飘落 */
const DraftThenFair: React.FC<{draftAt: number; fairAt: number; tearAt: number}> = ({
  draftAt,
  fairAt,
  tearAt,
}) => {
  const frame = useCurrentFrame();
  const draftText = '先理思路：目标是…… 已改…… 剩……';
  const fairText = '当前目标 / 重要发现 / 已改文件 / 剩余工作 / 用户约束';
  const draftShown = Math.max(
    0,
    Math.min(draftText.length, Math.floor((frame - draftAt) / 2)),
  );
  const fairShown = Math.max(
    0,
    Math.min(fairText.length, Math.floor((frame - fairAt) / 2)),
  );
  // 草稿撕裂：碎纸片（帧驱动确定性：按索引取固定相位）向下飘
  const tearT = interpolate(frame - tearAt, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 40, alignItems: 'flex-start'}}>
        {/* 草稿区 */}
        <div style={{position: 'relative'}}>
          <div
            style={{
              width: 560,
              height: 330,
              borderRadius: 14,
              border: `2px dashed ${theme.panelBorder}`,
              background: theme.panel,
              padding: '20px 24px',
              opacity: 1 - tearT,
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'草稿区（给自己看的）'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.text, marginTop: 16, whiteSpace: 'pre'}}>
              {draftText.slice(0, draftShown)}
              {draftShown < draftText.length ? <span style={{color: theme.core}}>{'▍'}</span> : null}
            </div>
          </div>
          {/* 碎纸片：撕裂后向下飘散（索引决定 x 相位与旋角——确定性） */}
          {tearT > 0
            ? Array.from({length: 10}).map((_, i) => {
                const drift = (i * 37) % 90;
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: 40 + drift,
                      top: 30 + tearT * (300 + ((i * 53) % 120)),
                      width: 26 + (i % 3) * 8,
                      height: 18,
                      borderRadius: 3,
                      background: theme.text,
                      opacity: (1 - tearT) * 0.5,
                      transform: `rotate(${((i * 47) % 360) * tearT}deg)`,
                    }}
                  />
                );
              })
            : null}
        </div>
        {/* 誊写箭头 */}
        <div style={{paddingTop: 130}}>
          <svg width={120} height={60}>
            <line x1={0} y1={30} x2={96} y2={30} stroke={theme.mech} strokeWidth={5} strokeLinecap="round" />
            <polygon points="96,30 78,20 78,40" fill={theme.mech} />
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.mech, textAlign: 'center', marginTop: 6}}>
            {'誊清'}
          </div>
        </div>
        {/* 正式区 */}
        <div
          style={{
            width: 560,
            height: 330,
            borderRadius: 14,
            border: `3px solid ${theme.mech}`,
            background: theme.panel,
            padding: '20px 24px',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.mech}}>{'正式摘要（给对话看的）'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.text, marginTop: 16, whiteSpace: 'pre'}}>
            {fairText.slice(0, fairShown)}
            {fairShown > 0 && fairShown < fairText.length ? (
              <span style={{color: theme.core}}>{'▍'}</span>
            ) : null}
          </div>
        </div>
      </div>
      <Footnote delay={tearAt}>{'草稿写完就撕掉，不留在桌上 —— 仓库实测（摘要双标签）'}</Footnote>
    </AbsoluteFill>
  );
};

/** 3-C ★回捞钩：压缩后柜门开，五张文件卡按重要性被钩回桌面 */
const SalvageHook: React.FC<{openAt: number; hookAt: number; honestAt: number}> = ({
  openAt,
  hookAt,
  honestAt,
}) => {
  const frame = useCurrentFrame();
  const open = interpolate(frame - openAt, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const grabbed = hookAt + 10;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1640, height: 620}}>
        {/* 桌面（左）：捞回的卡按重要性排队落位 */}
        <Desk w={900} h={430} style={{position: 'absolute', left: 0, top: 100}} label="桌面（压缩后）">
          {[0, 1, 2, 3, 4].map((i) => {
            // 钩爪依次捞回：第 i 张在 hookAt + i*10 后从柜（x0，Desk 外右侧）飞到桌面
            const t = interpolate(frame - (hookAt + i * 10), [0, 22], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const x0 = 820; // 柜内起点（Desk 右缘外的文件柜方向）
            const y0 = 120 + i * 66;
            const x1 = 70 + i * 158; // 桌面落位
            const y1 = 200 + (i % 2) * 90;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 90;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  opacity: t > 0 ? 1 : 0,
                }}
              >
                <PaperCard
                  w={150}
                  h={80}
                  bars={3}
                  tone="full"
                  label={`重要性 ${5 - i}`}
                />
              </div>
            );
          })}
          {/* 重要性标注 */}
          <div
            style={{
              position: 'absolute',
              left: 70,
              bottom: 18,
              fontFamily: theme.mono,
              fontSize: 22,
              color: theme.text,
              opacity: interpolate(frame - grabbed - 30, [0, 12], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {'≤ 5 个文件 · 单份限额 · 总量预算 · 按重要性排队'}
          </div>
        </Desk>
        {/* 文件柜（右）：门开，钩爪伸入 */}
        <Cabinet
          w={480}
          h={560}
          drawers={5}
          openIndex={open > 0.3 ? 2 : -1}
          label="文件柜"
          style={{position: 'absolute', right: 30, top: 30}}
        />
        {/* 钩爪：从桌面伸向柜内的弧线钩 */}
        <svg width={900} height={620} style={{position: 'absolute', left: 380, top: 0, pointerEvents: 'none'}}>
          {open > 0.3 ? (
            <g opacity={open}>
              {/* 钩臂：随第 i 张卡回收摆动（最近一次） */}
              {[0, 1, 2, 3, 4].map((i) => {
                const t = interpolate(frame - (hookAt + i * 10), [0, 22], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                if (t <= 0 || t >= 1) return null;
                const bend = Math.sin(t * Math.PI) * 70;
                return (
                  <path
                    key={i}
                    d={`M 60 300 C ${260 - bend} ${240 - bend}, ${560 - bend} ${180 + i * 70}, ${840} ${180 + i * 70}`}
                    stroke={theme.mech}
                    strokeWidth={4}
                    fill="none"
                    opacity={0.65}
                  />
                );
              })}
            </g>
          ) : null}
        </svg>
        {/* 诚实角标：末句浮现（三级证据归属） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: -64,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.keep,
            opacity: interpolate(frame - honestAt, [0, 14], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {'本段为第三方的源码分析（真实实现的行为，超出最简示例范围）'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 3-C 压缩存活矩阵（官方口径）+ 回捞钩（Harness Engineering 改造版）
 *  谁活过压缩：系统提示绕行不变；规则与自动记忆从磁盘重注入；技能正文重注入（封顶五千、最旧先丢）。 */
const SurvivalMatrix: React.FC<{matrixAt: number; openAt: number; hookAt: number; honestAt: number}> = ({
  matrixAt,
  openAt,
  hookAt,
  honestAt,
}) => {
  const frame = useCurrentFrame();
  const rows = [
    {t: '系统提示', fate: '绕行不变', alive: true},
    {t: '根规则 + 自动记忆', fate: '从磁盘重注入', alive: true},
    {t: '带路径的规则', fate: '丢到再读到匹配文件', alive: false},
    {t: '已用技能正文', fate: '重注入 · 每份封顶五千 · 最旧先丢', alive: true},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1300, height: 560}}>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginBottom: 20, textAlign: 'center'}}>
          {'压缩之后，谁活下来？'}
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
          {rows.map((r, i) => {
            const e = interpolate(frame - matrixAt - i * 8, [0, 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div key={r.t} style={{display: 'flex', alignItems: 'center', gap: 18, opacity: e}}>
                <Panel
                  accent={r.alive ? theme.keep : theme.panelBorder}
                  style={{padding: '13px 22px', width: 360, background: r.alive ? theme.keepDeep : theme.panel}}
                >
                  <span style={{fontFamily: theme.mono, fontSize: 23, color: theme.text}}>{r.t}</span>
                </Panel>
                <span style={{fontFamily: theme.sans, fontSize: 24, color: r.alive ? theme.keep : theme.dim}}>
                  {r.fate}
                </span>
              </div>
            );
          })}
        </div>
        {/* 回捞钩（p3-12/13）：文件卡被钩回 */}
        {frame >= openAt ? <SalvageHook openAt={openAt} hookAt={hookAt} honestAt={honestAt} /> : null}
      </div>
      <Footnote delay={matrixAt + 30}>
        {'压缩存活矩阵 —— 官方文档 context-window（取数2026年8月）'}
      </Footnote>
    </AbsoluteFill>
  );
};

export const P3Helper: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p3-01', 'p3-06');
  const relA = (id: string) => at(id) - bA.from;
  const bB = w('p3-07', 'p3-08');
  const relB = (id: string) => at(id) - bB.from;
  const bC = w('p3-09', 'p3-16');
  const relC = (id: string) => at(id) - bC.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P3" title="应急通道与帮工纪律" meta="compaction survival matrix" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="3-A 帮工特写与工具之手">
        <HelperDiscipline
          firstAt={relA('p3-04')}
          lastAt={relA('p3-04') + 60}
          handAt={[relA('p3-05'), relA('p3-05') + 66]}
        />
      </Sequence>
      <Sequence {...bB} name="3-B 草稿誊清">
        <DraftThenFair
          draftAt={relB('p3-07')}
          fairAt={relB('p3-08')}
          tearAt={relB('p3-08') + 40}
        />
      </Sequence>
      <Sequence {...bC} name="3-C 存活矩阵与回捞">
        <SurvivalMatrix matrixAt={relC('p3-09')} openAt={relC('p3-12')} hookAt={relC('p3-13')} honestAt={relC('p3-15')} />
      </Sequence>
    </AbsoluteFill>
  );
};
