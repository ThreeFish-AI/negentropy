/** 目录条目卡〔M-001 同物同形〕：钢蓝描边 2px 恒定锚（与贯穿请求卡同形同线宽），
 *  带版次号（version，缺省 v1）与固定地址角标（address，缺省 ctx://…）。
 *  写读两条管线的接头锚：P2 纳管管线末端（Tag·Index）弹出→飞落右侧目录列表；
 *  P7 自目录列表起飞落入 Retrieve 高亮框（同一张卡、同物同形）。
 *  small 为目录列表上的缩样（列表组件用）。
 *  at 给定 → settle 弹入场（局部帧）；缺省 → 稳态（列表/飞行 wrapper 由调用方摆位）。 */
import React from 'react';
import {theme} from '../design/theme';
import {useSpring} from '../motion';

export const CatalogCard: React.FC<{
  at?: number;
  version?: string;
  address?: string;
  small?: boolean;
}> = ({at, version = 'v1', address = 'ctx://kb/…', small = false}) => {
  // at 缺省时锚到 -1000：spring 吃局部帧，远负锚即恒稳态（无入场、无逐帧重模拟开销）
  const pop = useSpring('settle', {at: at ?? -1000, dur: 18});
  const w = small ? 150 : 236;
  const h = small ? 96 : 148;
  return (
    <div
      style={{
        width: w,
        height: h,
        transform: `scale(${0.86 + 0.14 * pop})`,
        opacity: pop,
        border: `2px solid ${theme.concept}`,
        borderRadius: 8,
        background: theme.panel,
        padding: small ? 8 : 14,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <span style={{fontSize: small ? 13 : 17, color: theme.text, letterSpacing: 1}}>目录条目</span>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: small ? 12 : 15,
            color: theme.concept,
            border: `1.5px solid ${theme.concept}`,
            borderRadius: 5,
            padding: small ? '1px 6px' : '2px 8px',
          }}
        >
          {version}
        </span>
      </div>
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: small ? 11 : 14,
          color: theme.dim,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {address}
      </div>
    </div>
  );
};
