import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Guarda archivos generados (clips de video) en Supabase Storage y devuelve un enlace temporal.
// Se usa porque Vercel no permite respuestas de más de 4.5 MB.
const BUCKET = "efimero-media";
let bucketReady = false;

async function ensureBucket() {
  if (bucketReady) return;
  const db = getSupabaseAdmin();
  const { data } = await db.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await db.storage.createBucket(BUCKET, { public: false, fileSizeLimit: "100MB" });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  bucketReady = true;
}

export async function storeMedia(ownerUserId: string, bytes: Buffer, extension: string, contentType: string) {
  await ensureBucket();
  const db = getSupabaseAdmin();
  const path = `${ownerUserId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
  const { data, error: signError } = await db.storage.from(BUCKET).createSignedUrl(path, 7 * 86_400);
  if (signError || !data?.signedUrl) throw signError || new Error("No se pudo crear el enlace del archivo.");
  return data.signedUrl;
}
