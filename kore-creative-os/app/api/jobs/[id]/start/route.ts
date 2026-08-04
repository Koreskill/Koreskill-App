import { and, eq } from "drizzle-orm";
import Replicate from "replicate";
import { ensureDbSchema, getDb } from "@/db";
import { generationRuns, imageJobs, properties } from "@/db/schema";
import { ownerFromRequest, publicJob } from "@/lib/jobs";
import { estimatedCostMicros } from "@/lib/pricing";
import { getBucket, getReplicateToken } from "@/lib/runtime";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const owner = await ownerFromRequest();
  await ensureDbSchema();
  const db = getDb();

  try {
    const [job] = await db
      .select()
      .from(imageJobs)
      .where(and(eq(imageJobs.id, id), eq(imageJobs.owner, owner)))
      .limit(1);

    if (!job) {
      return Response.json({ error: "Imagen no encontrada." }, { status: 404 });
    }
    if (!job.prompt.trim()) {
      return Response.json(
        { error: "Escribí un prompt antes de generar." },
        { status: 400 },
      );
    }

    const token = getReplicateToken();
    if (!token) {
      const message =
        "Replicate todavía no está conectado. Configurá la clave segura para activar las generaciones.";
      await db
        .update(imageJobs)
        .set({
          status: "failed",
          error: message,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(imageJobs.id, id), eq(imageJobs.owner, owner)));
      return Response.json(
        {
          error: message,
          code: "REPLICATE_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    const source = await getBucket().get(job.inputKey);
    if (!source) {
      return Response.json(
        { error: "No se encontró la imagen original." },
        { status: 404 },
      );
    }

    if (job.outputKey) {
      await getBucket().delete(job.outputKey);
    }

    const replicate = new Replicate({
      auth: token,
      fileEncodingStrategy: "upload",
      useFileOutput: false,
    });
    const sourceBlob = new Blob([await source.arrayBuffer()], {
      type: job.mimeType,
    });
    const prediction = await replicate.predictions.create({
      model: "openai/gpt-image-2",
      input: {
        prompt: job.prompt,
        input_images: [sourceBlob],
        aspect_ratio: "9:16",
        quality: job.quality,
        number_of_images: 1,
        output_format: "jpeg",
        background: "opaque",
      },
    });

    if (!prediction.id) {
      const message =
        typeof prediction.error === "string"
          ? prediction.error
          : "Replicate no pudo iniciar la generación.";
      await db
        .update(imageJobs)
        .set({
          status: "failed",
          error: message,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(imageJobs.id, id), eq(imageJobs.owner, owner)));
      return Response.json({ error: message }, { status: 502 });
    }

    await db
      .update(imageJobs)
      .set({
        status: "processing",
        predictionId: prediction.id,
        outputKey: null,
        outputMimeType: null,
        error: null,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(imageJobs.id, id), eq(imageJobs.owner, owner)));

    await db.insert(generationRuns).values({
      id: crypto.randomUUID(),
      owner,
      propertyId: job.propertyId,
      jobId: job.id,
      predictionId: prediction.id,
      quality: job.quality,
      status: "processing",
      estimatedCostMicros: estimatedCostMicros(job.quality),
      createdAt: new Date().toISOString(),
    });
    if (job.propertyId) {
      await db
        .update(properties)
        .set({ updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(properties.id, job.propertyId),
            eq(properties.owner, owner),
          ),
        );
    }

    const [updated] = await db
      .select()
      .from(imageJobs)
      .where(and(eq(imageJobs.id, id), eq(imageJobs.owner, owner)))
      .limit(1);

    return Response.json({ job: publicJob(updated) }, { status: 202 });
  } catch (error) {
    console.error("Image generation start failed", error);
    const message =
      error instanceof Error &&
      !error.message.toLowerCase().includes("failed query")
        ? error.message
        : "No se pudo iniciar la generación.";
    await db
      .update(imageJobs)
      .set({
        status: "failed",
        error: message,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(imageJobs.id, id), eq(imageJobs.owner, owner)));
    return Response.json({ error: message }, { status: 500 });
  }
}
