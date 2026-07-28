import { sql } from "drizzle-orm";
import {
  index,
  integer,
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
    address: text("address"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("properties_owner_created_idx").on(table.owner, table.createdAt),
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
      .references(() => imageJobs.id, { onDelete: "cascade" }),
    predictionId: text("prediction_id").notNull(),
    quality: text("quality").notNull(),
    status: text("status").notNull().default("processing"),
    estimatedCostMicros: integer("estimated_cost_micros").notNull().default(0),
    error: text("error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("generation_runs_prediction_idx").on(table.predictionId),
    index("generation_runs_property_idx").on(table.propertyId),
    index("generation_runs_job_idx").on(table.jobId),
  ],
);
