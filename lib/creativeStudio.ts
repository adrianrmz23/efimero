/** Plantillas de Efímero v1.9. Composición determinista: la IA nunca escribe el texto. */
export type CreativeKind = "prayer" | "minimal" | "photo";
export type CreativeAspect = "1:1" | "4:5" | "9:16";
export type CreativeContent = { kind:CreativeKind; title:string; body:string; saint:string; intention:string };
export type CreativeBrand = { name:string; handle:string; avatar:string; logo:string; accent:string };
export type CreativeAsset = { art:string };
export type CreativeQueueItem = { id:string; fileName:string; dataUrl:string; sourceText:string; pageId:string; caption:string };
export const CREATIVE_DIMENSIONS:Record<CreativeAspect,[number,number]> = {"1:1":[1080,1080],"4:5":[1080,1350],"9:16":[1080,1920]};
const fontSans='Arial, "Helvetica Neue", sans-serif';
const fontSerif='Georgia, "Times New Roman", serif';
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
function rounded(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function imageFrom(source:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("No se pudo abrir una imagen de la plantilla."));img.src=source;});}
function crop(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number){const ratio=Math.max(w/img.width,h/img.height),sw=w/ratio,sh=h/ratio;ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h)}
function linesFor(ctx:CanvasRenderingContext2D,text:string,width:number){const out:string[]=[];for(const paragraph of text.trim().split(/\n+/)){if(!paragraph.trim()){out.push("");continue}let line="";for(const word of paragraph.trim().split(/\s+/)){const candidate=line?`${line} ${word}`:word;if(line&&ctx.measureText(candidate).width>width){out.push(line);line=word}else line=candidate}if(line)out.push(line);}return out;}
function textBlock(ctx:CanvasRenderingContext2D,value:string,rect:{x:number;y:number;w:number;h:number},options:{font:string;size:number;min:number;max?:number;lineHeight:number;align?:CanvasTextAlign;color:string;weight?:string}){
  const text=value.trim(); if(!text)return {fits:true,lines:0,size:options.size};
  let size=options.size;let lines:string[]=[];let height=Infinity;
  do{ctx.font=`${options.weight||"400"} ${size}px ${options.font}`;lines=linesFor(ctx,text,rect.w);height=lines.length*size*options.lineHeight; if(height<=rect.h)break;size-=2;}while(size>=options.min);
  if(height>rect.h)return {fits:false,lines:lines.length,size};
  ctx.fillStyle=options.color;ctx.textAlign=options.align||"left";ctx.textBaseline="top";
  let yy=rect.y;const xx=options.align==="center"?rect.x+rect.w/2:options.align==="right"?rect.x+rect.w:rect.x;
  for(const line of lines){if(line)ctx.fillText(line,xx,yy,rect.w);yy+=size*options.lineHeight;}
  return {fits:true,lines:lines.length,size};
}
function fillPaper(ctx:CanvasRenderingContext2D,w:number,h:number){const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,"#eee0bc");grad.addColorStop(.48,"#f9edcf");grad.addColorStop(1,"#c6a26f");ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  // Grain without randomized layout: repeatable result and no generative expenses.
  for(let i=0;i<360;i++){const x=((i*4337)%1009)/1009*w,y=((i*2399)%1013)/1013*h;ctx.fillStyle=i%2?"rgba(93,55,20,.055)":"rgba(255,250,230,.13)";ctx.fillRect(x,y,2+(i%3),1+(i%2));}}
function ornate(ctx:CanvasRenderingContext2D,w:number,h:number){ctx.strokeStyle="#95651f";ctx.lineWidth=8;rounded(ctx,19,19,w-38,h-38,20);ctx.stroke();ctx.strokeStyle="#e7b958";ctx.lineWidth=3;rounded(ctx,31,31,w-62,h-62,14);ctx.stroke();
 for(const sx of [1,-1])for(const sy of [1,-1]){ctx.save();ctx.translate(sx>0?42:w-42,sy>0?42:h-42);ctx.scale(sx,sy);ctx.strokeStyle="#9f6b25";ctx.lineWidth=6;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(0,110-i*12);ctx.bezierCurveTo(18+i*8,56,90,65-i*7,101,0);ctx.stroke();}for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(26+i*20,24+i*12,12,26,Math.PI/4,0,Math.PI*2);ctx.stroke();}ctx.restore();}}

