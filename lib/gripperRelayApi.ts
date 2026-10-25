import type { NextApiRequest, NextApiResponse } from "next";
export async function gripperRelayHandler(req:NextApiRequest,res:NextApiResponse,action:"state"|"command"){
  res.setHeader("Cache-Control","no-store");
  const method=action==="state"?"GET":"POST";
  if(req.method!==method){res.setHeader("Allow",method);return res.status(405).json({error:`Use ${method}`});}
  if(method==="POST"){
    try{if((req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)||req.headers["sec-fetch-site"]==="cross-site")return res.status(403).json({error:"Same-origin control required"});}
    catch{return res.status(403).json({error:"Invalid origin"});}
    if(!req.headers["content-type"]?.startsWith("application/json"))return res.status(415).json({error:"Use JSON"});
    const values=req.body?.values;
    if(!Array.isArray(values)||values.length!==4||values.some(v=>!Number.isInteger(v)||(v!==0&&v!==1)))return res.status(400).json({error:"ต้องเป็น array 0/1 จำนวน 4 ตำแหน่ง"});
  }
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),1000);
  try{
    const response=await fetch(`http://127.0.0.1:8009/relays/${action}`,{method,signal:controller.signal,...(method==="POST"?{headers:{"Content-Type":"application/json"},body:JSON.stringify(req.body)}:{})});
    return res.status(response.status).json(await response.json());
  }catch{return res.status(503).json({connected:false,ready:false,relay_values:null,error:"ยังติดต่อ ROS รีเลย์ชุดจับไม่ได้"});}
  finally{clearTimeout(timer);}
}
