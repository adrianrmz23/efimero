// Sube un video a YouTube desde el navegador (subida reanudable en un solo envío).
// El token de acceso lo da /api/youtube/token; el video no pasa por el servidor.
import type { YoutubeMeta } from "@/lib/youtubeMeta";

export type YoutubePrivacy = "private" | "unlisted" | "public";

export function uploadBody(meta: YoutubeMeta, privacy: YoutubePrivacy) {
  return {
    snippet: { title: meta.title.slice(0, 100), description: meta.description.slice(0, 4900), tags: meta.tags, categoryId: "22", defaultLanguage: "es", defaultAudioLanguage: "es" },
    // containsSyntheticMedia avisa a YouTube que el video tiene contenido hecho con IA (imágenes y voz).
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false, containsSyntheticMedia: true },
  };
}

export async function uploadToYoutube(video: Blob, meta: YoutubeMeta, privacy: YoutubePrivacy, onProgress?: (ratio: number) => void) {
  const t = await fetch("/api/youtube/token", { method: "POST" });
  const token = await t.json(); if (!t.ok) throw new Error(token.error || "No se pudo conectar con YouTube.");
  const type = video.type || "video/mp4";
  // 1) Abre la sesión de subida con los datos del video.
  const start = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": type, "X-Upload-Content-Length": String(video.size) },
    body: JSON.stringify(uploadBody(meta, privacy)),
  });
  if (!start.ok) { const d = await start.json().catch(() => ({})); throw new Error(`YouTube respondió: ${d?.error?.message || start.status}`); }
  const session = start.headers.get("Location");
  if (!session) throw new Error("YouTube no abrió la sesión de subida.");
  // 2) Envía el archivo con progreso (fetch no informa el avance de subida; XMLHttpRequest sí).
  return await new Promise<{ id: string; url: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", session);
    xhr.setRequestHeader("Content-Type", type);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let d: any = {}; try { d = JSON.parse(xhr.responseText || "{}"); } catch { /* respuesta vacía */ }
      if (xhr.status >= 200 && xhr.status < 300 && d.id) resolve({ id: d.id, url: `https://youtube.com/shorts/${d.id}` });
      else reject(new Error(`YouTube respondió: ${d?.error?.message || xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Se cortó la subida a YouTube. Revisa tu conexión e intenta de nuevo."));
    xhr.send(video);
  });
}
