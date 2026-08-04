import type { InferSelectModel } from "drizzle-orm";
import { imageJobs } from "@/db/schema";

import { createClient } from "@/lib/supabase/server";

export type ImageJobRow = InferSelectModel<typeof imageJobs>;

export async function ownerFromRequest(): Promise<string> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error(
      "No se pudo identificar al usuario autenticado.",
    );
  }

  return user.id;
}

export async function ownerNamespace(owner: string): Promise<string> {
  const bytes = new TextEncoder().encode(owner);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 10)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function publicJob(job: ImageJobRow) {
  return {
    id: job.id,
    propertyId: job.propertyId,
    batchId: job.batchId,
    filename: job.filename,
    mimeType: job.mimeType,
    prompt: job.prompt,
    quality: job.quality,
    aspectRatio: job.aspectRatio,
    status: job.status,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    sourceUrl: `/api/files/${job.id}?kind=input`,
    resultUrl:
      job.status === "succeeded" && job.outputKey
        ? `/api/files/${job.id}`
        : null,
  };
}

export function safeFilename(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "imagen";
}

export function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export function extractOutputUrl(output: unknown): string | null {
  const candidate = Array.isArray(output) ? output[0] : output;
  if (typeof candidate === "string") return candidate;
  if (
    candidate &&
    typeof candidate === "object" &&
    "url" in candidate &&
    typeof candidate.url === "string"
  ) {
    return candidate.url;
  }
  return null;
}
