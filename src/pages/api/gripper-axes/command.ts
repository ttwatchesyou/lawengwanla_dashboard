import type { NextApiRequest, NextApiResponse } from "next";
import { gripperAxesHandler } from "../../../../lib/gripperAxesApi";
export default function handler(req:NextApiRequest,res:NextApiResponse){return gripperAxesHandler(req,res,"command");}
