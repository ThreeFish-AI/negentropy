/** P3 目录卡与垫纸（分镜 3-A…3-F）—— Skill Loading + System Prompt
 *  厚手册压桌计价 → 目录卡扇形展开 → 预算横杆 + 单向阀 → 垫纸碎成四段
 *  → 探针 vs 关键词 → ★段落入缓存仓（外接工具段被拦在仓外闪断）。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Counter, Desk, Footnote, Panel, SceneHeader, Stamp} from '../components/motifs';

/** 3-A 左：桌角薄目录卡叠（每张一行 ~100）；右：整块厚手册拍上桌（~2000+），桌面被压得下沉。 */
const ThickManualSlams: React.FC<{slamAt: number}> = ({slamAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const slam = spring({frame: frame - slamAt, fps, config: {damping: 12}});
  // 桌面被压下沉 8px + 抖动
  const sink = interpolate(frame - slamAt, [0, 8], [0, 8], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const jitter = frame > slamAt + 8 && frame < slamAt + 26 ? Math.sin((frame - slamAt) / 1.4) * 3 : 0;
  // 计价器快速跳字到红色
  const billT = interpolate(frame - slamAt, [6, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
            <div style={{position: 'relative', width: 1560, height: 620, transform: `translateY(${sink + jitter}px)`}}>
        {/* 左：桌角薄目录卡叠 */}
        <div style={{position: 'absolute', left: 60, top: 100}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginBottom: 14}}>
            {'桌角 · 目录卡'}
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 380,
                padding: '10px 16px',
                marginBottom: 8,
                background: theme.panel,
                border: `2px solid ${theme.view}`,
                borderRadius: 8,
                fontFamily: theme.mono,
                fontSize: 19,
                color: theme.text,
                transform: `translateX(${i * 8}px)`,
              }}
            >
              {'这份手册叫什么、管什么'}
              <span style={{color: theme.view, marginLeft: 10}}>{'~100'}</span>
            </div>
          ))}
        </div>
        {/* 右：整块厚手册拍上桌 */}
        <div style={{position: 'absolute', right: 120, top: 60}}>
          <div
            style={{
              transform: `translateY(${(1 - slam) * -300}px) scale(${0.9 + 0.1 * slam})`,
              opacity: slam,
            }}
          >
            <Panel accent={theme.mech} style={{width: 480, height: 330, padding: '22px 26px'}}>
              <div style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.mech}}>
                {'整本手册'}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 8}}>
                {'React 规范 2000 行 + SQL 风格 1500 行'}
              </div>
              {/* 手册厚度示意：密纹行 */}
              <div style={{marginTop: 16}}>
                {Array.from({length: 8}).map((_, i) => (
                  <div key={i} style={{height: 3, background: `${theme.mech}44`, marginBottom: 7, borderRadius: 2, width: `${100 - (i % 3) * 8}%`}} />
                ))}
              </div>
            </Panel>
            {/* 计价器：快速跳字到红色 */}
            <div
              style={{
                marginTop: 14,
                padding: '10px 20px',
                border: `2px solid ${billT >= 1 ? theme.deny : theme.panelBorder}`,
                borderRadius: 10,
                background: theme.panel,
                display: 'inline-block',
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'计价 '}</span>
              <Counter
                from={100}
                to={2000}
                start={slamAt + 6}
                frames={34}
                style={{fontSize: 40, fontWeight: 700, color: billT >= 1 ? theme.deny : theme.mech}}
              />
              <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{' token'}</span>
            </div>
          </div>
        </div>
        {/* 桌面：被压得下沉的桌面示意 */}
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 40}}>
          <Desk width={1560} height={90} style={{borderRadius: 16}} />
        </div>
      </div>
      <Footnote delay={slamAt + 30}>{'百分九十九的内容跟当前任务无关'}</Footnote>
    </AbsoluteFill>
  );
};

