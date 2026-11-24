import Link from "next/link";
import { ArrowUpRight, CodeXml, Github, History, Sparkles } from "lucide-react";

const repository = "https://github.com/StormDoragon/Code-Aura";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="CodeAura home">
      <span className="brand-mark"><CodeXml size={20} strokeWidth={1.8} aria-hidden="true" /></span>
      <span>Code<span className="brand-aura">Aura</span></span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Brand />
        <nav className="header-links" aria-label="Primary">
          <Link href="/#workspace">Workspace</Link>
          <Link href="/report/sample">Sample report</Link>
        </nav>
        <div className="header-actions">
          <Link href="/history" className="header-history"><History size={16} aria-hidden="true" /> <span>History</span></Link>
          <a href={repository} target="_blank" rel="noreferrer" className="github-link" aria-label="CodeAura on GitHub">
            <Github size={19} aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <span><Sparkles size={15} aria-hidden="true" /> CodeAura</span>
        <a href={repository} target="_blank" rel="noreferrer">Source on GitHub <ArrowUpRight size={14} aria-hidden="true" /></a>
      </div>
    </footer>
  );
}
