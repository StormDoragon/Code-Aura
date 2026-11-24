export const MAX_FILES = 8;
export const MAX_FILE_BYTES = 24 * 1024;
export const MAX_SOURCE_BYTES = 64 * 1024;
export const MAX_REQUEST_BYTES = 420 * 1024;
export const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;
export const MAX_UPLOAD_CANDIDATES = 120;

export const languages = {
  ts: { label: "TypeScript", extensions: ["ts", "tsx", "mts", "cts"] },
  js: { label: "JavaScript", extensions: ["js", "jsx", "mjs", "cjs"] },
  python: { label: "Python", extensions: ["py", "pyi"] },
  go: { label: "Go", extensions: ["go"] },
  rust: { label: "Rust", extensions: ["rs"] },
  json: { label: "JSON", extensions: ["json", "jsonc"] },
  css: { label: "CSS", extensions: ["css", "scss"] },
  html: { label: "HTML", extensions: ["html", "htm"] },
  markdown: { label: "Markdown", extensions: ["md", "mdx"] },
  text: { label: "Plain text", extensions: ["txt"] },
} as const;

export type Language = keyof typeof languages;

export type SourceFile = {
  path: string;
  code: string;
};

export type RepositoryFile = {
  path: string;
  sha: string;
  size: number;
};

export type RepositoryTree = {
  repository: string;
  branch: string;
  files: RepositoryFile[];
  truncated: boolean;
};

export type ReviewInput =
  | { mode: "files"; files: SourceFile[] }
  | { mode: "github"; repository: string; files: Pick<RepositoryFile, "path" | "sha">[] };

const languageByExtension = new Map<string, Language>();
for (const [language, { extensions }] of Object.entries(languages)) {
  for (const extension of extensions) {
    languageByExtension.set(extension, language as Language);
  }
}

const encoder = new TextEncoder();

export function fileExtension(path: string) {
  const name = path.split("/").at(-1) ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function languageFor(path: string): Language {
  return languageByExtension.get(fileExtension(path)) ?? "text";
}

export function isSupportedFile(path: string) {
  return languageByExtension.has(fileExtension(path));
}

export function isSafePath(path: string) {
  return (
    path.length > 0 &&
    path.length <= 260 &&
    !path.includes("\\") &&
    Array.from(path).every((character) => character >= " " && character.charCodeAt(0) !== 127) &&
    path.split("/").every((part) => part && part !== "." && part !== "..")
  );
}

export function byteLength(text: string) {
  return encoder.encode(text).length;
}

export function describeBytes(size: number) {
  return size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`;
}

export function sourceProblem(files: SourceFile[]) {
  if (files.length === 0) return "Add at least one file with code.";
  if (files.length > MAX_FILES) return `Choose up to ${MAX_FILES} files per review.`;

  const paths = new Set<string>();
  let total = 0;

  for (const file of files) {
    if (!isSafePath(file.path)) return "Enter a valid name for each file.";
    if (paths.has(file.path)) return `Use a different name for each file. “${file.path}” appears twice.`;
    paths.add(file.path);

    if (!file.code.trim()) return `Add code to “${file.path}” or remove it from the review.`;
    if (file.code.includes(String.fromCharCode(0))) return `“${file.path}” must contain plain text.`;

    const size = byteLength(file.code);
    if (size > MAX_FILE_BYTES) {
      return `“${file.path}” is over the ${MAX_FILE_BYTES / 1024} KB per-file limit.`;
    }
    total += size;
  }

  if (total > MAX_SOURCE_BYTES) return `Keep the selected files under ${MAX_SOURCE_BYTES / 1024} KB total.`;
}

export function parseRepository(input: string): string | null {
  const text = input.trim();
  let path = text;

  if (text.startsWith("https://")) {
    try {
      const url = new URL(text);
      if (url.origin !== "https://github.com" || url.username || url.password) return null;
      path = url.pathname.slice(1);
    } catch {
      return null;
    }
  }

  path = path.replace(/\/$/, "").replace(/\.git$/i, "");
  return /^[a-z\d][a-z\d-]{0,38}\/[a-z\d._-]{1,100}$/i.test(path) &&
    !path.endsWith("/.") &&
    !path.endsWith("/..")
    ? path
    : null;
}
