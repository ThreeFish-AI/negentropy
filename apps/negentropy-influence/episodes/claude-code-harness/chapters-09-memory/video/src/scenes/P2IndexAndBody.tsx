/** P2 索引与正文（p2-01..p2-11，4 镜）——分镜 2-A / 2-B / 2-C / 2-D。
 *
 *  叙事链：2-A 承 1-C 问号位（位置呼应重锚——答题位）：左右对比帧等高立起——
 *  左「全量」开场白固定条被一摞记忆卡塞满撑高、每轮重发账单条首轮跳涨→「额度」
 *  上限虚线亮、左侧撑满泛红→「缓存」重复前缀省钱纹亮（确认绿纹）→「开头一变」
 *  首段翻色→「作废」省钱纹碎散（红扫）→「倒过来」右半激活（索引页亮起 + 一枚
 *  正文小段按需飞出）、「索引常驻、正文按需」两签落下（账单左高右低）、同构小章
 *  一拍即收（ep7 技能加载回指）→ 2-B 走查第一步·选（Worked Example——缩进 =
 *  制表符输入值全程可追）：偏好卡点亮、提问气泡落入、步骤签①、清单行 stagger
 *  点亮、轻量调用沿支线发挑取脉冲（逐行扫过）、上限标尺 5 格立起、选中行落绿
 *  （≤5 条）、降级支线灰闪一拍 → 2-C 第二步·取（单句重音镜）：正文小段自文件卡
 *  抽出沿通路飞向消息条前位、两万字符丈量条立起（水位远低于上限刻度——上限是
 *  保护非占用）、数字定格 1–2s punch、静持 ≥10 帧 → 2-D 注入两层请求条：前段
 *  固定开头（索引蓝·锁形微标）+ 后段当前消息（mech·每轮变化）、正文小段贴入
 *  后段前位、身份小签「背景 · 非命令」、冲突微演一拍（当前侧胜）、镜尾右缘门
 *  剪影浮起（P3 预告）。
 *
 *  空间契约：左红右蓝同屏等高、账单条左高右低可读、右半 p2-04 前保持暂暗、
 *    偏好卡 → 清单 → 选中行同一输入值可追（缩进 · 制表符同签）、上限标尺 5 格
 *    为硬边界（选中 ≤5）、丈量条水位不顶格、两段色相恒定（蓝前紫后）、前段跨轮
 *    不变。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥176；system prompt ·
 *  side-query · select_relevant_memories · RECALL_CHAR_LIMIT = 20000 ·
 *  prompt cache 只进角标；省钱纹碎后不复亮；身份小签文字不成句；门剪影不显
 *  五门细节。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ChatWindow, CountRuler, IndexPage, MemoryFileCard} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 2-A 全量 vs 按需对比帧（本幕坐标——开场白区的两种命运） ────────────────

const PANEL_A = {lx: 130, rx: 990, y: 170, w: 800, h: 640} as const;

/** 步骤签（① 选 / ② 取——两步走查的节拍锚，服务完本拍退役〔M-006〕） */
const StepChip: React.FC<{x: number; y: number; no: string; zh: string; lit: number; out?: number}> = ({x, y, no, zh, lit, out = 0}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      padding: '6px 22px',
      borderRadius: 10,
      border: `3px solid ${theme.core}`,
      background: theme.panel,
      fontFamily: theme.sans,
      fontSize: 24,
      fontWeight: 700,
      color: theme.text,
      whiteSpace: 'nowrap',
      opacity: clamp01(lit) * (1 - clamp01(out)),
      transform: `translateY(${(1 - clamp01(lit)) * 16}px)`,
    }}
  >
    {`${no} ${zh}`}
  </div>
);

