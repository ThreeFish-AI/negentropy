/** P0 钥匙给了，还是答错（p0-01..10）——guided-learn Phase 0「准入体检」的视频形态：
 *  不讲机制，先让观众亲身失语一次（看不懂的物理列名墙）。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useBreathe, useDraw, useImpulse, useProgress, useReveal, useSpring, useStagger} from '../motion';
import {Panel} from '../components/motifs';
import {EvidenceBadge, Stage} from '../components/devices';
import {ArchifyRecap} from '../components/ArchifyRecap';

const COLS = [
  'amt_ttl_pre_dsc', 'cust_seg_cd', 'ord_dt_key', 'rev_net_adj', 'qty_shp_uom',
  'disc_pct_ln', 'tax_juris_cd', 'mrgn_gp_calc', 'chn_src_id', 'sku_var_hash',
  'pay_term_cd', 'ret_flg_ind', 'fx_rate_spot', 'gl_acct_seg', 'wh_loc_bin',
];

/** 0-A 终端问答：自信吐数 → 打勾翻红叉 */
const TerminalAsk: React.FC<{flipAt: number}> = ({flipAt}) => {
  const q = useReveal('上个季度毛收入是多少？', {at: 4, cps: 14});
  const ans = useProgress(38, DUR.f5);
  const bad = useImpulse({at: flipAt, dur: DUR.f6, peak: 1});
  const flipped = useProgress(flipAt, DUR.f3);
  return (
    <Panel style={{width: 1180, padding: '38px 46px'}} accent={theme.engine}>
      <div style={{fontFamily: theme.mono, fontSize: 30, color: theme.dim}}>
        <span style={{color: theme.engine}}>&gt; </span>
        {q}
      </div>
      <div
        style={{
          marginTop: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          opacity: ans,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 64, color: theme.text}}>$14.2M</span>
        <span
          style={{
            fontSize: 54,
            color: flipped > 0.5 ? theme.danger : theme.ok,
            transform: `scale(${1 + 0.35 * bad})`,
          }}
        >
          {flipped > 0.5 ? '✗' : '✓'}
        </span>
        <span
          style={{
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.danger,
            opacity: flipped,
          }}
        >
          财务口径同期为 $12.8M
        </span>
      </div>
    </Panel>
  );
};

/** 0-B 乱码列名墙：一列染金。
 *
 *  15 格 stagger 用 fit 模式铺满 p0-04..p0-05 两句（revealSpan，末格恰在染金前
 *  落定），染金 payoff 锚 p0-06——旧版固定 stride 开场 1.3s 就全部到位、其后
 *  ≈9.4s 裁掉字幕带逐像素差分为 0（ISSUE-187 ① 同类，v4 评审实测）；金列辉光
 *  再叠 breathe，让 p0-06 染金后到本幕结束也无静止尾。 */
const ColumnWall: React.FC<{goldAt: number; revealSpan: number}> = ({goldAt, revealSpan}) => {
  const gold = useSpring('snap', {at: goldAt, dur: DUR.f5});
  const breathe = useBreathe({period: 90, base: 0.5, amp: 0.5});
  const ps = useStagger(COLS.length, {at: 4, fit: {total: revealSpan}, dur: DUR.f4});
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', gap: 14, width: 1440, justifyContent: 'center'}}>
      {COLS.map((c, i) => {
        const on = i === 0;
        const p = ps[i];
        return (
          <div
            key={c}
            style={{
              padding: '14px 22px',
              borderRadius: 8,
              border: `2px solid ${on ? theme.manual : theme.panelBorder}`,
              background: on ? `${theme.manual}1A` : theme.panel,
              fontFamily: theme.mono,
              fontSize: 28,
              color: on ? theme.manual : theme.dim,
              opacity: p * (on ? 1 : 0.62),
              transform: on ? `scale(${1 + 0.08 * gold})` : 'none',
              boxShadow: on ? `0 0 ${(14 + 12 * breathe) * gold}px ${theme.manual}66` : 'none',
            }}
          >
            {c}
          </div>
        );
      })}
    </div>
  );
};

