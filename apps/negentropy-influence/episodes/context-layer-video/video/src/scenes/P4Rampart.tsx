/** P4 风控四机构（p4-01..28）——治理层：闸机 M2 / 承重墙 M3 / 贴标 M7 / 工牌 M6 + MCP 供给面。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useBreathe, useDraw, useImpulse, useProgress, useShake, useSpring, useStagger} from '../motion';
import {Footnote, SceneTag} from '../components/motifs';
import {TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, PillarHUD} from '../components/devices';

/** 4-A 四机构名牌矩阵。 */
const FourPlaques: React.FC<{at: number}> = ({at}) => {
  const ps = useStagger(4, {at, stride: 8, dur: DUR.f5});
  const orgs = [
    {n: '闸机', d: '客体可见性 · 逐页验放', c: theme.activate},
    {n: '承重墙', d: '定义出口必经同一执法点', c: theme.activate},
    {n: '贴标', d: '发现→标记→执行不断链', c: theme.grown},
    {n: '工牌', d: '代理权限只减不增', c: theme.blueprint},
  ];
  return (
    <div style={{display: 'flex', gap: 36, justifyContent: 'center', paddingTop: 130}}>
      {orgs.map((o, i) => (
        <div key={o.n} style={{opacity: ps[i], transform: `translateY(${(1 - ps[i]) * 22}px)`, width: 300, padding: '24px 26px', borderRadius: 12, borderTop: `4px solid ${o.c}`, border: `1px solid ${theme.panelBorder}`, background: theme.panel}}>
          <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.text}}>{o.n}</div>
          <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 6}}>{o.d}</div>
        </div>
      ))}
    </div>
  );
};

/** 4-B 闸机：扫描线横扫文件队列，机密页打码、越权行扣走。 */
const GateScanner: React.FC<{at: number; maskAt: number; dropAt: number}> = ({at, maskAt, dropAt}) => {
  const sweep = useProgress(at, DUR.f6, 'linear');
  const mask = useProgress(maskAt, DUR.f5);
  const drop = useImpulse({at: dropAt, dur: DUR.f6});
  const rows = [
    {t: 'customer.name', v: '张三', secret: false},
    {t: 'customer.phone', v: '138****', secret: true},
    {t: 'orders.amount', v: '$4,820', secret: false},
    {t: 'hr.salary_band', v: '[越权行]', secret: false, denied: true},
  ];
  return (
    <div style={{position: 'relative', width: 900, margin: '80px auto 0'}}>
      <div style={{position: 'absolute', left: `${sweep * 100}%`, top: -14, bottom: -14, width: 4, background: theme.activate, boxShadow: `0 0 18px ${theme.activate}`, borderRadius: 2}} />
      <div style={{border: `2px solid ${theme.panelBorder}`, borderRadius: 12, background: theme.panel, overflow: 'hidden'}}>
        {rows.map((r) => (
          <div key={r.t} style={{display: 'flex', justifyContent: 'space-between', padding: '14px 24px', borderBottom: `1px solid ${theme.panelBorder}`, opacity: r.denied ? 1 - 0.8 * drop : 1, transform: r.denied ? `translateX(${drop * 60}px)` : 'none'}}>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{r.t}</span>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: r.denied ? theme.danger : r.secret ? theme.dim : theme.text, background: r.secret ? `${theme.activate}${Math.round(mask * 90 + 10).toString(16).padStart(2, '0')}` : 'transparent', borderRadius: 4, padding: '0 6px'}}>
              {r.secret ? (mask > 0.5 ? '████████' : r.v) : r.v}
            </span>
          </div>
        ))}
      </div>
      <div style={{textAlign: 'center', marginTop: 18, fontFamily: theme.sans, fontSize: 18, color: theme.activate}}>查询引擎层执行 · 人 / BI / AI 同一套规则</div>
    </div>
  );
};

/** 4-C 木牌 vs 承重墙。 */
const SignVsWall: React.FC<{at: number; fallAt: number; wallAt: number}> = ({at, fallAt, wallAt}) => {
  const up = useSpring('settle', {at, dur: DUR.f5});
  const shake = useShake({at: fallAt, dur: DUR.f4, amp: 9});
  const wall = useDraw(wallAt, 40);
  return (
    <div style={{display: 'flex', gap: 90, justifyContent: 'center', alignItems: 'flex-end', paddingTop: 120, height: 480}}>
      <div style={{textAlign: 'center', opacity: up, transform: `translateX(${shake}px) rotate(${shake * -2.4}deg)`}}>
        <div style={{fontSize: 46}}>🪧</div>
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.danger, marginTop: 4}}>「请勿踩踏」木牌</div>
        <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim}}>应用层告示 · 轻松绕过</div>
      </div>
      <svg width={280} height={330} viewBox="0 0 280 330">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={20} y={300 - i * 52} width={240} height={44} rx={4} fill={`${theme.activate}14`} stroke={theme.activate} strokeWidth={1.5} opacity={wall.strokeDashoffset < 1 - i / 6 ? 1 : 0.15} />
        ))}
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={60 + i * 80} cy={140} r={7} fill={theme.activate} opacity={wall.strokeDashoffset < 0.3 ? 1 : 0} />
        ))}
        <text x={140} y={322} textAnchor="middle" fill={theme.dim} fontSize={15} fontFamily="monospace">承重墙 · 焊死的执法点</text>
      </svg>
    </div>
  );
};

