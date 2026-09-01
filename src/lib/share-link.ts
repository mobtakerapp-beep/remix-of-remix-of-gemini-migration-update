import lzString from "lz-string";

const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } = lzString;

import type { LessonPackage } from "./lesson-types";

/** Pack a lesson into a URL hash payload so students can open it without any login. */
export function encodeLessonToHash(pkg: LessonPackage): string {
  return compressToEncodedURIComponent(JSON.stringify(pkg));
}

export function decodeLessonFromHash(hash: string): LessonPackage | null {
  const raw = hash.replace(/^#/, "");
  const params = new URLSearchParams(raw);
  const data = params.get("d");
  if (!data) return null;
  try {
    const json = decompressFromEncodedURIComponent(data);
    if (!json) return null;
    return JSON.parse(json) as LessonPackage;
  } catch {
    return null;
  }
}
