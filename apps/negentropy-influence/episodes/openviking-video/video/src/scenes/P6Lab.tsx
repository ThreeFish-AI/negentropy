/** P6 实验室与收尾（p6-01..18）——六次破坏实验 + 本仓映射 + 熄灯收尾。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useDim, useDraw, useImpulse, useProgress, useSpring} from '../motion';
import {SceneTag} from '../components/motifs';
import {TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge, LibraryHUD} from '../components/devices';

/** 6-A 实验室门牌。 */
const DoorPlate: React.FC<{at: number}> = ({at}) => {
  const drop = useSpring('settle', {at, dur: DUR.f5});
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 360, display: 'flex', justifyContent: 'center', alignItems: 'flex-start'}}>
      <div
        style={{
          padding: '24px 60px',
          borderRadius: 14,
          border: `2px solid ${theme.peri}`,
          background: `${theme.peri}0D`,
          textAlign: 'center',
          opacity: drop,
          transform: `translateY(${(1 - drop) * -34}px)`,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.peri, letterSpacing: 3}}>OPENVIKING LAB</div>
        <div style={{fontFamily: theme.serif, fontSize: 38, color: theme.text, marginTop: 8}}>玩具图书馆 · 破坏实验室</div>
        <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 8}}>每次只拆一个零件 · 真跑 · 记录真实退化</div>
      </div>
    </div>
  );
};

/** 6-D 事件卡翻倍：重投箭头落下，单卡分身两张。 */
const DoubleCard: React.FC<{at: number}> = ({at}) => {
  const split = useProgress(at, DUR.f6);
  const flash = useImpulse({at: at + 8, dur: DUR.f5});
  const frame = useCurrentFrame();
  const arrow = progress(frame, at - 14, DUR.f4);
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 220, textAlign: 'center'}}>
      <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, opacity: arrow}}>队列重投 ×1 ↓</div>
      <div style={{display: 'flex', gap: 60, justifyContent: 'center', marginTop: 24, alignItems: 'center'}}>
        <div
          style={{
            width: 360,
            padding: '16px 22px',
            borderRadius: 10,
            border: `2px solid ${theme.danger}`,
            background: `${theme.danger}10`,
            transform: `translateX(${-120 - 40 * split}px) rotate(${(1 - split) * 4 - 3}deg)`,
            opacity: split > 0.1 ? 1 : 0,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>events/2026/09/01/</div>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.danger, marginTop: 6}}>上线了支付服务 v2.md</div>
        </div>
        <div
          style={{
            width: 360,
            padding: '16px 22px',
            borderRadius: 10,
            border: `2px dashed ${theme.danger}`,
            background: `${theme.danger}08`,
            boxShadow: `0 0 ${24 * flash}px ${theme.danger}99`,
            transform: `translateX(${120 + 40 * split}px) rotate(${3 - (1 - split) * 4}deg)`,
            opacity: split,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>events/2026/09/01/</div>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.danger, marginTop: 6}}>上线了支付服务 v2（复述）.md</div>
        </div>
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.text, marginTop: 30}}>
        去掉「已整理」章 → 事件卡 <b style={{color: theme.danger}}>×2</b>；提交点是不可省的保险
      </div>
    </div>
  );
};

/** 6-E 映射卡：不照搬这棵树 vs 搬这条提交链。 */
const MapCards: React.FC<{at: number; linkAt: number}> = ({at, linkAt}) => {
  const [a, b] = [useSpring('settle', {at, dur: DUR.f5}), useSpring('settle', {at: at + 8, dur: DUR.f5})];
  const link = useDraw(linkAt, 26);
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 300}}>
      <div style={{display: 'flex', gap: 60, justifyContent: 'center'}}>
        <div
          style={{
            width: 400,
            padding: '20px 26px',
            borderRadius: 12,
            border: `2px solid ${theme.rose}`,
            background: `${theme.rose}0C`,
            opacity: a,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.rose}}>不照搬这棵树</div>
          <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 8, lineHeight: 1.7}}>
            副本式存储 ✗<br />
            与「目录只存指针」的设计原则冲突
          </div>
        </div>
        <div
          style={{
            width: 400,
            padding: '20px 26px',
            borderRadius: 12,
            border: `2px solid ${theme.mint}`,
            background: `${theme.mint}0C`,
            opacity: b,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.mint}}>搬这条提交链</div>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.text, marginTop: 8, lineHeight: 2}}>
            对话结束 → 原样归档
            <br />
            → 后台整理 → 盖章收尾
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, marginTop: 6}}>对准「聊完就忘」的断链</div>
        </div>
      </div>
      <svg width={1200} height={40} style={{position: 'absolute', top: 450, left: 360}}>
        <path d="M80 20 H 1120" stroke={theme.mint} strokeWidth={3} fill="none" {...link} />
      </svg>
    </div>
  );
};

