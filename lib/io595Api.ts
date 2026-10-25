import type { NextApiRequest, NextApiResponse } from "next";

export async function io595Handler(req: NextApiRequest, res: NextApiResponse, action: "state" | "command") {
  res.setHeader("Cache-Control", "no-store");
  const method = action === "state" ? "GET" : "POST";
  if (req.method !== method) {
    res.setHeader("Allow", method);
    return res.status(405).json({error: `Use ${method}`});
  }
  if (method === "POST") {
    try {
      if ((req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) ||
          req.headers["sec-fetch-site"] === "cross-site") return res.status(403).json({error: "Same-origin control required"});
    } catch { return res.status(403).json({error: "Invalid origin"}); }
    if (!req.headers["content-type"]?.startsWith("application/json")) return res.status(415).json({error: "Use JSON"});
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 600);
  try {
    const upstream = await fetch(`http://127.0.0.1:8005/io595/${action}`, {
      method, signal: controller.signal,
      ...(method === "POST" ? {headers: {"Content-Type": "application/json"}, body: JSON.stringify(req.body)} : {}),
    });
    return res.status(upstream.status).json(await upstream.json());
  } catch { return res.status(503).json({connected: false, ready: false, packet: null}); }
  finally { clearTimeout(timeout); }
}