const fontInter='Inter, "Segoe UI", "Helvetica Neue", Arial, sans-serif';
// Espera a que Inter esté lista: si el canvas dibuja antes, usa la fuente de respaldo.
async function ensureInter(){
  if(typeof document==="undefined"||!document.fonts)return;
  try{await Promise.all([document.fonts.load(`400 48px Inter`),document.fonts.load(`700 48px Inter`)])}catch{/* Usa la fuente de respaldo. */}
}
// Divide en renglones respetando los saltos de línea del texto; "" marca una línea en blanco.
function wrapVerses(ctx:CanvasRenderingContext2D,text:string,width:number){
  const out:string[]=[];
  for(const raw of text.replace(/\r\n?/g,"\n").trim().split("\n")){
    const verse=raw.trim();
    if(!verse){if(out.length&&out[out.length-1]!=="")out.push("");continue}
    let line="";
    for(const word of verse.split(/\s+/)){const candidate=line?`${line} ${word}`:word;if(line&&ctx.measureText(candidate).width>width){out.push(line);line=word}else line=candidate}
    if(line)out.push(line);
  }
  return out;
}

// Plantilla "Texto minimalista": fiel al formato de publicación tipo tweet (avatar, nombre, @usuario, título y versos).
async function drawMinimal(ctx:CanvasRenderingContext2D,w:number,h:number,content:CreativeContent,brand:CreativeBrand){
  await ensureInter();
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,w,h);
  const pad=w*.044, textW=w-pad*2;
  const avatarD=w*.148, gapHeader=w*.026;
  const nameSize=w*.044, handleSize=w*.04;
  const titleText=(content.title||"").trim();
  const body=(content.body||"").trim();
  // Autoajuste: baja el tamaño hasta que todo el bloque quepa en el 86% del alto.
  let size=w*.053, lines:string[]=[], titleLines:string[]=[], blockH=0;
  const lineH=()=>size*1.3, blankH=()=>lineH()*.75;
  const measure=()=>{
    ctx.font=`400 ${size}px ${fontInter}`;
    titleLines=titleText?wrapVerses(ctx,titleText,textW):[];
    lines=wrapVerses(ctx,body,textW);
    const textH=[...titleLines,...(titleLines.length?[""]:[]),...lines].reduce((n,l)=>n+(l?lineH():blankH()),0);
    blockH=avatarD+h*.056+textH;
  };
  measure();
  while(blockH>h*.86&&size>w*.026){size-=1;measure()}
  if(blockH>h*.94)return false;
  // El bloque queda ligeramente por debajo del centro, como en las referencias.
  const top=Math.max(h*.04,h*.535-blockH/2);
  const cx=pad+avatarD/2, cy=top+avatarD/2;
  if(brand.avatar){const avatar=await imageFrom(brand.avatar);ctx.save();ctx.beginPath();ctx.arc(cx,cy,avatarD/2,0,Math.PI*2);ctx.clip();crop(ctx,avatar,pad,top,avatarD,avatarD);ctx.restore();}
  else{ctx.fillStyle="#111111";ctx.beginPath();ctx.arc(cx,cy,avatarD/2,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ffffff";ctx.font=`700 ${avatarD*.42}px ${fontInter}`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText((brand.name||"E").trim().slice(0,1).toUpperCase(),cx,cy+avatarD*.02);}
  const bx=pad+avatarD+gapHeader, bw=w-bx-pad;
  ctx.textAlign="left";ctx.textBaseline="alphabetic";
  const hasHandle=Boolean(brand.handle.trim());
  ctx.fillStyle="#0f0f0f";ctx.font=`700 ${nameSize}px ${fontInter}`;
  ctx.fillText(brand.name||"Tu página",bx,hasHandle?cy-avatarD*.04:cy+nameSize*.36,bw);
  if(hasHandle){const handle=brand.handle.trim().startsWith("@")?brand.handle.trim():`@${brand.handle.trim()}`;ctx.fillStyle="#8a8a8f";ctx.font=`400 ${handleSize}px ${fontInter}`;ctx.fillText(handle,bx,cy+avatarD*.3,bw);}
  let y=top+avatarD+h*.056;
  ctx.fillStyle="#0d0d0d";ctx.font=`400 ${size}px ${fontInter}`;ctx.textBaseline="top";
  for(const l of [...titleLines,...(titleLines.length?[""]:[]),...lines]){
    if(l){ctx.fillText(l,pad,y+(lineH()-size)/2,textW);y+=lineH()}else y+=blankH();
  }
  return true;
}

// Plantilla "Oración con fondo": foto oscurecida, título condensado en mayúsculas, oración centrada y firma tenue.
const fontTitle='"Bebas Neue", Impact, "Arial Narrow", sans-serif';
const fontRound='Poppins, "Segoe UI", Arial, sans-serif';
async function ensurePhotoFonts(){
  if(typeof document==="undefined"||!document.fonts)return;
  try{await Promise.all([document.fonts.load(`400 48px "Bebas Neue"`),document.fonts.load(`400 48px Poppins`)])}catch{/* Usa la fuente de respaldo. */}
}
// Brillo medio del fondo (0 a 1) para oscurecer más las fotos claras.
function averageLuminance(img:HTMLImageElement){
  try{const c=document.createElement("canvas");c.width=c.height=16;const x=c.getContext("2d");if(!x)return .4;x.drawImage(img,0,0,16,16);const d=x.getImageData(0,0,16,16).data;let sum=0;for(let i=0;i<d.length;i+=4)sum+=(d[i]*.299+d[i+1]*.587+d[i+2]*.114)/255;return sum/(d.length/4)}catch{return .4}
}
async function drawPhoto(ctx:CanvasRenderingContext2D,w:number,h:number,content:CreativeContent,brand:CreativeBrand,background:string){
  await ensurePhotoFonts();
  if(background){
    const img=await imageFrom(background);crop(ctx,img,0,0,w,h);
    ctx.fillStyle=`rgba(0,0,0,${clamp(.42+(averageLuminance(img)-.35)*.7,.42,.72)})`;ctx.fillRect(0,0,w,h);
  }else{
    const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,"#1d2433");g.addColorStop(1,"#0b0d12");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  }
  const pad=w*.065, textW=w-pad*2;
  const title=(content.title||"").trim().toLocaleUpperCase("es-MX");
  const body=(content.body||"").trim();
  // Autoajuste: título y oración bajan juntos hasta que el bloque quepa en el 80% del alto.
  let titleSize=w*.088, size=w*.031, titleLines:string[]=[], lines:string[]=[], blockH=0;
  const lineH=()=>size*1.16, blankH=()=>lineH()*.95, titleLineH=()=>titleSize, gap=()=>size*1.6;
  const measure=()=>{
    ctx.font=`400 ${titleSize}px ${fontTitle}`;titleLines=title?wrapVerses(ctx,title,textW):[];
    ctx.font=`400 ${size}px ${fontRound}`;lines=wrapVerses(ctx,body,textW);
    blockH=titleLines.length*titleLineH()+(titleLines.length?gap():0)+lines.reduce((n,l)=>n+(l?lineH():blankH()),0);
  };
  // Si el título cabe en un renglón reduciéndolo un poco, se prefiere así (como en las referencias).
  if(title){ctx.font=`400 ${titleSize}px ${fontTitle}`;const single=ctx.measureText(title).width;if(single>textW&&titleSize*textW/single>=w*.062)titleSize=Math.floor(titleSize*textW/single)}
  measure();
  while(blockH>h*.8&&size>w*.019){size-=1;titleSize=Math.max(w*.055,titleSize-1.5);measure()}
  if(blockH>h*.88)return false;
  const footerH=w*.075;
  let y=Math.max(h*.06,(h-blockH-footerH)/2);
  ctx.textAlign="center";ctx.textBaseline="top";ctx.fillStyle="#ffffff";
  ctx.shadowColor="rgba(0,0,0,.45)";ctx.shadowBlur=w*.008;ctx.shadowOffsetY=w*.002;
  ctx.font=`400 ${titleSize}px ${fontTitle}`;
  for(const l of titleLines){ctx.fillText(l,w/2,y,textW);y+=titleLineH()}
  if(titleLines.length)y+=gap();
  ctx.font=`400 ${size}px ${fontRound}`;
  for(const l of lines){if(l){ctx.fillText(l,w/2,y+(lineH()-size)/2,textW);y+=lineH()}else y+=blankH()}
  // Firma: logo (o una "f") y el nombre de la página, en blanco tenue debajo de la oración.
  ctx.shadowColor="transparent";ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  const name=(brand.name||"").trim();
  if(name){
    const nameSize=w*.031, icon=nameSize*1.3, fy=Math.min(h*.95-icon/2,y+footerH*.6);
    ctx.font=`400 ${nameSize}px ${fontRound}`;const nameW=ctx.measureText(name).width;const x0=w/2-(icon+nameSize*.6+nameW)/2;
    ctx.globalAlpha=.42;
    if(brand.logo){const logo=await imageFrom(brand.logo);crop(ctx,logo,x0,fy-icon/2,icon,icon)}
    else{ctx.fillStyle="#ffffff";ctx.font=`700 ${icon*1.15}px Arial, sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("f",x0+icon/2,fy+icon*.04)}
    ctx.fillStyle="#ffffff";ctx.font=`400 ${nameSize}px ${fontRound}`;ctx.textAlign="left";ctx.textBaseline="middle";ctx.fillText(name,x0+icon+nameSize*.6,fy);
    ctx.globalAlpha=1;
  }
  return true;
}

export async function drawCreative(canvas:HTMLCanvasElement,content:CreativeContent,brand:CreativeBrand,assets:CreativeAsset,aspect:CreativeAspect):Promise<{dataUrl:string;error?:string}>{
 const [w,h]=CREATIVE_DIMENSIONS[aspect];canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("No se pudo iniciar Canvas.");const isPrayer=content.kind==="prayer";
 let fits=true;
 if(isPrayer){
   fillPaper(ctx,w,h);
   if(assets.art){const art=await imageFrom(assets.art);ctx.save();ctx.beginPath();ctx.rect(40,40,w*.44,h-80);ctx.clip();crop(ctx,art,40,40,w*.53,h-80);ctx.restore();const fade=ctx.createLinearGradient(w*.32,0,w*.69,0);fade.addColorStop(0,"rgba(243,228,195,0)");fade.addColorStop(1,"rgba(248,235,205,1)");ctx.fillStyle=fade;ctx.fillRect(w*.3,36,w*.44,h-72)}
   else {const g=ctx.createLinearGradient(0,0,w*.48,h);g.addColorStop(0,"#d6c395");g.addColorStop(1,"#936b38");ctx.fillStyle=g;ctx.fillRect(40,40,w*.42,h-80);ctx.fillStyle="rgba(255,244,214,.65)";ctx.beginPath();ctx.arc(w*.22,h*.31,105,0,Math.PI*2);ctx.fill();ctx.fillStyle="#66431d";ctx.font=`700 ${Math.floor(w*.025)}px ${fontSerif}`;ctx.textAlign="center";ctx.fillText("ILUSTRACIÓN",w*.24,h*.63);ctx.fillText("DEL SANTO",w*.24,h*.67);}
   // Headings respect artwork left and body right, similar to the supplied example but not a pixel copy.
   const rightX=w*.48, rightW=w*.45;
   let t=textBlock(ctx,"Oración a",{x:rightX,y:h*.045,w:rightW,h:h*.07},{font:fontSerif,size:w*.045,min:30,lineHeight:1.1,align:"center",color:"#372914"});fits&&=t.fits;
   t=textBlock(ctx,content.saint||"Santo o advocación",{x:rightX-20,y:h*.105,w:rightW+40,h:h*.13},{font:fontSerif,size:w*.055,min:32,lineHeight:1.03,align:"center",weight:"700",color:"#382c18"});fits&&=t.fits;
   t=textBlock(ctx,content.intention||"fe y esperanza",{x:rightX,y:h*.238,w:rightW,h:h*.065},{font:fontSerif,size:w*.031,min:24,lineHeight:1.1,align:"center",color:"#49341e"});fits&&=t.fits;
   ctx.strokeStyle="#aa7b39";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(rightX+35,h*.31);ctx.lineTo(rightX+rightW-35,h*.31);ctx.stroke();
   const bodyY=h*.335,bodyEnd=h*.875;
   t=textBlock(ctx,content.body,{x:rightX+8,y:bodyY,w:rightW-16,h:bodyEnd-bodyY},{font:fontSerif,size:w*.028,min:22,lineHeight:1.31,align:"center",color:"#30251a"});fits&&=t.fits;
   ctx.fillStyle="#3c3d23";ctx.font=`700 ${w*.025}px ${fontSans}`;ctx.textAlign="center";
   if(brand.logo){const logo=await imageFrom(brand.logo);crop(ctx,logo,w*.668,h*.89,w*.082,w*.052);}
   ctx.fillText(brand.name||"TU PÁGINA",w*.73,h*.918,w*.42);
   ornate(ctx,w,h);
 }else if(content.kind==="photo"){
   fits=await drawPhoto(ctx,w,h,content,brand,assets.art);
 }else{
   fits=await drawMinimal(ctx,w,h,content,brand);
 }
 if(!fits)return {dataUrl:"",error:"El texto es demasiado largo para este formato. Acorta la oración o elige una imagen más vertical."};
 return {dataUrl:canvas.toDataURL("image/jpeg",.91)};
}
export function splitCreativeBatch(raw:string,kind:CreativeKind,defaults:CreativeContent):CreativeContent[]{
  // One item per --- separator. Prayer: optional first line `Santo | Intención`.
  return raw.split(/^\s*---\s*$/m).map(chunk=>chunk.trim()).filter(Boolean).slice(0,100).map(chunk=>{
    if(kind==="prayer"){
      const lines=chunk.split("\n"); const head=lines[0]||"";
      if(head.includes("|")){const [saint,intention]=head.split("|").map(s=>s.trim());return {...defaults,kind,saint:saint||defaults.saint,intention:intention||defaults.intention,body:lines.slice(1).join("\n").trim()};}
      return {...defaults,kind,body:chunk};
    }
    const lines=chunk.split("\n");const head=lines[0]||"";
    if(head.includes("|")){const [title,...more]=head.split("|");return {...defaults,kind,title:title.trim()||defaults.title,body:[more.join("|").trim(),...lines.slice(1)].filter(Boolean).join("\n")};}
    return {...defaults,kind,body:chunk};
  });
}
