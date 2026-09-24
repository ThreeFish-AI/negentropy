/** P2 一眼多票（p2-01..27）——M2 一次编码 · 独立分支 · 批量问（pass 青绿）。
 *  隔离的代价（互斥丢给两次独立判断 / 概率加出 1.19 / 双执行）由 danger 承担。
 *  七镜：2-A 归属交代 → 2-B 画像三件套（图）→ 2-C 平坦延迟曲线 → 2-D 隔离探针（图）
 *  → 2-E 合调红利 → 2-F 概率溢出 → 2-G 双执行与编排解（图）。
 *  图例 cue 均锚单句；本幕各实例间 cue 均隔 ≥1 句空窗，无跨实例背靠背（无需 lead 抑制）。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useCount, useDraw, useImpulse, useProgress, useStagger} from '../motion';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, LedgerBars, Stage} from '../components/devices';

/** 2-A 三枚归属徽章：useStagger 亮起并保持（闭源交代）。 */
const ProvenanceBadges: React.FC<{at: number}> = ({at}) => {
  const st = useStagger(3, {at, dur: DUR.f5, stride: 9});
  const rows = [
    {k: '逆向', t: '逆向研究者 · 上万次探针', s: '本体闭源 · 无论文 · 无权重', c: theme.pass},
    {k: '复刻', t: '开源复刻 ×2', s: '社区照着画像做的两个复刻', c: theme.route},
    {k: '画像', t: '画像 = 当前最可信假设', s: '非官方确认 · 后续以实测为准', c: theme.dim},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 26, alignItems: 'center'}}>
      <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.text}}>
        凭什么快、凭什么便宜？——先交代底细
      </div>
      {rows.map((r, i) => (
        <div
          key={r.k}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            opacity: st[i],
            transform: `translateY(${(1 - st[i]) * 22}px)`,
          }}
        >
          <div
            style={{
              width: 96,
              textAlign: 'center',
              padding: '10px 0',
              borderRadius: 10,
              border: `2px solid ${r.c}99`,
              color: r.c,
              fontFamily: theme.mono,
              fontSize: 24,
            }}
          >
            {r.k}
          </div>
          <div
            style={{
              width: 640,
              padding: '16px 24px',
              borderRadius: 12,
              background: theme.panel,
              border: `2px solid ${r.c}55`,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.text}}>{r.t}</div>
            <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginTop: 4}}>{r.s}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

/** 2-C 平坦延迟曲线：useDraw 描线 + 数据点 useImpulse 标注（1 问 86.5ms → 100 问
 *  近平 → 1500 问 610ms；x 轴按问数对数布点，y 轴线性 0..650ms）。 */
