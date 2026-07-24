// Local development API server. Mounts the exact same request dispatcher that
// the Vercel serverless function uses, so behaviour matches production.
import express from "express";
import { handleApi } from "../api/_router";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true })); // NEKpay callbacks are form-urlencoded

app.use("/api", async (req, res) => {
  const path = req.path === "/" ? "/" : req.path.replace(/\/$/, "");
  const result = await handleApi({
    method: req.method,
    path,
    query: req.query as Record<string, string | string[] | undefined>,
    headers: req.headers as Record<string, string | string[] | undefined>,
    body: req.body,
  });
  if (result.headers) for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
  if (typeof result.text === "string") {
    res.status(result.status).type("text/plain").send(result.text);
    return;
  }
  res.status(result.status).json(result.body);
});

const port = Number(process.env.API_PORT) || 3001;
app.listen(port, () => console.log(`🔌 API dev server on http://localhost:${port}`));
