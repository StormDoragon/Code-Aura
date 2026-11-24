import type { Metadata } from "next";
import { ReportResult } from "@/components/report-result";

export const metadata: Metadata = { title: "Your Aura report", robots: { index: false } };

export default function ReportPage() {
  return <ReportResult />;
}
