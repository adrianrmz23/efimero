import crypto from "crypto";

function getKey() {
  const raw = (process.env.META_TOKEN_ENCRYPTION_KEY || "").trim();
  if (!raw) throw new Error("Falta META_TOKEN_ENCRYPTION_KEY.");

  let key: Buffer;
  if (/^[a-f0-9]{64}$/i.test(raw)) key = Buffer.from(raw, "hex");
  else key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error("META_TOKEN_ENCRYPTION_KEY debe representar exactamente 32 bytes.");
  }
  return key;
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(payload: string) {
  const [version, ivRaw, tagRaw, encryptedRaw] = String(payload || "").split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) throw new Error("Token cifrado inválido.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
}
