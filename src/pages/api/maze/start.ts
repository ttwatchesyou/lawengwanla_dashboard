import type { NextApiRequest, NextApiResponse } from "next";
import { mainprogramProxy } from "../../../../lib/mainprogramApi";
import { validExecutionSettings } from "../../../../utils/mainprogramSettings";
import { missionChecks } from "../../../../utils/missionReadiness";
import { distanceOffsetsValid } from "../../../../utils/waypointSettings";

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse
) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ detail: "ใช้ POST เพื่อเริ่มภารกิจ" });
  }
  const checks = missionChecks(
    request.body?.route,
    request.body?.rack_selection,
    request.body?.waypoint_settings
  );
  if (!checks.every((check) => check.passed)) {
    return response.status(400).json({
      code: "MISSION_NOT_READY",
      detail: "ยังเลือกภารกิจไม่ครบ กรุณาตรวจเงื่อนไขก่อนเริ่ม",
      checks,
    });
  }
  if (!validExecutionSettings(request.body?.execution_settings)) return response.status(400).json({detail: "ระยะสนามหรือจุดเริ่มจริงไม่ถูกต้อง"});
  const config=request.body.execution_settings;
  if (!distanceOffsetsValid(request.body.route,request.body.waypoint_settings ?? {},config.cell_m,config.start_mode,config.outside_clearance_m))
    return response.status(400).json({detail:"ระยะหลังปรับ +/− ต้องเหลืออย่างน้อย 1 ซม. และไม่ย้อนทิศ"});
  return mainprogramProxy(request, response, "start");
}
