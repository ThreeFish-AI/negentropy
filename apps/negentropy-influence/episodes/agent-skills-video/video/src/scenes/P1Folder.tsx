/** P1 一个文件夹的答案（p1-01..p1-24，镜 1-A..1-E）——格式契约（六字段卡贴 +
 *  gl-three 全屏窗）→ 正文与子目录 → pdf-report 终端走查 → 治理智慧（互锁 +
 *  dl-discover 全屏窗 + Git 流水带）→ X1 消融（拆作用域优先级 → 2/10 漂移）。
 *  主色：路由靛（字段/身份）+ 目录金（互锁线）。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useCount,
  useDraw,
  useEnter,
  useFlowDash,
  useImpulse,
  useReveal,
  useShake,
  useStagger,
} from '../motion';
import {SceneTag} from '../components/motifs';
import {AblationPanel, GoldenCard, WalkTerm} from '../components/as-motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';

const FIELDS = [
  {k: 'name', req: true},
  {k: 'description', req: true},
  {k: 'license', req: false},
  {k: 'compatibility', req: false},
  {k: 'metadata', req: false},
  {k: 'allowed-tools', req: false},
];

/** 1-A 格式契约：文件夹展开 SKILL.md + 六格卡贴（必填两格靛蓝、可选四章）。 */
const FieldCards: React.FC<{openAt: number; cardAt: number; optAt: number}> = ({
  openAt,
  cardAt,
  optAt,
}) => {
  const folder = useEnter('fall', {at: openAt, dur: DUR.f5, springPreset: 'settle'});
  const stamps = useStagger(FIELDS.length, {at: cardAt, dur: DUR.f6, stride: 7});
  const opt = useImpulse({at: optAt, dur: DUR.f4, peak: 1.15});
  const optP = progress(useCurrentFrame(), optAt + DUR.f4, DUR.f4);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 70}}>
      <div
        style={{
          ...folder,
          width: 240,
          height: 170,
          borderRadius: 12,
          background: theme.panel,
          border: `2px solid ${theme.route}`,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -16,
            left: 14,
            width: 96,
            height: 26,
            borderRadius: '8px 8px 0 0',
            background: theme.route,
            opacity: 0.85,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.text,
          }}
        >
          SKILL.md
        </div>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 230px)', gap: 14}}>
        {FIELDS.map((f, i) => (
          <div
            key={f.k}
            style={{
              opacity: stamps[i],
              transform: `translateY(${14 * (1 - stamps[i])}px)`,
              border: `1.5px solid ${f.req ? theme.route : theme.panelBorder}`,
              borderRadius: 9,
              padding: '12px 16px',
              background: theme.panel,
              position: 'relative',
            }}
          >
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 17,
                color: f.req ? theme.route : theme.dim,
              }}
            >
              {f.k}
            </div>
            <div style={{fontSize: 13.5, color: theme.dim, marginTop: 4}}>
              {f.req ? '必填' : ''}
            </div>
            {!f.req && optP > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  right: 10,
                  top: 8,
                  transform: `rotate(-10deg) scale(${opt * (0.8 + 0.2 * optP)})`,
                  opacity: optP,
                  border: `1.5px solid ${theme.dim}`,
                  color: theme.dim,
                  borderRadius: 6,
                  fontSize: 13,
                  padding: '1px 8px',
                }}
              >
                可选
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

