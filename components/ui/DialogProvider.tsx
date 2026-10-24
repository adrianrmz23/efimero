"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type ConfirmOptions = {
  title:string;
  description?:React.ReactNode;
  confirmLabel?:string;
  cancelLabel?:string;
  tone?:"default"|"danger";
};
export type ToastTone = "default"|"success"|"error";

type ConfirmFn = (options:ConfirmOptions)=>Promise<boolean>;
type ToastFn = (message:string, tone?:ToastTone)=>void;
type DialogApi = { confirm:ConfirmFn; toast:ToastFn };
type PendingConfirm = ConfirmOptions & { id:number; resolve:(value:boolean)=>void };
type ToastItem = { id:number; message:string; tone:ToastTone };

const DialogContext = createContext<DialogApi|null>(null);
const TOAST_DURATION_MS = 4000;

function ConfirmDialog({request,onClose}:{request:PendingConfirm;onClose:(value:boolean)=>void}){
  const confirmRef=useRef<HTMLButtonElement>(null);
  const cancelRef=useRef<HTMLButtonElement>(null);
  const titleId="uiDialogTitle";
  const descriptionId="uiDialogDescription";

  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    confirmRef.current?.focus();
    return()=>{previous?.focus?.()};
  },[]);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();onClose(false)}
      // Enter confirma, salvo que el foco esté en "Cancelar" (tabulado a propósito).
      else if(event.key==="Enter"){event.preventDefault();event.stopPropagation();onClose(document.activeElement!==cancelRef.current)}
      else if(event.key==="Tab"){
        // Mantener el foco dentro del diálogo.
        const order=[cancelRef.current,confirmRef.current].filter(Boolean) as HTMLButtonElement[];
        const index=order.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        order[(index+(event.shiftKey?-1:1)+order.length)%order.length]?.focus();
      }
    };
    window.addEventListener("keydown",onKey,true);
    return()=>window.removeEventListener("keydown",onKey,true);
  },[onClose]);

  const danger=request.tone==="danger";
  return <div className="uiDialogBackdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose(false)}}>
    <div className="uiDialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={request.description?descriptionId:undefined}>
      <h2 id={titleId} className="uiDialogTitle">{request.title}</h2>
      {request.description?<div id={descriptionId} className="uiDialogDescription">{request.description}</div>:null}
      <div className="uiDialogActions">
        <button type="button" ref={cancelRef} className="uiBtn uiBtnSecondary" onClick={()=>onClose(false)}>{request.cancelLabel||"Cancelar"}</button>
        <button type="button" ref={confirmRef} className={`uiBtn uiBtnPrimary${danger?" uiBtnDanger":""}`} onClick={()=>onClose(true)}>{request.confirmLabel||"Confirmar"}</button>
      </div>
    </div>
  </div>;
}

export function DialogProvider({children}:{children:React.ReactNode}){
  const [queue,setQueue]=useState<PendingConfirm[]>([]);
  const [toasts,setToasts]=useState<ToastItem[]>([]);
  const nextToastId=useRef(1);
  const timers=useRef(new Map<number,ReturnType<typeof setTimeout>>());

  const nextConfirmId=useRef(1);
  const confirm=useCallback<ConfirmFn>((options)=>new Promise<boolean>(resolve=>{
    const id=nextConfirmId.current++;
    setQueue(current=>[...current,{...options,id,resolve}]);
  }),[]);

  const dismissToast=useCallback((id:number)=>{
    const timer=timers.current.get(id);
    if(timer){clearTimeout(timer);timers.current.delete(id)}
    setToasts(current=>current.filter(t=>t.id!==id));
  },[]);

  const toast=useCallback<ToastFn>((message,tone="default")=>{
    const id=nextToastId.current++;
    setToasts(current=>[...current,{id,message,tone}]);
    timers.current.set(id,setTimeout(()=>dismissToast(id),TOAST_DURATION_MS));
  },[dismissToast]);

  useEffect(()=>{
    const map=timers.current;
    return()=>{map.forEach(timer=>clearTimeout(timer));map.clear()};
  },[]);

  const current=queue[0];
  const closeCurrent=useCallback((value:boolean)=>{
    if(!current)return;
    current.resolve(value);
    setQueue(list=>list.filter(item=>item!==current));
  },[current]);

  const api=useMemo(()=>({confirm,toast}),[confirm,toast]);
  return <DialogContext.Provider value={api}>
    {children}
    {current?<ConfirmDialog key={current.id}request={current} onClose={closeCurrent}/>:null}
    {toasts.length?<div className="uiToastStack" role="status" aria-live="polite">
      {toasts.map(t=><button type="button" key={t.id} className={`uiToast uiToast-${t.tone}`} onClick={()=>dismissToast(t.id)} title="Cerrar">{t.message}</button>)}
    </div>:null}
  </DialogContext.Provider>;
}

function useDialogApi(){
  const ctx=useContext(DialogContext);
  if(!ctx)throw new Error("useConfirm/useToast deben usarse dentro de <DialogProvider>.");
  return ctx;
}

export function useConfirm(){return useDialogApi().confirm}
export function useToast(){return useDialogApi().toast}
