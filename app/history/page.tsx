import type { Metadata } from "next";
import { HistoryView } from "@/components/history-view";

export const metadata: Metadata = { title: "Aura history", robots: { index: false } };

export default function HistoryPage() {
  return <HistoryView />;
}
