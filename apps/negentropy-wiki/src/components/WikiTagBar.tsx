interface WikiTagBarProps {
  tags: string[];
}

export function WikiTagBar({ tags }: WikiTagBarProps) {
  if (!tags.length) return null;

  return (
    <div className="wiki-tag-bar">
      {tags.map((tag) => (
        <span key={tag} className="wiki-tag-pill">
          {tag}
        </span>
      ))}
    </div>
  );
}
