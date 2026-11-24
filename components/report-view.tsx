import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, FileCode2, FolderOpen, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { auraColor, auraLabel, auraScore, categories, formatReportDate, snapshotOf, type ReviewReport, type Snapshot } from "@/lib/report";
import { languages } from "@/lib/source";
import { CodeSurface } from "./code-surface";
import { ShareActions } from "./share-actions";

function Overview({ snapshot, report }: { snapshot: Snapshot; report?: ReviewReport }) {
  const score = auraScore(snapshot.scores);
  const palette = { "--aura-color": auraColor(score), "--aura-value": score + "%" } as CSSProperties;

  return (
    <section className="report-overview" style={palette} aria-label="Overall Aura">
      <div className="report-meter" aria-label={score + " out of 100"}>
        <div className="report-meter-center">
          <strong>{score}</strong>
          <span>out of 100</span>
        </div>
      </div>
      <div className="report-intro">
        <span className="eyebrow report-eyebrow"><Sparkles size={15} aria-hidden="true" /> Overall Aura</span>
        <h2>{auraLabel(score)}</h2>
        <p>{report?.summary ?? "A review of how the code reads across structure, naming, comments, and flow."}</p>
        <div className="report-meta">
          <span><FolderOpen size={15} aria-hidden="true" /> {snapshot.fileCount} {snapshot.fileCount === 1 ? "file" : "files"}</span>
          {snapshot.languages.map((language) => <span key={language}>{languages[language].label}</span>)}
        </div>
      </div>
    </section>
  );
}

function Breakdown({ snapshot, report }: { snapshot: Snapshot; report?: ReviewReport }) {
  return (
    <section className="report-section" aria-labelledby="breakdown-title">
      <div className="section-heading">
        <h2 id="breakdown-title">Score breakdown</h2>
      </div>
      <div className="score-grid">
        {categories.map(({ key, label, color }) => {
          const value = snapshot.scores[key];
          const style = { "--metric-color": color, "--metric-value": value + "%" } as CSSProperties;
          return (
            <article className="score-card" key={key} style={style}>
              <h3><span className="metric-dot" aria-hidden="true" /> {label}</h3>
              <div className="metric-number"><strong>{value}</strong> <span>/ 100</span></div>
              <div className="score-track" aria-hidden="true"><span /></div>
              {report && <p>{report.scores[key].note}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Feedback({ report }: { report: ReviewReport }) {
  return (
    <div className={"feedback-columns report-section" + (report.strengths.length ? "" : " suggestions-only")}>
      {report.strengths.length > 0 && <section aria-labelledby="strengths-title">
        <div className="section-heading"><h2 id="strengths-title">What’s working</h2></div>
        <div className="feedback-list">
          {report.strengths.map((item, index) => (
            <article className="feedback-card strength-card" key={index}>
              <div className="strength-icon"><Check size={16} aria-hidden="true" /></div>
              <div><h3>{item.title}</h3><p>{item.detail}</p></div>
            </article>
          ))}
        </div>
      </section>}
      <section aria-labelledby="suggestions-title">
        <div className="section-heading"><h2 id="suggestions-title">Worth a second look</h2></div>
        <div className="feedback-list">
          {report.suggestions.length === 0 && <article className="feedback-card"><p>The code has a steady rhythm. The score breakdown shows what helped it read smoothly.</p></article>}
          {report.suggestions.map((item, index) => (
            <article className="feedback-card" key={index}>
              <h3>{item.title}</h3>
              {item.path && (
                <div className="suggestion-location"><FileCode2 size={14} aria-hidden="true" /> <code>{item.path}{item.line ? "#" + item.line : ""}</code></div>
              )}
              <p>{item.detail}</p>
              {item.before && item.after && (
                <div className="rewrite-grid">
                  <div className="rewrite">
                    <span>Before</span>
                    <CodeSurface path={item.path || "snippet.txt"} code={item.before} label="Original code excerpt" />
                  </div>
                  <div className="rewrite after">
                    <span>After</span>
                    <CodeSurface path={item.path || "snippet.txt"} code={item.after} label="Suggested rewrite" />
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ReportView({ report, snapshot: shared }: { report?: ReviewReport; snapshot?: Snapshot }) {
  const snapshot = report ? snapshotOf(report) : shared;
  if (!snapshot) return null;
  const title = report?.mode === "sample" ? "Sample Aura report" : report ? "Your Aura report" : "Shared Aura report";
  const mode = report?.mode === "claude" ? "Claude review" : report ? "Built-in review" : "Shared scores";

  return (
    <main className="shell report-main" id="main">
      <div className="report-topbar">
        <Link href="/#workspace" className="text-button muted back-link"><ArrowLeft size={16} aria-hidden="true" /> Workspace</Link>
        <ShareActions snapshot={snapshot} />
      </div>
      <div className="report-title">
        <h1>{title}</h1>
        <p>{mode}{report?.mode !== "sample" && " · " + formatReportDate(snapshot.createdAt)}</p>
      </div>
      {report?.notice && <p className="report-notice" role="status">{report.notice}</p>}
      <Overview snapshot={snapshot} report={report} />
      <Breakdown snapshot={snapshot} report={report} />
      {report && <Feedback report={report} />}
      {report && (
        <details className="reviewed-files">
          <summary><FolderOpen size={17} aria-hidden="true" /> Reviewed files <span>{report.files.length}</span> <ChevronDown size={16} aria-hidden="true" /></summary>
          <ul>
            {report.files.map(({ path, language, lines }) => (
              <li key={path}><FileCode2 size={16} aria-hidden="true" /> <code>{path}</code><span>{languages[language].label} · {lines} {lines === 1 ? "line" : "lines"}</span></li>
            ))}
          </ul>
        </details>
      )}
      <div className="report-end">
        <Link href="/#workspace" className="button secondary">Start a review <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
    </main>
  );
}
