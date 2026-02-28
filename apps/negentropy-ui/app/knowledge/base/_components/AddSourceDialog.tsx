"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { IngestResult, AsyncPipelineResult, ChunkingConfig } from "@/features/knowledge";

// 支持的文件扩展名
const SUPPORTED_EXTENSIONS = [".txt", ".md", ".markdown", ".pdf"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface AddSourceDialogProps {
  isOpen: boolean;
  corpusId: string | null;
  onClose: () => void;
  onIngest: (params: { text: string; source_uri?: string; chunkingConfig?: ChunkingConfig }) => Promise<AsyncPipelineResult>;
  onIngestUrl: (params: { url: string; chunkingConfig?: ChunkingConfig }) => Promise<AsyncPipelineResult>;
  onIngestFile?: (params: { file: File; source_uri?: string; chunkingConfig?: ChunkingConfig }) => Promise<IngestResult>;
  chunkingConfig?: ChunkingConfig;
  onSuccess?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AddSourceDialog({
  isOpen,
  corpusId,
  onClose,
  onIngest,
  onIngestUrl,
  onIngestFile,
  chunkingConfig,
  onSuccess,
}: AddSourceDialogProps) {
  const [mode, setMode] = useState<"text" | "url" | "file">("text");
  const [sourceUri, setSourceUri] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    // 验证文件类型
    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      setError(`不支持的文件类型: ${ext}。支持的格式: ${SUPPORTED_EXTENSIONS.join(", ")}`);
      return;
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      setError(`文件大小超过限制 (最大 ${formatFileSize(MAX_FILE_SIZE)})`);
      return;
    }

    setSelectedFile(file);
    setSourceUri(file.name);
    setError(null);
  };

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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setSourceUri("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleIngest = async () => {
    if (!corpusId || isSubmitting) return;

    if (mode === "text" && !text.trim()) return;
    if (mode === "url" && !url.trim()) return;
    if (mode === "file" && !selectedFile) return;

    setIsSubmitting(true);
    setError(null);
    try {
      if (mode === "text") {
        await onIngest({
          text,
          source_uri: sourceUri || undefined,
          chunkingConfig,
        });
        toast.success("已开始摄入知识源", {
          description: "可在 Pipeline 页面查看构建进度",
        });
      } else if (mode === "url") {
        await onIngestUrl({ url, chunkingConfig });
        toast.success("已开始从 URL 摄入知识源", {
          description: "可在 Pipeline 页面查看构建进度",
        });
      } else if (mode === "file" && onIngestFile) {
        await onIngestFile({
          file: selectedFile!,
          source_uri: sourceUri || undefined,
          chunkingConfig,
        });
        toast.success("已开始从文件摄入知识源", {
          description: "可在 Pipeline 页面查看构建进度",
        });
      }
      // Reset form
      setSourceUri("");
      setText("");
      setUrl("");
      setSelectedFile(null);
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      toast.error("摄入失败", {
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSourceUri("");
    setText("");
    setUrl("");
    setSelectedFile(null);
    setError(null);
    onClose();
  };

  // 切换模式时重置文件选择
  const handleModeChange = (newMode: "text" | "url" | "file") => {
    setMode(newMode);
    setError(null);
    if (newMode !== "file") {
      setSelectedFile(null);
      setSourceUri("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 dark:bg-zinc-900">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Add Source
          </h2>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="mb-4 flex gap-4 text-xs">
          <button
            onClick={() => handleModeChange("text")}
            className={`pb-1 font-medium ${
              mode === "text"
                ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Raw Text
          </button>
          <button
            onClick={() => handleModeChange("url")}
            className={`pb-1 font-medium ${
              mode === "url"
                ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            From URL
          </button>
          <button
            onClick={() => handleModeChange("file")}
            className={`pb-1 font-medium ${
              mode === "file"
                ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Import from File
          </button>
        </div>

        {/* Content */}
        {mode === "text" ? (
          <>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Source URI (optional)
              </label>
              <input
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
                placeholder="e.g., document.pdf"
                value={sourceUri}
                onChange={(e) => setSourceUri(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
                rows={6}
                placeholder="Paste knowledge text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          </>
        ) : mode === "url" ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              URL <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        ) : (
          <div>
            {/* File Upload Area */}
            <div
              className={`
                border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
                ${dragActive
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-600 dark:hover:border-zinc-500"
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
                accept={SUPPORTED_EXTENSIONS.join(",")}
                onChange={handleFileInput}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  {/* File Icon */}
                  <svg className="h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {selectedFile.name}
                  </span>
                  <span className="text-xs text-zinc-400">
                    ({formatFileSize(selectedFile.size)})
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFile();
                    }}
                    className="text-zinc-400 hover:text-red-500 ml-1"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div>
                  {/* Upload Icon */}
                  <svg className="mx-auto h-8 w-8 text-zinc-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    拖拽文件到此处，或 <span className="text-blue-500">点击选择</span>
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    支持 .txt, .md, .pdf (最大 {formatFileSize(MAX_FILE_SIZE)})
                  </p>
                </div>
              )}
            </div>

            {/* Source URI for file */}
            {selectedFile && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Source URI
                </label>
                <input
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
                  placeholder="e.g., document.pdf"
                  value={sourceUri}
                  onChange={(e) => setSourceUri(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleIngest}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            disabled={
              isSubmitting ||
              !corpusId ||
              (mode === "text" && !text.trim()) ||
              (mode === "url" && !url.trim()) ||
              (mode === "file" && !selectedFile)
            }
          >
            {isSubmitting ? "Processing..." : "Ingest"}
          </button>
        </div>
      </div>
    </div>
  );
}
