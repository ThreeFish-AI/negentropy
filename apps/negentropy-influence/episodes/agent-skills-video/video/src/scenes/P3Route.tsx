/** P3 一句话的路由（p3-01..p3-18，镜 3-A..3-D）——路由交出（dl-activate 章重播）
 *  → 哑火/抢戏双门 → 三法则阶梯（命令口吻/近失配/评测 6:4）→ 关键词反噬
 *  （涂满招牌 + 注意力波形衰减）。主色路由靛。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useDraw, useEnter, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {GoldenCard} from '../components/as-motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';

/** 3-A：目录递交模型剪影（窗外）；p3-03 全屏窗重播激活章（跨幕非邻接复用）。 */
const Handover: React.FC<{handAt: number}> = ({handAt}) => {
  const card = useEnter('slideL', {at: handAt, dur: DUR.f5, springPreset: 'settle'});
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 60}}>
      <div
        style={{
          ...card,
          border: `1.5px solid ${theme.route}77`,
          borderRadius: 10,
          padding: '16px 24px',
          background: theme.panel,
          fontFamily: theme.mono,
          fontSize: 17,
          color: theme.route,
        }}
      >
        全部技能的目录（只有一行行的名字 + 描述）
      </div>
      <div style={{fontSize: 34, color: theme.dim}}>→</div>
      <div
        style={{
          width: 150,
          height: 150,
          borderRadius: '50%',
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 40,
        }}
      >
        🧠
      </div>
    </div>
  );
};

/** 3-B：哑火（门半掩、客人走过）vs 抢戏（门大开、什么都拉进去）双门。 */
const TwoDoors: React.FC<{doorAt: number; costAt: number}> = ({doorAt, costAt}) => {
  const frame = useCurrentFrame();
  const walk = progress(frame, doorAt + DUR.f5, DUR.f6);
  const badges = useStagger(2, {at: costAt, dur: DUR.f5, stride: 9});
  const visitor = 60 + 260 * walk;
  return (
    <div style={{display: 'flex', gap: 70, alignItems: 'flex-start'}}>
      <div style={{width: 360, background: theme.panel, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 14, padding: 24}}>
        <div style={{fontSize: 16, color: theme.dim, letterSpacing: 2, marginBottom: 16}}>哑火 · 该响没响</div>
        <div style={{position: 'relative', height: 150}}>
          <div style={{width: 74, height: 110, border: `2px solid ${theme.dim}`, borderRadius: '40px 40px 0 0', margin: '0 auto', opacity: 0.55}} />
          <div style={{position: 'absolute', left: 30, right: 30, top: 55, height: 55, background: theme.bg, opacity: 0.85}} />
          <div style={{position: 'absolute', top: 96, left: visitor, fontSize: 26, opacity: 0.75}}>🧑‍💼</div>
        </div>
        <div style={{fontSize: 14.5, color: theme.dim, marginTop: 8}}>门半掩 · 客人径直走过</div>
      </div>
      <div style={{width: 360, background: theme.panel, border: `1.5px solid ${theme.route}66`, borderRadius: 14, padding: 24}}>
        <div style={{fontSize: 16, color: theme.route, letterSpacing: 2, marginBottom: 16}}>抢戏 · 不该响乱响</div>
        <div style={{position: 'relative', height: 150}}>
          <div style={{width: 74, height: 110, border: `2px solid ${theme.route}`, borderRadius: '40px 40px 0 0', margin: '0 auto'}} />
          <div style={{position: 'absolute', top: 96, left: 60, fontSize: 22}}>🧑‍💼</div>
          <div style={{position: 'absolute', top: 96, left: 130, fontSize: 22}}>🧑‍🔬</div>
          <div style={{position: 'absolute', top: 96, left: 200, fontSize: 22}}>🧑‍🍳</div>
        </div>
        <div style={{fontSize: 14.5, color: theme.dim, marginTop: 8}}>门大开 · 什么问句都拉进去跑</div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 14, marginTop: 30}}>
        {['白费一次调用', '带偏答案'].map((t, i) => (
          <div
            key={t}
            style={{
              opacity: badges[i],
              transform: `translateX(${16 * (1 - badges[i])}px)`,
              border: `1.5px solid ${theme.danger}66`,
              color: theme.danger,
              borderRadius: 999,
              padding: '8px 18px',
              fontSize: 15.5,
            }}
          >
            ✗ {t}
          </div>
        ))}
      </div>
    </div>
  );
};

