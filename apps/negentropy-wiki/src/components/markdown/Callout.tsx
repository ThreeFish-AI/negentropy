interface CalloutProps {
  type?: "note" | "tip" | "warn" | "danger";
  title?: string;
  children: React.ReactNode;
}

export function Callout({ type = "note", title, children }: CalloutProps) {
  const labels: Record<string, string> = {
    note: "Note",
    tip: "Tip",
    warn: "Warning",
    danger: "Danger",
  };

  return (
    <div className={`wiki-callout wiki-callout-${type}`}>
      {title && <div className="wiki-callout-title">{title}</div>}
      <div>{children}</div>
    </div>
  );
}