const FlatCurve: React.FC<{drawAt: number; marks: {a: number; label: string}[]}> = ({drawAt, marks}) => {
  const frame = useCurrentFrame();
  const draw = useDraw(drawAt, DUR.f6);
  const impA = useImpulse({at: marks[0].a, dur: DUR.f5});
  const impB = useImpulse({at: marks[1].a, dur: DUR.f5});
  const impC = useImpulse({at: marks[2].a, dur: DUR.f5});
  const pts = [
    {x: 70, y: 311, imp: impA, dx: 14, dy: -16, anchor: 'start' as const},
    // 右对齐向左展开：标签整体落在平坦段上方，避开 x>460 处曲线起翘
    {x: 460, y: 309, imp: impB, dx: -10, dy: -30, anchor: 'end' as const},
    {x: 690, y: 78, imp: impC, dx: -8, dy: -16, anchor: 'end' as const},
  ];
  const xTicks = [
    {t: '1 问', x: 70},
    {t: '100 问', x: 460},
    {t: '1500 问', x: 690},
  ];
  return (
    <svg width={760} height={430} viewBox="0 0 760 430">
      {/* 网格虚线是像素 strokeDasharray——与描线元素的 pathLength 归一化分属两套正交特性（红线三） */}
      {[0, 200, 400, 600].map((ms) => (
        <g key={ms}>
          <line
            x1={70}
            x2={690}
            y1={350 - (ms / 650) * 290}
            y2={350 - (ms / 650) * 290}
            stroke={theme.panelBorder}
            strokeWidth={1.5}
            strokeDasharray="4 8"
          />
          <text
            x={54}
            y={355 - (ms / 650) * 290}
            textAnchor="end"
            fontFamily={theme.mono}
            fontSize={17}
            fill={theme.dim}
          >
            {ms}
          </text>
        </g>
      ))}
      <line x1={70} x2={690} y1={350} y2={350} stroke={theme.panelBorder} strokeWidth={2} />
      {xTicks.map((tk) => (
        <text
          key={tk.t}
          x={tk.x}
          y={382}
          textAnchor="middle"
          fontFamily={theme.sans}
          fontSize={20}
          fill={theme.dim}
        >
          {tk.t}
        </text>
      ))}
      <text x={70} y={34} fontFamily={theme.mono} fontSize={17} fill={theme.dim}>
        {'延迟 ms（问得再多，几乎不涨）'}
      </text>
      <path
        d="M 70 311 C 200 310, 330 309, 460 309 C 570 309, 610 220, 690 78"
        fill="none"
        stroke={theme.pass}
        strokeWidth={4.5}
        strokeLinecap="round"
        {...draw}
      />
      {pts.map((p, i) => {
        // map 内纯函数派生（progress + 取整），不调 hook（铁律①）
        const vis = progress(frame, marks[i].a, DUR.f3);
        return (
          <g key={i} opacity={vis}>
            <circle cx={p.x} cy={p.y} r={7 * (1 + 0.45 * p.imp)} fill={theme.pass} opacity={0.35} />
            <circle cx={p.x} cy={p.y} r={4.5} fill={theme.bg} stroke={theme.pass} strokeWidth={2.5} />
            <text
              x={p.x + p.dx}
              y={p.y + p.dy}
              textAnchor={p.anchor}
              fontFamily={theme.mono}
              fontSize={21}
              fill={theme.text}
            >
              {marks[i].label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/** 2-C 旁挂账签：输出量 = 记账口径（延迟不随之涨）。 */
const BillingCard: React.FC<{at: number}> = ({at}) => {
  const o = useProgress(at, DUR.f4);
  return (
    <Panel
      accent={`${theme.pass}88`}
      style={{width: 430, padding: '26px 30px', opacity: o, transform: `translateX(${(1 - o) * 26}px)`}}
    >
      <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.pass}}>{'账单 · 计费口径'}</div>
      <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text, marginTop: 14, lineHeight: 1.5}}>
        输出量 = 记账口径
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 10}}>
        延迟并不跟着输出量涨
      </div>
      <div
        style={{
          marginTop: 22,
          padding: '12px 18px',
          borderRadius: 10,
          border: `2px solid ${theme.pass}66`,
          background: `${theme.pass}14`,
          fontFamily: theme.mono,
          fontSize: 22,
          color: theme.pass,
          whiteSpace: 'nowrap',
        }}
      >
        {'200 选项 ≈ 2 选项 · 一样快'}
      </div>
    </Panel>
  );
};

/** 2-D 衬底读数卡：暗号在兄弟小票 0.00 / 暗号在底单 0.9+（useProgress 读数条）。
 *  两条 cue 覆盖全镜，读数卡即画框衬底——窗外交接瞬间可见，语义由图主控。 */
const ProbeMeter: React.FC<{sibAt: number; stateAt: number}> = ({sibAt, stateAt}) => {
  const sib = useProgress(sibAt, DUR.f5);
  const hit = useProgress(stateAt, DUR.f6);
  const read = 0.92 * hit; // 底单探针实测 0.90–0.92，取上限滚动显示
  return (
    <div style={{display: 'flex', gap: 56}}>
      <Panel accent={theme.panelBorder} style={{width: 470, padding: '24px 28px', opacity: sib}}>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>暗号藏进另一张小票</div>
        <div style={{fontFamily: theme.mono, fontSize: 54, color: theme.dim, marginTop: 10}}>0.00</div>
        <div style={{height: 16, borderRadius: 8, background: theme.panelBorder, marginTop: 12, position: 'relative'}}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: -5,
              width: 3,
              height: 26,
              background: theme.danger,
              borderRadius: 2,
            }}
          />
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 12}}>
          兄弟小票里的暗号，这道题看不见
        </div>
      </Panel>
      <Panel accent={`${theme.pass}88`} style={{width: 470, padding: '24px 28px', opacity: hit}}>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>暗号写进底单</div>
        <div style={{fontFamily: theme.mono, fontSize: 54, color: theme.pass, marginTop: 10}}>
          {read.toFixed(2)}
        </div>
        <div style={{height: 16, borderRadius: 8, background: theme.panelBorder, marginTop: 12}}>
          <div
            style={{
              height: 16,
              borderRadius: 8,
              background: theme.pass,
              width: Math.round(408 * read),
            }}
          />
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 12}}>
          底单共享 → 所有分支都看得见
        </div>
      </Panel>
    </div>
  );
};