/** 1-B 正文与子目录：自由正文滚动条 + 三枚虚影子目录 + 「路径即身份」金句。 */
const BodyAndDirs: React.FC<{bodyAt: number; dirsAt: number; idAt: number}> = ({
  bodyAt,
  dirsAt,
  idAt,
}) => {
  const body = useEnter('fade', {at: bodyAt, dur: DUR.f5});
  const dirs = useStagger(3, {at: dirsAt, dur: DUR.f5, stride: 8});
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 80}}>
      <div
        style={{
          ...body,
          width: 430,
          height: 250,
          background: theme.panel,
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 12,
          padding: 22,
        }}
      >
        <div style={{fontSize: 13.5, color: theme.dim, letterSpacing: 2, marginBottom: 12}}>
          SKILL.md 正文 · 自由格式
        </div>
        {[0.9, 0.75, 0.85, 0.6, 0.8].map((w, i) => (
          <div
            key={i}
            style={{
              height: 12,
              borderRadius: 6,
              background: `${theme.dim}55`,
              width: `${w * 100}%`,
              marginBottom: 12,
            }}
          />
        ))}
      </div>
      <div style={{display: 'flex', gap: 18}}>
        {['scripts/', 'references/', 'assets/'].map((d, i) => (
          <div
            key={d}
            style={{
              opacity: 0.35 + 0.4 * dirs[i],
              border: `1.5px dashed ${theme.panelBorder}`,
              borderRadius: 9,
              padding: '14px 18px',
              fontFamily: theme.mono,
              fontSize: 16,
              color: theme.dim,
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <GoldenCard lines={['路径即身份']} width={300} />
    </div>
  );
};

/** 1-C 终端走查：mkdir → 元数据两行 → 描述补句 → 脚本落位 → 绿章。 */
const Walkthrough: React.FC<{
  startAt: number;
  descAt: number;
  halfAt: number;
  doneAt: number;
}> = ({startAt, descAt, halfAt, doneAt}) => {
  const stamp = useEnter('pop', {at: doneAt, dur: DUR.f4, springPreset: 'snap'});
  const meta1 = useReveal('name: pdf-report', {at: startAt + DUR.f5, cps: 18});
  const meta2 = useReveal('description: 解析复杂财务报表与资产负债表', {at: descAt, cps: 22});
  const half = useReveal('纯文本提取 → 内置工具', {at: halfAt, cps: 16});
  const script = useEnter('fall', {at: halfAt + DUR.f6, dur: DUR.f4, springPreset: 'settle'});
  return (
    <div style={{position: 'relative'}}>
      <WalkTerm
        width={860}
        rows={[
          {text: '$ mkdir pdf-report && cd pdf-report', at: startAt, color: theme.ledger},
          {text: '$ cat > SKILL.md', at: startAt + DUR.f4, color: theme.dim},
          {text: meta1, at: startAt + DUR.f5, color: theme.route},
          {text: meta2, at: descAt, color: theme.route},
          {text: half, at: halfAt, color: theme.text},
          {text: '$ cp parse.py scripts/  ✓', at: halfAt + DUR.f6, color: theme.ok},
        ]}
      />
      <div
        style={{
          ...script,
          position: 'absolute',
          right: 30,
          bottom: 64,
          fontFamily: theme.mono,
          fontSize: 14,
          color: theme.dim,
        }}
      >
        scripts/parse.py
      </div>
      <div
        style={{
          position: 'absolute',
          right: 30,
          bottom: 24,
          ...stamp,
          border: `2.5px solid ${theme.ok}`,
          color: theme.ok,
          borderRadius: 10,
          padding: '8px 18px',
          fontFamily: theme.serif,
          fontSize: 24,
          fontWeight: 700,
          transform: `${stamp.transform} rotate(8deg)`,
          background: theme.bg,
        }}
      >
        技能就绪
      </div>
    </div>
  );
};

/** 1-D 治理智慧：门牌互锁三点金线 + Git 流水带；p1-18 dl-discover 全屏窗接管。 */
const Governance: React.FC<{lockAt: number; gitAt: number}> = ({lockAt, gitAt}) => {
  const lock = useDraw(lockAt, DUR.f6);
  const dash = useFlowDash({period: 36});
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 46}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 34}}>
        <div
          style={{
            border: `2px solid ${theme.route}`,
            borderRadius: 10,
            padding: '14px 22px',
            fontFamily: theme.mono,
            fontSize: 21,
            color: theme.route,
            background: theme.panel,
          }}
        >
          📁 pdf-report
        </div>
        <svg width={130} height={26}>
          <line
            x1={0}
            y1={13}
            x2={130}
            y2={13}
            stroke={theme.ledger}
            strokeWidth={3}
            pathLength={lock.pathLength}
            strokeDasharray={lock.strokeDasharray}
            strokeDashoffset={lock.strokeDashoffset}
          />
        </svg>
        <div
          style={{
            border: `2px solid ${theme.ledger}`,
            borderRadius: 10,
            padding: '14px 22px',
            fontFamily: theme.mono,
            fontSize: 21,
            color: theme.ledger,
            background: theme.panel,
          }}
        >
          name: pdf-report
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontFamily: theme.mono,
          fontSize: 17,
          color: theme.dim,
        }}
      >
        <span>git clone</span>
        <svg width={220} height={14}>
          <line
            x1={0}
            y1={7}
            x2={220}
            y2={7}
            stroke={theme.dim}
            strokeWidth={2}
            strokeDasharray={dash.strokeDasharray}
            strokeDashoffset={dash.strokeDashoffset}
          />
        </svg>
        <span style={{color: theme.ok}}>克隆即安装</span>
      </div>
    </div>
  );
};