/** 3-C：三法则阶梯（命令口吻示例框 → 近失配负例 → 评测 6:4 双栏）。 */
const ThreeRules: React.FC<{step1At: number; step2At: number; step3At: number}> = ({
  step1At,
  step2At,
  step3At,
}) => {
  const frame = useCurrentFrame();
  const s1 = useEnter('rise', {at: step1At, dur: DUR.f5, springPreset: 'settle'});
  const s2 = useEnter('rise', {at: step2At, dur: DUR.f5, springPreset: 'settle'});
  const s3 = useEnter('rise', {at: step3At, dur: DUR.f5, springPreset: 'settle'});
  const underline = useDraw(step2At + DUR.f5, DUR.f5);
  const shuffle = progress(frame, step3At + DUR.f5, DUR.f6);
  return (
    <div style={{display: 'flex', gap: 34, alignItems: 'flex-end'}}>
      <div style={{...s1, width: 330, background: theme.panel, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 12, padding: 20, minHeight: 220}}>
        <div style={{fontSize: 14, color: theme.dim, letterSpacing: 2, marginBottom: 10}}>法则一 · 命令口吻</div>
        <div style={{border: `1.5px solid ${theme.route}55`, borderRadius: 8, padding: '12px 14px', fontFamily: theme.mono, fontSize: 15.5, color: theme.route}}>
          Use when the user wants to…
        </div>
        <div style={{fontSize: 14, color: theme.dim, marginTop: 10}}>时机写成明确条件，不堆形容词</div>
      </div>
      <div style={{...s2, width: 360, background: theme.panel, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 12, padding: 20, minHeight: 260}}>
        <div style={{fontSize: 14, color: theme.dim, letterSpacing: 2, marginBottom: 10}}>法则二 · 防近失配</div>
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.text, lineHeight: 1.6}}>
          解析复杂财务报表与资产负债表
        </div>
        <svg width={300} height={12}>
          <line x1={0} y1={6} x2={300} y2={6} stroke={theme.ledger} strokeWidth={2.5} pathLength={underline.pathLength} strokeDasharray={underline.strokeDasharray} strokeDashoffset={underline.strokeDashoffset} />
        </svg>
        <div style={{fontSize: 14, color: theme.ledger, marginTop: 8}}>＋ 纯文本提取，请用内置工具</div>
        <div style={{fontSize: 14, color: theme.dim, marginTop: 10}}>把「看着相关、其实不归我管」写清楚</div>
      </div>
      <div style={{...s3, width: 380, background: theme.panel, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 12, padding: 20, minHeight: 300}}>
        <div style={{fontSize: 14, color: theme.dim, letterSpacing: 2, marginBottom: 10}}>法则三 · 数据说话</div>
        <div style={{display: 'flex', gap: 8, marginBottom: 14}}>
          {Array.from({length: 8}).map((_, i) => (
            <div key={i} style={{width: 30, height: 40, borderRadius: 5, background: theme.panelBorder, transform: `rotate(${(i % 3 - 1) * 12 * shuffle}deg) translateX(${20 * shuffle * ((i % 2) * 2 - 1)}px)`, opacity: 0.7}} />
          ))}
        </div>
        <div style={{display: 'flex', gap: 10}}>
          <div style={{flex: 6, height: 34, borderRadius: 6, background: `${theme.route}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, color: theme.text}}>训练 6</div>
          <div style={{flex: 4, height: 34, borderRadius: 6, background: `${theme.dim}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, color: theme.dim}}>验证 4</div>
        </div>
        <div style={{fontSize: 14, color: theme.dim, marginTop: 10}}>20 组提问 · 多轮测命中率 · 防过拟合</div>
      </div>
    </div>
  );
};

