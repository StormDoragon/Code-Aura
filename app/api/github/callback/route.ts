import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { githubConfig, githubSessionCookie, githubStateCookie, readTicket, sessionLifetime, setTicket } from "@/lib/github-session";

const tokenShape = z.object({
  access_token: z.string().min(1).max(512),
  expires_in: z.int().positive().optional(),
});

export async function GET(request: Request) {
  const config = githubConfig();
  if (!config) return NextResponse.json({ error: "GitHub App login is not configured." }, { status: 503 });

  const redirect = (state: "connected" | "denied" | "error") => {
    const response = NextResponse.redirect(new URL("/?github=" + state + "#workspace", config.origin));
    response.headers.set("cache-control", "no-store");
    response.cookies.delete(githubStateCookie);
    return response;
  };

  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const ticket = await readTicket(githubStateCookie, config);
  const supplied = Buffer.from(state ?? "");
  const expected = Buffer.from(ticket?.value ?? "");

  if (params.get("error") === "access_denied") return redirect("denied");
  if (!code || !ticket?.verifier || !state || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return redirect("error");
  }

  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.callback,
        code_verifier: ticket.verifier,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return redirect("error");
    const token = tokenShape.parse(await response.json());
    const result = redirect("connected");
    setTicket(result, githubSessionCookie, config, token.access_token, Math.min(sessionLifetime, token.expires_in ?? sessionLifetime));
    return result;
  } catch {
    return redirect("error");
  }
}
