/** Security helpers: field encryption, file sniffing, rate limiting, review validation. */
process.env.FIELD_ENCRYPTION_KEY = "a".repeat(64);

import { encrypt, decrypt, maskName, sha256 } from "@/lib/crypto";
import { sniffType } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { reviewSchema } from "@/lib/services/studies";

describe("field encryption (AES-256-GCM)", () => {
  it("round-trips and uses a random IV", () => {
    const a = encrypt("+20 100 000 0000");
    const b = encrypt("+20 100 000 0000");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("+20 100 000 0000");
  });

  it("rejects tampered ciphertext", () => {
    const [iv, tag, data] = encrypt("secret").split(".");
    const flipped = Buffer.from(data, "base64");
    flipped[0] ^= 1;
    expect(decrypt([iv, tag, flipped.toString("base64")].join("."))).toBeNull();
  });

  it("masks names for logs and hashes deterministically", () => {
    expect(maskName("منى عبد")).toBe("م** ع**");
    expect(sha256("x")).toHaveLength(64);
  });
});

describe("upload type sniffing (magic bytes, not extension)", () => {
  it("detects PNG / JPEG / DICOM / PDF and rejects others", () => {
    expect(sniffType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe("png");
    expect(sniffType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(sniffType(Buffer.concat([Buffer.alloc(128), Buffer.from("DICM"), Buffer.alloc(4)]))).toBe("dicom");
    expect(sniffType(Buffer.from("%PDF-1.7"))).toBe("pdf");
    expect(sniffType(Buffer.from("MZ executable pretending to be png"))).toBeNull();
  });
});

describe("rate limiter", () => {
  it("blocks after the limit within the window", () => {
    const key = `t-${Math.random()}`;
    expect([1, 2, 3].map(() => rateLimit(key, 2, 60_000))).toEqual([true, true, false]);
  });
});

describe("doctor review validation", () => {
  it("requires a reason when modifying or rejecting", () => {
    expect(reviewSchema.safeParse({ decision: "MODIFIED", recommendation: "FNA" }).success).toBe(false);
    expect(reviewSchema.safeParse({ decision: "REJECTED", recommendation: "ADDITIONAL_IMAGING", changeReason: "صورة غير واضحة" }).success).toBe(true);
    expect(reviewSchema.safeParse({ decision: "CONFIRMED", recommendation: "US_FOLLOW_UP" }).success).toBe(true);
  });

  it("rejects contour points outside the image", () => {
    const r = reviewSchema.safeParse({ decision: "MODIFIED", recommendation: "FNA", changeReason: "تعديل الحدود", contour: [[0, 0], [1.5, 0.2], [0.3, 0.3]] });
    expect(r.success).toBe(false);
  });
});
