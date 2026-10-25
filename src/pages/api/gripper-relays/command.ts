import type { NextApiRequest, NextApiResponse } from "next";
import { gripperRelayHandler } from "../../../../lib/gripperRelayApi";
export default function handler(req:NextApiRequest,res:NextApiResponse){return gripperRelayHandler(req,res,"command");}
export const config={api:{bodyParser:{sizeLimit:"1kb"}}};
