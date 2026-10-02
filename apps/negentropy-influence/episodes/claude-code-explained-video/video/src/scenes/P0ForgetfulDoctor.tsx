/** P0 失忆的医生（p0-01..15，4 镜 4 cue）——分镜 0-A…0-D。
 *
 *  ★ 开场任务：用人肉往返立「它说完了、活还得你干」的痛点，再把诊室装置
 *    （循环〔M-001〕／病历本／医生／科室门）一次性定妆——本集恒定空间契约自本幕生效。
 *  ★ 行数尺首现（底边四格，第一格 102 点亮）＋三层外设剪影自右缘挂入（mech 青）。
 *  archify 全屏独占：human-relay 三瞥（0-B 两章同实例背靠背／0-C 循环接手／0-D 差距预告）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  DeptGate,
  Doctor,
  HarnessPlate,
  Ledger,
  LineGauge,
  LoopRing,
  PeripheralRow,
  QuoteCard,
  withAlpha,
} from '../components/clinic';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, useCount, useEnter, useImpulse, useReveal, useStagger} from '../motion';

/** 聊天框两侧（0-A）——左用户敲字、右模型回复，白纸隐喻卡 */
const ChatDuo: React.FC<{atChat: number; atPaper: number}> = ({atChat, atPaper}) => {
  const enters = useStagger(2, {at: atChat, stride: 8, dur: DUR.f5});
  const paper = useEnter('fall', {at: atPaper, dur: DUR.f5, dist: 90});
  const scatter = useReveal('进来一批文字 · 吐出一批文字 · 转身就忘', {at: atPaper + 6, cps: 10});
  return (
    <>
      {[
        {x: 300, who: '你', tone: theme.text},
        {x: 1160, who: '模型', tone: theme.dim},
      ].map((s, i) => (
        <div
          key={s.who}
          style={{
            position: 'absolute',
            left: s.x,
            top: 300,
            width: 420,
            opacity: enters[i],
            transform: `translateY(${(1 - enters[i]) * 24}px)`,
            padding: '18px 24px',
            background: '#171C26',
            border: `2px solid ${withAlpha(s.tone, 0.5)}`,
            borderRadius: 10,
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.dim,
          }}
        >
          <div style={{fontSize: 18, color: s.tone, marginBottom: 10}}>{s.who}</div>
          <div style={{fontFamily: theme.mono, fontSize: 17}}>{i === 0 ? 'help me fix…' : '建议：修改 src/…'}</div>
        </div>
      ))}
      <div
        style={{
          ...paper,
          position: 'absolute',
          left: 770,
          top: 560,
          width: 380,
          padding: '16px 22px',
          background: withAlpha('#F2F5FA', 0.06),
          border: `2px dashed ${withAlpha(theme.dim, 0.55)}`,
          borderRadius: 6,
          fontFamily: theme.serif,
          fontSize: 21,
          color: theme.dim,
        }}
      >
        {'一张白纸 · '}{scatter}
      </div>
    </>
  );
};

/** 0-D：102 大数字卡（useCount 逐格计数的落点） */
const CountCard: React.FC<{at: number; to: number}> = ({at, to}) => {
  const n = Math.round(useCount({to, at, dur: DUR.f6}));
  const pulse = useImpulse({at: at + 26, dur: DUR.f4, peak: 1});
  return (
    <div
      style={{
        position: 'absolute',
        left: 690,
        top: 330,
        transform: `scale(${1 + 0.05 * pulse})`,
        fontFamily: theme.mono,
        fontSize: 120,
        color: theme.core,
        textShadow: `0 0 ${18 * pulse}px ${withAlpha(theme.core, 0.5)}`,
      }}
    >
      {n}
    </div>
  );
};

