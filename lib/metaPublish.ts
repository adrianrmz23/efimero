import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { buildAppSecretProof, resolveAnyStoredPageToken } from "@/lib/metaServer";
import { metaGraphBase } from "@/lib/metaServer";
import { localComplianceReview } from "@/lib/metaCompliance";

function parseDataUrl(dataUrl:string){
  const match=dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if(!match)return null;
  return {mime:match[1],buffer:Buffer.from(match[2],"base64")};
}

async function postForm(path:string,form:FormData){
  const response=await fetch(new URL(path.replace(/^\//,""),metaGraphBase),{method:"POST",body:form,cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data?.error)throw new Error(data?.error?.message||`Meta Graph API respondió ${response.status}`);
  return data;
}

export type PublishInput={
  pageId:string;
  message?:string;
  imageDataUrl?:string;
  imageUrl?:string;
  scheduledAt?:string;
  publishNow?:boolean;
  scheduledPostId?:string;
};

export async function publishToFacebook(input:PublishInput){
  const pageId=String(input.pageId||"").trim();
  const message=String(input.message||"").trim();
  const imageDataUrl=String(input.imageDataUrl||"").trim();
  const imageUrl=String(input.imageUrl||"").trim();
  const scheduledAt=String(input.scheduledAt||"").trim();
  const publishNow=input.publishNow!==false&&!scheduledAt;
  if(!pageId)throw new Error("Falta pageId.");
  if(!message&&!imageDataUrl&&!imageUrl)throw new Error("La publicación está vacía.");

  const compliance=localComplianceReview(message);
  if(message&&compliance.status!=="pass"){
    const error:any=new Error("El texto no pasó Compliance Meta.");
    error.status=422;error.compliance=compliance;throw error;
  }

  if(scheduledAt&&!publishNow){
    const target=new Date(scheduledAt);
    if(Number.isNaN(target.getTime())){const error:any=new Error("La fecha de programación no es válida.");error.status=400;throw error;}
    const minFuture=Date.now()+10*60_000;
    if(target.getTime()<minFuture){const error:any=new Error("La publicación debe programarse al menos 10 minutos después de la hora actual.");error.status=400;throw error;}
  }

  const token=(await resolveAnyStoredPageToken(pageId)).token;
  const scheduleEpoch=scheduledAt?Math.floor(new Date(scheduledAt).getTime()/1000):0;
  let result:any;
  if(imageDataUrl||imageUrl){
    const form=new FormData();
    form.set("access_token",token);
    const proof=buildAppSecretProof(token);if(proof)form.set("appsecret_proof",proof);
    if(message)form.set("caption",message);
    if(!publishNow){form.set("published","false");if(scheduleEpoch)form.set("scheduled_publish_time",String(scheduleEpoch));}
    if(imageDataUrl){
      const parsed=parseDataUrl(imageDataUrl);if(!parsed)throw new Error("La imagen generada no tiene un formato válido.");
      form.set("source",new Blob([parsed.buffer],{type:parsed.mime}),"efimero.png");
    }else form.set("url",imageUrl);
    result=await postForm(`${pageId}/photos`,form);
  }else{
    const form=new FormData();
    form.set("access_token",token);
    const proof=buildAppSecretProof(token);if(proof)form.set("appsecret_proof",proof);
    form.set("message",message);
    if(!publishNow){form.set("published","false");if(scheduleEpoch)form.set("scheduled_publish_time",String(scheduleEpoch));}
    result=await postForm(`${pageId}/feed`,form);
  }

  const metaPostId=String(result?.post_id||result?.id||"")||null;
  if(input.scheduledPostId){
    const admin=getSupabaseAdmin();
    await admin.from("efimero_scheduled_posts").update({
      status:publishNow?"Publicado":"Programado",
      meta_post_id:metaPostId,
      published_at_actual:publishNow?new Date().toISOString():null,
      publish_error:null,
    }).eq("id",input.scheduledPostId);
  }
  return {ok:true,pageId,publishNow,scheduledAt:scheduledAt||null,id:metaPostId,raw:result};
}
