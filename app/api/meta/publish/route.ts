import { NextRequest, NextResponse } from "next/server";
import { publishToFacebook } from "@/lib/metaPublish";
import { getServerUser } from "@/lib/serverAuth";
import { resolvePageToken } from "@/app/api/meta/_shared";

export async function POST(request:NextRequest){
  const body=await request.json().catch(()=>({}));
  try{
    const user=await getServerUser();
    if(!user)return NextResponse.json({error:"Sesión requerida."},{status:401});
    const pageId=String(body.pageId||"");
    const trustedPageToken=await resolvePageToken(pageId);
    return NextResponse.json(await publishToFacebook({
    pageId,message:String(body.message||""),imageDataUrl:String(body.imageDataUrl||""),imageUrl:String(body.imageUrl||""),scheduledAt:String(body.scheduledAt||""),publishNow:body.publishNow,scheduledPostId:String(body.scheduledPostId||"")||undefined,trustedPageToken,
  }));}
  catch(error:any){return NextResponse.json({error:error?.message||"No fue posible publicar en Facebook.",compliance:error?.compliance},{status:Number(error?.status||502)});}
}
