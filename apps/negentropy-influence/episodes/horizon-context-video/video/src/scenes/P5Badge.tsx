/** P5 专用工牌＝M6（主体轴 who）+ 自动贴标＝M7（发现→标记→执行供给链），
 *  末尾带出 §10–§12 三组降级配角（承重列之外的供给与出口）。
 *  W6 起 5-A②/5-C/5-D/5-E/5-G/5-H 全句由 archify 图主控（KeyVsBadge/回指 Panel/
 *  TwoClocks+代码走廊④/IntakeBacklog+TagLine/ConflictHearing+NumberClash/⚖️🔌 图标
 *  退役）；自制件仅存 5-A① MechZoom 提问卡、5-B PermIntersect（岛 05..07）、
 *  5-F BrokenChain+代码走廊⑤（岛 21/22/24）与 wrapper 外 PillarHUD/EvidenceBadge。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useBreathe, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {CodeWalk, TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, PillarHUD, Stage} from '../components/devices';

/** 5-B 权限交集环：只减不增。
 *
 *  三句三拍（铁律⑤）：环入场停在宽重叠（p5-05）→ 收窄成工牌透镜**铺满 p5-06
 *  整句**（「最小子集」）→ 机密文案点亮 + 透镜弹一下锚在 p5-07（「带教人自己都
 *  看不了」）。收窄刻意用 fitted progress 而非 21 帧 spring：旧版 0.7s 收完、
 *  p5-06/07 两句 ≈9.3s 裁掉字幕带逐像素差分为 0（ISSUE-187 ① 同类，v4 评审
 *  实测），铺满整句让「无静止段」由构造保证（同 5-A 七道锁的 fit 范式）。 */
const PermIntersect: React.FC<{
  at: number;
  narrowAt: number;
  narrowSpan: number;
  secretAt: number;
}> = ({at, narrowAt, narrowSpan, secretAt}) => {
  const rise = useSpring('settle', {at, dur: DUR.f6});
  const narrow = useProgress(narrowAt, narrowSpan, 'decelerate');
  const secret = useProgress(secretAt, DUR.f5);
  const pop = useImpulse({at: secretAt, dur: DUR.f6});
  // 点亮后的常驻呼吸（乘 secret 门控）：p5-07 后半句到 p5-08 让位前不留静止尾
  const glow = useBreathe({period: 76, base: 0.5, amp: 0.5});
  const r = 150;
  // 从近乎并集的宽重叠**单调收窄**到定格的工牌透镜；终态间距 76 与 v4 定格一致。
  const rest = 76;
  const dx = rest - 40 * (1 - narrow);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 58}}>
      <svg
        width={560}
        height={340}
        style={{opacity: rise, transform: `scale(${0.95 + 0.05 * rise})`}}
      >
        <circle cx={280 - dx} cy={170} r={r} fill={`${theme.engine}22`} stroke={theme.engine} strokeWidth={3} />
        <circle cx={280 + dx} cy={170} r={r} fill={`${theme.dig}22`} stroke={theme.dig} strokeWidth={3} />
        {/* 两行环标题锚定**终态**位置：随 dx 移动会在开场宽重叠时互相叠字 */}
        <text x={280 - rest - 56} y={72} fill={theme.engine} fontSize={22} fontFamily={theme.sans}>
          带教人权限
        </text>
        <text x={280 + rest - 40} y={72} fill={theme.dig} fontSize={22} fontFamily={theme.sans}>
          代理允许面
        </text>
        <g transform={`translate(280 178) scale(${1 + 0.12 * pop})`} opacity={narrow}>
          <text x={-34} y={0} fill={theme.text} fontSize={26} fontFamily={theme.sans}>
            工牌
          </text>
        </g>
      </svg>
      <div>
        <div style={{fontFamily: theme.sans, fontSize: 32, color: theme.text}}>权限只减不增</div>
        <div
          style={{
            marginTop: 10,
            fontFamily: theme.sans,
            fontSize: 25,
            lineHeight: 1.6,
            color: theme.text,
            opacity: 0.55 + 0.45 * secret,
            textShadow: `0 0 ${(10 + 10 * glow) * secret}px ${theme.engine}55`,
            transform: `scale(${1 + 0.03 * pop})`,
            transformOrigin: 'left center',
          }}
        >
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

