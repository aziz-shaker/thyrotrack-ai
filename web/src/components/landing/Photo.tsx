import fs from "fs";
import path from "path";
import Image from "next/image";

/**
 * Renders /public/images/<name> if the file exists, otherwise the provided fallback.
 * Lets the site look finished before real photos are added — drop a file in and it appears.
 */
const EXTS = ["webp", "jpg", "jpeg", "png"];
export const hasPhoto = (name: string) => EXTS.some((e) => fs.existsSync(path.join(process.cwd(), "public", "images", `${name}.${e}`)));

export function Photo({ name, alt, fallback, className, priority }: { name: string; alt: string; fallback: React.ReactNode; className?: string; priority?: boolean }) {
  const exts = ["webp", "jpg", "jpeg", "png"];
  const file = exts.map((e) => `${name}.${e}`).find((f) => fs.existsSync(path.join(process.cwd(), "public", "images", f)));
  if (!file) return <>{fallback}</>;
  return <Image src={`/images/${file}`} alt={alt} fill priority={priority} sizes="(max-width: 768px) 100vw, 50vw" className={className ?? "object-cover"} />;
}
