"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import type { ReviewReport } from "@/lib/report";
import { latestReport } from "@/lib/report-storage";
import { ReportView } from "./report-view";

export function ReportResult() {
  const [report, setReport] = useState<ReviewReport | null | undefined>(undefined);

  useEffect(() => {
    setReport(latestReport());
  }, []);

  if (report) return <ReportView report={report} />;

  return (
    <main className="shell empty-main" id="main">
      <span className="drop-icon"><FileText size={24} aria-hidden="true" /></span>
      <h1>{report === undefined ? "Loading your report…" : "Start your first review"}</h1>
      {report === null && (
        <>
          <p>Review a snippet or a set of files to see your Aura.</p>
          <Link href="/#workspace" className="button primary">Go to workspace <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </>
      )}
    </main>
  );
}
