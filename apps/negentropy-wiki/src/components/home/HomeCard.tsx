interface HomeCardProps {
  href?: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function HomeCard({ href, icon, title, description }: HomeCardProps) {
  const inner = (
    <>
      <div className="home-card-icon">{icon}</div>
      <h3 className="home-card-title">{title}</h3>
      <p className="home-card-desc">{description}</p>
    </>
  );

  if (!href) {
    return (
      <div className="home-card home-card--disabled" aria-disabled="true">
        {inner}
      </div>
    );
  }

  return (
    <a href={href} className="home-card">
      {inner}
    </a>
  );
}
