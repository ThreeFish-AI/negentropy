/** P5 三方争议（p5-01..21）——分类器之争 / 自报基准天平 / 校准外推与对冲。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useDraw, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {Footnote, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, Stage} from '../components/devices';

/** 比分翻面卡：正面是微调自报的领先，翻过来换个基准整个反过来。 */
const FlipScore: React.FC<{at: number; flipAt: number}> = ({at, flipAt}) => {
  const show = useProgress(at, DUR.f5);
  const flip = useProgress(flipAt, DUR.f6);
  const face: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    borderRadius: 14,
    border: `2.5px solid ${theme.panelBorder}`,
    background: theme.panel,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 34,
  };
  const side: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  };
  return (
    <div style={{width: 640, height: 240, perspective: 1500, opacity: show}}>
      <div style={{position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transform: `rotateX(${flip * 180}deg)`}}>
        <div style={face}>
          <div style={side}>
            <div style={{fontFamily: theme.mono, fontSize: 62, color: theme.danger}}>76.6</div>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.text}}>专用分类器 · 微调</div>
            <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.danger}}>{'据称压过 · 开源复刻自报'}</div>
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 26, color: theme.dim}}>vs</div>
          <div style={side}>
            <div style={{fontFamily: theme.mono, fontSize: 62, color: theme.dim}}>72.7</div>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.text}}>零样本通才 · Jev</div>
            <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>被比较的官方成绩</div>
          </div>
        </div>
        <div style={{...face, transform: 'rotateX(180deg)'}}>
          <div style={side}>
            <div style={{fontFamily: theme.mono, fontSize: 62, color: theme.danger}}>42.5</div>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.text}}>专用分类器 · 同一个</div>
            <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.danger}}>{'换个没练过的客服基准'}</div>
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 26, color: theme.dim}}>vs</div>
          <div style={side}>
            <div style={{fontFamily: theme.mono, fontSize: 62, color: theme.text}}>87.0</div>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.text}}>零样本通才 · Jev</div>
            <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'比分整个反过来 · 第三方发布'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** 选址谱滑标：三问答完，位置落在一条谱上。 */
