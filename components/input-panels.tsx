"use client";

import { useRef, useState } from "react";
import { Code2, FileCode2, FileUp, GitBranch, Github, LoaderCircle, Plus, RotateCcw, UploadCloud, X } from "lucide-react";
import { languages, languageFor, MAX_ARCHIVE_BYTES, MAX_FILE_BYTES, MAX_FILES, type RepositoryTree, type SourceFile } from "@/lib/source";
import { readUploads } from "@/lib/uploads";
import { CodeSurface } from "./code-surface";
import { FilePicker, type PickableFile } from "./file-picker";

export type Draft = SourceFile & { id: number };

export function PastePanel({
  files, current, setCurrent, edit, add, remove, loadSample, disabled,
}: {
  files: Draft[];
  current: Draft;
  setCurrent: (id: number) => void;
  edit: (changes: Partial<SourceFile>) => void;
  add: () => void;
  remove: (id: number) => void;
  loadSample: () => void;
  disabled: boolean;
}) {
  const lines = current.code ? current.code.trimEnd().split(/\r\n?|\n/).length : 0;

  return (
    <div className="editor-frame">
      <div className="editor-toolbar">
        <div className="editor-files" aria-label="Pasted files">
          {files.map(({ id, path }) => (
            <div className={"editor-file" + (current.id === id ? " active" : "")} key={id}>
              <FileCode2 aria-hidden="true" size={15} />
              {current.id === id ? (
                <input aria-label="File name" value={path} onChange={(event) => edit({ path: event.target.value })} disabled={disabled} maxLength={260} size={Math.min(Math.max(path.length, 8), 23)} />
              ) : (
                <button type="button" onClick={() => setCurrent(id)} disabled={disabled}>{path || "Untitled"}</button>
              )}
              {files.length > 1 && (
                <button type="button" aria-label={"Remove " + (path || "file")} className="icon-button file-remove" onClick={() => remove(id)} disabled={disabled}>
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
          <button type="button" className="icon-button" aria-label="Add a file" title="Add a file" onClick={add} disabled={disabled || files.length >= MAX_FILES}>
            <Plus size={17} />
          </button>
        </div>
        <button type="button" className="text-button muted sample-button" onClick={loadSample} disabled={disabled} title="Load the sample code">
          <RotateCcw size={14} aria-hidden="true" /> <span>Load sample</span>
        </button>
      </div>
      <CodeSurface key={current.id} path={current.path} code={current.code} onChange={(code) => edit({ code })} locked={disabled} />
      <div className="editor-status">
        <span><Code2 size={15} aria-hidden="true" /> {languages[languageFor(current.path)].label}</span>
        <span>{lines} {lines === 1 ? "line" : "lines"}</span>
      </div>
    </div>
  );
}

export function UploadPanel({
  files, selected, onFiles, onSelect, disabled,
}: {
  files: PickableFile[];
  selected: string[];
  onFiles: (files: SourceFile[]) => void;
  onSelect: (paths: string[]) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function addFiles(list: File[]) {
    if (!list.length || disabled || busy) return;

    setBusy(true);
    setNote("");
    try {
      const { files, skipped } = await readUploads(list);
      if (files.length) onFiles(files);
      if (!files.length) {
        setNote("No readable source files found. Choose a supported text file or ZIP within the size limits.");
      } else if (skipped) {
        setNote(skipped + " " + (skipped === 1 ? "entry was" : "entries were") + " skipped. Check file types and size limits.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="upload-panel">
      <div
        className={"drop-area" + (drag ? " dragging" : "")}
        onDragEnter={(event) => {
          event.preventDefault();
          depth.current += 1;
          if (!disabled) setDrag(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => {
          depth.current -= 1;
          if (depth.current <= 0) setDrag(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          depth.current = 0;
          setDrag(false);
          void addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <span className="drop-icon"><UploadCloud size={24} aria-hidden="true" /></span>
        <div>
          <h3>Drop your files here</h3>
          <p>Source files up to {MAX_FILE_BYTES / 1024} KB each or a ZIP up to {MAX_ARCHIVE_BYTES / 1024 / 1024} MB.</p>
        </div>
        <input
          ref={input}
          type="file"
          aria-label="Upload source files or ZIPs"
          hidden
          multiple
          accept=".zip,.js,.jsx,.mjs,.cjs,.ts,.tsx,.mts,.cts,.py,.pyi,.go,.rs,.json,.jsonc,.css,.scss,.html,.htm,.md,.mdx,.txt"
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
          disabled={disabled || busy}
        />
        <button type="button" className="button secondary" onClick={() => input.current?.click()} disabled={disabled || busy}>
          {busy ? <LoaderCircle className="spinner" size={16} /> : <FileUp size={16} />} {busy ? "Reading files…" : "Browse files"}
        </button>
      </div>
      {note && <p className="field-note" role="status">{note}</p>}
      {files.length > 0 && <FilePicker files={files} selected={selected} onChange={onSelect} disabled={disabled || busy} />}
    </div>
  );
}

export function GitHubPanel({
  repository, setRepository, tree, selected, onSelect, onBrowse, browsing,
  enabled, connected, onDisconnect, authNotice, disabled,
}: {
  repository: string;
  setRepository: (value: string) => void;
  tree: RepositoryTree | null;
  selected: string[];
  onSelect: (paths: string[]) => void;
  onBrowse: () => void;
  browsing: boolean;
  enabled: boolean;
  connected: boolean;
  onDisconnect: () => void;
  authNotice?: string;
  disabled: boolean;
}) {
  return (
    <div className="github-panel">
      <div className="github-connect">
        <div className="github-connect-title">
          <span className="drop-icon github-icon"><Github size={21} aria-hidden="true" /></span>
          <div><h3>Choose a repository</h3><p>Browse the default branch and select files or a folder.</p></div>
        </div>
        {enabled && (
          connected
            ? <button className="button secondary compact" type="button" onClick={onDisconnect} disabled={disabled || browsing}>Disconnect GitHub</button>
            : <a className="button secondary compact" href="/api/github/oauth">Connect GitHub</a>
        )}
      </div>
      {authNotice && <p className="field-note" role="status">{authNotice}</p>}
      <div className="repo-input-row">
        <label className="repo-field">
          <span className="sr-only">GitHub repository URL or owner and repository</span>
          <Github size={17} aria-hidden="true" />
          <input
            value={repository}
            onChange={(event) => setRepository(event.target.value)}
            placeholder="https://github.com/owner/repository"
            disabled={disabled || browsing}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (repository.trim() && !disabled && !browsing) onBrowse();
              }
            }}
          />
        </label>
        <button type="button" className="button secondary" onClick={onBrowse} disabled={!repository.trim() || disabled || browsing}>
          {browsing && <LoaderCircle className="spinner" size={16} />} {browsing ? "Browsing…" : "Browse repository"}
        </button>
      </div>
      {!enabled && <p className="field-note">Public repositories are available. Private repositories require GitHub App setup.</p>}
      {enabled && !connected && <p className="field-note">Connect GitHub to browse private repositories available to CodeAura.</p>}
      {tree && (
        <>
          <div className="repo-branch"><GitBranch size={15} /> <strong>{tree.repository}</strong><span>{tree.branch}</span></div>
          {tree.truncated && <p className="field-note">Showing the available files from GitHub’s limited listing.</p>}
          {tree.files.length > 0
            ? <FilePicker key={tree.repository + tree.branch} files={tree.files} selected={selected} onChange={onSelect} disabled={disabled || browsing} />
            : <p className="field-note">No supported source files fit the file size limit on this branch.</p>}
        </>
      )}
    </div>
  );
}
