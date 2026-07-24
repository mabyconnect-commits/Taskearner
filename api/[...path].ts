import type { VercelRequest, VercelResponse } from "@vercel/node";

// Build marker so we can confirm exactly which deployment is live via /api/health.
const BUILD = "2026-07-24-post-guard";

// Stray async errors (e.g. from the pg driver on a cold connection) must not
// crash the whole function — log them instead of letting the process die.
const g = globalThis as any;
if (!g.__guardsInstalled) {
  g.__guardsInstalled = true;
  process.on("unhandledRejection", (reason) => console.error("[unhandledRejection]", reason));
  process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));
}

// Read the JSON body reliably. On some Vercel ESM setups req.body isn't parsed
// (or isn't populated), so fall back to reading the raw request stream.
async function readBody(req: VercelRequest): Promise<any> {
  const b: any = (req as any).body;
  if (b && typeof b === "object") return b;
  if (typeof b === "string") {
    const s = b.trim();
    if (!s) return {};
    try { return JSON.parse(s); } catch { return {}; }
  }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req as any) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Single catch-all function. Everything runs inside try/catch so any failure —
// including an import-time throw — is returned as readable JSON instead of an
// opaque FUNCTION_INVOCATION_FAILED crash page.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("x-taskearner-build", BUILD);
  try {
    const method = (req.method || "GET").toUpperCase();
    const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);

    const { handleApi } = await import("./_router.js");

    const url = new URL(req.url || "/", "http://localhost");
    let path = url.pathname.replace(/^\/api/, "") || "/";
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

    const result = await handleApi({
      method,
      path,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: req.headers as Record<string, string | string[] | undefined>,
      body,
    });

    if (result.headers) for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
    if (typeof result.text === "string") {
      res.status(result.status).setHeader("Content-Type", "text/plain");
      res.send(result.text);
      return;
    }
    res.status(result.status).json(result.body);
  } catch (e: any) {
    res.status(500).json({
      error: "Server error",
      build: BUILD,
      detail: String(e?.message || e).slice(0, 300),
      where: String(e?.stack || "").split("\n").slice(0, 3).join(" | ").slice(0, 400),
    });
  }
}
