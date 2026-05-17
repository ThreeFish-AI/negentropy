"use client";

export type ViewMode = "edit" | "publish";

interface ModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-full bg-muted/60 p-0.5">
      <button
        onClick={() => onChange("edit")}
        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
          value === "edit"
            ? "bg-foreground text-background shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Catalog
      </button>
      <button
        onClick={() => onChange("publish")}
        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
          value === "publish"
            ? "bg-foreground text-background shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Publish
      </button>
    </div>
  );
}
