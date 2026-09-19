/** P5 专用工牌＝M6（主体轴 who）+ 自动贴标＝M7（发现→标记→执行供给链），
 *  末尾带出 §10–§12 三组降级配角（承重列之外的供给与出口）。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useProgress, useSpring, useStagger} from '../motion';
import {Panel, SceneTag} from '../components/motifs';
import {CodeWalk, TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge, NumberClash, PillarHUD, Stage} from '../components/devices';

/** 5-B 权限交集环：只减不增 */
const PermIntersect: React.FC<{at: number}> = ({at}) => {
  const shrink = useSpring('settle', {at, dur: DUR.f6});
  const r = 150;
  const dx = 116 - 40 * shrink;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 58}}>
      <svg width={560} height={340}>
        <circle cx={280 - dx} cy={170} r={r} fill={`${theme.engine}22`} stroke={theme.engine} strokeWidth={3} />
        <circle cx={280 + dx} cy={170} r={r} fill={`${theme.dig}22`} stroke={theme.dig} strokeWidth={3} />
        <text x={280 - dx - 56} y={72} fill={theme.engine} fontSize={22} fontFamily={theme.sans}>
          带教人权限
        </text>
        <text x={280 + dx - 40} y={72} fill={theme.dig} fontSize={22} fontFamily={theme.sans}>
          代理允许面
        </text>
        <text x={280 - 34} y={178} fill={theme.text} fontSize={26} fontFamily={theme.sans} opacity={shrink}>
          工牌
        </text>
      </svg>
      <div>
        <div style={{fontFamily: theme.sans, fontSize: 32, color: theme.text}}>权限只减不增</div>
        <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 25, color: theme.dim, lineHeight: 1.6}}>
          带教人自己都看不了的机密
          <br />
          智能体绝对无权触碰
        </div>
        <div
          style={{
            marginTop: 18,
            display: 'inline-block',
            padding: '8px 16px',
            borderRadius: 8,
            border: `2px solid ${theme.danger}`,
            color: theme.danger,
            fontFamily: theme.sans,
            fontSize: 22,
          }}
        >
          ✗ 并集（发万能钥匙）
        </div>
      </div>
    </div>
  );
};

/** 5-D 双钟对照：快照钟 vs 实时钟，中间阴影是越权窗口 */
const TwoClocks: React.FC<{revokeAt: number}> = ({revokeAt}) => {
  const frame = useCurrentFrame();
  const gap = progress(frame, revokeAt, DUR.f6);
  const clock = (title: string, sub: string, dead: boolean, c: string) => (
    <div style={{textAlign: 'center'}}>
      <div
        style={{
          width: 190,
          height: 190,
          borderRadius: '50%',
          border: `4px solid ${c}`,
          background: `${c}12`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 62,
        }}
      >
        {dead ? '⛔' : '🕐'}
      </div>
      <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{title}</div>
      <div style={{fontFamily: theme.sans, fontSize: 21, color: c}}>{sub}</div>
    </div>
  );
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 48}}>
      {clock('快照式工牌', '回收后仍持权', gap < 0.5, theme.danger)}
      <div
        style={{
          width: 40 + 220 * gap,
          height: 110,
          borderRadius: 8,
          background: `${theme.danger}1E`,
          border: `2px dashed ${theme.danger}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.danger,
          opacity: gap,
        }}
      >
        越权窗口
      </div>
      {clock('实时天花板', '上一秒回收，下一秒失效', gap > 0.5, theme.ok)}
    </div>
  );
};

/** 5-F 断链最后一环 */
const BrokenChain: React.FC<{at: number}> = ({at}) => {
  const ps = useStagger(3, {at, stride: 8, dur: DUR.f5});
  const leak = useProgress(at + 26, DUR.f6);
  const links = ['发现（自动分类）', '标记（系统标签）', '执行（tag-based 策略）'];
  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        {links.map((l, i) => (
          <React.Fragment key={l}>
            <div
              style={{
                padding: '20px 26px',
                borderRadius: 10,
                border: `2px solid ${i === 2 ? theme.danger : theme.dig}`,
                background: `${i === 2 ? theme.danger : theme.dig}12`,
                fontFamily: theme.sans,
                fontSize: 25,
                color: theme.text,
                opacity: ps[i],
              }}
            >
              {l}
            </div>
            {i < 2 ? (
              <span style={{fontSize: 30, color: i === 1 ? theme.danger : theme.dim}}>
                {i === 1 ? '⇢' : '→'}
              </span>
            ) : null}
          </React.Fragment>
        ))}
      </div>
      <div
        style={{
          marginTop: 26,
          fontFamily: theme.mono,
          fontSize: 30,
          color: theme.danger,
          opacity: leak,
        }}
      >
        phone 已贴系统标签 → 仍以 138****2041 明文出楼
      </div>
    </div>
  );
};

/** 5-G 听证会空白卡：不作为的可视化——数字栏刻意留白 */
const ConflictHearing: React.FC<{at: number}> = ({at}) => {
  const [a, b] = useStagger(2, {at, stride: 8, dur: DUR.f5});
  const card = (who: string, expr: string, c: string, p: number) => (
    <div
      style={{
        width: 470,
        padding: '24px 28px',
        borderRadius: 12,
        border: `2px solid ${c}`,
        background: `${c}12`,
        opacity: p,
      }}
    >
      <div style={{fontFamily: theme.sans, fontSize: 24, color: c}}>{who}</div>
      <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.text, marginTop: 10}}>{expr}</div>
      <div
        style={{
          marginTop: 16,
          height: 56,
          borderRadius: 8,
          border: `2px dashed ${theme.dim}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
        }}
      >
        数值待人工裁决
      </div>
    </div>
  );
  return (
    <div>
      <div style={{display: 'flex', gap: 30}}>
        {card('governed 金标准', 'count_distinct(orders.customer_id)', theme.manual, a)}
        {card('inferred 民间口径', 'count(events.id)', theme.dig, b)}
      </div>
      <div style={{marginTop: 22, textAlign: 'center', fontFamily: theme.sans, fontSize: 26, color: theme.danger}}>
        禁止按热度自动选 —— 否则错误口径借多数人赢
      </div>
    </div>
  );
};

