"use client";

import {
  forwardRef,
  useState,
  type TextareaHTMLAttributes,
} from "react";

import {
  decodeSeparatorsFromInput,
  encodeSeparatorsForDisplay,
  separatorsArrayEqual,
} from "../utils/knowledge-api";

type NativeTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "defaultValue"
>;

export interface SeparatorsTextareaProps extends NativeTextareaProps {
  /** 解码后的 separators 数组（Source of Truth：上游 config.separators）。 */
  value: string[];
  /** 解码后的 separators 数组（每次键入都会触发）。 */
  onChange: (next: string[]) => void;
}

/**
 * 受控的 Separators 文本域（每行一个 separator；支持 `\n`/`\t`/`\r`/`\\` 字面量转义）。
 *
 * 设计动机：`encodeSeparatorsForDisplay(decodeSeparatorsFromInput(x))` 在 x 含孤立 `\`
 * 等中间态时**非幂等**——若直接作为受控 `<textarea value>` 会造成键入抖动
 * （键入单个 `\` 被自动扩写为 `\\` 且无法删除或继续编辑）。
 *
 * 本组件以「原始输入字符串」作为局部显示状态，仅在外部 `value: string[]` 的**语义**
 * 发生变化（如切换 Chunking 策略触发的 defaults 重置）时才重同步，规避 round-trip 抖动。
 *
 * ⚠️ 不要将其「简化」回 `value={encodeSeparatorsForDisplay(props.value)}` 的直接受控写法。
 */
export const SeparatorsTextarea = forwardRef<
  HTMLTextAreaElement,
  SeparatorsTextareaProps
>(function SeparatorsTextarea({ value, onChange, ...rest }, ref) {
  const [text, setText] = useState<string>(() =>
    encodeSeparatorsForDisplay(value),
  );
  // 「外部 value 变化时调整本地 text」采用 React 官方推荐的「渲染期比对上一次 prop」
  // 模式（参考 react.dev/reference/react/useState#storing-information-from-previous-renders），
  // 避免 useEffect+setState 的级联渲染与自激风险。React 允许在同组件渲染过程中同步
  // `setState`：它会立即丢弃当前这趟渲染结果并以新 state 重跑。
  const [lastValue, setLastValue] = useState<string[]>(value);
  if (value !== lastValue) {
    setLastValue(value);
    // 只有当外部 value 的「语义」发生变化，且本地 text 解码后也与新 value 不等价时，
    // 才用外部 value 覆盖本地 text；否则保留用户的中间态输入（如孤立 `\`）。
    if (!separatorsArrayEqual(lastValue, value)) {
      const decodedLocal = decodeSeparatorsFromInput(text);
      if (!separatorsArrayEqual(decodedLocal, value)) {
        setText(encodeSeparatorsForDisplay(value));
      }
    }
  }

  return (
    <textarea
      {...rest}
      ref={ref}
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        onChange(decodeSeparatorsFromInput(next));
      }}
    />
  );
});
