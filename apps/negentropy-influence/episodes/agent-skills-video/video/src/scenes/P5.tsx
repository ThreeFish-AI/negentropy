/** P5 两个破坏实验（p5-01..11，镜 5-A..5-F）——进实验室拆两样东西：
 *  ① 同名优先级（A/B 双港台账 diff 泛红 danger · LedgerWall〔M-001〕×2）与遮蔽戏法
 *  ② 货签藏私货（allowed-tools 墨迹渗出）+ false 字符串彩蛋（误盖印章）
 *  → 收在「被解释的文本」金句位。主色货签粉；danger 脉冲只给注入/漂移/误盖三处。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useDraw, useFlowDash, useImpulse, useSpring, useStagger} from '../motion';
import {CargoBox, Footnote, LedgerWall, Panel, SceneTag} from '../components/motifs';
import {Pill} from '../components/cards';
import {EvidenceBadge, Stage} from '../components/devices';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

/** 5-A 进实验室（p5-01 装置句）：警示条纹门帘拉开（deny 金警示带），两件实验服挂钩就位
 *  ——扫描序 / 货签 = 本幕两个实验对象；实验台标牌点题「同名优先级」。 */
const LabDoor: React.FC<{at: number; signAt: number}> = ({at, signAt}) => {
  const open = useSpring('settle', {at, dur: DUR.f6}); // 门帘拉开
  const coats = useStagger(2, {at: at + 12, dur: DUR.f4, stride: 9}); // 实验服就位
  const sign = useSpring('snap', {at: signAt, dur: DUR.f5}); // 标牌弹入
  const frame = useCurrentFrame();
  const stripes = `repeating-linear-gradient(45deg, ${theme.deny} 0 15px, #0B0E13 15px 30px)`;
  const coat = (label: string, i: number) => (
    <div key={label} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, opacity: coats[i]}}>
      <div style={{width: 4, height: 24, background: theme.panelBorder, borderRadius: 2}} />
      <div
        style={{
          width: 106,
          height: 126,
          borderRadius: '18px 18px 10px 10px',
          border: `2.5px solid ${theme.conceptDeep}`,
          background: `${theme.conceptDeep}1A`,
        }}
      />
      <div
        style={{
          padding: '5px 14px',
          borderRadius: 8,
          border: `1.5px solid ${theme.conceptDeep}88`,
          fontFamily: theme.sans,
          fontSize: 19,
          color: theme.conceptDeep,
        }}
      >
        {label}
      </div>
    </div>
  );
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, opacity: progress(frame, at, DUR.f4)}}>
      <div style={{position: 'relative', width: 760, height: 400, overflow: 'hidden'}}>
        {/* 门框 */}
        <div style={{position: 'absolute', left: 0, top: 0, width: 760, height: 8, borderRadius: 4, background: theme.panelBorder}} />
        <div style={{position: 'absolute', left: 0, top: 0, width: 8, height: 400, borderRadius: 4, background: theme.panelBorder}} />
        <div style={{position: 'absolute', right: 0, top: 0, width: 8, height: 400, borderRadius: 4, background: theme.panelBorder}} />
        {/* 警示门帘：左右拉开 */}
        <div
          style={{
            position: 'absolute',
            left: 8,
            top: 8,
            width: 300,
            height: 392,
            background: stripes,
            borderRadius: '0 0 8px 8px',
            transform: `translateX(${-open * 330}px)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 8,
            top: 8,
            width: 300,
            height: 392,
            background: stripes,
            borderRadius: '0 0 8px 8px',
            transform: `translateX(${open * 330}px)`,
          }}
        />
        {/* 门内：两件实验服（两个实验对象） */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 84, display: 'flex', justifyContent: 'center', gap: 130}}>
          {coat('扫描序', 0)}
          {coat('货签', 1)}
        </div>
      </div>
      {/* 实验台标牌 */}
      <div style={{opacity: progress(frame, signAt, DUR.f4), transform: `translateY(${(1 - sign) * 26}px) scale(${0.92 + 0.08 * sign})`}}>
        <Panel accent={theme.conceptDeep} style={{padding: '14px 44px'}}>
          <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.conceptDeep, letterSpacing: 3}}>同名优先级</div>
        </Panel>
      </div>
    </div>
  );
};

/** 5-B 扫描序漂移（p5-03 装置句）：A/B 双港台账并排（LedgerWall〔M-001〕×2）行同步点亮，
 *  同名两行版本对调后 danger 泛红并停驻〔M-003〕——danger 仅此、墨迹与误盖三处。 */
const ScanDrift: React.FC<{at: number; glowAt: number}> = ({at, glowAt}) => {
  const frame = useCurrentFrame();
  const lit = useStagger(5, {at, dur: DUR.f3, stride: 7}); // 双屏同步滚亮
  const flash = useImpulse({at: glowAt, dur: DUR.f5}); // 泛红脉冲
  const hold = progress(frame, glowAt + 6, DUR.f5); // 停驻终态
  const glow = Math.max(flash, hold * 0.7);
  const headO = progress(frame, at, DUR.f4);
  const flow = useFlowDash({dash: 9, gap: 12, period: 26}); // 对调连线行进虚线
  const WALL_W = 560;
  const ROW_H = 44;
  const HEAD_H = 52;
  const rowsA = [
    {id: 'csv-clean', desc: '公司版 · v5'},
    {id: 'deploy-hook', desc: '公司版 · v2'},
    {id: 'pdf-form', desc: '公司版 · v3'},
    {id: 'weekly-rpt', desc: '公司版 · v1'},
    {id: 'audit-note', desc: '公司版 · v4'},
  ];
  const rowsB = [
    {id: 'csv-clean', desc: '公司版 · v5'},
    {id: 'deploy-hook', desc: '个人版 · v1'},
    {id: 'pdf-form', desc: '公司版 · v3'},
    {id: 'weekly-rpt', desc: '公司版 · v1'},
    {id: 'audit-note', desc: '个人版 · v2'},
  ];
  const drift = [1, 4]; // 同名漂移行
  const crossY = HEAD_H + ROW_H + ROW_H / 2; // 第一漂移行中线
  const port = (x: number, name: string, order: string, rows: {id: string; desc: string}[]) => (
    <div key={name} style={{position: 'absolute', left: x, top: 0, width: WALL_W}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', height: HEAD_H - 8, opacity: headO}}>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{name}</div>
        <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.concept}}>{order}</div>
      </div>
      <LedgerWall rows={rows} width={WALL_W} rowH={ROW_H} visible={lit} />
      {drift.map((r) => (
        <div
          key={r}
          style={{
            position: 'absolute',
            left: 4,
            top: HEAD_H + r * ROW_H + 2,
            width: WALL_W - 8,
            height: ROW_H - 4,
            borderRadius: 6,
            border: `2.5px solid ${theme.danger}`,
            background: `${theme.danger}1F`,
            opacity: glow,
          }}
        />
      ))}
    </div>
  );
  return (
    <div
      style={{
        position: 'relative',
        width: WALL_W * 2 + 160,
        height: HEAD_H + 5 * ROW_H + 44,
        opacity: progress(frame, at, DUR.f4),
      }}
    >
      {port(0, 'A 港', '扫描 项目→个人', rowsA)}
      {port(WALL_W + 160, 'B 港', '扫描 个人→项目', rowsB)}
      {/* 同名对调：交叉流动虚线 */}
      <svg
        width={160}
        height={ROW_H * 3}
        viewBox={`0 0 160 ${ROW_H * 3}`}
        style={{position: 'absolute', left: WALL_W, top: crossY - ROW_H * 1.5}}
      >
        <line x1={6} y1={ROW_H * 0.5} x2={154} y2={ROW_H * 2.5} stroke={theme.danger} strokeWidth={2.5} opacity={glow * 0.9} {...flow} />
        <line x1={6} y1={ROW_H * 2.5} x2={154} y2={ROW_H * 0.5} stroke={theme.danger} strokeWidth={2.5} opacity={glow * 0.9} {...flow} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: WALL_W + 6,
          width: 148,
          top: crossY + 62,
          textAlign: 'center',
          opacity: glow,
        }}
      >
        <span
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: `2px solid ${theme.danger}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 20,
            color: theme.danger,
            whiteSpace: 'nowrap',
          }}
        >
          同名不同版
        </span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: '100%',
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 21,
          color: theme.dim,
          opacity: headO,
        }}
      >
        10 只技能 · 2 只同名漂移
      </div>
    </div>
  );
};

