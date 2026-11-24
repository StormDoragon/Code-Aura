import { NextResponse } from "next/server";
import { githubSessionCookie, githubStateCookie } from "@/lib/github-session";

export async function DELETE() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(githubSessionCookie);
  response.cookies.delete(githubStateCookie);
  return response;
}