export const P5Badge: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p5-01', 'p5-04');
  const bB = w('p5-05', 'p5-08');
  const bC = w('p5-08a');
  const bD = w('p5-09', 'p5-15');
  const bE = w('p5-16', 'p5-20');
  const bF = w('p5-21', 'p5-25');
  const bG = w('p5-26', 'p5-30');
  const bH = w('p5-31', 'p5-32');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A 专用工牌">
        <SceneTag chapter="M6" tagline="Agent Identity：实习生专用工牌" accent={theme.engine} />
        <ArchifyRecap
          slug="agent-identity"
          caption="权限天花板只减不增"
          cues={[{chapterId: 'ceiling', at: at('p5-03') - bA.from, durationInFrames: w('p5-03').durationInFrames}]}
        />
      </Sequence>

      <Sequence {...bB} name="5-B 权限交集环与刷卡审计">
        <Stage top={380}>
          <PermIntersect at={at('p5-05') - bB.from} />
        </Stage>
        <ArchifyRecap
          slug="agent-identity"
          caption="agent_type 归因审计"
          variant="inset"
          cues={[{chapterId: 'audit', at: at('p5-08') - bB.from, durationInFrames: w('p5-08').durationInFrames}]}
        />
      </Sequence>

      <Sequence {...bC} name="5-C 回指 P3 的代理识别灯">
        <Stage top={400}>
          <Panel accent={theme.engine} style={{padding: '30px 40px', width: 1080}}>
            <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.text, textAlign: 'center'}}>
              前面闸机能认出代理 —— 认的就是这张工牌
            </div>
          </Panel>
        </Stage>
        <ArchifyRecap
          slug="agent-identity"
          caption="IS_AGENT_ACTIVATED 谓词"
          variant="inset"
          cues={[{chapterId: 'strict', at: 0, durationInFrames: bC.durationInFrames}]}
        />
      </Sequence>

      <Sequence {...bD} name="5-D 双钟对照与代码走廊④">
        <Stage top={180}>
          <TwoClocks revokeAt={at('p5-13') - bD.from} />
          <CodeWalk
            title="M6 天花板 · 查询期实时求值（非登录期快照）"
            lines={[
              'def session_allows(session, perm):',
              '    if session.ceiling:',
              '        return perm in (USER_PERMS[session.user] & AGENT_SERVICE_ALLOWED)',
              '    return perm in session.perms          # 快照式：回收后仍持权',
            ]}
            hi={[{line: 2, at: 18, color: theme.ok}, {line: 3, at: 28, color: theme.danger}]}
            caption="horizon_context_lab.py :785"
            width={1180}
          />
          <EvidenceBadge grade="lab" />
        </Stage>
      </Sequence>

      <Sequence {...bE} name="5-E 自动贴标流水线">
        <SceneTag chapter="M7" tagline="分类与标签驱动策略传播" accent={theme.dig} />
        <ArchifyRecap
          slug="classification-tagging"
          caption="发现 → 标记 → 执行"
          cues={[{chapterId: 'tag-driven', at: at('p5-19') - bE.from, durationInFrames: w('p5-19').durationInFrames}]}
        />
      </Sequence>

      <Sequence {...bF} name="5-F 断链最后一环与代码走廊⑤">
        <Stage top={350}>
          <BrokenChain at={at('p5-21') - bF.from} />
          <CodeWalk
            title="M7 供给链 · 一次性映射（掩码策略不能直绑系统标签）"
            lines={[
              'TAG_MAPPING = {"pii": ["PRIVACY_CATEGORY.IDENTIFIER"]}   # 系统标签 → 用户标签',
              'def policy_for(system_tags, table, col, mapping=TAG_MAPPING):',
              '    for user_tag, sys_tags in mapping.items():',
              '        if set(system_tags.get(col, [])) & set(sys_tags): return MASK_FULL',
            ]}
            hi={[{line: 0, at: 16, color: theme.dig}, {line: 3, at: 26, color: theme.ok}]}
            caption="horizon_context_lab.py :816"
            width={1220}
          />
          <TerminalLog
            lines={[
              {text: '[LEAK] 拆掉标签映射 → phone 已贴系统标签仍明文出楼', color: theme.danger, bold: true},
              {text: '[PASS] 补齐映射 → phone 自动纳管 MASK_FULL（无需人工登记）', color: theme.ok},
            ]}
            width={1220}
          />
        </Stage>
        <ArchifyRecap
          slug="classification-tagging"
          caption="未映射 = 显式保护缺口"
          variant="inset"
          cues={[{chapterId: 'explicit-gap', at: at('p5-23') - bF.from, durationInFrames: w('p5-23').durationInFrames}]}
        />
      </Sequence>

      <Sequence {...bG} name="5-G 七柱合拢与听证会空白卡">
        <Stage top={360}>
          <ConflictHearing at={at('p5-29') - bG.from} />
          <div style={{marginTop: 26}}>
            <NumberClash
              badLabel="按热度自动选"
              bad="[6,1,2]"
              goodLabel="人工裁决后"
              good="[3,1,2]"
              at={at('p5-30') - bG.from}
            />
          </div>
        </Stage>
        <ArchifyRecap
          slug="collect-enrich-activate"
          caption="双轨富化与冲突浮出"
          variant="inset"
          cues={[{chapterId: 'enrich', at: at('p5-28') - bG.from, durationInFrames: w('p5-28').durationInFrames}]}
        />
        <PillarHUD lit={7} at={at('p5-26') - bG.from} />
      </Sequence>

      <Sequence {...bH} name="5-H 四因子称重与标准插座">
        <Stage top={400}>
          <div style={{display: 'flex', gap: 70, alignItems: 'center'}}>
            <div style={{textAlign: 'center'}}>
              <div style={{fontSize: 76}}>⚖️</div>
              <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 12}}>
                问询处四因子称重
              </div>
            </div>
            <div style={{textAlign: 'center'}}>
              <div style={{fontSize: 76}}>🔌</div>
              <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 12}}>
                标准 MCP 开放接口
              </div>
            </div>
          </div>
        </Stage>
        <ArchifyRecap
          slug="four-factor-ranking"
          caption="四因子信号排序"
          variant="inset"
          cues={[{chapterId: 'factors', at: at('p5-31') - bH.from, durationInFrames: w('p5-31').durationInFrames}]}
        />
        <ArchifyRecap
          slug="open-interop"
          caption="受控工具面开放"
          variant="inset"
          cues={[{chapterId: 'socket', at: at('p5-32') - bH.from, durationInFrames: w('p5-32').durationInFrames}]}
        />
        <PillarHUD lit={7} />
      </Sequence>
    </AbsoluteFill>
  );
};
