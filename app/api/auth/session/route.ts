import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME="efimero_session";

function allowlist(){
  return (process.env.AUTH_ALLOWED_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
}

async function verify(token:string){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!anon)throw new Error("Supabase no está configurado.");
  const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`},cache:"no-store"});
  if(!r.ok)return null;
  return r.json();
}

export async function POST(req:NextRequest){
  try{
    const {accessToken}=await req.json();
    if(!accessToken)return NextResponse.json({error:"Falta el token de sesión."},{status:400});
    const user=await verify(accessToken);
    const email=String(user?.email||"").toLowerCase();
    const allowed=allowlist();
    if(!user?.id||!email||!allowed.length||!allowed.includes(email)){
      return NextResponse.json({error:"Esta cuenta no está autorizada para Efímero Content Engine."},{status:403});
    }
    const payload=JSON.parse(Buffer.from(accessToken.split(".")[1],"base64url").toString("utf8"));
    const maxAge=Math.max(60,Number(payload.exp||0)-Math.floor(Date.now()/1000));
    const res=NextResponse.json({ok:true,email});
    res.cookies.set(COOKIE_NAME,accessToken,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge});
    return res;
  }catch(e:any){return NextResponse.json({error:e?.message||"No fue posible iniciar la sesión privada."},{status:500})}
}

export async function DELETE(){
  const res=NextResponse.json({ok:true});
  res.cookies.set(COOKIE_NAME,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});
  return res;
}
