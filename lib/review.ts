import { randomUUID } from "node:crypto";
import { auraScore, categories, type CategoryScores, type Feedback, type ReviewBody, type ReviewReport, type Suggestion } from "./report";
import { sampleFile } from "./sample";
import { languageFor, type Language, type SourceFile } from "./source";

const descriptiveNames = /\b(?:const|let|var|function|func|fn|def)\s+([A-Za-z_$][\w$]*)/g;
const genericName = /^(?:foo|bar|tmp\d*|temp\d*|data\d*|val\d*|obj\d*|stuff|thing\d*|res\d*|arr\d*)$/i;
const reason = /\b(?:because|so that|since|avoid|preserve|keep|only once|expected|required|invariant|compatibility)\b/i;
const branch = /^(?:\}\s*)?(?:(?:else\s+)?if|elif|for|while|switch|match|except|catch)\b/;
const noNames = new Set<Language>(["css", "html", "markdown", "text", "json"]);

function stripQuoted(line: string) {
  return line.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\x60(?:\\.|[^\x60\\])*\x60/g, (literal) =>
    " ".repeat(literal.length),
  );
}

function measure(file: SourceFile) {
  const language = languageFor(file.path);
  const lines = file.code.replace(/\r\n?/g, "\n").trimEnd().split("\n");
  const near = new Map<number, string>();
  const branchIndents: number[] = [];
  const indentStyles = new Set<string>();
  const names = new Set<string>();
  const comments: string[] = [];
  let widest = 0;
  let branchCount = 0;
  let activeLines = 0;
  let insideComment = false;

  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    if (/[ \t]$/.test(line)) near.set(index, "trailing");
    if (line.length > 100) {
      widest = Math.max(widest, line.length);
      near.set(index, "wide");
    }

    const scrubbed = stripQuoted(line);
    if (insideComment) {
      const end = scrubbed.indexOf("*/");
      comments.push(line.slice(0, end === -1 ? undefined : end).trim());
      insideComment = end === -1;
      continue;
    }

    const lineMarker = language === "python" ? "#" : "//";
    const commentAt = language === "css" || noNames.has(language) ? -1 : scrubbed.indexOf(lineMarker);
    const blockAt = language === "python" ? -1 : scrubbed.indexOf("/*");
    const startsBlock = blockAt !== -1 && (commentAt === -1 || blockAt < commentAt);
    const marker = startsBlock ? blockAt : commentAt;
    if (marker !== -1) {
      comments.push(line.slice(marker + (startsBlock ? 2 : lineMarker.length)).trim());
      if (startsBlock) insideComment = scrubbed.indexOf("*/", marker + 2) === -1;
    }

    const code = (marker === -1 ? scrubbed : scrubbed.slice(0, marker)).trim();
    if (!code) continue;
    activeLines += 1;
    const leading = line.match(/^[ \t]*/)?.[0] ?? "";
    if (leading && !/^[}\])]/.test(code)) indentStyles.add(leading[0]);
    const indent = leading.replace(/\t/g, "    ").length;
    while (branchIndents.length && branchIndents.at(-1)! >= indent) branchIndents.pop();

    if (branch.test(code)) {
      branchCount += 1;
      if (branchIndents.length >= 2 && !near.has(index)) near.set(index, "nested");
      if (/[{:]\s*$/.test(code)) branchIndents.push(indent);
    }

    if (noNames.has(language)) continue;
    for (const [, name] of code.matchAll(descriptiveNames)) names.add(name);
    const binding =
      language === "go" ? code.match(/^([A-Za-z_]\w*)\s*:=/) :
      language === "python" ? code.match(/^([A-Za-z_]\w*)\s*=(?!=)/) :
      null;
    if (binding) names.add(binding[1]);
  }

  const locations = (tag: string) => [...near].filter(([, value]) => value === tag).map(([line]) => line + 1);

  return {
    lines,
    widest,
    branchCount,
    activeLines,
    indentStyles,
    wide: locations("wide"),
    trailing: locations("trailing"),
    nested: locations("nested"),
    genericNames: [...names].filter((name) => genericName.test(name)),
    meaningfulName: [...names].find((name) => !genericName.test(name) && name.length > 3),
    nameCount: names.size,
    comments,
  };
}