/** 4-D 贴标流水线：新文件滑过探针，密级标签自动贴上。 */
const TagLine: React.FC<{at: number; breakAt: number}> = ({at, breakAt}) => {
  const files = useStagger(4, {at, stride: 12, dur: DUR.f6});
  const tags = [
    {f: 'phone 列', tag: 'PII', ok: true},
    {f: 'ssn 列', tag: 'PII', ok: true},
    {f: 'plan 列', tag: '未映射', ok: false},
    {f: '邮件模板', tag: 'INTERNAL', ok: true},
  ];
  const broken = useProgress(breakAt, 14);
  return (
    <div style={{width: 1050, margin: '100px auto 0'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 0}}>
        <div style={{fontSize: 44, marginRight: 18}}>📡</div>
        <div style={{flex: 1, height: 3, background: theme.panelBorder, position: 'relative'}}>
          {tags.map((t, i) => (
            <div key={i} style={{position: 'absolute', left: `${8 + i * 24}%`, top: -26, opacity: files[i], transform: `translateX(${files[i] * 0}px)`}}>
              <div style={{padding: '8px 16px', borderRadius: 8, border: `1px solid ${t.ok ? theme.grown : theme.danger}`, background: theme.panel, fontFamily: theme.mono, fontSize: 16, color: t.ok ? theme.grown : theme.danger}}>
                {t.f} → {t.ok ? (i === 3 ? t.tag : 'MASK_FULL') : (broken > 0.5 ? '明文出楼 ⚠' : t.tag)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{textAlign: 'center', marginTop: 60, fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>
        掩码不直绑系统标签 · 须经一层用户标签映射
      </div>
    </div>
  );
};

/** 4-E 工牌：权限交集环 + 双钟对照。 */
const BadgeRings: React.FC<{at: number; clockAt: number}> = ({at, clockAt}) => {
  const r1 = useSpring('settle', {at, dur: DUR.f5});
  const r2 = useSpring('settle', {at: at + 8, dur: DUR.f5});
  const narrow = useProgress(at + 20, DUR.f6, 'decelerate');
  const breathe = useBreathe({period: 96, base: 0.5, amp: 0.5});
  const clockO = useProgress(clockAt, DUR.f5);
  const off = 52 * (1 - narrow * 0.55);
  return (
    <div style={{display: 'flex', gap: 80, justifyContent: 'center', alignItems: 'center', paddingTop: 90}}>
      <svg width={380} height={300} viewBox="0 0 380 300">
        <circle cx={190 - off} cy={150} r={92} fill={`${theme.blueprint}12`} stroke={theme.blueprint} strokeWidth={2.5} opacity={r1} />
        <circle cx={190 + off} cy={150} r={92} fill={`${theme.grown}12`} stroke={theme.grown} strokeWidth={2.5} opacity={r2} />
        <text x={190 - off} y={154} textAnchor="middle" fontSize={16} fill={theme.dim} fontFamily="monospace" opacity={r1}>带教人权限</text>
        <text x={190 + off} y={154} textAnchor="middle" fontSize={16} fill={theme.dim} fontFamily="monospace" opacity={r2}>岗位允许面</text>
        <text x={190} y={150} textAnchor="middle" fontSize={22} fill={theme.text} fontFamily="sans-serif" opacity={narrow}>∩ 只减不增</text>
      </svg>
      <div style={{opacity: clockO, display: 'flex', gap: 40}}>
        <div style={{textAlign: 'center', padding: '18px 26px', borderRadius: 12, border: `2px solid ${theme.danger}66`}}>
          <div style={{fontSize: 46}}>⏸️</div>
          <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.danger, marginTop: 6}}>快照工牌</div>
          <div style={{fontFamily: theme.sans, fontSize: 14, color: theme.dim}}>回收后仍持权 · 越权窗口</div>
        </div>
        <div style={{textAlign: 'center', padding: '18px 26px', borderRadius: 12, border: `2px solid ${theme.grown}66`, boxShadow: `0 0 ${20 * breathe}px ${theme.grown}44`}}>
          <div style={{fontSize: 46}}>⏱️</div>
          <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.grown, marginTop: 6}}>实时天花板</div>
          <div style={{fontFamily: theme.sans, fontSize: 14, color: theme.dim}}>上一秒回收下一秒失效</div>
        </div>
      </div>
    </div>
  );
};

export const P4Rampart: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p4-01', 'p4-03');
  const bB = w('p4-04', 'p4-08');
  const bC = w('p4-09', 'p4-12');
  const bD = w('p4-13', 'p4-16');
  const bE = w('p4-17', 'p4-20');
  const bF = w('p4-21', 'p4-28');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 四机构名牌">
        <SceneTag chapter="P4" tagline="风控四机构" accent={theme.activate} />
        <FourPlaques at={at('p4-01') - bA.from} />
        <ArchifyRecap
          slug="layer-mechanism-map"
          caption="治理层 · 四机构脊柱"
          cues={[{chapterId: 'gov', at: at('p4-01') - bA.from, durationInFrames: dur('p4-01')}]}
        />
        <PillarHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bB} name="4-B 闸机 · 代码走廊⑦">
        <SceneTag chapter="P4" tagline="风控四机构" accent={theme.activate} />
        <GateScanner at={at('p4-04') - bB.from} maskAt={at('p4-05') - bB.from} dropAt={at('p4-08') - bB.from} />
        <div style={{position: 'absolute', left: 430, top: 620, width: 1060}}>
          <TerminalLog
            prompt="uv run horizon_context_lab.py --selftest"
            lines={[
              {text: '[PASS] D5: 拆 RBAC → intern 按 plan 拿到 [90, 560]（泄露发生）', color: theme.danger, at: at('p4-08') - bB.from},
            ]}
            caption="lab D5 · 拆执行面实验"
          />
        </div>
        <EvidenceBadge grade="lab" />
        <PillarHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bC} name="4-C 木牌与承重墙">
        <SceneTag chapter="P4" tagline="风控四机构" accent={theme.activate} />
        <SignVsWall at={at('p4-09') - bC.from} fallAt={at('p4-12') - bC.from} wallAt={at('p4-10') - bC.from} />
        <PillarHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bD} name="4-D 贴标流水线 · 代码走廊⑧">
        <SceneTag chapter="P4" tagline="风控四机构" accent={theme.grown} />
        <TagLine at={at('p4-13') - bD.from} breakAt={at('p4-16') - bD.from} />
        <div style={{position: 'absolute', left: 430, top: 620, width: 1060}}>
          <TerminalLog
            prompt="uv run horizon_context_lab.py --selftest"
            lines={[
              {text: '[PASS] D10: 拆标签映射 → phone 已贴标仍明文出楼', color: theme.danger, at: at('p4-16') - bD.from},
            ]}
            caption="lab D10 · 断链实验"
          />
        </div>
        <EvidenceBadge grade="lab" />
        <PillarHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bE} name="4-E 工牌 · 代码走廊⑨">
        <SceneTag chapter="P4" tagline="风控四机构" accent={theme.blueprint} />
        <BadgeRings at={at('p4-17') - bE.from} clockAt={at('p4-20') - bE.from} />
        <div style={{position: 'absolute', left: 430, top: 620, width: 1060}}>
          <TerminalLog
            prompt="uv run horizon_context_lab.py --selftest"
            lines={[
              {text: '[PASS] D9: 快照式天花板 → 回收后旧会话仍持 select:orders（越权窗口）', color: theme.danger, at: at('p4-20') - bE.from},
            ]}
            caption="lab D9 · 双钟实验"
          />
        </div>
        <EvidenceBadge grade="lab" />
        <PillarHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bF} name="4-F MCP 供给面">
        <SceneTag chapter="P4" tagline="风控四机构" accent={theme.danger} />
        <ArchifyYield
          cues={[
            {at: at('p4-22') - bF.from, durationInFrames: dur('p4-22')},
            {at: at('p4-24') - bF.from, durationInFrames: dur('p4-24')},
            {at: at('p4-25') - bF.from, durationInFrames: dur('p4-25')},
            {at: at('p4-26') - bF.from, durationInFrames: dur('p4-26')},
          ]}
        >
          <div style={{position: 'absolute', left: 0, right: 0, top: 620, textAlign: 'center', fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>
            客户端 → 供给面 → 执行层 · 三级攻击链
          </div>
        </ArchifyYield>
        <ArchifyRecap
          slug="mcp-threat-model"
          caption="MCP 供给面威胁模型"
          cues={[
            {chapterId: 'chain', at: at('p4-22') - bF.from, durationInFrames: dur('p4-22')},
            {chapterId: 'poison', at: at('p4-24') - bF.from, durationInFrames: dur('p4-24')},
            {chapterId: 'deputy', at: at('p4-25') - bF.from, durationInFrames: dur('p4-25')},
            {chapterId: 'controls', at: at('p4-26') - bF.from, durationInFrames: dur('p4-26')},
          ]}
        />
        <EvidenceBadge grade="thirdparty" />
        <PillarHUD lit={3} at={-30} />
      </Sequence>
    </AbsoluteFill>
  );
};
