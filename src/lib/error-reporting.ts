/**
 * Minimal application-side error reporting.
 *
 * Keep this provider-neutral so local development and independent hosting do not
 * depend on editor-specific telemetry globals.
 */
export function reportAppError(error: unknown, context: Record<string, unknown> = {}): void {
  if (typeof console === "undefined") return;
  console.error("[Party Pantry Pals] Unhandled application error", {
    error,
    route: typeof window !== "undefined" ? window.location.pathname : undefined,
    ...context,
  });
}
