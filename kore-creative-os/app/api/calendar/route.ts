import { and, asc, eq } from "drizzle-orm";
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

async function ownedRelations(
  owner: string,
  clientId: string | null,
  propertyId: string | null,
) {
  const db = getDb();
  const [client] = clientId
    ? await db
        .select()
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.owner, owner)))
        .limit(1)
    : [null];
  const [property] = propertyId
    ? await db
        .select()
        .from(properties)
        .where(and(eq(properties.id, propertyId), eq(properties.owner, owner)))
        .limit(1)
    : [null];

  return { client, property };
}

export async function GET() {
  try {
    await ensureDbSchema();
    const owner = await ownerFromRequest();
    const items = await getDb()
      .select({
        id: calendarItems.id,
        clientId: calendarItems.clientId,
        propertyId: calendarItems.propertyId,
        title: calendarItems.title,
        contentType: calendarItems.contentType,
        channel: calendarItems.channel,
        scheduledFor: calendarItems.scheduledFor,
        status: calendarItems.status,
        notes: calendarItems.notes,
        createdAt: calendarItems.createdAt,
        updatedAt: calendarItems.updatedAt,
        clientName: clients.name,
        clientColor: clients.color,
        propertyTitle: properties.title,
        propertyName: properties.name,
      })
      .from(calendarItems)
      .leftJoin(clients, eq(calendarItems.clientId, clients.id))
      .leftJoin(properties, eq(calendarItems.propertyId, properties.id))
      .where(eq(calendarItems.owner, owner))
      .orderBy(asc(calendarItems.scheduledFor));

    return Response.json({
      items: items.map((item) => ({
        ...item,
        notes: item.notes || "",
        clientName: item.clientName || "Sin cliente",
        clientColor: item.clientColor || "#64748b",
        propertyTitle: item.propertyTitle || item.propertyName || "",
      })),
    });
  } catch (error) {
    console.error("Calendar load failed", error);
    return Response.json(
      { error: "No se pudo cargar el calendario." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDbSchema();
    const owner = await ownerFromRequest();
    const payload = (await request.json()) as Record<string, unknown>;
    const title = cleanText(payload.title);
    const scheduledFor = cleanDate(payload.scheduledFor);
    const clientId = cleanText(payload.clientId, 80) || null;
    const propertyId = cleanText(payload.propertyId, 80) || null;

    if (!title || !scheduledFor || !clientId) {
      return Response.json(
        { error: "Completá cliente, contenido, fecha y hora." },
        { status: 400 },
      );
    }

    const { client, property } = await ownedRelations(
      owner,
      clientId,
      propertyId,
    );

    if (!client || (propertyId && !property)) {
      return Response.json(
        { error: "El cliente o la propiedad seleccionada no existe." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const status = cleanText(payload.status, 30);
    const item = {
      id: crypto.randomUUID(),
      owner,
      clientId,
      propertyId,
      title,
      contentType: cleanText(payload.contentType, 40) || "post",
      channel: cleanText(payload.channel, 40) || "Instagram",
      scheduledFor,
      status: VALID_STATUSES.has(status) ? status : "planned",
      notes: cleanText(payload.notes, 1600) || null,
      createdAt: now,
      updatedAt: now,
    };

    await getDb().insert(calendarItems).values(item);

    return Response.json(
      {
        item: {
          ...item,
          notes: item.notes || "",
          clientName: client.name,
          clientColor: client.color,
          propertyTitle: property?.title || property?.name || "",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Calendar item creation failed", error);
    return Response.json(
      { error: "No se pudo agendar el contenido." },
      { status: 500 },
    );
  }
}
