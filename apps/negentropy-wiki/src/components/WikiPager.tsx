interface PagerLink {
  title: string;
  slug: string;
}

interface WikiPagerProps {
  prev: PagerLink | null;
  next: PagerLink | null;
  pubSlug: string;
}

export function WikiPager({ prev, next, pubSlug }: WikiPagerProps) {
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="页面导航"
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "1rem",
        marginTop: "3rem",
        paddingTop: "1.5rem",
        borderTop: "1px solid var(--wiki-border)",
        fontSize: "0.92em",
      }}
    >
      {prev ? (
        <a
          href={`/${pubSlug}/${prev.slug}`}
          style={{
            color: "var(--wiki-accent)",
            textDecoration: "none",
            maxWidth: "45%",
          }}
        >
          <span style={{ fontSize: "0.82em", color: "var(--wiki-text-secondary)" }}>
            ← 上一页
          </span>
          <br />
          <span style={{ fontWeight: 500 }}>{prev.title}</span>
        </a>
      ) : (
        <div />
      )}
      {next ? (
        <a
          href={`/${pubSlug}/${next.slug}`}
          style={{
            color: "var(--wiki-accent)",
            textDecoration: "none",
            textAlign: "right",
            maxWidth: "45%",
          }}
        >
          <span style={{ fontSize: "0.82em", color: "var(--wiki-text-secondary)" }}>
            下一页 →
          </span>
          <br />
          <span style={{ fontWeight: 500 }}>{next.title}</span>
        </a>
      ) : (
        <div />
      )}
    </nav>
  );
}