export const P0ForgetfulDoctor: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-06');
  const bC = w('p0-07', 'p0-11');
  const bD = w('p0-12', 'p0-15');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 开场设问与白纸">
        <ChatDuo atChat={2} atPaper={at('p0-03') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="0-B 人肉往返">
        {/* human-relay 两章同实例背靠背（实例内自动抑制换章弹入） */}
        <ArchifyRecap
          slug="human-relay"
          caption="人当中间层"
          cues={[
            {chapterId: 'manual-full', at: at('p0-04') - bB.from, durationInFrames: dur('p0-04')},
            {chapterId: 'talk-only', at: at('p0-05') - bB.from, durationInFrames: dur('p0-05')},
          ]}
        />
        {/* p0-06 空窗回落：金句卡（压短形态，非逐字复述） */}
        <QuoteCard x={640} y={430} at={at('p0-06') - bB.from} width={640}>
          {'说完了 · 活还是你的'}
        </QuoteCard>
      </Sequence>

      <Sequence {...bC} name="0-C 诊室定妆">
        <ClinicFirstLook atEnter={2} atPlate={at('p0-11') - bC.from} />
        {/* p0-10 句让位：循环接手一瞥（与 0-B 实例隔幕，独立实例恢复入场） */}
        <ArchifyRecap
          slug="human-relay"
          caption="循环接手"
          cues={[{chapterId: 'loop-takes-over', at: at('p0-10') - bC.from, durationInFrames: dur('p0-10')}]}
        />
      </Sequence>

      <Sequence {...bD} name="0-D 行数尺与三层外设">
        <CountCard at={2} to={102} />
        <LineGauge lit={1} />
        <PeripheralRow x={1140} y={430} lit={3} at={at('p0-14') - bD.from} />
        {/* p0-15 句让位：差距预告一瞥 */}
        <ArchifyRecap
          slug="human-relay"
          caption="差距预告"
          cues={[{chapterId: 'gap-preview', at: at('p0-15') - bD.from, durationInFrames: dur('p0-15')}]}
        />
        <div style={{position: 'absolute', left: 246, top: 64}}>
          <FootnoteGhost at={at('p0-12') - bD.from}>{'102 行 · 教学版'}</FootnoteGhost>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};

/** 0-C 诊室首现：四件套 stagger 定妆（循环居中〔M-001〕／病历左上／医生左／科室门右） */
const ClinicFirstLook: React.FC<{atEnter: number; atPlate: number}> = ({atEnter, atPlate}) => {
  const enters = useStagger(4, {at: atEnter, stride: 9, dur: DUR.f5});
  return (
    <>
      {/* 病历本＝四件套 stagger 第 2 席（与病历说明 caption 同锚 enters[1]），
          唯一凭据不再硬切入场——2026-10-02 评审意见修复 */}
      <div style={{position: 'absolute', left: 150, top: 130, opacity: enters[1]}}>
        <Ledger x={0} y={0} />
      </div>
      <div style={{position: 'absolute', left: 150, top: 320, opacity: enters[2]}}>
        <Doctor x={0} y={0} scale={0.72} />
        <div
          style={{
            marginTop: 4,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 20,
            color: theme.dim,
          }}
        >
          {'医生 · 模型'}
        </div>
      </div>
      <div style={{position: 'absolute', left: 810, top: 240, opacity: enters[3]}}>
        <DeptGate x={0} y={0} lit />
      </div>
      <div style={{position: 'absolute', left: 660, top: 430, opacity: enters[0]}}>
        <LoopRing x={0} y={0} size={280} litSteps={0} spin glow />
      </div>
      <HarnessPlate x={840} y={170} at={atPlate} />
      <div style={{position: 'absolute', left: 660, top: 730, width: 600, opacity: enters[1], transform: `translateY(${(1 - enters[1]) * 12}px)`, fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>
        {'病历本 = 唯一凭据 · 每轮全量重读'}
      </div>
    </>
  );
};

/** 轻量角标（画面关键词，≤6 字＋口径注） */
export const FootnoteGhost: React.FC<{at: number; children: React.ReactNode}> = ({at, children}) => {
  const e = useEnter('fade', {at, dur: DUR.f3});
  return (
    <span
      style={{
        ...e,
        padding: '4px 12px',
        border: `1.5px solid ${withAlpha(theme.dim, 0.5)}`,
        borderRadius: 5,
        fontFamily: theme.mono,
        fontSize: 16,
        color: theme.dim,
      }}
    >
      {children}
    </span>
  );
};

export default P0ForgetfulDoctor;
