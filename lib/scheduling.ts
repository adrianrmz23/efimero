export const META_MIN_SCHEDULE_MINUTES = 10;

const pad = (value:number) => String(value).padStart(2,"0");

export function localDateString(date:Date){
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

export function localTimeString(date:Date){
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localDateTime(date:string,time:string){
  return new Date(`${date}T${time}:00`);
}

export function isScheduleInFuture(date:string,time:string,minMinutes=META_MIN_SCHEDULE_MINUTES,now=new Date()){
  const target=localDateTime(date,time);
  if(Number.isNaN(target.getTime()))return false;
  return target.getTime()>=now.getTime()+minMinutes*60_000;
}

export function nextAllowedSchedule(minMinutes=20,roundToMinutes=5,now=new Date()){
  const date=new Date(now.getTime()+minMinutes*60_000);
  date.setSeconds(0,0);
  const rounded=Math.ceil(date.getMinutes()/roundToMinutes)*roundToMinutes;
  if(rounded>=60){date.setHours(date.getHours()+1,0,0,0)}else date.setMinutes(rounded,0,0);
  return {date:localDateString(date),time:localTimeString(date),value:`${localDateString(date)}T${localTimeString(date)}`};
}

export function minTimeForDate(date:string,minMinutes=META_MIN_SCHEDULE_MINUTES,now=new Date()){
  const today=localDateString(now);
  if(date!==today)return undefined;
  return nextAllowedSchedule(minMinutes,5,now).time;
}

export function minuteOfDay(date=new Date()){
  return date.getHours()*60+date.getMinutes();
}

export type MetaQueueSuggestion = {
  count:number;
  lastScheduledPublishTime:number|null;
  suggestedNextPublishTime:number;
  date:string;
  time:string;
  value:string;
};

/**
 * Consulta la cola REAL de Meta y propone el siguiente hueco.
 * Si ya hay posts programados, usa el último + intervalMinutes.
 * Si la cola está vacía, usa el siguiente horario válido desde ahora.
 */
export async function fetchMetaQueueSuggestion(pageId:string,intervalMinutes=30):Promise<MetaQueueSuggestion>{
  if(!pageId)throw new Error("Falta la página activa.");
  const interval=Math.min(720,Math.max(5,Math.round(Number(intervalMinutes)||30)));
  const response=await fetch(`/api/meta/scheduled?pageId=${encodeURIComponent(pageId)}&intervalMinutes=${interval}`,{cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error||"No fue posible consultar la cola de Meta.");
  const epoch=Number(data?.suggestedNextPublishTime||0);
  const suggested=epoch>0?new Date(epoch*1000):new Date(Date.now()+META_MIN_SCHEDULE_MINUTES*60_000);
  if(Number.isNaN(suggested.getTime()))throw new Error("Meta devolvió un horario inválido.");
  const date=localDateString(suggested);
  const time=localTimeString(suggested);
  return {
    count:Number(data?.count||0),
    lastScheduledPublishTime:Number(data?.lastScheduledPublishTime||0)||null,
    suggestedNextPublishTime:Math.floor(suggested.getTime()/1000),
    date,time,value:`${date}T${time}`,
  };
}
