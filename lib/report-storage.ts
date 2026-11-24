import { decodeSnapshot, encodeSnapshot, snapshotOf, type ReviewReport, type Snapshot } from "./report";

const reportKey = "codeaura:latest:v1";
const historyKey = "codeaura:history:v1";
const historyLimit = 20;
let currentReport: ReviewReport | null = null;

export function latestReport(): ReviewReport | null {
  if (currentReport) return currentReport;

  try {
    const stored = sessionStorage.getItem(reportKey);
    return stored ? JSON.parse(stored) as ReviewReport : null;
  } catch {
    return null;
  }
}

function savedHistory(): string[] {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(historyKey) ?? "[]");
    if (!Array.isArray(values)) return [];
    return values.slice(0, historyLimit).filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

export function reportHistory(): Snapshot[] {
  return savedHistory().flatMap((value) => {
    const snapshot = decodeSnapshot(value);
    return snapshot ? [snapshot] : [];
  });
}

export function saveReport(report: ReviewReport) {
  currentReport = report;

  try {
    sessionStorage.setItem(reportKey, JSON.stringify(report));
  } catch {
    // The in-memory report is still available during this visit.
  }

  try {
    const snapshot = encodeSnapshot(snapshotOf(report));
    const history = [snapshot, ...savedHistory().filter((value) => value !== snapshot)];
    localStorage.setItem(historyKey, JSON.stringify(history.slice(0, historyLimit)));
  } catch {
    // Browser history storage is optional.
  }
}
