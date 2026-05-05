"use client";

// 单一事实源已迁移至 components/ui/ConfirmDialog（让 SessionList 与其他模块复用）。
// 本文件保留为薄 re-export，避免 ISSUE-045 修复的 import 路径破坏。
export { ConfirmDialog, type ConfirmDialogProps } from "@/components/ui/ConfirmDialog";
