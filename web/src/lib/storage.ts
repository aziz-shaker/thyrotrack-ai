import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Storage abstraction. "local" writes under STORAGE_LOCAL_DIR; an S3 driver can implement the same
 * interface (put/get/remove) without touching callers.
 */
export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

const ROOT = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "../storage");

/** Keys are generated server-side; still, refuse anything that could escape the storage root. */
function safePath(key: string) {
  if (!/^[a-z0-9/_.-]+$/i.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  const p = path.resolve(ROOT, key);
  if (!p.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key");
  return p;
}

const local: Storage = {
  async put(key, data) {
    const p = safePath(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data);
  },
  get: (key) => fs.readFile(safePath(key)),
  remove: (key) => fs.rm(safePath(key), { force: true }),
};

/** Postgres-backed blobs — for hosts with an ephemeral filesystem (e.g. Hugging Face Spaces). */
const database: Storage = {
  async put(key, data) {
    safePath(key); // same key rules as the local driver
    const { db } = await import("./db");
    await db.storedFile.upsert({ where: { key }, create: { key, data }, update: { data } });
  },
  async get(key) {
    const { db } = await import("./db");
    const f = await db.storedFile.findUnique({ where: { key } });
    if (!f) throw new Error(`Not found: ${key}`);
    return Buffer.from(f.data);
  },
  async remove(key) {
    const { db } = await import("./db");
    await db.storedFile.deleteMany({ where: { key } });
  },
};

export const storage: Storage = process.env.STORAGE_DRIVER === "db" ? database : local;

export const newImageKey = (studyId: string, ext: string) => `studies/${studyId}/${randomUUID()}.${ext}`;

/** Detect real file type from magic bytes (never trust the client's MIME type or extension). */
export function sniffType(buf: Buffer): "png" | "jpg" | "dicom" | "pdf" | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 132 && buf.subarray(128, 132).toString("ascii") === "DICM") return "dicom";
  if (buf.length > 4 && buf.subarray(0, 4).toString("ascii") === "%PDF") return "pdf";
  return null;
}