/** 1-E X1 消融：右绿优先级在位（解析一致）vs 左红拆掉优先级（10 格 2 格分叉）。 */
const X1Ablation: React.FC<{splitAt: number; chaosAt: number; stampAt: number}> = ({
  splitAt,
  chaosAt,
  stampAt,
}) => {
  const frame = useCurrentFrame();
  const shake = useShake({at: chaosAt, amp: 4, decay: true, dur: DUR.f5});
  const stamp = useImpulse({at: stampAt, dur: DUR.f4, peak: 1.2});
  const stampP = progress(frame, stampAt + DUR.f4, DUR.f4);
  const grid = (ok: boolean) => (
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 58px)', gap: 8}}>
      {Array.from({length: 10}).map((_, i) => {
        const drifted = !ok && (i === 3 || i === 7);
        const p = progress(frame, splitAt + i * 3, DUR.f4);
        return (
          <div
            key={i}
            style={{
              width: 58,
              height: 40,
              borderRadius: 7,
              background: ok ? theme.panel : theme.panel,
              border: `1.5px solid ${drifted ? theme.danger : theme.panelBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontFamily: theme.mono,
              color: drifted ? theme.danger : theme.dim,
              opacity: p,
              transform: drifted ? `translateX(${shake}px)` : 'none',
            }}
          >
            {drifted ? 'A|B' : `s${i + 1}`}
          </div>
        );
      })}
    </div>
  );
  return (
    <div style={{position: 'relative'}}>
      <AblationPanel leftTitle="拆掉优先级" rightTitle="优先级在位" width={860} height={260}>
        {grid(false)}
        {grid(true)}
      </AblationPanel>
      <div
        style={{
          position: 'absolute',
          left: 30,
          bottom: -14,
          transform: `rotate(-5deg) scale(${stamp * (0.8 + 0.2 * stampP)})`,
          opacity: stampP,
          border: `2.5px solid ${theme.danger}`,
          color: theme.danger,
          borderRadius: 9,
          padding: '6px 16px',
          fontFamily: theme.serif,
          fontSize: 21,
          fontWeight: 700,
          background: theme.bg,
        }}
      >
        不可复现
      </div>
    </div>
  );
};

export const P1Folder: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string) => w(a).durationInFrames;
  const bA = w('p1-01', 'p1-07');
  const bB = w('p1-08', 'p1-10');
  const bC = w('p1-11', 'p1-15b');
  const bD = w('p1-16', 'p1-19');
  const bE = w('p1-20', 'p1-24');
  const count10 = useCount({at: at('p1-22') - bE.from, dur: DUR.f5, to: 10});
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A 格式契约">
        <SceneTag chapter="P1" tagline="一个文件夹的答案" accent={theme.route} />
        <FieldCards
          openAt={at('p1-01') - bA.from}
          cardAt={at('p1-03') - bA.from}
          optAt={at('p1-07') - bA.from}
        />
        {/* p1-07 全屏独占：规范层三格（六字段封闭集/建议/留白） */}
        <ArchifyRecap
          slug="governance"
          caption="规范层 · 六字段封闭集"
          cues={[
            {chapterId: 'gl-three', at: at('p1-07') - bA.from, durationInFrames: dur('p1-07')},
          ]}
        />
      </Sequence>
      <Sequence {...bB} name="1-B 正文与子目录">
        <SceneTag chapter="P1" tagline="一个文件夹的答案" accent={theme.route} />
        <BodyAndDirs
          bodyAt={at('p1-08') - bB.from}
          dirsAt={at('p1-09') - bB.from}
          idAt={at('p1-10') - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C 走查 pdf-report">
        <SceneTag chapter="P1" tagline="一个文件夹的答案" accent={theme.route} />
        <Walkthrough
          startAt={at('p1-11') - bC.from}
          descAt={at('p1-13') - bC.from}
          halfAt={at('p1-14') - bC.from}
          doneAt={at('p1-15b') - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="1-D 治理智慧">
        <SceneTag chapter="P1" tagline="一个文件夹的答案" accent={theme.route} />
        <Governance lockAt={at('p1-16') - bD.from} gitAt={at('p1-19') - bD.from} />
        {/* p1-18 全屏独占：发现/解析/作用域链 */}
        <ArchifyRecap
          slug="disclosure"
          caption="发现 · 解析 · 作用域"
          cues={[
            {chapterId: 'dl-discover', at: at('p1-18') - bD.from, durationInFrames: dur('p1-18')},
          ]}
        />
      </Sequence>
      <Sequence {...bE} name="1-E X1 消融">
        <SceneTag chapter="P1" tagline="一个文件夹的答案" accent={theme.route} />
        <div style={{position: 'relative'}}>
          <X1Ablation
            splitAt={at('p1-21') - bE.from}
            chaosAt={at('p1-22') - bE.from}
            stampAt={at('p1-24') - bE.from}
          />
          <div
            style={{
              position: 'absolute',
              right: 40,
              top: -40,
              fontFamily: theme.mono,
              fontSize: 30,
              color: theme.danger,
            }}
          >
            {Math.round(count10)} 技能 · 2 项漂移
          </div>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
