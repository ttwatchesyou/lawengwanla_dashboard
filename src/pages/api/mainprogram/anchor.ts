import { mainprogramProxy } from "../../../../lib/mainprogramApi";
import type { NextApiRequest, NextApiResponse } from "next";
export default function handler(req: NextApiRequest, res: NextApiResponse) { return mainprogramProxy(req, res, "anchor"); }
