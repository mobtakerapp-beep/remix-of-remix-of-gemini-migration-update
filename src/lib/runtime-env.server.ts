type RuntimeBindings = Record<string, unknown>;

let workerBindings: RuntimeBindings = {};

/** Capture bindings passed to the Cloudflare Worker fetch entry point. */
export function setRuntimeBindings(bindings: unknown): void {
  if (bindings && typeof bindings === "object") {
    workerBindings = bindings as RuntimeBindings;
  }
}

/** Read a server secret in both Node-compatible and Cloudflare deployments. */
export function getRuntimeSecret(name: string): string | undefined {
  let processValue: unknown;
  try {
    // `process` may be missing/partial in some edge runtimes.
    processValue = typeof process !== "undefined" ? process.env?.[name] : undefined;
  } catch {
    processValue = undefined;
  }
  if (typeof processValue === "string" && processValue.trim()) return processValue.trim();

  const workerValue = workerBindings[name];
  return typeof workerValue === "string" && workerValue.trim() ? workerValue.trim() : undefined;
}