function guardClause(file: SourceFile): Suggestion | null {
  if (!["ts", "js"].includes(languageFor(file.path))) return null;

  const code = file.code.replace(/\r\n?/g, "\n");
  const pattern = /^(?<indent>[ \t]*)if \([\w$.!\s=<>+\d-]+\) \{\n[ \t]+return [^\n]+;\n\k<indent>\} else \{\n[ \t]+(?<body>return [^\n]+;)\n\k<indent>\}$/m;
  const match = code.match(pattern);
  const precedingLine = match && code.slice(0, match.index).trimEnd().split("\n")
    .reverse().find((line) => line.trim() && !line.trimStart().startsWith("//"));
  if (!match?.groups || match[0].length > 600 || (precedingLine && !/[;{}]\s*$/.test(precedingLine))) {
    return null;
  }

  const { indent, body } = match.groups;
  const [condition, earlyReturn] = match[0].split("\n");

  return {
    title: "Let the happy path breathe",
    detail: "The first branch already returns. Let it handle the special case, then bring the main return back to the same indentation as the rest of the function.",
    path: file.path,
    line: code.slice(0, match.index).split("\n").length,
    before: match[0],
    after: [condition, earlyReturn, indent + "}", "", indent + body].join("\n"),
  };
}

function scoreFile(file: SourceFile) {
  const m = measure(file);
  const guard = guardClause(file);
  const mixedIndent = m.indentStyles.size > 1;
  const widePenalty = Math.min(34, m.wide.length * 4 + Math.ceil(Math.max(0, m.widest - 120) / 18));
  const sparse = m.activeLines > 20 && m.lines.length > m.activeLines * 2.6;
  const vagueComments = m.comments.filter((comment) => /^(?:todo|fixme|hack|comment)[.!:]?$/i.test(comment));
  const usefulComments = m.comments.some((comment) => reason.test(comment));
  const busyComments = m.activeLines > 10 && m.comments.length > m.activeLines;
  const longWithoutContext = m.branchCount > 5 && m.activeLines > 45 && m.comments.length === 0;

  const scores: CategoryScores = {
    cleanliness: {
      score: Math.max(10, 96 - widePenalty - Math.min(15, m.trailing.length * 2) - (mixedIndent ? 12 : 0) - (sparse ? 6 : 0)),
      note: m.wide.length
        ? "A few wide lines crowd the editor. Breaking them at meaningful boundaries would give the structure more room."
        : mixedIndent || m.trailing.length
          ? "The file has a clear shape. A pass over whitespace would make the visual rhythm steadier."
          : "Indentation and line widths give the code a steady rhythm.",
    },
    naming: {
      score: Math.max(25, 94 - Math.min(57, m.genericNames.length * 10)),
      note: m.genericNames.length
        ? "Some names ask the reader to look elsewhere for context. The values could carry a little more of their own story."
        : m.nameCount
          ? "The visible declarations give the reader something concrete to hold on to."
          : "There are few declarations to judge. The score reflects the limited naming evidence in this file.",
    },
    comments: {
      score: Math.max(25, (usefulComments ? 97 : 92) - Math.min(18, vagueComments.length * 6) - (busyComments ? 18 : 0) - (longWithoutContext ? 10 : 0)),
      note: vagueComments.length || busyComments
        ? "A few comments could do more work by capturing a reason, constraint, or specific follow-up."
        : usefulComments
          ? "The comments explain the reasoning behind the code. That context is worth keeping."
          : longWithoutContext
            ? "Some branching decisions could use a short note about the constraint behind them."
            : "The comments stay out of the way, leaving the code room to speak.",
    },
    flow: {
      score: Math.max(9, 94 - Math.min(46, m.nested.length * 9) - Math.round(widePenalty * 0.7) - (guard ? 12 : 0)),
      note: m.nested.length
        ? "The branching gets deep in places. Pulling a decision forward would make the main path easier to hold in mind."
        : guard
          ? "The early return is already a clean exit. Flattening the branch after it would put the normal path in view."
          : m.wide.length
            ? "Some lines contain several ideas at once. A few named steps would make the sequence easier to scan."
            : "The main path is easy to trace from top to bottom.",
    },
  };

  const strengths: Feedback[] = [];
  if (usefulComments) {
    strengths.push({ title: "Context where it counts", detail: "A comment gives a reason for a decision. Keeping that reason near the relevant lines helps the next reader understand the constraint." });
  }
  if (m.meaningfulName) {
    strengths.push({ title: "A name the reader can follow", detail: `“${m.meaningfulName}” gives the reader a clue to its role before they trace the places it’s used.` });
  }
  if (!m.wide.length && !mixedIndent) {
    strengths.push({ title: "The shape is visible at a glance", detail: "The lines fit a typical editor width, leaving the reader free to scan down the file." });
  }

  const feedback: Suggestion[] = [];
  const suggest = (title: string, detail: string, line: number | null = null) => {
    feedback.push({ title, detail, path: file.path, line, before: null, after: null });
  };

  if (guard) feedback.push(guard);
  if (m.nested.length) {
    suggest("Give the main path a straighter line", "Try returning early for a special case or naming a nested decision. One less level of indentation can make the rest of the function easier to scan.", m.nested[0]);
  }
  if (m.genericNames.length) {
    const name = m.genericNames[0];
    const line = m.lines.findIndex((line) => line.includes(name)) + 1;
    suggest("Name the value for its role", `“${name}” leaves its purpose to the surrounding code. Try a name based on what the value represents at that point.`, line || null);
  }
  if (m.wide.length) {
    suggest("Give the dense line a breath", "Break the expression where the idea changes. A named intermediate value can help if the second half needs an explanation.", m.wide[0]);
  }
  if (mixedIndent || m.trailing.length) {
    suggest("Settle on one whitespace rhythm", "Match the indentation to the surrounding block and trim stray spaces on code lines. The structure will be easier to pick out at a glance.", m.trailing[0]);
  }
  if (vagueComments.length || busyComments || longWithoutContext) {
    suggest("Use comments to carry context", "Choose a decision whose motivation lives outside the file. A short note about that constraint will help the next reader more than narrating the code.");
  }

  return { scores, feedback, strengths, indentStyles: m.indentStyles, language: languageFor(file.path) };
}

