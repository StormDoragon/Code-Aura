import type { Metadata } from "next";
import { ReportView } from "@/components/report-view";
import { sampleReport } from "@/lib/review";

export const metadata: Metadata = { title: "Sample Aura report" };

export default function SamplePage() {
  return <ReportView report={sampleReport()} />;
}
