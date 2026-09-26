import React, {createContext, useContext} from 'react';

/** 语言维度的 TS 侧事实源（RSI-004 双语渲染）。
 *
 * 与 scripts/langs.py 的同构契约（勿单侧漂移，test_skeleton 执法）：
 *  - 主语言 zh 路径**无后缀**（audioDir('zh') === 'audio'，既有集零回归）；
 *  - 非主语言配音落同名子目录（audioDir('en') === 'audio/en'）；
 *  - PRIMARY_LANG 恒 'zh'。
 *
 * 穿透性（已核实，勿重复调研）：React context 天然穿透 Sequence/SceneFade；
 * @react-three/fiber 9.x 的 Canvas 经 its-fine 的 useContextBridge 桥接 context，
 * useLang() 在 ThreeCanvas 内同样可用，无须手工 bridge。
 */
export type Lang = 'zh' | 'en';

/** 主语言 = 中文主稿（SSOT）。英文为 1:1 句 id 对齐译稿，画面文字缺译回落 zh。 */
export const PRIMARY_LANG: Lang = 'zh';

/** 配音目录（与 {id}.mp3、manifest.json 同居）：langs.audio_dir() 的 TS 镜像。 */
export const audioDir = (lang: Lang): string =>
  lang === PRIMARY_LANG ? 'audio' : `audio/${lang}`;

const LangCtx = createContext<Lang>(PRIMARY_LANG);

/** 语言 context 提供者。lang 缺省主语言；非法值大声失败——静默回落会产出
 *  错版视频（Root.calculateMetadata 已在入口校验，此处兜底防绕过 Root 的直挂）。 */
export const LangProvider: React.FC<{lang?: Lang; children: React.ReactNode}> = ({
  lang = PRIMARY_LANG,
  children,
}) => {
  if (lang !== 'zh' && lang !== 'en') {
    throw new Error(`非法 lang ${JSON.stringify(lang)}：只接受 'zh' | 'en'`);
  }
  return <LangCtx.Provider value={lang}>{children}</LangCtx.Provider>;
};

export const useLang = (): Lang => useContext(LangCtx);

/** 词典取值 hook：当前语言缺失回落主语言，两缺回落空串。 */
export const useL = () => {
  const lang = useLang();
  return (pair: Partial<Record<Lang, string>>): string =>
    pair[lang] ?? pair[PRIMARY_LANG] ?? '';
};

/** 内联双语文案：<L zh="上下文窗口" en="Context Window"/>（en 缺省回落 zh）。 */
export const L: React.FC<{zh: string; en?: string}> = ({zh, en}) => {
  const l = useL();
  return <>{l({zh, en})}</>;
};
