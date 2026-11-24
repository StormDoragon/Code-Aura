import type { Metadata } from "next";
import Link from "next/link";
import { Link2 } from "lucide-react";
import { ReportView } from "@/components/report-view";
import { auraScore, decodeSnapshot } from "@/lib/report";

type Props = { searchParams: Promise<{ s?: string | string[] }> };

async function getSnapshot(searchParams: Props["searchParams"]) {
  const { s } = await searchParams;
  return typeof s === "string" ? decodeSnapshot(s) : null;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const snapshot = await getSnapshot(searchParams);
  const title = snapshot ? auraScore(snapshot.scores) + "/100 · Shared Aura report" : "Shared Aura report";
  const description = "See the scores for cleanliness, naming, comments, and readability flow.";
  return { title, description, robots: { index: false }, openGraph: { title, description, type: "website" } };
}

export default async function SharedPage({ searchParams }: Props) {
  const snapshot = await getSnapshot(searchParams);
  if (snapshot) return <ReportView snapshot={snapshot} />;

  return (
    <main className="shell empty-main" id="main">
      <span className="drop-icon"><Link2 size={23} aria-hidden="true" /></span>
      <h1>This report link is incomplete</h1>
      <p>Check that you have the entire link, or start a new review.</p>
      <Link href="/#workspace" className="button primary">Go to workspace</Link>
    </main>
  );
}