export function reviewLocally(files: SourceFile[]): ReviewBody {
  const reviews = files.map(scoreFile);
  const scores = Object.fromEntries(
    categories.map(({ key }) => {
      const results = reviews.map((review) => review.scores[key]);
      const score = Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length);
      const note = results.reduce((weakest, result) => result.score < weakest.score ? result : weakest).note;
      return [key, { score, note }];
    }),
  ) as CategoryScores;

  const stylesByLanguage = new Map<Language, Set<string>>();
  for (const { language, indentStyles } of reviews) {
    if (indentStyles.size !== 1) continue;
    const styles = stylesByLanguage.get(language) ?? new Set<string>();
    for (const style of indentStyles) styles.add(style);
    stylesByLanguage.set(language, styles);
  }
  if ([...stylesByLanguage.values()].some((styles) => styles.size > 1)) {
    scores.cleanliness.score = Math.max(0, scores.cleanliness.score - 4);
    scores.cleanliness.note = "Files in the same language mix tabs and spaces for indentation. Matching nearby files would make moving between them feel smoother.";
  }
  const overall = auraScore({
    cleanliness: scores.cleanliness.score, naming: scores.naming.score,
    comments: scores.comments.score, flow: scores.flow.score,
  });
  const suggestions: Suggestion[] = [];
  const strengths: Feedback[] = [];
  for (const review of reviews) {
    for (const strength of review.strengths) {
      if (!strengths.some((item) => item.title === strength.title)) strengths.push(strength);
    }
    for (const suggestion of review.feedback) {
      if (!suggestions.some((item) => item.title === suggestion.title)) suggestions.push(suggestion);
    }
  }

  return {
    summary: overall >= 92
      ? "There’s a steady rhythm here. The code gives the reader room to understand each step, and the intent shows through."
      : overall >= 82
        ? "There’s a readable shape here. A small pass over the busiest spots could make the intent come through even faster."
        : "The intent is there. A few smaller decisions and more deliberate names would help the reader find it sooner.",
    scores,
    strengths: strengths.slice(0, 3),
    suggestions: suggestions.slice(0, 4),
  };
}

export function makeReport(files: SourceFile[], body: ReviewBody, mode: ReviewReport["mode"], notice?: string): ReviewReport {
  return {
    ...body,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    mode,
    notice,
    files: files.map(({ path, code }) => ({
      path,
      language: languageFor(path),
      lines: code.trimEnd().split(/\r\n?|\n/).length,
    })),
  };
}

export function sampleReport(): ReviewReport {
  const files = [sampleFile];
  const report = makeReport(files, reviewLocally(files), "sample");

  return { ...report, id: "sample", createdAt: "2026-01-01T00:00:00.000Z" };
}