/** 3-B 目录卡摊开成一排（各标一行名+用途）；抽中卡 view 高亮 → 厚手册拉开计价 100→2000。 */
const CatalogFan: React.FC<{fanAt: number; pickAt: number; pullAt: number}> = ({fanAt, pickAt, pullAt}) => {
  const frame = useCurrentFrame();
  const cards = [
    {name: 'react_style', use: 'React 组件规范'},
    {name: 'sql_style', use: 'SQL 风格指南'},
    {name: 'api_doc', use: 'API 文档'},
  ];
  const fan = interpolate(frame - fanAt, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const picked = frame >= pickAt;
  const pull = interpolate(frame - pullAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1500, height: 640}}>
        {/* 目录卡扇形展开 */}
        <div style={{position: 'absolute', left: 240, top: 90, transformOrigin: '360px 420px'}}>
          {cards.map((c, i) => {
            const ang = (-18 + i * 18) * fan;
            const isPicked = picked && i === 1;
            return (
              <div
                key={c.name}
                style={{
                  position: 'absolute',
                  // 卡宽 300 而步进只有 90 → 后一张盖掉前一张 70% 的卡面，
                  // 三张卡的 name/use/token 三行互相压字（2026-08 帧检 f11390 实拍）。
                  // 步进放到 215：仍保留「叠成一摞」的层次，但每张的文字带完整露出，
                  // 且卡排右缘（240+430+300=970）不撞右侧厚手册卡的左缘（1020）。
                  left: i * 215,
                  top: i * 26,
                  transform: `rotate(${ang}deg) translateY(${(1 - fan) * 60}px)`,
                  opacity: fan,
                  zIndex: i,
                }}
              >
                <Panel
                  accent={isPicked ? theme.view : theme.panelBorder}
                  style={{
                    width: 300,
                    padding: '14px 18px',
                    background: isPicked ? theme.viewDeep : theme.panel,
                    boxShadow: isPicked ? `0 0 ${18 * fan}px ${theme.view}` : 'none',
                  }}
                >
                  <div style={{fontFamily: theme.mono, fontSize: 20, color: isPicked ? theme.view : theme.text}}>
                    {c.name}
                  </div>
                  <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 4}}>{c.use}</div>
                  <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 6}}>{'~100 token'}</div>
                </Panel>
              </div>
            );
          })}
        </div>
        {/* 抽中 → 对应厚手册从书架拉开上桌 */}
        {picked ? (
          <div
            style={{
              position: 'absolute',
              right: 100,
              top: 120 + (1 - pull) * -40,
              opacity: pull,
              transform: `translateX(${(1 - pull) * 160}px)`,
            }}
          >
            <Panel accent={theme.mech} style={{width: 380, padding: '18px 22px'}}>
              <div style={{fontFamily: theme.serif, fontSize: 28, fontWeight: 700, color: theme.mech}}>
                {'sql_style 手册'}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 6}}>
                {'按需上桌，用完留在那轮记录里'}
              </div>
              <div style={{marginTop: 12, padding: '8px 14px', border: `2px solid ${theme.mech}`, borderRadius: 8, display: 'inline-block'}}>
                <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'~'}</span>
                <Counter from={100} to={2000} start={pullAt + 4} frames={30} style={{fontSize: 34, fontWeight: 700, color: theme.mech}} />
                <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim}}>{' token'}</span>
              </div>
            </Panel>
          </div>
        ) : null}
        {/* 书架：右侧一排书脊 */}
        <div style={{position: 'absolute', right: 60, bottom: 60, display: 'flex', gap: 10, opacity: 0.7}}>
          {['s1', 's2', 's3', 's4'].map((s) => (
            <div key={s} style={{width: 26, height: 130, background: theme.panelBorder, borderRadius: 4}} />
          ))}
        </div>
      </div>
      <Footnote delay={pickAt}>{'目录常驻，内容按需 —— 一张卡 ≈ 整本手册的二十分之一'}</Footnote>
    </AbsoluteFill>
  );
};