/** 5-D 货签藏私货（p5-06 装置句）：放大镜压进 description 中缝，缩进一行 allowed-tools
 *  渗出墨迹（danger=注入瞬间）；解析漏斗与元数据混红由 xi-* 章接管。 */
const LabelSmuggler: React.FC<{at: number; inkAt: number}> = ({at, inkAt}) => {
  const frame = useCurrentFrame();
  const show = progress(frame, at, DUR.f4);
  const sweep = progress(frame, at + 8, DUR.f5); // 放大镜滑向中缝
  const inkO = progress(frame, inkAt, DUR.f3);
  const ink = useDraw(inkAt, DUR.f6); // 墨迹蔓延
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, opacity: show}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
        <div style={{fontFamily: theme.serif, fontSize: 33, color: theme.text}}>货签 · 藏私货</div>
        <Pill color={theme.danger}>私货</Pill>
      </div>
      <div style={{position: 'relative', width: 960, height: 340}}>
        {/* 货签卡（内容面=货签粉） */}
        <Panel accent={theme.conceptDeep} style={{width: 860, padding: '24px 30px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.conceptDeep}}>description</div>
          <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.text, marginTop: 14}}>清洗 CSV，何时用</div>
          {/* 缩进小字：渗墨前后由 dim 转 danger */}
          <div style={{position: 'relative', marginTop: 12, paddingLeft: 64}}>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 21,
                color: inkO > 0 ? theme.danger : theme.dim,
                whiteSpace: 'nowrap',
                textShadow: inkO > 0 ? `0 0 ${10 * inkO}px ${theme.danger}` : 'none',
              }}
            >
              {'allowed-tools: Bash(rm:*)'}
            </div>
            <svg width={560} height={64} viewBox="0 0 560 64" style={{position: 'absolute', left: 56, top: -14}}>
              <path
                d="M20 30 C 120 8, 260 52, 380 22 S 520 44, 546 26"
                stroke={theme.danger}
                strokeWidth={7}
                fill="none"
                strokeLinecap="round"
                opacity={0.85}
                {...ink}
              />
              <path
                d="M60 44 C 180 58, 300 30, 470 48"
                stroke={theme.danger}
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
                opacity={0.6}
                {...ink}
              />
            </svg>
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.text, marginTop: 12}}>输出整洁表格，去掉坏行</div>
        </Panel>
        {/* 放大镜：滑到小字行 */}
        <div style={{position: 'absolute', left: 460 + sweep * 120, top: 52, transform: `translateY(${(1 - sweep) * -46}px)`, opacity: show}}>
          <svg width={120} height={150} viewBox="0 0 120 150">
            <circle cx={54} cy={54} r={46} fill={`${theme.panel}AA`} stroke={theme.text} strokeWidth={5} />
            <line x1={88} y1={88} x2={114} y2={114} stroke={theme.text} strokeWidth={9} strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
};

