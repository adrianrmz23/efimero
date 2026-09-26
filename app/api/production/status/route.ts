import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerUser } from "@/lib/serverAuth";
import { getMetaConnection } from "@/lib/metaServer";

export const dynamic="force-dynamic";
export async function GET(){
  try{
    const user=await getServerUser();if(!user)return NextResponse.json({error:"Sesión requerida."},{status:401});
    const admin=getSupabaseAdmin();
    const [connection,jobs,snapshots,dataset]=await Promise.all([
      getMetaConnection(user.id),
      admin.from("efimero_publish_jobs").select("state",{count:"exact",head:false}).limit(200),
      admin.from("efimero_metric_snapshots").select("id",{count:"exact",head:true}),
      admin.from("efimero_editorial_dataset").select("id",{count:"exact",head:true}),
    ]);
    const states=(jobs.data||[]).reduce((acc:any,x:any)=>{acc[x.state]=(acc[x.state]||0)+1;return acc},{});
    return NextResponse.json({ok:true,checkedAt:new Date().toISOString(),services:{cronSecret:Boolean(process.env.CRON_SECRET),metaOauth:Boolean(process.env.META_APP_ID&&process.env.META_APP_SECRET&&process.env.META_TOKEN_ENCRYPTION_KEY),metaConnected:Boolean(connection),metaStatus:connection?.status||"disconnected",openai:Boolean(process.env.OPENAI_API_KEY),embeddingModel:process.env.OPENAI_EMBEDDING_MODEL||"text-embedding-3-small",serviceRole:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),legacyMetaUserToken:Boolean(process.env.META_USER_ACCESS_TOKEN)},counts:{jobs:states,metricSnapshots:snapshots.count||0,datasetItems:dataset.count||0},legal:{privacy:"/privacy",terms:"/terms",dataDeletion:"/data-deletion"}});
  }catch(error:any){return NextResponse.json({error:error?.message||"No fue posible comprobar producción."},{status:500});}
}
