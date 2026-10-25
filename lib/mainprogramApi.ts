import type { NextApiRequest, NextApiResponse } from "next";

export async function mainprogramProxy(req: NextApiRequest, res: NextApiResponse, action: "state" | "start" | "stop" | "anchor") {
  res.setHeader("Cache-Control", "no-store");
  const method = action === "state" ? "GET" : "POST";
  if (req.method !== method) { res.setHeader("Allow", method); return res.status(405).json({detail: `Use ${method}`}); }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const upstream = await fetch(`http://127.0.0.1:8004/mainprogram/${action}${action === "state" ? `?after=${encodeURIComponent(String(req.query.after ?? "0"))}` : ""}`, {
      method, signal: controller.signal,
      ...(method === "POST" ? {headers: {"Content-Type": "application/json"}, body: JSON.stringify(req.body)} : {}),
    });
    return res.status(upstream.status).json(await upstream.json());
  } catch { return res.status(503).json({status: "ERROR", ready: false, detail: "Mainprogram ยังไม่เปิด · เปิด lawengwanla-mainprogram.service ในหน้า Service"}); }
  finally { clearTimeout(timer); }
}
