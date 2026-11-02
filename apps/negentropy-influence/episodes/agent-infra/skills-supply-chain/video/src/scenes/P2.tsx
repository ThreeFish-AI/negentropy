/** P2 三层信任栈（p2-01..p2-12）——评论区码垛出三层栈（p2-01 楼层 useStagger、
 *  p2-06a 见证台账签名 useImpulse）→ sigstore 逐层对位（p2-08a 动机同构、
 *  p2-08b 量产版两章已随 Stage ④ 修正补入）→ 强制力缺口（p2-11 空置中心仓
 *  虚线框 useDraw）。主色检疫绿（见证/验证面）；悬案/空置走警示金；
 *  海关/闸门面只在对照组（npm 保税仓）出现。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useDraw, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {EvidenceBadge} from '../components/devices';
import {Footnote, LedgerWall, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

// ── 2-A① p2-01 装置：评论楼层码垛 ───────────────────────────────────────────

/** 楼层卡（头像 + 灰字条 + 议题签）：词面是港口楼层台账，不复述口播。 */
const FLOORS: {bars: number[]; chip?: string}[] = [
  {bars: [0.82]},
  {bars: [0.66, 0.5], chip: '签章'},
  {bars: [0.74]},
  {bars: [0.58, 0.44]},
  {bars: [0.8], chip: '摘要'},
  {bars: [0.62, 0.48]},
  {bars: [0.76]},
  {bars: [0.7], chip: '见证'},
];

/** 规范册 vs #254 评论区：战场不在左边的册子里——册子被压暗，楼层向右码高。 */
const CommentStack: React.FC<{dimAt: number; floorsAt: number; floorsWin: number; stallAt: number}> = ({
  dimAt,
  floorsAt,
  floorsWin,
  stallAt,
}) => {
  const dim = useProgress(dimAt, DUR.f5, 'accelerate');
  const st = useStagger(FLOORS.length, {at: floorsAt, dur: DUR.f4, fit: {total: Math.max(60, floorsWin)}});
  const frame = useCurrentFrame();
  const stall = progress(frame, stallAt, DUR.f4);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 72}}>
      {/* 规范册：静（M-003 持续态）——满行文字但被压暗，只读出「安静」 */}
      <div style={{opacity: dim, transform: `translateY(${(dim - 1) * 10}px)`}}>
        <Panel style={{width: 340, padding: '22px 24px 26px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>规范</div>
            <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>247 行</div>
          </div>
          {[0.94, 0.88, 0.91, 0.85, 0.9, 0.8, 0.87, 0.76, 0.9, 0.66].map((wd, i) => (
            <div key={i} style={{height: 6, borderRadius: 3, background: `${theme.dim}55`, width: `${wd * 100}%`, marginTop: 12}} />
          ))}
        </Panel>
      </div>
      {/* #254 评论区：热——楼层自下而上码垛（评论楼层码垛 useStagger） */}
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}>
        <div style={{fontFamily: theme.sans, fontSize: 32, color: theme.text, letterSpacing: 6}}>主战场</div>
        <Panel accent={`${theme.concept}77`} style={{width: 640, padding: '14px 20px 18px', position: 'relative'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10}}>
            <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.concept}}>#254 评论区</div>
            {/* 停摆签：警示金（悬案/冻结面），随 stallAt 压上后停驻 */}
            <div
              style={{
                padding: '3px 12px',
                borderRadius: 6,
                border: `2px solid ${theme.deny}`,
                fontFamily: theme.mono,
                fontSize: 16,
                color: theme.deny,
                opacity: stall,
                transform: `rotate(${(1 - stall) * -14}deg)`,
              }}
            >
              停摆
            </div>
          </div>
          {FLOORS.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                height: 46,
                borderTop: i === 0 ? `1px solid ${theme.concept}44` : undefined,
                borderBottom: `1px solid ${theme.concept}44`,
                padding: '0 8px',
                opacity: st[i],
                transform: `translateY(${(1 - st[i]) * -22}px)`,
              }}
            >
              <div style={{width: 22, height: 22, borderRadius: 11, background: `${theme.concept}2E`, border: `1.5px solid ${theme.concept}88`}} />
              {f.bars.map((wd, j) => (
                <div key={j} style={{height: 6, borderRadius: 3, background: `${theme.dim}77`, width: wd * 150}} />
              ))}
              {f.chip ? (
                <div
                  style={{
                    marginLeft: 'auto',
                    padding: '2px 10px',
                    borderRadius: 6,
                    border: `1.5px solid ${theme.conceptDeep}AA`,
                    color: theme.conceptDeep,
                    fontFamily: theme.sans,
                    fontSize: 15,
                  }}
                >
                  {f.chip}
                </div>
              ) : null}
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
};