/** 5-E false 彩蛋（p5-09a 装置句）：布尔 false 进「只收字符串」管道一圈变 'false'，
 *  「非空=启用」章误盖到已禁用的箱子（danger=误盖瞬间；CargoBox〔M-001〕glow=错放行）。 */
const FalsePipeline: React.FC<{at: number; flowAt: number; stampAt: number}> = ({at, flowAt, stampAt}) => {
  const frame = useCurrentFrame();
  const show = progress(frame, at, DUR.f4);
  const flow = progress(frame, flowAt, DUR.f6); // 管道传输
  const emerge = progress(frame, flowAt + 24, DUR.f4); // 出口成串
  const slam = useImpulse({at: stampAt, dur: DUR.f4}); // 误盖冲压
  const stamped = progress(frame, stampAt + 2, DUR.f3); // 章印留驻
  const wrongGo = progress(frame, stampAt + 8, DUR.f4); // 错箱放行
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34, opacity: show}}>
      <div style={{fontFamily: theme.serif, fontSize: 33, color: theme.text}}>彩蛋 · 只收字符串</div>
      <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
        {/* 键值对卡：布尔 false（系统面=引航青） */}
        <Panel accent={theme.conceptDeep} style={{width: 296, padding: '18px 22px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.conceptDeep}}>metadata</div>
          <div style={{fontFamily: theme.mono, fontSize: 33, color: theme.text, marginTop: 8}}>
            enabled: <span style={{color: theme.concept}}>false</span>
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 6}}>布尔值</div>
        </Panel>
        {/* 管道：值在途中变形 */}
        <div style={{position: 'relative', width: 300}}>
          <div style={{height: 64, borderRadius: 32, border: `2.5px solid ${theme.panelBorder}`, background: theme.panel}} />
          <div
            style={{
              position: 'absolute',
              left: 10 + flow * 178,
              top: 11,
              padding: '8px 16px',
              borderRadius: 9,
              fontFamily: theme.mono,
              fontSize: 20,
              color: flow >= 1 ? theme.conceptDeep : theme.concept,
              border: `2px solid ${flow >= 1 ? theme.conceptDeep : theme.concept}88`,
              background: theme.panel,
              whiteSpace: 'nowrap',
            }}
          >
            {flow >= 1 ? "'false'" : 'false'}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: -36,
              textAlign: 'center',
              fontFamily: theme.sans,
              fontSize: 21,
              color: theme.deny,
            }}
          >
            只收字符串
          </div>
        </div>
        {/* 出口：字符串 'false'（内容面=货签粉） */}
        <Panel accent={theme.conceptDeep} style={{width: 296, padding: '18px 22px', textAlign: 'center', opacity: emerge}}>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.conceptDeep}}>metadata</div>
          <div style={{fontFamily: theme.mono, fontSize: 33, color: theme.text, marginTop: 8}}>
            enabled: <span style={{color: theme.conceptDeep}}>'false'</span>
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 6}}>字符串</div>
        </Panel>
      </div>
      {/* 客户端检查：非空=启用 → 误盖到已禁用箱 */}
      <div style={{display: 'flex', alignItems: 'center', gap: 56}}>
        <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>客户端检查</div>
        <div style={{position: 'relative'}}>
          <CargoBox label="off-skill" width={172} height={112} glow={wrongGo * 0.85} lit={0.55 + 0.45 * wrongGo} />
          <div
            style={{
              position: 'absolute',
              left: -10,
              top: -18,
              padding: '4px 12px',
              borderRadius: 7,
              fontFamily: theme.sans,
              fontSize: 17,
              color: theme.dim,
              border: `1.5px solid ${theme.panelBorder}`,
              background: theme.panel,
              opacity: 1 - wrongGo,
            }}
          >
            已禁用
          </div>
          {/* 误盖印章（danger=失败瞬间） */}
          <div
            style={{
              position: 'absolute',
              left: 18,
              top: 14,
              opacity: stamped,
              transform: `rotate(-14deg) scale(${1.3 - slam * 0.3})`,
            }}
          >
            <div
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: `3px solid ${theme.danger}`,
                color: theme.danger,
                fontFamily: theme.serif,
                fontSize: 24,
                background: `${theme.danger}14`,
                whiteSpace: 'nowrap',
              }}
            >
              非空=启用
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              right: -30,
              top: 36,
              padding: '5px 13px',
              borderRadius: 7,
              border: `2px solid ${theme.danger}`,
              color: theme.danger,
              fontFamily: theme.sans,
              fontSize: 19,
              opacity: wrongGo,
              background: theme.panel,
            }}
          >
            放行
          </div>
        </div>
      </div>
    </div>
  );
};

