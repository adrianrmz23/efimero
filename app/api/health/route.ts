import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export async function GET(){
  const user=await getServerUser();
  if(!user)return NextResponse.json({error:"Sesión requerida."},{status:401});
  return NextResponse.json({
    ok:true,
    checkedAt:new Date().toISOString(),
    auth:{session:true,email:user.email},
    services:{
      supabaseAdmin:Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY),
      openai:Boolean(process.env.OPENAI_API_KEY),
      openaiModel:process.env.OPENAI_MODEL||null,
      metaOauth:Boolean(process.env.META_APP_ID&&process.env.META_APP_SECRET&&process.env.META_OAUTH_REDIRECT_URI&&process.env.META_TOKEN_ENCRYPTION_KEY),
      graphVersion:process.env.META_GRAPH_VERSION||null,
    }
  });
}
