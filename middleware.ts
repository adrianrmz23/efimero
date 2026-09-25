import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "efimero_session";

function isPublicPath(pathname:string){
  return pathname === "/login" || pathname === "/api/auth/session" || pathname.startsWith("/_next/") || pathname === "/favicon.ico";
}

function allowedEmails(){
  return (process.env.AUTH_ALLOWED_EMAILS || "")
    .split(",")
    .map(x=>x.trim().toLowerCase())
    .filter(Boolean);
}

async function verifyToken(token:string){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!anon)return null;
  const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`},cache:"no-store"});
  if(!r.ok)return null;
  return r.json();
}

export async function middleware(req:NextRequest){
  const {pathname}=req.nextUrl;
  if(isPublicPath(pathname))return NextResponse.next();

  const token=req.cookies.get(COOKIE_NAME)?.value;
  const apiRequest=pathname.startsWith("/api/");
  if(!token){
    if(apiRequest)return NextResponse.json({error:"Sesión requerida."},{status:401});
    const login=new URL("/login",req.url);login.searchParams.set("next",pathname);return NextResponse.redirect(login);
  }

  try{
    const user=await verifyToken(token);
    const email=String(user?.email||"").toLowerCase();
    const allow=allowedEmails();
    const valid=Boolean(user?.id && email && allow.length && allow.includes(email));
    if(valid)return NextResponse.next();
  }catch{}

  if(apiRequest){
    const res=NextResponse.json({error:"Sesión inválida o no autorizada."},{status:401});
    res.cookies.delete(COOKIE_NAME);return res;
  }
  const login=new URL("/login",req.url);
  const res=NextResponse.redirect(login);res.cookies.delete(COOKIE_NAME);return res;
}

export const config={matcher:["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"]};