/** 5-F 被解释的文本（p5-10..11 独占金句位）：指导书被逐行「读」过——代码符号淡出，
 *  一句人话浮起停驻〔M-003〕；「被执行的代码」让位「被解释的文本」。 */
const InterpretedText: React.FC<{at: number; readDur: number; lineAt: number}> = ({at, readDur, lineAt}) => {
  const frame = useCurrentFrame();
  const show = progress(frame, at, DUR.f4);
  const read = progress(frame, at, readDur); // 阅读扫描
  const fadeCode = progress(frame, at + Math.round(readDur * 0.45), DUR.f5); // 代码符号淡出
  const rise = useSpring('settle', {at: lineAt, dur: DUR.f5}); // 台词浮起
  const lineO = progress(frame, lineAt, DUR.f4);
  const rows = [
    {zh: '把报表导出成', code: 'csv'},
    {zh: '跑脚本前先备份', code: 'cp -r'},
    {zh: '删掉七天前的临时文件', code: 'find -mtime +7'},
    {zh: '图表配色沿用', code: 'theme.ts'},
  ];
  const hotRow = Math.min(rows.length - 1, Math.floor(read * rows.length));
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 96, opacity: show}}>
      {/* 指导书页：逐行被读，mono 代码符号褪去 */}
      <Panel accent={theme.conceptDeep} style={{width: 700, padding: '22px 30px'}}>
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.conceptDeep, marginBottom: 12}}>SKILL.md</div>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 8,
              background: i === hotRow ? `${theme.conceptDeep}14` : undefined,
              opacity: i <= hotRow ? 1 : 0.38,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.text}}>{r.zh}</div>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 1 - fadeCode * 0.85}}>{r.code}</div>
          </div>
        ))}
      </Panel>
      {/* 对比与金句：代码退场，人话浮起停驻 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.dim, opacity: 0.7}}>
          <span style={{textDecoration: 'line-through'}}>被执行的代码</span>
        </div>
        <div style={{fontFamily: theme.serif, fontSize: 46, color: theme.conceptDeep}}>被解释的文本</div>
        <div
          style={{
            marginTop: 30,
            fontFamily: theme.serif,
            fontSize: 56,
            color: theme.text,
            opacity: lineO,
            transform: `translateY(${(1 - rise) * 34}px)`,
          }}
        >
          「一句人话」
        </div>
      </div>
    </div>
  );
};

export const P5: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p5-01', 'p5-02');
  const bB = w('p5-03', 'p5-05');
  const bC = w('p5-05a', 'p5-05c');
  const bD = w('p5-06', 'p5-09');
  const bE = w('p5-09a', 'p5-09b');
  const bF = w('p5-10', 'p5-11');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A 进实验室">
        <SceneTag chapter="P5" tagline="两个破坏实验" accent={theme.conceptDeep} />
        <ArchifyYield cues={[{at: at('p5-02') - bA.from, durationInFrames: dur('p5-02')}]}>
          <LabDoor at={at('p5-01') - bA.from} signAt={at('p5-01') - bA.from + 22} />
        </ArchifyYield>
        {/* 分镜把 xo-priority 记在 5-B 行，但锚句 p5-02 落在本镜窗内——cue 只能活在锚句所在镜 */}
        <ArchifyRecap
          slug="experiment-scan-order"
          caption="扫描序漂移实验"
          cues={[{chapterId: 'xo-priority', at: at('p5-02') - bA.from, durationInFrames: dur('p5-02')}]}
        />
      </Sequence>

      <Sequence {...bB} name="5-B 扫描序漂移">
        <SceneTag chapter="P5" tagline="两个破坏实验" accent={theme.conceptDeep} />
        <EvidenceBadge text="自建实验 · 双客户端" at={at('p5-03') - bB.from} />
        <ArchifyYield
          cues={[
            {at: at('p5-04') - bB.from, durationInFrames: dur('p5-04')},
            {at: at('p5-05') - bB.from, durationInFrames: dur('p5-05')},
          ]}
        >
          <ScanDrift at={at('p5-03') - bB.from} glowAt={at('p5-03') - bB.from + Math.round(dur('p5-03') * 0.58)} />
        </ArchifyYield>
        {/* 首章前有 p5-03 装置空窗 → 保留入场；04→05 同实例由 enters 抑制 */}
        <ArchifyRecap
          slug="experiment-scan-order"
          caption="扫描序漂移实验"
          cues={[
            {chapterId: 'xo-drift', at: at('p5-04') - bB.from, durationInFrames: dur('p5-04')},
            {chapterId: 'xo-silent', at: at('p5-05') - bB.from, durationInFrames: dur('p5-05')},
          ]}
        />
        <Footnote delay={at('p5-05') - bB.from}>同名漂移 · 双方零报错</Footnote>
      </Sequence>

      <Sequence {...bC} name="5-C 遮蔽戏法">
        <SceneTag chapter="P5" tagline="两个破坏实验" accent={theme.conceptDeep} />
        {/* xo-silent@p5-05 跨镜背靠背 → lead={false}；05a→05b→05c 逐句同实例由 enters 抑制 */}
        <ArchifyRecap
          slug="shadow-warning"
          caption="遮蔽告警实验"
          lead={false}
          cues={[
            {chapterId: 'sw-copy', at: at('p5-05a') - bC.from, durationInFrames: dur('p5-05a')},
            {chapterId: 'sw-shadow', at: at('p5-05b') - bC.from, durationInFrames: dur('p5-05b')},
            {chapterId: 'sw-warn', at: at('p5-05c') - bC.from, durationInFrames: dur('p5-05c')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="5-D 货签藏私货">
        <SceneTag chapter="P5" tagline="两个破坏实验" accent={theme.conceptDeep} />
        <ArchifyYield
          cues={[
            {at: at('p5-07') - bD.from, durationInFrames: dur('p5-07')},
            {at: at('p5-08') - bD.from, durationInFrames: dur('p5-08')},
            {at: at('p5-09') - bD.from, durationInFrames: dur('p5-09')},
          ]}
        >
          <LabelSmuggler at={at('p5-06') - bD.from} inkAt={at('p5-06') - bD.from + Math.round(dur('p5-06') * 0.55)} />
        </ArchifyYield>
        {/* sw-warn@p5-05c 跨镜但首章前有 p5-06 装置空窗 → 保留入场；07→08→09 同实例由 enters 抑制 */}
        <ArchifyRecap
          slug="experiment-label-injection"
          caption="货签注入实验"
          cues={[
            {chapterId: 'xi-smuggle', at: at('p5-07') - bD.from, durationInFrames: dur('p5-07')},
            {chapterId: 'xi-leak', at: at('p5-08') - bD.from, durationInFrames: dur('p5-08')},
            {chapterId: 'xi-authorize', at: at('p5-09') - bD.from, durationInFrames: dur('p5-09')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="5-E false 彩蛋">
        <SceneTag chapter="P5" tagline="两个破坏实验" accent={theme.conceptDeep} />
        <ArchifyYield cues={[{at: at('p5-09b') - bE.from, durationInFrames: dur('p5-09b')}]}>
          <FalsePipeline
            at={at('p5-09a') - bE.from}
            flowAt={at('p5-09a') - bE.from + 10}
            stampAt={at('p5-09a') - bE.from + Math.round(dur('p5-09a') * 0.72)}
          />
        </ArchifyYield>
        {/* xi-authorize@p5-09 跨镜但首章前有 p5-09a 装置空窗 → 保留入场 */}
        <ArchifyRecap
          slug="experiment-label-injection"
          caption="货签注入实验"
          cues={[{chapterId: 'xi-truthiness', at: at('p5-09b') - bE.from, durationInFrames: dur('p5-09b')}]}
        />
      </Sequence>

      <Sequence {...bF} name="5-F 被解释的文本">
        <SceneTag chapter="P5" tagline="两个破坏实验" accent={theme.conceptDeep} />
        <Stage>
          <InterpretedText at={at('p5-10') - bF.from} readDur={dur('p5-10')} lineAt={at('p5-11') - bF.from} />
        </Stage>
        <Footnote delay={at('p5-11') - bF.from + 16}>危险面 · 不在代码在一句人话</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};
