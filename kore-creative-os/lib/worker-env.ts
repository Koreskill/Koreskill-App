export type RuntimeBindings = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  REPLICATE_API_TOKEN?: string;
  OPENAI_API_KEY?: string;
  OPENAI_TEXT_MODEL?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
};

let runtimeBindings: RuntimeBindings | null = null;

export function setRuntimeBindings(bindings: RuntimeBindings): void {
  runtimeBindings = bindings;
}

export function getRuntimeBindings(): RuntimeBindings {
  if (!runtimeBindings) {
    throw new Error("Las conexiones del servidor todavía no están disponibles.");
  }

  return runtimeBindings;
}