// ── 2-A② p2-06a 装置：见证台账签名 ─────────────────────────────────────────

const LEDGER_DAYS: {id: string; desc: string}[] = [
  {id: '09-01', desc: '日度清单'},
  {id: '09-02', desc: '日度清单'},
  {id: '09-03', desc: '日度清单'},
  {id: '09-04', desc: '日度清单'},
  {id: '· · ·', desc: '逐日续签'},
];

/** 灯塔见证人 + 日度台账：行行签名盖章（stamp 辉光逐行脉冲）、时间戳锚汇入右锚点，
 *  外部复算 ✓；末行见证人自身入账（盖章辉光 useImpulse）——见证人也进了台账。 */
const WitnessLedger: React.FC<{
  rowsAt: number;
  rowsWin: number;
  chainAt: number;
  selfAt: number;
  auditAt: number;
}> = ({rowsAt, rowsWin, chainAt, selfAt, auditAt}) => {
  const st = useStagger(LEDGER_DAYS.length, {at: rowsAt, dur: DUR.f4, fit: {total: Math.max(60, rowsWin)}});
  const chain = useDraw(chainAt, DUR.f6);
  const frame = useCurrentFrame();
  const selfP = progress(frame, selfAt, DUR.f4);
  const bottom = progress(frame, selfAt + DUR.f4, DUR.f4);
  const audit = useSpring('settle', {at: auditAt, dur: DUR.f5});
  const auditO = progress(frame, auditAt, DUR.f4);
  const stampGlow = useImpulse({at: selfAt, dur: DUR.f5, peak: 1});
  const rowH = 56;
  const panelX = 430;
  const panelY = 30;
  const rowsTop = panelY + 52;
  // 锚点圆心取右侧 svg 局部坐标（svg left = panelX）：global x = panelX + 750 = 1180
  const nodeCx = 750;
  const nodeCy = 190;
  const rows = LEDGER_DAYS.concat(
    selfP > 0 ? [{id: '灯塔', desc: '见证人自身'}] : [],
  );
  return (
    <div style={{position: 'relative', width: 1500, height: 560}}>
      {/* 灯塔：常亮 + 光束（持续态），见证人自身入账时灯顶脉冲辉光 */}
      <svg width={330} height={470} style={{position: 'absolute', left: 20, top: 40}}>
        <path d="M 145 40 L 185 400 L 105 400 Z" fill={`${theme.conceptDeep}1E`} stroke={theme.conceptDeep} strokeWidth={2.5} />
        <line x1={60} y1={88} x2={112} y2={62} stroke={`${theme.conceptDeep}66`} strokeWidth={3} />
        <line x1={230} y1={88} x2={178} y2={62} stroke={`${theme.conceptDeep}66`} strokeWidth={3} />
        <line x1={60} y1={128} x2={112} y2={96} stroke={`${theme.conceptDeep}33`} strokeWidth={2} />
        <line x1={230} y1={128} x2={178} y2={96} stroke={`${theme.conceptDeep}33`} strokeWidth={2} />
        <circle
          cx={145}
          cy={40}
          r={13}
          fill={`${theme.conceptDeep}${selfP > 0 ? '55' : '33'}`}
          stroke={theme.conceptDeep}
          strokeWidth={2.5}
        />
        {selfP > 0 ? (
          <circle cx={145} cy={40} r={13 + 10 * stampGlow} fill="none" stroke={theme.conceptDeep} strokeWidth={2.5} opacity={0.85 * stampGlow} />
        ) : null}
        <text x={145} y={436} textAnchor="middle" fontFamily={theme.sans} fontSize={21} fill={theme.conceptDeep}>
          灯塔见证
        </text>
      </svg>
      {/* 见证台账：行行盖章（绿签 = 签名留痕） */}
      <Panel accent={`${theme.conceptDeep}88`} style={{position: 'absolute', left: panelX, top: panelY, width: 640, padding: '12px 16px 16px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8}}>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>见证台账</div>
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>Ed25519 签名</div>
        </div>
        <LedgerWall rows={rows} rowH={rowH} width={600} />
        {/* 盖章列：每行一枚绿章，行显中点闪一次辉光（纯函数派生） */}
        {LEDGER_DAYS.concat([{id: 'x', desc: ''}]).map((r, i) => {
          const p = i < LEDGER_DAYS.length ? st[i] : selfP;
          if (p <= 0) return null;
          const glow = Math.sin(Math.PI * Math.min(1, p * 1.6));
          const self = i === LEDGER_DAYS.length;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 520,
                top: rowsTop - panelY + i * rowH + rowH / 2 - 14,
                padding: '3px 10px',
                borderRadius: 7,
                border: `2px solid ${theme.conceptDeep}`,
                color: theme.conceptDeep,
                fontFamily: theme.mono,
                fontSize: 15,
                opacity: p,
                textShadow: self ? `0 0 ${10 * stampGlow}px ${theme.conceptDeep}` : `0 0 ${8 * glow}px ${theme.conceptDeep}`,
              }}
            >
              {self ? '已入账' : '签'}
            </div>
          );
        })}
      </Panel>
      {/* 时间戳锚点：台账行汇入锚（透明日志意象）——svg 局部坐标系（left 430） */}
      <svg width={920} height={480} style={{position: 'absolute', left: 430, top: 0}}>
        {LEDGER_DAYS.map((r, i) => {
          const y = rowsTop + i * rowH + rowH / 2;
          return (
            <path
              key={i}
              d={`M 640 ${y} C 800 ${y}, 820 ${nodeCy}, ${nodeCx - 34} ${nodeCy}`}
              fill="none"
              stroke={`${theme.conceptDeep}AA`}
              strokeWidth={2}
              {...chain}
            />
          );
        })}
        <circle cx={nodeCx} cy={nodeCy} r={34} fill={`${theme.conceptDeep}14`} stroke={`${theme.conceptDeep}CC`} strokeWidth={2.5} strokeDasharray="6 5" />
        <text x={nodeCx} y={nodeCy + 7} textAnchor="middle" fontFamily={theme.mono} fontSize={17} fill={theme.conceptDeep}>
          OTS
        </text>
        <text x={nodeCx} y={nodeCy + 64} textAnchor="middle" fontFamily={theme.sans} fontSize={20} fill={theme.dim}>
          时间戳锚
        </text>
      </svg>
      {/* 外部复算：独立审计位 ✓（检疫绿 = 验证面） */}
      <div
        style={{
          position: 'absolute',
          left: 1090,
          top: 320,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 22px',
          borderRadius: 12,
          border: `2px solid ${theme.conceptDeep}88`,
          background: `${theme.conceptDeep}10`,
          opacity: auditO,
          transform: `scale(${0.8 + 0.2 * audit})`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>外部复算</div>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            border: `2.5px solid ${theme.conceptDeep}`,
            color: theme.conceptDeep,
            fontFamily: theme.mono,
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✓
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          letterSpacing: 8,
          color: theme.conceptDeep,
          opacity: bottom,
        }}
      >
        见证人被见证
      </div>
    </div>
  );
};

