/** P1 一棵树（p1-01..14）——viking:// 寻址：三分区 + 位置即身份 + 边界。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge, LibraryHUD} from '../components/devices';

/** 1-B 三分区柜：三柜门开合 + 一套动作图标落三柜。 */
const TriCabin: React.FC<{at: number; iconAt: number}> = ({at, iconAt}) => {
  const doors = useSpring('settle', {at, dur: DUR.f6});
  const icons = useStagger(3, {at: iconAt, stride: 9, dur: DUR.f5});
  const cabins = [
    {t: '公共馆藏区', s: 'resources', d: '团队文档 · 手册'},
    {t: '读者档案室', s: 'user/{uid}', d: '个人记忆 · 档案卡'},
    {t: '馆员手册室', s: 'agent', d: '技能包'},
  ];
  const acts = ['列目录 ls', '读文件 read', '搜索 find'];
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 300, display: 'flex', gap: 54, justifyContent: 'center', alignItems: 'flex-start'}}>
      {cabins.map((c, i) => (
        <div key={c.s} style={{textAlign: 'center'}}>
          <div
            style={{
              width: 280,
              height: 170,
              borderRadius: 12,
              border: `2px solid ${theme.mint}`,
              background: `${theme.mint}0C`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(90deg, ${theme.panel} ${(1 - doors) * 52}%, transparent ${(1 - doors) * 52 + 2}%)`,
              }}
            />
            <div style={{paddingTop: 34, fontFamily: theme.sans, fontSize: 25, color: theme.text}}>{c.t}</div>
            <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.mint, marginTop: 8}}>{c.s}</div>
            <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, marginTop: 8}}>{c.d}</div>
          </div>
        </div>
      ))}
      <div style={{position: 'absolute', top: 530, left: 0, right: 0, display: 'flex', gap: 40, justifyContent: 'center'}}>
        {acts.map((a, i) => (
          <div
            key={a}
            style={{
              padding: '8px 22px',
              borderRadius: 999,
              border: `1px solid ${theme.peri}55`,
              color: theme.peri,
              fontFamily: theme.mono,
              fontSize: 18,
              opacity: icons[i],
            }}
          >
            {a} · 三柜通用
          </div>
        ))}
      </div>
    </div>
  );
};

/** 1-D 边界卡：不是文件系统。 */
const BoundaryCard: React.FC<{at: number}> = ({at}) => {
  const rise = useSpring('settle', {at, dur: DUR.f5});
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 340, display: 'flex', justifyContent: 'center', alignItems: 'flex-start'}}>
      <div
        style={{
          width: 760,
          padding: '30px 40px',
          borderRadius: 14,
          border: `2px solid ${theme.rose}`,
          background: `${theme.rose}0D`,
          opacity: rise,
          transform: `translateY(${(1 - rise) * 26}px)`,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.rose}}>它不是真的文件系统</div>
        <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginTop: 12, lineHeight: 1.7}}>
          文件传进来 → 解析成 AI 好消化的结构（AI-ready）；原始文件默认不保留。
          <span style={{color: theme.text}}>借的是图书馆的组织方式，不是硬盘。</span>
        </div>
      </div>
    </div>
  );
};

export const P1Tree: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p1-01', 'p1-03');
  const bB = w('p1-04', 'p1-07');
  const bC = w('p1-08', 'p1-12');
  const bD = w('p1-13', 'p1-14');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A 一棵树">
        <SceneTag chapter="P1" tagline="一棵树" accent={theme.mint} />
        <ArchifyRecap
          slug="uri-scope-tree"
          caption="统一地址 · 三分区"
          cues={[{chapterId: 'tree', at: at('p1-01') - bA.from, durationInFrames: dur('p1-01')}, {chapterId: 'tree', at: at('p1-02') - bA.from, durationInFrames: dur('p1-02'), fit: 'hold'}, {chapterId: 'tree', at: at('p1-03') - bA.from, durationInFrames: dur('p1-03'), fit: 'hold'}]}
        />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bB} name="1-B 三分区柜">
        <SceneTag chapter="P1" tagline="一棵树" accent={theme.mint} />
        <TriCabin at={at('p1-04') - bB.from} iconAt={at('p1-06') - bB.from} />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bC} name="1-C 位置即身份">
        <SceneTag chapter="P1" tagline="一棵树" accent={theme.mint} />
        <ArchifyRecap
          slug="uri-scope-tree"
          caption="类型由结构推导"
          cues={[
            {chapterId: 'mem', at: at('p1-08') - bC.from, durationInFrames: dur('p1-08')}, {chapterId: 'mem', at: at('p1-09') - bC.from, durationInFrames: dur('p1-09'), fit: 'hold'},
            {chapterId: 'counter', at: at('p1-10') - bC.from, durationInFrames: dur('p1-10')}, {chapterId: 'counter', at: at('p1-11') - bC.from, durationInFrames: dur('p1-11'), fit: 'hold'}, {chapterId: 'counter', at: at('p1-12') - bC.from, durationInFrames: dur('p1-12'), fit: 'hold'},
          ]}
        />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bD} name="1-D 边界卡">
        <SceneTag chapter="P1" tagline="一棵树" accent={theme.rose} />
        <BoundaryCard at={at('p1-13') - bD.from} />
        <EvidenceBadge grade="official" />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>
    </AbsoluteFill>
  );
};
