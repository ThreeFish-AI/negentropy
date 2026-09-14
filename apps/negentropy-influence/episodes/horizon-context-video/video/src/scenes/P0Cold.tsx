/** P0 冷开场：钥匙给了，还是答错（分镜 0-A…0-D）
 *  三十秒内完成：终端问答 → 自信错答红叉 → 列名乱码墙 → 口径分叉 → 片名。
 *  视觉锚：`manual` 金只在「含义」出现时使用——全片色彩语义的第一次亮相。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {DUR, progress, useImpulse, useProgress, useSpring, useStagger, useTravel} from '../motion';

/** 0-A 终端问答：自信错答打勾 → 基线角标 → 勾爆红叉 */
const AskAndMiss: React.FC<{missAt: number}> = ({missAt}) => {
  const frame = useCurrentFrame();
  const q = progress(frame, 4, 26);
  const qText = '上个季度毛收入多少？'.slice(0, Math.floor(q * 10));
  const answerAt = 40;
  const answer = useSpring('settle', {at: answerAt});
  const miss = useImpulse({at: missAt, dur: DUR.f4});
  const wrong = frame >= missAt;
  const footnote = useProgress(missAt + 4, DUR.f5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <Panel style={{width: 1150, padding: '38px 46px'}}>
        <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim}}>{'› '}{qText}</div>
        <div
          style={{
            marginTop: 26,
            fontFamily: theme.sans,
            fontSize: 44,
            fontWeight: 700,
            color: theme.text,
            opacity: answer,
            transform: `translateY(${(1 - answer) * 14}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 22,
          }}
        >
          <span style={{color: theme.ok, fontSize: 40, transform: wrong ? 'none' : 'scale(1)' }}>
            {wrong ? '✗' : '✓'}
          </span>
          <span style={{color: wrong ? theme.danger : theme.text}}>{'毛收入 320 万'}</span>
        </div>
      </Panel>
      <div
        style={{
          position: 'absolute',
          bottom: 210,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          opacity: footnote,
        }}
      >
        {'两家独立实测：无上下文时准确率约 21%（Anthropic 复测）— 25%（Snowflake 内测）'}
      </div>
    </AbsoluteFill>
  );
};

/** 0-B 乱码墙：一列高亮成金——含义第一次以色彩出现 */
const CodeWall: React.FC = () => {
  const frame = useCurrentFrame();
  const scroll = progress(frame, 2, 40);
  const cols = [
    'usr_id', 'amt_ttl_pre_dsc', 'ord_ts', 'cust_ref_src', 'net_amt_aft_tax',
    'qty_ship', 'sku_cd', 'rpc_typ', 'ord_id', 'acc_num',
    'amt_ttl_pre_dsc', 'bil_cyc', 'usr_id', 'disc_rt', 'txn_cd',
  ];
  const hi = 1; // amt_ttl_pre_dsc
  const goldAt = 46;
  const gold = useProgress(goldAt, DUR.f5);
  const badge = useSpring('settle', {at: goldAt + 6});
  const shown = Math.floor(scroll * cols.length);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 1300,
          fontFamily: theme.mono,
          fontSize: 34,
          lineHeight: 2.0,
          color: theme.dim,
          opacity: 0.9,
        }}
      >
        {cols.slice(0, Math.max(1, shown)).map((c, i) => (
          <div
            key={i}
            style={{
              color: i === hi && gold > 0 ? theme.manual : undefined,
              fontWeight: i === hi ? 700 : undefined,
              textShadow: i === hi ? `0 0 ${12 * gold}px ${theme.manual}` : undefined,
            }}
          >
            {c}
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 250,
          top: 220,
          fontFamily: theme.mono,
          fontSize: 26,
          color: theme.manual,
          border: `2px solid ${theme.manual}`,
          borderRadius: 10,
          padding: '10px 22px',
          opacity: badge,
          transform: `scale(${0.85 + 0.15 * badge})`,
        }}
      >
        {'amt_ttl_pre_dsc = 毛收入'}
      </div>
      <div style={{position: 'absolute', bottom: 210, fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: gold}}>
        {'AI 读得出每个字母——不知道这是毛收入'}
      </div>
    </AbsoluteFill>
  );
};

/** 0-C 一词三口径：同一份数据分裂成三张算法卡 */
const ForkCards: React.FC<{punchAt: number}> = ({punchAt}) => {
  const st = useStagger(3, {at: 6, stride: 8});
  const punch = useImpulse({at: punchAt, dur: DUR.f4});
  const dimAll = useProgress(punchAt + 14, DUR.f5);
  const quote = useProgress(punchAt + 18, DUR.f5);
  const defs = ['减完折扣', '含税总额', '发货口径'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.text, marginBottom: 46}}>
        {'同一份数据 · 同一个词「净收入」'}
      </div>
      <div style={{display: 'flex', gap: 46}}>
        {defs.map((d, i) => (
          <div key={i} style={{opacity: st[i] * (1 - dimAll * 0.6), transform: `translateY(${(1 - st[i]) * 26}px)`}}>
            <Panel style={{width: 300, padding: '26px 20px', textAlign: 'center'}}>
              <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'CASE WHEN'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.text, marginTop: 12}}>{d}</div>
            </Panel>
          </div>
        ))}
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <text x={960} y={520} textAnchor="middle" fontSize={90} fill={theme.danger} opacity={punch}>
          {'？'}
        </text>
      </svg>
      <div
        style={{
          position: 'absolute',
          bottom: 240,
          fontFamily: theme.serif,
          fontSize: 46,
          color: theme.manual,
          opacity: quote,
        }}
      >
        {'缺的不是智能，是含义。'}
      </div>
    </AbsoluteFill>
  );
};

/** 0-D 片名卡：一条青碧细线 + 标题 */
const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const line = progress(frame, 6, DUR.f5);
  const title = useSpring('settle', {at: 14});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{height: 3, width: 720 * line, background: theme.engine}} />
      <div
        style={{
          marginTop: 44,
          fontFamily: theme.serif,
          fontSize: 64,
          fontWeight: 700,
          color: theme.text,
          opacity: title,
          transform: `translateY(${(1 - title) * 16}px)`,
          textAlign: 'center',
        }}
      >
        {'AI 为什么答不对你公司的数据'}
      </div>
      <div
        style={{
          marginTop: 26,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          opacity: title,
        }}
      >
        {'Snowflake · Horizon Context · 上下文层系列'}
      </div>
    </AbsoluteFill>
  );
};

export const P0Cold: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-06');
  const bC = w('p0-07', 'p0-08');
  const bD = w('p0-09', 'p0-10');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 自信错答">
        <AskAndMiss missAt={at('p0-03') - bA.from} />
      </Sequence>
      <Sequence {...bB} name="0-B 乱码墙">
        <CodeWall />
      </Sequence>
      <Sequence {...bC} name="0-C 一词三口径">
        <ForkCards punchAt={at('p0-08') - bC.from} />
      </Sequence>
      <Sequence {...bD} name="0-D 片名">
        <TitleCard />
      </Sequence>
    </AbsoluteFill>
  );
};
