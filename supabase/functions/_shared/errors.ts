// Shared error logging + response helper for edge functions.
// Logs a structured JSON line (timestamp, function, message, stack, cause)
// and returns a JSON Response with helpful debugging fields.

export interface ErrorResponseOptions {
  /** Logical name of the calling function (e.g. "chat", "image-ai"). */
  fn: string;
  /** CORS headers to merge into the response. */
  corsHeaders: Record<string, string>;
  /** HTTP status to return. Defaults to 500. */
  status?: number;
  /** User-facing summary. Defaults to "Internal error". */
  userMessage?: string;
  /** Extra structured context to log (request id, params, etc.). */
  context?: Record<string, unknown>;
}

function serializeError(err: unknown): {
  name: string;
  message: string;
  stack?: string;
  cause?: unknown;
} {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      cause: (err as { cause?: unknown }).cause,
    };
  }
  if (typeof err === "object" && err !== null) {
    try {
      return { name: "NonError", message: JSON.stringify(err) };
    } catch {
      return { name: "NonError", message: String(err) };
    }
  }
  return { name: "NonError", message: String(err) };
}

export function logError(
  fn: string,
  err: unknown,
  context: Record<string, unknown> = {},
): { name: string; message: string; stack?: string } {
  const info = serializeError(err);
  // Single-line JSON so Supabase Logs ingest cleanly.
  console.error(
    JSON.stringify({
      level: "error",
      ts: new Date().toISOString(),
      fn,
      err: info,
      ctx: context,
    }),
  );
  return info;
}

export function errorResponse(
  err: unknown,
  opts: ErrorResponseOptions,
): Response {
  const {
    fn,
    corsHeaders,
    status = 500,
    userMessage = "Internal error",
    context,
  } = opts;
  const info = logError(fn, err, context ?? {});

  return new Response(
    JSON.stringify({
      error: userMessage,
      details: info.message,
      type: info.name,
      // Stack is useful in dev; safe because functions run server-side.
      stack: info.stack?.split("\n").slice(0, 8).join("\n"),
      fn,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

// Install a global handler so bundling/startup throws and unhandled
// promise rejections produce a structured log line instead of a bare
// "Internal Server Error".
export function installGlobalErrorHandlers(fn: string) {
  globalThis.addEventListener?.("error", (e) => {
    // @ts-ignore - ErrorEvent shape
    logError(fn, e?.error ?? e?.message ?? e, { source: "window.error" });
  });
  globalThis.addEventListener?.("unhandledrejection", (e) => {
    // @ts-ignore - PromiseRejectionEvent shape
    logError(fn, e?.reason ?? e, { source: "unhandledrejection" });
  });
}
