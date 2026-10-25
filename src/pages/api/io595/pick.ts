import type { NextApiRequest, NextApiResponse } from "next";
import { io595Handler } from "../../../../lib/io595Api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  const action = req.body?.action;
  if (!["prepare", "lock", "freeze", "reset"].includes(action)) return res.status(400).json({ error: "Unknown pickup action" });
  if (action !== "freeze") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 500);
    let main: any = null;
    try {
      const response = await fetch("http://127.0.0.1:8004/mainprogram/state", { signal: controller.signal, cache: "no-store" });
      if (response.ok) main = await response.json();
    } catch {} finally { clearTimeout(timer); }
    if (main && (["RUN", "STOPPING"].includes(main.status) || main.start_pending))
      return res.status(409).json({ error: "ภารกิจเริ่มแล้ว · ปิดรับการเลือกตำแหน่งชุดจับ", code: "MISSION_RUNNING" });
    if (action === "reset" && (!main?.ready || !main.pose_fresh || !Array.isArray(main.twist_world) ||
        main.twist_world.length !== 3 || main.twist_world.some((v: unknown) => typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 0.03)))
      return res.status(409).json({ error: "ต้องยืนยันว่าหุ่นหยุดจาก Mainprogram ก่อนเตรียมรอบใหม่" });
  }
  req.body = { op: { prepare: "pick_prepare", lock: "pick_lock", freeze: "pick_freeze", reset: "pick_reset" }[action as "prepare" | "lock" | "freeze" | "reset"],
    picks: req.body.picks, stop_generation: req.body.stop_generation };
  return io595Handler(req, res, "command");
}
