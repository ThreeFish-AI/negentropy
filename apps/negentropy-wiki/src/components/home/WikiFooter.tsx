import { FOOTER_LINK_GROUPS } from "./footer-links";

export function WikiFooter() {
  return (
    <footer className="wiki-footer">
      <div className="wiki-footer-inner">
        {FOOTER_LINK_GROUPS.map((group) => (
          <div key={group.title} className="wiki-footer-col">
            <h4 className="wiki-footer-col-title">{group.title}</h4>
            <ul className="wiki-footer-col-links">
              {group.links.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="wiki-footer-link">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="wiki-footer-bottom">
          <p>
            Copyright &copy; {new Date().getFullYear()} 三余知行. 保留所有权利{" "}
            <a style={{ color: "#6ea8fe" }} href="https://beian.miit.gov.cn">
              粤ICP备2023147376号-1
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
