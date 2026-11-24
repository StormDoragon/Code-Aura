export class RequestProblem extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function readJson(request: Pick<Request, "headers" | "body">, limit: number): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json" || !request.body) {
    throw new RequestProblem("Send the selected files as JSON.", 415);
  }

  if (Number(request.headers.get("content-length")) > limit) {
    throw new RequestProblem("This review exceeds the upload limit.", 413);
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const chunks: string[] = [];
  let size = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;

      if (size > limit) {
        await reader.cancel();
        throw new RequestProblem("This review exceeds the upload limit.", 413);
      }

      chunks.push(decoder.decode(value, { stream: true }));
    }

    chunks.push(decoder.decode());
    return JSON.parse(chunks.join(""));
  } catch (error) {
    if (error instanceof RequestProblem) throw error;
    throw new RequestProblem("The review request could not be read.");
  } finally {
    reader.releaseLock();
  }
}

export function problemResponse(error: unknown) {
  if (error instanceof RequestProblem) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: "Something interrupted the review. Try again in a moment." }, { status: 500 });
}
