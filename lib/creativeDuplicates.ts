// Detecta textos repetidos en un lote y contra lo ya programado, sin importar acentos, mayúsculas ni puntuación.
export type ScheduledText = { text:string; date:string };
export type Duplicate = { row?:number; date?:string };

export const fingerprint=(value:string)=>value.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9ñ]/g,"");

// Compara solo el cuerpo: si cambia el título pero la oración es la misma, sigue siendo repetida.
// El historial guarda "título. cuerpo", por eso basta con que termine igual.
export function findDuplicates(bodies:string[],history:ScheduledText[]):Array<Duplicate|null>{
  const seen=new Map<string,number>();
  const past=history.map(h=>({key:fingerprint(h.text),date:h.date}));
  return bodies.map((body,i)=>{
    const key=fingerprint(body);
    if(key.length<12)return null;
    const first=seen.get(key);
    if(first!==undefined)return {row:first+1};
    seen.set(key,i);
    const match=past.find(h=>h.key.endsWith(key));
    return match?{date:match.date}:null;
  });
}