/** 2-A 装置调度：p2-01 楼层码垛 ↔ p2-06a 见证台账（中途被 archify 覆盖，
 *  相位切换发生在覆盖窗内，无可见跳变——两相位各为无条件挂载的独立子组件）。 */
const TrustPier: React.FC<{
  floorsAt: number;
  swapAt: number;
  ledgerAt: number;
  ledgerWin: number;
}> = ({floorsAt, swapAt, ledgerAt, ledgerWin}) => {
  const frame = useCurrentFrame();
  if (frame < swapAt) {
    const win = Math.max(1, swapAt - floorsAt);
    return (
      <CommentStack
        dimAt={floorsAt + Math.round(win * 0.42)}
        floorsAt={floorsAt}
        floorsWin={Math.round(win * 0.9)}
        stallAt={floorsAt + Math.round(win * 0.72)}
      />
    );
  }
  return (
    <WitnessLedger
      rowsAt={ledgerAt}
      rowsWin={Math.round(ledgerWin * 0.4)}
      chainAt={ledgerAt + Math.round(ledgerWin * 0.18)}
      selfAt={ledgerAt + Math.round(ledgerWin * 0.55)}
      auditAt={ledgerAt + Math.round(ledgerWin * 0.78)}
    />
  );
};

// ── 2-C 装置：空置中心仓（虚线框 useDraw）──────────────────────────────────

