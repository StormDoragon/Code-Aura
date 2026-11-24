import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createGitHubState, githubConfig } from "@/lib/github-session";

export async function GET() {
  const config = githubConfig();
  if (!config) return NextResponse.json({ error: "GitHub App login is not configured." }, { status: 503 });

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const params = {
    client_id: config.clientId,
    redirect_uri: config.callback,
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  };
  const url = new URL("https://github.com/login/oauth/authorize");
  url.search = new URLSearchParams(params).toString();
  const response = NextResponse.redirect(url);
  response.headers.set("cache-control", "no-store");
  createGitHubState(response, config, state, verifier);
  return response;
}
