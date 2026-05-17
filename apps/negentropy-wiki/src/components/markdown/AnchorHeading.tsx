interface AnchorHeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
  id?: string;
}

export function AnchorHeading({ level, children, id }: AnchorHeadingProps) {
  const className = id ? "wiki-anchor-heading" : undefined;

  const inner = id ? (
    <>
      <a href={`#${id}`} className="wiki-anchor-link" aria-label={`链接到此章节`}>
        #
      </a>
      {children}
    </>
  ) : (
    children
  );

  switch (level) {
    case 1: return <h1 id={id} className={className}>{inner}</h1>;
    case 2: return <h2 id={id} className={className}>{inner}</h2>;
    case 3: return <h3 id={id} className={className}>{inner}</h3>;
    case 4: return <h4 id={id} className={className}>{inner}</h4>;
    case 5: return <h5 id={id} className={className}>{inner}</h5>;
    case 6: return <h6 id={id} className={className}>{inner}</h6>;
  }
}
