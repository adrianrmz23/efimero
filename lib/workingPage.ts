export const WORKING_PAGE_KEY = "efimero-working-page-id";
export const WORKING_PAGE_EVENT = "efimero:working-page";

type PageLike = { id:string };

export function getWorkingPageId(){
  if(typeof window === "undefined") return "";
  try{return localStorage.getItem(WORKING_PAGE_KEY)||""}catch{return ""}
}

export function resolveWorkingPageId(pages:PageLike[], activePageId?:string|null){
  const stored=getWorkingPageId();
  if(stored&&pages.some(p=>String(p.id)===stored))return stored;
  if(activePageId&&pages.some(p=>String(p.id)===String(activePageId)))return String(activePageId);
  return pages[0]?.id?String(pages[0].id):"";
}

export function announceWorkingPage(pageId:string){
  if(typeof window === "undefined") return;
  try{localStorage.setItem(WORKING_PAGE_KEY,pageId)}catch{}
  window.dispatchEvent(new CustomEvent(WORKING_PAGE_EVENT,{detail:{pageId}}));
}

export async function persistWorkingPage(pageId:string){
  announceWorkingPage(pageId);
  if(!pageId)return;
  try{
    await fetch("/api/meta/connection",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({activePageId:pageId})});
  }catch{}
}
