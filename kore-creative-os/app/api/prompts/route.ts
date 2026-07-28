import { and, eq } from "drizzle-orm";
import { ensureDbSchema, getDb } from "@/db";
import { promptPresets } from "@/db/schema";
import { ownerFromRequest } from "@/lib/jobs";

const DEFAULT_PRESETS = [
  {
    key: "fachada",
    label: "Fachada",
    prompt: `Utiliza exactamente la fotografía de la fachada como imagen base.

Extiende el encuadre verticalmente al formato 9:16 mediante outpainting, generando principalmente cielo en el borde superior y suelo, vereda, césped o calle en el borde inferior según corresponda.

Conserva completamente la arquitectura, proporciones, aberturas, balcones, techos, materiales, vegetación, cercos, perspectiva, punto de vista y distancia focal. No agregues construcciones ni rediseñes la propiedad.

Ajusta sutilmente la iluminación, el balance de blancos, las sombras y el contraste para obtener una fotografía inmobiliaria premium, natural y realista. Evita colores saturados, apariencia de render o retoques artificiales.`,
  },
  {
    key: "bano",
    label: "Baño",
    prompt: `Utiliza exactamente la fotografía del baño como imagen base.

Extiende el encuadre verticalmente al formato 9:16 continuando de forma natural el cielorraso, las paredes, revestimientos y el piso.

Conserva sin cambios sanitarios, griferías, vanitory, espejo, ducha, bañera, mamparas, iluminación, materiales, juntas, proporciones, perspectiva y distribución. No agregues artefactos, decoración ni mobiliario inexistente.

Corrige sutilmente el balance de blancos, levanta sombras y mejora la claridad de los materiales con una estética inmobiliaria premium, limpia, luminosa y absolutamente realista. Evita blancos quemados, saturación y apariencia de render.`,
  },
  {
    key: "living",
    label: "Living",
    prompt: `Utiliza exactamente la fotografía del living como imagen base.

Extiende el encuadre verticalmente al formato 9:16 continuando naturalmente cielorraso, paredes, cortinas, ventanales y piso en los bordes superiores e inferiores.

Conserva sin cambios la distribución, sillones, mesas, luminarias, cuadros, alfombras, carpinterías, vegetación, materiales, perspectiva, punto de vista y distancia focal. No agregues, elimines ni reemplaces mobiliario.

Mejora sutilmente la luz natural, el balance de blancos, el contraste y las sombras para lograr una fotografía inmobiliaria cálida, elegante y realista. Evita saturación, estilización excesiva o apariencia de render.`,
  },
  {
    key: "cocina",
    label: "Cocina",
    prompt: `Utiliza exactamente la fotografía de la cocina como imagen base.

Extiende el encuadre verticalmente al formato 9:16 continuando cielorraso, paredes, muebles, revestimientos y piso de manera coherente.

Conserva completamente alacenas, bajo mesadas, mesadas, griferías, bachas, electrodomésticos, tiradores, materiales, distribución, proporciones, perspectiva y punto de vista. No cambies colores, no rediseñes el mobiliario y no agregues objetos inexistentes.

Ajusta sutilmente iluminación, balance de blancos, reflejos, sombras y contraste para una estética inmobiliaria premium, limpia y natural. Mantén texturas realistas y evita blancos quemados, saturación o apariencia de render.`,
  },
  {
    key: "dormitorio",
    label: "Dormitorio",
    prompt: `Utiliza exactamente la fotografía del dormitorio como imagen base.

Extiende el encuadre verticalmente al formato 9:16 continuando naturalmente cielorraso, paredes, cortinas, placares y piso.

Conserva sin cambios cama, ropa de cama, mesas de luz, luminarias, placares, aberturas, decoración, materiales, distribución, perspectiva, punto de vista y distancia focal. No agregues ni reemplaces mobiliario u objetos.

Mejora sutilmente la iluminación natural, el balance de blancos, las sombras y el contraste para lograr una imagen inmobiliaria serena, cálida, ordenada y absolutamente realista. Evita saturación, retoques artificiales o apariencia de render.`,
  },
  {
    key: "balcon",
    label: "Balcón",
    prompt: `Utiliza exactamente la fotografía del balcón como imagen base.

Extiende el encuadre verticalmente al formato 9:16 continuando de manera natural el cielo, paredes, techo, barandas, vegetación y piso en los bordes superiores e inferiores.

Conserva sin cambios las barandas, cerramientos, aberturas, pisos, mobiliario exterior, plantas, vistas, horizonte, proporciones, perspectiva, punto de vista y distancia focal. No agregues edificios, decoración, vegetación ni mobiliario inexistente.

Mejora sutilmente la luz natural, el balance de blancos, las sombras y el contraste para lograr una fotografía inmobiliaria luminosa, atractiva y absolutamente realista. Mantén la vista exterior natural y evita saturación, cielos artificiales o apariencia de render.`,
  },
] as const;

