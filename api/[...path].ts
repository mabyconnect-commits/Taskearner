import type { VercelRequest, VercelResponse } from "@vercel/node";

// Build marker so we can confirm exactly which deployment is live via /api/health.
const BUILD = "2026-07-24-lazydb-guard";

// Single catch-all function: routes every /api/* request through the shared
// dispatcher. The router is imported *dynamically inside the handler* so that a
// throw anywhere in the import chain (e.g. a bad DATABASE_URL) is caught and
// returned as readable JSON instead of an opaque FUNCTION_INVOCATION_FAILED
// crash page that reveals nothing.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const { handleApi } = await import("./_router");

    const url = new URL(req.url || "/", "http://localhost");
    let path = url.pathname.replace(/^\/api/, "") || "/";
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

    const result = await handleApi({
      method: req.method || "GET",
      path,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: req.body,
    });

    res.setHeader("x-taskearner-build", BUILD);
    if (result.headers) for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
    if (typeof result.text === "string") {
      res.status(result.status).setHeader("Content-Type", "text/plain");
      res.send(result.text);
      return;
    }
    res.status(result.status).json(result.body);
  } catch (e: any) {
    // Startup/import-time failure — surface the real reason instead of crashing.
    res.setHeader("x-taskearner-build", BUILD);
    res.status(500).json({
      error: "Server startup error",
      build: BUILD,
      detail: String(e?.message || e).slice(0, 300),
      where: String(e?.stack || "").split("\n").slice(0, 3).join(" | ").slice(0, 400),
    });
  }
}
