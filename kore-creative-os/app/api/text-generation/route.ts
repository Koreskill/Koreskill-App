import { and, eq } from "drizzle-orm";
import { ensureDbSchema, getDb } from "@/db";
import {
  generatedTexts,
  properties,
} from "@/db/schema";
import { ownerFromRequest } from "@/lib/jobs";
import {
  getOpenAIClient,
  getOpenAITextModel,
  isOpenAIConfigured,
} from "@/lib/openai";
import {
  buildPropertyTextInput,
  PROPERTY_TEXT_INSTRUCTIONS,
  PROPERTY_TEXT_PROMPT_VERSION,
  type PropertyPromptData,
} from "@/lib/prompts/property-text";

type TextGenerationPayload = {
  propertyId?: string;
  sourceText?: string;
  property?: PropertyPromptData;
};

type OpenAIPropertyResult = {
  tipo: string;
  operacion: string;
  titulo: string;
  zona: string;
  direccion: string;
  cliente: string;
  moneda: string;
  precio: string;
  totalM2: string;
  cubiertaM2: string;
  dormitorios: string;
  banos: string;
  cocheras: string;
  estado: string;
  situacion: string;
  destacados: string[];
  contacto: string;
};

type OpenAITextResult = {
  property: OpenAIPropertyResult;
  texts: {
    whatsapp: string;
    portal: string;
    instagram: string;
  };
};

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function parseOpenAIJson(output: string): OpenAITextResult {
  const cleaned = output
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error(
      "OpenAI no devolvió un formato de texto válido.",
    );
  }

  const jsonText = cleaned.slice(
    firstBrace,
    lastBrace + 1,
  );

  const parsed = JSON.parse(jsonText) as Partial<OpenAITextResult>;

  if (
    !parsed.property ||
    !parsed.texts ||
    typeof parsed.texts.whatsapp !== "string" ||
    typeof parsed.texts.portal !== "string" ||
    typeof parsed.texts.instagram !== "string"
  ) {
    throw new Error(
      "OpenAI devolvió una respuesta incompleta.",
    );
  }

  const property = parsed.property as Partial<OpenAIPropertyResult>;

  return {
    property: {
      tipo: cleanString(property.tipo, 80),
      operacion: cleanString(property.operacion, 80),
      titulo: cleanString(property.titulo, 200),
      zona: cleanString(property.zona, 120),
      direccion: cleanString(property.direccion, 240),
      cliente: cleanString(property.cliente, 120),
      moneda: cleanString(property.moneda, 20),
      precio: cleanString(property.precio, 80),
      totalM2: cleanString(property.totalM2, 40),
      cubiertaM2: cleanString(property.cubiertaM2, 40),
      dormitorios: cleanString(property.dormitorios, 40),
      banos: cleanString(property.banos, 40),
      cocheras: cleanString(property.cocheras, 40),
      estado: cleanString(property.estado, 120),
      situacion: cleanString(property.situacion, 120),
      destacados: Array.isArray(property.destacados)
        ? property.destacados
            .map((item) => cleanString(item, 280))
            .filter(Boolean)
            .slice(0, 16)
        : [],
      contacto: cleanString(property.contacto, 160),
    },
    texts: {
      whatsapp: cleanString(
        parsed.texts.whatsapp,
        30_000,
      ),
      portal: cleanString(
        parsed.texts.portal,
        30_000,
      ),
      instagram: cleanString(
        parsed.texts.instagram,
        30_000,
      ),
    },
  };
}

export async function POST(request: Request) {
  try {
    await ensureDbSchema();

    if (!isOpenAIConfigured()) {
      return Response.json(
        {
          error:
            "OpenAI no está configurado. Revisá OPENAI_API_KEY y OPENAI_TEXT_MODEL.",
          code: "OPENAI_NOT_CONFIGURED",
        },
        {
          status: 503,
        },
      );
    }

    const owner = await ownerFromRequest();
    const payload =
      (await request.json()) as TextGenerationPayload;

    const propertyId = cleanString(
      payload.propertyId,
      100,
    );

    const sourceText = cleanString(
      payload.sourceText,
      30_000,
    );

    if (!propertyId) {
      return Response.json(
        {
          error:
            "Primero guardá la propiedad antes de generar los textos.",
        },
        {
          status: 400,
        },
      );
    }

    if (!sourceText) {
      return Response.json(
        {
          error:
            "Pegá la información original de la propiedad.",
        },
        {
          status: 400,
        },
      );
    }

    const [propertyRecord] = await getDb()
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

    if (!propertyRecord) {
      return Response.json(
        {
          error:
            "La propiedad seleccionada no existe.",
        },
        {
          status: 404,
        },
      );
    }

    const client = getOpenAIClient();
    const model = getOpenAITextModel();

    const response = await client.responses.create({
      model,
      instructions: PROPERTY_TEXT_INSTRUCTIONS,
      input: buildPropertyTextInput(
        sourceText,
        payload.property || {},
      ),
    });

    const outputText = response.output_text?.trim();

    if (!outputText) {
      throw new Error(
        "OpenAI no devolvió ningún texto.",
      );
    }

    const result = parseOpenAIJson(outputText);

    if (
      !result.texts.whatsapp ||
      !result.texts.portal ||
      !result.texts.instagram
    ) {
      throw new Error(
        "OpenAI no generó los tres formatos solicitados.",
      );
    }

    const inputTokens =
      response.usage?.input_tokens || 0;

    const outputTokens =
      response.usage?.output_tokens || 0;

    const now = new Date().toISOString();

    const savedTexts = [
      {
        id: crypto.randomUUID(),
        owner,
        propertyId,
        type: "whatsapp",
        content: result.texts.whatsapp,
        sourceText,
        promptVersion: PROPERTY_TEXT_PROMPT_VERSION,
        model,
        inputTokens,
        outputTokens,
        estimatedCostMicros: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        owner,
        propertyId,
        type: "portal",
        content: result.texts.portal,
        sourceText,
        promptVersion: PROPERTY_TEXT_PROMPT_VERSION,
        model,
        inputTokens,
        outputTokens,
        estimatedCostMicros: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        owner,
        propertyId,
        type: "instagram",
        content: result.texts.instagram,
        sourceText,
        promptVersion: PROPERTY_TEXT_PROMPT_VERSION,
        model,
        inputTokens,
        outputTokens,
        estimatedCostMicros: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];

    await getDb()
      .insert(generatedTexts)
      .values(savedTexts);

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

    return Response.json({
      property: result.property,
      texts: result.texts,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens:
          response.usage?.total_tokens ||
          inputTokens + outputTokens,
      },
      model,
      promptVersion: PROPERTY_TEXT_PROMPT_VERSION,
    });
  } catch (error) {
    console.error("OpenAI text generation failed", error);

    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron generar los textos.";

    return Response.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}