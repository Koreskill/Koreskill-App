import { and, eq } from "drizzle-orm";
import { ensureDbSchema, getDb } from "@/db";
import { generationRuns, imageJobs, properties } from "@/db/schema";
import {
  extractOutputUrl,
  ownerFromRequest,
  publicJob,
} from "@/lib/jobs";
import { getBucket, getReplicateToken } from "@/lib/runtime";

type ReplicatePrediction = {
  status?: string;
  output?: unknown;
  error?: string | null;
};

async function findJob(id: string, owner: string) {
  await ensureDbSchema();
  const db = getDb();
  const [job] = await db
    .select()
    .from(imageJobs)
    .where(and(eq(imageJobs.id, id), eq(imageJobs.owner, owner)))
    .limit(1);
  return job;
}

async function refreshPrediction(
  id: string,
  owner: string,
  predictionId: string,
) {
  const token = getReplicateToken();
  if (!token) return findJob(id, owner);

  const response = await fetch(
    `https://api.replicate.com/v1/predictions/${predictionId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const prediction = (await response.json()) as ReplicatePrediction;

  if (!response.ok) {
    throw new Error(
      prediction.error || `No se pudo consultar Replicate (${response.status}).`,
    );
  }

  const db = getDb();
  if (prediction.status === "failed" || prediction.status === "canceled") {
    const now = new Date().toISOString();
    await db
      .update(imageJobs)
      .set({
        status: "failed",
        error:
          prediction.error ||
          (prediction.status === "canceled"
            ? "La generación fue cancelada."
            : "La generación falló."),
        updatedAt: now,
      })
      .where(and(eq(imageJobs.id, id), eq(imageJobs.owner, owner)));
    await db
      .update(generationRuns)
      .set({
        status: prediction.status,
        error: prediction.error || null,
        completedAt: now,
      })
      .where(
        and(
          eq(generationRuns.predictionId, predictionId),
          eq(generationRuns.owner, owner),
        ),
      );
  }

  if (prediction.status === "succeeded") {
    const outputUrl = extractOutputUrl(prediction.output);
    if (!outputUrl) {
      throw new Error("Replicate terminó, pero no devolvió una imagen.");
    }

    const outputResponse = await fetch(outputUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!outputResponse.ok) {
      throw new Error("No se pudo guardar el resultado generado.");
    }

    const job = await findJob(id, owner);
    const outputKey =
      job?.inputKey.replace(/\/input\.[^/]+$/, "/output.jpg") ||
      `${id}/output.jpg`;
    const outputMimeType =
      outputResponse.headers.get("content-type") || "image/jpeg";
    await getBucket().put(outputKey, await outputResponse.arrayBuffer(), {
      httpMetadata: { contentType: outputMimeType },
    });

    const now = new Date().toISOString();
    await db
      .update(imageJobs)
      .set({
        status: "succeeded",
        outputKey,
        outputMimeType,
        error: null,
        updatedAt: now,
      })
      .where(and(eq(imageJobs.id, id), eq(imageJobs.owner, owner)));
    await db
      .update(generationRuns)
      .set({
        status: "succeeded",
        error: null,
        completedAt: now,
      })
      .where(
        and(
          eq(generationRuns.predictionId, predictionId),
          eq(generationRuns.owner, owner),
        ),
      );
    if (job?.propertyId) {
      await db
        .update(properties)
        .set({ updatedAt: now })
        .where(
          and(
            eq(properties.id, job.propertyId),
            eq(properties.owner, owner),
          ),
        );
    }
  }

  return findJob(id, owner);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const owner = await ownerFromRequest();

  try {
    let job = await findJob(id, owner);
    if (!job) {
      return Response.json({ error: "Imagen no encontrada." }, { status: 404 });
    }

    if (job.status === "processing" && job.predictionId) {
      job = await refreshPrediction(id, owner, job.predictionId);
    }

    if (!job) {
      return Response.json({ error: "Imagen no encontrada." }, { status: 404 });
    }
    return Response.json({ job: publicJob(job) });
  } catch (error) {
    console.error("Prediction refresh failed", error);
    const message =
      error instanceof Error &&
      !error.message.toLowerCase().includes("failed query")
        ? error.message
        : "No se pudo actualizar el estado.";
    await getDb()
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const owner = await ownerFromRequest();

  try {
    const payload = (await request.json()) as {
      prompt?: string;
      quality?: string;
    };
    const job = await findJob(id, owner);
    if (!job) {
      return Response.json({ error: "Imagen no encontrada." }, { status: 404 });
    }
    if (job.status === "processing") {
      return Response.json(
        { error: "Esperá a que termine antes de editar el prompt." },
        { status: 409 },
      );
    }

    const prompt = payload.prompt?.trim() ?? job.prompt;
    const quality = payload.quality ?? job.quality;
    if (!prompt) {
      return Response.json({ error: "El prompt no puede quedar vacío." }, { status: 400 });
    }
    if (!["low", "medium", "high", "auto"].includes(quality)) {
      return Response.json({ error: "Calidad inválida." }, { status: 400 });
    }

    await getDb()
      .update(imageJobs)
      .set({ prompt, quality, updatedAt: new Date().toISOString() })
      .where(and(eq(imageJobs.id, id), eq(imageJobs.owner, owner)));

    const updated = await findJob(id, owner);
    return Response.json({ job: updated ? publicJob(updated) : null });
  } catch (error) {
    console.error("Job update failed", error);
    return Response.json(
      {
        error: "No se pudo guardar el prompt.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const owner = await ownerFromRequest();
  const job = await findJob(id, owner);
  if (!job) return new Response(null, { status: 204 });

  const keys = [job.inputKey, job.outputKey].filter(
    (key): key is string => Boolean(key),
  );
  if (keys.length) await getBucket().delete(keys);
  await getDb()
    .delete(imageJobs)
    .where(and(eq(imageJobs.id, id), eq(imageJobs.owner, owner)));
  return new Response(null, { status: 204 });
}
