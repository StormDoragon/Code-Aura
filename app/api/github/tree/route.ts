import { browseRepository } from "@/lib/github";
import { problemResponse, RequestProblem } from "@/lib/request";
import { parseRepository } from "@/lib/source";

export async function GET(request: Request) {
  try {
    const input = new URL(request.url).searchParams.get("repository") ?? "";
    const repository = parseRepository(input);
    if (!repository) throw new RequestProblem("Enter a GitHub URL or an owner/repository name.");

    return Response.json(await browseRepository(repository), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return problemResponse(error);
  }
}
