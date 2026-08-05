import { and, desc, eq } from "drizzle-orm";
import { ensureDbSchema, getDb } from "@/db";
import { cameraPresets } from "@/db/schema";
import { ownerFromRequest } from "@/lib/jobs";

function clampNumber(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(maximum, Math.max(minimum, Math.round(number * 10) / 10));
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 60) : "";
}

export async function GET() {
  try {
    await ensureDbSchema();
    const owner = await ownerFromRequest();
    const presets = await getDb()
      .select()
      .from(cameraPresets)
      .where(eq(cameraPresets.owner, owner))
      .orderBy(desc(cameraPresets.createdAt));

    return Response.json({ presets });
  } catch (error) {
    console.error("Camera presets load failed", error);
    return Response.json(
      { error: "No se pudieron cargar tus movimientos." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDbSchema();
    const owner = await ownerFromRequest();
    const payload = (await request.json()) as Record<string, unknown>;
    const name = cleanName(payload.name);

    if (!name) {
      return Response.json(
        { error: "Escribí un nombre para el movimiento." },
        { status: 400 },
      );
    }

    const [existing] = await getDb()
      .select({ id: cameraPresets.id })
      .from(cameraPresets)
      .where(
        and(eq(cameraPresets.owner, owner), eq(cameraPresets.name, name)),
      )
      .limit(1);

    if (existing) {
      return Response.json(
        { error: "Ya guardaste un movimiento con ese nombre." },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const preset = {
      id: crypto.randomUUID(),
      owner,
      name,
      horizontal: clampNumber(payload.horizontal, -10, 10),
      vertical: clampNumber(payload.vertical, -10, 10),
      zoom: clampNumber(payload.zoom, -10, 10),
      pan: clampNumber(payload.pan, -10, 10),
      tilt: clampNumber(payload.tilt, -10, 10),
      rotate: clampNumber(payload.rotate, -10, 10),
      durationSeconds: clampNumber(payload.durationSeconds || 5, 2, 10),
      createdAt: now,
      updatedAt: now,
    };

    await getDb().insert(cameraPresets).values(preset);
    return Response.json({ preset }, { status: 201 });
  } catch (error) {
    console.error("Camera preset creation failed", error);
    return Response.json(
      { error: "No se pudo guardar el movimiento." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureDbSchema();
    const owner = await ownerFromRequest();
    const payload = (await request.json()) as { id?: unknown };
    const id = typeof payload.id === "string" ? payload.id : "";

    await getDb()
      .delete(cameraPresets)
      .where(
        and(eq(cameraPresets.id, id), eq(cameraPresets.owner, owner)),
      );

    return Response.json({ deleted: true, id });
  } catch (error) {
    console.error("Camera preset deletion failed", error);
    return Response.json(
      { error: "No se pudo eliminar el movimiento." },
      { status: 500 },
    );
  }
}
