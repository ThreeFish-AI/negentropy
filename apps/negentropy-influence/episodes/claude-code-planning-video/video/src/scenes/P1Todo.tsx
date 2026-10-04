/** P1 计划回到视野（p1-01..p1-20，6 镜）——分镜 1-A…1-F。
 *  挂点①回照（panorama pan-m1）→ 三态工序卡（nag-device）→ 计数爬格+满三注入
 *  （nag-count + nag-fire 背靠背）→ 类型注解任务五轮走查（原生：轮转标签+工序卡
 *  状态迁移，rel(beat,'p1-11') 驱动）→ 拆清零消融（nag-ablate 0↔1）→ 内存态红线收尾。
 *  空间契约：HarnessBadge top:64；走查镜工序卡居中台面位；消融红左绿右。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {useProgress} from '../motion';

const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 1-D 走查装置：五轮轮转（交计划→改文件→跑测试→修失败→提醒回看）+ 工序卡三态迁移。
 *  时点全由句边界推导：p1-11 交计划 / p1-12 三轮推进 / p1-13 提醒回看标完成。
 *  rel(beat,'p1-11') 驱动第一轮首次点亮——此前整条轮转带 0.4 惰性预览、无高亮。 */
const FiveRoundWalk: React.FC<{at11: number; at12: number; at13: number}> = ({
  at11, at12, at13,
}) => {
  // 三段推进进度：句内驱动
  const p11 = useProgress(at11, 18);
  const p12 = useProgress(at12, 24);
  const p13 = useProgress(at13, 24);
  const rounds = ['① 交计划', '② 改文件', '③ 跑测试', '④ 修失败', '⑤ 回看清单'];
  const activeIdx = p13 > 0 ? 4 : p12 > 0 ? (p12 > 0.66 ? 3 : p12 > 0.33 ? 2 : 1) : p11 > 0 ? 0 : -1;
  const todos = [
    {label: '类型注解', state: p13 > 0.5 ? 'done' : 'doing'},
    {label: '加注释', state: 'todo'},
    {label: '入口守卫', state: 'todo'},
  ];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 260, top: 260, width: 640}}>
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, letterSpacing: 4, marginBottom: 20}}>
          {'任务：注解 → 注释 → 守卫'}
        </div>
        {todos.map((t, i) => (
          <div
            key={t.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '18px 24px',
              marginBottom: 14,
              borderRadius: 10,
              background: theme.panel,
              border: `1px solid ${t.state === 'doing' ? theme.mech : theme.panelBorder}`,
              opacity: t.state === 'todo' ? 0.65 : 1,
              transform: `translateX(${(t.state === 'doing' ? 8 : 0) * (t.state === 'doing' ? 1 : 0)}px)`,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                border: `2px solid ${t.state === 'done' ? theme.ok : t.state === 'doing' ? theme.mech : theme.panelBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.ok,
                fontSize: 18,
                fontFamily: theme.sans,
              }}
            >
              {t.state === 'done' ? '✓' : t.state === 'doing' ? '▸' : ''}
            </div>
            <div style={{fontFamily: theme.serif, fontSize: 26, color: theme.text}}>{t.label}</div>
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', left: 1000, top: 280, width: 660}}>
        {rounds.map((r, i) => (
          <div
            key={r}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '14px 22px',
              marginBottom: 12,
              borderRadius: 10,
              background: i === activeIdx ? theme.panel : 'transparent',
              border: `1px solid ${i === activeIdx ? theme.mechDeep : 'transparent'}`,
              opacity: i <= activeIdx ? 1 : 0.4,
              transform: `scale(${i === activeIdx ? 1.02 : 1})`,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                background: i === activeIdx ? theme.mech : i < activeIdx ? theme.dim : theme.panelBorder,
              }}
            />
            <div style={{fontFamily: theme.sans, fontSize: 24, color: i === activeIdx ? theme.text : theme.dim}}>
              {r}
            </div>
          </div>
        ))}
        {/* 第五轮提醒条：p1-13 淡入，红色 reminder 落入 */}
        <div
          style={{
            marginTop: 18,
            padding: '14px 22px',
            borderRadius: 10,
            background: `${theme.danger}18`,
            border: `1px solid ${theme.danger}66`,
            opacity: p13,
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.danger,
          }}
        >
          {'⟳ 提醒：更新你的待办'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 1-F 装置：工序卡淡出标注内存态；过程条目自右涌入钩 P2 */
const MemoryLimit: React.FC<{at19: number; at20: number}> = ({at19, at20}) => {
  const memo = useProgress(at19, 18);
  const flood = useProgress(at20, 20);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 480, top: 340, width: 480, opacity: 1 - memo * 0.75, transform: `scale(${1 - memo * 0.12})`}}>
        <Panel style={{padding: '24px 30px'}}>
          <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.text}}>{'待办清单'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 8}}>{'三态工序卡'}</div>
        </Panel>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1060,
          top: 360,
          opacity: memo,
          padding: '18px 26px',
          borderRadius: 10,
          border: `1px solid ${theme.danger}77`,
          background: `${theme.danger}12`,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.danger,
        }}
      >
        {'内存态 · 进程退出即清'}
      </div>
      <div style={{position: 'absolute', left: 0, top: 560, width: 1920, height: 320, overflow: 'hidden', pointerEvents: 'none'}}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 1920 - flood * (1400 + i * 120),
              top: i * 62,
              width: 300,
              height: 46,
              borderRadius: 8,
              background: `${theme.mechDeep}22`,
              border: `1px solid ${theme.mechDeep}55`,
              opacity: flood,
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            left: 1920 - flood * 620,
            top: 190,
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.dim,
            opacity: flood,
          }}
        >
          {'大过程涌进主线 →'}
        </div>
      </div>
    </AbsoluteFill>
  );
};


export const P1Todo: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p1-01', 'p1-02');
  const bB = w('p1-03', 'p1-05');
  const bC = w('p1-06', 'p1-08');
  const bD = w('p1-09', 'p1-13');
  const bE = w('p1-14', 'p1-17b');
  const bF = w('p1-18', 'p1-20');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="1-A 挂点①回照">
        {/* 幕界背靠背：0-F pan-loop 末帧紧接本实例首帧（gap=0），lead={false} 抑制重放入场弹簧 */}
        <ArchifyRecap slug="pc2-panorama" caption="挂点① · 唠叨计数器" lead={false} cues={[
          {chapterId: 'pan-m1', at: at('p1-01') - bA.from, durationInFrames: dur('p1-01') + dur('p1-02')},
        ]} />
      </Sequence>

      <Sequence {...bB} name="1-B 三态工序卡">
        {/* 跨镜背靠背（1-A pan-m1 尾→本章首章）：lead={false} */}
        <ArchifyRecap slug="pc2-todo-nag" caption="待办与唠叨" lead={false} cues={[
          {chapterId: 'nag-device', at: at('p1-03') - bB.from, durationInFrames: dur('p1-03') + dur('p1-04') + dur('p1-05')},
        ]} />
      </Sequence>

      <Sequence {...bC} name="1-C 爬格与注入">
        {/* 同图跨镜背靠背（1-B 尾→本章首章）+ 实例内两章接力（enters 自动抑制换章弹入） */}
        <ArchifyRecap slug="pc2-todo-nag" caption="待办与唠叨" lead={false} cues={[
          {chapterId: 'nag-count', at: at('p1-06') - bC.from, durationInFrames: dur('p1-06') + dur('p1-07')},
          {chapterId: 'nag-fire', at: at('p1-08') - bC.from, durationInFrames: dur('p1-08')},
        ]} />
      </Sequence>

      <Sequence {...bD} name="1-D 五轮走查">
        <FiveRoundWalk
          at11={at('p1-11') - bD.from}
          at12={at('p1-12') - bD.from}
          at13={at('p1-13') - bD.from}
        />
      </Sequence>

      <Sequence {...bE} name="1-E 拆清零消融">
        <ArchifyRecap slug="pc2-todo-nag" caption="待办与唠叨" cues={[
          {chapterId: 'nag-ablate', at: at('p1-14') - bE.from, durationInFrames: dur('p1-14') + dur('p1-15') + dur('p1-16') + dur('p1-17') + dur('p1-17b')},
        ]} />
      </Sequence>

      <Sequence {...bF} name="1-F 内存态红线">
        <MemoryLimit at19={at('p1-19') - bF.from} at20={at('p1-20') - bF.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
