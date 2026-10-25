import type { NextApiRequest, NextApiResponse } from "next";
import { io595Handler } from "../../../../lib/io595Api";
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return io595Handler(req, res, "state");
}