const SpectrumSlider: React.FC<{at: number; pushAt: number}> = ({at, pushAt}) => {
  const show = useProgress(at, DUR.f5);
  const settle = useProgress(pushAt, DUR.f5);
  const pulse = useImpulse({at: pushAt + DUR.f5, dur: DUR.f4, peak: 1});
  const W = 1300;
  const knobX = W / 2 + settle * W * 0.14;
  const chips = [
    {t: '任务稳定吗？', f: 0.16},
    {t: '调用量大吗？', f: 0.5},
    {t: '标注贵不贵？', f: 0.84},
  ];
  return (
    <div style={{width: W, opacity: show, display: 'flex', flexDirection: 'column', gap: 26}}>
      <div style={{position: 'relative', height: 56}}>
        {chips.map((c) => (
          <div
            key={c.t}
            style={{
              position: 'absolute',
              left: W * c.f - 92,
              width: 184,
              textAlign: 'center',
              padding: '7px 0',
              borderRadius: 8,
              border: `1.5px solid ${theme.panelBorder}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 20,
              color: theme.dim,
            }}
          >
            {c.t}
          </div>
        ))}
      </div>
      <div style={{position: 'relative', height: 46}}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 18,
            height: 10,
            borderRadius: 5,
            background: `linear-gradient(90deg, ${theme.danger}66, ${theme.panelBorder} 45%, ${theme.panelBorder} 55%, ${theme.dim}66)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: knobX - 15,
            top: 8,
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: theme.text,
            boxShadow: `0 0 ${16 * pulse + 4}px ${theme.text}AA`,
          }}
        />
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.sans, fontSize: 21}}>
        <span style={{color: theme.danger}}>任务稳定 · 量大 · 标注贵 → 专门练一个分类器</span>
        <span style={{color: theme.dim}}>{'任务多变 · 冷启动 → 零样本通才'}</span>
      </div>
    </div>
  );
};

/** 倍数天平：左盘官方头条倍数，右盘复算与实测——重心全压在左。 */
const ScaleTip: React.FC<{at: number; tiltAt: number; captionAt: number}> = ({at, tiltAt, captionAt}) => {
  const tilt = useSpring('settle', {at: tiltAt, dur: DUR.f6});
  const drops = useStagger(5, {at, stride: 9, dur: DUR.f5});
  const cap = useProgress(captionAt, DUR.f5);
  const a = -tilt * 11;
  const rad = (a * Math.PI) / 180;
  const endX = (sx: number) => 650 + (sx - 650) * Math.cos(rad);
  const endY = (sx: number) => 160 + (sx - 650) * Math.sin(rad);
  const pan = (sx: number) => ({x: endX(sx), y: endY(sx)});
  const L = pan(190);
  const R = pan(1110);
  const bowl = (p: {x: number; y: number}, w: number) => `M ${p.x - w} ${p.y + 96} Q ${p.x} ${p.y + 96 + 40} ${p.x + w} ${p.y + 96}`;
  const chip = (
    key: string,
    p: {x: number; y: number},
    dx: number,
    dy: number,
    w: number,
    text: string,
    color: string,
    drop: number,
    fs = 27,
  ) => (
    <g key={key} opacity={drop} transform={`translate(0, ${(1 - drop) * -46})`}>
      <rect x={p.x + dx - w / 2} y={p.y + 96 - 58 + dy} width={w} height={48} rx={8} fill={theme.panel} stroke={color} strokeWidth={2.5} />
      <text x={p.x + dx} y={p.y + 96 - 25 + dy} textAnchor="middle" fontFamily={theme.mono} fontSize={fs} fill={color}>
        {text}
      </text>
    </g>
  );
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
      <svg width={1300} height={560} viewBox="0 0 1300 560">
        {/* 支柱与底座 */}
        <rect x={644} y={160} width={12} height={330} fill={theme.panelBorder} />
        <rect x={560} y={486} width={180} height={14} rx={7} fill={theme.panelBorder} />
        {/* 横梁（绕支点倾转） */}
        <g transform={`rotate(${a} 650 160)`}>
          <rect x={190} y={152} width={920} height={15} rx={7} fill={theme.panelBorder} />
        </g>
        <circle cx={650} cy={160} r={13} fill={theme.text} />
        {/* 左盘：官方头条 */}
        <line x1={L.x} y1={L.y} x2={L.x - 150} y2={L.y + 96} stroke={theme.dim} strokeWidth={2} strokeOpacity={0.55} />
        <line x1={L.x} y1={L.y} x2={L.x + 150} y2={L.y + 96} stroke={theme.dim} strokeWidth={2} strokeOpacity={0.55} />
        {chip('l1', L, 0, -56, 170, '快 193.6×', theme.danger, drops[0])}
        {chip('l2', L, 0, 0, 190, '省 444.6×', theme.danger, drops[1])}
        <path d={bowl(L, 150)} fill={theme.panel} stroke={theme.danger} strokeWidth={3} />
        <text x={L.x} y={L.y + 150} textAnchor="middle" fontFamily={theme.mono} fontSize={17} fill={theme.danger}>
          官方首页头条
        </text>
        {/* 右盘：复算与实测 */}
        <line x1={R.x} y1={R.y} x2={R.x - 150} y2={R.y + 96} stroke={theme.dim} strokeWidth={2} strokeOpacity={0.55} />
        <line x1={R.x} y1={R.y} x2={R.x + 150} y2={R.y + 96} stroke={theme.dim} strokeWidth={2} strokeOpacity={0.55} />
        {chip('r1', R, -55, 0, 92, '75×', theme.dim, drops[2], 24)}
        {chip('r2', R, 55, 0, 100, '171×', theme.dim, drops[3], 24)}
        {chip('r3', R, 0, -56, 110, '1.2×', theme.dim, drops[4], 24)}
        <path d={bowl(R, 150)} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={3} />
        <text x={R.x} y={R.y + 150} textAnchor="middle" fontFamily={theme.mono} fontSize={17} fill={theme.dim}>
          {'自家演示复算 75×/171× · 第三方中位 1.2×'}
        </text>
      </svg>
      <div style={{fontFamily: theme.serif, fontSize: 27, color: theme.text, opacity: cap}}>
        {'三个口径 · 并列不裁决'}
      </div>
    </div>
  );
};

