// Convierte un Excel/CSV en filas para el Estudio creativo: una fila = una imagen.
export type SheetRow = { title:string; body:string; caption:string };

const normalizeHeader=(value:unknown)=>String(value??"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,"");
const TITLE=["titulo","title","encabezado","tema"];
const BODY=["texto","oracion","body","text","contenido","salmo","mensaje","versiculo"];
const CAPTION=["caption","descripcion","copy","textofacebook","pie","piedefoto"];

// CSV/TSV con comillas, comillas escapadas ("") y saltos de línea dentro de una celda.
export function parseDelimited(source:string):string[][]{
  const text=source.replace(/^﻿/,"").replace(/\r\n?/g,"\n");
  const firstLine=text.split("\n",1)[0]||"";
  const delimiter=firstLine.includes("\t")?"\t":(firstLine.split(";").length>firstLine.split(",").length?";":",");
  const rows:string[][]=[];let row:string[]=[];let cell="";let quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else quoted=false}
      else cell+=c;
    }else if(c==='"'&&cell==="")quoted=true;
    else if(c===delimiter){row.push(cell);cell=""}
    else if(c==="\n"){row.push(cell);rows.push(row);row=[];cell=""}
    else cell+=c;
  }
  if(cell!==""||row.length){row.push(cell);rows.push(row)}
  return rows.filter(r=>r.some(v=>v.trim()));
}

// Toma la primera fila como encabezados si los reconoce; si no, usa columnas A=título, B=texto, C=caption.
export function rowsFromTable(table:unknown[][]):SheetRow[]{
  if(!table.length)return [];
  const header=table[0].map(normalizeHeader);
  const find=(names:string[])=>header.findIndex(h=>names.includes(h));
  let t=find(TITLE),b=find(BODY),c=find(CAPTION);
  const hasHeader=b>=0||t>=0;
  if(!hasHeader){t=table[0].length>1?0:-1;b=table[0].length>1?1:0;c=table[0].length>2?2:-1}
  const cellText=(row:unknown[],i:number)=>i<0?"":String(row[i]??"").replace(/\r\n?/g,"\n").trim();
  return table.slice(hasHeader?1:0)
    .map(row=>({title:cellText(row,t),body:cellText(row,b),caption:cellText(row,c)}))
    .filter(r=>r.body);
}

export async function readSpreadsheet(file:File):Promise<SheetRow[]>{
  const name=file.name.toLowerCase();
  if(name.endsWith(".xlsx")){
    const { readSheet }=await import("read-excel-file/browser");
    const data=await readSheet(file);
    return rowsFromTable(data as unknown[][]);
  }
  if(name.endsWith(".csv")||name.endsWith(".tsv")||name.endsWith(".txt"))return rowsFromTable(parseDelimited(await file.text()));
  throw new Error("Usa un archivo .xlsx o .csv. Si tienes .xls, guárdalo como .xlsx.");
}

// Plantilla de ejemplo para descargar (CSV con BOM para que Excel respete los acentos).
export function exampleCsv(){
  const rows=[
    ["titulo","texto","caption"],
    ["Oración de la noche","Señor,\npongo en tus manos este día.\nSana mi cansancio,\naquieta mis pensamientos\ny déjame descansar en tu paz.\n\nAmén.",""],
    ["Oración de la mañana","Padre,\ngracias por el regalo de este día.\nDame ánimo para comenzar,\nprudencia para decidir\ny amor para servir.\n\nAmén.",""],
  ];
  const csv=rows.map(r=>r.map(v=>`"${v.replace(/"/g,'""')}"`).join(",")).join("\r\n");
  return new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8"});
}
