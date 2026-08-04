import { and, desc, eq } from "drizzle-orm";
import { ensureDbSchema, getDb } from "@/db";
import { generatedTexts, properties } from "@/db/schema";
import { ownerFromRequest } from "@/lib/jobs";

const ALLOWED_TEXT_TYPES = new Set([
  "whatsapp",
  "portal",
  "instagram",
]);

type GeneratedTextPayload = {
  id?: string;
  propertyId?: string;
  type?: string;
  content?: string;
  sourceText?: string;
  promptVersion?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostMicros?: number;
};

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function nonNegativeInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.round(parsed));
}

function publicGeneratedText(
  row: typeof generatedTexts.$inferSelect,
) {
  return {
    id: row.id,
    propertyId: row.propertyId,
    type: row.type,
    content: row.content,
    sourceText: row.sourceText || "",
    promptVersion: row.promptVersion,
    model: row.model,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    estimatedCostMicros: row.estimatedCostMicros,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function propertyBelongsToOwner(
  propertyId: string,
  owner: string,
) {
  const [property] = await getDb()
    .select({
      id: properties.id,
    })
    .from(properties)
    .where(
      and(
        eq(properties.id, propertyId),
        eq(properties.owner, owner),
      ),
    )
    .limit(1);

  return Boolean(property);
}

export async function GET(request: Request) {
  try {
    await ensureDbSchema();

    const owner = await ownerFromRequest();
    const url = new URL(request.url);
    const propertyId = cleanString(
      url.searchParams.get("propertyId"),
      100,
    );

    const rows = propertyId
      ? await getDb()
          .select()
          .from(generatedTexts)
          .where(
            and(
              eq(generatedTexts.owner, owner),
              eq(generatedTexts.propertyId, propertyId),
            ),
          )
          .orderBy(desc(generatedTexts.createdAt))
      : await getDb()
          .select()
          .from(generatedTexts)
          .where(eq(generatedTexts.owner, owner))
          .orderBy(desc(generatedTexts.createdAt));

    return Response.json({
      texts: rows.map(publicGeneratedText),
    });
  } catch (error) {
    console.error("Generated texts load failed", error);

    return Response.json(
      {
        error: "No se pudieron cargar los textos guardados.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDbSchema();

    const owner = await ownerFromRequest();
    const payload =
      (await request.json()) as GeneratedTextPayload;

    const propertyId = cleanString(payload.propertyId, 100);
    const type = cleanString(payload.type, 40).toLowerCase();
    const content = cleanString(payload.content, 30_000);
    const sourceText = cleanString(payload.sourceText, 30_000);
    const promptVersion =
      cleanString(payload.promptVersion, 80) || "v1";
    const model =
      cleanString(payload.model, 100) || "unknown";

    if (!propertyId) {
      return Response.json(
        {
          error: "Falta identificar la propiedad.",
        },
        {
          status: 400,
        },
      );
    }

    if (!ALLOWED_TEXT_TYPES.has(type)) {
      return Response.json(
        {
          error:
            "El tipo debe ser whatsapp, portal o instagram.",
        },
        {
          status: 400,
        },
      );
    }

    if (!content) {
      return Response.json(
        {
          error: "El texto no puede estar vacío.",
        },
        {
          status: 400,
        },
      );
    }

    const propertyExists = await propertyBelongsToOwner(
      propertyId,
      owner,
    );

    if (!propertyExists) {
      return Response.json(
        {
          error: "La propiedad seleccionada no existe.",
        },
        {
          status: 404,
        },
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await getDb().insert(generatedTexts).values({
      id,
      owner,
      propertyId,
      type,
      content,
      sourceText: sourceText || null,
      promptVersion,
      model,
      inputTokens: nonNegativeInteger(payload.inputTokens),
      outputTokens: nonNegativeInteger(payload.outputTokens),
      estimatedCostMicros: nonNegativeInteger(
        payload.estimatedCostMicros,
      ),
      createdAt: now,
      updatedAt: now,
    });

    await getDb()
      .update(properties)
      .set({
        updatedAt: now,
      })
      .where(
        and(
          eq(properties.id, propertyId),
          eq(properties.owner, owner),
        ),
      );

    const [created] = await getDb()
      .select()
      .from(generatedTexts)
      .where(
        and(
          eq(generatedTexts.id, id),
          eq(generatedTexts.owner, owner),
        ),
      )
      .limit(1);

    return Response.json(
      {
        text: publicGeneratedText(created),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Generated text creation failed", error);

    return Response.json(
      {
        error: "No se pudo guardar el texto.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PUT(request: Request) {
  try {
    await ensureDbSchema();

    const owner = await ownerFromRequest();
    const payload =
      (await request.json()) as GeneratedTextPayload;

    const id = cleanString(payload.id, 100);

    if (!id) {
      return Response.json(
        {
          error: "Falta identificar el texto.",
        },
        {
          status: 400,
        },
      );
    }

    const [existing] = await getDb()
      .select()
      .from(generatedTexts)
      .where(
        and(
          eq(generatedTexts.id, id),
          eq(generatedTexts.owner, owner),
        ),
      )
      .limit(1);

    if (!existing) {
      return Response.json(
        {
          error: "El texto no existe.",
        },
        {
          status: 404,
        },
      );
    }

    const type = payload.type
      ? cleanString(payload.type, 40).toLowerCase()
      : existing.type;

    const content =
      payload.content !== undefined
        ? cleanString(payload.content, 30_000)
        : existing.content;

    if (!ALLOWED_TEXT_TYPES.has(type)) {
      return Response.json(
        {
          error:
            "El tipo debe ser whatsapp, portal o instagram.",
        },
        {
          status: 400,
        },
      );
    }

    if (!content) {
      return Response.json(
        {
          error: "El texto no puede estar vacío.",
        },
        {
          status: 400,
        },
      );
    }

    const now = new Date().toISOString();

    await getDb()
      .update(generatedTexts)
      .set({
        type,
        content,
        sourceText:
          payload.sourceText !== undefined
            ? cleanString(payload.sourceText, 30_000) || null
            : existing.sourceText,
        promptVersion:
          payload.promptVersion !== undefined
            ? cleanString(payload.promptVersion, 80) || "v1"
            : existing.promptVersion,
        model:
          payload.model !== undefined
            ? cleanString(payload.model, 100) || existing.model
            : existing.model,
        inputTokens:
          payload.inputTokens !== undefined
            ? nonNegativeInteger(payload.inputTokens)
            : existing.inputTokens,
        outputTokens:
          payload.outputTokens !== undefined
            ? nonNegativeInteger(payload.outputTokens)
            : existing.outputTokens,
        estimatedCostMicros:
          payload.estimatedCostMicros !== undefined
            ? nonNegativeInteger(payload.estimatedCostMicros)
            : existing.estimatedCostMicros,
        updatedAt: now,
      })
      .where(
        and(
          eq(generatedTexts.id, id),
          eq(generatedTexts.owner, owner),
        ),
      );

    await getDb()
      .update(properties)
      .set({
        updatedAt: now,
      })
      .where(
        and(
          eq(properties.id, existing.propertyId),
          eq(properties.owner, owner),
        ),
      );

    const [updated] = await getDb()
      .select()
      .from(generatedTexts)
      .where(
        and(
          eq(generatedTexts.id, id),
          eq(generatedTexts.owner, owner),
        ),
      )
      .limit(1);

    return Response.json({
      text: publicGeneratedText(updated),
    });
  } catch (error) {
    console.error("Generated text update failed", error);

    return Response.json(
      {
        error: "No se pudo actualizar el texto.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureDbSchema();

    const owner = await ownerFromRequest();
    const url = new URL(request.url);
    const id = cleanString(url.searchParams.get("id"), 100);

    if (!id) {
      return Response.json(
        {
          error: "Falta identificar el texto.",
        },
        {
          status: 400,
        },
      );
    }

    const [existing] = await getDb()
      .select()
      .from(generatedTexts)
      .where(
        and(
          eq(generatedTexts.id, id),
          eq(generatedTexts.owner, owner),
        ),
      )
      .limit(1);

    if (!existing) {
      return new Response(null, {
        status: 204,
      });
    }

    await getDb()
      .delete(generatedTexts)
      .where(
        and(
          eq(generatedTexts.id, id),
          eq(generatedTexts.owner, owner),
        ),
      );

    await getDb()
      .update(properties)
      .set({
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(properties.id, existing.propertyId),
          eq(properties.owner, owner),
        ),
      );

    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    console.error("Generated text deletion failed", error);

    return Response.json(
      {
        error: "No se pudo eliminar el texto.",
      },
      {
        status: 500,
      },
    );
  }
}