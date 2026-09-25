import { NextRequest, NextResponse } from "next/server";

export async function POST(request:NextRequest){
  const body=await request.json().catch(()=>({}));
  const style=String(body.style||"editorial abstracta");
  const aspect=String(body.aspect||"1:1");
  const text=String(body.text||"").trim();
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return NextResponse.json({source:"local",imageDataUrl:null,message:"OPENAI_API_KEY no está configurada; usa un fondo local."});
  const model=process.env.OPENAI_IMAGE_MODEL||"gpt-image-2.5-flare";
  const size=aspect==="9:16"?"1024x1536":aspect==="4:5"?"1024x1536":"1024x1024";
  const prompt=`Crea únicamente el FONDO de una publicación editorial para Facebook. Estilo: ${style}. Debe ser elegante, emocional, contemporáneo, con suficiente espacio negativo al centro para sobreponer texto después. NO incluyas palabras, letras, tipografía, logotipos, marcas de agua ni símbolos de redes sociales. Evita rostros reconocibles. El texto que luego se colocará encima trata sobre: ${text.slice(0,300)}.`;
  try{
    const response=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,prompt,size,n:1,output_format:"png",quality:"medium"})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.error?.message||"No fue posible generar el fondo.");
    const b64=data?.data?.[0]?.b64_json;
    if(!b64)throw new Error("El modelo no devolvió una imagen.");
    return NextResponse.json({source:"openai",model,imageDataUrl:`data:image/png;base64,${b64}`});
  }catch(error:any){return NextResponse.json({error:error?.message||"No fue posible generar la imagen."},{status:502});}
}
