import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const githubSessionCookie = "codeaura-github";
export const githubStateCookie = "codeaura-github-state";
const stateLifetime = 10 * 60;
export const sessionLifetime = 8 * 60 * 60;

export function githubConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const sessionSecret = process.env.GITHUB_SESSION_SECRET?.trim();
  const appOrigin = process.env.CODEAURA_ORIGIN?.trim();

  if (!clientId || !clientSecret || !sessionSecret || sessionSecret.length < 32 || !appOrigin) return null;

  let url: URL;
  try {
    url = new URL(appOrigin);
  } catch {
    return null;
  }

  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;

  return {
    clientId,
    clientSecret,
    origin: url.origin,
    secure: url.protocol === "https:",
    key: createHash("sha256").update(sessionSecret).digest(),
    callback: new URL("/api/github/callback", url.origin).toString(),
  };
}

type GitHubConfig = NonNullable<ReturnType<typeof githubConfig>>;
type Ticket = { value: string; expires: number; verifier?: string };

function seal(ticket: Ticket, cookie: string, config: GitHubConfig) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.key, iv);
  cipher.setAAD(Buffer.from(cookie));
  const data = Buffer.concat([cipher.update(JSON.stringify(ticket)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

function unseal(value: string | undefined, cookie: string, config: GitHubConfig): Ticket | null {
  if (!value) return null;

  try {
    const bytes = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", config.key, bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(cookie));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const data = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
    const ticket: Ticket = JSON.parse(data.toString());
    return typeof ticket.value === "string" && Number.isSafeInteger(ticket.expires) && ticket.expires > Date.now()
      ? ticket
      : null;
  } catch {
    return null;
  }
}

export function setTicket(
  response: NextResponse,
  cookie: string,
  config: GitHubConfig,
  value: string,
  lifetime: number,
  verifier?: string,
) {
  response.cookies.set({
    name: cookie,
    value: seal({ value, expires: Date.now() + lifetime * 1000, verifier }, cookie, config),
    httpOnly: true,
    sameSite: "lax",
    secure: config.secure,
    path: "/",
    maxAge: lifetime,
  });
}

export function createGitHubState(response: NextResponse, config: GitHubConfig, state: string, verifier: string) {
  setTicket(response, githubStateCookie, config, state, stateLifetime, verifier);
}

export async function readTicket(cookie: string, config: GitHubConfig) {
  return unseal((await cookies()).get(cookie)?.value, cookie, config);
}

export async function githubToken() {
  const config = githubConfig();
  if (!config) return null;
  return (await readTicket(githubSessionCookie, config))?.value ?? null;
}