/** 2-E 倍数徽章：useCount 滚数（官方自报 / 本仓复算两口径并列）。 */
const MultTag: React.FC<{to: number; at: number; label: string; color: string}> = ({to, at, label, color}) => {
  const v = useCount({from: 0, to, at, dur: DUR.f6});
  return (
    <div
      style={{
        padding: '12px 26px',
        borderRadius: 10,
        border: `2px solid ${color}88`,
        background: `${color}12`,
        fontFamily: theme.mono,
        fontSize: 30,
        color,
      }}
    >
      {label} ×{v.toFixed(1)}
    </div>
  );
};

/** 2-F 概率溢出条：两张互不相看的是非小票 0.72 + 0.47 = 1.19（useProgress 累加，
 *  越过 1.0 的段落染 danger；先长 0.72 再叠 0.47，分段均为 progress 的纯函数）。 */
const OverSumBar: React.FC<{aAt: number; bAt: number; noteAt: number; sumAt: number}> = ({
  aAt,
  bAt,
  noteAt,
  sumAt,
}) => {
  const a = useProgress(aAt, DUR.f4);
  const b = useProgress(bAt, DUR.f4);
  const note = useProgress(noteAt, DUR.f4);
  const sum = useProgress(sumAt, DUR.f6);
  const SCALE = 300 / 1.3; // 1.3 满刻度 → 300px
  const e1 = Math.min(sum / 0.55, 1) * 0.72;
  const e2 = Math.min(Math.max((sum - 0.55) / 0.45, 0), 1) * 0.47;
  const under = Math.min(e2, 1 - e1); // 0.72 → 1.0 段
  const over = Math.max(0, e1 + e2 - 1); // 1.0 → 1.19 溢出段
  const tickets = [
    {t: '是非小票 ①', q: '该退款？', p: 'P = 0.72', at: a, rot: -3, c: theme.pass},
    {t: '是非小票 ②', q: '不该退？', p: 'P = 0.47', at: b, rot: 3, c: theme.pass},
  ];
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 84}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30}}>
        <div style={{display: 'flex', alignItems: 'center'}}>
          {tickets.map((tk, i) => (
            <React.Fragment key={tk.t}>
              {i === 1 ? (
                <div
                  style={{
                    width: 2,
                    height: 200,
                    borderLeft: `3px dashed ${theme.dim}77`,
                    margin: '0 30px',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: -30,
                      left: -32,
                      width: 70,
                      textAlign: 'center',
                      fontFamily: theme.sans,
                      fontSize: 19,
                      color: theme.dim,
                    }}
                  >
                    互不相看
                  </div>
                </div>
              ) : null}
              <div
                style={{
                  width: 270,
                  padding: '18px 22px',
                  borderRadius: 12,
                  background: theme.panel,
                  border: `2.5px solid ${tk.c}77`,
                  textAlign: 'center',
                  opacity: tk.at,
                  transform: `rotate(${tk.rot}deg) translateY(${(1 - tk.at) * 18}px)`,
                }}
              >
                <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{tk.t}</div>
                <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.text, marginTop: 6}}>{tk.q}</div>
                <div style={{fontFamily: theme.mono, fontSize: 38, color: tk.c, marginTop: 6}}>{tk.p}</div>
              </div>
            </React.Fragment>
          ))}
        </div>
        <div style={{opacity: note, display: 'flex', alignItems: 'center', gap: 14}}>
          <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>官方自曝 · 同一问题</span>
          <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.calib}}>
            {'是非 0.22 ↔ 选择 0.01'}
          </span>
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 30,
            color: theme.danger,
            opacity: Math.min(1, Math.max(0, (sum - 0.85) / 0.15)),
          }}
        >
          {'0.72 + 0.47 = 1.19'}
        </div>
        <div style={{position: 'relative', width: 130, height: 300}}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
            }}
          >
            <div style={{height: Math.round(over * SCALE), background: theme.danger}} />
            <div style={{height: Math.round(under * SCALE), background: theme.calib}} />
            <div style={{height: Math.round(e1 * SCALE), background: theme.pass}} />
          </div>
          <div
            style={{
              position: 'absolute',
              left: -14,
              right: -14,
              bottom: Math.round(1.0 * SCALE) - 1,
              borderTop: `2.5px dashed ${theme.danger}AA`,
              textAlign: 'center',
            }}
          >
            <span
              style={{
                position: 'relative',
                top: 6,
                fontFamily: theme.mono,
                fontSize: 19,
                color: theme.danger,
                whiteSpace: 'nowrap',
                background: '#0E1116E6',
                borderRadius: 6,
                padding: '2px 8px',
              }}
            >
              {'1.0 · 概率上限'}
            </span>
          </div>
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>两道题不知道对方的存在</div>
      </div>
    </div>
  );
};

