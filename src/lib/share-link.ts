import type { LessonPackage } from "./lesson-types";

/** URL-safe base64 encode/decode of UTF-8 text (works in browser and worker runtimes). */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Pack a lesson into a URL hash payload so students can open it without any login. */
export function encodeLessonToHash(pkg: LessonPackage): string {
  return toBase64Url(JSON.stringify(pkg));
}

export function decodeLessonFromHash(hash: string): LessonPackage | null {
  const raw = hash.replace(/^#/, "");
  const params = new URLSearchParams(raw);
  const data = params.get("d");
  if (!data) return null;
  try {
    const json = fromBase64Url(data);
    if (!json) return null;
    return JSON.parse(json) as LessonPackage;
  } catch {
    return null;
  }
}