/** 5-F 断链最后一环 */
const BrokenChain: React.FC<{at: number; leakAt: number}> = ({at, leakAt}) => {
  const ps = useStagger(3, {at, stride: 8, dur: DUR.f5});
  // leakAt：明文出楼要落在说出它的那句上，写死 at+26 会提前 12.5s
  const leak = useProgress(leakAt, DUR.f6);
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

export const P5Badge: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  // 非 beat 用途一律走 dur，不写 w('句id') 字面形态（见 P3Gate 同处注释）
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
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
        {/* ① 嵌套保持原样：badge-question@p5-01 整窗盖住母图推近已接受，不套 wrapper */}
        {/* KeyVsBadge 已退役（p5-02..04 全句入 cue）；p5-02(master-key)→03(ceiling)
            背靠背跨实例 → lead={false}，p5-03→04(two-iron-rules) 同 */}
        <ArchifyRecap
          slug="agent-identity"
          caption="权限天花板只减不增"
          lead={false}
          cues={[{chapterId: 'ceiling', at: at('p5-03') - bA.from, durationInFrames: dur('p5-03')}]}
        />
        <ArchifyRecap
          slug="venn-intersection"
          caption="权限交集只减不增"
          lead={false}
          cues={[
            {chapterId: 'two-iron-rules', at: at('p5-04') - bA.from, durationInFrames: dur('p5-04')},
          ]}
        />
        <ArchifyRecap
          slug="injection-threat"
          caption="万能钥匙威胁"
          cues={[
            {chapterId: 'badge-question', at: at('p5-01') - bA.from, durationInFrames: dur('p5-01')},
            {chapterId: 'master-key', at: at('p5-02') - bA.from, durationInFrames: dur('p5-02')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="5-B 权限交集环与刷卡审计">
        {/* b：环收窄（p5-06）与机密点亮（p5-07）是跨句连续状态，仅让位 p5-08 审计窗 */}
        <ArchifyYield cues={[{at: at('p5-08') - bB.from, durationInFrames: dur('p5-08')}]}>
          <Stage>
            <PermIntersect
              at={at('p5-05') - bB.from}
              narrowAt={at('p5-06') - bB.from}
              narrowSpan={dur('p5-06')}
              secretAt={at('p5-07') - bB.from}
            />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="agent-identity"
          caption="agent_type 归因审计"
          cues={[{chapterId: 'audit', at: at('p5-08') - bB.from, durationInFrames: dur('p5-08')}]}
        />
      </Sequence>

      <Sequence {...bC} name="5-C 回指 P3 的代理识别灯">
        {/* 回指 Panel 已退役（strict@p5-08a 整窗接管）；p5-08(audit, 5-B)→08a
            跨镜背靠背跨实例 → lead={false}，否则换图重放入场弹簧 */}
        <ArchifyRecap
          slug="agent-identity"
          caption="IS_AGENT_ACTIVATED 谓词"
          lead={false}
          cues={[
            {chapterId: 'strict', at: at('p5-08a') - bC.from, durationInFrames: dur('p5-08a')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="5-D 双钟对照与代码走廊④">
        {/* TwoClocks+代码走廊④ 已退役（p5-09..15 全句入 cue，D9 原文由图承接）；
            EvidenceBadge 照 P2/P4 先例留在 wrapper 外常驻。p5-08a(strict, 5-C)→09、
            11→12、12→13 均背靠背跨实例；14 章重入时前一帧也是他图（snapshot-vs-live）
            → 三实例统一 lead={false} 净切，重入章不重放弹簧 */}
        <EvidenceBadge grade="lab" />
        <ArchifyRecap
          slug="revocation-timeline"
          caption="权限回收的两种命运"
          lead={false}
          cues={[
            {chapterId: 'realtime-ceiling', at: at('p5-09') - bD.from, durationInFrames: dur('p5-09')},
            {chapterId: 'static-snapshot', at: at('p5-10') - bD.from, durationInFrames: dur('p5-10')},
            {chapterId: 'ten-minutes', at: at('p5-11') - bD.from, durationInFrames: dur('p5-11')},
          ]}
        />
        <ArchifyRecap
          slug="zero-window-sequence"
          caption="零越权窗口时序"
          lead={false}
          cues={[
            {chapterId: 'experiment-risk', at: at('p5-12') - bD.from, durationInFrames: dur('p5-12')},
            {chapterId: 'dynamic-intersect', at: at('p5-14') - bD.from, durationInFrames: dur('p5-14')},
            {chapterId: 'zero-window', at: at('p5-15') - bD.from, durationInFrames: dur('p5-15')},
          ]}
        />
        <ArchifyRecap
          slug="agent-identity"
          caption="工牌双钟"
          lead={false}
          cues={[
            {chapterId: 'snapshot-vs-live', at: at('p5-13') - bD.from, durationInFrames: dur('p5-13')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="5-E 自动贴标流水线">
        <SceneTag chapter="M7" tagline="分类与标签驱动策略传播" accent={theme.dig} />
        {/* IntakeBacklog/TagLine 与 ①② MechZoom 嵌套已退役（p5-16..20 全句入 cue）。
            p5-15(zero-window, 5-D)→16、16→17、18→19 背靠背跨实例；17→18、19→20 是
            本实例空窗后重入章、前一帧均为他图 → 三实例统一 lead={false} 净切 */}
        <ArchifyRecap
          slug="tag-gate-linkage"
          caption="贴标即联动闸机"
          lead={false}
          cues={[
            {chapterId: 'intake-test', at: at('p5-16') - bE.from, durationInFrames: dur('p5-16')},
            {chapterId: 'seventh-mechanism', at: at('p5-18') - bE.from, durationInFrames: dur('p5-18')},
            {chapterId: 'auto-linkage', at: at('p5-20') - bE.from, durationInFrames: dur('p5-20')},
          ]}
        />
        <ArchifyRecap
          slug="supply-overwhelm"
          caption="纳管缺口"
          lead={false}
          cues={[
            {chapterId: 'flood-vs-manual', at: at('p5-17') - bE.from, durationInFrames: dur('p5-17')},
          ]}
        />
        <ArchifyRecap
          slug="classification-tagging"
          caption="发现 → 标记 → 执行"
          lead={false}
          cues={[{chapterId: 'tag-driven', at: at('p5-19') - bE.from, durationInFrames: dur('p5-19')}]}
        />
      </Sequence>

      <Sequence {...bF} name="5-F 断链最后一环与代码走廊⑤">
        {/* b：断链三卡 + 代码走廊阅读面跨句连续，让位 p5-21a/23/25 三窗；代码走廊
            5 行 + D10 长行的纵向预算靠终端行加宽 1420（一行放下） */}
        <ArchifyYield
          cues={[
            {at: at('p5-21a') - bF.from, durationInFrames: dur('p5-21a')},
            {at: at('p5-23') - bF.from, durationInFrames: dur('p5-23')},
            {at: at('p5-25') - bF.from, durationInFrames: dur('p5-25')},
          ]}
        >
          <Stage>
            <BrokenChain at={at('p5-21') - bF.from} leakAt={at('p5-23') - bF.from} />
            <CodeWalk
              title="M7 供给链 · 一次性映射（掩码策略不能直绑系统标签）"
              lines={[
                'TAG_MAPPING = {"CONTACT_INFO": "pii"}   # 一次性映射：系统标签 → 用户治理标签',
                'TAG_POLICY = {"pii": "MASK_FULL"}       # 用户标签 → 策略',
                'def policy_for(system_tags, table_name, col, mapping=TAG_MAPPING):',
                '    user_tag = mapping.get(system_tags.get((table_name, col)))',
                '    return TAG_POLICY.get(user_tag) if user_tag else None',
              ]}
              hi={[{line: 0, at: 16, color: theme.dig}, {line: 3, at: 26, color: theme.ok}]}
              caption="horizon_context_lab.py :805 内 :821"
              width={1220}
            />
            {/* 终端行 = selftest 原文逐字摘录（含前导两空格）；本镜纵向预算紧，不留 prompt 与 E3 行 */}
            <TerminalLog
              lines={[
                {
                  text: '  [PASS] D10: 拆标签映射（只分类不绑策略）→ phone 已贴系统标签仍明文出楼——发现→标记→执行 链条断在最后一环',
                  color: theme.danger,
                  bold: true,
                  at: at('p5-23') - bF.from,
                },
              ]}
              width={1420}
            />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="classification-tagging"
          caption="未映射 = 显式保护缺口"
          cues={[
            {chapterId: 'honest-limit', at: at('p5-21a') - bF.from, durationInFrames: dur('p5-21a')},
            {chapterId: 'explicit-gap', at: at('p5-23') - bF.from, durationInFrames: dur('p5-23')},
          ]}
        />
        {/* feedback 章锚「开放互操作」句（p5-25）：与 explicit-gap@p5-23 隔 p5-24
            不相邻 → 保留入场。注：p5-25→26 镜界**帧连续**（sceneGap 只加在跨场，
            不加在场内镜界——旧注「隔 0.9s 场隙」有误），故 5-G 的 reserved-supply
            传 lead={false} 净切 */}
        <ArchifyRecap
          slug="open-interop"
          caption="开放互操作"
          cues={[{chapterId: 'feedback', at: at('p5-25') - bF.from, durationInFrames: dur('p5-25')}]}
        />
      </Sequence>

      <Sequence {...bG} name="5-G 七柱合拢与听证会空白卡">
        {/* ConflictHearing+NumberClash 已退役（p5-26..30 全句入 cue）；七柱合拢由
            wrapper 外 PillarHUD 承担。p5-25(feedback, 5-F)→26 跨镜背靠背、28→29、
            29→30 同镜背靠背，均为跨实例 → 后挂实例 lead={false} 净切 */}
        <ArchifyRecap
          slug="component-panorama"
          caption="组件全景 · 供给与出口"
          lead={false}
          cues={[
            {chapterId: 'reserved-supply', at: at('p5-26') - bG.from, durationInFrames: dur('p5-26')},
          ]}
        />
        {/* p5-26→27 跨实例背靠背（同镜）：必须 lead={false}，否则 activate 换图重放
            入场弹簧；p5-27→28 同实例相邻由 enters 逻辑自动抑制 */}
        <ArchifyRecap
          slug="collect-enrich-activate"
          caption="双轨富化与冲突浮出"
          lead={false}
          cues={[
            {chapterId: 'activate', at: at('p5-27') - bG.from, durationInFrames: dur('p5-27')},
            {chapterId: 'enrich', at: at('p5-28') - bG.from, durationInFrames: dur('p5-28')},
          ]}
        />
        <ArchifyRecap
          slug="hearing-showdown"
          caption="语义打架开听证会"
          lead={false}
          cues={[
            {chapterId: 'open-hearing', at: at('p5-29') - bG.from, durationInFrames: dur('p5-29')},
          ]}
        />
        <ArchifyRecap
          slug="majority-shortcut"
          caption="多数派近道"
          lead={false}
          cues={[
            {chapterId: 'popularity-wins', at: at('p5-30') - bG.from, durationInFrames: dur('p5-30')},
          ]}
        />
      </Sequence>

      <Sequence {...bH} name="5-H 四因子称重与标准插座">
        {/* ⚖️/🔌 图标已退役（p5-31/32 全句入 cue）；p5-30(popularity-wins, 5-G)→31
            跨镜背靠背跨实例 → four-factor-ranking 补 lead={false} 净切 */}
        <ArchifyRecap
          slug="four-factor-ranking"
          caption="四因子信号排序"
          lead={false}
          cues={[{chapterId: 'factors', at: at('p5-31') - bH.from, durationInFrames: dur('p5-31')}]}
        />
        <ArchifyRecap
          slug="open-interop"
          caption="受控工具面开放"
          // 与前一实例背靠背占同一位置：跳过入场弹簧，否则 p5-31→32 边界换图弹入
          lead={false}
          cues={[{chapterId: 'socket', at: at('p5-32') - bH.from, durationInFrames: dur('p5-32')}]}
        />
      </Sequence>

      {/* 跨 5-G/5-H 常驻：提到两镜之外单实例化，避免切镜处 HUD 消失再从 0 淡入闪一次 */}
      <PillarHUD lit={7} at={at('p5-26')} />
    </AbsoluteFill>
  );
};