/** 5-C 校准外推：外文面单自信盖章，账本对不上；对冲三卡与归零账单。 */
const ForeignLedger: React.FC<{
  sheetAt: number;
  stampAt: number;
  ledgerAt: number;
  crackAt: number;
  hedgeAt: number;
  zeroAt: number;
}> = ({sheetAt, stampAt, ledgerAt, crackAt, hedgeAt, zeroAt}) => {
  const sheet = useProgress(sheetAt, DUR.f5);
  const stampIn = useProgress(stampAt, DUR.f4);
  const slam = useImpulse({at: stampAt + DUR.f4, dur: DUR.f5, peak: 1});
  const ledger = useProgress(ledgerAt, DUR.f5);
  const crack = useDraw(crackAt, DUR.f5);
  const hedges = useStagger(3, {at: hedgeAt, stride: 9, dur: DUR.f5});
  const zero = useProgress(zeroAt, DUR.f5);
  const cards = [
    {t: '重新对账', s: '拿自家数据，老老实实对一次'},
    {t: '保守阈值', s: '门槛放高，宁可惜升，不可错放'},
    {t: '升级通道', s: '永远给人留一条路'},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 34, alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 56}}>
        {/* 外文面单 */}
        <div
          style={{
            position: 'relative',
            width: 640,
            height: 320,
            borderRadius: 12,
            border: `2.5px solid ${theme.panelBorder}`,
            background: theme.panel,
            padding: '22px 28px',
            opacity: sheet,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: theme.mono,
              fontSize: 17,
              color: theme.dim,
              borderBottom: `1.5px dashed ${theme.panelBorder}`,
              paddingBottom: 8,
            }}
          >
            <span>FOREIGN ROUTE SLIP · NO. 0117</span>
            <span>PRIORITY</span>
          </div>
          <div style={{marginTop: 14, fontFamily: theme.mono, fontSize: 19, lineHeight: 1.9, color: theme.text, whiteSpace: 'pre'}}>
            {'Customer states: this is NOT a refund\nor billing problem — login page\nreturns error 500 on every attempt.'}
          </div>
          <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>
            老分拣员扫一眼 · 照旧自信盖章
          </div>
          <div
            style={{
              position: 'absolute',
              right: 34,
              bottom: 30,
              padding: '10px 22px',
              borderRadius: 10,
              border: `3px solid ${theme.danger}`,
              fontFamily: theme.serif,
              fontSize: 30,
              color: theme.danger,
              letterSpacing: 4,
              opacity: stampIn,
              transform: `rotate(-11deg) scale(${1.7 - 0.7 * stampIn + slam * 0.06})`,
            }}
          >
            {'九成把握'}
          </div>
        </div>
        {/* 对账账本 */}
        <div
          style={{
            position: 'relative',
            width: 560,
            height: 320,
            borderRadius: 12,
            border: `2.5px solid ${theme.panelBorder}`,
            background: theme.panel,
            padding: '22px 28px',
            opacity: ledger,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.text}}>
            {'对账账本 · 换一批外文面单'}
          </div>
          <div style={{marginTop: 18, display: 'flex', justifyContent: 'space-between', fontFamily: theme.sans, fontSize: 21}}>
            <span style={{color: theme.dim}}>自称把握</span>
            <span style={{fontFamily: theme.mono, color: theme.text}}>90%</span>
          </div>
          <div style={{marginTop: 14, display: 'flex', justifyContent: 'space-between', fontFamily: theme.sans, fontSize: 21}}>
            <span style={{color: theme.dim}}>实际投对</span>
            <span style={{fontFamily: theme.mono, color: theme.danger}}>{'？ 新分布没有标准答案'}</span>
          </div>
          <div style={{marginTop: 22, fontFamily: theme.mono, fontSize: 17, color: theme.dim, lineHeight: 1.8}}>
            {'公开基准成绩好，还有个隐患：\n这些题可能本来就在训练分布里。\n校准没法验证——本质难题，不是偷懒。'}
          </div>
          <svg style={{position: 'absolute', inset: 0}} width="100%" height="100%" viewBox="0 0 560 320" pointerEvents="none">
            <polyline
              points="470,20 380,110 460,190 360,300"
              fill="none"
              stroke={theme.danger}
              strokeWidth={3.5}
              opacity={0.85}
              {...crack}
            />
          </svg>
        </div>
      </div>
      {/* 对冲三卡 */}
      <div style={{display: 'flex', gap: 26}}>
        {cards.map((c, i) => (
          <div
            key={c.t}
            style={{
              width: 386,
              padding: '16px 22px',
              borderRadius: 10,
              border: `2px solid ${i === 1 ? theme.danger : theme.panelBorder}`,
              background: theme.panel,
              opacity: hedges[i],
              transform: `translateY(${(1 - hedges[i]) * 24}px)`,
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.danger}}>{String(i + 1).padStart(2, '0')}</div>
            <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.text, marginTop: 4}}>{c.t}</div>
            <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 4}}>{c.s}</div>
          </div>
        ))}
      </div>
      {/* 直投归零账单 */}
      <div
        style={{
          width: 1240,
          padding: '12px 26px',
          borderRadius: 10,
          border: `2px dashed ${theme.danger}88`,
          background: `${theme.danger}0D`,
          display: 'flex',
          alignItems: 'center',
          gap: 26,
          opacity: zero,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.danger}}>直投 0%</span>
        <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>全部流量 → 复核 + 人工</span>
        <span style={{marginLeft: 'auto', fontFamily: theme.serif, fontSize: 22, color: theme.text}}>
          {'诚实，是有账单的'}
        </span>
      </div>
    </div>
  );
};

