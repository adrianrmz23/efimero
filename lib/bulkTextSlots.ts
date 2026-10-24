import { localDateString, localTimeString, META_MIN_SCHEDULE_MINUTES } from "@/lib/scheduling";

const dateAt = (when: Date, hours: number, minutes: number) => {
  const target = new Date(when);
  target.setHours(hours, minutes, 0, 0);
  return target;
};
const parseTime = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/** Horarios locales, sin publicaciones nocturnas fuera de la ventana elegida. */
export function planBulkTextSlots(count: number, first: Date, gap: number, start: string, end: string, now = new Date()) {
  const startMinute = parseTime(start);
  const endMinute = parseTime(end);
  if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute) || startMinute >= endMinute || endMinute > 1439 || startMinute < 0) {
    throw new Error("La franja horaria debe tener inicio anterior al final, dentro del mismo día.");
  }
  if (!Number.isFinite(gap) || gap < 15 || gap > 720) throw new Error("La separación debe estar entre 15 y 720 minutos.");
  if (!Number.isFinite(first.getTime())) throw new Error("Fecha inicial inválida.");
  const minimum = now.getTime() + META_MIN_SCHEDULE_MINUTES * 60_000;
  if (first.getTime() < minimum) throw new Error(`El primer horario debe estar al menos ${META_MIN_SCHEDULE_MINUTES} minutos en el futuro.`);
  let cursor = new Date(first);
  const slots: {date:string;time:string;timestamp:string}[] = [];
  for (let i = 0; i < count; i++) {
    const minute = cursor.getHours() * 60 + cursor.getMinutes();
    if (minute < startMinute) cursor = dateAt(cursor, Math.floor(startMinute / 60), startMinute % 60);
    else if (minute > endMinute) {
      cursor.setDate(cursor.getDate() + 1);
      cursor = dateAt(cursor, Math.floor(startMinute / 60), startMinute % 60);
    }
    slots.push({date:localDateString(cursor),time:localTimeString(cursor),timestamp:cursor.toISOString()});
    cursor = new Date(cursor.getTime() + gap * 60_000);
  }
  return slots;
}

export function parseBulkTexts(source: string) {
  // Pega copys separados por una línea '---' o por una línea completamente vacía.
  // Cualquier línea que sea solo '---' cierra un copy, también al inicio o al final, y nunca se cuela en el texto.
  const texts:string[]=[];let current:string[]=[];
  for(const line of source.replace(/\r\n/g,"\n").split("\n")){
    const trimmed=line.trim();
    if(trimmed===""||trimmed==="---"){if(current.length)texts.push(current.join("\n").trim());current=[];continue}
    current.push(line);
  }
  if(current.length)texts.push(current.join("\n").trim());
  return texts.filter(Boolean);
}
