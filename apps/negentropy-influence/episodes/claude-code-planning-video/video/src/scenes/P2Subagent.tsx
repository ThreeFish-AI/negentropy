/** P2 大过程挪出去（p2-01..p2-20，6 镜）——分镜 2-A…2-F。
 *  挂点②回照（panorama pan-m2）→ 主/副台分屏+回执飞回（原生）→ 外包顾问意象三拍
 *  （原生，失配句角标）→ 三不+防线+回退（pc2-sub-guard 三章接力）→ 走查/回执/对比
 *  （pc2-sub-lanes 三章接力）→ 副台收拢钩 P3。
 *  空间契约：主台面左、副台右；消融对比绿上红下；「桌子」一词禁用（角色台账防撞）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, useProgress, useStagger} from '../motion';

const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 2-C 外包顾问三拍：自带笔记本记过程 / 只交一页结论；门禁卡 + 共享盘（隔离三不的生活意象） */
const ConsultantAnalogy: React.FC<{at06: number; at07: number; at08: number}> = ({at06, at07, at08}) => {
  const p1 = useStagger(2, {at: at06, dur: DUR.f4, stride: DUR.f3});
  const p2 = useProgress(at07, DUR.f5);
  const p3 = useProgress(at08, DUR.f5);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 300, top: 260, width: 620}}>
        {/* 拍一：笔记本（自己的过程记录） */}
        <div
          style={{
            padding: '24px 30px',
            borderRadius: 12,
            background: theme.panel,
            border: `1px solid ${theme.panelBorder}`,
            opacity: p1[0] ?? 0,
            marginBottom: 20,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, letterSpacing: 3}}>
            {'顾问 · 过程自记'}
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 27, color: theme.text, marginTop: 8}}>
            {'过程记自己的，不占你的台面'}
          </div>
        </div>
        {/* 拍二：一页结论 */}
        <div
          style={{
            padding: '20px 30px',
            borderRadius: 12,
            background: theme.panel,
            border: `1px solid ${theme.mechDeep}`,
            opacity: (p1[1] ?? 0),
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, letterSpacing: 3}}>
            {'交付 · 一页为限'}
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 25, color: theme.mech, marginTop: 6}}>
            {'一句结论回主线'}
          </div>
        </div>
      </div>
      {/* 拍三：门禁卡 + 共享盘（权限与产物共用） */}
      <div style={{position: 'absolute', left: 1060, top: 270, width: 560, opacity: p2}}>
        {[
          {k: '公司门禁卡', v: '安全检查照跑'},
          {k: '共享盘 · 交付物', v: '文件改动保留'},
        ].map((r) => (
          <div
            key={r.k}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '18px 26px',
              marginBottom: 16,
              borderRadius: 12,
              background: theme.panel,
              border: `1px solid ${theme.coreDeep}`,
            }}
          >
            <div style={{width: 10, height: 10, borderRadius: 5, background: theme.core}} />
            <div>
              <div style={{fontFamily: theme.serif, fontSize: 24, color: theme.text}}>{r.k}</div>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 4}}>{r.v}</div>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 170,
          width: 1920,
          textAlign: 'center',
          opacity: p3,
          fontFamily: theme.sans,
          fontSize: 19,
          color: theme.dim,
          letterSpacing: 2,
        }}
      >
        {'类比边界 · 另一个人 ≠ 另一场对话'}
      </div>
    </AbsoluteFill>
  );
};

/** 2-B 装置：主线/副台分屏——副台自开列表自跑循环，末尾撕一页回执飞回主线。
 *  @enter:slide 双栏分屏（分镜 2-B）：左栏自左推入、右栏自右推入。 */
const SideDeskSplit: React.FC<{at05: number}> = ({at05}) => {
  const fly = useProgress(at05, 24);
  const inL = useProgress(0, DUR.f4);
  const inR = useProgress(DUR.f2, DUR.f4);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 200, top: 260, width: 640, opacity: inL, transform: `translateX(${(1 - inL) * -56}px)`}}>
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, letterSpacing: 3, marginBottom: 16}}>{'主线台面'}</div>
        {[1, 0.85, 0.7].map((o, i) => (
          <div key={i} style={{height: 52, marginBottom: 10, borderRadius: 8, background: theme.panel, border: `1px solid ${theme.panelBorder}`, opacity: o}} />
        ))}
      </div>
      <div style={{position: 'absolute', left: 1080, top: 260, width: 640, opacity: inR, transform: `translateX(${(1 - inR) * 56}px)`}}>
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.mech, letterSpacing: 3, marginBottom: 16}}>{'副台 · 全新列表'}</div>
        {[0.9, 0.75, 0.6, 0.45].map((o, i) => (
          <div key={i} style={{height: 40, marginBottom: 8, borderRadius: 8, background: `${theme.mech}12`, border: `1px solid ${theme.mechDeep}66`, opacity: o}} />
        ))}
      </div>
      {/* 回执：从副台飞向主线 */}
      <div
        style={{
          position: 'absolute',
          left: 1080 - fly * 780,
          top: 400 - Math.sin(fly * Math.PI) * 120,
          width: 240,
          padding: '14px 20px',
          borderRadius: 10,
          background: theme.panel,
          border: `1px solid ${theme.mech}`,
          opacity: Math.min(1, fly * 2),
          fontFamily: theme.serif,
          fontSize: 22,
          color: theme.mech,
          textAlign: 'center',
        }}
      >
        {'一句结论'}
      </div>
    </AbsoluteFill>
  );
};


