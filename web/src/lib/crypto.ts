import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/** AES-256-GCM field-level encryption for sensitive columns (e.g. phone numbers). */
function key(): Buffer {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) throw new Error("FIELD_ENCRYPTION_KEY must be 64 hex chars");
  return Buffer.from(hex, "hex");
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Mask PII for logs: "Ahmed Ali" -> "A*** A**" */
export const maskName = (n: string) => n.split(" ").map((w) => w[0] + "*".repeat(Math.max(1, w.length - 1))).join(" ");