const WH = 'M 90 320 L 90 130 L 190 60 L 290 130 L 290 320 Z';

/** npm 保税仓（实心 · 拒重发布）vs Skills 中心仓（虚线空置 · 无人先建 · 留待对账）。 */
const EmptyRegistry: React.FC<{at: number; win: number}> = ({at, win}) => {
  const npm = useProgress(at, DUR.f5);
  const wh = useDraw(at + Math.round(win * 0.16), Math.round(win * 0.4));
  const dashO = useProgress(at + Math.round(win * 0.6), DUR.f4);
  const solidO = 1 - dashO;
  const markO = useProgress(at + Math.round(win * 0.62), DUR.f4);
  const bill = useSpring('settle', {at: at + Math.round(win * 0.8), dur: DUR.f5});
  const billO = useProgress(at + Math.round(win * 0.8), DUR.f4);
  return (
    <div style={{position: 'relative', width: 1500, height: 560}}>
      {/* 左：npm 中心仓（实心 · 锁版本箱 · 拒重发布）——对照组 */}
      <div style={{position: 'absolute', left: 0, top: 10, width: 420, opacity: npm, transform: `translateY(${(1 - npm) * 18}px)`}}>
        <svg width={420} height={384}>
          <path d={WH} fill={`${theme.concept}1E`} stroke={`${theme.concept}CC`} strokeWidth={3} />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={124 + i * 44} y={252 - i * 8} width={36} height={46 + i * 8} rx={5} fill={`${theme.concept}30`} stroke={`${theme.concept}AA`} strokeWidth={2} />
          ))}
          <text x={190} y={364} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fill={theme.text}>
            npm 中心仓
          </text>
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 252,
            top: 262,
            padding: '4px 14px',
            borderRadius: 8,
            border: `2px solid ${theme.concept}`,
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.concept,
            background: theme.panel,
          }}
        >
          拒重发布
        </div>
      </div>
      <div style={{position: 'absolute', left: 640, top: 240, fontFamily: theme.serif, fontSize: 30, color: theme.dim, opacity: npm}}>
        vs
      </div>
      {/* 右：Skills 中心仓——先描线、后转虚线（描线态与虚线态交叉淡化） */}
      <svg width={760} height={440} style={{position: 'absolute', left: 740, top: 10}}>
        <path d={WH} fill="none" stroke={theme.deny} strokeWidth={3} opacity={solidO} {...wh} />
        <path d={WH} fill="none" stroke={`${theme.deny}CC`} strokeWidth={3} strokeDasharray="12 9" opacity={dashO} />
        <text x={190} y={215} textAnchor="middle" fontFamily={theme.mono} fontSize={64} fill={theme.deny} opacity={markO}>
          ?
        </text>
        <text x={190} y={364} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fill={theme.text}>
          Skills 中心仓
        </text>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 882,
          top: 302,
          padding: '4px 14px',
          borderRadius: 8,
          border: `2px solid ${theme.deny}`,
          fontFamily: theme.mono,
          fontSize: 16,
          color: theme.deny,
          background: theme.panel,
          opacity: markO,
        }}
      >
        无人先建
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1020,
          top: 96,
          padding: '6px 18px',
          borderRadius: 10,
          border: `2.5px solid ${theme.deny}`,
          background: `${theme.deny}14`,
          fontFamily: theme.mono,
          fontSize: 22,
          color: theme.deny,
          opacity: billO,
          transform: `scale(${1.25 - 0.25 * bill}) rotate(${(1 - bill) * -8}deg)`,
        }}
      >
        留待对账
      </div>
    </div>
  );
};

// ── 主组件 ───────────────────────────────────────────────────────────────────