/** 3-C 预算硬顶：mech 横杆（~1%/上限标注）落下限位；`../` 路径请求撞上单向阀被 deny 弹回。 */
const BudgetValve: React.FC<{barAt: number; bounceAt: number}> = ({barAt, bounceAt}) => {
  const frame = useCurrentFrame();
  const bar = interpolate(frame - barAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const blocked = frame >= bounceAt;
  const travel = interpolate(frame - bounceAt, [-16, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bounce = blocked
    ? interpolate(frame - bounceAt, [0, 12, 26], [0, -46, -32], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1400, height: 620}}>
        {/* 目录卡排（顶） */}
        <div style={{position: 'absolute', left: 100, top: 40, display: 'flex', gap: 12}}>
          {['react', 'sql', 'api', 'style'].map((n) => (
            <div
              key={n}
              style={{
                width: 150,
                padding: '10px 12px',
                background: theme.panel,
                border: `2px solid ${theme.view}`,
                borderRadius: 8,
                fontFamily: theme.mono,
                fontSize: 18,
                color: theme.text,
                textAlign: 'center',
              }}
            >
              {n}
            </div>
          ))}
        </div>
        {/* 预算横杆：落下限位 */}
        <div style={{position: 'absolute', left: 60, right: 60, top: 150}}>
          <div
            style={{
              height: 12,
              background: theme.mech,
              borderRadius: 6,
              opacity: bar,
              transform: `scaleY(${bar})`,
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: theme.mono,
              fontSize: 21,
              color: theme.mech,
              marginTop: 10,
              opacity: bar,
            }}
          >
            <span>{'上下文窗口的 ~1%'}</span>
            <span>{'绝对上限 8000 字符 · 超了就砍'}</span>
          </div>
        </div>
        {/* 单向阀：取手册只认注册表名，不走文件路径 */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 300}}>
          <svg width={1400} height={280}>
            <line x1={80} y1={160} x2={1320} y2={160} stroke={theme.panelBorder} strokeWidth={4} />
            {/* 单向阀：一个只向右开的阀门 */}
            <g transform="translate(700 160)">
              <circle r={44} fill="none" stroke={theme.mech} strokeWidth={4} />
              {/* 阀芯：指向右的三角（只许正向） */}
              <path d="M-18 -16 L18 0 L-18 16 Z" fill={theme.mech} />
              <text x={0} y={-66} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fontWeight={600} fill={theme.mech}>
                {'注册表名 → 内容'}
              </text>
            </g>
            {/* 合法请求：过阀 */}
            <g opacity={bar}>
              <circle cx={340 + bar * 180} cy={160} r={12} fill={theme.view} />
              <text x={340} y={130} fontFamily={theme.mono} fontSize={19} fill={theme.view}>
                {'load_skill("sql_style")'}
              </text>
            </g>
            {/* 非法路径请求：从右向左撞阀，被弹回右退 */}
            {travel > 0 ? (
              <g>
                <circle cx={1080 - travel * 320 + bounce} cy={160} r={12} fill={theme.deny} opacity={blocked ? 1 : travel} />
                <text x={1010 + bounce} y={130} fontFamily={theme.mono} fontSize={19} fill={theme.deny}>
                  {'load_skill("../../etc/passwd")'}
                </text>
                {blocked ? (
                  <text x={1020 + bounce} y={210} fontFamily={theme.sans} fontSize={22} fontWeight={700} fill={theme.deny}>
                    {'弹回：不走文件路径'}
                  </text>
                ) : null}
              </g>
            ) : null}
          </svg>
        </div>
      </div>
      <Footnote delay={bounceAt}>{'防目录穿越 —— 只认目录里登记过的名字'}</Footnote>
    </AbsoluteFill>
  );
};