export const P5Debate: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p5-01', 'p5-08');
  const bB = w('p5-09', 'p5-14');
  const bC = w('p5-15', 'p5-21');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A 分类器之争">
        <SceneTag chapter="P5" tagline="三方争议" accent={theme.danger} />
        <Stage>
          <div style={{display: 'flex', flexDirection: 'column', gap: 64, alignItems: 'center'}}>
            <FlipScore at={at('p5-04') - bA.from} flipAt={at('p5-05') - bA.from} />
            <SpectrumSlider at={at('p5-07') - bA.from} pushAt={at('p5-08') - bA.from} />
          </div>
        </Stage>
        <Footnote delay={40}>
          {'微调 0.766 vs 0.727（据称）· 反向基准 0.425 vs 0.870 —— 开源复刻自报 / 第三方发布'}
        </Footnote>
      </Sequence>

      <Sequence {...bB} name="5-B 自报基准">
        <SceneTag chapter="P5" tagline="三方争议" accent={theme.danger} />
        <ArchifyYield
          cues={[
            {at: at('p5-10') - bB.from, durationInFrames: dur('p5-10')},
            {at: at('p5-13') - bB.from, durationInFrames: dur('p5-13')},
          ]}
        >
          <ScaleTip at={at('p5-10') - bB.from} tiltAt={at('p5-11') - bB.from} captionAt={at('p5-14') - bB.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="benchmark-audit"
          caption="倍数天平 · 考核卷构成"
          cues={[
            {chapterId: 'ba-scales', at: at('p5-10') - bB.from, durationInFrames: dur('p5-10')},
            {chapterId: 'ba-pipeline', at: at('p5-13') - bB.from, durationInFrames: dur('p5-13')},
          ]}
        />
        <Footnote delay={40}>
          {'考核卷：自己出题 · 标准答案 = 两个大模型平均 · 对手按自家流程答题'}
        </Footnote>
      </Sequence>

      <Sequence {...bC} name="5-C 校准外推">
        <SceneTag chapter="P5" tagline="三方争议" accent={theme.danger} />
        <Stage>
          <ForeignLedger
            sheetAt={at('p5-15') - bC.from}
            stampAt={at('p5-16') - bC.from}
            ledgerAt={at('p5-17') - bC.from}
            crackAt={at('p5-18') - bC.from}
            hedgeAt={at('p5-19') - bC.from}
            zeroAt={at('p5-20') - bC.from}
          />
        </Stage>
        <EvidenceBadge text="简化原型" at={at('p5-20') - bC.from} />
        <Footnote delay={40}>{'分布外重新校准 → 直投归零（简化原型实测）'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};
