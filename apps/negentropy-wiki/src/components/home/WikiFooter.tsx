import { FOOTER_LINK_GROUPS } from "./footer-links";

export function WikiFooter() {
  return (
    <footer className="home-footer">
      <div className="home-footer-inner">
        {FOOTER_LINK_GROUPS.map((group) => (
          <div key={group.title} className="home-footer-col">
            <h4 className="home-footer-col-title">{group.title}</h4>
            <ul className="home-footer-col-links">
              {group.links.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="home-footer-link">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="home-footer-bottom">
          <p>&copy; {new Date().getFullYear()} Negentropy Wiki. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
