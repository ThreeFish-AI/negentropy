"use client";

/**
 * ChatWelcome — 中栏空会话的欢迎/引导区（Doubao 式）。
 *
 * 居中问候 + 副标题 + 一组建议提示词卡片；点击卡片经 ``onPick`` 将提示词填入 Composer。
 * 动效用 framer-motion 交错入场，并经 ``useReducedMotion`` 尊重系统"减少动态"偏好；
 * 全部令牌驱动、暗色安全，卡片命中区 ≥ 44px（可及性）。
 */
import { type ComponentType } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatSuggestion {
  id: string;
  /** 卡片主标题（简短动作短语）。 */
  title: string;
  /** 卡片辅助说明（可选）。 */
  description?: string;
  /** 点击后填入 Composer 的提示词全文。 */
  prompt: string;
  icon?: ComponentType<LucideProps>;
}

export interface ChatWelcomeProps {
  /** 用于个性化问候（可选）。 */
  userName?: string | null;
  suggestions: ChatSuggestion[];
  onPick: (prompt: string) => void;
  className?: string;
}

// expo-out 缓动（与 globals.css 的 --ease-out 对齐）；显式元组以满足 framer-motion 类型。
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function ChatWelcome({
  userName,
  suggestions,
  onPick,
  className,
}: ChatWelcomeProps) {
  const reduceMotion = useReducedMotion();

  const container = {
    hidden: {},
    show: {
      transition: reduceMotion
        ? {}
        : { staggerChildren: 0.05, delayChildren: 0.04 },
    },
  };
  const item = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduceMotion ? 0 : 0.28, ease: EASE_OUT },
    },
  };

  return (
    <motion.div
      data-testid="chat-welcome"
      variants={container}
      initial="hidden"
      animate="show"
      className={cn(
        "mx-auto flex min-h-[55vh] w-full max-w-2xl flex-col items-center justify-center px-4 text-center",
        className,
      )}
    >
      <motion.span
        variants={item}
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <Sparkles className="h-6 w-6" aria-hidden="true" />
      </motion.span>

      <motion.h2
        variants={item}
        className="text-h2 font-semibold tracking-heading text-text-primary"
      >
        {userName ? `你好，${userName}` : "你好"}
      </motion.h2>
      <motion.p
        variants={item}
        className="mt-2 max-w-md text-body-lg leading-body-lg text-text-secondary"
      >
        我是 Negentropy，可以帮你研究、写作与分析。选一个方向开始，或直接输入你的问题。
      </motion.p>

      {suggestions.length > 0 ? (
        <motion.div
          variants={item}
          role="list"
          aria-label="建议提示词"
          className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {suggestions.map((suggestion) => {
            const Icon = suggestion.icon ?? Sparkles;
            return (
              <motion.button
                key={suggestion.id}
                variants={item}
                type="button"
                role="listitem"
                data-testid="chat-welcome-suggestion"
                onClick={() => onPick(suggestion.prompt)}
                className={cn(
                  "group flex min-h-[3.25rem] items-start gap-3 rounded-card border border-border bg-card px-4 py-3 text-left",
                  "transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out",
                  "hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted hover:shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                )}
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-body font-medium text-text-primary">
                    {suggestion.title}
                  </span>
                  {suggestion.description ? (
                    <span className="mt-0.5 block text-caption leading-caption text-text-muted">
                      {suggestion.description}
                    </span>
                  ) : null}
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      ) : null}
    </motion.div>
  );
}