export const P2: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // p2-08a/p2-08b 已补入 narration（Stage ④ 修正）——2-B 按 SPEC 收在 p2-08b
  const bA = w('p2-01', 'p2-06a');
  const bB = w('p2-07', 'p2-08b');
  const bC = w('p2-09', 'p2-12');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 三层栈逐层搭起">
        <SceneTag chapter="P2" tagline="三层信任栈" accent={theme.conceptDeep} />
        <ArchifyYield
          cues={[
            {at: at('p2-02') - bA.from, durationInFrames: dur('p2-02')},
            {at: at('p2-03') - bA.from, durationInFrames: dur('p2-03')},
            {at: at('p2-04') - bA.from, durationInFrames: dur('p2-04')},
            {at: at('p2-05') - bA.from, durationInFrames: dur('p2-05')},
            {at: at('p2-06') - bA.from, durationInFrames: dur('p2-06')},
          ]}
        >
          <TrustPier
            floorsAt={at('p2-01') - bA.from}
            swapAt={at('p2-02') - bA.from}
            ledgerAt={at('p2-06a') - bA.from}
            ledgerWin={dur('p2-06a')}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="trust-stack"
          caption="信任栈 · 三层"
          cues={[
            {chapterId: 'ts-l1', at: at('p2-02') - bA.from, durationInFrames: dur('p2-02')},
            {chapterId: 'ts-l2', at: at('p2-03') - bA.from, durationInFrames: dur('p2-03')},
            {chapterId: 'ts-proto', at: at('p2-04') - bA.from, durationInFrames: dur('p2-04')},
            {chapterId: 'ts-l3', at: at('p2-05') - bA.from, durationInFrames: dur('p2-05')},
            {chapterId: 'ts-count', at: at('p2-06') - bA.from, durationInFrames: dur('p2-06')},
          ]}
        />
        <EvidenceBadge text="团队自报口径" at={at('p2-06') - bA.from} />
        <Footnote delay={at('p2-06') - bA.from}>{'18.8 万 · 文件实例'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="2-B sigstore 重叠">
        <SceneTag chapter="P2" tagline="三层信任栈" accent={theme.conceptDeep} />
        <ArchifyRecap
          slug="sigstore-overlap"
          caption="sigstore · 对位"
          cues={[
            {chapterId: 'so-map', at: at('p2-07') - bB.from, durationInFrames: dur('p2-07')},
            {chapterId: 'so-reinvent', at: at('p2-08') - bB.from, durationInFrames: dur('p2-08')},
            {chapterId: 'so-motive', at: at('p2-08a') - bB.from, durationInFrames: dur('p2-08a')},
            {chapterId: 'so-scale', at: at('p2-08b') - bB.from, durationInFrames: dur('p2-08b')},
          ]}
        />
        <Footnote delay={at('p2-07') - bB.from}>{'sigstore · 2022'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="2-C 强制力缺口">
        <SceneTag chapter="P2" tagline="三层信任栈" accent={theme.conceptDeep} />
        <ArchifyYield
          cues={[
            {at: at('p2-09') - bC.from, durationInFrames: dur('p2-09')},
            {at: at('p2-10') - bC.from, durationInFrames: dur('p2-10')},
            {at: at('p2-12') - bC.from, durationInFrames: dur('p2-12')},
          ]}
        >
          <EmptyRegistry at={at('p2-11') - bC.from} win={dur('p2-11')} />
        </ArchifyYield>
        {/* 2-B 末句 so-reinvent@p2-08 跨镜背靠背 → lead={false}；must→npm 同实例由 enters 抑制 */}
        <ArchifyRecap
          slug="enforcement-gap"
          caption="强制力缺口"
          lead={false}
          cues={[
            {chapterId: 'eg-must', at: at('p2-09') - bC.from, durationInFrames: dur('p2-09')},
            {chapterId: 'eg-npm', at: at('p2-10') - bC.from, durationInFrames: dur('p2-10')},
          ]}
        />
        {/* p2-11 装置空窗后重现 → 保留入场 */}
        <ArchifyRecap
          slug="enforcement-gap"
          caption="强制力缺口"
          cues={[{chapterId: 'eg-chat', at: at('p2-12') - bC.from, durationInFrames: dur('p2-12')}]}
        />
        <Footnote delay={at('p2-09') - bC.from}>{'纸面 MUST · 无人执法'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};