const TwoA: React.FC<{
  atStuff: number;
  atBill: number;
  atCap: number;
  atCache: number;
  atFlipC: number;
  atVoid: number;
  atRight: number;
  atTags: number;
  atEcho: number;
}> = ({atStuff, atBill, atCap, atCache, atFlipC, atVoid, atRight, atTags, atEcho}) => {
  const frame = useCurrentFrame();
  // 左：记忆卡逐张塞入（条被撑高变形）
  const stuff = [0, 1, 2, 3, 4, 5].map((i) => clamp01(progress(frame, atStuff + i * 5, DUR.f4)));
  const stuffed = stuff.reduce((a, v) => a + v, 0);
  const barGrow = 150 + 190 * (stuffed / 6);
  // 每轮重发账单条：首轮跳涨（跳一档）＋右低对照恒在
  const bill = useProgress(atBill, DUR.f4);
  // 「额度」上限虚线亮 + 撑满泛红
  const cap = useProgress(atCap, DUR.f4);
  // 「缓存」省钱纹亮（确认绿纹）→「开头一变」首段翻色 →「作废」纹碎散（红扫）
  const cache = useProgress(atCache, DUR.f4);
  const flipC = useProgress(atFlipC, DUR.f4);
  const voidP = useProgress(atVoid, DUR.f5);
  const voidFlash = useImpulse({at: atVoid, dur: DUR.f5, peak: 1});
  // 「倒过来」右半激活：索引页亮起 + 正文小段按需飞出
  const right = useProgress(atRight, DUR.f5);
  const snippetFly = useProgress(atRight + 10, 24, 'decelerate');
  // 两枚关键词签落下（账单左高右低即开销裁决）
  const tags = [clamp01(progress(frame, atTags, DUR.f4)), clamp01(progress(frame, atTags + 7, DUR.f4))];
  // 同构小章（同款设计回指 ep7 技能加载——一拍即收）
  const echo = useImpulse({at: atEcho, dur: 26, peak: 1});
  return (
    <AbsoluteFill>
      {/* 左轨·全量（红侧） */}
      <div style={{position: 'absolute', left: PANEL_A.lx, top: PANEL_A.y, width: PANEL_A.w, height: PANEL_A.h, boxSizing: 'border-box', borderRadius: 16, border: `3.5px solid ${withAlpha(theme.danger, 0.5 + 0.4 * cap)}`, background: withAlpha(theme.panel, 0.92), padding: '16px 20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.danger}}>{'全量 · 全部写进开场白'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'每轮重发'}</span>
        </div>
        {/* 开场白固定条（被撑高变形——内嵌记忆卡阵） */}
        <div
          style={{
            marginTop: 12,
            height: barGrow,
            borderRadius: 10,
            border: `3px solid ${withAlpha(theme.dim, 0.8)}`,
            background: withAlpha(theme.bg, 0.55),
            position: 'relative',
            overflow: 'hidden',
            boxShadow: cap > 0.4 ? `0 0 ${26 * cap}px ${withAlpha(theme.danger, 0.35)}` : 'none',
          }}
        >
          {/* 首段（固定开头——缓存作废时翻色） */}
          <div style={{position: 'absolute', left: 10, top: 10, right: 10, height: 34, borderRadius: 6, background: withAlpha(flipC > 0.4 ? theme.danger : theme.index, 0.3), border: `2px solid ${withAlpha(flipC > 0.4 ? theme.danger : theme.index, 0.7)}`, display: 'flex', alignItems: 'center', paddingLeft: 10, fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>
            {'固定开头 system prompt'}
          </div>
          {/* 省钱纹（重复前缀——确认绿纹；作废时碎散：透明度随 voidP 散） */}
          {[0, 1, 2, 3, 4, 5, 6].map((k) => {
            const on = cache * (1 - voidP);
            if (on <= 0.03) {
              return null;
            }
            return (
              <div
                key={`sv${k}`}
                style={{
                  position: 'absolute',
                  left: 14 + (k % 4) * 168 + voidP * (k - 3) * 26,
                  top: 54 + Math.floor(k / 4) * 40 + voidP * (k % 2 === 0 ? -30 : 34) * voidP,
                  width: 140,
                  height: 8,
                  borderRadius: 4,
                  background: `repeating-linear-gradient(90deg, ${withAlpha(theme.ok, 0.55)} 0 12px, transparent 12px 20px)`,
                  opacity: on,
                  transform: `rotate(${voidP * (k % 2 === 0 ? 14 : -18)}deg)`,
                }}
              />
            );
          })}
          {/* 塞入的记忆卡阵（逐张塞入——mech 小卡） */}
          {stuff.map((p, i) => {
            if (p <= 0.02) {
              return null;
            }
            return (
              <div
                key={`mc${i}`}
                style={{
                  position: 'absolute',
                  left: 16 + (i % 3) * 232,
                  top: 108 + Math.floor(i / 3) * 66,
                  width: 214,
                  height: 52,
                  borderRadius: 7,
                  border: `2.5px solid ${withAlpha(theme.mech, 0.5 + 0.4 * p)}`,
                  background: withAlpha(theme.mech, 0.1),
                  opacity: p,
                  transform: `translateY(${(1 - p) * -18}px)`,
                }}
              />
            );
          })}
          {/* 额度上限虚线（撑到即死线） */}
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 4, height: 0, borderTop: `3px dashed ${withAlpha(theme.danger, 0.4 + 0.6 * cap)}`, opacity: cap}} />
          {/* 泛红遮罩（撑到满格） */}
          {cap > 0.05 ? <div style={{position: 'absolute', inset: 0, background: withAlpha(theme.danger, 0.13 * cap)}} /> : null}
        </div>
        {/* 账单条（带刻度——左高：首轮跳涨一档） */}
        <div style={{position: 'absolute', left: 20, right: 20, bottom: 66, height: 0}}>
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 0, borderTop: `2px solid ${withAlpha(theme.dim, 0.5)}`}} />
          <div
            style={{
              position: 'absolute',
              left: 10,
              bottom: 2,
              width: 620 * 0.62 + 150 * bill,
              height: 26,
              borderRadius: 6,
              background: `repeating-linear-gradient(90deg, ${withAlpha(theme.danger, 0.5)} 0 26px, ${withAlpha(theme.danger, 0.22)} 26px 34px)`,
              opacity: 0.9,
            }}
          />
          <div style={{position: 'absolute', left: 10, bottom: 34, fontFamily: theme.mono, fontSize: 13, color: theme.danger}}>{'重发账单 · 每轮全价'}</div>
        </div>
      </div>
      {/* 中缝裁决基线 */}
      <div style={{position: 'absolute', left: 958, top: PANEL_A.y - 14, width: 0, height: PANEL_A.h + 28, borderLeft: `3px solid ${withAlpha(theme.dim, 0.6)}`}} />
      {/* 右轨·按需（蓝侧——p2-04 前暂暗） */}
      <div style={{position: 'absolute', left: PANEL_A.rx, top: PANEL_A.y, width: PANEL_A.w, height: PANEL_A.h, boxSizing: 'border-box', borderRadius: 16, border: `3.5px solid ${withAlpha(theme.index, 0.45 + 0.4 * right)}`, background: withAlpha(theme.panel, 0.92), padding: '16px 20px', filter: `brightness(${0.62 + 0.38 * right})`}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.index}}>{'按需 · 索引常驻'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'用到才取'}</span>
        </div>
        {/* 开场白条（内只留一页索引——主装置缩微驻位） */}
        <div style={{marginTop: 12, height: 400, borderRadius: 10, border: `3px solid ${withAlpha(theme.dim, 0.8)}`, background: withAlpha(theme.bg, 0.55), position: 'relative'}}>
          <div style={{position: 'absolute', left: 10, top: 10, right: 10, height: 34, borderRadius: 6, background: withAlpha(theme.index, 0.3), border: `2px solid ${withAlpha(theme.index, 0.7)}`, display: 'flex', alignItems: 'center', paddingLeft: 10, fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>
            {'固定开头 system prompt'}
          </div>
          <div style={{position: 'absolute', left: 40, top: 58, opacity: right}}>
            <IndexPage x={0} y={0} w={680} h={310} scale={0.94} rowsLit={6 * right} />
          </div>
          {/* 正文小段按需飞出（自条外飞入条内一格——按需的具象） */}
          {snippetFly > 0.02 && snippetFly < 0.98 ? (
            <div
              style={{
                position: 'absolute',
                left: 420 + 220 * (1 - snippetFly),
                top: 430 - 300 * snippetFly,
                width: 150,
                height: 44,
                borderRadius: 8,
                border: `2.5px solid ${theme.mech}`,
                background: withAlpha(theme.panel, 0.95),
                opacity: Math.sin(Math.PI * snippetFly) * 0.9 + 0.1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.sans,
                fontSize: 14,
                color: theme.mech,
              }}
            >
              {'正文小段'}
            </div>
          ) : null}
        </div>
        {/* 右侧账单条（恒低） */}
        <div style={{position: 'absolute', left: 20, right: 20, bottom: 66, height: 0}}>
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 0, borderTop: `2px solid ${withAlpha(theme.dim, 0.5)}`}} />
          <div style={{position: 'absolute', left: 10, bottom: 2, width: 190, height: 26, borderRadius: 6, background: `repeating-linear-gradient(90deg, ${withAlpha(theme.index, 0.5)} 0 26px, ${withAlpha(theme.index, 0.22)} 26px 34px)`, opacity: 0.9}} />
          <div style={{position: 'absolute', left: 10, bottom: 34, fontFamily: theme.mono, fontSize: 13, color: theme.index}}>{'按需账单 · 只付用到'}</div>
        </div>
      </div>
      {/* 两枚关键词签（索引常驻 / 正文按需——落下） */}
      {['索引常驻', '正文按需'].map((t, i) => {
        const p = tags[i];
        if (p <= 0.02) {
          return null;
        }
        return (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: PANEL_A.rx + 90 + i * 330,
              top: 128 - 26 * p,
              padding: '5px 18px',
              borderRadius: 9,
              border: `2.5px solid ${i === 0 ? theme.index : theme.mech}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 19,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: p,
            }}
          >
            {t}
          </div>
        );
      })}
      {/* 同构小章（同款设计回指——ep7 技能加载，一拍即收） */}
      {echo > 0.04 ? (
        <div
          style={{
            position: 'absolute',
            right: 120,
            top: 120,
            padding: '4px 14px',
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(theme.index, 0.8)}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 15,
            fontWeight: 700,
            color: theme.index,
            whiteSpace: 'nowrap',
            opacity: echo,
            transform: `rotate(4deg) translateY(${(1 - echo) * 10}px)`,
          }}
        >
          {'同款设计 · 技能加载'}
        </div>
      ) : null}
      {/* 作废红扫闪注 */}
      {voidFlash > 0.04 ? (
        <div style={{position: 'absolute', left: PANEL_A.lx + 120, top: 132, fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.danger, opacity: voidFlash}}>
          {'缓存作废 · 省钱纹碎'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'system prompt · 左全量重发 ↔ 右索引常驻'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 走查第一步·选（Worked Example——输入值可追） ───────────────────────

/** 选择清单行（名字 + 简介——目录的检索面；选中行落确认绿） */
const LIST_ROWS = [
  {name: '缩进', desc: '偏好 · 制表符', sel: true},
  {name: '测试', desc: '教训 · 假数据', sel: false},
  {name: '合规', desc: '项目 · 重写', sel: false},
  {name: '看板', desc: '位置 · 问题单', sel: true},
  {name: '依赖', desc: '位置 · 版本', sel: false},
  {name: '提交', desc: '习惯 · 格式', sel: false},
] as const;

const TwoB: React.FC<{atPref: number; atAsk: number; atStep: number; atList: number; atPulse: number; atCap5: number; atDegrade: number; atStepOut: number}> = ({
  atPref,
  atAsk,
  atStep,
  atList,
  atPulse,
  atCap5,
  atDegrade,
  atStepOut,
}) => {
  const frame = useCurrentFrame();
  // 偏好文件卡点亮（左）
  const pref = useProgress(atPref, DUR.f4);
  // 提问气泡落入消息条（右）
  const ask = useProgress(atAsk, DUR.f5, 'decelerate');
  // 清单行 stagger 点亮
  const listLit = LIST_ROWS.map((_, i) => clamp01(progress(frame, atList + i * 5, DUR.f4)));
  // 挑取脉冲：小节点沿支线发一次脉冲 → 清单行逐行扫过（扫带下移）
  const pulse = useProgress(atPulse, 34, 'linear');
  // 上限标尺 5 格立起 + 选中行落绿（5 格内——两行选中）
  const cap5 = useProgress(atCap5, DUR.f4);
  const selGlow = useImpulse({at: atCap5 + DUR.f3, dur: DUR.f6, peak: 1});
  // 降级支线：关键词匹配小签灰调闪示一拍（失败路径，不抢焦）
  const degrade = useImpulse({at: atDegrade, dur: 22, peak: 1});
  const askY = 300 - 40 * clamp01(ask);
  return (
    <AbsoluteFill>
      {/* 左：记忆文件卡（签面「缩进 · 制表符」——与 1-A 首卡同形，输入值锚） */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: clamp01(pref)}}>
        <MemoryFileCard x={130} y={280} w={380} h={330} sign={'缩进 · 制表符'} signLit={1} fieldsLit={3} dim={0.25 * (1 - pref)} />
      </div>
      {/* 右：新会话消息条 + 提问气泡（「配置文件」落入） */}
      <ChatWindow x={1330} y={260} w={470} h={380} rows={[]} rowsLit={0} emptyAwait={1} header={'新会话'} />
      {ask > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 1360,
            top: askY + 60,
            padding: '8px 18px',
            borderRadius: 12,
            border: `2.5px solid ${withAlpha(theme.index, 0.85)}`,
            background: withAlpha(theme.panel, 0.96),
            fontFamily: theme.sans,
            fontSize: 18,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: clamp01(ask),
          }}
        >
          {'配置文件怎么写？'}
        </div>
      ) : null}
      {/* 中：选择清单（自索引页行展开——每行 = 名字 + 简介） */}
      <div
        style={{
          position: 'absolute',
          left: 580,
          top: 190,
          width: 640,
          boxSizing: 'border-box',
          borderRadius: 14,
          border: `3px solid ${withAlpha(theme.index, 0.65)}`,
          background: withAlpha(theme.panel, 0.95),
          padding: '14px 18px',
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 14, fontWeight: 700, color: theme.index}}>{'选择清单 · 名字 + 简介'}</div>
        <div style={{position: 'relative', marginTop: 8}}>
          {LIST_ROWS.map((r, i) => {
            const p = listLit[i];
            if (p <= 0.02) {
              return null;
            }
            const sel = r.sel ? cap5 : 0;
            // 挑取脉冲扫带经过本行（脉冲下移扫过）
            const sweeping = pulse > 0.02 && pulse < 0.98 ? clamp01(pulse * LIST_ROWS.length - i) : 0;
            return (
              <div
                key={r.name}
                style={{
                  height: 56,
                  marginBottom: 6,
                  boxSizing: 'border-box',
                  borderRadius: 9,
                  border: `2.5px solid ${sel > 0.4 ? theme.ok : sweeping > 0.4 ? theme.index : withAlpha(theme.panelBorder, 0.95)}`,
                  background: sel > 0.4 ? withAlpha(theme.ok, 0.1) : sweeping > 0.02 ? withAlpha(theme.index, 0.08) : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  paddingLeft: 12,
                  opacity: p,
                  boxShadow: sel > 0.4 && selGlow > 0.05 ? `0 0 ${14 * selGlow}px ${withAlpha(theme.ok, 0.5)}` : 'none',
                }}
              >
                <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{r.name}</span>
                <span style={{fontFamily: theme.sans, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>{r.desc}</span>
                {sel > 0.4 ? (
                  <span style={{marginLeft: 'auto', marginRight: 10, fontFamily: theme.sans, fontSize: 13, fontWeight: 700, color: theme.ok, whiteSpace: 'nowrap'}}>
                    {'选中 ✓'}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {/* 轻量调用小节点 + 支线（自清单底缘引出——side-query） */}
      <svg width={140} height={120} viewBox="0 0 140 120" style={{position: 'absolute', left: 1190, top: 600, overflow: 'visible'}}>
        <path d={`M 4 10 C 50 10, 60 60, 100 78`} fill="none" stroke={withAlpha(theme.tool, 0.75)} strokeWidth={3} strokeDasharray="7 6" />
        <circle cx={108} cy={82} r={13} fill={theme.panel} stroke={theme.tool} strokeWidth={3.5} opacity={clamp01(pulse) > 0.02 ? 1 : 0.55} />
        <circle cx={108} cy={82} r={5} fill={theme.tool} opacity={0.4 + 0.6 * clamp01(pulse)} />
      </svg>
      <div style={{position: 'absolute', left: 1240, top: 660, fontFamily: theme.mono, fontSize: 13, color: theme.tool, whiteSpace: 'nowrap'}}>{'轻量调用'}</div>
      {/* 上限标尺 5 格（硬边界——选中 ≤5） */}
      <CountRuler x={580} y={756} w={420} cells={5} cellsLit={5 * cap5} capTag={'上限 5 条'} capAt={5} capLit={cap5} readout={'2 / 5'} readoutLit={cap5} accent={theme.index} label={'select · 最多五条'} />
      {/* 降级支线（关键词匹配——灰调闪示一拍，不常驻） */}
      {degrade > 0.04 ? (
        <div style={{position: 'absolute', left: 1310, top: 720, padding: '3px 12px', borderRadius: 7, border: `2px solid ${withAlpha(theme.dim, 0.7)}`, background: theme.panel, fontFamily: theme.sans, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', opacity: degrade, filter: 'saturate(0.4)'}}>
          {'失败 → 关键词匹配'}
        </div>
      ) : null}
      {/* 步骤签①（服务完本拍退役——2-C 起让位） */}
      <StepChip x={600} y={120} no={'①'} zh={'选'} lit={clamp01(progress(frame, atStep, DUR.f4))} out={clamp01(progress(frame, atStepOut, DUR.f4))} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'side-query · select_relevant_memories'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-C 第二步·取（单句重音镜——数字定格 punch） ──────────────────────────

const TwoC: React.FC<{atStep: number; atLink: number; atFly: number; atMeter: number}> = ({atStep, atLink, atFly, atMeter}) => {
  const frame = useCurrentFrame();
  // 选中行指向线亮（左卡 → 通路）
  const link = useProgress(atLink, DUR.f4);
  // 正文小段自文件卡抽出、沿取回通路飞向消息条前位（飞行横跨句中词窗——水平
  // 直航，丈量条在飞行线下方，无竖向装置需三段避让）
  const fly = useProgress(atFly, 40, 'standard');
  // 丈量条立起 + 小段贴入落定（水位远低于上限——上限是保护非占用，禁过冲）
  const meter = useProgress(atMeter, DUR.f5);
  const punch = useImpulse({at: atMeter + DUR.f4, dur: DUR.f6, peak: 1});
  const FX0 = 510;
  const FX1 = 1330;
  const FY = 430;
  return (
    <AbsoluteFill>
      {/* 左：偏好文件卡（同一输入值——缩进 · 制表符） */}
      <MemoryFileCard x={150} y={280} w={360} h={330} sign={'缩进 · 制表符'} signLit={1} fieldsLit={3} />
      {/* 取回通路（指向线亮——自卡引至右） */}
      <svg width={1920} height={40} viewBox="0 0 1920 40" style={{position: 'absolute', left: 0, top: FY - 20, opacity: clamp01(link)}}>
        <line x1={FX0} y1={20} x2={FX1} y2={20} stroke={withAlpha(theme.index, 0.55)} strokeWidth={3} strokeDasharray="10 8" />
        <path d={`M ${FX1 - 18} 12 L ${FX1} 20 L ${FX1 - 18} 28`} fill="none" stroke={withAlpha(theme.index, 0.75)} strokeWidth={3} strokeLinecap="round" />
      </svg>
      {/* 右：消息条（贴入前位——正文小段落定处） */}
      <ChatWindow x={1330} y={270} w={470} h={400} rows={['配置文件怎么写？']} rowsLit={1} header={'新会话'} />
      {/* 正文小段（抽出→飞行→贴入；三窗位插值） */}
      <div
        style={{
          position: 'absolute',
          left: FX0 + 60 + (FX1 - FX0 - 120) * fly,
          top: FY - 22,
          width: 168,
          height: 46,
          borderRadius: 9,
          border: `2.5px solid ${theme.mech}`,
          background: withAlpha(theme.panel, 0.97),
          boxShadow: punch > 0.05 ? `0 0 ${16 * punch}px ${withAlpha(theme.mech, 0.5)}` : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontFamily: theme.sans,
          fontSize: 15,
          fontWeight: 700,
          color: theme.mech,
          whiteSpace: 'nowrap',
          opacity: clamp01(link * 2),
        }}
      >
        {'正文 · 选中 2 条'}
      </div>
      {/* 两万字符丈量条（上限刻度——水位 ~0.3 远低于上限；数字定格 punch） */}
      <CountRuler x={510} y={660} w={900} mode={'meter'} level={0.3 * meter} limitTag={'20,000'} readout={'RECALL 上限 · 20,000 字符'} readoutLit={meter} readoutFlash={punch} accent={theme.mech} label={'RECALL_CHAR_LIMIT = 20000'} />
      {/* 步骤签②（服务完本拍退役〔M-006〕——句尾随静持淡出） */}
      <StepChip x={600} y={120} no={'②'} zh={'取'} lit={clamp01(progress(frame, atStep, DUR.f4))} out={clamp01(progress(frame, atMeter + 40, DUR.f5))} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'RECALL_CHAR_LIMIT = 20000 · 上限是保护非占用'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-D 注入两层请求条（前段固定 · 后段当前） ─────────────────────────────

const REQ = {x: 260, y: 380, w: 1400, h: 130} as const;
const PREFIX_W = 560;

const TwoD: React.FC<{atPrefix: number; atPaste: number; atBadge: number; atConflict: number; atGate: number}> = ({atPrefix, atPaste, atBadge, atConflict, atGate}) => {
  const frame = useCurrentFrame();
  // 前段固定开头落定 + 锁形微标（跨轮不变——常驻语义）
  const prefix = useProgress(atPrefix, DUR.f5);
  const lock = useProgress(atPrefix + 8, DUR.f4);
  // 后段当前消息（mech——每轮变化：内部行纹呼吸轮换）
  const suffix = useProgress(atPrefix + 4, DUR.f5);
  const round = Math.floor(frame / 40) % 2;
  // 正文小段贴入后段前位
  const paste = useProgress(atPaste, DUR.f5);
  // 身份小签贴上正文段
  const badge = useProgress(atBadge, DUR.f4);
  // 冲突微演一拍：正文签旧指令影 vs 当前消息亮——当前侧胜（影退亮进）
  const conflict = useProgress(atConflict, 30);
  // 门剪影浮起（P3 预告——右缘，不显五门细节）
  const gate = useProgress(atGate, DUR.f5);
  return (
    <AbsoluteFill>
      {/* 请求条两层 */}
      <div style={{position: 'absolute', left: REQ.x, top: REQ.y, width: REQ.w, height: REQ.h}}>
        {/* 前段：固定开头（索引蓝 + 锁形微标） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: PREFIX_W,
            height: '100%',
            boxSizing: 'border-box',
            borderRadius: 12,
            border: `3.5px solid ${withAlpha(theme.index, 0.45 + 0.45 * prefix)}`,
            background: withAlpha(theme.index, 0.1),
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 20,
            gap: 14,
            opacity: prefix,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.index, whiteSpace: 'nowrap'}}>{'固定的开头'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap'}}>{'索引 · 跨轮不变'}</span>
          {/* 锁形微标 */}
          <svg width={34} height={34} viewBox="0 0 34 34" style={{marginLeft: 'auto', marginRight: 16, opacity: lock}}>
            <rect x={5} y={14} width={24} height={16} rx={4} fill={withAlpha(theme.index, 0.2)} stroke={theme.index} strokeWidth={3} />
            <path d={`M 11 14 V 10 a 6 6 0 0 1 12 0 V 14`} fill="none" stroke={theme.index} strokeWidth={3} />
          </svg>
        </div>
        {/* 后段：当前消息（mech——每轮变化） */}
        <div
          style={{
            position: 'absolute',
            left: PREFIX_W + 14,
            right: 0,
            top: 0,
            height: '100%',
            boxSizing: 'border-box',
            borderRadius: 12,
            border: `3.5px solid ${withAlpha(theme.mech, 0.45 + 0.45 * suffix)}`,
            background: withAlpha(theme.mech, 0.1),
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 20,
            opacity: suffix,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.mech, whiteSpace: 'nowrap'}}>{'当前消息'}</span>
          {/* 每轮变化指示（轮换行纹——机械轮替非动效） */}
          <div style={{marginLeft: 18, display: 'flex', gap: 6, alignItems: 'center'}}>
            {[0, 1, 2, 3, 4].map((k) => (
              <span key={`rw${k}`} style={{width: 44, height: 8, borderRadius: 4, background: withAlpha(theme.mech, k === round || k === round + 1 ? 0.55 : 0.18), display: 'inline-block'}} />
            ))}
          </div>
          {/* 冲突微演：当前消息亮（当前侧胜——conflict 期提亮） */}
          {conflict > 0.02 && conflict < 0.98 ? (
            <div style={{position: 'absolute', inset: -6, borderRadius: 14, border: `3px solid ${withAlpha(theme.text, Math.sin(Math.PI * conflict) * 0.9)}`, pointerEvents: 'none'}} />
          ) : null}
        </div>
        {/* 正文小段贴入后段前位（+ 身份小签） */}
        {paste > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: PREFIX_W + 26,
              top: 22,
              padding: '5px 14px',
              borderRadius: 8,
              border: `2.5px solid ${theme.mech}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 15,
              fontWeight: 700,
              color: theme.mech,
              whiteSpace: 'nowrap',
              opacity: clamp01(paste),
              transform: `translateY(${(1 - paste) * 14}px)`,
            }}
          >
            {'正文段'}
            {/* 旧指令影（冲突期一闪即退——当前侧胜） */}
            <span style={{position: 'absolute', left: 8, top: -22, fontFamily: theme.mono, fontSize: 11, color: withAlpha(theme.danger, 0.8), whiteSpace: 'nowrap', opacity: (1 - conflict) * (conflict > 0.02 ? 1 : 0)}}>
              {'旧指令影…'}
            </span>
          </div>
        ) : null}
        {/* 身份小签（背景 · 非命令——贴上正文段） */}
        {badge > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: PREFIX_W + 26,
              top: 84,
              padding: '3px 12px',
              borderRadius: 7,
              border: `2px solid ${withAlpha(theme.dim, 0.85)}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 14,
              color: theme.dim,
              whiteSpace: 'nowrap',
              opacity: badge,
            }}
          >
            {'背景 · 非命令'}
          </div>
        ) : null}
      </div>
      {/* 分段注（两段语义——蓝前紫后恒定） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 560, textAlign: 'center', fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: 0.85}}>
        {'前段跨轮不变（缓存前缀） · 后段每轮变化'}
      </div>
      {/* 门剪影（右缘浮起——P3 预告，不显门体细节） */}
      {gate > 0.02 ? (
        <svg width={130} height={190} viewBox="0 0 130 190" style={{position: 'absolute', left: 1750, top: 300, overflow: 'visible', opacity: gate * 0.8}}>
          <path d="M 22 186 L 22 84 A 43 44 0 0 1 108 84 L 108 186" fill="none" stroke={theme.mech} strokeWidth={5} strokeLinecap="round" opacity={0.75} />
        </svg>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'prompt cache · 冲突时听当前的'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2IndexAndBody: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-04');
  const bB = w('p2-05', 'p2-07');
  const bC = w('p2-08');
  const bD = w('p2-09', 'p2-11');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <TwoA
          atStuff={wa('p2-01', 0.18) - bA.from}
          atBill={wa('p2-01', 0.8) - bA.from}
          atCap={wa('p2-02', 0.4) - bA.from}
          atCache={wa('p2-03', 0.16) - bA.from}
          atFlipC={wa('p2-03', 0.5) - bA.from}
          atVoid={wa('p2-03', 0.76) - bA.from}
          atRight={wa('p2-04', 0.16) - bA.from}
          atTags={wa('p2-04', 0.5) - bA.from}
          atEcho={wa('p2-04', 0.86) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB
          atPref={wa('p2-05', 0.14) - bB.from}
          atAsk={wa('p2-05', 0.6) - bB.from}
          atStep={wa('p2-06', 0.12) - bB.from}
          atList={wa('p2-06', 0.5) - bB.from}
          atPulse={wa('p2-07', 0.2) - bB.from}
          atCap5={wa('p2-07', 0.52) - bB.from}
          atDegrade={wa('p2-07', 0.86) - bB.from}
          atStepOut={wa('p2-07', 0.98) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC
          atStep={wa('p2-08', 0.08) - bC.from}
          atLink={wa('p2-08', 0.2) - bC.from}
          atFly={wa('p2-08', 0.36) - bC.from}
          atMeter={wa('p2-08', 0.72) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="2-D">
        <TwoD
          atPrefix={wa('p2-09', 0.2) - bD.from}
          atPaste={wa('p2-09', 0.6) - bD.from}
          atBadge={wa('p2-10', 0.24) - bD.from}
          atConflict={wa('p2-10', 0.6) - bD.from}
          atGate={wa('p2-11', 0.72) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2IndexAndBody;
