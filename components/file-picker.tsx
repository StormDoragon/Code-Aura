"use client";

import { useId, useMemo, useState } from "react";
import { Check, FileCode2, Search } from "lucide-react";
import { describeBytes, MAX_FILES, MAX_SOURCE_BYTES } from "@/lib/source";

export type PickableFile = { path: string; size: number };

export function FilePicker({
  files, selected, onChange, disabled,
}: {
  files: PickableFile[];
  selected: string[];
  onChange: (paths: string[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("");
  const [notice, setNotice] = useState("");
  const folders = useMemo(() => {
    const names = new Set<string>();
    for (const { path } of files) {
      const parts = path.split("/");
      for (let i = 1; i < parts.length; i += 1) names.add(parts.slice(0, i).join("/"));
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [files]);

  const needle = query.trim().toLowerCase();
  const shown = files.filter(({ path }) =>
    (!folder || path.startsWith(folder + "/")) && (!needle || path.toLowerCase().includes(needle)),
  );
  const selection = new Set(selected);
  const size = files.reduce((sum, file) => selection.has(file.path) ? sum + file.size : sum, 0);

  function pick(paths: string[]) {
    const next = new Set(paths);
    const nextSize = files.reduce((sum, file) => next.has(file.path) ? sum + file.size : sum, 0);
    if (next.size > MAX_FILES || nextSize > MAX_SOURCE_BYTES) {
      setNotice("Choose up to " + MAX_FILES + " files and " + MAX_SOURCE_BYTES / 1024 + " KB total per review.");
      return;
    }

    setNotice("");
    onChange([...next]);
  }

  return (
    <div className="file-picker">
      <div className="file-filters">
        <label className="search-field" htmlFor={id + "-search"}>
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Filter files</span>
          <input id={id + "-search"} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter files…" disabled={disabled} />
        </label>
        {folders.length > 0 && (
          <select aria-label="Folder" className="field-select" value={folder} onChange={(event) => setFolder(event.target.value)} disabled={disabled}>
            <option value="">All folders</option>
            {folders.map((name) => <option key={name} value={name}>{name}/</option>)}
          </select>
        )}
      </div>
      <div className="file-picker-bar">
        <span>{selected.length} of {MAX_FILES} selected <span className="picker-size">· {describeBytes(size)}</span></span>
        <div className="inline-actions">
          {shown.length > 0 && <button type="button" className="text-button" onClick={() => pick([...selected, ...shown.map(({ path }) => path)])} disabled={disabled}>Select visible</button>}
          {selected.length > 0 && <button type="button" className="text-button muted" onClick={() => pick([])} disabled={disabled}>Clear</button>}
        </div>
      </div>
      <div className="file-list" aria-label="Files" role="group">
        {shown.length === 0 && <p className="empty-file-list">No files match this filter.</p>}
        {shown.map(({ path, size }) => (
          <label className="file-row" key={path}>
            <span className="checkbox-wrap">
              <input
                type="checkbox"
                checked={selection.has(path)}
                disabled={disabled}
                onChange={(event) => pick(event.target.checked ? [...selected, path] : selected.filter((name) => name !== path))}
              />
              <Check size={12} aria-hidden="true" />
            </span>
            <FileCode2 size={16} aria-hidden="true" />
            <span className="file-path">{path}</span>
            <span className="file-size">{describeBytes(size)}</span>
          </label>
        ))}
      </div>
      {notice && <p className="field-note" role="status">{notice}</p>}
    </div>
  );
}