/** 2-G 双执行灯（useImpulse 齐亮后保持）+ 编排解面板（useStagger）。
 *  解法章 cue 落在 p2-25/26：面板错峰在画框背后完成，p2-27 金句句以完整态接棒。 */
const B6Breakdown: React.FC<{lampAt: number; verdictAt: number; fixAt: number; punchAt: number}> = ({
  lampAt,
  verdictAt,
  fixAt,
  punchAt,
}) => {
  const frame = useCurrentFrame();
  const flare = useImpulse({at: lampAt, dur: DUR.f6, peak: 1});
  const st = useStagger(2, {at: fixAt, dur: DUR.f5, stride: 8});
  const verdict = useProgress(verdictAt, DUR.f4);
  const punch = useProgress(punchAt, DUR.f4);
  const fixes = [
    {t: '合并成一道 Choice', s: '只挂合法组合 · 概率和恒为 1'},
    {t: '代码事后校验', s: '兜住模型给不了的互斥'},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32}}>
      <div style={{display: 'flex', gap: 90}}>
        {['退款', '拒退'].map((t) => {
          const lit = progress(frame, lampAt, DUR.f3);
          return (
            <div
              key={t}
              style={{
                width: 340,
                padding: '22px 26px',
                borderRadius: 12,
                border: `2.5px solid ${lit > 0.5 ? theme.danger : theme.panelBorder}`,
                background: lit > 0.5 ? `${theme.danger}14` : theme.panel,
                textAlign: 'center',
                transform: `scale(${1 + 0.05 * flare})`,
              }}
            >
              <div
                style={{
                  width: 62,
                  height: 62,
                  margin: '0 auto',
                  borderRadius: '50%',
                  background: theme.danger,
                  opacity: 0.2 + 0.8 * lit,
                  boxShadow: `0 0 ${Math.round(34 * flare + 16 * lit)}px ${theme.danger}`,
                }}
              />
              <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.danger, marginTop: 12}}>
                {t} ✘
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>双双过线 · 同时执行</div>
            </div>
          );
        })}
      </div>
      <div style={{fontFamily: theme.serif, fontSize: 28, color: theme.danger, opacity: verdict}}>
        编排把「互斥」丢给了两次独立判断——不是模型犯错
      </div>
      <div style={{display: 'flex', gap: 28}}>
        {fixes.map((f, i) => (
          <Panel
            key={f.t}
            accent={`${theme.ok}88`}
            style={{
              width: 400,
              padding: '18px 22px',
              opacity: st[i],
              transform: `translateY(${(1 - st[i]) * 24}px)`,
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.ok}}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.text, marginTop: 4}}>{f.t}</div>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 4}}>{f.s}</div>
          </Panel>
        ))}
      </div>
      <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.text, opacity: punch}}>
        反正，别指望模型自己自觉
      </div>
    </div>
  );
};

