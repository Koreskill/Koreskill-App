import { and, asc, eq } from "drizzle-orm";
import { ensureDbSchema, getDb } from "@/db";
import { calendarItems, clients, properties } from "@/db/schema";
import { ownerFromRequest } from "@/lib/jobs";

const DEFAULT_COLOR = "#2563eb";

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function cleanColor(value: unknown) {
  if (typeof value !== "string") return DEFAULT_COLOR;
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_COLOR;
}

export async function GET() {
  try {
    await ensureDbSchema();
    const owner = await ownerFromRequest();
    const rows = await getDb()
      .select()
      .from(clients)
      .where(eq(clients.owner, owner))
      .orderBy(asc(clients.name));

    return Response.json({ clients: rows });
  } catch (error) {
    console.error("Clients load failed", error);
    return Response.json(
      { error: "No se pudieron cargar los clientes." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDbSchema();
    const owner = await ownerFromRequest();
    const payload = (await request.json()) as {
      name?: unknown;
      color?: unknown;
    };
    const name = cleanName(payload.name);

    if (!name) {
      return Response.json(
        { error: "Escribí el nombre del cliente." },
        { status: 400 },
      );
    }

    const [existing] = await getDb()
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.owner, owner), eq(clients.name, name)))
      .limit(1);

    if (existing) {
      return Response.json(
        { error: "Ya existe un cliente con ese nombre." },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const client = {
      id: crypto.randomUUID(),
      owner,
      name,
      color: cleanColor(payload.color),
      createdAt: now,
      updatedAt: now,
    };

    await getDb().insert(clients).values(client);
    return Response.json({ client }, { status: 201 });
  } catch (error) {
    console.error("Client creation failed", error);
    return Response.json(
      { error: "No se pudo crear el cliente." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    await ensureDbSchema();
    const owner = await ownerFromRequest();
    const payload = (await request.json()) as {
      id?: unknown;
      name?: unknown;
      color?: unknown;
    };
    const id = typeof payload.id === "string" ? payload.id : "";
    const name = cleanName(payload.name);

    if (!id || !name) {
      return Response.json(
        { error: "Faltan los datos del cliente." },
        { status: 400 },
      );
    }

    const [existing] = await getDb()
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.owner, owner)))
      .limit(1);

    if (!existing) {
      return Response.json(
        { error: "El cliente no existe." },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();
    const color = cleanColor(payload.color);

    await getDb()
      .update(clients)
      .set({ name, color, updatedAt: now })
      .where(and(eq(clients.id, id), eq(clients.owner, owner)));

    if (existing.name !== name) {
      await getDb()
        .update(properties)
        .set({ client: name, updatedAt: now })
        .where(
          and(eq(properties.owner, owner), eq(properties.client, existing.name)),
        );
    }

    return Response.json({
      client: { ...existing, name, color, updatedAt: now },
    });
  } catch (error) {
    console.error("Client update failed", error);
    return Response.json(
      { error: "No se pudo actualizar el cliente." },
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

    const [existing] = await getDb()
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.owner, owner)))
      .limit(1);

    if (!existing) {
      return Response.json(
        { error: "El cliente no existe." },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();
    await getDb()
      .update(calendarItems)
      .set({ clientId: null, updatedAt: now })
      .where(
        and(eq(calendarItems.owner, owner), eq(calendarItems.clientId, id)),
      );
    await getDb()
      .update(properties)
      .set({ client: null, updatedAt: now })
      .where(
        and(eq(properties.owner, owner), eq(properties.client, existing.name)),
      );
    await getDb()
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.owner, owner)));

    return Response.json({ deleted: true, id });
  } catch (error) {
    console.error("Client deletion failed", error);
    return Response.json(
      { error: "No se pudo eliminar el cliente." },
      { status: 500 },
    );
  }
}
