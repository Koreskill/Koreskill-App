import { and, desc, eq } from "drizzle-orm";
import { ensureDbSchema, getDb } from "@/db";
import {
  generatedTexts,
  generationRuns,
  imageJobs,
  properties,
} from "@/db/schema";
import {
  ownerFromRequest,
  publicJob,
} from "@/lib/jobs";

function parseHighlights(value: string | null) {
  try {
    const parsed = JSON.parse(value || "[]");

    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string =>
            typeof item === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      propertyId: string;
    }>;
  },
) {
  /*
   * Next necesita recibir request para poder pasar
   * context como segundo parámetro.
   */
  void request;

  try {
    await ensureDbSchema();

    const owner = await ownerFromRequest();
    const { propertyId } = await context.params;
    const db = getDb();

    const [property] = await db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.id, propertyId),
          eq(properties.owner, owner),
        ),
      )
      .limit(1);

    if (!property) {
      return Response.json(
        {
          error: "La propiedad no existe.",
        },
        {
          status: 404,
        },
      );
    }

    const jobs = await db
      .select()
      .from(imageJobs)
      .where(
        and(
          eq(imageJobs.owner, owner),
          eq(imageJobs.propertyId, propertyId),
        ),
      )
      .orderBy(desc(imageJobs.updatedAt));

    const runs = await db
      .select()
      .from(generationRuns)
      .where(
        and(
          eq(generationRuns.owner, owner),
          eq(
            generationRuns.propertyId,
            propertyId,
          ),
        ),
      )
      .orderBy(desc(generationRuns.createdAt));

    const texts = await db
      .select()
      .from(generatedTexts)
      .where(
        and(
          eq(generatedTexts.owner, owner),
          eq(generatedTexts.propertyId, propertyId),
        ),
      )
      .orderBy(desc(generatedTexts.createdAt));

    const completedImages = jobs.filter(
      (job) =>
        job.status === "succeeded" &&
        Boolean(job.outputKey),
    );

    const successfulRuns = runs.filter(
      (run) => run.status === "succeeded",
    );

    const imageSpentMicros = successfulRuns.reduce(
      (total, run) =>
        total +
        Number(run.estimatedCostMicros || 0),
      0,
    );

    /*
     * OpenAI guarda tres textos por generación.
     * Agrupamos los registros para no sumar
     * tres veces los mismos tokens.
     */
    const uniqueTextGenerations = new Map<
      string,
      {
        inputTokens: number;
        outputTokens: number;
        estimatedCostMicros: number;
      }
    >();

    for (const text of texts) {
      const key = [
        text.createdAt,
        text.model,
        text.inputTokens,
        text.outputTokens,
      ].join("-");

      if (!uniqueTextGenerations.has(key)) {
        uniqueTextGenerations.set(key, {
          inputTokens: Number(
            text.inputTokens || 0,
          ),
          outputTokens: Number(
            text.outputTokens || 0,
          ),
          estimatedCostMicros: Number(
            text.estimatedCostMicros || 0,
          ),
        });
      }
    }

    const textGenerations = Array.from(
      uniqueTextGenerations.values(),
    );

    const textInputTokens =
      textGenerations.reduce(
        (total, generation) =>
          total + generation.inputTokens,
        0,
      );

    const textOutputTokens =
      textGenerations.reduce(
        (total, generation) =>
          total + generation.outputTokens,
        0,
      );

    const textSpentMicros =
      textGenerations.reduce(
        (total, generation) =>
          total +
          generation.estimatedCostMicros,
        0,
      );

    return Response.json({
      property: {
        id: property.id,
        slug: property.slug || "",
        name: property.name,
        type: property.type || "",
        operation: property.operation || "",
        title: property.title || property.name,
        zone: property.zone || "",
        address: property.address || "",
        client: property.client || "",
        currency: property.currency || "USD",
        price: property.priceValue,
        totalM2: property.totalM2,
        coveredM2: property.coveredM2,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        garages: property.garages,
        status: property.propertyStatus || "",
        situation: property.situation || "",
        highlights: parseHighlights(
          property.highlightsJson,
        ),
        contact: property.contact || "",
        rawSource: property.rawSource || "",
        createdAt: property.createdAt,
        updatedAt: property.updatedAt,
      },

      images: jobs.map(publicJob),

      texts: texts.map((text) => ({
        id: text.id,
        propertyId: text.propertyId,
        type: text.type,
        content: text.content,
        sourceText: text.sourceText || "",
        promptVersion: text.promptVersion,
        model: text.model,
        inputTokens: text.inputTokens,
        outputTokens: text.outputTokens,
        estimatedCostMicros:
          text.estimatedCostMicros,
        createdAt: text.createdAt,
        updatedAt: text.updatedAt,
      })),

      summary: {
        imageCount: jobs.length,
        generatedImageCount:
          completedImages.length,
        imageGenerationCount:
          successfulRuns.length,
        textCount: texts.length,
        textGenerationCount:
          uniqueTextGenerations.size,
        textInputTokens,
        textOutputTokens,
        imageSpentMicros,
        textSpentMicros,
        totalSpentMicros:
          imageSpentMicros + textSpentMicros,
      },
    });
  } catch (error) {
    console.error(
      "Library project load failed",
      error,
    );

    return Response.json(
      {
        error:
          "No se pudo cargar el proyecto seleccionado.",
      },
      {
        status: 500,
      },
    );
  }
}