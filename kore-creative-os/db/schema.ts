import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const properties = sqliteTable(
  "properties",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    slug: text("slug"),
    type: text("type"),
    operation: text("operation"),
    title: text("title"),
    zone: text("zone"),
    address: text("address"),
    client: text("client"),
    currency: text("currency"),
    priceValue: integer("price_value"),
    totalM2: real("total_m2"),
    coveredM2: real("covered_m2"),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    garages: integer("garages"),
    propertyStatus: text("property_status"),
    situation: text("situation"),
    highlightsJson: text("highlights_json").notNull().default("[]"),
    contact: text("contact"),
    rawSource: text("raw_source"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("properties_owner_created_idx").on(table.owner, table.createdAt),
    uniqueIndex("properties_owner_slug_idx").on(table.owner, table.slug),
  ],
);

export const promptPresets = sqliteTable(
  "prompt_presets",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    prompt: text("prompt").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("prompt_presets_owner_key_idx").on(table.owner, table.key),
  ],
);

export const imageJobs = sqliteTable(
  "image_jobs",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    propertyId: text("property_id").references(() => properties.id, {
      onDelete: "cascade",
    }),
    batchId: text("batch_id").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    prompt: text("prompt").notNull(),
    quality: text("quality").notNull().default("low"),
    aspectRatio: text("aspect_ratio").notNull().default("9:16"),
    status: text("status").notNull().default("queued"),
    inputKey: text("input_key").notNull(),
    outputKey: text("output_key"),
    outputMimeType: text("output_mime_type"),
    predictionId: text("prediction_id"),
    error: text("error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("image_jobs_owner_created_idx").on(table.owner, table.createdAt),
    index("image_jobs_batch_idx").on(table.batchId),
    index("image_jobs_property_idx").on(table.propertyId),
  ],
);

export const generationRuns = sqliteTable(
  "generation_runs",
  {
    id: text("id").primaryKey(),

    owner: text("owner").notNull(),

    propertyId: text("property_id").references(() => properties.id, {
      onDelete: "cascade",
    }),

    jobId: text("job_id")
      .notNull()
      .references(() => imageJobs.id, {
        onDelete: "cascade",
      }),

    predictionId: text("prediction_id").notNull(),

    quality: text("quality").notNull(),

    status: text("status")
      .notNull()
      .default("processing"),

    estimatedCostMicros: integer("estimated_cost_micros")
      .notNull()
      .default(0),

    error: text("error"),

    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),

    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("generation_runs_prediction_idx").on(table.predictionId),

    index("generation_runs_property_idx").on(table.propertyId),

    index("generation_runs_job_idx").on(table.jobId),
  ],
);

export const generatedTexts = sqliteTable(
  "generated_texts",
  {
    id: text("id").primaryKey(),

    owner: text("owner").notNull(),

    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, {
        onDelete: "cascade",
      }),

    type: text("type").notNull(),

    content: text("content").notNull(),

    sourceText: text("source_text"),

    promptVersion: text("prompt_version")
      .notNull()
      .default("v1"),

    model: text("model").notNull(),

    inputTokens: integer("input_tokens")
      .notNull()
      .default(0),

    outputTokens: integer("output_tokens")
      .notNull()
      .default(0),

    estimatedCostMicros: integer("estimated_cost_micros")
      .notNull()
      .default(0),

    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),

    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("generated_texts_property_idx").on(table.propertyId),

    index("generated_texts_owner_created_idx").on(
      table.owner,
      table.createdAt,
    ),
  ],
);

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#2563eb"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("clients_owner_name_idx").on(table.owner, table.name),
    index("clients_owner_created_idx").on(table.owner, table.createdAt),
  ],
);

export const calendarItems = sqliteTable(
  "calendar_items",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    clientId: text("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    propertyId: text("property_id").references(() => properties.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    contentType: text("content_type").notNull().default("post"),
    channel: text("channel").notNull().default("Instagram"),
    scheduledFor: text("scheduled_for").notNull(),
    status: text("status").notNull().default("planned"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("calendar_items_owner_date_idx").on(
      table.owner,
      table.scheduledFor,
    ),
    index("calendar_items_client_idx").on(table.clientId),
    index("calendar_items_property_idx").on(table.propertyId),
  ],
);

export const cameraPresets = sqliteTable(
  "camera_presets",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    horizontal: real("horizontal").notNull().default(0),
    vertical: real("vertical").notNull().default(0),
    zoom: real("zoom").notNull().default(0),
    pan: real("pan").notNull().default(0),
    tilt: real("tilt").notNull().default(0),
    rotate: real("rotate").notNull().default(0),
    durationSeconds: real("duration_seconds").notNull().default(5),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("camera_presets_owner_name_idx").on(table.owner, table.name),
    index("camera_presets_owner_created_idx").on(table.owner, table.createdAt),
  ],
);
