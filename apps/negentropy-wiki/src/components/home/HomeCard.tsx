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

interface HomeCardEmptyProps {
  label: string;
  icon: React.ReactNode;
}

export function HomeCardEmpty({ label, icon }: HomeCardEmptyProps) {
  return (
    <div className="home-card home-card--disabled" aria-disabled="true">
      <div className="home-card-icon">{icon}</div>
      <h3 className="home-card-title">{label}</h3>
      <p className="home-card-desc">即将上线</p>
    </div>
  );
}
