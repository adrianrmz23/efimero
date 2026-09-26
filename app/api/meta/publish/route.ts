import { NextRequest, NextResponse } from "next/server";
import { publishToFacebook } from "@/lib/metaPublish";

export async function POST(request:NextRequest){
  const body=await request.json().catch(()=>({}));
  try{return NextResponse.json(await publishToFacebook({
    pageId:String(body.pageId||""),message:String(body.message||""),imageDataUrl:String(body.imageDataUrl||""),imageUrl:String(body.imageUrl||""),scheduledAt:String(body.scheduledAt||""),publishNow:body.publishNow,scheduledPostId:String(body.scheduledPostId||"")||undefined,
  }));}
  catch(error:any){return NextResponse.json({error:error?.message||"No fue posible publicar en Facebook.",compliance:error?.compliance},{status:Number(error?.status||502)});}
}
