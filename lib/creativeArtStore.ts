/** Local artwork library by Meta page ID + saint. No Supabase schema or paid storage required. */
type SavedArt={id:string;pageId:string;saint:string;dataUrl:string;updatedAt:string};
const database="efimero-v1.9-artwork",objectStore="saint-arts";
const key=(pageId:string,saint:string)=>`${pageId}:${saint.trim().toLocaleLowerCase("es-MX")}`;
function dbOpen():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
  if(typeof indexedDB==="undefined")return reject(new Error("IndexedDB no disponible"));
  const request=indexedDB.open(database,1);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(objectStore))db.createObjectStore(objectStore,{keyPath:"id"});};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
export async function saveSaintArt(pageId:string,saint:string,dataUrl:string){const db=await dbOpen();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(objectStore,"readwrite");tx.objectStore(objectStore).put({id:key(pageId,saint),pageId,saint,dataUrl,updatedAt:new Date().toISOString()} as SavedArt);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}finally{db.close()}}
export async function loadSaintArts(pageId:string):Promise<Record<string,string>>{const db=await dbOpen();try{const saved=await new Promise<SavedArt[]>((resolve,reject)=>{const tx=db.transaction(objectStore,"readonly");const req=tx.objectStore(objectStore).getAll();req.onsuccess=()=>resolve(req.result as SavedArt[]);req.onerror=()=>reject(req.error)});return Object.fromEntries(saved.filter(x=>x.pageId===pageId).map(x=>[x.saint.trim().toLocaleLowerCase("es-MX"),x.dataUrl]))}finally{db.close()}}
export async function removeSaintArt(pageId:string,saint:string){const db=await dbOpen();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction(objectStore,"readwrite");tx.objectStore(objectStore).delete(key(pageId,saint));tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}finally{db.close()}}
