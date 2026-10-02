/** P5 认证插座（p5-01..16，4 镜 4 cue）——分镜 5-A…5-D。
 *
 *  cue 清单（4）：
 *   5-B socket-pool connect-discover@p5-04 / prefix@p5-06（p5-03/05/07 空窗回落）
 *   5-C socket-pool rebuild@p5-11 / stale@p5-12（p5-08..10 空窗=缓存账本对比装置；
 *      与 5-B 末章隔 p5-07 空窗 → 默认入场）
 *
 *  ★ 5-A 插座开张：楼下插座位亮灯＋内部服务矩阵（工单/部署/知识库）stagger
 *    亮起又打「重写接入？」问号 @impulse。
 *  ★ 5-C 空窗装置：前几章命中缓存 vs 本章每轮重组的账本对比＋旧清单叫空
 *    （deny「查无此号」）。
 *  ★ 5-D 铭牌与边界：只读/破坏性只是文字标签（@enter:pop）＋「不拦截」角标＋
 *    虚位门（@dim——门装在收官段的权限钩子上）＋教学版外接仅队长＋【三】丰富度。
 *  ★ LodgeMap active=socket（本幕坐标高亮）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LodgeMap, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {DUR, clamp01, progress, useDim, useEnter, useImpulse, useProgress, useStagger} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const BADGE_STYLE: React.CSSProperties = {top: 64};

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const KeyCard: React.FC<{at: number; main: string; sub?: string; accent?: string; left?: number; top?: number; width?: number}> = ({
  at,
  main,
  sub,
  accent,
  left = 660,
  top = 400,
  width = 600,
}) => {
  const o = useProgress(at, DUR.f4);
  return (
    <div style={{position: 'absolute', left, top, width, opacity: o, transform: `translateY(${(1 - o) * 14}px)`, textAlign: 'center'}}>
      <Panel accent={accent} style={{boxSizing: 'border-box', padding: '22px 30px'}}>
        <div style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 600, color: theme.text}}>{main}</div>
        {sub ? <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim, marginTop: 10}}>{sub}</div> : null}
      </Panel>
    </div>
  );
};

// ── 5-A 插座开张 ────────────────────────────────────────────────────────

/** 楼下插座位亮灯；内部服务矩阵逐个亮起又打「重写接入？」问号。 */
const SocketOpens: React.FC<{at02: number}> = ({at02}) => {
  const stripIn = useProgress(2, DUR.f5);
  // 服务矩阵 stagger 亮起
  const svc = useStagger(3, {at: 12, dur: DUR.f4, stride: 10});
  // 「重写接入？」问号闪（否定——不现实）
  const q = useImpulse({at: at02 + 8, dur: DUR.f6, peak: 1});
  const qO = useProgress(at02 + 6, DUR.f3);
  const services = ['工单', '部署', '知识库'];
  return (
    <AbsoluteFill>
      {/* 插座排（楼下插座位） */}
      <div style={{position: 'absolute', left: 510, top: 250, opacity: stripIn}}>
        <div
          style={{
            width: 900,
            boxSizing: 'border-box',
            padding: '26px 34px',
            borderRadius: 14,
            background: theme.panel,
            border: `3px solid ${theme.accent}`,
            boxShadow: `0 0 ${16 * stripIn}px ${withAlpha(theme.accent, 0.25)}`,
            display: 'flex',
            alignItems: 'center',
            gap: 34,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, writingMode: 'vertical-rl', letterSpacing: 4}}>{'SOCKET'}</div>
          {/* 三孔插座位 */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 120,
                borderRadius: 10,
                border: `2.5px solid ${svc[i] > 0.5 ? theme.accent : theme.panelBorder}`,
                background: svc[i] > 0.5 ? withAlpha(theme.accent, 0.08) : theme.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                opacity: 0.4 + 0.6 * svc[i],
              }}
            >
              {/* 插孔（两孔一地） */}
              <div style={{display: 'flex', gap: 10}}>
                <div style={{width: 14, height: 34, borderRadius: 7, background: theme.bg, border: `2px solid ${theme.dim}`}} />
                <div style={{width: 14, height: 34, borderRadius: 7, background: theme.bg, border: `2px solid ${theme.dim}`}} />
              </div>
              <div style={{width: 16, height: 16, borderRadius: 999, background: theme.bg, border: `2px solid ${theme.dim}`}} />
            </div>
          ))}
        </div>
      </div>
      {/* 内部服务矩阵（逐个亮起） */}
      <div style={{position: 'absolute', left: 560, top: 500, display: 'flex', gap: 30}}>
        {services.map((s, i) => (
          <div key={s} style={{opacity: svc[i], transform: `translateY(${(1 - svc[i]) * 16}px)`}}>
            <Panel accent={theme.accent} style={{width: 240, boxSizing: 'border-box', padding: '18px 22px', position: 'relative'}}>
              <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>{`${s}服务`}</div>
              <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 6}}>{'internal'}</div>
              {/* 重写接入？问号（否定闪） */}
              <div
                style={{
                  position: 'absolute',
                  right: 12,
                  top: -16,
                  fontFamily: theme.mono,
                  fontSize: 30,
                  color: theme.danger,
                  opacity: qO * (0.5 + 0.5 * q),
                  transform: `scale(${0.8 + 0.2 * q})`,
                }}
              >
                {'重写接入 ?'}
              </div>
            </Panel>
          </div>
        ))}
      </div>
      <Footnote delay={14}>{'MCP · connect_mcp'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 5-C 空窗装置：缓存账本对比 ──────────────────────────────────────────

/** 前几章命中缓存 vs 本章每轮重组；旧清单叫新工具·叫一个空（deny 查无此号）。 */
const CacheLedger: React.FC<{at09: number; at10: number}> = ({at09, at10}) => {
  const inO = useProgress(2, DUR.f5);
  // 本章侧（亲手拆了缓存）
  const thisCh = useProgress(at09 + 20, DUR.f4);
  // 旧清单叫空（deny）
  const denyO = useProgress(at10 + 6, DUR.f4);
  const deny = useImpulse({at: at10 + 10, dur: DUR.f6, peak: 1});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 300, top: 280, width: 1320, opacity: inO}}>
        <div style={{display: 'flex', gap: 40}}>
          {/* 前几章：命中缓存 */}
          <Panel style={{flex: 1, boxSizing: 'border-box', padding: '24px 30px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
              <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>{'前几章'}</span>
              <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.ok}}>{'hit'}</span>
            </div>
            <div style={{marginTop: 18, height: 20, borderRadius: 10, background: theme.bg, border: `2px solid ${theme.panelBorder}`, overflow: 'hidden'}}>
              <div style={{width: '88%', height: '100%', background: withAlpha(theme.ok, 0.55)}} />
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 12}}>{'同前缀 · 不重复拼'}</div>
          </Panel>
          {/* 本章：每轮重组 */}
          <Panel accent={theme.mechDeep} style={{flex: 1, boxSizing: 'border-box', padding: '24px 30px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
              <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{'本章'}</span>
              <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.mechDeep}}>{'rebuild'}</span>
            </div>
            <div style={{marginTop: 18, height: 20, borderRadius: 10, background: theme.bg, border: `2px solid ${theme.panelBorder}`, overflow: 'hidden', opacity: thisCh}}>
              {/* 每轮重组：段块闪烁推进 */}
              <div style={{width: `${20 + 68 * thisCh}%`, height: '100%', background: withAlpha(theme.mechDeep, 0.7)}} />
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 12, opacity: thisCh}}>{'每轮重组 · 不吃缓存'}</div>
          </Panel>
        </div>
        {/* 旧清单叫空（p5-10） */}
        <div style={{display: 'flex', justifyContent: 'center', marginTop: 44, opacity: denyO}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '12px 30px',
              borderRadius: 12,
              border: `2.5px solid ${theme.danger}`,
              boxShadow: `0 0 ${16 * deny}px ${withAlpha(theme.danger, 0.35 * deny)}`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim}}>{'旧清单 → 新工具'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.danger}}>{'查无此号'}</span>
          </div>
        </div>
      </div>
      <Footnote delay={14}>{'prompt cache · 图新鲜不吃缓存'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 5-D 铭牌与边界 ──────────────────────────────────────────────────────

/** 铭牌特写：只读/破坏性文字标签＋「不拦截」角标＋虚位门＋教学版边界＋【三】丰富度。 */
const NamePlate: React.FC<{at14: number; at15: number; at16: number}> = ({at14, at15, at16}) => {
  // 铭牌标签（pop）
  const popL = useEnter('pop', {at: 6, dur: DUR.f4, springPreset: 'snap'});
  const popR = useEnter('pop', {at: 16, dur: DUR.f4, springPreset: 'snap'});
  // 「不拦截」角标（p5-14）
  const tagO = useProgress(at14 + 8, DUR.f4);
  // 虚位门（@dim——真门在收官段）
  const door = useProgress(at14 + 14, DUR.f4);
  const doorDim = useDim({at: at14 + 22, to: 0.35, dur: DUR.f5});
  // 教学版边界卡（p5-15）
  const boundO = useProgress(at15, DUR.f4);
  // 【三】丰富度角标（p5-16）
  const rich = useImpulse({at: at16, dur: DUR.f6, peak: 1});
  const richO = useProgress(at16, DUR.f4);
  return (
    <AbsoluteFill>
      {/* 铭牌（工具自报） */}
      <div style={{position: 'absolute', left: 350, top: 240}}>
        <Panel accent={theme.accent} style={{width: 700, boxSizing: 'border-box', padding: '26px 34px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 2}}>{'mcp__docs__search'}</div>
          <div style={{display: 'flex', gap: 22, marginTop: 22}}>
            <div style={{...popL}}>
              <div style={{padding: '10px 26px', borderRadius: 10, border: `2.5px solid ${theme.dim}`, fontFamily: theme.sans, fontSize: 27, color: theme.text}}>
                {'只读 · readOnly'}
              </div>
            </div>
            <div style={{...popR}}>
              <div style={{padding: '10px 26px', borderRadius: 10, border: `2.5px solid ${theme.mechDeep}`, fontFamily: theme.sans, fontSize: 27, color: theme.text}}>
                {'破坏性 · destructive'}
              </div>
            </div>
          </div>
          {/* 只是文字（标签≠权限） */}
          <div style={{marginTop: 20, fontFamily: theme.mono, fontSize: 21, color: theme.dim, opacity: tagO}}>
            {'文字标注 ≠ 权限'}
          </div>
        </Panel>
        {/* 「不拦截」角标 */}
        <div
          style={{
            position: 'absolute',
            right: -190,
            top: -6,
            opacity: tagO,
            transform: `rotate(6deg)`,
            fontFamily: theme.serif,
            fontSize: 30,
            fontWeight: 700,
            color: theme.danger,
            border: `3px solid ${theme.danger}`,
            borderRadius: 10,
            padding: '4px 18px',
          }}
        >
          {'不拦截'}
        </div>
      </div>

      {/* 虚位门（门形图标虚位——门装在收官段的钩子上） */}
      <div style={{position: 'absolute', left: 1190, top: 470, opacity: door * doorDim}}>
        <svg width={150} height={210}>
          <rect x={6} y={6} width={130} height={196} rx={10} fill="none" stroke={theme.dim} strokeWidth={3} strokeDasharray="12 9" />
          <circle cx={112} cy={108} r={9} fill={theme.dim} opacity={0.6} />
          <text x={71} y={240} textAnchor="middle" fontFamily={theme.mono} fontSize={19} fill={theme.dim}>
            {'门 · 收官段装'}
          </text>
        </svg>
      </div>

      {/* 教学版边界卡（外接仅队长） */}
      <div style={{position: 'absolute', left: 350, top: 560, opacity: boundO}}>
        <Panel style={{width: 700, boxSizing: 'border-box', padding: '18px 28px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
            <span style={{fontFamily: theme.sans, fontSize: 25, color: theme.text}}>{'教学版 · 外接只发队长'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'队友 = 固定八件套'}</span>
          </div>
        </Panel>
      </div>

      {/* 【三】丰富度角标（p5-16） */}
      <div
        style={{
          position: 'absolute',
          left: 1130,
          top: 250,
          opacity: richO,
          transform: `scale(${0.85 + 0.15 * rich})`,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.text,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 12,
          padding: '14px 24px',
          background: theme.panel,
          boxShadow: `0 0 ${18 * rich}px ${withAlpha(theme.accent, 0.3 * rich)}`,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 20, color: theme.dim}}>{'三 · 据源码分析'}</div>
        <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 8}}>{'连接 · 优先级 · 反向通知'}</div>
      </div>
      <Footnote delay={16}>{'readOnly / destructive · 标注不拦截'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P5SocketPlate: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p5-01', 'p5-02');
  const bB = w('p5-03', 'p5-07');
  const bC = w('p5-08', 'p5-12');
  const bD = w('p5-13', 'p5-16');

  const frame = useCurrentFrame();
  const mapIn = progress(frame, 6, DUR.f4);

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />
      <SceneTag chapter="P5" tagline="认证插座" accent={theme.accent} />
      <div style={{position: 'absolute', left: 1668, top: 56, opacity: mapIn}}>
        <LodgeMap active="socket" />
      </div>

      <Sequence {...bA} name="5-A 插座开张">
        <SocketOpens at02={at('p5-02') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="5-B 连接发现挂牌">
        {/* 空窗回落：p5-03 / p5-05 / p5-07 */}
        <ArchifyYield
          cues={[
            {at: at('p5-04') - bB.from, durationInFrames: dur('p5-04')},
            {at: at('p5-06') - bB.from, durationInFrames: dur('p5-06')},
          ]}
        >
          <KeyCard at={2} main={'两步 · 连接 → 发现'} sub={'connect · discover'} accent={theme.accent} />
          <KeyCard at={at('p5-05') - bB.from} main={'走一遍 · 文档 → 部署'} sub={'查文档 · +3 件'} accent={theme.accent} top={400} />
          <KeyCard at={at('p5-07') - bB.from} main={'同名不撞 · 挂楼牌'} sub={'mcp__服务__工具'} accent={theme.accent} />
        </ArchifyYield>
        {/* cue 1-2/4：socket-pool 逐章（连接与发现→挂牌防撞） */}
        <ArchifyRecap
          slug="socket-pool"
          caption="插座·连接发现"
          cues={[
            {chapterId: 'connect-discover', at: at('p5-04') - bB.from, durationInFrames: dur('p5-04')},
            {chapterId: 'prefix', at: at('p5-06') - bB.from, durationInFrames: dur('p5-06')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="5-C 拆缓存的账">
        {/* 空窗 p5-08..10：缓存账本对比装置 */}
        <ArchifyYield
          cues={[
            {at: at('p5-11') - bC.from, durationInFrames: dur('p5-11')},
            {at: at('p5-12') - bC.from, durationInFrames: dur('p5-12')},
          ]}
        >
          <CacheLedger at09={at('p5-09') - bC.from} at10={at('p5-10') - bC.from} />
        </ArchifyYield>
        {/* cue 3-4/4：socket-pool（每轮重组→旧清单叫空） */}
        <ArchifyRecap
          slug="socket-pool"
          caption="拆缓存的账"
          cues={[
            {chapterId: 'rebuild', at: at('p5-11') - bC.from, durationInFrames: dur('p5-11')},
            {chapterId: 'stale', at: at('p5-12') - bC.from, durationInFrames: dur('p5-12')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="5-D 铭牌与边界">
        <NamePlate at14={at('p5-14') - bD.from} at15={at('p5-15') - bD.from} at16={at('p5-16') - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5SocketPlate;
