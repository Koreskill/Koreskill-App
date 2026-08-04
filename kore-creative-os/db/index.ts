import { drizzle } from "drizzle-orm/d1";
import { getRuntimeBindings } from "../lib/worker-env";
import * as schema from "./schema";

let schemaReady: Promise<void> | null = null;

export function getDb() {
  const db = getRuntimeBindings().DB;
  if (!db) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(db, { schema });
}

export async function ensureDbSchema() {
  const db = getRuntimeBindings().DB;
  if (!db) {
    throw new Error("El almacenamiento de trabajos no está disponible.");
  }
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.batch([
        db.prepare(
          `CREATE TABLE IF NOT EXISTS properties (
            id text PRIMARY KEY NOT NULL,
            owner text NOT NULL,
            name text NOT NULL,
            slug text,
            type text,
            operation text,
            title text,
            zone text,
            address text,
            client text,
            currency text,
            price_value integer,
            total_m2 real,
            covered_m2 real,
            bedrooms integer,
            bathrooms integer,
            garages integer,
            property_status text,
            situation text,
            highlights_json text DEFAULT '[]' NOT NULL,
            contact text,
            raw_source text,
            created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS image_jobs (
            id text PRIMARY KEY NOT NULL,
            owner text NOT NULL,
            property_id text REFERENCES properties(id) ON DELETE CASCADE,
            batch_id text NOT NULL,
            filename text NOT NULL,
            mime_type text NOT NULL,
            prompt text NOT NULL,
            quality text DEFAULT 'low' NOT NULL,
            aspect_ratio text DEFAULT '9:16' NOT NULL,
            status text DEFAULT 'queued' NOT NULL,
            input_key text NOT NULL,
            output_key text,
            output_mime_type text,
            prediction_id text,
            error text,
            created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS prompt_presets (
            id text PRIMARY KEY NOT NULL,
            owner text NOT NULL,
            key text NOT NULL,
            label text NOT NULL,
            prompt text NOT NULL,
            created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`,
        ),
        db.prepare(
          `CREATE TABLE IF NOT EXISTS generation_runs (
            id text PRIMARY KEY NOT NULL,
            owner text NOT NULL,
            property_id text REFERENCES properties(id) ON DELETE CASCADE,
            job_id text NOT NULL REFERENCES image_jobs(id) ON DELETE CASCADE,
            prediction_id text NOT NULL,
            quality text NOT NULL,
            status text DEFAULT 'processing' NOT NULL,
            estimated_cost_micros integer DEFAULT 0 NOT NULL,
            error text,
            created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
            completed_at text
          )`,
        ),        db.prepare(
          `CREATE TABLE IF NOT EXISTS generated_texts (
            id text PRIMARY KEY NOT NULL,
            owner text NOT NULL,
            property_id text NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            type text NOT NULL,
            content text NOT NULL,
            source_text text,
            prompt_version text DEFAULT 'v1' NOT NULL,
            model text NOT NULL,
            input_tokens integer DEFAULT 0 NOT NULL,
            output_tokens integer DEFAULT 0 NOT NULL,
            estimated_cost_micros integer DEFAULT 0 NOT NULL,
            created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`,
        ),
      ]);

      const propertyColumnResult = await db
        .prepare("PRAGMA table_info(properties)")
        .all<{ name: string }>();
      const propertyColumns = new Set(
        (propertyColumnResult.results as Array<{ name: string }>).map(
          (column) => column.name,
        ),
      );
      const missingPropertyColumns = [
        ["slug", "ALTER TABLE properties ADD COLUMN slug text"],
        ["type", "ALTER TABLE properties ADD COLUMN type text"],
        ["operation", "ALTER TABLE properties ADD COLUMN operation text"],
        ["title", "ALTER TABLE properties ADD COLUMN title text"],
        ["zone", "ALTER TABLE properties ADD COLUMN zone text"],
        ["client", "ALTER TABLE properties ADD COLUMN client text"],
        ["currency", "ALTER TABLE properties ADD COLUMN currency text"],
        ["price_value", "ALTER TABLE properties ADD COLUMN price_value integer"],
        ["total_m2", "ALTER TABLE properties ADD COLUMN total_m2 real"],
        ["covered_m2", "ALTER TABLE properties ADD COLUMN covered_m2 real"],
        ["bedrooms", "ALTER TABLE properties ADD COLUMN bedrooms integer"],
        ["bathrooms", "ALTER TABLE properties ADD COLUMN bathrooms integer"],
        ["garages", "ALTER TABLE properties ADD COLUMN garages integer"],
        [
          "property_status",
          "ALTER TABLE properties ADD COLUMN property_status text",
        ],
        ["situation", "ALTER TABLE properties ADD COLUMN situation text"],
        [
          "highlights_json",
          "ALTER TABLE properties ADD COLUMN highlights_json text DEFAULT '[]' NOT NULL",
        ],
        ["contact", "ALTER TABLE properties ADD COLUMN contact text"],
        ["raw_source", "ALTER TABLE properties ADD COLUMN raw_source text"],
      ] as const;

      for (const [column, statement] of missingPropertyColumns) {
        if (!propertyColumns.has(column)) {
          await db.prepare(statement).run();
        }
      }

      const columns = await db.prepare("PRAGMA table_info(image_jobs)").all<{
        name: string;
      }>();
      const imageJobColumns = columns.results as Array<{ name: string }>;
      if (
        !imageJobColumns.some(
          (column: { name: string }) => column.name === "property_id",
        )
      ) {
        await db
          .prepare(
            "ALTER TABLE image_jobs ADD COLUMN property_id text REFERENCES properties(id) ON DELETE CASCADE",
          )
          .run();
      }

      await db.batch([
        db.prepare(
          "CREATE INDEX IF NOT EXISTS properties_owner_created_idx ON properties (owner, created_at)",
        ),
        db.prepare(
          "CREATE UNIQUE INDEX IF NOT EXISTS properties_owner_slug_idx ON properties (owner, slug)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS image_jobs_owner_created_idx ON image_jobs (owner, created_at)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS image_jobs_batch_idx ON image_jobs (batch_id)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS image_jobs_property_idx ON image_jobs (property_id)",
        ),
        db.prepare(
          "CREATE UNIQUE INDEX IF NOT EXISTS prompt_presets_owner_key_idx ON prompt_presets (owner, key)",
        ),
        db.prepare(
          "CREATE UNIQUE INDEX IF NOT EXISTS generation_runs_prediction_idx ON generation_runs (prediction_id)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS generation_runs_property_idx ON generation_runs (property_id)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS generation_runs_job_idx ON generation_runs (job_id)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS generated_texts_property_idx ON generated_texts (property_id)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS generated_texts_owner_created_idx ON generated_texts (owner, created_at)",
        ),
      ]);
    })().catch((error: unknown) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}
