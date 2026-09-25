import { NextRequest, NextResponse } from "next/server";
import { graphBase, resolvePageToken } from "../_shared";
import { localComplianceReview } from "@/lib/metaCompliance";

function parseDataUrl(dataUrl:string){
  const match=dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if(!match)return null;
  return {mime:match[1],buffer:Buffer.from(match[2],"base64")};
}

async function postForm(path:string,form:FormData){
  const response=await fetch(new URL(path.replace(/^\//,""),graphBase),{method:"POST",body:form,cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data?.error)throw new Error(data?.error?.message||`Meta Graph API respondió ${response.status}`);
  return data;
}

export async function POST(request:NextRequest){
  const body=await request.json().catch(()=>({}));
  const pageId=String(body.pageId||"").trim();
  const message=String(body.message||"").trim();
  const imageDataUrl=String(body.imageDataUrl||"").trim();
  const imageUrl=String(body.imageUrl||"").trim();
  const scheduledAt=String(body.scheduledAt||"").trim();
  const publishNow=body.publishNow!==false&&!scheduledAt;
  if(!pageId)return NextResponse.json({error:"Falta pageId."},{status:400});
  if(!message&&!imageDataUrl&&!imageUrl)return NextResponse.json({error:"La publicación está vacía."},{status:400});

  const compliance=localComplianceReview(message);
  if(message&&compliance.status!=="pass")return NextResponse.json({error:"El texto no pasó Compliance Meta.",compliance},{status:422});

  try{
    const token=await resolvePageToken(pageId);
    const scheduleEpoch=scheduledAt?Math.floor(new Date(scheduledAt).getTime()/1000):0;
    let result:any;
    if(imageDataUrl||imageUrl){
      const form=new FormData();
      form.set("access_token",token);
      if(message)form.set("caption",message);
      if(!publishNow){form.set("published","false");if(scheduleEpoch)form.set("scheduled_publish_time",String(scheduleEpoch));}
      if(imageDataUrl){
        const parsed=parseDataUrl(imageDataUrl);if(!parsed)throw new Error("La imagen generada no tiene un formato válido.");
        form.set("source",new Blob([parsed.buffer],{type:parsed.mime}),"efimero.png");
      }else form.set("url",imageUrl);
      result=await postForm(`${pageId}/photos`,form);
    }else{
      const form=new FormData();
      form.set("access_token",token);form.set("message",message);
      if(!publishNow){form.set("published","false");if(scheduleEpoch)form.set("scheduled_publish_time",String(scheduleEpoch));}
      result=await postForm(`${pageId}/feed`,form);
    }
    return NextResponse.json({ok:true,pageId,publishNow,scheduledAt:scheduledAt||null,id:result?.post_id||result?.id||null,raw:result});
  }catch(error:any){return NextResponse.json({error:error?.message||"No fue posible publicar en Facebook."},{status:502});}
}
