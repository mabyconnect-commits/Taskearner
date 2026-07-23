import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleApi } from "./_router";

// Single catch-all function: routes every /api/* request through the shared
// dispatcher. Keeps us to one Serverless Function (well under plan limits).
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
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

  if (result.headers) for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
  res.status(result.status).json(result.body);
}
