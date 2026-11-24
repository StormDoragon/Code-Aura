"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Clock3, Sparkles } from "lucide-react";
import { auraColor, auraLabel, auraScore, encodeSnapshot, formatReportDate, type Snapshot } from "@/lib/report";
import { reportHistory } from "@/lib/report-storage";
import { languages } from "@/lib/source";

export function HistoryView() {
  const [history, setHistory] = useState<Snapshot[] | null>(null);
  useEffect(() => {
    setHistory(reportHistory());
  }, []);

  return (
    <main id="main" className="shell report-main history-main">
      <div className="report-topbar">
        <Link href="/#workspace" className="text-button muted back-link"><ArrowLeft size={16} aria-hidden="true" /> Workspace</Link>
        <Link href="/#workspace" className="button primary compact"><Sparkles size={16} aria-hidden="true" /> New review</Link>
      </div>
      <div className="report-title">
        <h1>Aura history</h1>
        <p>Recent scores saved in this browser.</p>
      </div>
      {history?.length ? (
        <ul className="history-list">
          {history.map((snapshot) => {
            const score = auraScore(snapshot.scores);
            return (
              <li key={snapshot.id}>
                <Link href={"/share?s=" + encodeSnapshot(snapshot)} className="history-row">
                  <span className="history-score" style={{ "--aura-color": auraColor(score) } as CSSProperties}>{score}</span>
                  <span className="history-label"><strong>{auraLabel(score)}</strong><span>{snapshot.fileCount} {snapshot.fileCount === 1 ? "file" : "files"} · {snapshot.languages.map((language) => languages[language].label).join(", ")}</span></span>
                  <time dateTime={snapshot.createdAt}>{formatReportDate(snapshot.createdAt)}</time>
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="history-empty">
          <span className="drop-icon"><Clock3 size={24} aria-hidden="true" /></span>
          <h2>{history === null ? "Loading history…" : "Your first score goes here"}</h2>
          {history && <p>Run a review to save a score you can come back to.</p>}
        </div>
      )}
    </main>
  );
}
