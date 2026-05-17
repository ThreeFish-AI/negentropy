interface BreadcrumbItem {
  label: string;
  slug: string | null;
}

interface WikiBreadcrumbProps {
  items: BreadcrumbItem[];
  pubSlug: string;
}

export function WikiBreadcrumb({ items, pubSlug }: WikiBreadcrumbProps) {
  if (items.length <= 1) return null;

  return (
    <nav aria-label="面包屑" style={{ fontSize: "0.88em", marginBottom: "0.5rem" }}>
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && (
            <span style={{ color: "var(--wiki-text-secondary)", margin: "0 0.4rem" }}>
              /
            </span>
          )}
          {item.slug ? (
            <a
              href={`/${pubSlug}/${item.slug}`}
              style={{ color: "var(--wiki-text-secondary)", textDecoration: "none" }}
            >
              {item.label}
            </a>
          ) : (
            <span style={{ color: "var(--wiki-text)" }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
