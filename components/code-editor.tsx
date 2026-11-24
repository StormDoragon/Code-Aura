"use client";

import { useMemo } from "react";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { fileExtension, languageFor } from "@/lib/source";
import type { CodeSurfaceProps } from "./code-surface";

const colors = syntaxHighlighting(HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword], color: "#c7a2f8" },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: "#a7d7b6" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "#edb59a" },
  { tag: [tags.typeName, tags.className, tags.tagName], color: "#a8b9f2" },
  { tag: [tags.function(tags.variableName), tags.definition(tags.variableName)], color: "#b1c8fa" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "#9183a4", fontStyle: "italic" },
  { tag: [tags.propertyName, tags.attributeName], color: "#ded0f4" },
  { tag: [tags.operator, tags.punctuation], color: "#ada2bd" },
]));

const theme = EditorView.theme({
  "&": { backgroundColor: "#101016", color: "#e0d7eb", fontSize: "13px" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { caretColor: "#d4baff", padding: "14px 0", fontFamily: "var(--font-mono)" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.8" },
  ".cm-gutters": { border: "none", background: "#101016", color: "#9e90b0", padding: "0 8px 0 11px" },
  ".cm-activeLineGutter, .cm-activeLine": { backgroundColor: "#1a1624" },
  ".cm-line": { padding: "0 16px 0 8px" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { background: "#413254" },
  ".cm-placeholder": { color: "#8f839f" },
  ".cm-cursor": { borderLeftColor: "#d4baff" },
}, { dark: true });

function syntaxFor(path: string) {
  switch (languageFor(path)) {
    case "ts": return javascript({ typescript: true, jsx: fileExtension(path) === "tsx" });
    case "js": return javascript({ jsx: true });
    case "python": return python();
    case "go": return go();
    case "rust": return rust();
    case "json": return json();
    case "html": return html();
    case "css": return css();
    case "markdown": return markdown();
    default: return null;
  }
}

export function CodeEditor({
  path, code, onChange, locked = false, label = "Source code",
}: CodeSurfaceProps) {
  const readOnly = !onChange;
  const extensions = useMemo(() => {
    const syntax = syntaxFor(path);
    return [
      colors,
      EditorView.contentAttributes.of({ "aria-label": label }),
      ...(syntax ? [syntax] : []),
      ...(readOnly ? [EditorView.lineWrapping] : []),
    ];
  }, [path, label, readOnly]);

  return (
    <CodeMirror
      value={code}
      onChange={onChange}
      height={onChange ? "280px" : undefined}
      maxHeight={onChange ? undefined : "290px"}
      minHeight={onChange ? undefined : "95px"}
      readOnly={locked || !onChange}
      editable={!locked && Boolean(onChange)}
      placeholder={onChange ? "Paste your code here…" : undefined}
      extensions={extensions}
      theme={theme}
      onCreateEditor={(view) => {
        view.scrollDOM.tabIndex = 0;
        view.scrollDOM.setAttribute("role", "region");
        view.scrollDOM.setAttribute("aria-label", label + " scroll area");
      }}
      basicSetup={{
        foldGutter: false,
        highlightActiveLine: Boolean(onChange),
        highlightActiveLineGutter: Boolean(onChange),
        highlightSelectionMatches: false,
        autocompletion: false,
      }}
    />
  );
}
