import { z } from "zod";
import { claudeEnabled, reviewWithClaude } from "@/lib/claude";
import { readRepositoryFiles } from "@/lib/github";
import { problemResponse, readJson, RequestProblem } from "@/lib/request";
import { makeReport, reviewLocally } from "@/lib/review";
import { isSafePath, isSupportedFile, MAX_FILES, MAX_REQUEST_BYTES, parseRepository, sourceProblem } from "@/lib/source";

export const maxDuration = 60;
const responseOptions = { headers: { "cache-control": "private, no-store" } };

const inputShape = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("files"),
    files: z.array(z.object({ path: z.string().max(260), code: z.string() })).min(1).max(MAX_FILES),
  }),
  z.object({
    mode: z.literal("github"),
    repository: z.string().max(170),
    files: z.array(z.object({
      path: z.string().refine((path) => isSafePath(path) && isSupportedFile(path)),
      sha: z.string().regex(/^[a-f0-9]{40}$/i),
    })).min(1).max(MAX_FILES),
  }),
]);

export async function POST(request: Request) {
  try {
    const parsed = inputShape.safeParse(await readJson(request, MAX_REQUEST_BYTES));
    if (!parsed.success) throw new RequestProblem("Choose between 1 and " + MAX_FILES + " valid source files.");
    const input = parsed.data;
    const repository = input.mode === "github" ? parseRepository(input.repository) : null;

    if (input.mode === "github" && !repository) {
      throw new RequestProblem("Enter a GitHub URL in the form github.com/owner/repository.");
    }

    const files = input.mode === "github"
      ? await readRepositoryFiles(repository!, input.files)
      : input.files;
    const issue = sourceProblem(files);
    if (issue) throw new RequestProblem(issue);

    if (claudeEnabled()) {
      try {
        const body = await reviewWithClaude(files);
        return Response.json(makeReport(files, body, "claude"), responseOptions);
      } catch {
        const body = reviewLocally(files);
        return Response.json(makeReport(files, body, "built-in", "Claude was unavailable. This report uses the built-in reviewer."), responseOptions);
      }
    }

    return Response.json(makeReport(files, reviewLocally(files), "built-in"), responseOptions);
  } catch (error) {
    return problemResponse(error);
  }
}
