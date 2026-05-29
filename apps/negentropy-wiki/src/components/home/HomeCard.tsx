interface HomeCardProps {
  title: string;
  href: string;
  description: string;
  icon: React.ReactNode;
}

export function HomeCard({ title, href, description, icon }: HomeCardProps) {
  return (
    <a href={href} className="home-card">
      <div className="home-card-icon">{icon}</div>
      <h3 className="home-card-title">{title}</h3>
      <p className="home-card-desc">{description}</p>
    </a>
  );
}
