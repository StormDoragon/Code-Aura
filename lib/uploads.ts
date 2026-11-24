import {
  isSafePath, isSupportedFile, MAX_ARCHIVE_BYTES, MAX_FILE_BYTES, MAX_UPLOAD_CANDIDATES, type SourceFile,
} from "./source";

const decoder = new TextDecoder("utf-8", { fatal: true });

export async function readUploads(items: File[]) {
  const files = new Map<string, SourceFile>();
  let skipped = 0;

  function add(path: string, contents: Uint8Array) {
    if (
      !isSafePath(path) || !isSupportedFile(path) || contents.byteLength > MAX_FILE_BYTES ||
      files.size >= MAX_UPLOAD_CANDIDATES
    ) {
      skipped += 1;
      return;
    }

    try {
      const code = decoder.decode(contents);
      if (!code.trim() || code.includes(String.fromCharCode(0))) throw new Error("Expected code.");
      files.set(path, { path, code });
    } catch {
      skipped += 1;
    }
  }

  for (const file of items) {
    const path = file.webkitRelativePath || file.name;

    if (/\.zip$/i.test(file.name)) {
      if (file.size > MAX_ARCHIVE_BYTES || files.size >= MAX_UPLOAD_CANDIDATES) {
        skipped += 1;
        continue;
      }

      try {
        const { unzipSync } = await import("fflate");
        let entries = files.size;
        const archive = unzipSync(new Uint8Array(await file.arrayBuffer()), {
          filter(entry) {
            const path = entry.name.replace(/^\.\//, "");
            if (path.endsWith("/") || path.startsWith("__MACOSX/")) return false;
            if (!isSafePath(path) || !isSupportedFile(path) || entry.originalSize > MAX_FILE_BYTES || entries >= MAX_UPLOAD_CANDIDATES) {
              skipped += 1;
              return false;
            }
            entries += 1;
            return true;
          },
        });
        for (const [name, contents] of Object.entries(archive)) add(name.replace(/^\.\//, ""), contents);
      } catch {
        skipped += 1;
      }

      continue;
    }

    if (!isSupportedFile(path) || file.size > MAX_FILE_BYTES || files.size >= MAX_UPLOAD_CANDIDATES) {
      skipped += 1;
      continue;
    }

    try {
      add(path, new Uint8Array(await file.arrayBuffer()));
    } catch {
      skipped += 1;
    }
  }

  return { files: [...files.values()], skipped };
}
