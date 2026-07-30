import type { SupabaseClient } from "@supabase/supabase-js";

type Quality = "low" | "medium" | "high" | "auto" | string;

type NewGenerationLog = {
  userId: string;
  app: "properties" | "creatives";
  predictionId: string;
  propertyId?: string | null;
  prompt?: string | null;
  aspectRatio?: string | null;
  quality?: Quality;
  status?: string;
  outputUrl?: string | null;
  error?: string | null;
};

type GenerationUpdate = {
  userId: string;
  predictionId: string;
  status: string;
  outputUrl?: string | null;
  error?: string | null;
};

const QUALITY_COSTS: Record<string, number> = {
  low: 0.012,
  medium: 0.047,
  high: 0.128,
  auto: 0.047,
};

export async function startGenerationLog(
  supabase: SupabaseClient,
  generation: NewGenerationLog,
) {
  const { error } = await supabase.from("generation_logs").insert({
    user_id: generation.userId,
    app: generation.app,
    prediction_id: generation.predictionId,
    property_id: generation.propertyId || null,
    prompt: generation.prompt || null,
    aspect_ratio: generation.aspectRatio || null,
    quality: generation.quality || null,
    estimated_cost_usd:
      QUALITY_COSTS[generation.quality || ""] || 0,
    status: generation.status || "starting",
    output_url: generation.outputUrl || null,
    error: generation.error || null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Could not create generation audit log", error);
  }
}

export async function updateGenerationLog(
  supabase: SupabaseClient,
  generation: GenerationUpdate,
) {
  const { error } = await supabase
    .from("generation_logs")
    .update({
      status: generation.status,
      output_url: generation.outputUrl || null,
      error: generation.error || null,
      updated_at: new Date().toISOString(),
    })
    .eq("prediction_id", generation.predictionId)
    .eq("user_id", generation.userId);

  if (error) {
    console.error("Could not update generation audit log", error);
  }
}