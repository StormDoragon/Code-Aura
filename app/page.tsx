import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, AlignLeft, Braces, GitPullRequest, MessageSquare, Sparkles } from "lucide-react";
import { Workspace } from "@/components/workspace";
import { claudeEnabled } from "@/lib/claude";
import { githubConfig, githubToken } from "@/lib/github-session";
import { auraLabel, auraScore, categories, snapshotOf } from "@/lib/report";
import { sampleReport } from "@/lib/review";

export const dynamic = "force-dynamic";

const guide = {
  cleanliness: { icon: AlignLeft, detail: "Consistent structure and room for the important lines to stand out." },
  naming: { icon: Braces, detail: "Names that make the role of a value or function easy to understand." },
  comments: { icon: MessageSquare, detail: "Context about choices and constraints a reader would otherwise have to guess." },
  flow: { icon: GitPullRequest, detail: "Logic you can follow in order, with a clear path through each decision." },
};

export default async function Home({ searchParams }: { searchParams: Promise<{ github?: string }> }) {
  const { github } = await searchParams;
  const githubStatus = github === "connected" || github === "denied" || github === "error" ? github : undefined;
  const githubEnabled = Boolean(githubConfig());
  const githubConnected = githubEnabled && Boolean(await githubToken());
  const score = auraScore(snapshotOf(sampleReport()).scores);

  return (
    <main id="main" className="shell home-main">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} aria-hidden="true" /> Aesthetic code review</div>
          <h1 id="hero-title">Does your code <em>feel good?</em></h1>
          <p>See where your code flows, where it feels crowded, and what a small rewrite could do.</p>
          <div className="hero-actions">
            <Link href="#workspace" className="button primary">Start a review <ArrowDown size={16} aria-hidden="true" /></Link>
            <Link href="/report/sample" className="button quiet">View sample report <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
        <Link href="/report/sample" className="aura-preview">
          <Image src="/aura.webp" alt="" width={1080} height={720} priority sizes="(max-width: 680px) 90vw, 540px" />
          <span className="preview-content">
            <span className="preview-caption">Sample Aura</span>
            <span className="preview-score">{score}<span> / 100</span></span>
            <span className="preview-label"><span /> {auraLabel(score)}</span>
            <span className="sr-only">View report</span>
          </span>
        </Link>
      </section>

      <Workspace ai={claudeEnabled()} githubEnabled={githubEnabled} githubConnected={githubConnected} githubStatus={githubStatus} />

      <section className="guide" aria-labelledby="guide-title">
        <h2 id="guide-title">What goes into your Aura</h2>
        <div className="guide-grid">
          {categories.map(({ key, label, color }) => {
            const { icon: Icon, detail } = guide[key];
            return (
              <div className="guide-card" key={key}>
                <Icon size={19} color={color} aria-hidden="true" />
                <h3>{label}</h3>
                <p>{detail}</p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
