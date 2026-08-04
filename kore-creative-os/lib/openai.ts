import OpenAI from "openai";
import { getRuntimeBindings } from "@/lib/worker-env";

let cachedClient: OpenAI | null = null;
let cachedApiKey = "";

function getOpenAISettings() {
  const bindings = getRuntimeBindings();

  const apiKey = bindings.OPENAI_API_KEY?.trim() || "";
  const model = bindings.OPENAI_TEXT_MODEL?.trim() || "";

  return {
    apiKey,
    model,
  };
}

export function isOpenAIConfigured() {
  try {
    const { apiKey, model } = getOpenAISettings();

    return Boolean(apiKey && model);
  } catch {
    return false;
  }
}

export function getOpenAIClient() {
  const { apiKey } = getOpenAISettings();

  if (!apiKey) {
    throw new Error(
      "OpenAI no está conectado. Configurá OPENAI_API_KEY en Dokploy.",
    );
  }

  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new OpenAI({
      apiKey,
    });

    cachedApiKey = apiKey;
  }

  return cachedClient;
}

export function getOpenAITextModel() {
  const { model } = getOpenAISettings();

  if (!model) {
    throw new Error(
      "Falta configurar OPENAI_TEXT_MODEL en Dokploy.",
    );
  }

  return model;
}