/** P0 三个自信的错（p0-01..p0-27，27 句；storyboard v3「P0 三个自信的错」节）。
 *
 *  9 镜 / 3 条 archify cue（v3：三错全屏图回放改真装置，销账项实装）：
 *   0-A 夜机坪（装置：机库夜灯+绿勾×3 显示屏+工卡首现）
 *   0-B 过期页特写（真装置：页脚修订号推近+放大镜框 REV 差异）· 0-C 两页对峙天平（真装置）
 *   0-D 无资格印章+闸门横杆（真装置）· 0-E 三错快闪回放+判词条
 *   0-F fm2-open@p0-15（dur p0-15+16，rate≈1.01 stretch）+ NumCrash@p0-17 + 双实线徽@p0-17
 *   0-G 崩崖@p0-19 + Spider 徽@p0-20 + 97/4 比例条@p0-22（销账实装）+ 虚线徽@p0-22
 *   0-H fm2-open@p0-23（trim）→ fm2-def@p0-24（hold，镜内背靠背自动抑制入场）
 *   0-I 发工卡（装置：格子逐格亮起+「上下文层蓝图」标题角）
 *  证据徽避让：p0-16 徽与 p0-17 NumCrash 同批入场（fm2-open 窗后空窗句）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {useEnter, useProgress, usePushIn, useReveal, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {WorkCard} from '../components/WorkCard';

const hash = (i: number, salt = 1): number =>
  Math.abs(Math.sin(i * 127.1 + salt * 311.7)) % 1;

export const P0Errors: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bB = w('p0-03', 'p0-07');
  const bC = w('p0-08', 'p0-10');
  const bD = w('p0-11', 'p0-12');
  const bE = w('p0-13', 'p0-14');
  const bF = w('p0-15', 'p0-18');
  const bG = w('p0-19', 'p0-22');
  const bH = w('p0-23', 'p0-24');
  const bI = w('p0-25', 'p0-27');
  // 0-G 比例条入场门（97/4 口播句；与条内弹簧同锚）
  const ratioIn = useProgress(at('p0-22') - bG.from, 10);

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P0" tagline="三个自信的错" accent={theme.concept} />

      {/* 0-A 夜机坪：机位灯呼吸 + 「体检全绿」绿勾×3 + 工卡特写首现（首镜视听合力 RSI-039） */}
      <Sequence from={0} durationInFrames={dur('p0-01', 'p0-02')} name="0-A">
        <NightApron at01={at('p0-01')} />
      </Sequence>

      {/* 0-B 过期页：真装置（当版页特写推近，放大镜框 REV 差异） */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="0-B">
        <StalePage at03={at('p0-03') - bB.from} at05={at('p0-05') - bB.from} at07={at('p0-07') - bB.from} />
      </Sequence>

      {/* 0-C 两页打架：对峙卡片 + 引用计数天平 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="0-C">
        <ClashPages at08={at('p0-08') - bC.from} at09={at('p0-09') - bC.from} at10={at('p0-10') - bC.from} />
      </Sequence>

      {/* 0-D 越权签字：无资格印章落下 + 闸门横杆抬起 */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="0-D">
        <RogueStamp at11={at('p0-11') - bD.from} at12={at('p0-12') - bD.from} />
      </Sequence>

      {/* 0-E 三错共性：三缩略卡横排 + 判词条打字机 */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="0-E">
        <ThreeRecap at13={at('p0-13') - bE.from} at14={at('p0-14') - bE.from} />
      </Sequence>

      {/* 0-F 换成 AI：fm2-open 铺 p0-15..16（rate≈1.01）；NumCrash+双徽挪 cue 窗后 p0-17 空窗句 */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="0-F">
        <ArchifyRecap slug="failure-map" caption="失效九簇 · 总览" cues={[
          {chapterId: 'fm2-open', at: at('p0-15') - bF.from, durationInFrames: dur('p0-15') + dur('p0-16')},
        ]} />
        <Sequence from={at('p0-17') - bF.from} name="0-F-dev">
          <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30}}>
            <NumCrash from={19} to={85} at={0} label="裸翻资料库 → 递对证据页" />
            <div style={{display: 'flex', gap: 24}}>
              <EvidenceBadge level="solid" at={6} note="FinanceBench" />
              <EvidenceBadge level="solid" at={16} note="同模型对照" />
            </div>
          </AbsoluteFill>
        </Sequence>
      </Sequence>

      {/* 0-G 崩崖 + 97/4 断层（比例条销账实装；口播 p0-22 才念 97/4，徽与条同句入场；
          Sequence 默认 absolute-fill 不进文档流——上下分区改为同层 flex 列直挂） */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="0-G">
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26}}>
          <CliffLine at={at('p0-19') - bG.from} markAt={at('p0-20') - bG.from} noteAt={at('p0-21') - bG.from} />
          <div style={{opacity: ratioIn}}>
            <RatioBars at={at('p0-22') - bG.from} />
          </div>
        </AbsoluteFill>
        <div style={{position: 'absolute', bottom: 150, left: 80}}>
          <EvidenceBadge level="solid" at={at('p0-20') - bG.from} note="Spider 2.0 · 86.6→10.1" />
          <div style={{height: 12}} />
          <EvidenceBadge level="dashed" at={at('p0-22') - bG.from} note="n=1000 · 方法论未公开" />
        </div>
      </Sequence>

      {/* 0-H 案卷登记：fm2-open（trim）→ fm2-def（hold），镜内背靠背自动抑制换章弹入 */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="0-H">
        <ArchifyRecap slug="failure-map" caption="案卷 · 九族四十二行" cues={[
          {chapterId: 'fm2-open', at: at('p0-23') - bH.from, durationInFrames: dur('p0-23')},
          {chapterId: 'fm2-def', at: at('p0-24') - bH.from, durationInFrames: dur('p0-24')},
        ]} />
      </Sequence>

      {/* 0-I 发工卡：递卡 + 格子逐格亮起 + 「上下文层蓝图」标题角 */}
      <Sequence from={bI.from} durationInFrames={bI.durationInFrames} name="0-I">
        <IssueCard at25={at('p0-25') - bI.from} at26={at('p0-26') - bI.from} at27={at('p0-27') - bI.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 夜机坪：地平线 + 呼吸机位灯（〔M-002〕以静写闷）+ 登机桥「体检全绿」绿勾×3。 */
const NightApron: React.FC<{at01: number}> = ({at01}) => {
  const f = useCurrentFrame();
  const push = usePushIn(at01, {scale: 1.06, dur: 90});
  const lamps = useStagger(7, {stride: 6, at: 6});
  const checks = useStagger(3, {stride: 14, at: at01 + 8});
  return (
    <AbsoluteFill style={{transform: push}}>
      <div style={{position: 'absolute', bottom: 120, left: 0, right: 0, height: 2, background: theme.panelBorder}} />
      {lamps.map((k, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            bottom: 124 + hash(i) * 60,
            left: `${10 + i * 13}%`,
            width: 10,
            height: 10,
            borderRadius: 5,
            background: theme.concept,
            opacity: (k * 0.5 + 0.25) * (0.7 + 0.3 * Math.sin(f / 40 + i)),
          }}
        />
      ))}
      {/* 登机桥显示屏：体检全绿（视觉钩子：全绿 vs 三隐患的反差） */}
      <div
        style={{
          position: 'absolute',
          left: '12%',
          top: '20%',
          width: 240,
          padding: '14px 20px',
          background: theme.panel,
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 10,
        }}
      >
        <div style={{fontSize: 17, color: theme.dim, marginBottom: 8}}>登机桥 · 例行体检</div>
        {['液压', '电气', '结构'].map((t, i) => (
          <div key={t} style={{display: 'flex', alignItems: 'center', gap: 10, opacity: checks[i], fontSize: 20, color: theme.ok}}>
            <span style={{width: 20, height: 20, borderRadius: 10, border: `2px solid ${theme.ok}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14}}>✓</span>
            {t}
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', right: '16%', top: '30%', width: 320}}>
        <WorkCard stamps={0} totalSlots={9} w={320} label="WORKCARD No.013" />
      </div>
    </AbsoluteFill>
  );
};

/** 0-B 过期页特写：页脚修订号推近 + 放大镜框 REV 差异 + 机械师拧螺栓剪影（以静写闷）。 */
const StalePage: React.FC<{at03: number; at05: number; at07: number}> = ({at03, at05, at07}) => {
  const enter = useEnter('rise', {at: at03, dur: 18});
  const push = usePushIn(at05, {scale: 0.14, dur: 40});
  const diff = useProgress(at07, 14);
  const zoom = useProgress(at05, 40);
  const wrench = useCurrentFrame();
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 90}}>
      {/* 机械师剪影：匀速拧螺栓（以静写闷——不加强调动效） */}
      <svg width={190} height={300} style={{opacity: 0.8}}>
        <circle cx={95} cy={54} r={26} fill="none" stroke={theme.dim} strokeWidth={2.5} />
        <line x1={95} y1={80} x2={95} y2={180} stroke={theme.dim} strokeWidth={2.5} />
        <line x1={95} y1={180} x2={60} y2={250} stroke={theme.dim} strokeWidth={2.5} />
        <line x1={95} y1={180} x2={130} y2={250} stroke={theme.dim} strokeWidth={2.5} />
        <line x1={95} y1={104} x2={58} y2={150} stroke={theme.dim} strokeWidth={2.5} />
        <line x1={95} y1={104} x2={132} y2={150} stroke={theme.dim} strokeWidth={2.5} />
        <g transform={`rotate(${Math.sin(wrench / 26) * 24} 150 150)`}>
          <line x1={132} y1={150} x2={168} y2={150} stroke={theme.concept} strokeWidth={3} strokeLinecap="round" />
        </g>
      </svg>
      {/* 当版页：页脚修订号是唯一差异点 */}
      <div style={{...enter, transform: push, position: 'relative', width: 380, height: 460, background: theme.paper, borderRadius: 8, padding: 24, color: theme.paperInk, boxSizing: 'border-box'}}>
        <div style={{fontSize: 20, fontFamily: theme.mono}}>AMM 32-11-00</div>
        <div style={{fontSize: 16, color: theme.paperInkDim, marginTop: 8}}>主起落架螺栓 · 力矩</div>
        <div style={{fontSize: 34, fontWeight: 700, marginTop: 18}}>45 N·m</div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{height: 8, background: theme.paperInkDim, opacity: 0.25, borderRadius: 4, marginTop: 22, width: `${70 + (i % 3) * 10}%`}} />
        ))}
        <div style={{position: 'absolute', bottom: 18, left: 24, right: 24, display: 'flex', justifyContent: 'space-between', fontSize: 15, color: theme.paperInkDim, fontFamily: theme.mono}}>
          <span>REV.2024-08</span>
          <span>印发同样清晰</span>
        </div>
        {/* 放大镜框：聚焦页脚修订号，reveals 母本现行版 */}
        <div
          style={{
            position: 'absolute',
            left: -30 + zoom * 8,
            bottom: -6,
            width: 210,
            height: 84,
            borderRadius: 42,
            border: `3px solid ${theme.conceptDeep}`,
            opacity: zoom,
            background: withAlpha(theme.bg, 0.55),
          }}
        >
          <div style={{position: 'absolute', left: 14, top: 12, fontSize: 15, fontFamily: theme.mono, color: theme.paperInk}}>
            手里这页 REV.2024-08
          </div>
          <div style={{position: 'absolute', left: 14, top: 40, fontSize: 17, fontFamily: theme.mono, color: diff > 0.2 ? theme.conceptDeep : theme.paperInkDim, fontWeight: diff > 0.2 ? 700 : 400}}>
            母本已是 REV.2026-03
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 0-C 两页打架：同一力矩值两页两个数 + 引用计数天平倾斜（错侧压倒）。 */
const ClashPages: React.FC<{at08: number; at09: number; at10: number}> = ({at08, at09, at10}) => {
  const enter = useStagger(2, {stride: 16, at: at08});
  const tilt = useSpring('settle', {at: at09, dur: 26});
  const wrong = useProgress(at10, 12);
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 46}}>
      <svg width={620} height={300}>
        {/* 天平梁：倾斜向引用多的一侧（X-001 核对：多数侧=错侧在画面下方压倒） */}
        <g transform={`rotate(${-tilt * 13} 310 86)`}>
          <line x1={90} y1={86} x2={530} y2={86} stroke={theme.concept} strokeWidth={4} strokeLinecap="round" />
          <line x1={90} y1={86} x2={90} y2={128} stroke={theme.panelBorder} strokeWidth={2} />
          <line x1={530} y1={86} x2={530} y2={128} stroke={theme.panelBorder} strokeWidth={2} />
        </g>
        <line x1={310} y1={86} x2={310} y2={214} stroke={theme.panelBorder} strokeWidth={3} />
        <line x1={250} y1={214} x2={370} y2={214} stroke={theme.panelBorder} strokeWidth={3} />
        <text x={90} y={66} textAnchor="middle" fill={theme.dim} fontSize={19}>引用 ×200</text>
        <text x={530} y={66} textAnchor="middle" fill={theme.dim} fontSize={19}>引用 ×5</text>
      </svg>
      <div style={{display: 'flex', gap: 40}}>
        {[
          {v: '60 N·m', rev: 'AMM rev.C', cite: '×200', bad: true},
          {v: '45 N·m', rev: 'AMM rev.D', cite: '×5', bad: false},
        ].map((p, i) => (
          <div
            key={p.rev}
            style={{
              opacity: enter[i],
              width: 250,
              padding: '18px 22px',
              background: theme.paper,
              borderRadius: 8,
              color: theme.paperInk,
              outline: p.bad && wrong > 0.3 ? `3px solid ${theme.conceptDeep}` : 'none',
              transform: `translateY(${p.bad ? tilt * 16 : -tilt * 8}px)`,
            }}
          >
            <div style={{fontSize: 15, color: theme.paperInkDim, fontFamily: theme.mono}}>{p.rev} · 同一力矩值</div>
            <div style={{fontSize: 44, fontWeight: 700, marginTop: 6, color: p.bad && wrong > 0.3 ? theme.conceptDeep : theme.paperInk}}>{p.v}</div>
            <div style={{fontSize: 15, color: theme.paperInkDim, marginTop: 4}}>被引用 {p.cite}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 0-D 越权签字：会签栏末格无资格印章落下 + 闸门横杆抬起放行（警示）。 */
const RogueStamp: React.FC<{at11: number; at12: number}> = ({at11, at12}) => {
  const fall = useSpring('settle', {at: at11 + 6, dur: 14});
  const blink = useProgress(at11 + 20, 30);
  const arm = useSpring('settle', {at: at12, dur: 20});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 110}}>
      <div style={{display: 'flex', gap: 18}}>
        {['执照', '机型', '必检', '关盖'].map((t, i) => {
          const last = i === 3;
          return (
            <div key={t} style={{width: 150, height: 190, border: `2px solid ${theme.panelBorder}`, borderRadius: 10, background: theme.panel, position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 12}}>
              <span style={{position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', fontSize: 19, color: theme.dim}}>{t}</span>
              {last ? (
                <div
                  style={{
                    width: 92,
                    height: 92,
                    borderRadius: 8,
                    border: `3px solid ${theme.conceptDeep}`,
                    color: theme.conceptDeep,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 19,
                    transform: `scale(${fall}) rotate(-8deg) translateY(${(1 - fall) * -90}px)`,
                    opacity: fall * (1 - blink * 0.4 * (Math.sin(blink * Math.PI * 6) > 0 ? 1 : 0)),
                  }}
                >
                  无资格
                </div>
              ) : (
                <div style={{width: 60, height: 60, borderRadius: 30, border: `2.5px solid ${theme.ok}`, color: theme.ok, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18}}>已签</div>
              )}
            </div>
          );
        })}
      </div>
      {/* 闸门横杆：抬起 = 形同虚设 */}
      <svg width={260} height={240}>
        <line x1={40} y1={190} x2={220} y2={190} stroke={theme.panelBorder} strokeWidth={4} />
        <circle cx={130} cy={190} r={10} fill={theme.panelBorder} />
        <g transform={`rotate(${-arm * 62} 130 178)`}>
          <line x1={30} y1={178} x2={230} y2={178} stroke={theme.conceptDeep} strokeWidth={7} strokeLinecap="round" />
        </g>
        <text x={130} y={228} textAnchor="middle" fill={theme.conceptDeep} fontSize={19} opacity={arm}>
          横杆抬起 · 放行
        </text>
      </svg>
    </AbsoluteFill>
  );
};

/** 0-E 三错快闪回放：页/天平/印章三缩略卡 + 「零报错·全自信」判词条打字机。 */
const ThreeRecap: React.FC<{at13: number; at14: number}> = ({at13, at14}) => {
  const cards = useStagger(3, {stride: 12, at: at13});
  const strip = useReveal('零报错 · 全自信', {at: at14, cps: 6});
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 60}}>
      <div style={{display: 'flex', gap: 34}}>
        {[
          {glyph: 'REV', cap: '过期页'},
          {glyph: '⚖', cap: '两页打架'},
          {glyph: '✕', cap: '越权签字'},
        ].map((c, i) => (
          <div key={c.cap} style={{opacity: cards[i], width: 200, padding: '20px 0', border: `1.5px solid ${theme.panelBorder}`, borderRadius: 10, background: theme.panel, textAlign: 'center'}}>
            <div style={{fontSize: 44, color: theme.conceptDeep, fontFamily: theme.mono}}>{c.glyph}</div>
            <div style={{fontSize: 20, color: theme.dim, marginTop: 10}}>{c.cap}</div>
          </div>
        ))}
      </div>
      <div style={{padding: '12px 34px', border: `2px solid ${theme.conceptDeep}`, borderRadius: 10, fontSize: 34, color: theme.conceptDeep, letterSpacing: 3}}>
        {strip}
        <span style={{opacity: strip.length >= 8 ? 1 : 0}}>▍</span>
      </div>
    </AbsoluteFill>
  );
};

/** 19→85 数字对撞（口播只念数，画面翻牌）。 */
export const NumCrash: React.FC<{from: number; to: number; at: number; label: string}> = ({from, to, at, label}) => {
  const prog = useSpring('settle', {at, dur: 45});
  const val = Math.round(from + (to - from) * prog);
  return (
    <div style={{textAlign: 'center'}}>
      <div style={{fontSize: 120, fontWeight: 700, color: theme.ok, fontVariantNumeric: 'tabular-nums'}}>{val}%</div>
      <div style={{fontSize: 20, color: theme.dim}}>{label}</div>
    </div>
  );
};

/** 崩崖折线：87 → 10 下坠（draw 描线 + 终点标注）。块级元素，参与父级 flex 列。 */
const CliffLine: React.FC<{at: number; markAt: number; noteAt: number}> = ({at, markAt, noteAt}) => {
  const enter = useEnter('fade', {at, dur: 10});
  const draw = useProgress(at + 6, 40);
  const mark = useProgress(markAt, 12);
  const note = useProgress(noteAt, 12);
  const pts = [0, 1, 2, 3, 4, 5];
  const lx = (i: number) => 40 + i * 52;
  const ly = (i: number) => 70 + Math.min(150, i * i * 10);
  const total = 5;
  const drawn = draw * total;
  const segs = pts.slice(0, Math.max(2, Math.ceil(drawn) + 1));
  const partial = Math.min(1, drawn - Math.floor(drawn));
  const last = segs[segs.length - 1];
  const prev = segs[segs.length - 2];
  const hx = lx(prev) + (lx(last) - lx(prev)) * partial;
  const hy = ly(prev) + (ly(last) - ly(prev)) * partial;
  const pathPts = segs.slice(0, -1).map((i) => `${lx(i)},${ly(i)}`).join(' ') + ` ${hx},${hy}`;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <svg width={340} height={250} style={enter}>
        <line x1={30} y1={230} x2={320} y2={230} stroke={theme.panelBorder} strokeWidth={1.5} />
        <polyline points={pathPts} fill="none" stroke={theme.conceptDeep} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={hx} cy={hy} r={5} fill={theme.conceptDeep} />
        <text x={40} y={54} fill={theme.dim} fontSize={19}>87%</text>
        <text x={lx(5) - 34} y={ly(5) - 14} fill={theme.conceptDeep} fontSize={19} opacity={mark}>10%</text>
      </svg>
      <div style={{fontSize: 21, color: theme.dim, opacity: note, marginTop: 4}}>学术考卷 → 企业考卷</div>
      <div style={{fontSize: 20, color: theme.conceptDeep, opacity: note, marginTop: 10}}>对象从头搞错 · 非语法错</div>
    </div>
  );
};

/** 97/4 比例条（v2 销账实装）：相信的长条 vs 建成的短刺。 */
export const RatioBars: React.FC<{at: number}> = ({at}) => {
  const grow97 = useSpring('settle', {at: at + 4, dur: 30});
  const grow4 = useSpring('settle', {at: at + 30, dur: 14});
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 26, width: 640}}>
      <div>
        <div style={{fontSize: 21, color: theme.concept, marginBottom: 8}}>九成七 · 相信上下文决定成败</div>
        <div style={{width: 640, height: 30, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, overflow: 'hidden'}}>
          <div style={{width: `${97 * grow97}%`, height: '100%', background: theme.concept, opacity: 0.85}} />
        </div>
      </div>
      <div>
        <div style={{fontSize: 21, color: theme.conceptDeep, marginBottom: 8}}>百分之四 · 真正建成</div>
        <div style={{width: 640, height: 30, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center'}}>
          <div style={{width: `${4 * grow4}%`, height: 16, background: theme.conceptDeep, borderRadius: 3}} />
        </div>
      </div>
    </div>
  );
};

/** 0-I 发工卡：递卡横移 + 格子逐格亮起 + 「上下文层蓝图」标题角浮起。 */
const IssueCard: React.FC<{at25: number; at26: number; at27: number}> = ({at25, at26, at27}) => {
  const slide = useSpring('settle', {at: at25, dur: 26});
  const cells = useStagger(9, {stride: 9, at: at26, dur: 5});
  const title = useEnter('rise', {at: at27, dur: 16});
  const x = (1 - slide) * -260;
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', transform: `translateX(${x}px)`}}>
        {/* 与 WorkCard 同形（M-001 恒定锚：钢蓝描边 2px）；格子逐格亮起为其口播槽位专属动效 */}
        <div style={{width: 460, height: 300, background: theme.panel, border: `2px solid ${theme.concept}`, borderRadius: 10, padding: 20, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <span style={{fontSize: 24, color: theme.concept, letterSpacing: 2}}>给 AI 的工卡</span>
            <span style={{fontSize: 18, color: theme.dim, fontFamily: theme.mono}}>WORKCARD</span>
          </div>
          <div style={{flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8}}>
            {cells.map((k, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 6,
                  border: `1.5px solid ${k > 0.4 ? withAlpha(theme.concept, 0.9) : theme.panelBorder}`,
                  background: k > 0.4 ? withAlpha(theme.concept, 0.08) : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 19,
                  color: k > 0.4 ? theme.concept : theme.panelBorder,
                  opacity: 0.4 + k * 0.6,
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            ...title,
            position: 'absolute',
            top: -34,
            right: -24,
            padding: '8px 20px',
            border: `2px solid ${theme.concept}`,
            borderRadius: 8,
            fontSize: 24,
            color: theme.concept,
            background: withAlpha(theme.bg, 0.9),
          }}
        >
          上下文层蓝图
        </div>
      </div>
    </AbsoluteFill>
  );
};
