import type { NextApiRequest, NextApiResponse } from "next";
import { relayHandler } from "../../../../lib/relayApi";
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return relayHandler(req, res, "command");
}
export const config = {api: {bodyParser: {sizeLimit: "2kb"}}};