/** 0-C 三张 CASE WHEN 卡对撞 */
const ThreeDefs: React.FC<{hitAt: number}> = ({hitAt}) => {
  const ps = useStagger(3, {at: 4, stride: 7, dur: DUR.f5});
  // hitAt：三卡对撞要落在说出「谁也不服谁」的那句上，写死 34 会提前 3.5s
  const hit = useImpulse({at: hitAt, dur: DUR.f6});
  const defs = [
    {who: '销售看板', sql: "SUM(amt) - SUM(disc)"},
    {who: '财务报表', sql: "SUM(amt) - SUM(disc) - SUM(tax)"},
    {who: '运营周报', sql: "SUM(amt_net_adj)"},
  ];
  return (
    <div style={{display: 'flex', gap: 26}}>
      {defs.map((d, i) => (
        <div
          key={d.who}
          style={{
            width: 430,
            padding: '26px 28px',
            borderRadius: 12,
            border: `2px solid ${theme.panelBorder}`,
            background: theme.panel,
            opacity: ps[i],
            transform: `translateY(${(1 - ps[i]) * 22}px) translateX(${(i - 1) * hit * 14}px)`,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginBottom: 12}}>
            {d.who}的「净收入」
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.text}}>{d.sql}</div>
        </div>
      ))}
    </div>
  );
};

/** 0-D 片名卡 */
const TitleCard: React.FC = () => {
  const line = useDraw(2, DUR.f6);
  const t = useSpring('settle', {at: 12, dur: DUR.f6});
  return (
    <div style={{textAlign: 'center'}}>
      <svg width={900} height={4} style={{display: 'block', margin: '0 auto 34px'}}>
        <line x1={0} y1={2} x2={900} y2={2} stroke={theme.engine} strokeWidth={3} {...line} />
      </svg>
      <div
        style={{
          fontFamily: theme.serif,
          fontSize: 78,
          color: theme.text,
          opacity: t,
          transform: `translateY(${(1 - t) * 18}px)`,
          letterSpacing: 2,
        }}
      >
        拆解 Horizon Context
      </div>
      <div
        style={{
          marginTop: 20,
          fontFamily: theme.sans,
          fontSize: 32,
          color: theme.manual,
          opacity: t,
        }}
      >
        功能、治理、安全与开放性
      </div>
    </div>
  );
};

export const P0Cold: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-06');
  const bC = w('p0-07', 'p0-08');
  const bD = w('p0-09', 'p0-10');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 终端问答翻红叉">
        <Stage top={430}>
          <TerminalAsk flipAt={at('p0-03') - bA.from} />
          <EvidenceBadge grade="vendor" at={at('p0-03') - bA.from} top={430} />
        </Stage>
        <ArchifyRecap
          slug="bare-key-baseline"
          caption="裸库基线"
          variant="inset"
          cues={[
            {chapterId: 'whole-key', at: at('p0-01') - bA.from, durationInFrames: dur('p0-01')},
            {chapterId: 'blind-wrong', at: at('p0-02') - bA.from, durationInFrames: dur('p0-02')},
            {chapterId: 'baseline-two', at: at('p0-03') - bA.from, durationInFrames: dur('p0-03')},
          ]}
        />
      </Sequence>
      <Sequence {...bB} name="0-B 乱码列名墙">
        <Stage>
          <ColumnWall goldAt={at('p0-06') - bB.from} revealSpan={at('p0-06') - bB.from - 12} />
        </Stage>
      </Sequence>
      <Sequence {...bC} name="0-C 净收入三算法对撞">
        <Stage top={430}>
          <ThreeDefs hitAt={at('p0-08') - bC.from} />
        </Stage>
        <ArchifyRecap
          slug="caliber-clash"
          caption="口径打架"
          variant="inset"
          cues={[
            {chapterId: 'three-dashboards', at: at('p0-08') - bC.from, durationInFrames: dur('p0-08')},
          ]}
        />
      </Sequence>
      <Sequence {...bD} name="0-D 片名卡">
        <Stage top={340}>
          <TitleCard />
        </Stage>
      </Sequence>
    </AbsoluteFill>
  );
};
