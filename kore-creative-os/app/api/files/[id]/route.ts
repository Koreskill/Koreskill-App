import { and, eq } from "drizzle-orm";
import { ensureDbSchema, getDb } from "@/db";
import { imageJobs } from "@/db/schema";
import { ownerFromRequest, safeFilename } from "@/lib/jobs";
import { getBucket } from "@/lib/runtime";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const owner = ownerFromRequest(request);
  await ensureDbSchema();
  const [job] = await getDb()
    .select()
    .from(imageJobs)
    .where(and(eq(imageJobs.id, id), eq(imageJobs.owner, owner)))
    .limit(1);

  if (!job) return new Response("Imagen no encontrada.", { status: 404 });

  const url = new URL(request.url);
  const isInput = url.searchParams.get("kind") === "input";
  const key = isInput ? job.inputKey : job.outputKey;
  if (!key) return new Response("Resultado no disponible.", { status: 404 });

  const object = await getBucket().get(key);
  if (!object) return new Response("Archivo no encontrado.", { status: 404 });

  const outputName = `${safeFilename(job.filename.replace(/\.[^.]+$/, ""))}-9x16.jpg`;
  const headers = new Headers();
  headers.set(
    "Content-Type",
    isInput ? job.mimeType : job.outputMimeType || "image/jpeg",
  );
  headers.set("Cache-Control", "private, max-age=3600");
  if (url.searchParams.get("download") === "1") {
    headers.set("Content-Disposition", `attachment; filename="${outputName}"`);
  }

  return new Response(object.body, { headers });
}
