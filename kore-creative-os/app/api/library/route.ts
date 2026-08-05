import { desc, eq } from "drizzle-orm";
import { ensureDbSchema, getDb } from "@/db";
import {
  clients,
  generatedTexts,
  generationRuns,
  imageJobs,
  properties,
} from "@/db/schema";
import { ownerFromRequest } from "@/lib/jobs";

export async function GET() {
  try {
    await ensureDbSchema();

    const owner = await ownerFromRequest();
    const db = getDb();

    const propertyRows = await db
      .select()
      .from(properties)
      .where(eq(properties.owner, owner))
      .orderBy(desc(properties.updatedAt));

    const jobRows = await db
      .select({
        id: imageJobs.id,
        propertyId: imageJobs.propertyId,
        status: imageJobs.status,
        filename: imageJobs.filename,
        outputKey: imageJobs.outputKey,
        createdAt: imageJobs.createdAt,
        updatedAt: imageJobs.updatedAt,
      })
      .from(imageJobs)
      .where(eq(imageJobs.owner, owner));

    const generationRows = await db
      .select({
        id: generationRuns.id,
        propertyId: generationRuns.propertyId,
        status: generationRuns.status,
        estimatedCostMicros:
          generationRuns.estimatedCostMicros,
        createdAt: generationRuns.createdAt,
      })
      .from(generationRuns)
      .where(eq(generationRuns.owner, owner));

    const textRows = await db
      .select({
        id: generatedTexts.id,
        propertyId: generatedTexts.propertyId,
        type: generatedTexts.type,
        model: generatedTexts.model,
        inputTokens: generatedTexts.inputTokens,
        outputTokens: generatedTexts.outputTokens,
        estimatedCostMicros:
          generatedTexts.estimatedCostMicros,
        createdAt: generatedTexts.createdAt,
      })
      .from(generatedTexts)
      .where(eq(generatedTexts.owner, owner));

    const clientRows = await db
      .select({ name: clients.name, color: clients.color })
      .from(clients)
      .where(eq(clients.owner, owner));
    const clientColors = new Map(
      clientRows.map((client) => [client.name, client.color]),
    );

    const projects = propertyRows.map((property) => {
      const projectJobs = jobRows.filter(
        (job) => job.propertyId === property.id,
      );

      const projectGenerations = generationRows.filter(
        (generation) =>
          generation.propertyId === property.id,
      );

      const projectTexts = textRows.filter(
        (text) => text.propertyId === property.id,
      );

      const completedJobs = projectJobs.filter(
        (job) =>
          job.status === "succeeded" &&
          Boolean(job.outputKey),
      );

      const successfulGenerations =
        projectGenerations.filter(
          (generation) =>
            generation.status === "succeeded",
        );

      /*
       * Cada generación de OpenAI guarda tres registros:
       * WhatsApp, portal e Instagram.
       *
       * Los agrupamos para no contar tres veces
       * los mismos tokens y el mismo costo.
       */
      const uniqueTextGenerations = new Map<
        string,
        {
          inputTokens: number;
          outputTokens: number;
          estimatedCostMicros: number;
        }
      >();

      for (const text of projectTexts) {
        const generationKey = [
          text.createdAt,
          text.model,
          text.inputTokens,
          text.outputTokens,
        ].join("-");

        if (!uniqueTextGenerations.has(generationKey)) {
          uniqueTextGenerations.set(generationKey, {
            inputTokens: Number(text.inputTokens || 0),
            outputTokens: Number(text.outputTokens || 0),
            estimatedCostMicros: Number(
              text.estimatedCostMicros || 0,
            ),
          });
        }
      }

      const textGenerations = Array.from(
        uniqueTextGenerations.values(),
      );

      const imageSpentMicros =
        successfulGenerations.reduce(
          (total, generation) =>
            total +
            Number(
              generation.estimatedCostMicros || 0,
            ),
          0,
        );

      const textSpentMicros = textGenerations.reduce(
        (total, generation) =>
          total + generation.estimatedCostMicros,
        0,
      );

      const inputTokens = textGenerations.reduce(
        (total, generation) =>
          total + generation.inputTokens,
        0,
      );

      const outputTokens = textGenerations.reduce(
        (total, generation) =>
          total + generation.outputTokens,
        0,
      );

      const latestCompletedImage =
        completedJobs.sort((first, second) =>
          second.updatedAt.localeCompare(first.updatedAt),
        )[0];

      return {
        id: property.id,
        slug: property.slug || "",
        name: property.name,
        title: property.title || property.name,
        address: property.address || "",
        zone: property.zone || "",
        client: property.client || "",
        clientColor: property.client
          ? clientColors.get(property.client) || "#64748b"
          : "",
        type: property.type || "",
        operation: property.operation || "",
        imageCount: projectJobs.length,
        generatedImageCount: completedJobs.length,
        imageGenerationCount:
          successfulGenerations.length,
        textCount: projectTexts.length,
        textGenerationCount:
          uniqueTextGenerations.size,
        inputTokens,
        outputTokens,
        imageSpentMicros,
        textSpentMicros,
        totalSpentMicros:
          imageSpentMicros + textSpentMicros,
        thumbnailUrl: latestCompletedImage
          ? `/api/files/${latestCompletedImage.id}`
          : null,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt,
      };
    });

    const totals = projects.reduce(
      (summary, project) => ({
        projects: summary.projects + 1,
        images:
          summary.images + project.generatedImageCount,
        texts:
          summary.texts + project.textCount,
        imageGenerations:
          summary.imageGenerations +
          project.imageGenerationCount,
        textGenerations:
          summary.textGenerations +
          project.textGenerationCount,
        inputTokens:
          summary.inputTokens + project.inputTokens,
        outputTokens:
          summary.outputTokens + project.outputTokens,
        spentMicros:
          summary.spentMicros +
          project.totalSpentMicros,
      }),
      {
        projects: 0,
        images: 0,
        texts: 0,
        imageGenerations: 0,
        textGenerations: 0,
        inputTokens: 0,
        outputTokens: 0,
        spentMicros: 0,
      },
    );

    return Response.json({
      projects,
      totals,
    });
  } catch (error) {
    console.error("Library load failed", error);

    return Response.json(
      {
        error:
          "No se pudo cargar la biblioteca de proyectos.",
      },
      {
        status: 500,
      },
    );
  }
}
