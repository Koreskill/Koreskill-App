export type RuntimeBindings = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  REPLICATE_API_TOKEN?: string;
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
