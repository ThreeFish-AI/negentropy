"use client";

import { useRef, useState } from "react";
import { toast } from "@/lib/activity-toast";
import { AsyncPipelineResult, ChunkingConfig } from "@/features/knowledge";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { FileText, FileType, UploadCloud, X } from "lucide-react";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

type FileTab = "pdf" | "markdown";

interface TabConfig {
  accept: string;
  extensions: string[];
  Icon: typeof FileText;
  description: string;
  label: string;
  supportedFormats: string;
}

const TAB_CONFIG: Record<FileTab, TabConfig> = {
  pdf: {
    accept: ".pdf",
    extensions: [".pdf"],
    Icon: FileText,
    description: "PDF 文档将通过 AI 提取转换为 Markdown",
    label: "PDF",
    supportedFormats: "支持 .pdf（最大 200 MB）",
  },
  markdown: {
    accept: ".txt,.md,.markdown",
    extensions: [".txt", ".md", ".markdown"],
    Icon: FileType,
    description: "Markdown 与纯文本文件直接摄入，无需格式转换",
    label: "Markdown",
    supportedFormats: "支持 .md, .markdown, .txt（最大 200 MB）",
  },
};

/** 所有 tab 的扩展名合集，用于自动检测 */
const ALL_EXTENSIONS = Object.values(TAB_CONFIG).flatMap((c) => c.extensions);

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function detectTab(filename: string): FileTab | null {
  const ext = getFileExtension(filename);
  if (TAB_CONFIG.pdf.extensions.includes(ext)) return "pdf";
  if (TAB_CONFIG.markdown.extensions.includes(ext)) return "markdown";
  return null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IngestFileDialogProps {
  isOpen: boolean;
  corpusId: string | null;
  onClose: () => void;
  onIngestFile: (params: {
    file: File;
    source_uri?: string;
    chunkingConfig?: ChunkingConfig;
  }) => Promise<AsyncPipelineResult>;
  chunkingConfig?: ChunkingConfig;
  onSuccess?: () => void;
  title?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IngestFileDialog({
  isOpen,
  corpusId,
  onClose,
  onIngestFile,
  chunkingConfig,
  onSuccess,
  title = "Ingest From File",
}: IngestFileDialogProps) {
  const [tab, setTab] = useState<FileTab>("pdf");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const config = TAB_CONFIG[tab];

  // ---- 文件处理 ----

  const handleFileSelect = (file: File) => {
    const ext = getFileExtension(file.name);

    // 自动检测：若扩展名不属于当前 tab 但匹配另一 tab，自动切换
    if (!config.extensions.includes(ext)) {
      const detected = detectTab(file.name);
      if (detected && detected !== tab) {
        setTab(detected);
      } else if (!ALL_EXTENSIONS.includes(ext)) {
        setError(`不支持的文件类型: ${ext}。支持的格式: ${ALL_EXTENSIONS.join(", ")}`);
        return;
      }
    }

    // 文件大小验证
    if (file.size > MAX_FILE_SIZE) {
      setError(`文件大小超过限制（最大 ${formatFileSize(MAX_FILE_SIZE)}）`);
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  // ---- 拖拽 ----

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // ---- 操作 ----

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTabChange = (newTab: FileTab) => {
    setTab(newTab);
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleIngest = () => {
    if (!corpusId || !selectedFile) return;

    const currentFile = selectedFile;

    // 立即关闭并重置
    resetForm();
    onSuccess?.();

    toast.success("已开始从文件摄入知识源", {
      description: "可在 Pipeline 页面查看构建进度",
    });

    // Fire-and-forget
    onIngestFile({ file: currentFile, source_uri: currentFile.name, chunkingConfig }).catch(
      (err) => {
        toast.error("摄入失败", {
          description: err instanceof Error ? err.message : String(err),
        });
      },
    );
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setTab("pdf");
    setSelectedFile(null);
    setError(null);
    setDragActive(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!isOpen) return null;

  const TabIcon = config.Icon;

  return (
    <OverlayDismissLayer
      open={isOpen}
      onClose={handleClose}
      containerClassName="flex min-h-full items-center justify-center p-4"
      contentClassName="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200"
      contentProps={{
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": "ingest-file-dialog-title",
      }}
      backdropTestId="overlay-backdrop"
      contentTestId="overlay-content"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2
          id="ingest-file-dialog-title"
          className="text-lg font-semibold text-foreground"
        >
          {title}
        </h2>
        <button
          onClick={handleClose}
          className="text-text-muted hover:text-foreground"
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="mb-4 flex gap-4 text-xs">
        {(Object.keys(TAB_CONFIG) as FileTab[]).map((key) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`flex items-center gap-1.5 pb-1 font-medium ${
              tab === key
                ? "border-b-2 border-foreground text-foreground"
                : "text-text-muted hover:text-foreground"
            }`}
          >
            {TAB_CONFIG[key].label}
          </button>
        ))}
      </div>

      {/* Upload Zone */}
      <div
        className={`
          border-2 rounded-lg text-center transition-colors cursor-pointer
          ${
            selectedFile
              ? "border-solid border-foreground/20 p-4"
              : dragActive
                ? "border-dashed border-blue-500 bg-blue-50 p-8 dark:bg-blue-900/20"
                : "border-dashed border-border p-8 hover:border-foreground/30"
          }
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={config.accept}
          onChange={handleFileInput}
          className="hidden"
        />

        {selectedFile ? (
          <div className="flex items-center gap-3 text-left">
            <TabIcon className="h-5 w-5 shrink-0 text-text-muted" />
            <div className="min-w-0">
              <p className="max-w-[240px] truncate text-sm font-medium text-foreground">
                {selectedFile.name}
              </p>
              <p className="text-xs text-text-muted">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              className="ml-auto shrink-0 text-text-muted hover:text-red-500"
              aria-label="清除文件"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div>
            <UploadCloud className="mx-auto mb-3 h-10 w-10 text-text-muted" />
            <p className="text-sm text-text-secondary">
              拖拽文件到此处，或{" "}
              <span className="text-blue-500">点击选择</span>
            </p>
            <p className="mt-1.5 text-xs text-text-muted">
              {config.supportedFormats}
            </p>
          </div>
        )}
      </div>

      {/* Tab Description */}
      <p className="mt-2 px-1 text-xs text-text-muted">
        {config.description}
      </p>

      {/* Error */}
      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={handleClose}
          className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={handleIngest}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm hover:opacity-90 disabled:opacity-50"
          disabled={!corpusId || !selectedFile}
        >
          Ingest
        </button>
      </div>
    </OverlayDismissLayer>
  );
}
