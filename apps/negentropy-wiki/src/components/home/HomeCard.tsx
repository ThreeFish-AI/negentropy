import type { WikiPublication } from "@/lib/wiki-api";

interface HomeCardProps {
  publication: WikiPublication;
  icon: React.ReactNode;
}

export function HomeCard({ publication, icon }: HomeCardProps) {
  const href = `/${publication.slug}`;
  const description = publication.description || "暂无描述";

  return (
    <a href={href} className="home-card">
      <div className="home-card-icon">{icon}</div>
      <h3 className="home-card-title">{publication.name}</h3>
      <p className="home-card-desc">{description}</p>
    </a>
  );
}
