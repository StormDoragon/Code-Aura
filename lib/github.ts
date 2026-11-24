import { z } from "zod";
import { githubToken } from "./github-session";
import { readJson, RequestProblem } from "./request";
import { isSafePath, isSupportedFile, MAX_FILE_BYTES, type RepositoryFile, type RepositoryTree, type SourceFile } from "./source";

const repositoryShape = z.object({ full_name: z.string(), default_branch: z.string() });
const treeShape = z.object({
  truncated: z.boolean(),
  tree: z.array(z.object({
    type: z.string(),
    mode: z.string().optional(),
    path: z.string(),
    sha: z.string(),
    size: z.number().optional(),
  })),
});
const blobShape = z.object({ size: z.number(), encoding: z.literal("base64"), content: z.string() });
const generatedFolders = new Set(["node_modules", "dist", "build", "vendor", "target", ".next", ".venv", "coverage"]);
const maxListedFiles = 1_500;

async function githubRequest(path: string, token: string | null, limit: number) {
  const headers = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };

  const get = (auth: string | null) =>
    fetch("https://api.github.com" + path, {
      headers: auth ? { ...headers, authorization: "Bearer " + auth } : headers,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });

  let response: Response;
  try {
    response = await get(token);
    if (token && [401, 403, 404].includes(response.status)) response = await get(null);
  } catch {
    throw new RequestProblem("GitHub did not respond. Try again in a moment.", 502);
  }

  if (response.status === 404) {
    throw new RequestProblem("This repository or file could not be found. Check the URL or connect a GitHub account with access.", 404);
  }
  if (response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0" && !response.ok) {
    throw new RequestProblem("GitHub’s request limit was reached. Try again later or connect GitHub.", 429);
  }
  if (!response.ok) {
    throw new RequestProblem("GitHub could not return these files. Check your repository access and try again.", 502);
  }

  try {
    return await readJson(response, limit);
  } catch (error) {
    if (error instanceof RequestProblem && error.status === 413) {
      throw new RequestProblem("The GitHub response exceeds the size limit for this review.", 413);
    }
    throw new RequestProblem("GitHub returned an unreadable response.", 502);
  }
}

export async function browseRepository(repository: string): Promise<RepositoryTree> {
  const token = await githubToken();
  const base = "/repos/" + repository;
  const repo = repositoryShape.parse(await githubRequest(base, token, 64 * 1024));
  const revision = encodeURIComponent(repo.default_branch);
  const { tree, truncated } = treeShape.parse(await githubRequest(base + "/git/trees/" + revision + "?recursive=1", token, 10 * 1024 * 1024));

  const files: RepositoryFile[] = [];
  for (const file of tree) {
    if (
      file.type !== "blob" ||
      file.mode === "120000" ||
      !file.size ||
      file.size > MAX_FILE_BYTES ||
      !isSafePath(file.path) ||
      !isSupportedFile(file.path) ||
      file.path.split("/").some((part) => generatedFolders.has(part))
    ) continue;

    files.push({ path: file.path, sha: file.sha, size: file.size });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return {
    repository: repo.full_name,
    branch: repo.default_branch,
    files: files.slice(0, maxListedFiles),
    truncated: truncated || files.length > maxListedFiles,
  };
}

export async function readRepositoryFiles(
  repository: string,
  files: Pick<RepositoryFile, "path" | "sha">[],
): Promise<SourceFile[]> {
  const token = await githubToken();

  return Promise.all(files.map(async ({ path, sha }) => {
    const response = await githubRequest("/repos/" + repository + "/git/blobs/" + sha, token, MAX_FILE_BYTES * 2);
    const blob = blobShape.parse(response);

    if (blob.size > MAX_FILE_BYTES) {
      throw new RequestProblem("“" + path + "” is over the per-file size limit.", 413);
    }

    try {
      const code = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(blob.content, "base64"));
      return { path, code };
    } catch {
      throw new RequestProblem("“" + path + "” must be UTF-8 text.");
    }
  }));
}
