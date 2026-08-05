import { and, eq } from "drizzle-orm";
import { ensureDbSchema, getDb } from "@/db";
import { calendarItems, clients, properties } from "@/db/schema";
import { ownerFromRequest } from "@/lib/jobs";

const VALID_STATUSES = new Set(["planned", "ready", "published"]);

function cleanText(value: unknown, maximum = 160) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function cleanDate(value: unknown) {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await ensureDbSchema();
    const owner = await ownerFromRequest();
    const { id } = await context.params;
    const payload = (await request.json()) as Record<string, unknown>;
    const title = cleanText(payload.title);
    const scheduledFor = cleanDate(payload.scheduledFor);
    const clientId = cleanText(payload.clientId, 80) || null;
    const propertyId = cleanText(payload.propertyId, 80) || null;

    const [existing] = await getDb()
      .select()
      .from(calendarItems)
      .where(
        and(eq(calendarItems.id, id), eq(calendarItems.owner, owner)),
      )
      .limit(1);

    if (!existing) {
      return Response.json(
        { error: "El contenido agendado no existe." },
        { status: 404 },
      );
    }

    if (!title || !scheduledFor || !clientId) {
      return Response.json(
        { error: "Completá cliente, contenido, fecha y hora." },
        { status: 400 },
      );
    }

    const [client] = await getDb()
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.owner, owner)))
      .limit(1);
    const [property] = propertyId
      ? await getDb()
          .select()
          .from(properties)
          .where(
            and(eq(properties.id, propertyId), eq(properties.owner, owner)),
          )
          .limit(1)
      : [null];

    if (!client || (propertyId && !property)) {
      return Response.json(
        { error: "El cliente o la propiedad seleccionada no existe." },
        { status: 400 },
      );
    }

    const status = cleanText(payload.status, 30);
    const updatedAt = new Date().toISOString();
    const values = {
      clientId,
      propertyId,
      title,
      contentType: cleanText(payload.contentType, 40) || "post",
      channel: cleanText(payload.channel, 40) || "Instagram",
      scheduledFor,
      status: VALID_STATUSES.has(status) ? status : "planned",
      notes: cleanText(payload.notes, 1600) || null,
      updatedAt,
    };

    await getDb()
      .update(calendarItems)
      .set(values)
      .where(
        and(eq(calendarItems.id, id), eq(calendarItems.owner, owner)),
      );

    return Response.json({
      item: {
        ...existing,
        ...values,
        notes: values.notes || "",
        clientName: client.name,
        clientColor: client.color,
        propertyTitle: property?.title || property?.name || "",
      },
    });
  } catch (error) {
    console.error("Calendar item update failed", error);
    return Response.json(
      { error: "No se pudo actualizar el contenido." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  void request;

  try {
    await ensureDbSchema();
    const owner = await ownerFromRequest();
    const { id } = await context.params;

    await getDb()
      .delete(calendarItems)
      .where(
        and(eq(calendarItems.id, id), eq(calendarItems.owner, owner)),
      );

    return Response.json({ deleted: true, id });
  } catch (error) {
    console.error("Calendar item deletion failed", error);
    return Response.json(
      { error: "No se pudo eliminar el contenido." },
      { status: 500 },
    );
  }
}
