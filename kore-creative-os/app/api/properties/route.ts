import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { ensureDbSchema, getDb } from "@/db";
import { generationRuns, imageJobs, properties } from "@/db/schema";
import { ownerFromRequest } from "@/lib/jobs";
import { estimatedCostMicros } from "@/lib/pricing";

async function organizeLegacyJobs(owner: string) {
  const db = getDb();
  const [legacyJob] = await db
    .select({ id: imageJobs.id })
    .from(imageJobs)
    .where(and(eq(imageJobs.owner, owner), isNull(imageJobs.propertyId)))
    .limit(1);
  if (!legacyJob) return;

  let [legacyProperty] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(
        eq(properties.owner, owner),
        eq(properties.name, "Historial anterior"),
      ),
    )
    .limit(1);

  if (!legacyProperty) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(properties).values({
      id,
      owner,
      name: "Historial anterior",
      address: "Imágenes creadas antes de organizar por propiedades",
      createdAt: now,
      updatedAt: now,
    });
    legacyProperty = { id };
  }

  await db
    .update(imageJobs)
    .set({ propertyId: legacyProperty.id })
    .where(and(eq(imageJobs.owner, owner), isNull(imageJobs.propertyId)));

  const completedLegacyJobs = await db
    .select({
      id: imageJobs.id,
      predictionId: imageJobs.predictionId,
      quality: imageJobs.quality,
      createdAt: imageJobs.createdAt,
      updatedAt: imageJobs.updatedAt,
    })
    .from(imageJobs)
    .where(
      and(
        eq(imageJobs.owner, owner),
        eq(imageJobs.propertyId, legacyProperty.id),
        eq(imageJobs.status, "succeeded"),
      ),
    );

  for (const job of completedLegacyJobs) {
    if (!job.predictionId) continue;
    await db
      .insert(generationRuns)
      .values({
        id: `legacy-${job.id}`,
        owner,
        propertyId: legacyProperty.id,
        jobId: job.id,
        predictionId: job.predictionId,
        quality: job.quality,
        status: "succeeded",
        estimatedCostMicros: estimatedCostMicros(job.quality),
        createdAt: job.createdAt,
        completedAt: job.updatedAt,
      })
      .onConflictDoNothing({ target: generationRuns.predictionId });
  }
}

export async function GET() {
  try {
    await ensureDbSchema();
    const owner = await ownerFromRequest();
    await organizeLegacyJobs(owner);
    const db = getDb();

    const rows = await db
      .select({
        id: properties.id,
        name: properties.name,
        address: properties.address,
        createdAt: properties.createdAt,
        updatedAt: properties.updatedAt,
        imageCount: sql<number>`count(distinct ${imageJobs.id})`,
        completedCount: sql<number>`count(distinct case when ${imageJobs.status} = 'succeeded' then ${imageJobs.id} end)`,
        generationCount: sql<number>`count(distinct case when ${generationRuns.status} = 'succeeded' then ${generationRuns.id} end)`,
        spentMicros: sql<number>`coalesce(sum(case when ${generationRuns.status} = 'succeeded' then ${generationRuns.estimatedCostMicros} else 0 end), 0)`,
      })
      .from(properties)
      .leftJoin(
        imageJobs,
        and(
          eq(imageJobs.propertyId, properties.id),
          eq(imageJobs.owner, owner),
        ),
      )
      .leftJoin(
        generationRuns,
        and(
          eq(generationRuns.jobId, imageJobs.id),
          eq(generationRuns.owner, owner),
        ),
      )
      .where(eq(properties.owner, owner))
      .groupBy(properties.id)
      .orderBy(desc(properties.updatedAt));

    return Response.json({
      properties: rows.map((row) => ({
        ...row,
        imageCount: Number(row.imageCount || 0),
        completedCount: Number(row.completedCount || 0),
        generationCount: Number(row.generationCount || 0),
        spentMicros: Number(row.spentMicros || 0),
      })),
    });
  } catch (error) {
    console.error("Properties load failed", error);
    return Response.json(
      { error: "No se pudieron cargar las propiedades." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDbSchema();
    const owner = await ownerFromRequest();
    const payload = (await request.json()) as {
      name?: string;
      address?: string;
    };
    const name = payload.name?.trim();
    const address = payload.address?.trim() || null;
    if (!name) {
      return Response.json(
        { error: "Escribí un nombre para la propiedad." },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await getDb().insert(properties).values({
      id,
      owner,
      name,
      address,
      createdAt: now,
      updatedAt: now,
    });

    return Response.json(
      {
        property: {
          id,
          name,
          address,
          imageCount: 0,
          completedCount: 0,
          generationCount: 0,
          spentMicros: 0,
          createdAt: now,
          updatedAt: now,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Property creation failed", error);
    return Response.json(
      { error: "No se pudo crear la propiedad." },
      { status: 500 },
    );
  }
}
