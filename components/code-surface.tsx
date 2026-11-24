"use client";

import dynamic from "next/dynamic";

export type CodeSurfaceProps = {
  path: string;
  code: string;
  onChange?: (code: string) => void;
  locked?: boolean;
  label?: string;
};

const CodeEditor = dynamic<CodeSurfaceProps>(
  () => import("./code-editor").then((module) => module.CodeEditor),
  { ssr: false, loading: () => <div className="editor-loading" role="status">Loading editor…</div> },
);

export function CodeSurface(props: CodeSurfaceProps) {
  return <div className={props.onChange ? "editable-code" : "readonly-code"}><CodeEditor {...props} /></div>;
}
