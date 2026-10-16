import type { PublicServicePage } from "../../api/src/contracts/s03";
import { RichText } from "./rich-text";

export type PublicNavigationLink = { href: string; label: string; current?: boolean };

export function PublicShell({ site, navigation, breadcrumbs = [], children }: {
  site: PublicServicePage["site"];
  navigation: PublicNavigationLink[];
  breadcrumbs?: PublicNavigationLink[];
  children: React.ReactNode;
}) {
  return <>
    <a className="skip" href="#main-content">Đến nội dung chính</a>
    <header className="public-header"><span className="site-name">{site.name}</span>
      <nav className="public-nav" aria-label="Điều hướng website"><ul>{navigation.map(link => <li key={link.href}><a href={link.href} aria-current={link.current ? "page" : undefined}>{link.label}</a></li>)}</ul></nav>
    </header>
    <main id="main-content" className="content-page">
      {breadcrumbs.length > 0 && <nav className="breadcrumbs" aria-label="Đường dẫn"><ol>{breadcrumbs.map(link => <li key={link.href}>{link.current ? <span aria-current="page">{link.label}</span> : <a href={link.href}>{link.label}</a>}</li>)}</ol></nav>}
      {children}
    </main>
    <footer className="site-footer">{site.footer.intro && <p>{site.footer.intro}</p>}<RichText document={site.footer.body}/></footer>
  </>;
}
