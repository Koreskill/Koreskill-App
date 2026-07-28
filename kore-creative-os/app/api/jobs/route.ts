import { and, desc, eq } from "drizzle-orm";
import { ensureDbSchema, getDb } from "@/db";
import { imageJobs, properties } from "@/db/schema";
import {
  extensionForMime,
  ownerFromRequest,
  ownerNamespace,
  publicJob,
} from "@/lib/jobs";
import { getBucket, isReplicateConfigured } from "@/lib/runtime";

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function GET(request: Request) {
  try {
    await ensureDbSchema();
    const owner = ownerFromRequest(request);
    const propertyId = new URL(request.url).searchParams.get("propertyId");
    const db = getDb();
    const rows = await db
      .select()
      .from(imageJobs)
      .where(
        propertyId
          ? and(
              eq(imageJobs.owner, owner),
              eq(imageJobs.propertyId, propertyId),
            )
          : eq(imageJobs.owner, owner),
      )
      .orderBy(desc(imageJobs.createdAt))
      .limit(60);

    return Response.json({
      jobs: rows.map(publicJob),
      replicateConfigured: isReplicateConfigured(),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el historial.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDbSchema();
    const formData = await request.formData();
    const file = formData.get("image");
    const prompt = String(formData.get("prompt") || "").trim();
    const quality = String(formData.get("quality") || "low");
    const batchId = String(formData.get("batchId") || crypto.randomUUID());
    const propertyId = String(formData.get("propertyId") || "");

    if (!(file instanceof File)) {
      return Response.json({ error: "Falta la imagen." }, { status: 400 });
    }
    if (!ACCEPTED_TYPES.has(file.type)) {
      return Response.json(
        { error: "Formato no compatible. Usá JPG, PNG o WEBP." },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "La imagen supera el límite de 10 MB." },
        { status: 400 },
      );
    }
    if (!prompt) {
      return Response.json(
        { error: "Escribí un prompt para esta imagen." },
        { status: 400 },
      );
    }
    if (!propertyId) {
      return Response.json(
        { error: "Elegí una propiedad antes de subir imágenes." },
        { status: 400 },
      );
    }
    if (!["low", "medium", "high", "auto"].includes(quality)) {
      return Response.json({ error: "Calidad inválida." }, { status: 400 });
    }

    const owner = ownerFromRequest(request);
    const db = getDb();
    const [property] = await db
      .select({ id: properties.id })
      .from(properties)
      .where(
        and(eq(properties.id, propertyId), eq(properties.owner, owner)),
      )
      .limit(1);
    if (!property) {
      return Response.json(
        { error: "La propiedad seleccionada no existe." },
        { status: 404 },
      );
    }
    const namespace = await ownerNamespace(owner);
    const id = crypto.randomUUID();
    const extension = extensionForMime(file.type);
    const inputKey = `${namespace}/properties/${propertyId}/${batchId}/${id}/input.${extension}`;
    const now = new Date().toISOString();

    await getBucket().put(inputKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { filename: file.name },
    });

    await db.insert(imageJobs).values({
      id,
      owner,
      propertyId,
      batchId,
      filename: file.name,
      mimeType: file.type,
      prompt,
      quality,
      aspectRatio: "9:16",
      status: "queued",
      inputKey,
      createdAt: now,
      updatedAt: now,
    });
    await db
      .update(properties)
      .set({ updatedAt: now })
      .where(and(eq(properties.id, propertyId), eq(properties.owner, owner)));

    const [job] = await db
      .select()
      .from(imageJobs)
      .where(and(eq(imageJobs.id, id), eq(imageJobs.owner, owner)))
      .limit(1);

    return Response.json({ job: publicJob(job) }, { status: 201 });
  } catch (error) {
    console.error("Image upload failed", error);
    return Response.json(
      {
        error: "No se pudo guardar la imagen. Volvé a intentarlo.",
      },
      { status: 500 },
    );
  }
}
