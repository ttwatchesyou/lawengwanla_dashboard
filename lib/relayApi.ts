import type { NextApiRequest, NextApiResponse } from "next";

export async function relayHandler(req: NextApiRequest, res: NextApiResponse, action: "state" | "command") {
  res.setHeader("Cache-Control", "no-store");
  if (action !== "state" && action !== "command") return res.status(404).json({error: "Unknown relay endpoint"});
  const method = action === "state" ? "GET" : "POST";
  if (req.method !== method) {
    res.setHeader("Allow", method);
    return res.status(405).json({error: `Use ${method}`});
  }
  if (method === "POST") {
    const origin = req.headers.origin;
    try {
      if ((origin && new URL(origin).host !== req.headers.host) || req.headers["sec-fetch-site"] === "cross-site")
        return res.status(403).json({error: "Same-origin control required"});
    } catch { return res.status(403).json({error: "Invalid origin"}); }
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return res.status(415).json({error: "Use JSON"});
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 700);
  try {
    const upstream = await fetch(`http://127.0.0.1:8003/relay/${action}`, {
      method, signal: controller.signal,
      ...(method === "POST" ? {headers: {"Content-Type": "application/json"}, body: JSON.stringify(req.body)} : {}),
    });
    return res.status(upstream.status).json(await upstream.json());
  } catch {
    return res.status(503).json({error: "Relay ROS gateway unavailable", ready: false, outputs: null});
  } finally { clearTimeout(timeout); }
}