/** 2-F 装置：副台收拢回全景挂点②，抽屉格预告 P3 */
const FoldToP3: React.FC<{span: number}> = ({span}) => {
  const t = useProgress(Math.round(span * 0.4), 20);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 660, top: 420, width: 600, opacity: 1 - t * 0.6, transform: `scale(${1 - t * 0.2})`}}>
        <Panel style={{padding: '20px 30px'}}>
          <div style={{fontFamily: theme.serif, fontSize: 26, color: theme.mech}}>{'副台 · 收拢'}</div>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 700, top: 300, width: 520, opacity: t, transform: `translateY(${(1 - t) * 30}px)`}}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12}}>
            <div style={{width: 64, height: 44, borderRadius: 6, border: `1.5px solid ${theme.mechDeep}`, background: `${theme.mech}10`}} />
            <div style={{height: 8, width: 180 + i * 40, borderRadius: 4, background: theme.panelBorder}} />
          </div>
        ))}
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 14}}>{'下一站：知识按需进场'}</div>
      </div>
    </AbsoluteFill>
  );
};


export const P2Subagent: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p2-01', 'p2-03');
  const bB = w('p2-04', 'p2-05');
  const bC = w('p2-06', 'p2-08');
  const bD = w('p2-09', 'p2-14b');
  const bE = w('p2-15', 'p2-19');
  const bF = w('p2-20', 'p2-20');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="2-A 挂点②回照">
        <ArchifyRecap slug="pc2-panorama" caption="挂点② · 副台派单" cues={[
          {chapterId: 'pan-m2', at: at('p2-01') - bA.from, durationInFrames: dur('p2-01') + dur('p2-02') + dur('p2-03')},
        ]} />
      </Sequence>

      <Sequence {...bB} name="2-B 副台分屏">
        <SideDeskSplit at05={at('p2-05') - bB.from} />
      </Sequence>

      <Sequence {...bC} name="2-C 外包顾问三拍">
        <ConsultantAnalogy at06={0} at07={at('p2-07') - bC.from} at08={at('p2-08') - bC.from} />
      </Sequence>

      <Sequence {...bD} name="2-D 三不·防线·回退">
        {/* 三章接力：首章锚 p2-09，后两章随句推进（p2-12 / p2-14b） */}
        <ArchifyRecap slug="pc2-sub-guard" caption="副台的防线" cues={[
          {chapterId: 'guard-three', at: at('p2-09') - bD.from, durationInFrames: dur('p2-09') + dur('p2-10') + dur('p2-11')},
          {chapterId: 'guard-notask', at: at('p2-12') - bD.from, durationInFrames: dur('p2-12') + dur('p2-13') + dur('p2-13b') + dur('p2-14')},
          {chapterId: 'guard-fallback', at: at('p2-14b') - bD.from, durationInFrames: dur('p2-14b')},
        ]} />
      </Sequence>

      <Sequence {...bE} name="2-E 走查·回执·对比">
        {/* 跨图背靠背（2-D guard-fallback 尾→本章首章）：lead={false}；三章随句接力 */}
        <ArchifyRecap slug="pc2-sub-lanes" caption="主线与副台" lead={false} cues={[
          {chapterId: 'lanes-walk', at: at('p2-15') - bE.from, durationInFrames: dur('p2-15') + dur('p2-16')},
          {chapterId: 'lanes-receipt', at: at('p2-17') - bE.from, durationInFrames: dur('p2-17'), fit: 'trim'},
          {chapterId: 'lanes-contrast', at: at('p2-18') - bE.from, durationInFrames: dur('p2-18') + dur('p2-19')},
        ]} />
      </Sequence>

      <Sequence {...bF} name="2-F 收拢钩 P3">
        <FoldToP3 span={bF.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
