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
    <nav className="wiki-doc-breadcrumb" aria-label="面包屑">
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span className="wiki-doc-breadcrumb-sep">›</span>}
          {item.slug ? (
            <a href={`/${pubSlug}/${item.slug}`} className="wiki-doc-breadcrumb-link">
              {item.label}
            </a>
          ) : (
            <span className="wiki-doc-breadcrumb-text">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