/** 3-D 垫纸（system prompt）：写死整纸满屏铺开（dim）→ 碎成四段卡 → 每轮重新拼装。 */
const PadPaper: React.FC<{solidAt: number; crackAt: number; assembleAt: number}> = ({
  solidAt,
  crackAt,
  assembleAt,
}) => {
  const frame = useCurrentFrame();
  const solid = interpolate(frame - solidAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const crack = interpolate(frame - crackAt, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const assemble = interpolate(frame - assembleAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sections = [
    {t: '身份', s: 'identity', d: '你是谁'},
    {t: '工具清单', s: 'tools', d: '实际注册了哪些'},
    {t: '工作目录', s: 'workspace', d: '你在哪'},
    {t: '相关记忆', s: 'memory', d: '文件存不存在'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1400, height: 640}}>
        {/* 写死整纸：先满屏铺开（dim） */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: solid * (1 - crack),
            transform: `scale(${1 - crack * 0.3})`,
          }}
        >
          <Desk width={1400} height={620} accent={theme.dim} fillOpacity={0.8}>
            <div style={{position: 'absolute', inset: 0, padding: 60, opacity: 0.5}}>
              {Array.from({length: 10}).map((_, i) => (
                <div key={i} style={{height: 3, background: theme.dim, marginBottom: 22, width: `${100 - (i % 4) * 6}%`}} />
              ))}
            </div>
            <div
              style={{
                position: 'absolute',
                left: 40,
                top: 24,
                fontFamily: theme.mono,
                fontSize: 21,
                color: theme.dim,
              }}
            >
              {'system prompt · 一整块写死'}
            </div>
          </Desk>
        </div>
        {/* 碎裂动画拆成四段卡 → 滑入对齐 */}
        {crack > 0 ? (
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{display: 'flex', gap: 20, flexWrap: 'wrap', width: 1180}}>
              {sections.map((s2, i) => {
                const t = interpolate(crack - 0.25 - i * 0.12, [0, 0.35], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                const slide = interpolate(assemble - 0.15 - i * 0.1, [0, 0.4], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                const num = `0${i + 1} ${s2.s}`;
                const dx = (1 - slide) * (i % 2 === 0 ? -60 : 60);
                return (
                  <div
                    key={s2.t}
                    style={{
                      opacity: t,
                      transform: `translateY(${(1 - t) * 40}px) translateX(${dx}px)`,
                    }}
                  >
                    <Panel accent={theme.view} style={{width: 270, padding: '16px 18px', background: t >= 1 ? theme.viewDeep : theme.panel}}>
                      <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{num}</div>
                      <div style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 600, color: theme.view, marginTop: 4}}>
                        {s2.t}
                      </div>
                      <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 4}}>{s2.d}</div>
                    </Panel>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        {/* 拼装指示：每轮按真实状态重新拼一次 */}
        {assemble > 0.6 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 10,
              textAlign: 'center',
              fontFamily: theme.sans,
              fontSize: 24,
              color: theme.view,
              opacity: interpolate(assemble, [0.6, 1], [0, 1], {extrapolateRight: 'clamp'}),
            }}
          >
            {'assemble_system_prompt(context) —— 状态变了，纸跟着变'}
          </div>
        ) : null}
      </div>
      <Footnote delay={assembleAt}>{'四段：身份 / 工具清单 / 工作目录 / 相关记忆'}</Footnote>
    </AbsoluteFill>
  );
};

/** 3-E 探针 vs 关键词：左侧两个探针动作（查注册表/查文件存在）；右侧「猜关键词」路径被 deny 划掉。 */
const ProbesVsKeywords: React.FC<{probeAt: number[]; crossAt: number; stampAt: number}> = ({
  probeAt,
  crossAt,
  stampAt,
}) => {
  const frame = useCurrentFrame();
  const probes = [
    {t: '查注册表', s: '实际注册了哪些工具', icon: 'table'},
    {t: '查文件存在', s: '.memory/MEMORY.md 存在吗', icon: 'file'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1500, height: 620}}>
        {/* 左：两个探针动作（mech 小手点向分发表与文件图标） */}
        <div style={{position: 'absolute', left: 40, top: 90, width: 660}}>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.mech, marginBottom: 24}}>
            {'「真实状态」探针'}
          </div>
          {probes.map((p, i) => {
            const on = frame >= probeAt[i];
            const e = interpolate(frame - probeAt[i], [0, 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div key={p.t} style={{display: 'flex', alignItems: 'center', gap: 20, marginBottom: 26, opacity: on ? 1 : 0.3}}>
                <svg width={70} height={70}>
                  {/* 分发表 / 文件图标 */}
                  {p.icon === 'table' ? (
                    <g stroke={on ? theme.mech : theme.dim} strokeWidth={3} fill="none">
                      <rect x={8} y={10} width={54} height={50} rx={5} />
                      <line x1={8} y1={26} x2={62} y2={26} />
                      <line x1={8} y1={44} x2={62} y2={44} />
                      <line x1={32} y1={10} x2={32} y2={60} />
                    </g>
                  ) : (
                    <g stroke={on ? theme.mech : theme.dim} strokeWidth={3} fill="none">
                      <path d="M14 8 h30 l12 12 v42 h-42 Z" />
                      <path d="M44 8 v12 h12" />
                    </g>
                  )}
                </svg>
                <div>
                  <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{p.t}</div>
                  <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 4}}>{p.s}</div>
                </div>
                {/* mech 小手：点一下 */}
                {on ? (
                  <svg width={40} height={40} style={{transform: `translateX(${e * 6}px)`}}>
                    <circle cx={20} cy={22} r={13} fill={theme.mech} opacity={0.25 + 0.35 * Math.max(0, Math.sin((frame - probeAt[i]) / 3))} />
                    <circle cx={20} cy={22} r={5} fill={theme.mech} />
                  </svg>
                ) : null}
              </div>
            );
          })}
          {/* 拼装结果盖 cache hit 章 */}
          <div style={{position: 'relative', marginTop: 10, width: 660, height: 130}}>
            <Panel accent={theme.view} style={{width: 440, padding: '12px 16px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'拼装结果（一字不差）'}</div>
            </Panel>
            <Stamp text="cache hit" color={theme.view} at={stampAt} size={128} rotate={9} fontSize={26} style={{position: 'absolute', left: 320, top: -30}} />
          </div>
        </div>
        {/* 右：被否决的「猜关键词」路径（消息里高亮词 + 问号）整条 deny 划掉 */}
        <div style={{position: 'absolute', right: 40, top: 90, width: 560}}>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginBottom: 24}}>
            {'被否决：猜消息里的关键词'}
          </div>
          <Panel accent={theme.deny} style={{width: 520, padding: '18px 22px', background: theme.denyDeep, position: 'relative'}}>
            <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, lineHeight: 1.7}}>
              {'消息里出现了 '}
              <span style={{color: theme.deny, fontWeight: 700}}>{'"数据库"'}</span>
              {' → 就把数据库手册塞进去？'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 40, color: theme.deny, marginTop: 10}}>{'?'}</div>
            {/* 整条划掉 */}
            <svg width={520} height={140} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
              <line
                x1={26}
                y1={26}
                x2={26 + 468 * interpolate(frame - crossAt, [0, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
                y2={26 + 96 * interpolate(frame - crossAt, [0, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
                stroke={theme.deny}
                strokeWidth={7}
                strokeLinecap="round"
                opacity={frame >= crossAt ? 1 : 0}
              />
            </svg>
          </Panel>
          <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.deny, marginTop: 16}}>
            {'猜关键词，是给幻觉开门'}
          </div>
        </div>
      </div>
      <Footnote delay={crossAt}>{'工具查实际注册表 · 记忆查文件存在 —— 不搜消息'}</Footnote>
    </AbsoluteFill>
  );
};

/** 3-F ★深挖帧：先**官方削层**——整块垫纸剖面从满高削掉八成（p3-21，24 帧），旁边评测计分板
 *  数字纹丝不动并打勾，压字「删掉八成以上，评测不掉分 · 官方 2026-07」；p3-21a 金句短卡；
 *  随后静态/动态段落分层图：段落卡排成两层进缓存仓（p3-22 起），外接工具段被拦在仓外闪断；
 *  p3-25 收束句浮现。 */
const CacheShed: React.FC<{
  trimAt: number;
  quoteAt: number;
  enterAt: number;
  blockAt: number;
  flickerAt: number;
  closeAt: number;
}> = ({trimAt, quoteAt, enterAt, blockAt, flickerAt, closeAt}) => {
  const frame = useCurrentFrame();
  // p3-21a 金句短卡（整拍切卡）
  if (frame >= quoteAt && frame < enterAt) {
    return <QuoteCard zh="提示的长度，反比于模型的记忆 —— 模型越强，纸越短" accent={theme.view} />;
  }
  // 削层阶段（p3-20..p3-21a）：剖面 + 计分板
  const trim = interpolate(frame - trimAt, [0, 24], [1, 0.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 被削掉的部分向上碎裂淡出
  const debris = frame > trimAt && frame < trimAt + 34;
  const scoreOn = frame >= trimAt + 10;
  const layers = [
    {t: '静态层', items: ['身份', '语气风格', '任务守则'], color: theme.view},
    {t: '动态层', items: ['会话指引', '记忆', '环境信息'], color: theme.view},
  ];
  const blocked = frame >= blockAt;
  // 卡身闪断：模拟掉线（方波闪烁，确定性）
  const flicker =
    frame >= flickerAt ? (Math.floor((frame - flickerAt) / 6) % 2 === 0 ? 1 : 0.25) : 1;
  // p3-25 收束句
  const close = interpolate(frame - closeAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 分层图阶段（p3-22 起）
  const shedOn = frame >= enterAt;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {!shedOn ? (
        <div style={{position: 'relative', width: 1360, height: 640}}>
          {/* 整块垫纸剖面：height 由 100% 插值到 20%（24 帧） */}
          <div style={{position: 'absolute', left: 240, top: 60, width: 460}}>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginBottom: 14}}>
              {'垫纸剖面（system prompt）'}
            </div>
            <div style={{position: 'relative', width: 460, height: 400}}>
              {/* 保留段 */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  width: 460,
                  height: 400 * trim,
                  border: `3px solid ${theme.view}`,
                  borderRadius: 10,
                  background: `${theme.viewDeep}66`,
                }}
              />
              {/* 被削掉的部分：向上碎裂淡出（三条碎块错帧上浮） */}
              {debris
                ? [0, 1, 2].map((k) => (
                    <div
                      key={k}
                      style={{
                        position: 'absolute',
                        bottom: 400 * trim + k * 36,
                        width: 460 - k * 70,
                        left: k * 35,
                        height: 20,
                        background: theme.dim,
                        borderRadius: 4,
                        opacity: interpolate(frame - trimAt - k * 4, [0, 26], [0.7, 0], {
                          extrapolateLeft: 'clamp',
                          extrapolateRight: 'clamp',
                        }),
                        transform: `translateY(${interpolate(frame - trimAt - k * 4, [0, 26], [0, -50], {
                          extrapolateLeft: 'clamp',
                          extrapolateRight: 'clamp',
                        })}px)`,
                      }}
                    />
                  ))
                : null}
            </div>
            {/* 压字 */}
            <div
              style={{
                marginTop: 18,
                fontFamily: theme.serif,
                fontSize: 27,
                fontWeight: 700,
                color: theme.view,
                opacity: interpolate(frame - trimAt - 18, [0, 14], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              {'删掉八成以上，评测不掉分'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 6}}>
              {'官方 2026-07 · code.claude.com'}
            </div>
            {/* p3-20 体量角标（三级归属：源码分析） */}
            <div
              style={{
                marginTop: 16,
                fontFamily: theme.mono,
                fontSize: 20,
                color: theme.dim,
                opacity: interpolate(frame, [10, 24], [0, 0.95], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              {'常规两三万字 · 极简两行 —— 第三方的源码分析'}
            </div>
          </div>
          {/* 评测计分板：数字纹丝不动并打勾 */}
          <div style={{position: 'absolute', right: 200, top: 130}}>
            <Panel style={{width: 380, padding: '22px 28px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'评测计分板'}</div>
              {/* 数字纹丝不动：只呈现「不变」本身，不虚构具体分数。
                  ⚠️ 占位符曾写作全角破折号「— . —」：等宽字体里这三个字符渲染成
                  两根粗横杠夹一个小方点，读者看到的是三块无意义的色块而非「某个分数」
                  （2026-08 帧检 f14477 实拍）。改用等宽数字占位符 ##.#，
                  「有个分数、但具体值不重要」的语义反而立住，且不虚构任何数字。 */}
              <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 10}}>
                <div style={{fontFamily: theme.mono, fontSize: 44, fontWeight: 700, color: theme.text}}>
                  {'##.#'}
                </div>
                <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{'= 削层前'}</div>
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 6}}>
                {'删掉八成以上，分数纹丝不动'}
              </div>
            </Panel>
            {/* 打勾：削层完成后落下 */}
            {scoreOn ? (
              <Stamp text="✓" color={theme.view} at={trimAt + 10} size={120} rotate={8} style={{position: 'absolute', right: -50, top: -40}} />
            ) : null}
          </div>
        </div>
      ) : (
        <div style={{position: 'relative', width: 1560, height: 720}}>
        {/* 缓存仓：右侧一座两层仓 */}
        <div style={{position: 'absolute', right: 60, top: 40}}>
          <div
            style={{
              width: 520,
              height: 560,
              border: `4px solid ${theme.mech}`,
              borderRadius: 18,
              position: 'relative',
              background: `${theme.mechDeep}44`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 20,
                top: -16,
                background: theme.bg,
                padding: '0 12px',
                fontFamily: theme.serif,
                fontSize: 26,
                fontWeight: 700,
                color: theme.mech,
              }}
            >
              {'缓存仓'}
            </div>
            {layers.map((ly, li) => (
              <div key={ly.t} style={{position: 'absolute', left: 20, right: 20, top: 30 + li * 250}}>
                <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginBottom: 10}}>{ly.t}</div>
                <div style={{display: 'flex', gap: 10}}>
                  {ly.items.map((it, i) => {
                    // 段落卡依次入仓盖章（滑入）
                    const at = enterAt + (li * 3 + i) * 9;
                    const e = interpolate(frame - at, [0, 16], [0, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    });
                    return (
                      <div
                        key={it}
                        style={{
                          width: 150,
                          padding: '12px 10px',
                          background: theme.panel,
                          border: `2px solid ${theme.view}`,
                          borderRadius: 8,
                          textAlign: 'center',
                          fontFamily: theme.sans,
                          fontSize: 20,
                          color: theme.text,
                          opacity: e,
                          transform: `translateX(${(1 - e) * 60}px)`,
                        }}
                      >
                        {it}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* 仓门 */}
            <div
              style={{
                position: 'absolute',
                left: 20,
                right: 20,
                bottom: 18,
                textAlign: 'center',
                fontFamily: theme.mono,
                fontSize: 19,
                color: theme.mech,
                opacity: 0.8,
              }}
            >
              {'状态没变 → 直接用上一次拼好的'}
            </div>
          </div>
        </div>
        {/* 外接工具段：被拦在仓外（deny 拦杆 + 闪断） */}
        <div style={{position: 'absolute', left: 60, top: 150, width: 560}}>
          <div
            style={{
              opacity: flicker,
              transform: `translateX(${blocked ? 0 : -40 * (1 - interpolate(frame - blockAt, [0, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}))}px)`,
            }}
          >
            <Panel accent={theme.deny} style={{width: 440, padding: '18px 22px', background: theme.denyDeep}}>
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'mcp_instructions'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.deny, marginTop: 6}}>
                {'外接工具段'}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 8}}>
                {'外接的服务随时会掉线'}
              </div>
            </Panel>
          </div>
          {/* deny 拦杆：仓门外的闸杆 */}
          <svg width={560} height={80} style={{marginTop: 20}}>
            <g opacity={blocked ? 1 : 0.2}>
              {[0, 1, 2].map((k) => (
                <line
                  key={k}
                  x1={20 + k * 26}
                  y1={10 + (k % 2) * 10}
                  x2={20 + k * 26}
                  y2={70}
                  stroke={theme.deny}
                  strokeWidth={5}
                  strokeLinecap="round"
                  opacity={0.85}
                />
              ))}
              <line
                x1={14}
                y1={16}
                x2={14 + 96 * interpolate(frame - blockAt, [0, 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
                y2={52}
                stroke={theme.deny}
                strokeWidth={6}
                strokeLinecap="round"
              />
              <text x={130} y={46} fontFamily={theme.sans} fontSize={22} fontWeight={700} fill={theme.deny}>
                {'不许进缓存'}
              </text>
            </g>
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginTop: 10, width: 460}}>
            {'缓存它就是在缓存一个谎言'}
          </div>
        </div>
        {/* p3-25 收束句：这张垫纸拼得比谁都勤俭 */}
        {close > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 30,
              textAlign: 'center',
              fontFamily: theme.serif,
              fontSize: 30,
              fontWeight: 700,
              color: theme.view,
              opacity: close,
              transform: `translateY(${(1 - close) * 12}px)`,
            }}
          >
            {'每轮都在拼，但拼得比谁都勤俭'}
          </div>
        ) : null}
        </div>
      )}
      <Footnote delay={blockAt + 10}>
        {'唯一不缓存的段落：外接工具段 —— 第三方的源码分析'}
      </Footnote>
    </AbsoluteFill>
  );
};

export const P3Manual: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p3-01', 'p3-03');
  const relA = (id: string) => at(id) - bA.from;
  const bB = w('p3-04', 'p3-07');
  const relB = (id: string) => at(id) - bB.from;
  const bC = w('p3-08', 'p3-10');
  const relC = (id: string) => at(id) - bC.from;
  const bD = w('p3-11', 'p3-15');
  const relD = (id: string) => at(id) - bD.from;
  const bE = w('p3-16', 'p3-19');
  const relE = (id: string) => at(id) - bE.from;
  const bF = w('p3-20', 'p3-26');
  const relF = (id: string) => at(id) - bF.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P3" title="目录卡与垫纸" meta="Skills · progressive disclosure" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="3-A 厚手册压桌">
        {/* p3-02「全贴进基本设定」手册拍上桌；p3-03 计价器跳红 */}
        <ThickManualSlams slamAt={relA('p3-02')} />
      </Sequence>
      <Sequence {...bB} name="3-B 目录扇形与手册拉开">
        {/* p3-04 目录摊开；p3-06「再把整本手册拉上桌」抽中拉开 */}
        <CatalogFan fanAt={relB('p3-04')} pickAt={relB('p3-05')} pullAt={relB('p3-06')} />
      </Sequence>
      <Sequence {...bC} name="3-C 预算横杆与单向阀">
        {/* p3-09 预算硬顶横杆；p3-10 路径请求撞阀弹回 */}
        <BudgetValve barAt={relC('p3-09')} bounceAt={relC('p3-10')} />
      </Sequence>
      <Sequence {...bD} name="3-D 垫纸碎成四段">
        {/* p3-13「写死的」整纸铺开；p3-15「拆成几段」碎裂；p3-16 重拼 */}
        <PadPaper solidAt={relD('p3-13')} crackAt={relD('p3-15')} assembleAt={relD('p3-16')} />
      </Sequence>
      <Sequence {...bE} name="3-E 探针与关键词">
        {/* p3-17 两个探针；p3-18 关键词路径打叉；p3-19 cache hit 章 */}
        <ProbesVsKeywords
          probeAt={[relE('p3-17'), relE('p3-17') + 24]}
          crossAt={relE('p3-18')}
          stampAt={relE('p3-19')}
        />
      </Sequence>
      <Sequence {...bF} name="3-F 削层与缓存仓">
        {/* p3-20 体量角标；p3-21 官方削层（剖面 100%→20% + 计分板打勾）；p3-21a 金句短卡；
            p3-22 起段落入仓；p3-23 外接段拦 + 闪断；p3-25 收束句 */}
        <CacheShed
          trimAt={relF('p3-21')}
          quoteAt={relF('p3-21a')}
          enterAt={relF('p3-22')}
          blockAt={relF('p3-22') + 20}
          flickerAt={relF('p3-23')}
          closeAt={relF('p3-25')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