function presetKey(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureDefaultPresets(owner: string) {
  const db = getDb();
  const existing = await db
    .select({ key: promptPresets.key })
    .from(promptPresets)
    .where(eq(promptPresets.owner, owner));
  const existingKeys = new Set(existing.map((preset) => preset.key));
  const now = new Date().toISOString();

  for (const preset of DEFAULT_PRESETS) {
    if (existingKeys.has(preset.key)) continue;
    await db.insert(promptPresets).values({
      id: crypto.randomUUID(),
      owner,
      key: preset.key,
      label: preset.label,
      prompt: preset.prompt,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function GET(request: Request) {
  try {
    await ensureDbSchema();
    const owner = ownerFromRequest(request);
    await ensureDefaultPresets(owner);
    const rows = await getDb()
      .select({
        key: promptPresets.key,
        label: promptPresets.label,
        prompt: promptPresets.prompt,
        updatedAt: promptPresets.updatedAt,
      })
      .from(promptPresets)
      .where(eq(promptPresets.owner, owner));
    const presetOrder = new Map(
      DEFAULT_PRESETS.map((preset, index) => [preset.key, index]),
    );
    rows.sort(
      (a, b) =>
        (presetOrder.get(a.key) ?? 99) - (presetOrder.get(b.key) ?? 99),
    );
    return Response.json({ presets: rows });
  } catch (error) {
    console.error("Prompt presets load failed", error);
    return Response.json(
      { error: "No se pudieron cargar los prompts preestablecidos." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    await ensureDbSchema();
    const owner = ownerFromRequest(request);
    const payload = (await request.json()) as {
      key?: string;
      prompt?: string;
    };
    const key = payload.key?.trim();
    const prompt = payload.prompt?.trim();
    if (!key || !prompt) {
      return Response.json(
        { error: "El prompt no puede quedar vacío." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    await getDb()
      .update(promptPresets)
      .set({ prompt, updatedAt: now })
      .where(
        and(eq(promptPresets.owner, owner), eq(promptPresets.key, key)),
      );
    return Response.json({ preset: { key, prompt, updatedAt: now } });
  } catch (error) {
    console.error("Prompt preset update failed", error);
    return Response.json(
      { error: "No se pudo guardar el prompt." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDbSchema();
    const owner = ownerFromRequest(request);
    const payload = (await request.json()) as {
      label?: string;
      prompt?: string;
    };
    const label = payload.label?.trim();
    const prompt = payload.prompt?.trim();
    const key = label ? presetKey(label) : "";
    if (!label || !prompt || !key) {
      return Response.json(
        { error: "Completá el nombre y el prompt." },
        { status: 400 },
      );
    }

    const db = getDb();
    const [existing] = await db
      .select({ key: promptPresets.key })
      .from(promptPresets)
      .where(and(eq(promptPresets.owner, owner), eq(promptPresets.key, key)))
      .limit(1);
    if (existing) {
      return Response.json(
        { error: "Ya existe un preset con ese nombre." },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    await db.insert(promptPresets).values({
      id: crypto.randomUUID(),
      owner,
      key,
      label: label.slice(0, 40),
      prompt,
      createdAt: now,
      updatedAt: now,
    });
    return Response.json(
      { preset: { key, label: label.slice(0, 40), prompt, updatedAt: now } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Prompt preset create failed", error);
    return Response.json(
      { error: "No se pudo crear el preset." },
      { status: 500 },
    );
  }
}
