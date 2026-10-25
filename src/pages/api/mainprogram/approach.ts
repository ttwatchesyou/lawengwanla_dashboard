import type { NextApiRequest, NextApiResponse } from "next";
import { mainprogramProxy } from "../../../../lib/mainprogramApi";
import { validExecutionSettings } from "../../../../utils/mainprogramSettings";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  if (!validExecutionSettings(req.body?.execution_settings)) return res.status(400).json({detail:"ระยะต่อช่องไม่ถูกต้อง"});
  req.body={route_mode:"approach_only",motion_policy:{heading_reference:"boot_zero",initial_heading_deg:0},execution_settings:{...req.body.execution_settings,start_mode:"outside_a6",exit_clearance_m:0}};
  return mainprogramProxy(req,res,"start");
}
