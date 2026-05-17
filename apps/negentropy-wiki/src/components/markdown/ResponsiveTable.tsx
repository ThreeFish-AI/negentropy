interface ResponsiveTableProps {
  children: React.ReactNode;
}

export function ResponsiveTable({ children }: ResponsiveTableProps) {
  return (
    <div style={{ overflowX: "auto", margin: "1em 0" }}>
      <table className="wiki-responsive-table">{children}</table>
    </div>
  );
}
