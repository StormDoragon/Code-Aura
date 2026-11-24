"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Code2, FileUp, Github, LockKeyhole, Sparkles } from "lucide-react";
import { saveReport } from "@/lib/report-storage";
import type { ReviewReport } from "@/lib/report";
import { sampleFile } from "@/lib/sample";
import {
  byteLength, MAX_FILES, MAX_SOURCE_BYTES, MAX_UPLOAD_CANDIDATES, parseRepository, sourceProblem,
  type RepositoryTree, type ReviewInput, type SourceFile,
} from "@/lib/source";
import { GitHubPanel, PastePanel, UploadPanel, type Draft } from "./input-panels";

const tabs = [
  { id: "paste", label: "Paste code", icon: Code2 },
  { id: "upload", label: "Upload files", icon: FileUp },
  { id: "github", label: "GitHub repo", icon: Github },
] as const;

type Tab = (typeof tabs)[number]["id"];

async function responseJson<T>(response: Response): Promise<T> {
  const result = await response.json();
  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "The request did not complete. Try again in a moment.");
  }
  return result as T;
}

export function Workspace({
  ai, githubEnabled, githubConnected, githubStatus,
}: {
  ai: boolean;
  githubEnabled: boolean;
  githubConnected: boolean;
  githubStatus?: "connected" | "denied" | "error";
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(githubStatus ? "github" : "paste");
  const [drafts, setDrafts] = useState<Draft[]>([{ id: 0, ...sampleFile }]);
  const [active, setActive] = useState(0);
  const [imported, setImported] = useState<{ files: SourceFile[]; selected: string[] }>({ files: [], selected: [] });
  const [repository, setRepository] = useState("");
  const [tree, setTree] = useState<RepositoryTree | null>(null);
  const [repoSelection, setRepoSelection] = useState<string[]>([]);
  const [connected, setConnected] = useState(githubConnected);
  const [authNotice, setAuthNotice] = useState(
    githubStatus === "connected" && githubConnected ? "GitHub connected. Paste a repository URL to get started." :
    githubStatus === "denied" ? "GitHub authorization was canceled." :
    githubStatus ? "GitHub could not be connected. Try signing in again." : "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const nextDraft = useRef(1);
  const activeRequest = useRef<AbortController | null>(null);
  const activeBrowse = useRef<AbortController | null>(null);
  const draft = drafts.find(({ id }) => id === active) ?? drafts[0];
  const { files: uploads, selected: uploadSelection } = imported;

  useEffect(() => () => {
    activeRequest.current?.abort();
    activeBrowse.current?.abort();
  }, []);

  function activate(selected: Tab) {
    setError("");
    setTab(selected);
  }

  function navigateTabs(event: KeyboardEvent, index: number) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key) || busy || browsing) return;
    event.preventDefault();
    const target = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
      (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    activate(tabs[target].id);
    document.getElementById("input-" + tabs[target].id)?.focus();
  }

  function addDraft(source: SourceFile) {
    if (drafts.length >= MAX_FILES) return;
    const id = nextDraft.current++;
    setDrafts((files) => [...files, { id, ...source }]);
    setActive(id);
    setError("");
  }

  function editDraft(changes: Partial<SourceFile>) {
    setDrafts((files) => files.map((file) => file.id === draft.id ? { ...file, ...changes } : file));
    setError("");
  }

  function removeDraft(id: number) {
    const rest = drafts.filter((file) => file.id !== id);
    if (!rest.length) return;
    if (active === id) setActive(rest[0].id);
    setDrafts(rest);
    setError("");
  }

  function loadSample() {
    const existing = drafts.find((file) => file.path === sampleFile.path && file.code === sampleFile.code);
    if (existing) {
      setActive(existing.id);
      return;
    }

    const replaceEmpty = !draft.code.trim();
    const names = new Set(drafts.filter((file) => !replaceEmpty || file.id !== draft.id).map((file) => file.path));
    const sample = { ...sampleFile };
    for (let number = 2; names.has(sample.path); number += 1) sample.path = "checkout-sample-" + number + ".ts";
    if (replaceEmpty) {
      editDraft(sample);
    } else if (drafts.length < MAX_FILES) {
      addDraft(sample);
    } else {
      setError("Remove a file or open the sample report to review the example.");
    }
  }

  function addUploads(incoming: SourceFile[]) {
    setImported(({ files, selected }) => {
      const combined = new Map(files.map((file) => [file.path, file]));
      for (const file of incoming) {
        if (combined.size < MAX_UPLOAD_CANDIDATES || combined.has(file.path)) combined.set(file.path, file);
      }

      const wanted = new Set([...selected, ...incoming.map(({ path }) => path)]);
      const picks: string[] = [];
      let total = 0;
      for (const file of combined.values()) {
        const size = byteLength(file.code);
        if (wanted.has(file.path) && picks.length < MAX_FILES && total + size <= MAX_SOURCE_BYTES) {
          picks.push(file.path);
          total += size;
        }
      }

      return { files: [...combined.values()], selected: picks };
    });
    setError("");
  }

  async function browse() {
    if (activeBrowse.current || busy || disconnecting) return;
    const slug = parseRepository(repository);
    if (!slug) {
      setError("Enter a GitHub repository URL or an owner/repository name.");
      return;
    }

    const controller = new AbortController();
    activeBrowse.current = controller;
    setBrowsing(true);
    setError("");
    setTree(null);
    setRepoSelection([]);

    try {
      const params = new URLSearchParams({ repository: slug });
      const response = await fetch("/api/github/tree?" + params, { signal: controller.signal });
      setTree(await responseJson<RepositoryTree>(response));
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "GitHub could not return the file list.");
    } finally {
      activeBrowse.current = null;
      setBrowsing(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/github/session", { method: "DELETE" });
      if (!response.ok) throw new Error();
      setConnected(false);
      setAuthNotice("GitHub disconnected.");
      setTree(null);
      setRepoSelection([]);
      setError("");
    } catch {
      setError("GitHub could not be disconnected. Try again in a moment.");
    } finally {
      setDisconnecting(false);
    }
  }

  function input(): ReviewInput | null {
    if (tab === "paste") return { mode: "files", files: drafts.map(({ path, code }) => ({ path: path.trim(), code })) };
    if (tab === "upload") return { mode: "files", files: uploads.filter(({ path }) => uploadSelection.includes(path)) };
    if (!tree || !repoSelection.length) return null;
    return {
      mode: "github",
      repository: tree.repository,
      files: tree.files.filter(({ path }) => repoSelection.includes(path)).map(({ path, sha }) => ({ path, sha })),
    };
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeRequest.current || browsing || tab === "github" && disconnecting) return;
    const payload = input();
    if (!payload) return;
    const issue = payload.mode === "files" ? sourceProblem(payload.files) : null;
    if (issue) {
      setError(issue);
      return;
    }

    const controller = new AbortController();
    activeRequest.current = controller;
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const report = await responseJson<ReviewReport>(response);
      saveReport(report);
      router.push("/report");
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "The review did not complete. Try again.");
    } finally {
      activeRequest.current = null;
      setBusy(false);
    }
  }

  const canReview = tab === "paste" ? drafts.some(({ code }) => code.trim()) :
    tab === "upload" ? uploadSelection.length > 0 : repoSelection.length > 0;

  return (
    <section className="workspace-section" id="workspace" aria-labelledby="workspace-title">
      <div className="section-heading">
        <div>
          <h2 id="workspace-title">Review your code</h2>
          <p>Start with a snippet, a set of files, or a GitHub repository.</p>
        </div>
        <span className="workspace-limit">Up to {MAX_FILES} files per review</span>
      </div>
      <form className="workspace-card" onSubmit={analyze} aria-busy={busy}>
        <div className="input-tabs" role="tablist" aria-label="Code source">
          {tabs.map(({ id, label, icon: Icon }, index) => (
            <button
              key={id}
              className="input-tab"
              id={"input-" + id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls="input-panel"
              tabIndex={tab === id ? 0 : -1}
              onClick={() => activate(id)}
              onKeyDown={(event) => navigateTabs(event, index)}
              disabled={busy || browsing}
            >
              <Icon aria-hidden="true" size={17} /> {label}
            </button>
          ))}
        </div>
        <div className="input-panel" id="input-panel" role="tabpanel" aria-labelledby={"input-" + tab}>
          {tab === "paste" && (
            <PastePanel
              files={drafts} current={draft} setCurrent={setActive} edit={editDraft}
              add={() => addDraft({ path: "snippet-" + nextDraft.current + ".ts", code: "" })}
              remove={removeDraft} loadSample={loadSample} disabled={busy}
            />
          )}
          {tab === "upload" && (
            <UploadPanel
              files={uploads.map(({ path, code }) => ({ path, size: byteLength(code) }))}
              selected={uploadSelection} onFiles={addUploads}
              onSelect={(selected) => { setImported((state) => ({ ...state, selected })); setError(""); }}
              disabled={busy}
            />
          )}
          {tab === "github" && (
            <GitHubPanel
              repository={repository} setRepository={(value) => {
                setRepository(value);
                setTree(null);
                setRepoSelection([]);
                setError("");
              }}
              tree={tree} selected={repoSelection}
              onSelect={(paths) => { setRepoSelection(paths); setError(""); }}
              onBrowse={() => void browse()} browsing={browsing}
              enabled={githubEnabled} connected={connected} onDisconnect={() => void disconnect()}
              authNotice={authNotice} disabled={busy || disconnecting}
            />
          )}
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        {busy && (
          <div className="review-progress" role="status">
            <span className="progress-track"><span /></span>
            <span>Reading for clarity, rhythm, and intent…</span>
          </div>
        )}
        <div className="workspace-footer">
          <p><LockKeyhole size={15} aria-hidden="true" /> {ai ? "Claude reviews the code you submit." : "Your code stays with this CodeAura instance."}</p>
          <button className="button primary analyze-button" type="submit" disabled={!canReview || busy || browsing || tab === "github" && disconnecting}>
            <Sparkles size={17} aria-hidden="true" /> {busy ? "Reading code…" : "Analyze Aura"} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  );
}