/** 6-F 图书馆熄灯：三分区灯依次熄灭只留门口一枚。 */
const LightsOff: React.FC<{at: number}> = ({at}) => {
  const d1 = useDim({at});
  const d2 = useDim({at: at + 8});
  const rest = useDim({at: at + 16});
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 240, textAlign: 'center'}}>
      <svg width={760} height={280} viewBox="0 0 760 280">
        <g stroke={theme.mint} strokeWidth={3} fill={`${theme.mint}0F`} opacity={rest}>
          <path d="M60 240 H 200 V 120 H 60 Z" />
          <path d="M700 240 H 560 V 120 H 700 Z" />
          <path d="M380 240 V 70 H 210 V 240 M380 240 H 550 V 70 H 380" />
        </g>
        <rect x={352} y={216} width={56} height={24} fill={`${theme.mint}CC`} />
        <circle cx={380} cy={200} r={10} fill={theme.mint} opacity={0.9 * (1 - 0.5 * d2)} />
        <text x={380} y={272} textAnchor="middle" fill={theme.dim} fontFamily="sans-serif" fontSize={16} opacity={d1 > 0 ? 1 : 0}>
          把上下文变成可以打开研究的开源对象
        </text>
      </svg>
      <div style={{marginTop: 26, fontFamily: theme.serif, fontSize: 36, color: theme.mint}}>这件事本身，值得记一笔</div>
      <div style={{marginTop: 18, fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>我们下期再见</div>
    </div>
  );
};

export const P6Lab: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p6-01', 'p6-01');
  const bB = w('p6-02', 'p6-04');
  const bC = w('p6-05', 'p6-07');
  const bD = w('p6-08', 'p6-11');
  const bE = w('p6-12', 'p6-15');
  const bF = w('p6-16', 'p6-18');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="6-A 实验室门牌">
        <SceneTag chapter="P6" tagline="实验室与收尾" accent={theme.peri} />
        <DoorPlate at={at('p6-01') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="6-B B1 拔标签">
        <SceneTag chapter="P6" tagline="实验室与收尾" accent={theme.peri} />
        <ArchifyRecap
          slug="lab-break-matrix"
          caption="B1 · 豪华档的赌注"
          cues={[{chapterId: 'struct', at: at('p6-02') - bB.from, durationInFrames: dur('p6-02')}, {chapterId: 'struct', at: at('p6-03') - bB.from, durationInFrames: dur('p6-03'), fit: 'hold'}, {chapterId: 'struct', at: at('p6-04') - bB.from, durationInFrames: dur('p6-04'), fit: 'hold'}]}
        />
        <EvidenceBadge grade="lab" />
      </Sequence>

      <Sequence {...bC} name="6-C B3 三卡矛盾">
        <SceneTag chapter="P6" tagline="实验室与收尾" accent={theme.peri} />
        <ArchifyRecap
          slug="lab-break-matrix"
          caption="B3 · 身份判据"
          lead={false}
          cues={[{chapterId: 'idcheck', at: at('p6-05') - bC.from, durationInFrames: dur('p6-05')}, {chapterId: 'idcheck', at: at('p6-06') - bC.from, durationInFrames: dur('p6-06'), fit: 'hold'}, {chapterId: 'idcheck', at: at('p6-07') - bC.from, durationInFrames: dur('p6-07'), fit: 'hold'}]}
        />
        <EvidenceBadge grade="lab" />
      </Sequence>

      <Sequence {...bD} name="6-D B6 事件卡翻倍 · 代码走廊④">
        <SceneTag chapter="P6" tagline="实验室与收尾" accent={theme.danger} />
        <DoubleCard at={at('p6-09') - bD.from} />
        <div style={{position: 'absolute', left: 430, top: 620, width: 1060}}>
          <TerminalLog
            prompt="uv run openviking_lab.py --selftest"
            lines={[
              {text: 'B6 事件卡 2 张：[v2.md, v2（复述）.md]；偏好卡 1 张（确定性卡名天然幂等）', color: theme.danger, at: at('p6-09') - bD.from},
              {text: 'S1..S7 全部断言通过 · 六个破坏实验各有实测退化', color: theme.dim, at: at('p6-11') - bD.from},
              {text: 'SELFTEST PASSED ✔', color: theme.ok, bold: true, at: at('p6-11') - bD.from + 16},
            ]}
            caption="lab B6/S7 · 提交点实测"
          />
        </div>
        <EvidenceBadge grade="lab" />
      </Sequence>

      <Sequence {...bE} name="6-E 映射卡">
        <SceneTag chapter="P6" tagline="实验室与收尾" accent={theme.mint} />
        <MapCards at={at('p6-12') - bE.from} linkAt={at('p6-14') - bE.from} />
        <EvidenceBadge grade="official" />
      </Sequence>

      <Sequence {...bF} name="6-F 熄灯收尾">
        <SceneTag chapter="P6" tagline="实验室与收尾" accent={theme.mint} />
        <LightsOff at={at('p6-16') - bF.from} />
        <LibraryHUD lit={3} dimmed at={-30} />
      </Sequence>
    </AbsoluteFill>
  );
};
