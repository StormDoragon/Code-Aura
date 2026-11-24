import { languages, MAX_FILES, type Language } from "./source";

export const categories = [
  { key: "cleanliness", label: "Cleanliness", weight: 30, color: "#c3a7ff" },
  { key: "naming", label: "Naming Vibes", weight: 25, color: "#90ddc8" },
  { key: "comments", label: "Comment Personality", weight: 15, color: "#edbd93" },
  { key: "flow", label: "Readability Flow", weight: 30, color: "#a3bcff" },
] as const;

export type Category = (typeof categories)[number]["key"];

export type CategoryScores = Record<Category, { score: number; note: string }>;

export type Feedback = {
  title: string;
  detail: string;
};

export type Suggestion = Feedback & {
  path: string | null;
  line: number | null;
  before: string | null;
  after: string | null;
};

export type ReviewBody = {
  summary: string;
  scores: CategoryScores;
  strengths: Feedback[];
  suggestions: Suggestion[];
};

export type ReviewReport = ReviewBody & {
  id: string;
  createdAt: string;
  mode: "built-in" | "claude" | "sample";
  notice?: string;
  files: { path: string; language: Language; lines: number }[];
};

export type Snapshot = {
  id: string;
  createdAt: string;
  fileCount: number;
  languages: Language[];
  scores: Record<Category, number>;
};

export function formatReportDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  }).format(new Date(date));
}

export function auraScore(scores: Snapshot["scores"]) {
  return Math.round(categories.reduce((sum, { key, weight }) => sum + scores[key] * weight, 0) / 100);
}

export function snapshotOf(report: ReviewReport): Snapshot {
  const { cleanliness, naming, comments, flow } = report.scores;

  return {
    id: report.id,
    createdAt: report.createdAt,
    fileCount: report.files.length,
    languages: Array.from(new Set(report.files.map((file) => file.language))),
    scores: {
      cleanliness: cleanliness.score,
      naming: naming.score,
      comments: comments.score,
      flow: flow.score,
    },
  };
}

export function auraLabel(score: number) {
  if (score >= 92) return "Radiant";
  if (score >= 82) return "In flow";
  if (score >= 68) return "Finding rhythm";
  return "Needs room";
}

export function auraColor(score: number) {
  if (score >= 92) return "#a2ebce";
  if (score >= 82) return "#c3a7ff";
  if (score >= 68) return "#a3bcff";
  return "#edbd93";
}

export function encodeSnapshot(snapshot: Snapshot) {
  const { scores } = snapshot;
  const encoded = btoa(
    JSON.stringify([
      1,
      snapshot.createdAt,
      snapshot.fileCount,
      ...categories.map(({ key }) => scores[key]),
      snapshot.languages,
    ]),
  );

  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function validScore(score: unknown): score is number {
  return typeof score === "number" && Number.isInteger(score) && score >= 0 && score <= 100;
}

function validLanguage(language: unknown): language is Language {
  return typeof language === "string" && Object.hasOwn(languages, language);
}

export function decodeSnapshot(encoded: string): Snapshot | null {
  if (!/^[a-z\d_-]{1,512}$/i.test(encoded)) return null;

  try {
    const tuple: unknown = JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")));
    if (!Array.isArray(tuple) || tuple.length !== 8) return null;

    const [version, createdAt, fileCount, cleanliness, naming, comments, flow, usedLanguages] = tuple;

    if (
      version !== 1 ||
      typeof createdAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt) ||
      !Number.isFinite(Date.parse(createdAt)) ||
      !Number.isInteger(fileCount) ||
      fileCount < 1 ||
      fileCount > MAX_FILES ||
      !validScore(cleanliness) ||
      !validScore(naming) ||
      !validScore(comments) ||
      !validScore(flow) ||
      !Array.isArray(usedLanguages) ||
      usedLanguages.length === 0 ||
      usedLanguages.length > fileCount ||
      !usedLanguages.every(validLanguage)
    ) {
      return null;
    }

    return {
      id: encoded,
      createdAt,
      fileCount,
      languages: Array.from(new Set(usedLanguages)),
      scores: { cleanliness, naming, comments, flow },
    };
  } catch {
    return null;
  }
}
