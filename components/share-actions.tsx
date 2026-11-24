"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, Check, Copy, Linkedin, Share2 } from "lucide-react";
import { auraScore, encodeSnapshot, type Snapshot } from "@/lib/report";

export function ShareActions({ snapshot }: { snapshot: Snapshot }) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setStatus("Link copied");
    } catch {
      setStatus("Select the link to copy it.");
    }
  }

  function share() {
    if (open) {
      setOpen(false);
      return;
    }

    const link = new URL("/share?s=" + encodeSnapshot(snapshot), window.location.origin).href;
    setStatus("");
    setUrl(link);
    setOpen(true);
    void copy(link);
  }

  const xShare = new URLSearchParams({
    text: "My code scored " + auraScore(snapshot.scores) + "/100 on CodeAura.",
    url,
  });
  const linkedInShare = new URLSearchParams({ url });

  return (
    <div
      className="share-control"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button ref={button} type="button" className="button primary compact" onClick={share} aria-expanded={open} aria-controls="share-panel">
        <Share2 size={16} aria-hidden="true" /> Share Aura
      </button>
      {open && (
        <div className="share-panel" id="share-panel">
          <p>Your public link shares the scores and languages.</p>
          <div className="share-copy">
            <input aria-label="Public report link" readOnly value={url} onFocus={(event) => event.target.select()} />
            <button className="icon-button" type="button" onClick={() => void copy(url)} aria-label="Copy public report link">
              {status === "Link copied" ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <p className="share-status" role="status">{status}</p>
          <div className="share-links">
            <a className="button secondary compact" href={"https://twitter.com/intent/tweet?" + xShare} target="_blank" rel="noreferrer">
              Share on X <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <a className="button secondary compact" href={"https://www.linkedin.com/sharing/share-offsite/?" + linkedInShare} target="_blank" rel="noreferrer">
              <Linkedin size={14} aria-hidden="true" /> LinkedIn
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
