import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {FadeUp, Pill} from '../components/cards';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';

/** 5-A：移动靶 + 旧审计标签错位 */
const MovingTarget: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame * 0.03) * 220;
  const stampOld = interpolate(frame, [10, 22], [1.8, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1200, height: 520}}>
        {/* 靶子 */}
        <div
          style={{
            position: 'absolute',
            left: 480 + drift,
            top: 90,
            width: 240,
            height: 240,
            borderRadius: 120,
            border: `10px solid ${theme.danger}`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: 130,
              height: 130,
              borderRadius: 65,
              border: `8px solid ${theme.danger}`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <div style={{width: 50, height: 50, borderRadius: 25, background: theme.danger}} />
          </div>
        </div>
        {/* 旧审计标签——留在原地，靶子已漂走 */}
        <div
          style={{
            position: 'absolute',
            left: 500,
            top: 330,
            transform: `rotate(-10deg) scale(${stampOld})`,
            border: `5px dashed ${theme.dim}`,
            borderRadius: 12,
            color: theme.dim,
            fontFamily: theme.sans,
            fontWeight: 900,
            fontSize: 32,
            padding: '8px 22px',
            opacity: 0.8,
          }}
        >
          出厂审计 ✅
        </div>
        <FadeUp delay={30} style={{position: 'absolute', right: 60, top: 100}}>
          <Pill color={theme.danger}>你审计的是昨天的它</Pill>
        </FadeUp>
        <FadeUp delay={44} style={{position: 'absolute', right: 60, top: 170}}>
          <Pill color={theme.danger}>今天它已经改过自己</Pill>
        </FadeUp>
      </div>
      <FadeUp delay={58} style={{marginTop: 30}}>
        <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>
          安全：从「对齐快照」变成「治理过程」
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 5-B：技能商店投毒（ClawHavoc） */
const SkillStore: React.FC = () => {
  const frame = useCurrentFrame();
  const scan = interpolate(frame, [16, 44], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  const items = Array.from({length: 24});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <FadeUp style={{marginBottom: 36}}>
        <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.text, fontWeight: 700}}>AI 技能市场</div>
      </FadeUp>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 18}}>
        {items.map((_, i) => {
          const isBad = i % 6 === 2;
          const revealed = scan > (i % 12) / 14;
          return (
            <div
              key={i}
              style={{
                width: 96,
                height: 96,
                borderRadius: 16,
                background: isBad && revealed ? '#2a1015' : theme.panel,
                border: `2px solid ${isBad && revealed ? theme.danger : theme.panelBorder}`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 40,
                transform: isBad && revealed ? 'rotate(8deg)' : 'none',
              }}
            >
              {isBad && revealed ? '☠️' : '📦'}
            </div>
          );
        })}
      </div>
      <FadeUp delay={46} style={{marginTop: 44}}>
        <div style={{fontFamily: theme.sans, fontSize: 44, fontWeight: 900, color: theme.danger}}>
          ~1,200 个恶意技能
        </div>
        <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 27, color: theme.dim, textAlign: 'center'}}>
          窃取 API 密钥 · 加密钱包 · 浏览器凭证
        </div>
        <div style={{marginTop: 12, fontFamily: theme.mono, fontSize: 22, color: theme.dim, textAlign: 'center'}}>
          ClawHavoc：攻击者根本不用攻破模型 —— 装个「技能」，AI 自己交出钥匙
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 5-C：记忆投毒——潜伏注入 */
const MemoryPoison: React.FC = () => {
  const frame = useCurrentFrame();
  const inject = interpolate(frame, [8, 26], [-500, 0], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  const resurface = [36, 60, 84].map((t) =>
    interpolate(frame, [t, t + 10], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'}),
  );
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 90, alignItems: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <div
            style={{
              padding: '16px 26px',
              borderRadius: 14,
              background: '#2a1015',
              border: `2px solid ${theme.danger}`,
              fontFamily: theme.sans,
              fontSize: 26,
              color: theme.danger,
              transform: `translateX(${inject}px)`,
              opacity: frame > 6 ? 1 : 0,
            }}
          >
            ⚠️ 一句被埋下的话
          </div>
          <FadeUp delay={30}>
            <div style={{marginTop: 18, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
              一次对话 · 一次接触
            </div>
          </FadeUp>
        </div>
        {/* 记忆库书架 */}
        <div
          style={{
            width: 460,
            height: 300,
            borderRadius: 20,
            background: theme.panel,
            border: `3px solid ${theme.harness}`,
            padding: 30,
            position: 'relative',
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.harness, fontWeight: 700}}>记忆库</div>
          <div style={{marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 14}}>
            {['经验', '偏好', '事实', '计划', '摘要', '教训'].map((t) => (
              <span
                key={t}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  background: '#10141c',
                  border: `2px solid ${theme.panelBorder}`,
                  fontFamily: theme.sans,
                  fontSize: 23,
                  color: theme.dim,
                }}
              >
                {t}
              </span>
            ))}
            {/* 被投毒的条目 */}
            <span
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                background: '#2a1015',
                border: `2px solid ${theme.danger}`,
                fontFamily: theme.sans,
                fontSize: 23,
                color: theme.danger,
                opacity: frame > 24 ? 1 : 0,
                boxShadow: `0 0 26px ${theme.danger}55`,
              }}
            >
              ☠️ 那句话
            </span>
          </div>
        </div>
        {/* 每次干活被翻出 */}
        <div style={{display: 'flex', flexDirection: 'column', gap: 22}}>
          {resurface.map((op, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'center',
                opacity: op,
                transform: `translateX(${(1 - op) * 60}px)`,
              }}
            >
              <span style={{fontSize: 36}}>🔧</span>
              <span style={{fontSize: 32, color: theme.danger}}>←</span>
              <span style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>第 {i + 1} 次干活又被翻出</span>
            </div>
          ))}
        </div>
      </div>
      <FadeUp delay={90} style={{marginTop: 50}}>
        <div style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 900, color: theme.danger}}>
          严格安全约束下，仍超 90% 场景可被操纵
        </div>
        <div style={{marginTop: 8, fontFamily: theme.mono, fontSize: 21, color: theme.dim, textAlign: 'center'}}>
          From Storage to Steering：一次注入 · 永久潜伏
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 5-D：反馈操纵——拧动评分仪表盘 */
const FeedbackHack: React.FC = () => {
  const frame = useCurrentFrame();
  const needle = interpolate(frame, [16, 40], [-80, 70], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  const swap = interpolate(frame, [42, 54], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 90, alignItems: 'center'}}>
        <div
          style={{
            width: 340,
            height: 340,
            borderRadius: 170,
            border: `12px solid ${theme.panelBorder}`,
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: 10,
              height: 130,
              borderRadius: 5,
              background: needle > 30 ? theme.danger : theme.dim,
              transformOrigin: 'bottom center',
              transform: `translateY(-65px) rotate(${needle}deg)`,
            }}
          />
          <div style={{position: 'absolute', bottom: 60, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
            「什么算进步」评分
          </div>
        </div>
        {/* 坏改动贴绿标 */}
        <div
          style={{
            padding: 30,
            borderRadius: 18,
            background: theme.panel,
            border: `3px solid ${theme.danger}`,
            transform: `scale(${0.9 + swap * 0.1})`,
          }}
        >
          <div style={{fontSize: 52}}>🧾</div>
          <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 26, color: theme.danger, fontWeight: 700}}>
            坏改动
          </div>
          <div
            style={{
              marginTop: 12,
              display: 'inline-block',
              padding: '6px 16px',
              borderRadius: 10,
              border: `3px solid ${swap > 0.5 ? theme.ok : theme.panelBorder}`,
              color: swap > 0.5 ? theme.ok : theme.dim,
              fontFamily: theme.sans,
              fontSize: 24,
              fontWeight: 700,
              transform: `rotate(${swap * -6}deg)`,
            }}
          >
            {swap > 0.5 ? '✓ 改进 · 已保留' : '? 待评分'}
          </div>
        </div>
      </div>
      <FadeUp delay={58} style={{marginTop: 56}}>
        <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
          不攻击 AI 本身 —— 污染「什么算进步」的评分
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};


