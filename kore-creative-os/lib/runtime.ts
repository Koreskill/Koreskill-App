import { getRuntimeBindings } from "./worker-env";

export function getBucket(): R2Bucket {
  const bucket = getRuntimeBindings().BUCKET;
  if (!bucket) {
    throw new Error("El almacenamiento de imágenes no está disponible.");
  }
  return bucket;
}

export function getReplicateToken(): string | null {
  return getRuntimeBindings().REPLICATE_API_TOKEN?.trim() || null;
}

export function isReplicateConfigured(): boolean {
  return Boolean(getReplicateToken());
}
