/** Local artwork library by Meta page ID + saint. No Supabase schema or paid storage required. */
type SavedArt={id:string;pageId:string;saint:string;dataUrl:string;updatedAt:string};
const database="efimero-v1.9-artwork",objectStore="saint-arts";
// Los fondos de la plantilla "Oración con fondo" se guardan en el mismo almacén con este prefijo.
const BACKGROUND="__fondo__:";
const key=(pageId:string,saint:string)=>`${pageId}:${saint.trim().toLocaleLowerCase("es-MX")}`;
function dbOpen():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
  if(typeof indexedDB==="undefined")return reject(new Error("IndexedDB no disponible"));
  const request=indexedDB.open(database,1);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(objectStore))db.createObjectStore(objectStore,{keyPath:"id"});};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
export async function saveSaintArt(pageId:string,saint:string,dataUrl:string){const db=await dbOpen();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(objectStore,"readwrite");tx.objectStore(objectStore).put({id:key(pageId,saint),pageId,saint,dataUrl,updatedAt:new Date().toISOString()} as SavedArt);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}finally{db.close()}}
export async function loadSaintArts(pageId:string):Promise<Record<string,string>>{const db=await dbOpen();try{const saved=await new Promise<SavedArt[]>((resolve,reject)=>{const tx=db.transaction(objectStore,"readonly");const req=tx.objectStore(objectStore).getAll();req.onsuccess=()=>resolve(req.result as SavedArt[]);req.onerror=()=>reject(req.error)});return Object.fromEntries(saved.filter(x=>x.pageId===pageId&&!x.saint.startsWith(BACKGROUND)).map(x=>[x.saint.trim().toLocaleLowerCase("es-MX"),x.dataUrl]))}finally{db.close()}}
export async function removeSaintArt(pageId:string,saint:string){const db=await dbOpen();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(objectStore,"readwrite");tx.objectStore(objectStore).delete(key(pageId,saint));tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}finally{db.close()}}

export type SavedBackground={id:string;dataUrl:string};
export async function saveBackground(pageId:string,dataUrl:string){const id=crypto.randomUUID();await saveSaintArt(pageId,`${BACKGROUND}${id}`,dataUrl);return {id,dataUrl} as SavedBackground}
export async function loadBackgrounds(pageId:string):Promise<SavedBackground[]>{const db=await dbOpen();try{const saved=await new Promise<SavedArt[]>((resolve,reject)=>{const tx=db.transaction(objectStore,"readonly");const req=tx.objectStore(objectStore).getAll();req.onsuccess=()=>resolve(req.result as SavedArt[]);req.onerror=()=>reject(req.error)});return saved.filter(x=>x.pageId===pageId&&x.saint.startsWith(BACKGROUND)).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)).map(x=>({id:x.saint.slice(BACKGROUND.length),dataUrl:x.dataUrl}))}finally{db.close()}}
export async function removeBackground(pageId:string,id:string){await removeSaintArt(pageId,`${BACKGROUND}${id}`)}