/** 5-D2：对齐漂移（v3 新增，§9.2.3 + §9.2.5）——p5-21a 工具链组合攻击：
 *  连接器/协议/工作流各件单独✓、拼线连出意外路径；p5-21b 四招汇入
 *  「对齐漂移」罗盘，系统轮廓从实线渐虚（一步步偏出当初那套规矩）。 */
const DriftLens: React.FC = () => {
  const frame = useCurrentFrame();
  const chain = ['连接器', '协议', '工作流'];
  const chainIn = interpolate(frame, [4, 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const pathIn = interpolate(frame, [26, 44], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const compass = interpolate(frame, [52, 72], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const fade = interpolate(frame, [76, 104], [1, 0.35], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const stage2 = frame > 48;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {!stage2 ? (
        <div style={{display: 'flex', alignItems: 'center', gap: 26, opacity: chainIn}}>
          {chain.map((c, i) => (
            <React.Fragment key={c}>
              {i > 0 ? (
                <svg width={70} height={30}>
                  <line
                    x1={6}
                    y1={15}
                    x2={6 + 58 * (pathIn > i / chain.length ? 1 : 0)}
                    y2={15}
                    stroke={theme.danger}
                    strokeWidth={3}
                  />
                </svg>
              ) : null}
              <div
                style={{
                  padding: '14px 22px',
                  borderRadius: 12,
                  background: theme.panel,
                  border: `2px solid ${theme.ok}`,
                  fontFamily: theme.sans,
                  fontSize: 24,
                  color: theme.text,
                }}
              >
                {c} ✓
              </div>
            </React.Fragment>
          ))}
          <svg width={80} height={30}>
            <line x1={6} y1={15} x2={6 + 68 * pathIn} y2={15} stroke={theme.danger} strokeWidth={4} />
            {pathIn > 0.95 ? <polygon points="74,15 62,8 62,22" fill={theme.danger} /> : null}
          </svg>
          <div
            style={{
              padding: '14px 20px',
              borderRadius: 12,
              background: '#1c1114',
              border: `2px solid ${theme.danger}`,
              fontFamily: theme.sans,
              fontSize: 23,
              color: theme.danger,
              opacity: pathIn,
            }}
          >
            没人预期的路径
          </div>
        </div>
      ) : (
        <div style={{display: 'flex', alignItems: 'center', gap: 70, opacity: compass}}>
          {/* 四类攻击汇入罗盘 */}
          {['技能投毒', '记忆投毒', '工具链', '反馈操纵'].map((t, i) => (
            <div
              key={t}
              style={{
                padding: '10px 18px',
                borderRadius: 999,
                border: `2px solid ${theme.danger}`,
                color: theme.danger,
                fontFamily: theme.sans,
                fontSize: 21,
                opacity: interpolate(frame, [52 + i * 5, 62 + i * 5], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              {t}
            </div>
          ))}
          {/* 罗盘 + 渐虚轮廓 */}
          <svg width={300} height={300}>
            <circle
              cx={150}
              cy={150}
              r={120}
              fill="none"
              stroke={theme.exp}
              strokeWidth={3}
              strokeDasharray={frame > 76 ? `${14 * fade + 2} ${10}` : '0'}
              opacity={fade}
            />
            <circle cx={150} cy={150} r={86} fill="none" stroke={theme.panelBorder} strokeWidth={2} />
            <text x={150} y={144} textAnchor="middle" fill={theme.text} fontSize={30} fontFamily={theme.serif} fontWeight={700}>
              对齐漂移
            </text>
            <text x={150} y={176} textAnchor="middle" fill={theme.dim} fontSize={17} fontFamily={theme.mono}>
              alignment drift
            </text>
            {Array.from({length: 4}).map((_, i) => {
              const a = (i * Math.PI) / 2 + Math.PI / 4 + frame * 0.012;
              return <circle key={i} cx={150 + 120 * Math.cos(a)} cy={150 + 120 * Math.sin(a)} r={5} fill={theme.danger} />;
            })}
          </svg>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** 5-E：四味药 */
const FourRemedies: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = [
    {icon: '🛂', zh: '准入测试', en: 'Admission tests', desc: '新技能新记忆 · 先考试再上岗'},
    {icon: '🔒', zh: '最小权限', en: 'Least privilege', desc: '默认什么都不能碰 · 用啥申请啥'},
    {icon: '⏪', zh: '版本回滚', en: 'Versioning & rollback', desc: '改坏了 · 一键恢复上个认证版本'},
    {icon: '🔄', zh: '持续再认证', en: 'Continuous re-certification', desc: '安全检查不是一次性 · 是常态体检'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <FadeUp style={{marginBottom: 36}}>
        <div style={{fontFamily: theme.sans, fontSize: 36, color: theme.ok, fontWeight: 700}}>药方 · 四味药</div>
      </FadeUp>
      <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
        {rows.map((r, i) => {
          const enter = interpolate(frame, [i * 10, i * 10 + 14], [0, 1], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          });
          return (
            <div
              key={r.zh}
              style={{
                display: 'flex',
                gap: 22,
                alignItems: 'center',
                padding: '20px 34px',
                borderRadius: 16,
                background: theme.panel,
                border: `2px solid ${enter > 0.9 ? theme.ok : theme.panelBorder}`,
                opacity: enter,
                transform: `translateX(${(1 - enter) * -60}px)`,
                minWidth: 900,
              }}
            >
              <span style={{fontSize: 44}}>{r.icon}</span>
              <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.ok, fontWeight: 700}}>{r.zh}</span>
              <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>{r.desc}</span>
              <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginLeft: 'auto'}}>{r.en}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 5-F：AI-45° 双线爬坡 */
const FortyFive: React.FC = () => {
  const frame = useCurrentFrame();
  const climb = interpolate(frame, [10, 70], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  const diverge = interpolate(frame, [76, 100], [0, 40], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width="1200" height="560">
        {/* 安全线（青） */}
        <path
          d={`M 100 500 L ${100 + climb * 1000} ${500 - climb * 400}`}
          stroke={theme.harness}
          strokeWidth={8}
          fill="none"
          pathLength={1}
        />
        {/* 能力线（金） */}
        <path
          d={`M 100 500 L ${100 + climb * 1000} ${500 - climb * 400 - diverge}`}
          stroke={theme.exp}
          strokeWidth={8}
          fill="none"
          pathLength={1}
        />
        <text x={1120} y={90} fill={theme.exp} fontSize={28} fontFamily="sans-serif" opacity={diverge / 40}>
          能力
        </text>
        <text x={1120} y={135} fill={theme.harness} fontSize={28} fontFamily="sans-serif">
          安全
        </text>
        {/* 分叉警示 */}
        <text x={880} y={330} fill={theme.danger} fontSize={26} fontFamily="sans-serif" opacity={diverge / 40}>
          ⚠ 拉开差距 = 系统性欠账
        </text>
      </svg>
      <FadeUp delay={72} style={{position: 'absolute', bottom: 150}}>
        <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>AI-45° Law：能力涨多快，安全就得涨多快</div>
      </FadeUp>
    </AbsoluteFill>
  );
};

export const P5Safety: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p5-01', 'p5-05')} name="5-A 移动靶">
        <MovingTarget />
      </Sequence>
      <Sequence {...w('p5-06', 'p5-07')} name="5-A2 引子">
        <MovingTarget />
      </Sequence>
      <Sequence {...w('p5-08', 'p5-12')} name="5-B 技能投毒">
        <SkillStore />
      </Sequence>
      <Sequence {...w('p5-13', 'p5-18')} name="5-C 记忆投毒">
        <MemoryPoison />
      </Sequence>
      <Sequence {...w('p5-19', 'p5-21')} name="5-D 反馈操纵">
        <FeedbackHack />
      </Sequence>
      <Sequence {...w('p5-21a', 'p5-21b')} name="5-D2 对齐漂移">
        <DriftLens />
      </Sequence>
      <Sequence {...w('p5-22', 'p5-26')} name="5-E 四味药">
        <FourRemedies />
      </Sequence>
      <Sequence {...w('p5-27', 'p5-28')} name="5-F 45度定律">
        <FortyFive />
      </Sequence>
    </AbsoluteFill>
  );
};