/** 3-D：关键词涂满招牌 + 注意力波形衰减。 */
const KeywordFlood: React.FC<{floodAt: number; closeAt: number}> = ({floodAt, closeAt}) => {
  const words = useStagger(9, {at: floodAt, dur: DUR.f6, stride: 5});
  const close = useEnter('pop', {at: closeAt, dur: DUR.f5, springPreset: 'snap'});
  const frame = useCurrentFrame();
  const decay = progress(frame, floodAt + 30, DUR.f6);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 80}}>
      <div style={{position: 'relative', width: 420, height: 220}}>
        <div style={{position: 'absolute', inset: 0, border: `2px solid ${theme.route}`, borderRadius: 12, background: theme.panel, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.route}}>pdf-report</span>
        </div>
        {['报表', '财务', 'PDF', 'excel', '表格', '数据', '分析', '报告', '账目'].map((w, i) => (
          <div
            key={w}
            style={{
              position: 'absolute',
              left: 20 + (i % 3) * 130,
              top: 24 + Math.floor(i / 3) * 58,
              opacity: words[i] * 0.85,
              background: `${theme.dim}44`,
              borderRadius: 5,
              padding: '3px 9px',
              fontSize: 14.5,
              color: theme.dim,
              transform: `rotate(${(i % 2 ? 1 : -1) * 4}deg)`,
            }}
          >
            {w}
          </div>
        ))}
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center'}}>
        <svg width={330} height={110}>
          <path
            d={`M0 55 ${Array.from({length: 33}).map((_, i) => {
              const amp = 42 * Math.max(0.08, 1 - decay * (i / 22));
              return `L${i * 10} ${55 - amp * Math.sin(i * 1.1)}`;
            }).join(' ')}`}
            fill="none"
            stroke={theme.route}
            strokeWidth={2.5}
            opacity={0.9}
          />
        </svg>
        <div style={{fontSize: 14.5, color: theme.dim}}>目录＝注意力底噪 · 堆得越满，路由越钝</div>
        <GoldenCard lines={['一根字符串的路由', '也能调成高信度工程']} enter={close} width={360} />
      </div>
    </div>
  );
};

export const P3Route: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string) => w(a).durationInFrames;
  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-08');
  const bC = w('p3-09', 'p3-15');
  const bD = w('p3-16', 'p3-18');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A 路由交出">
        <SceneTag chapter="P3" tagline="一句话的路由" accent={theme.route} />
        <Handover handAt={at('p3-01') - bA.from} />
        <ArchifyRecap
          slug="disclosure"
          caption="模型自主比对 description"
          cues={[
            {chapterId: 'dl-activate', at: at('p3-03') - bA.from, durationInFrames: dur('p3-03')},
          ]}
        />
      </Sequence>
      <Sequence {...bB} name="3-B 哑火与抢戏">
        <SceneTag chapter="P3" tagline="一句话的路由" accent={theme.route} />
        <TwoDoors doorAt={at('p3-06') - bB.from} costAt={at('p3-08') - bB.from} />
      </Sequence>
      <Sequence {...bC} name="3-C 三法则阶梯">
        <SceneTag chapter="P3" tagline="一句话的路由" accent={theme.route} />
        <ThreeRules
          step1At={at('p3-10') - bC.from}
          step2At={at('p3-12') - bC.from}
          step3At={at('p3-14') - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="3-D 关键词反噬">
        <SceneTag chapter="P3" tagline="一句话的路由" accent={theme.route} />
        <KeywordFlood floodAt={at('p3-16') - bD.from} closeAt={at('p3-18') - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
