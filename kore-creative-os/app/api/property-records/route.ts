import { and, desc, eq } from "drizzle-orm";
import { ensureDbSchema, getDb } from "@/db";
import { properties } from "@/db/schema";
import { ownerFromRequest } from "@/lib/jobs";

type PropertyPayload = {
  id?: string;
  tipo?: string;
  operacion?: string;
  titulo?: string;
  zona?: string;
  direccion?: string;
  cliente?: string;
  moneda?: string;
  precio?: number | string | null;
  totalM2?: number | string | null;
  cubiertaM2?: number | string | null;
  dormitorios?: number | string | null;
  banos?: number | string | null;
  cocheras?: number | string | null;
  estado?: string;
  situacion?: string;
  destacados?: unknown;
  contacto?: string;
  textoOriginal?: string;
};

function cleanText(value: unknown, maxLength = 240) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function nullableNumber(value: unknown, integer = false) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return integer ? Math.max(0, Math.round(parsed)) : Math.max(0, parsed);
}

function normalizeHighlights(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, 280))
    .filter(Boolean)
    .slice(0, 16);
}

function parseHighlights(value: string | null) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function slugify(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "propiedad"
  );
}

async function availableSlug(
  owner: string,
  value: string,
  currentId?: string,
) {
  const rows = await getDb()
    .select({ id: properties.id, slug: properties.slug })
    .from(properties)
    .where(eq(properties.owner, owner));
  const used = new Set(
    rows
      .filter((row) => row.id !== currentId && row.slug)
      .map((row) => row.slug as string),
  );
  const base = slugify(value);
  let candidate = base;
  let suffix = 2;

  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function publicProperty(row: typeof properties.$inferSelect) {
  return {
    id: row.id,
    slug: row.slug || "",
    tipo: row.type || "",
    operacion: row.operation || "",
    titulo: row.title || row.name,
    zona: row.zone || "",
    direccion: row.address || "",
    cliente: row.client || "",
    moneda: row.currency || "USD",
    precio: row.priceValue,
    totalM2: row.totalM2,
    cubiertaM2: row.coveredM2,
    dormitorios: row.bedrooms,
    banos: row.bathrooms,
    cocheras: row.garages,
    estado: row.propertyStatus || "",
    situacion: row.situation || "",
    destacados: parseHighlights(row.highlightsJson),
    contacto: row.contact || "",
    textoOriginal: row.rawSource || "",
    creada: row.createdAt,
    actualizada: row.updatedAt,
    fichaCompleta: Boolean(row.title || row.slug),
  };
}

function normalizedValues(payload: PropertyPayload) {
  const titulo = cleanText(payload.titulo, 180);
  const direccion = cleanText(payload.direccion, 220);

  return {
    name: titulo || direccion || "Propiedad sin título",
    type: cleanText(payload.tipo, 60) || null,
    operation: cleanText(payload.operacion, 40) || null,
    title: titulo || null,
    zone: cleanText(payload.zona, 100) || null,
    address: direccion || null,
    client: cleanText(payload.cliente, 100) || null,
    currency: cleanText(payload.moneda, 12) || "USD",
    priceValue: nullableNumber(payload.precio, true),
    totalM2: nullableNumber(payload.totalM2),
    coveredM2: nullableNumber(payload.cubiertaM2),
    bedrooms: nullableNumber(payload.dormitorios, true),
    bathrooms: nullableNumber(payload.banos, true),
    garages: nullableNumber(payload.cocheras, true),
    propertyStatus: cleanText(payload.estado, 80) || null,
    situation: cleanText(payload.situacion, 80) || null,
    highlightsJson: JSON.stringify(normalizeHighlights(payload.destacados)),
    contact: cleanText(payload.contacto, 120) || null,
    rawSource: cleanText(payload.textoOriginal, 12_000) || null,
  };
}

export async function GET(request: Request) {
  try {
    await ensureDbSchema();
    const owner = ownerFromRequest(request);
    const rows = await getDb()
      .select()
      .from(properties)
      .where(eq(properties.owner, owner))
      .orderBy(desc(properties.updatedAt));

    return Response.json({ properties: rows.map(publicProperty) });
  } catch (error) {
    console.error("Property records load failed", error);
    return Response.json(
      { error: "No se pudieron cargar las fichas." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDbSchema();
    const owner = ownerFromRequest(request);
    const payload = (await request.json()) as PropertyPayload;
    const values = normalizedValues(payload);

    if (!values.title && !values.address) {
      return Response.json(
        { error: "Completá al menos el título o la dirección." },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const slug = await availableSlug(
      owner,
      values.address || values.title || values.name,
    );

    await getDb().insert(properties).values({
      id,
      owner,
      slug,
      ...values,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await getDb()
      .select()
      .from(properties)
      .where(and(eq(properties.id, id), eq(properties.owner, owner)))
      .limit(1);

    return Response.json(
      { property: publicProperty(created) },
      { status: 201 },
    );
  } catch (error) {
    console.error("Property record creation failed", error);
    return Response.json(
      { error: "No se pudo guardar la ficha." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    await ensureDbSchema();
    const owner = ownerFromRequest(request);
    const payload = (await request.json()) as PropertyPayload;
    const id = cleanText(payload.id, 80);

    if (!id) {
      return Response.json(
        { error: "Falta identificar la propiedad." },
        { status: 400 },
      );
    }

    const [existing] = await getDb()
      .select()
      .from(properties)
      .where(and(eq(properties.id, id), eq(properties.owner, owner)))
      .limit(1);

    if (!existing) {
      return Response.json(
        { error: "La propiedad no existe." },
        { status: 404 },
      );
    }

    const values = normalizedValues(payload);
    const now = new Date().toISOString();
    const slug = await availableSlug(
      owner,
      values.address || values.title || values.name,
      id,
    );

    await getDb()
      .update(properties)
      .set({ slug, ...values, updatedAt: now })
      .where(and(eq(properties.id, id), eq(properties.owner, owner)));

    const [updated] = await getDb()
      .select()
      .from(properties)
      .where(and(eq(properties.id, id), eq(properties.owner, owner)))
      .limit(1);

    return Response.json({ property: publicProperty(updated) });
  } catch (error) {
    console.error("Property record update failed", error);
    return Response.json(
      { error: "No se pudo actualizar la ficha." },
      { status: 500 },
    );
  }
}