export const P2OnePass: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  // 与 at 对称的取长辅助：非 beat 用途一律走它，不写 w('句id') 字面形态
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p2-01', 'p2-04');
  const bB = w('p2-05', 'p2-07');
  const bC = w('p2-08', 'p2-11');
  const bD = w('p2-12', 'p2-13');
  const bE = w('p2-14', 'p2-16');
  const bF = w('p2-17', 'p2-21');
  const bG = w('p2-22', 'p2-27');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 闭源交代">
        <SceneTag chapter="P2" tagline="一眼多票" accent={theme.pass} />
        <Stage>
          <ProvenanceBadges at={at('p2-02') - bA.from} />
        </Stage>
      </Sequence>

      <Sequence {...bB} name="2-B 画像三件套">
        {/* 本镜主导让位给图回放：三句三章背靠背由实例内 enters 抑制，回放外无装置 */}
        <SceneTag chapter="P2" tagline="一眼多票" accent={theme.pass} />
        <ArchifyRecap
          slug="one-pass-decision"
          caption="一次编码 · 独立分支 · 选项读出"
          cues={[
            {chapterId: 'op-encode', at: at('p2-05') - bB.from, durationInFrames: dur('p2-05')},
            {chapterId: 'op-branch', at: at('p2-06') - bB.from, durationInFrames: dur('p2-06')},
            {chapterId: 'op-readout', at: at('p2-07') - bB.from, durationInFrames: dur('p2-07')},
          ]}
        />
        <Footnote delay={at('p2-06') - bB.from}>
          {'one-pass · branch isolation · pointer readout — 逆向画像词汇'}
        </Footnote>
      </Sequence>

      <Sequence {...bC} name="2-C 平坦性与计费口径">
        <SceneTag chapter="P2" tagline="一眼多票" accent={theme.pass} />
        <EvidenceBadge text="延迟与计费口径 — 第三方逆向实测" at={at('p2-09') - bC.from} />
        <Stage>
          <div style={{display: 'flex', gap: 52, alignItems: 'center'}}>
            <Panel accent={`${theme.pass}66`} style={{padding: '18px 22px 6px'}}>
              <FlatCurve
                drawAt={at('p2-09') - bC.from}
                marks={[
                  {a: at('p2-09') - bC.from + 18, label: '86.5ms'},
                  {a: at('p2-09') - bC.from + 44, label: '≈86ms · 还是这个价'},
                  {a: at('p2-11') - bC.from, label: '610ms'},
                ]}
              />
            </Panel>
            <BillingCard at={at('p2-10') - bC.from} />
          </div>
        </Stage>
      </Sequence>

      <Sequence {...bD} name="2-D 隔离探针">
        {/* 两条 cue 铺满本镜：ProbeMeter 为画框衬底（窗外交接瞬间可见），读数语义由图主控 */}
        <SceneTag chapter="P2" tagline="一眼多票" accent={theme.pass} />
        <ArchifyYield
          cues={[
            {at: at('p2-12') - bD.from, durationInFrames: dur('p2-12')},
            {at: at('p2-13') - bD.from, durationInFrames: dur('p2-13')},
          ]}
        >
          <Stage>
            <ProbeMeter sibAt={at('p2-12') - bD.from} stateAt={at('p2-13') - bD.from} />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="isolation-probe"
          caption="隔离探针双照"
          cues={[
            {chapterId: 'ip-sibling', at: at('p2-12') - bD.from, durationInFrames: dur('p2-12')},
            {chapterId: 'ip-state', at: at('p2-13') - bD.from, durationInFrames: dur('p2-13')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="2-E 合调红利">
        <SceneTag chapter="P2" tagline="一眼多票" accent={theme.pass} />
        <EvidenceBadge text="×12.2 — 官方教程自报" at={at('p2-15') - bE.from} />
        <Stage>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
            <div style={{display: 'flex', gap: 30}}>
              <MultTag to={12.2} at={at('p2-15') - bE.from} label="官方教程自报" color={theme.dim} />
              <MultTag to={12.5} at={at('p2-16') - bE.from} label="本仓简化原型" color={theme.pass} />
            </div>
            <LedgerBars
              at={at('p2-14') - bE.from}
              items={[
                {label: '13 问 · 合并 1 次调用', value: 2078, color: theme.pass, note: '一次编码 · 共享前缀'},
                {label: '13 问 · 逐问分调', value: 26078, color: theme.danger, note: '贵 12.5 倍'},
              ]}
            />
          </div>
        </Stage>
      </Sequence>

      <Sequence {...bF} name="2-F 跨问题无不变量">
        {/* 可见岛 p2-17..19 / p2-21：小票与官方自曝卡在前三句铺陈，溢出条压轴句回收 */}
        <SceneTag chapter="P2" tagline="一眼多票" accent={theme.pass} />
        <ArchifyYield cues={[{at: at('p2-20') - bF.from, durationInFrames: dur('p2-20')}]}>
          <Stage>
            <OverSumBar
              aAt={at('p2-17') - bF.from}
              bAt={at('p2-18') - bF.from}
              noteAt={at('p2-19') - bF.from}
              sumAt={at('p2-21') - bF.from}
            />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="no-cross-invariant"
          caption="跨问题无不变量"
          cues={[{chapterId: 'ni-two-noul', at: at('p2-20') - bF.from, durationInFrames: dur('p2-20')}]}
        />
      </Sequence>

      <Sequence {...bG} name="2-G 双执行与编排解">
        {/* 可见岛 p2-22..24 / p2-27：灯与判词在前三句，解法面板于 p2-27 金句句完整接棒 */}
        <SceneTag chapter="P2" tagline="一眼多票" accent={theme.pass} />
        <ArchifyYield
          cues={[
            {at: at('p2-25') - bG.from, durationInFrames: dur('p2-25')},
            {at: at('p2-26') - bG.from, durationInFrames: dur('p2-26')},
          ]}
        >
          <Stage>
            <B6Breakdown
              lampAt={at('p2-23') - bG.from}
              verdictAt={at('p2-24') - bG.from}
              fixAt={at('p2-25') - bG.from}
              punchAt={at('p2-27') - bG.from}
            />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="no-cross-invariant"
          caption="互斥的两种修法"
          cues={[
            {chapterId: 'ni-choice', at: at('p2-25') - bG.from, durationInFrames: dur('p2-25')},
            {chapterId: 'ni-recipe', at: at('p2-26') - bG.from, durationInFrames: dur('p2-26')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
